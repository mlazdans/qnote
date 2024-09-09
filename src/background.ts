// MAYBE: multiple notes simultaneously
// MAYBE: note popup on mouse over
// TODO: save note pos and dims locally, outside note
// TODO: save create and update time
// TODO: attach keyb/col handler to all windows at the start
// TODO: experiment with div overlays as popup in content scripts
//       Something is broken with scrollbars in qpopup, textarea gets wrapped in some div
// TODO: test brand new installation with XNote++ and then switch to QNote

// App -> INotePopup -> DefaultNotePopup -> QNotePopup -> qpopup.api
//  |     \                            \     \-> handles events sent by qpopup.api, fires events back to App through DefaultNotePopup
//  |      \                            \--> WebExtension popup -> ext api (TODO)
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
import { INotePopup, QNotePopup } from "./modules/NotePopups.mjs";
import {
	MessageId,
	convertPrefsToQAppPrefs,
	dateFormatWithPrefs,
} from "./modules/common.mjs";
import { getCurrentTabIdAnd, getCurrentWindowIdAnd, getPrefs, sendPrefsToQApp } from "./modules/common-background.mjs";
import { IPreferences } from "./modules/api.mjs";

var QDEB = true;
var App: QNoteExtension;

let BrowserAction = browser.action ? browser.action : browser.browserAction;

// var CurrentPopup: DefaultNoteWindow;
// var CurrentTabId;
// var CurrentWindowId; // MAYBE: should get rid of and replace with CurrentNote.windowId
// var CurrentLang;
// var TBInfo;
// var i18n = new DOMLocalizator(browser.i18n.getMessage);
var _ = browser.i18n.getMessage;

const PopupManager = new class {
	private hCounter = 1
	private popups = new Map<number, INotePopup>
	private keyMap = new Map<string, number>

	alloc(): number {
		return this.hCounter++
	}

	add(handle: number, popup: QNotePopup): void {
		if(this.popups.has(handle)){
			throw new Error(`popup with handle already exists: ${handle}`);
		} else if(this.keyMap.has(popup.keyId)){
			throw new Error(`popup with keyId already exists: ${popup.keyId}`);
		} else {
			this.keyMap.set(popup.keyId, handle)
			this.popups.set(handle, popup);
		}
	}

	get(handle: number): INotePopup {
		if(this.popups.has(handle)){
			return this.popups.get(handle)!
		} else {
			throw new Error(`popup not found: ${handle}`)
		}
	}

	delete(handle: number) {
		if(this.popups.has(handle)){
			const p = this.popups.get(handle)!
			return this.keyMap.delete(p.keyId) || this.popups.delete(handle);
		} else {
			throw new Error(`popup not found: ${handle}`)
		}
	}

	// removeByKeyId(keyId: string): boolean {
	// 	const handle = this.keyMap.get(keyId);
	// 	if(handle){
	// 		return this.popups.delete(handle) && this.keyMap.delete(keyId);
	// 	} else {
	// 		throw new Error(`popup not found: ${keyId}`);
	// 	}
	// }

	getByKeyId(keyId: string): INotePopup {
		if(this.keyMap.has(keyId)){
			return this.popups.get(this.keyMap.get(keyId)!)! // Safe to assume we do not have undefined|null data here
		} else {
			throw new Error(`popup not found: ${keyId}`);
		}
	}

	hasKeyId(keyId: string): boolean {
		return this.keyMap.has(keyId)
	}
}

// type CreateNotesAsArgs =  typeof QNoteFolder | typeof XNoteFolder | typeof QNoteLocalStorage extends infer R ?
// 	R extends typeof QNoteFolder
// 		? [instanceType: R, keyId: string, root: string]
// 		: R extends typeof QNoteLocalStorage
// 			? [instanceType: R, keyId: string]
// 			: never
// 		: never
// ;
// createNote(...[instanceType, keyId, root]: CreateNotesAsArgs) {
// 	QDEB&&console.debug(`createNote(${keyId})`, instanceType);
// 	if(root && (instanceType == QNoteFolder || instanceType == XNoteFolder)){
// 		return new instanceType(keyId, root);
// 	} else if(instanceType == QNoteLocalStorage) {
// 		return new instanceType(keyId);
// 	} else {
// 		throw new TypeError("Ivalid Prefs.storageOption");
// 	}
// }

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
		} else {
			return new QNoteFolder(keyId, this.prefs.storageFolder);
		}
	}

	async loadNote(keyId: string) {
		const note = this.createNote(keyId);
		return note.load().then(() => note);
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
		getCurrentTabIdAnd().then(tabId => this.updateIcons(false, tabId));
	}

	async updateView(keyId: string, note: INoteData | null){
		// Marks icons active
		this.updateIcons(!!note);

		if(note) {
			browser.qapp.saveNoteCache(keyId, note);
			// TODO: somehow notify message pane if note changed
			// getCurrentWindowIdAnd().then(windowId => browser.qapp.attachNoteToMessage(windowId, note));
		}

		browser.qapp.updateColumsView();
	}

	async createPopup(note: INote, prefs: IPreferences): Promise<INotePopup> {
		await browser.qapp.focusSave();
		return new Promise(async resolve => {
			if(PopupManager.hasKeyId(note.keyId)){
				return resolve(PopupManager.getByKeyId(note.keyId));
			}

			const windowId = await getCurrentWindowIdAnd();
			// const note = await this.loadNote(keyId);
			let popup: QNotePopup | undefined;
			let handle: number | undefined;

			if(prefs.windowOption === 'xul'){
				handle = PopupManager.alloc();
				popup = await QNotePopup.create(windowId, handle, note, prefs); // TODO: keyId already in note
			} else if(prefs.windowOption == 'webext'){
				console.error("TODO: new WebExtensionNoteWindow");
				// CurrentNote = new WebExtensionNoteWindow(CurrentWindowId);
			} else {
				throw new TypeError(`Unknown windowOption option: ${prefs.windowOption}`);
			}

			console.log(`new popup: ${handle}`, popup);
			if(popup && handle){
				PopupManager.add(handle, popup);
				popup.addListener("close", async (handle: number, reason: string, note: INoteData) => {
					QDEB&&console.log("popup close: ", handle, reason);
					if(reason == "close"){
						popup.note.data = note;
						popup.note.save();
						await this.updateView(popup.keyId, note);
						await browser.qapp.focusRestore();
					} else if(reason == "delete"){
						await popup.note.delete();
						await this.updateView(popup.keyId, null);
						await browser.qapp.focusRestore();
					} else if(reason == "escape"){
						await browser.qapp.focusRestore();
					} else {
						console.warn("Unknown close reason:", reason);
					}
					PopupManager.delete(handle);
				});

				resolve(popup);
			}
		});
	}

	async popNote(note: INote){
		QDEB&&console.debug("popNote(), keyId:", note.keyId);

		this.createPopup(note, this.prefs).then(async popup => {
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

// async function menuHandler(info){
// 	if(!info.selectedMessages){
// 		console.error("No info.selectedMessages found");
// 		return;
// 	}

// 	const messages = info.selectedMessages.messages;
// 	if(info.selectedMessages.messages.length === 1){
// 		// process single message
// 		const id = messages[0].id;

// 		// New
// 		if(info.menuItemId === "create" || info.menuItemId === "modify"){
// 			QNotePopForMessage(id, POP_FOCUS);
// 		} else if(info.menuItemId === "paste"){
// 			Menu.paste(id);
// 		} else if(info.menuItemId === "options"){
// 			browser.runtime.openOptionsPage();
// 		// Existing
// 		} else if(info.menuItemId === "copy"){
// 			loadNoteForMessage(id).then(note => {
// 				addToClipboard(note);
// 			});
// 		} else if(info.menuItemId === "paste"){
// 			if(await isClipboardSet()){
// 				Menu.paste(id);
// 			}
// 		} else if(info.menuItemId === "delete"){
// 			if(CurrentNote.messageId === id){
// 				await CurrentNote.silentlyDeleteAndClose();
// 			} else {
// 				if(await confirmDelete()) {
// 					deleteNoteForMessage(id).then(updateNoteView).catch(e => browser.legacy.alert(_("error.deleting.note"), e.message));
// 				}
// 			}
// 		} else if(info.menuItemId === "reset"){
// 			if(CurrentNote.messageId === id){
// 				CurrentNote.reset().then(() => {
// 					CurrentNote.silentlyPersistAndClose().then(() => {
// 						QNotePopForMessage(id, CurrentNote.flags)
// 					});
// 				});
// 			} else {
// 				saveNoteForMessage(id, {
// 					left: undefined,
// 					top: undefined,
// 					width: Prefs.width,
// 					height: Prefs.height
// 				}).catch(e => browser.legacy.alert(_("error.saving.note"), e.message));
// 			}
// 		} else {
// 			console.error("Unknown menuItemId: ", info.menuItemId);
// 		}
// 	} else {
// 		// process multiple message selection
// 		if(info.menuItemId === "create_multi"){
// 			createMultiNote(info.selectedMessages.messages, true);
// 		} else if(info.menuItemId === "paste_multi"){
// 			if(await isClipboardSet()){
// 				for(const m of info.selectedMessages.messages){
// 					await Menu.paste(m.id);
// 				};
// 				mpUpdateForMultiMessage(info.selectedMessages.messages);
// 			}
// 		} else if(info.menuItemId === "delete_multi"){
// 			if(await confirmDelete()) {
// 				for(const m of info.selectedMessages.messages){
// 					await ifNoteForMessageExists(m.id).then(() => {
// 						if(CurrentNote.messageId === m.id){
// 							CurrentNote.silentlyDeleteAndClose();
// 						} else {
// 							deleteNoteForMessage(m.id).then(updateNoteView).catch(e => browser.legacy.alert(_("error.deleting.note"), e.message));
// 						}
// 					}).catch(silentCatcher);
// 				}
// 				mpUpdateForMultiMessage(info.selectedMessages.messages);
// 			}
// 		} else if(info.menuItemId === "reset_multi"){
// 			for(const m of info.selectedMessages.messages){
// 				ifNoteForMessageExists(m.id).then(() => {
// 					if(CurrentNote.messageId === m.id){
// 						CurrentNote.reset().then(() => {
// 							CurrentNote.silentlyPersistAndClose().then(() => {
// 								QNotePopForMessage(m.id, CurrentNote.flags)
// 							});
// 						});
// 					} else {
// 						saveNoteForMessage(m.id, {
// 							left: undefined,
// 							top: undefined,
// 							width: Prefs.width,
// 							height: Prefs.height
// 						}).catch(e => browser.legacy.alert(_("error.saving.note"), e.message));
// 					}
// 				}).catch(silentCatcher);
// 			}
// 		} else {
// 			console.error("Unknown menuItemId: ", info.menuItemId);
// 		}
// 	}
// }

// TODO: move under app class at some point
async function initExtension(){
	QDEB&&console.debug("initExtension()");

	// Return notes to qapp on request. Should be set before init
	browser.qapp.onNoteRequest.addListener(async (keyId: string) => App.loadNote(keyId).then(note => note.data));

	await browser.qapp.init(convertPrefsToQAppPrefs(App.prefs));
	await browser.qapp.setDebug(QDEB);

	QNotePopup.init(QDEB);

	App.updateTabMenusAndIcons();

	browser.scripting.messageDisplay.registerScripts([{
		id: "qnote-message-display",
		js: ["scripts/messageDisplay.js"],
		css: ["html/qpopup.css"],
	}]);

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

	const toggler = async (Tab?: browser.tabs.Tab) => {
		console.error("TODO: toggler");
		// let tabInfo = await browser.tabs.get(Tab.id || CurrentTabId));

		// console.log(tabInfo);
		// if(tabInfo.type === "mail"){
		// 	let mList = await browser.mailTabs.getSelectedMessages(getTabId(Tab || CurrentTabId));
		// 	if(!CurrentNote.shown && (mList.messages.length > 1)){
		// 		createMultiNote(mList.messages, false);
		// 		return;
		// 	}
		// }

		// QNotePopToggle(Tab || CurrentTabId);
	};

	const actionHandler = (tab: browser.tabs.Tab) => {
		QDEB&&console.debug("action", tab);

		if(!tab.id){
			return;
		}

		browser.messageDisplay.getDisplayedMessages(tab.id).then(async (messages) => {
			if(messages.length == 1){
				const keyId = messages[0].headerMessageId;
				const note = await App.loadNote(keyId);

				App.updateView(keyId, note.data);

				if(note.data && App.prefs.showOnSelect){
					App.popNote(note);
				}

				if(PopupManager.hasKeyId(keyId)){
					PopupManager.getByKeyId(keyId).close();
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
	browser.messageDisplay.onMessagesDisplayed.addListener(async (Tab: browser.tabs.Tab, Messages: browser.messages.MessageHeader[] | browser.messages.MessageList) => {
		// TODO: this check might not be relevant in the future
		let m;
		if("messages" in Messages){
			m = Messages.messages;
		} else {
			m = Messages;
		}

		if(m.length == 1){
			const note = await App.loadNote(m[0].headerMessageId);

			App.updateView(m[0].headerMessageId, note.data);

			if(note.data && App.prefs.showOnSelect){
				App.popNote(note);
			}
		} else {
			console.error("TODO: multi message");
			// await CurrentNote.silentlyPersistAndClose();

			// CurrentTabId = getTabId(Tab);

			// // disble icons for multi select
			// updateIcons(false);

			// mpUpdateForMultiMessage(m);
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
					const note = await App.loadNote(List[0].headerMessageId);
					if(note.data){
						const reply = new AttachToMessageReply({
							note: note.data,
							html: App.applyTemplate(App.prefs.attachTemplate, note.data),
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
