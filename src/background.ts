// MAYBE: note popup on mouse over
// MAYBE: save note pos and dims locally, outside note
// MAYBE: save create and update time
// MAYBE: multiple notes. This will require fixing qpopup z-index and option close all opened notes
// TODO: test brand new installation with XNote++ and then switch to QNote

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

//     Supercharge your Thunderbird extension debugging
// https://arndissler.net/supercharge-your-thunderbird-extension-debugging/

import { AttachToMessage, AttachToMessageReply, PopNote, PopupDataReply, PopupDataRequest, PrefsUpdated, RestoreFocus, SyncNote } from "./modules/Messages.mjs";
import { INote, INoteData, QNoteFolder, QNoteLocalStorage } from "./modules/Note.mjs";
import { INotePopup, IPopupState, note2state, QNotePopup, state2note, WebExtensionPopup } from "./modules/NotePopups.mjs";
import { convertPrefsToQAppPrefs, dateFormatWithPrefs, IPreferences } from "./modules/common.mjs";
import { confirmDelete, getCurrentWindowId, getPrefs, isClipboardSet, sendPrefsToQApp } from "./modules/common-background.mjs";
import { Menu } from "./modules/Menu.mjs";
import { QEventDispatcher } from "./modules/QEventDispatcher.mjs";
import { IPopupCloseReason } from "./modules-exp/api.mjs";

var QDEB = true;

const debugHandle = "[qnote:background]";
const BrowserAction = browser.action ? browser.action : browser.browserAction;
const _ = browser.i18n.getMessage;
const maxNoteCount = 1;

type UpdateIconsDetails = {
	path?: browser._manifest.IconPath | undefined;
	tabId?: number | undefined;
}

const PopupManager = new class {
	private popups = new Map<string, INotePopup>

	add(popup: QNotePopup | WebExtensionPopup): void {
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

	iter(f: (keyId: string, popup: INotePopup) => void){
		for(const [keyId, popup] of this.popups.entries()){
			f(keyId, popup);
		}
	}

	get count(){
		return this.popups.size;
	}
}

class QNoteExtension extends QEventDispatcher<{
	onnote: (keyId: string, reason: IPopupCloseReason, noteData: INoteData) => void
}> {
	prefs: IPreferences

	constructor(prefs: IPreferences) {
		super();
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
			}).catch(() => console.log("Could not insert js into tab:", tabId));
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
	async saveOrUpdate(keyId: string, newNote: INoteData, overwrite: boolean, updateViews: boolean = true): Promise<INoteData | null>{
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

		if(updateViews){
			await this.updateViews();
		}

		return noteData;
	}

	async onNoteHandler(keyId: string, reason: IPopupCloseReason, noteData: INoteData) {
		QDEB&&console.debug(`${debugHandle} popup close, keyId: ${keyId}, reason: ${reason}`);
		if(reason == "close"){
			PopupManager.remove(keyId);
			if(noteData.text){
				await this.saveOrUpdate(keyId, noteData, true);
			}
			await browser.qapp.restoreFocus();
		} else if(reason == "delete"){
			PopupManager.remove(keyId);
			await this.deleteNote(keyId);
			await browser.qapp.restoreFocus();
		} else if(reason == "escape"){
			PopupManager.remove(keyId);
			await browser.qapp.restoreFocus();
		} else if(reason == "sync"){
			PopupManager.get(keyId).note.assignData(noteData);
		} else {
			PopupManager.remove(keyId);
			console.warn(`${debugHandle} unknown popup close reason: ${reason}`);
		}
	}

	async createPopup(note: INote, popupState: IPopupState = {}): Promise<INotePopup> {
		const keyId = note.keyId;
		QDEB&&console.debug(`${debugHandle} createPopup:`, keyId);
		await browser.qapp.saveFocus();
		return new Promise(async (resolve, reject) => {
			if(PopupManager.has(keyId)){
				return resolve(PopupManager.get(keyId));
			}

			if(PopupManager.count >= maxNoteCount){
				PopupManager.iter((keyId, popup) => {
					popup.close();
				});
			}

			let popup: QNotePopup | WebExtensionPopup | undefined;

			const state = Object.assign({}, note2state(note.getData(), this.prefs), popupState);

			if(this.prefs.windowOption === 'xul'){
				const windowId = await getCurrentWindowId();
				if(!windowId){
					return reject("Could not get current window");
				}
				popup = await QNotePopup.create(keyId, note, windowId, state);
			} else if(this.prefs.windowOption == 'webext'){
				popup = new WebExtensionPopup(keyId, note, state);
			} else {
				throw new TypeError(`${debugHandle} unknown windowOption option: ${this.prefs.windowOption}`);
			}

			QDEB&&console.debug(`${debugHandle} new popup: ${keyId}`, popup);

			PopupManager.add(popup);
			popup.addListener("onnote", this.onNoteHandler.bind(this));

			resolve(popup);
		});
	}

	async popNote(keyId: string){
		QDEB&&console.info(`${debugHandle} popNote(), keyId:`, keyId);
		if(PopupManager.has(keyId)){
			PopupManager.get(keyId).focus();
		} else {
			this.createPopup(await this.createAndLoadNote(keyId)).then(popup => popup.pop());
		}
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
				this.popNote(keyId);
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
		} else if(messages.length > 1){
			if(info.menuItemId === "create_multi"){
				this.createMultiNote(messages);
			} else if(info.menuItemId === "paste_multi"){
				const sourceNoteData = await browser.qnote.getFromClipboard();
				if(sourceNoteData && isClipboardSet(sourceNoteData)){
					sourceNoteData.ts = Date.now();
					for(const m of messages){
						await this.saveOrUpdate(m.headerMessageId, sourceNoteData, true, false);
					};
					this.updateViews();
				}
			} else if(info.menuItemId === "delete_multi"){
				if(!this.prefs.confirmDelete || await confirmDelete()) {
					for(const m of messages){
						await this.deleteNote(m.headerMessageId);
					}
					this.updateViews();
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
	async deleteNote(keyId: string, updateViews: boolean = true): Promise<boolean> {
		const popup = PopupManager.has(keyId) ? PopupManager.get(keyId) : null;

		if(popup){
			await PopupManager.get(keyId).close();
		}

		const note = await this.createAndLoadNote(keyId);

		if(note.exists()){
			await note.delete();
			if(updateViews){
				await this.updateViews();
			}
			return true;
		} else {
			return false;
		}
	}

	async createMultiNote(messages: browser.messages.MessageHeader[]){
		if(PopupManager.has("multi-note-create")){
			return;
		}

		const note = this.createNote("multi-note-create");
		const popup = await this.createPopup(note, { placeholder:  _("multi.note.warning") });

		popup.addListener("onnote", async (keyId, reason: IPopupCloseReason, noteData) =>{
			if(reason == "close" && noteData.text){
				for(const m of messages){
					await this.saveOrUpdate(m.headerMessageId, noteData, false, false)
				}
				this.updateViews();
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

		if(this.prefs.storageOption == "folder"){
			if(!this.prefs.storageFolder || !await browser.legacy.isFolderWritable(this.prefs.storageFolder)) {
				browser.legacy.alert(_("could.not.initialize.storage.folder"));
			}
		}

		await browser.qapp.init(convertPrefsToQAppPrefs(this.prefs));
		await browser.qapp.setDebug(QDEB);

		QNotePopup.init(QDEB);

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
					this.popNote(keyId);
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
		browser.tabs.onActivated.addListener(async activeInfo => {
			QDEB&&console.debug(`${debugHandle} tabs.onActivated(), tabId:`, activeInfo.tabId);
			this.updateViews(activeInfo.tabId);
		});

		// browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
		// 	QDEB&&console.debug(`${debugHandle} tabs.onUpdated(), id:`, tabId, changeInfo, tab);
		// 	// this.updateView();
		// });

		browser.windows.onRemoved.addListener(async (id: number) => {
			QDEB&&console.debug(`${debugHandle} windows.onRemoved(), windowId:`, id);
			PopupManager.iter((keyId, popup) => {
				// Take care of window close outside of note controls
				if(popup instanceof WebExtensionPopup){
					if(id == popup.getId()){
						popup.fireListeners("onnote", keyId, "close", popup.note.getData() || {});
					}
				}
			});
		});

		browser.qpopup.onClose.addListener((id: number, reason: IPopupCloseReason, state: IPopupState) => {
			PopupManager.iter((keyId, popup) => {
				if(popup instanceof QNotePopup){
					if(id == popup.getId()){
						popup.fireListeners("onnote", keyId, reason, state2note(state));
					}
				}
			});
		});

		var actionHandlerActive = false;
		const actionHandler = async (tab: browser.tabs.Tab) => {
			const actiondebugHandle = `${debugHandle} [tab:${tab.id}]`

			if(!tab.id){
				QDEB&&console.debug(`${actiondebugHandle} no tab.id, bail`);
				return;
			}

			if(actionHandlerActive){
				QDEB&&console.debug(`${actiondebugHandle} already active, bail`);
				return;
			}

			actionHandlerActive = true;
			browser.messageDisplay.getDisplayedMessages(tab.id).then(async (messages) => {
				if(messages.length == 1){
					const keyId = messages[0].headerMessageId;

					if(PopupManager.has(keyId)){
						await PopupManager.get(keyId).close();
					} else {
						await this.popNote(keyId);
					}
				} else if(messages.length >= 1){
					if(PopupManager.has("multi-note-create")){
						await PopupManager.get("multi-note-create").close();
					} else {
						await this.createMultiNote(messages);
					}
				}
			}).finally(() => actionHandlerActive = false);
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
		browser.runtime.onMessage.addListener((rawData: any, sender: browser.runtime.MessageSender, _sendResponse) => {
			QDEB&&console.group(`${debugHandle} received message:`);
			QDEB&&console.debug("rawData:", rawData);
			QDEB&&console.debug("sender:", sender);
			QDEB&&console.groupEnd();

			if((new AttachToMessage()).parse(rawData)){
				QDEB&&console.debug(`${debugHandle} received "AttachToMessage" message`);
				return browser.messageDisplay.getDisplayedMessages(sender.tab?.id).then(async messages => {
					if(messages.length == 1){
						const data = await this.getNoteData(messages[0].headerMessageId);
						if(data){
							return (new AttachToMessageReply).from({
								note: data,
								html: this.applyTemplate(this.prefs.attachTemplate, data),
								prefs: this.prefs,
								keyId: messages[0].headerMessageId
							});
						}
					}
					return undefined;
				});
			}

			if((new RestoreFocus()).parse(rawData)){
				QDEB&&console.debug(`${debugHandle} received "RestoreFocus" message`);
				return browser.qapp.restoreFocus();
			}

			if((new PrefsUpdated()).parse(rawData)){
				QDEB&&console.debug(`${debugHandle} received "PrefsUpdated" message`);
				return getPrefs().then(prefs => {
					this.prefs = prefs;
					sendPrefsToQApp(prefs).then(() => this.updateViews())
				});
			}

			let data;
			if(data = (new PopupDataRequest()).parse(rawData)){
				QDEB&&console.debug(`${debugHandle} received "PopupDataRequest" message`);

				const keyId = data.keyId;
				if(PopupManager.has(keyId)){
					const popup = PopupManager.get(keyId);
					return Promise.resolve((new PopupDataReply).from({
						keyId: keyId,
						state: popup.getState()
					}));
				}

				return undefined;
			}

			if(data = (new SyncNote()).parse(rawData)){
				QDEB&&console.debug(`${debugHandle} received "SyncNote" message`, data);
				if(PopupManager.has(data.keyId)){
					PopupManager.get(data.keyId).fireListeners("onnote", data.keyId, data.reason, data.noteData);
				}
				return undefined;
			}

			if(data = (new PopNote()).parse(rawData)){
				QDEB&&console.debug(`${debugHandle} received "PopNote" message`, data);
				this.popNote(data.keyId);
				return undefined;
			}

			console.error(`${debugHandle} unhandled message`);

			return undefined;
		});

		browser.menus.onClicked.addListener(this.menuHandler.bind(this));

		// Inject JS and CSS into existing tabs
		browser.tabs.query({
			type: ["content", "mail", "messageDisplay"],
			windowType: "normal"
		}).then(tabs => {
			tabs.forEach(tab => {
				if(tab.id){
					browser.tabs.insertCSS(tab.id, {
						file: "html/background.css",
					}).catch(() => console.log("Could not insert css into tab:", tab.id));
					browser.tabs.executeScript(tab.id, {
						file: "scripts/messageDisplay.js",
					}).catch(() => console.log("Could not insert js into tab:", tab.id));
				}
			});
		});

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

browser.runtime.onInstalled.addListener(async ({ reason, temporary }) => {
	// skip during development
	if (temporary) return;

	if(reason == "install") {
		await browser.tabs.create({ url: browser.runtime.getURL("html/installed.html") });
	}

	if(reason == "update") {
		await browser.tabs.create({ url: browser.runtime.getURL("html/update-0.14.html") });
	}
});

browser.LegacyCSS.onWindowOpened.addListener((url: string) => {
	const files: Map<string, string> = new Map([
		["about:3pane", "html/background.css"],
		["chrome://messenger/content/multimessageview.xhtml", "html/background.css"],
	]);

	if (files.has(url)) {
		browser.LegacyCSS.inject(url, files.get(url));
	}
});

browser.scripting.messageDisplay.registerScripts([{
	id: "qnote-1",
	js: ["scripts/messageDisplay.js"],
	css: ["html/background.css"],
}]);

waitForLoad().then(async isAppStartup => {
	(new QNoteExtension(await getPrefs())).initExtension();
});
