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
// TODO: icons

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
import { convertPrefsToQAppPrefs, dateFormatWithPrefs } from "./modules/common.mjs";
import { confirmDelete, getCurrentTabId, getCurrentWindowId, getPrefs, isClipboardSet, sendPrefsToQApp } from "./modules/common-background.mjs";
import { IPreferences } from "./modules/api.mjs";
import { Menu } from "./modules/Menu.mjs";

var QDEB = true;
var App: QNoteExtension;

let BrowserAction = browser.action ? browser.action : browser.browserAction;
var _ = browser.i18n.getMessage;

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
		App = this;
		this.prefs = prefs
	}

	createNote(keyId: string): QNoteLocalStorage | QNoteFolder {
		QDEB&&console.debug(`createNote(${keyId})`);
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
		let icon = on ? "images/icon.svg" : "images/icon-disabled.svg";

		let BrowserAction = browser.action ? browser.action : browser.browserAction;

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
				throw new TypeError(`Unknown windowOption option: ${this.prefs.windowOption}`);
			}

			if(popup){
				console.log(`new popup: ${keyId}`, popup);
				PopupManager.add(popup);
				popup.addListener("close", async (reason: string, state: IPopupState) => {
					QDEB&&console.log("popup close:", keyId, reason);
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
						console.warn("Unknown close reason:", reason);
					}
				});

				resolve(popup);
			}
		});
	}

	async popNote(note: INote){
		QDEB&&console.debug("popNote(), keyId:", note.keyId);

		this.createPopup(note.keyId, note.getData()).then(async popup => {
			popup.pop();
		});
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
		if(!info.selectedMessages){
			console.warn("[menu] no messages selected");
			return;
		}

		const messages = info.selectedMessages.messages;

		// process single message
		if(info.selectedMessages.messages.length === 1){
			const keyId = messages[0].headerMessageId;

			if(info.menuItemId === "create" || info.menuItemId === "modify"){
				App.popNote(await App.createAndLoadNote(keyId));
			} else if(info.menuItemId === "paste"){
				const sourceNoteData = await browser.qnote.getFromClipboard();
				console.log("paste", sourceNoteData);
				if(isClipboardSet(sourceNoteData)){
					sourceNoteData.ts = Date.now();
					App.saveNoteFrom(sourceNoteData, keyId);
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
					if(PopupManager.has(keyId)){
						await PopupManager.get(keyId).close();
					}
					App.createNote(keyId).delete().then(() => App.updateView(keyId, null));
				}
			} else if(info.menuItemId === "reset"){
				const popup = PopupManager.has(keyId) ? PopupManager.get(keyId) : null;
				if(popup){
					await popup.resetPosition();
					return
				}

				const note = App.createNote(keyId);

				note.load().then(async data => {
					if(data){
						note.updateData({
							left: undefined,
							top: undefined,
							width: App.prefs.width,
							height: App.prefs.height,
						});
						await note.save();
					}
				});
			} else {
				console.error("Unknown menuItemId:", info.menuItemId);
			}
		// process multiple message selection
		} else if(info.selectedMessages.messages.length > 1){
			if(info.menuItemId === "create_multi"){
				createMultiNote(info.selectedMessages.messages, true);
			} else if(info.menuItemId === "paste_multi"){
				const sourceNoteData = await browser.qnote.getFromClipboard();
				if(sourceNoteData && isClipboardSet(sourceNoteData)){
					for(const m of info.selectedMessages.messages){
						await App.saveNoteFrom(sourceNoteData, m.headerMessageId);
					};
					App.updateMultiPane(info.selectedMessages.messages);
				}
			} else if(info.menuItemId === "delete_multi"){
				if(!App.prefs.confirmDelete || await confirmDelete()) {
					// TODO: code dup with menu single delete
					for(const m of info.selectedMessages.messages){
						const keyId = m.headerMessageId;
						if(PopupManager.has(keyId)){
							PopupManager.get(keyId).close();
						}
						await App.createNote(keyId).delete();
					}
					App.updateMultiPane(info.selectedMessages.messages);
				}
			} else if(info.menuItemId === "reset_multi"){
				for(const m of info.selectedMessages.messages){
					// TODO: code dup with menu single delete
					const keyId = m.headerMessageId;
					const popup = PopupManager.has(keyId) ? PopupManager.get(keyId) : null;

					if(popup){
						await popup.resetPosition();
					} else {
						const note = await App.createAndLoadNote(keyId);

						if(note.exists()){
							note.updateData({
								width: App.prefs.width,
								height: App.prefs.height,
								left: undefined,
								top: undefined,
							});
						}
					}
				}
			} else {
				console.error("Unknown menuItemId: ", info.menuItemId);
			}
		} else {
			console.warn("No messages selected");
		}
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

async function createMultiNote(messageList: any, overwrite = false){
	console.error("TODO: createMultiNote");
	// await CurrentPopup.silentlyPersistAndClose();
	// let note = createNote('qnote.multi');
	// CurrentPopup.note = note;
	// CurrentPopup.note.title = _("multi.note");
	// CurrentNote.note.placeholder = _("multi.note.warning");
	// CurrentNote.loadedNoteData = {};

	// let l = async () => {
	// 	if(CurrentNote.needSaveOnClose && note.text){
	// 		for(const m of messageList){
	// 			await getMessageKeyId(m.id).then(keyId => {
	// 				note.keyId = keyId;
	// 				if(overwrite){
	// 					saveNoteForMessage(m.id, note2QAppNote(note));
	// 				} else {
	// 					saveNoteForMessageIfNotExists(m.id, note2QAppNote(note));
	// 				}
	// 			});
	// 		};
	// 		mpUpdateForMultiMessage(messageList);
	// 	}
	// 	CurrentNote.removeListener("afterclose", l);
	// };

	// CurrentNote.addListener("afterclose", l);

	// CurrentNote.pop().then(() => {
	// 	CurrentNote.focus();
	// });
}

// TODO: move under app class at some point
async function initExtension(){
	QDEB&&console.debug("initExtension()");

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
		QDEB&&console.debug("mailTabs.onDisplayedFolderChanged()");

		// await CurrentNote.silentlyPersistAndClose();
		console.error("TODO: CurrentNote.silentlyPersistAndClose()");

		App.updateTabMenusAndIcons();
	});

	// Create tabs
	browser.tabs.onCreated.addListener(async Tab => {
		QDEB&&console.debug("tabs.onCreated(), tabId:", Tab.id, Tab);

		// await CurrentNote.silentlyPersistAndClose();
		console.error("TODO: browser.tabs.onCreated");
	});

	// Change tabs
	browser.tabs.onActivated.addListener(async activeInfo => {
		QDEB&&console.debug("tabs.onActivated()", activeInfo);

		// await CurrentNote.silentlyPersistAndClose();
		// CurrentTabId = activeInfo.tabId;
		console.error("TODO: browser.tabs.onActivated");
	});

	// Create window
	browser.windows.onCreated.addListener(async Window => {
		QDEB&&console.debug("windows.onCreated(), windowId:", Window.id, Window);

		// This check is needed for WebExtensionNoteWindow
		if(Window.type === "normal"){
			// CurrentWindowId = Window.id;
		}

		// await CurrentNote.silentlyPersistAndClose();
		console.error("TODO: browser.windows.onCreated");
	});

	// Remove window
	browser.windows.onRemoved.addListener(async windowId => {
		QDEB&&console.debug("windows.onRemoved(), windowId:", windowId);
		console.error("TODO: browser.windows.onRemoved()");

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
		QDEB&&console.debug("action", tab);

		if(!tab.id){
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
			} else {
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
			QDEB&&console.debug("commands.onCommand()", command);
			actionHandler(tab);
		} else {
			console.error("Unknown browser.commands.onCommand: ", command);
		}
	});

	// Context menu on message
	browser.menus.onShown.addListener(async (info, tab) => {
		await browser.menus.removeAll();

		const in_message_list = info.contexts.includes('message_list');

		if(in_message_list){
			if(!info.selectedMessages){
				console.warn("selectedMessages object is not set")
				return;
			}

			// Single message
			if(info.selectedMessages.messages.length == 1){
				const message = info.selectedMessages.messages[0];
				const note = await App.createNote(message.headerMessageId).load();

				if(note){
					await Menu.modify();
				} else {
					await Menu.new();
				}
				browser.menus.refresh();
			} else if(info.selectedMessages.messages.length > 1){
				await Menu.multi();
				browser.menus.refresh();
			} else {
				console.warn("no messages selected");
			}
		}
	});

	// Receive data from content
	browser.runtime.onMessage.addListener(async (rawData: any, sender: browser.runtime.MessageSender, _sendResponse) => {
		QDEB&&console.group("Received message:");
		QDEB&&console.debug("rawData:", rawData);
		QDEB&&console.debug("sender:", sender);

		if((new AttachToMessage()).parse(rawData)){
			if(sender.tab?.id) {
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
			browser.qapp.focusRestore();
		} else {
			console.error("Unknown message");
		}

		QDEB&&console.groupEnd();

		return false;
	});

	// Receive data from content via connection
	browser.runtime.onConnect.addListener(connection => {
		QDEB&&console.log("New connection: ", connection);
		connection.onMessage.addListener(async (data: any) => {
			let message;

			QDEB&&console.log(`Received ${data.command} message: `, data);

			if(message = (new PrefsUpdated).parse(data)){
				App.prefs = await getPrefs();
				console.log("new PrefsUpdated", message);
				sendPrefsToQApp(App.prefs);
			} else {
				console.error("Unknown or incorrect message: ", data);
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

QDEB&&console.debug("ResourceUrl.register(qnote)");
await browser.ResourceUrl.register("qnote");

waitForLoad().then(async isAppStartup => {
	App = new QNoteExtension(await getPrefs());
	initExtension() // TODO: move inside App at some point
});
