// MAYBE: multiple notes simultaneously
// MAYBE: note popup on mouse over
// TODO: save note pos and dims locally, outside note
// TODO: save create and update time
// TODO: attach keyb/col handler to all windows at the start
// TODO: experiment with div overlays as popup in content scripts
//       Something is broken with scrollbars in qpopup, textarea gets wrapped in some div
// TODO: test brand new installation with XNote++ and then switch to QNote
// TODO: update messagepane after notechange: https://webextension-api.thunderbird.net/en/128-esr-mv2/scripting.messageDisplay.html#registerscripts-scripts
// TODO: qpopup z-index
// TODO: drag requestanimationframe?
// TODO: holding alt+q pops way too fast
// TODO: when multiple popups are open, alt+q pops with selected message only. Not with focused popup
// TODO: menu - close all opened notes
// TODO: update colums, message view after mainipulations
// TODO: icons: edit, copy, paste, delete, reset positions, settings
// TODO: qpopup: less opacity for title
// TODO: qpopup: handle zoom in-out

// App -> INotePopup -> DefaultNotePopup -> QNotePopup -> qpopup.api
//  |     \                            \     \-> handles events sent by qpopup.api, fires events back to App through DefaultNotePopup
//  |      \                            \-----> WebExtension popup -> ext api (TODO)
//  |       \-> fires events, registered by App
//  |
//  \-> PopupManager - self-maintains handles Map to INotePopup`s

// Interesting links
//
//      Background scripts
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Background_scripts
//
//     ESMification: Out-of-tree Migration
// https://docs.google.com/document/d/14FqYX749nJkCSL_GknCDZyQnuqkXNc9KoTuXSV3HtMg/edit
//
//     ESMification: In-tree Migration Phase 1
// https://docs.google.com/document/d/1cpzIK-BdP7u6RJSar-Z955GV--2Rj8V4x2vl34m36Go/edit#heading=h.jpld4f8xni91
//
//     XPCOM String Guide
// https://firefox-source-docs.mozilla.org/xpcom/stringguide.html
//
//    Types for MozXULElement and others
// https://github.com/dothq/browser-desktop/blob/nightly/types.d.ts

import { AttachToMessage, AttachToMessageReply, PrefsUpdated, RestoreFocus } from "./modules/Messages.mjs";
import { INote, INoteData, QNoteFolder, QNoteLocalStorage } from "./modules/Note.mjs";
import { INotePopup, IPopupState, QNotePopup } from "./modules/NotePopups.mjs";
import { convertPrefsToQAppPrefs, dateFormatWithPrefs, IPreferences } from "./modules/common.mjs";
import { confirmDelete, getCurrentTabId, getCurrentWindowId, getPrefs, isClipboardSet, sendPrefsToQApp } from "./modules/common-background.mjs";
import { Menu } from "./modules/Menu.mjs";

var QDEB = true;
var App: QNoteExtension;

const debugHandle = "[qnote:background]";
const BrowserAction = browser.action ? browser.action : browser.browserAction;
const _ = browser.i18n.getMessage;

const PopupManager = new class {
	private popups = new Map<string, INotePopup>

	add(popup: QNotePopup): void {
		if(this.popups.has(popup.keyId)){
			throw new Error(`popup with keyId already exists: ${popup.keyId}`);
		} else {
			this.popups.set(popup.keyId, popup);
		}
	}

	get(keyId: string): INotePopup {
		if(this.popups.has(keyId)){
			return this.popups.get(keyId)!
		} else {
			throw new Error(`popup with keyId not found: ${keyId}`)
		}
	}

	remove(keyId: string) {
		return this.popups.delete(keyId);
	}

	has(keyId: string): boolean {
		return this.popups.has(keyId)
	}
}

class QNoteExtension
{
	prefs: IPreferences

	constructor(prefs: IPreferences) {
		QDEB&&console.info(`${debugHandle} new QNoteExtension()`);

		App = this;
		this.prefs = prefs;
		// TODO: re-enable debug
		// QDEB = prefs.enableDebug;
	}

	createNote(keyId: string): QNoteLocalStorage | QNoteFolder {
		QDEB&&console.debug(`${debugHandle} createNote(${keyId})`);
		if(this.prefs.storageOption == "ext"){
			return new QNoteLocalStorage(keyId);
		} else if(this.prefs.storageOption == "folder"){
			return new QNoteFolder(keyId, this.prefs.storageFolder);
		} else {
			throw new Error(`Unknown storageOption: ${this.prefs.storageOption}`);
		}
	}

	async createAndLoadNote(keyId: string) {
		const note = this.createNote(keyId);
		return note.load().then(() => note);
	}

	async getNoteData(keyId: string) {
		return this.createNote(keyId).load();
	}

	async updateMultiPane(messages: browser.messages.MessageHeader[]){
		let noteArray = [];
		let keyArray = [];
		for(let m of messages){
			const keyId = m.headerMessageId;
			const data = await this.getNoteData(keyId);
			if(data){
				noteArray.push(data);
				keyArray.push(keyId);
			}
		};

		const windowId = await getCurrentWindowId();
		if(windowId) {
			browser.qapp.attachNotesToMultiMessage(windowId, noteArray, keyArray);
		}
	}

	async updateIcons(on: boolean, tabId?: number){
		const icon = on ? "images/icon.svg" : "images/icon-disabled.svg";

		BrowserAction.setIcon({
			path: icon,
			tabId: tabId
		});

		browser.messageDisplayAction.setIcon({
			path: icon,
			tabId: tabId
		});
	}

	async updateTabMenusAndIcons(){
		browser.menus.removeAll();
		getCurrentTabId().then(tabId => this.updateIcons(false, tabId));
	}

	async updateView(keyId: string, note: INoteData | null){
		// Marks icons active
		this.updateIcons(!!note);

		if(note) {
			browser.qapp.saveNoteCache(keyId, note);
		}

		browser.qapp.updateColumsView();
	}

	async createPopup(keyId: string, noteData: INoteData | null): Promise<INotePopup> {
		QDEB&&console.debug(`${debugHandle} createPopup:`, keyId);
		await browser.qapp.focusSave();
		return new Promise(async (resolve, reject) => {
			if(PopupManager.has(keyId)){
				return resolve(PopupManager.get(keyId));
			}

			const windowId = await getCurrentWindowId();
			if(!windowId){
				return reject("Could not get current window");
			}

			let popup: QNotePopup | undefined;

			if(this.prefs.windowOption === 'xul'){
				popup = await QNotePopup.create(keyId, windowId, QNotePopup.note2state(noteData || {}, this.prefs));
			} else if(this.prefs.windowOption == 'webext'){
				console.error("TODO: new WebExtensionNoteWindow");
			} else {
				throw new TypeError(`${debugHandle} unknown windowOption option: ${this.prefs.windowOption}`);
			}

			if(popup){
				QDEB&&console.debug(`${debugHandle} new popup: ${keyId}`, popup);
				PopupManager.add(popup);
				popup.addListener("close", async (reason: string, state: IPopupState) => {
					QDEB&&console.debug(`${debugHandle} popup close:`, keyId, reason);
					PopupManager.remove(keyId);
					if(reason == "close"){
						const newNoteData = QNotePopup.state2note(state);
						// New note
						if(!noteData){
							newNoteData.ts = Date.now();
						}

						if(newNoteData.text){
							const newNote = App.createNote(keyId);
							newNote.updateData(newNoteData);
							await newNote.save();
							await this.updateView(keyId, newNote.getData());
						}
						await browser.qapp.focusRestore();
					} else if(reason == "delete"){
						await App.createNote(keyId).delete();
						await this.updateView(keyId, null);
						await browser.qapp.focusRestore();
					} else if(reason == "escape"){
						await browser.qapp.focusRestore();
					} else {
						console.warn(`${debugHandle} unknown popup close reason:`, reason);
					}
				});

				resolve(popup);
			}
		});
	}

	async popNote(note: INote){
		QDEB&&console.info(`${debugHandle} popNote(), keyId:`, note.keyId);

		this.createPopup(note.keyId, note.getData()).then(popup => popup.pop());
	}

	applyTemplate(t: string, data: INoteData): string {
		return t
			.replace("{{ qnote_date }}", dateFormatWithPrefs(this.prefs, data.ts))
			.replace("{{ qnote_text }}", '<span class="qnote-text-span"></span>')
		;
	}

	async saveNoteFrom(sourceData: INoteData, keyId: string) {
		const targetNote = this.createNote(keyId);
		targetNote.updateData(sourceData);
		targetNote.save();
	}

	async menuHandler(info: browser.menus.OnClickData) {
		var menuDebugHandle: string = `${debugHandle} [menuHandler]`;
		if(!info.selectedMessages || !info.selectedMessages.messages.length){
			QDEB&&console.warn(`${menuDebugHandle} menu: no messages selected, bail`);
			return;
		}

		QDEB&&console.info(`${menuDebugHandle} menuItemId: `, info.menuItemId);

		const messages = info.selectedMessages.messages;

		// process single message
		if(messages.length === 1){
			const keyId = messages[0].headerMessageId;

			if(info.menuItemId === "create" || info.menuItemId === "modify"){
				App.popNote(await App.createAndLoadNote(keyId));
			} else if(info.menuItemId === "paste"){
				const sourceNoteData = await browser.qnote.getFromClipboard();
				if(isClipboardSet(sourceNoteData)){
					sourceNoteData.ts = Date.now();
					App.saveNoteFrom(sourceNoteData, keyId);
				} else {
					QDEB&&console.debug(`${menuDebugHandle} paste - no data`);
				}
			} else if(info.menuItemId === "options"){
				browser.runtime.openOptionsPage();
			} else if(info.menuItemId === "copy"){
				App.getNoteData(keyId).then(data => {
					if(data) {
						browser.qnote.copyToClipboard(data)
					}
				});
			} else if(info.menuItemId === "delete"){
				if(!App.prefs.confirmDelete || await confirmDelete()) {
					if(await App.deleteNote(keyId)){
						App.updateView(keyId, null);
					}
				}
			} else if(info.menuItemId === "reset"){
				App.resetNote(keyId);
			} else {
				console.warn(`${menuDebugHandle} unknown menuItemId:`, info.menuItemId);
			}
		// process multiple message selection
		} else if(messages.length > 1){
			if(info.menuItemId === "create_multi"){
				App.createMultiNote(messages, true);
			} else if(info.menuItemId === "paste_multi"){
				const sourceNoteData = await browser.qnote.getFromClipboard();
				if(sourceNoteData && isClipboardSet(sourceNoteData)){
					sourceNoteData.ts = Date.now();
					for(const m of messages){
						await App.saveNoteFrom(sourceNoteData, m.headerMessageId);
					};
					App.updateMultiPane(messages);
				}
			} else if(info.menuItemId === "delete_multi"){
				if(!App.prefs.confirmDelete || await confirmDelete()) {
					for(const m of messages){
						await App.deleteNote(m.headerMessageId);
					}
					App.updateMultiPane(messages);
				}
			} else if(info.menuItemId === "reset_multi"){
				for(const m of messages){
					App.resetNote(m.headerMessageId);
				}
			} else {
				console.warn(`${menuDebugHandle} unknown menuItemId: `, info.menuItemId);
			}
		}
	}

	async resetNote(keyId: string){
		const popup = PopupManager.has(keyId) ? PopupManager.get(keyId) : null;

		if(popup){
			await popup.resetPosition();
			return
		}

		const note = await App.createAndLoadNote(keyId);

		if(note.exists()){
			note.updateData({
				left: undefined,
				top: undefined,
				width: App.prefs.width,
				height: App.prefs.height,
			});
			note.save();
		}
	}

	async deleteNote(keyId: string): Promise<boolean> {
		const popup = PopupManager.has(keyId) ? PopupManager.get(keyId) : null;

		if(popup){
			await PopupManager.get(keyId).close();
		}

		const note = await App.createAndLoadNote(keyId);

		if(note.exists()){
			note.delete();
			return true;
		} else {
			return false;
		}
	}

	async createMultiNote(messages: browser.messages.MessageHeader[], overwrite: boolean){
		const windowId = await getCurrentWindowId();

		if(!windowId){
			// return reject("Could not get current window");
			return;
		}

		const popupState = QNotePopup.note2state({}, this.prefs);
		popupState.placeholder = _("multi.note.warning");

		const popup = await QNotePopup.create("multi-note-create", windowId, popupState);

		popup.addListener("close", async (reason, state) =>{
			const noteData = QNotePopup.state2note(state);
			noteData.ts = Date.now();

			if(reason == "close"){
				for(const m of messages){
					const note = await this.createAndLoadNote(m.headerMessageId);
					if(!note.exists()){
						note.updateData(noteData);
						note.save();
					}
				}
			}
			this.updateMultiPane(messages);
		});

		popup.pop();
	}
}

// async function tagMessage(id, tagName, toTag = true) {
// 	return getMessage(id).then(message => {
// 		QDEB&&console.debug(`tagMessage(id:${id}, tagName:${tagName}, toTag:${toTag})`);
// 		let tags = message.tags;

// 		if(toTag){
// 			if(!message.tags.includes(tagName)){
// 				tags.push(tagName);
// 			}
// 		} else {
// 			tags = tags.filter(item => item !== tagName);
// 		}

// 		return browser.messages.update(message.id, {
// 			tags: tags
// 		});
// 	});
// }

// TODO: move under app class at some point
async function initExtension(){
	QDEB&&console.log(`${debugHandle} initExtension()`);

	// Return notes to qapp on request. Should be set before init
	browser.qapp.onNoteRequest.addListener(async (keyId: string) => App.getNoteData(keyId));

	await browser.qapp.init(convertPrefsToQAppPrefs(App.prefs));
	await browser.qapp.setDebug(QDEB);

	QNotePopup.init(QDEB);

	App.updateTabMenusAndIcons();

	// browser.scripting.messageDisplay.registerScripts([{
	// 	id: "qnote-message-display",
	// 	js: ["scripts/messageDisplay.js"],
	// 	css: ["html/qpopup.css"],
	// }]);

	browser.messageDisplayScripts.register({
		// id: "qnote-message-display",
		js: [{ file: "scripts/messageDisplay.js" }],
		css: [{ file: "html/qpopup.css" }],
	});

	// window.addEventListener("unhandledrejection", event => {
	// 	console.warn(`Unhandle: ${event.reason}`, event);
	// });

	// Below are various listeners only

	// Messages displayed
	browser.messageDisplay.onMessagesDisplayed.addListener(async (tab: browser.tabs.Tab, messages: browser.messages.MessageHeader[]) => {
		if(messages.length == 1){
			QDEB&&console.debug(`${debugHandle} messageDisplay.onMessagesDisplayed:`, messages);
			const keyId = messages[0].headerMessageId;
			const note = await App.createAndLoadNote(keyId);

			App.updateView(keyId, note.getData());

			if(note.exists() && App.prefs.showOnSelect){
				App.popNote(note);
			}
		} else {
			App.updateIcons(false);
			App.updateMultiPane(messages);
		}
	});

	// Change folders
	browser.mailTabs.onDisplayedFolderChanged.addListener(async (Tab, displayedFolder) => {
		QDEB&&console.debug(`${debugHandle} mailTabs.onDisplayedFolderChanged()`);

		// await CurrentNote.silentlyPersistAndClose();
		// console.error("TODO: CurrentNote.silentlyPersistAndClose()");

		App.updateTabMenusAndIcons();
	});

	// Create tabs
	browser.tabs.onCreated.addListener(async tab => {
		QDEB&&console.debug(`${debugHandle} tabs.onCreated(), tabId:`, tab.id);

		// await CurrentNote.silentlyPersistAndClose();
		// console.error("TODO: browser.tabs.onCreated");
	});

	// Change tabs
	browser.tabs.onActivated.addListener(async activeInfo => {
		QDEB&&console.debug(`${debugHandle} tabs.onActivated()`, activeInfo);

		// await CurrentNote.silentlyPersistAndClose();
	});

	// Create window
	browser.windows.onCreated.addListener(async window => {
		QDEB&&console.debug("windows.onCreated(), windowId:", window.id);

		// This check is needed for WebExtensionNoteWindow
		if(window.type === "normal"){
			// CurrentWindowId = Window.id;
		}

		// await CurrentNote.silentlyPersistAndClose();
	});

	// Remove window
	browser.windows.onRemoved.addListener(async windowId => {
		QDEB&&console.debug(`${debugHandle} windows.onRemoved(), windowId:`, windowId);
		// console.error("TODO: browser.windows.onRemoved()");

		// mpUpdateCurrent();
	});

	// Change focus
	browser.windows.onFocusChanged.addListener(async windowId => {
		// QDEB&&console.debug("windows.onFocusChanged(), windowId:", windowId, CurrentNote);
		// console.error("browser.windows.onFocusChanged");

		// if(
		// 	true
		// 	|| windowId === browser.windows.WINDOW_ID_NONE
		// 	|| windowId === CurrentNote.windowId
		// 	|| windowId === CurrentNote.popupId // This check is needed for WebExtensionNoteWindow
		// ){
		// 	return;
		// }

		// CurrentNote.windowId = CurrentWindowId = windowId;
		// CurrentTabId = await getCurrentTabId();

		// mpUpdateCurrent();

		// await CurrentNote.silentlyPersistAndClose();
	});

	const actionHandler = (tab: browser.tabs.Tab) => {
		const actiondebugHandle = `${debugHandle} [tab:${tab.id}]`

		if(!tab.id){
			QDEB&&console.debug(`${actiondebugHandle} no tab.id, bail`);
			return;
		}

		browser.messageDisplay.getDisplayedMessages(tab.id).then(async (messages) => {
			if(messages.length == 1){
				const keyId = messages[0].headerMessageId;
				const note = await App.createAndLoadNote(keyId);

				App.updateView(keyId, note.getData());

				if(PopupManager.has(keyId)){
					PopupManager.get(keyId).close();
				} else {
					App.popNote(note);
				}
			} else if(messages.length >= 1){
				console.error("TODO: multimessage");
			}
		});
	};

	// Click on main toolbar
	BrowserAction.onClicked.addListener(actionHandler);

	// // Click on QNote button
	browser.messageDisplayAction.onClicked.addListener(actionHandler);

	// Handle keyboard shortcuts
	browser.commands.onCommand.addListener((command, tab) => {
		if(command === 'qnote') {
			QDEB&&console.debug(`${debugHandle} commands.onCommand() command:`, command);
			actionHandler(tab);
		} else {
			console.error(`${debugHandle} unknown command: `, command);
		}
	});

	// Context menu on message
	browser.menus.onShown.addListener(async (info, tab) => {
		QDEB&&console.debug(`${debugHandle} menus.onShown()`);

		await browser.menus.removeAll();

		const in_message_list = info.contexts.includes('message_list');

		if(in_message_list){
			if(!info.selectedMessages){
				QDEB&&console.warn(`${debugHandle} selectedMessages object is not set, bail`)
				return;
			}

			const messages = info.selectedMessages.messages;

			// Single message
			if(messages.length == 1){
				const note = await App.createNote(messages[0].headerMessageId).load();

				if(note){
					await Menu.modify();
				} else {
					await Menu.new();
				}
				browser.menus.refresh();
			} else if(messages.length > 1){
				await Menu.multi();
				browser.menus.refresh();
			} else {
				QDEB&&console.warn(`${debugHandle} no messages selected`);
			}
		}
	});

	// Receive data from content
	browser.runtime.onMessage.addListener(async (rawData: any, sender: browser.runtime.MessageSender, _sendResponse) => {
		QDEB&&console.group(`${debugHandle} received message:`);
		QDEB&&console.debug("rawData:", rawData);
		QDEB&&console.debug("sender:", sender);

		if((new AttachToMessage()).parse(rawData)){
			if(sender.tab?.id) {
				QDEB&&console.debug(`${debugHandle} received "AttachToMessage" message`);
				const List = await browser.messageDisplay.getDisplayedMessages(sender.tab.id);

				if(List.length == 1){
					const data = await App.getNoteData(List[0].headerMessageId);
					if(data){
						const reply = new AttachToMessageReply({
							note: data,
							html: App.applyTemplate(App.prefs.attachTemplate, data),
							prefs: App.prefs,
						});

						QDEB&&console.groupEnd();

						return reply.data;
					}
				}
			}
		} else if((new RestoreFocus()).parse(rawData)){
			QDEB&&console.debug(`${debugHandle} received "RestoreFocus" message`);
			browser.qapp.focusRestore();
		} else {
			console.error(`${debugHandle} unknown message`);
		}

		QDEB&&console.groupEnd();

		return false;
	});

	// Receive data from content via connection
	browser.runtime.onConnect.addListener(connection => {
		QDEB&&console.log(`${debugHandle} new connection:`, connection);

		connection.onMessage.addListener(async (data: any) => {
			let message;

			QDEB&&console.log(`${debugHandle} connection.onMessage() received:`, data);

			if(message = (new PrefsUpdated).parse(data)){
				console.log(`${debugHandle} received "prefsUpdated" message:`, message);
				App.prefs = await getPrefs();
				sendPrefsToQApp(App.prefs);
			} else {
				console.error(`${debugHandle} unknown or incorrect message:`, data);
			}
		});
	});

	browser.menus.onClicked.addListener(App.menuHandler);

	// TODO: add "install", "update" handling if neccessary
	// if temporary - add reload button to the main toolbar to speed up developement
	// messenger.runtime.onInstalled.addListener(async ({ reason, temporary })
}

async function waitForLoad() {
	let windows = await browser.windows.getAll({windowTypes:["normal"]});
	if (windows.length > 0) {
		return false;
	}

	return new Promise(function(resolve, reject) {
		function listener() {
			browser.windows.onCreated.removeListener(listener);
			resolve(true);
		}
		browser.windows.onCreated.addListener(listener);
	});
}

QDEB&&console.debug(`${debugHandle} ResourceUrl.register("qnote")`);
await browser.ResourceUrl.register("qnote");

waitForLoad().then(async isAppStartup => {
	App = new QNoteExtension(await getPrefs());
	initExtension() // TODO: move inside App at some point
});
