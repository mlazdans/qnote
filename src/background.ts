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
}

async function confirmDelete(shouldConfirm: boolean): Promise<boolean> {
	return shouldConfirm ? await browser.legacy.confirm(_("delete.note"), _("are.you.sure")) : true;
}

async function getMessageKeyId(id: MessageId) {
	return browser.messages.get(id).then(parts => parts.headerMessageId);
}

// TODO:
// async function deleteNoteForMessage(id: MessageId) {
// 	return createNoteForMessage(id).then(async note => {
// 		return note.delete().then(() => note);
// 	});
// }

// TODO:
// async function saveNoteForMessage(id, data){
// 	return loadNoteForMessage(id).then(note => {
// 		note.set(data);
// 		return note.save();
// 	});
// }

// TODO:
// async function saveNoteForMessageIfNotExists(id, data){
// 	return loadNoteForMessage(id).then(note => {
// 		if(!note.exists){
// 			note.set(data);
// 			return note.save();
// 		}
// 	});
// }

// async function getMessage(id: MessageId){
// 	return browser.messages.get(id).then(messageHeaderReturner);
// }

// async function getMessageFull(id: MessageId){
// 	return browser.messages.getFull(id).then(messagePartReturner);
// }

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

// TODO:
// async function ifNoteForMessageExists(id) {
// 	return new Promise((resolve, reject) => {
// 		loadNoteForMessage(id).then(note => {
// 			if(note.exists){
// 				resolve(note);
// 			} else {
// 				reject();
// 			}
// 		});
// 	});
// }

// async function mpUpdateForMessage(messageId: MessageId){
// 	return loadNoteForMessage(messageId).then(note => {
// 		mpUpdateForNote(note.data);
// 	}).catch(silentCatcher());
// }

// TODO
// async function createNoteForMessage(id: MessageId) {
// 	return getMessageKeyId(id).then(keyId => {
// 		let note = createNote(keyId);

// 		note.addListener("afterupdate", (n: any, action: string) => {
// 			QDEB&&console.debug("afterupdate", action);
// 			if(Prefs.useTag){
// 				console.error("TODO: tagMessage");
// 				// tagMessage(id, Prefs.tagName, action === "save");
// 			}

// 			mpUpdateForMessage(id);
// 		});

// 		return note;
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

// async function QNotePopForMessage(id: MessageId, flags = POP_NONE) {
// 	console.log("pop note");
// 	let createNew = !(flags & POP_EXISTING);
// 	let setFocus = flags & POP_FOCUS;

// 	// await CurrentNote.silentlyPersistAndClose();

// 	let createNew = !(flags & POP_EXISTING);
// 	let setFocus = flags & POP_FOCUS;

// 	return CurrentPopup.loadNoteForMessage(id).then(note => {
// 		CurrentPopup.messageId = id;
// 		CurrentPopup.flags = flags;
// 		if(note.exists || createNew){
// 			// if(CurrentNote.popping){
// 			// 	QDEB&&console.debug("already popping");
// 			// 	return false;
// 			// }

// 			// CurrentNote.popping = true;
// 			return CurrentPopup.pop().then(isPopped => {
// 				if(setFocus && isPopped){
// 					CurrentPopup.focus();
// 				}

// 				if(isPopped){
// 					note.left = isPopped.left;
// 					note.top = isPopped.top;
// 				}

// 				mpUpdateForNote(note);

// 				return isPopped;
// 			// }).finally(() => {
// 			// 	CurrentNote.popping = false;
// 			});
// 		} else {
// 			mpUpdateForNote(note);
// 		}
// 	}).catch(e => {
// 		if(e instanceof NoKeyIdError){
// 			if(createNew){
// 				browser.legacy.alert(_("no.message_id.header"));
// 			}
// 		} else if(e instanceof DirtyStateError){
// 			if(createNew){
// 				browser.legacy.alert(_("close.current.note"));
// 			}
// 		} else {
// 			console.error(e);
// 		}
// 	});
// }

// TODO:
// async function QNotePopForTab(Tab, flags = POP_NONE) {
// 	return getDisplayedMessageForTab(Tab).then(async Message => {
// 		await CurrentPopup.silentlyPersistAndClose();
// 		return QNotePopForMessage(Message.id, flags);
// 	});
// };

// TODO:
// async function QNotePopToggle(Tab) {
// 	if(CurrentPopup.shown){
// 		// This logic won't work with WebExtensionNoteWindow when clicking on buttons because window will loose focus hence report no focus
// 		if(await CurrentPopup.isFocused()){
// 			QDEB&&console.debug(`QNotePopToggle(), popupId = ${CurrentNote.popupId} - focused, waiting to close`);
// 			await CurrentPopup.persistAndClose().catch(e => {
// 				if(e instanceof DirtyStateError){
// 					browser.legacy.alert(_("close.current.note"));
// 				} else {
// 					throw e;
// 				}
// 			});
// 		} else {
// 			QDEB&&console.debug(`QNotePopToggle(), popupId = ${CurrentNote.popupId} - opened, waiting to gain focus`);
// 			await CurrentPopup.focus();
// 		}
// 	} else {
// 		QDEB&&console.debug("QNotePopToggle(), popupId = -not set-");
// 		QNotePopForTab(Tab, POP_FOCUS).then(isPopped => {
// 			QDEB&&console.debug("QNotePopToggle(), isPopped =", isPopped);
// 		}).catch(silentCatcher());
// 	}
// }

// async function initCurrentNote(): Promise<boolean> {
// 	QDEB&&console.debug(`initCurrentNote()`);

// 	resetTbState();

// 	const windowId = await getCurrentWindowId();

// 	if(windowId === undefined){
// 		console.error("Could not find current window");
// 		return false;
// 	}

// 	var popup: NoteWindow;

// 	if(Prefs.windowOption === 'xul'){
// 		popup = new QNotePopup(windowId);
// 	} else if(Prefs.windowOption == 'webext'){
// 		console.error("TODO: new WebExtensionNoteWindow");
// 		// CurrentNote = new WebExtensionNoteWindow(CurrentWindowId);
// 	} else {
// 		throw new TypeError("Prefs.windowOption");
// 	}

// 	// CurrentNote.note.addListener("afterupdate", (n, action) => {
// 	// 	QDEB&&console.debug("afterupdate", action);
// 	// 	if(CurrentNote.messageId){
// 	// 		mpUpdateForMessage(CurrentNote.messageId);
// 	// 		// if(Prefs.useTag){
// 	// 		// 	tagMessage(CurrentNote.messageId, Prefs.tagName, action === "save");
// 	// 		// }
// 	// 	}
// 	// });

// 	popup.addListener("afterclose", () => {
// 		QDEB&&console.debug("afterclose");
// 		focusMessagePane(CurrentPopup.windowId);
// 	});

// 	return true;
// }

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

	// TODO: bring back
	// Context menu on message
	// browser.menus.onShown.addListener(async info => {
	// 	await browser.menus.removeAll();

	// 	if(info && info.selectedMessages && (info.selectedMessages.messages.length > 1)){
	// 		await Menu.multi();
	// 		browser.menus.refresh();
	// 	} else {
	// 		let id;

	// 		// Click other than from messageList
	// 		if(info.selectedMessages === undefined){
	// 			let msg = await getDisplayedMessageForTab(CurrentTabId);
	// 			id = msg.id;
	// 		} else {
	// 			if(info.selectedMessages.messages.length != 1){
	// 				return;
	// 			}
	// 			id = Menu.getId(info);
	// 		}

	// 		loadNoteForMessage(id).then(async note => {
	// 			if(note.exists){
	// 				await Menu.modify();
	// 			} else {
	// 				await Menu.new();
	// 			}
	// 			browser.menus.refresh();
	// 		}).catch(silentCatcher());
	// 	}
	// });

	// Messages displayed
	browser.messageDisplay.onMessagesDisplayed.addListener(async (Tab: browser.tabs.Tab, m: browser.messages.MessageHeader[]) => {
		if(m.length == 1){
			const note = await App.createAndLoadNote(m[0].headerMessageId);

			App.updateView(m[0].headerMessageId, note.data);

			if(note.data && App.prefs.showOnSelect){
				App.popNote(note);
			}
		} else {
			App.updateIcons(false);
			App.updateMultiPane(m);
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

	// TODO: bring back
	// browser.menus.onClicked.addListener(menuHandler);

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
