// MAYBE: note popup on mouse over
// MAYBE: save note pos and dims locally, outside note
// MAYBE: save create and update time
// TODO: test brand new installation with XNote++ and then switch to QNote
// TODO: qpopup z-index
// TODO: AL+Q
//       *) holding alt+q pops way too fast
//       *) when multiple popups are open, alt+q pops with selected message only, not with focused popup
// TODO: menu - close all opened notes
// TODO: add "install", "update" handling if neccessary
// TODO: options
//       *) fix reset to defaults when incorrect path was entered
//       *) test import/export. Reset to defaults, etc unfinished features
// TODO: write usage docs (inc filters, actions)

// App -> INotePopup -> DefaultNotePopup -> QNotePopup -> qpopup experiment API
//  |     \                            \     \-> handles events sent by qpopup.api, fires events back to App through DefaultNotePopup
//  |      \                            \-----> WebExtension popup -> browser.windows API
//  |       \-> fires events, registered by App
//  |
//  \-> PopupManager - maps INotePopup`s <-> keyId

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
import { confirmDelete, getCurrentWindowId, getPrefs, isClipboardSet, sendPrefsToQApp } from "./modules/common-background.mjs";
import { Menu } from "./modules/Menu.mjs";

var QDEB = true;

const debugHandle = "[qnote:background]";
const BrowserAction = browser.action ? browser.action : browser.browserAction;
const _ = browser.i18n.getMessage;

type UpdateIconsDetails = {
	path?: browser._manifest.IconPath | undefined;
	tabId?: number | undefined;
}

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

	async updateIcons(tabId: number, on: boolean){
		const params: UpdateIconsDetails = { path: on ? "images/icons/qnote.svg" : "images/icons/qnote-disabled.svg" };
		params.tabId = tabId;

		BrowserAction.setIcon(params);
		browser.messageDisplayAction.setIcon(params);
	}

	async updateTabView(tabId: number){
		QDEB&&console.debug("updateTabView() for tabId:", tabId);

		const messages = await browser.messageDisplay.getDisplayedMessages(tabId);

		if(messages.length == 1){
			const keyId = messages[0].headerMessageId;
			const note = await this.createAndLoadNote(keyId);

			await this.updateIcons(tabId, note.exists());
			await browser.tabs.executeScript(tabId, {
				file: "scripts/messageDisplay.js",
			});
		} else if(messages.length >= 1){
			const keyArray = [];
			for(let m of messages){
				const keyId = m.headerMessageId;
				const data = await this.getNoteData(keyId);
				if(data){
					keyArray.push(keyId);
				}
			};

			browser.qapp.attachNotesToMultiMessage(keyArray);
			this.updateIcons(tabId, true);
		} else {
			this.updateIcons(tabId, false);
		}
		await browser.qapp.updateColumsView();
	}

	async updateViews(tabId?: number | undefined){
		if(tabId){
			this.updateTabView(tabId);
		} else {
			browser.tabs.query({
				type: ["content", "mail", "messageDisplay"],
				status: "complete",
				windowType: "normal"
			}).then(tabs => {
				tabs.forEach(tab => {
					if(tab.id)
						this.updateTabView(tab.id);
				});
			});
		}
	}

	// TODO: add tag
	async saveOrUpdate(keyId: string, newNote: INoteData, overwrite: boolean): Promise<INoteData | null>{
		const note = await this.createAndLoadNote(keyId);

		if(note.exists() && !overwrite){
			return note.getData();
		}

		if(note.exists()){
			note.assignData(newNote);
		} else {
			note.assignData({ ...newNote, ts: Date.now() });
		}

		const noteData = await note.save() ? note.getData() : null;

		await this.updateViews();

		return noteData;
	}

	async onNoteCloseHandler(keyId: string, reason: string, state: IPopupState) {
		QDEB&&console.debug(`${debugHandle} popup close, keyId: ${keyId}, reason: ${reason}`);
		PopupManager.remove(keyId);
		if(reason == "close"){
			if(state.text){
				await this.saveOrUpdate(keyId, QNotePopup.state2note(state), true);
			}
			await browser.qapp.restoreFocus();
		} else if(reason == "delete"){
			await this.deleteNote(keyId);
			await browser.qapp.restoreFocus();
		} else if(reason == "escape"){
			await browser.qapp.restoreFocus();
		} else {
			console.warn(`${debugHandle} unknown popup close reason: ${reason}`);
		}
	}

	async createPopup(keyId: string, noteData: INoteData | null): Promise<INotePopup> {
		QDEB&&console.debug(`${debugHandle} createPopup:`, keyId);
		await browser.qapp.saveFocus();
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
				popup.addListener("close", this.onNoteCloseHandler.bind(this)); // TODO: auto bind withing event dispatcher

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

	async menuHandler(info: browser.menus.OnClickData) {
		var menuDebugHandle: string = `${debugHandle} [menuHandler]`;
		if(!info.selectedMessages || !info.selectedMessages.messages.length){
			QDEB&&console.warn(`${menuDebugHandle} menu: no messages selected, bail`);
			return;
		}

		QDEB&&console.info(`${menuDebugHandle} menuItemId:`, info.menuItemId);

		const messages = info.selectedMessages.messages;

		// process single message
		if(messages.length === 1){
			const keyId = messages[0].headerMessageId;

			if(info.menuItemId === "create" || info.menuItemId === "modify"){
				this.popNote(await this.createAndLoadNote(keyId));
			} else if(info.menuItemId === "paste"){
				const sourceNoteData = await browser.qnote.getFromClipboard();
				if(isClipboardSet(sourceNoteData)){
					sourceNoteData.ts = Date.now();
					this.saveOrUpdate(keyId, sourceNoteData, true);
				} else {
					QDEB&&console.debug(`${menuDebugHandle} paste - no data`);
				}
			} else if(info.menuItemId === "options"){
				browser.runtime.openOptionsPage();
			} else if(info.menuItemId === "copy"){
				this.getNoteData(keyId).then(data => {
					if(data) {
						browser.qnote.copyToClipboard(data)
					}
				});
			} else if(info.menuItemId === "delete"){
				if(!this.prefs.confirmDelete || await confirmDelete()) {
					await this.deleteNote(keyId)
				}
			} else if(info.menuItemId === "reset"){
				this.resetNote(keyId);
			} else {
				console.error(`BUG: ${menuDebugHandle} unknown menuItemId:`, info.menuItemId);
			}
		// process multiple message selection
		// TODO: should not updateView() on every processed message!!
		} else if(messages.length > 1){
			if(info.menuItemId === "create_multi"){
				this.createMultiNote(messages);
			} else if(info.menuItemId === "paste_multi"){
				const sourceNoteData = await browser.qnote.getFromClipboard();
				if(sourceNoteData && isClipboardSet(sourceNoteData)){
					sourceNoteData.ts = Date.now();
					for(const m of messages){
						await this.saveOrUpdate(m.headerMessageId, sourceNoteData, true);
					};
				}
			} else if(info.menuItemId === "delete_multi"){
				if(!this.prefs.confirmDelete || await confirmDelete()) {
					for(const m of messages){
						await this.deleteNote(m.headerMessageId);
					}
				}
			} else if(info.menuItemId === "reset_multi"){
				for(const m of messages){
					this.resetNote(m.headerMessageId);
				}
			} else {
				console.error(`BUG: ${menuDebugHandle} unknown menuItemId:`, info.menuItemId);
			}
		}
	}

	async resetNote(keyId: string){
		const popup = PopupManager.has(keyId) ? PopupManager.get(keyId) : null;

		if(popup){
			await popup.resetPosition();
			return
		}

		const note = await this.createAndLoadNote(keyId);

		if(note.exists()){
			note.assignData({
				left: undefined,
				top: undefined,
				width: this.prefs.width,
				height: this.prefs.height,
			});
			note.save();
		}
	}

	// TODO: remove tag
	async deleteNote(keyId: string): Promise<boolean> {
		const popup = PopupManager.has(keyId) ? PopupManager.get(keyId) : null;

		if(popup){
			await PopupManager.get(keyId).close();
		}

		const note = await this.createAndLoadNote(keyId);

		if(note.exists()){
			await note.delete();
			await this.updateViews();
			return true;
		} else {
			return false;
		}
	}

	async createMultiNote(messages: browser.messages.MessageHeader[]){
		const windowId = await getCurrentWindowId();

		if(!windowId){
			// return reject("Could not get current window");
			return;
		}

		const popupState = QNotePopup.note2state({}, this.prefs);
		popupState.placeholder = _("multi.note.warning");

		const popup = await QNotePopup.create("multi-note-create", windowId, popupState);

		popup.addListener("close", async (keyId, reason, state) =>{
			if(reason == "close" && state.text){
				const noteData = QNotePopup.state2note(state);
				for(const m of messages){
					await this.saveOrUpdate(m.headerMessageId, noteData, false)
				}
				// this.updateMultiPane(messages);
			}
		});

		popup.pop();
	}

	// TODO: better to have messageId (number) here rather than searching for keyId. Now... how to get that id here...
	//       This means it should be somehow preserved from onMessagesDisplayed() event...
	// async function tagMessage(id, tagName, toTag = true) {
	// async tagMessage(messageId: number){
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

	async initExtension(){
		QDEB&&console.log(`${debugHandle} initExtension()`);

		await browser.qapp.init(convertPrefsToQAppPrefs(this.prefs));
		await browser.qapp.setDebug(QDEB);

		QNotePopup.init(QDEB);

		// await this.updateView();

		// window.addEventListener("unhandledrejection", event => {
		// 	console.warn(`Unhandle: ${event.reason}`, event);
		// });

		// Below are various listeners only

		// Messages displayed
		browser.messageDisplay.onMessagesDisplayed.addListener(async (tab: browser.tabs.Tab, messages: browser.messages.MessageHeader[]) => {
			QDEB&&console.debug(`${debugHandle} messageDisplay.onMessagesDisplayed:`, messages);
			if(messages.length == 1){
				const keyId = messages[0].headerMessageId;
				const note = await this.createAndLoadNote(keyId);

				if(note.exists() && this.prefs.showOnSelect){
					this.popNote(note);
				}
			}
			this.updateViews(tab.id);
		});

		// Change folders
		browser.mailTabs.onDisplayedFolderChanged.addListener(async (tab, _displayedFolder) => {
			QDEB&&console.debug(`${debugHandle} mailTabs.onDisplayedFolderChanged()`);
		});

		// Create tabs
		// browser.tabs.onCreated.addListener(async tab => {
		// 	QDEB&&console.debug(`${debugHandle} tabs.onCreated(), tabId:`, tab.id);
		// });

		// Change tabs
		// browser.tabs.onActivated.addListener(async activeInfo => {
		// 	QDEB&&console.debug(`${debugHandle} tabs.onActivated(), id:`, activeInfo);
		// 	// this.updateView();
		// });

		// browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
		// 	QDEB&&console.debug(`${debugHandle} tabs.onUpdated(), id:`, tabId, changeInfo, tab);
		// 	// this.updateView();
		// });

		// Create window
		// browser.windows.onCreated.addListener(async window => {
		// 	QDEB&&console.debug("windows.onCreated(), windowId:", window.id);

		// 	// This check is needed for WebExtensionNoteWindow
		// 	if(window.type === "normal"){
		// 		// CurrentWindowId = Window.id;
		// 	}

		// 	// await CurrentNote.silentlyPersistAndClose();
		// });

		// Remove window
		// browser.windows.onRemoved.addListener(async windowId => {
		// 	QDEB&&console.debug(`${debugHandle} windows.onRemoved(), windowId:`, windowId);
		// });

		// Change focus
		// browser.windows.onFocusChanged.addListener(async windowId => {
		// 	// QDEB&&console.debug("windows.onFocusChanged(), windowId:", windowId, CurrentNote);
		// 	// console.error("browser.windows.onFocusChanged");

		// 	// if(
		// 	// 	true
		// 	// 	|| windowId === browser.windows.WINDOW_ID_NONE
		// 	// 	|| windowId === CurrentNote.windowId
		// 	// 	|| windowId === CurrentNote.popupId // This check is needed for WebExtensionNoteWindow
		// 	// ){
		// 	// 	return;
		// 	// }

		// 	// CurrentNote.windowId = CurrentWindowId = windowId;
		// 	// CurrentTabId = await getCurrentTabId();

		// 	// mpUpdateCurrent();

		// 	// await CurrentNote.silentlyPersistAndClose();
		// });

		const actionHandler = (tab: browser.tabs.Tab) => {
			const actiondebugHandle = `${debugHandle} [tab:${tab.id}]`

			if(!tab.id){
				QDEB&&console.debug(`${actiondebugHandle} no tab.id, bail`);
				return;
			}

			browser.messageDisplay.getDisplayedMessages(tab.id).then(async (messages) => {
				if(messages.length == 1){
					const keyId = messages[0].headerMessageId;
					const note = await this.createAndLoadNote(keyId);

					if(PopupManager.has(keyId)){
						PopupManager.get(keyId).close();
					} else {
						this.popNote(note);
					}
				} else if(messages.length >= 1){
					this.createMultiNote(messages);
				}
			});
		};

		// Click on main toolbar
		BrowserAction.onClicked.addListener(actionHandler);

		// Click on QNote button
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
					const note = await this.createAndLoadNote(messages[0].headerMessageId);

					if(note.exists()){
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
			QDEB&&console.group(`${debugHandle} received message:`, this);
			QDEB&&console.debug("rawData:", rawData);
			QDEB&&console.debug("sender:", sender);

			if((new AttachToMessage()).parse(rawData)){
				if(sender.tab?.id) {
					QDEB&&console.debug(`${debugHandle} received "AttachToMessage" message`);
					const messages = await browser.messageDisplay.getDisplayedMessages(sender.tab.id);

					if(messages.length == 1){
						const data = await this.getNoteData(messages[0].headerMessageId);
						if(data){
							const reply = new AttachToMessageReply({
								note: data,
								html: this.applyTemplate(this.prefs.attachTemplate, data),
								prefs: this.prefs,
								keyId: messages[0].headerMessageId
							});

							QDEB&&console.groupEnd();

							return reply.data;
						}
					}
				}
			} else if((new RestoreFocus()).parse(rawData)){
				QDEB&&console.debug(`${debugHandle} received "RestoreFocus" message`);
				browser.qapp.restoreFocus();
			} else if((new PrefsUpdated()).parse(rawData)){
				QDEB&&console.debug(`${debugHandle} received "PrefsUpdated" message`);
				this.prefs = await getPrefs();
				await sendPrefsToQApp(this.prefs);
				this.updateViews();
			} else {
				console.error(`${debugHandle} unknown message`);
			}

			QDEB&&console.groupEnd();

			return false;
		});

		browser.menus.onClicked.addListener(this.menuHandler.bind(this));

		this.updateViews();
	}
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
	(new QNoteExtension(await getPrefs())).initExtension();
});
