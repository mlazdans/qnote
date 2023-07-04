// MAYBE: multiple notes simultaneously
// MAYBE: note popup on mouse over
// TODO: save note pos and dims locally, outside note
// TODO: save create and update time
// TODO: attach keyb/col handler to all windows at the start
// TODO: getting dead object: open msg in tab, drag out in new window, reload extension when tread view activated in new window
var QDEB = true;
var Prefs;
var CurrentNote;
var CurrentTabId;
var CurrentWindowId; // MAYBE: should get rid of and replace with CurrentNote.windowId
var CurrentLang;
var TBInfo;
var i18n = new DOMLocalizator(browser.i18n.getMessage);

function resetTbState(){
	browser.menus.removeAll();
	updateIcons(false);
}

function initCurrentNote(from){
	QDEB&&console.debug(`initCurrentNote(${from})`);

	resetTbState();

	if(Prefs.windowOption === 'xul'){
		CurrentNote = new XULNoteWindow(CurrentWindowId);
	} else if(Prefs.windowOption == 'webext'){
		CurrentNote = new WebExtensionNoteWindow(CurrentWindowId);
	} else {
		throw new TypeError("Prefs.windowOption");
	}

	// CurrentNote.note.addListener("afterupdate", (n, action) => {
	// 	QDEB&&console.debug("afterupdate", action);
	// 	if(CurrentNote.messageId){
	// 		mpUpdateForMessage(CurrentNote.messageId);
	// 		// if(Prefs.useTag){
	// 		// 	tagMessage(CurrentNote.messageId, Prefs.tagName, action === "save");
	// 		// }
	// 	}
	// });

	CurrentNote.addListener("afterclose", () => {
		QDEB&&console.debug("afterclose");
		focusMessagePane(CurrentNote.windowId);
	});
}

// We call this after options has been changed
async function sendPrefs(){
	browser.qapp.setPrefs({
		storageOption: Prefs.storageOption,
		storageFolder: Prefs.storageFolder,
		showFirstChars: Prefs.showFirstChars,
		printAttachTopTitle: Prefs.printAttachTopTitle,
		printAttachTopText: Prefs.printAttachTopText,
		printAttachBottomTitle: Prefs.printAttachBottomTitle,
		printAttachBottomText: Prefs.printAttachBottomText,
		messageAttachTopTitle: Prefs.messageAttachTopTitle,
		messageAttachTopText: Prefs.messageAttachTopText,
		messageAttachBottomTitle: Prefs.messageAttachBottomTitle,
		messageAttachBottomText: Prefs.messageAttachBottomText,
	});
}

async function setUpExtension(){
	CurrentWindowId = await getCurrentWindowId();
	CurrentTabId = await getCurrentTabId();

	// CurrentNote = null;
	CurrentLang = browser.i18n.getUILanguage();

	Prefs = await loadPrefsWithDefaults();

	initCurrentNote("setUpExtension");

	QDEB = !!Prefs.enableDebug;
	browser.qapp.setDebug(QDEB);
	browser.qpopup.setDebug(QDEB);

	sendPrefs();
}

async function initExtension(){
	QDEB&&console.debug("initExtension()");
	await browser.ResourceUrl.register("qnote");
	// await browser.ResourceUrl.register("qnote", "modules/");
	// await browser.ResourceUrl.register("qnote", "api/");
	// await browser.ResourceUrl.register("qnote", "scripts/");

	await setUpExtension();
	TBInfo = await browser.runtime.getBrowserInfo();

	// Return notes to qapp on request
	browser.qapp.onNoteRequest.addListener(getQAppNoteData);

	// window.addEventListener("unhandledrejection", event => {
	// 	console.warn(`Unhandle: ${event.reason}`, event);
	// });

	await browser.qapp.init({
		storageFolder: Prefs.storageOption == 'folder' ? Prefs.storageFolder : null
	});

	// KeyDown from qapp
	browser.qapp.onKeyDown.addListener(e => {
		let ret = {};
		if(e.key === 'Escape'){
			if(CurrentNote.shown){
				CurrentNote.needSaveOnClose = false;
				CurrentNote.silentlyPersistAndClose();
				ret.preventDefault = true;
			}
		}
		return ret;
	});

	// Change folders
	browser.mailTabs.onDisplayedFolderChanged.addListener(async (Tab, displayedFolder) => {
		QDEB&&console.debug("mailTabs.onDisplayedFolderChanged()");

		await CurrentNote.silentlyPersistAndClose();

		resetTbState();
	});

	// Create tabs
	browser.tabs.onCreated.addListener(async Tab => {
		QDEB&&console.debug("tabs.onCreated(), tabId:", getTabId(Tab));

		await CurrentNote.silentlyPersistAndClose();
	});

	// Change tabs
	browser.tabs.onActivated.addListener(async activeInfo => {
		QDEB&&console.debug("tabs.onActivated()", activeInfo);

		await CurrentNote.silentlyPersistAndClose();

		CurrentTabId = activeInfo.tabId;
	});

	// Create window
	browser.windows.onCreated.addListener(async Window => {
		QDEB&&console.debug("windows.onCreated(), windowId:", Window.id);

		// This check is needed for WebExtensionNoteWindow
		if(Window.type === "normal"){
			CurrentWindowId = Window.id;
		}

		await CurrentNote.silentlyPersistAndClose();
	});

	browser.windows.onRemoved.addListener(async windowId => {
		QDEB&&console.debug("windows.onRemoved(), windowId:", windowId);

		mpUpdateCurrent();
	});

	// Change focus
	browser.windows.onFocusChanged.addListener(async windowId => {
		if(
			false
			|| windowId === browser.windows.WINDOW_ID_NONE
			|| windowId === CurrentNote.windowId
			|| windowId === CurrentNote.popupId // This check is needed for WebExtensionNoteWindow
		){
			return;
		}

		QDEB&&console.debug("windows.onFocusChanged(), windowId:", windowId);

		CurrentNote.windowId = CurrentWindowId = windowId;
		CurrentTabId = await getCurrentTabId();

		mpUpdateCurrent();

		await CurrentNote.silentlyPersistAndClose();
	});

	// Change message
	browser.messageDisplay.onMessageDisplayed.addListener(async (Tab, Message) => {
		QDEB&&console.debug("messageDisplay.onMessageDisplayed(), messageId:", Message.id);
		//updateCurrentMessage(CurrentTab);

		await CurrentNote.silentlyPersistAndClose();

		CurrentTabId = getTabId(Tab);

		let flags = POP_EXISTING;
		if(Prefs.focusOnDisplay){
			flags |= POP_FOCUS;
		}

		if(Prefs.showOnSelect){
			QNotePopForMessage(Message.id, flags).then(isPopped =>{
				// Focus message pane in case popped
				if(isPopped && !Prefs.focusOnDisplay){
					focusMessagePane(CurrentNote.windowId);
				}
			});
		} else {
			mpUpdateForMessage(Message.id);
		}
	});

	const toggler = async Tab => {
		let tabInfo = await browser.tabs.get(getTabId(Tab || CurrentTabId));

		if(tabInfo.mailTab){
			let mList = await browser.mailTabs.getSelectedMessages(getTabId(Tab || CurrentTabId));
			if(!CurrentNote.shown && (mList.messages.length > 1)){
				createMultiNote(mList.messages, false);
				return;
			}
		}

		QNotePopToggle(Tab || CurrentTabId);
	};

	// Click on main toolbar
	browser.browserAction.onClicked.addListener(Tab => {
		QDEB&&console.debug("browserAction.onClicked()");

		// QNotePopToggle(Tab || CurrentTabId);
		toggler(Tab);
	});

	// // Click on QNote button
	browser.messageDisplayAction.onClicked.addListener(Tab => {
		QDEB&&console.debug("messageDisplayAction.onClicked()");

		// QNotePopToggle(Tab || CurrentTabId);
		toggler(Tab);
	});

	// Handle keyboard shortcuts
	browser.commands.onCommand.addListener(command => {
		if(command === 'qnote') {
			QDEB&&console.debug("commands.onCommand()", command);
			toggler();
		}
	});

	// Context menu on message
	browser.menus.onShown.addListener(async info => {
		await browser.menus.removeAll();

		if(info && info.selectedMessages && (info.selectedMessages.messages.length > 1)){
			await Menu.multi();
			browser.menus.refresh();
		} else {
			let id;

			// Click other than from messageList
			if(info.selectedMessages === undefined){
				let msg = await getDisplayedMessageForTab(CurrentTabId);
				id = msg.id;
			} else {
				if(info.selectedMessages.messages.length != 1){
					return;
				}
				id = Menu.getId(info);
			}

			loadNoteForMessage(id).then(async note => {
				await Menu[note.exists ? "modify" : "new"](id);
				browser.menus.refresh();
			}).catch(silentCatcher());
		}
	});

	if(browser.messageDisplay.onMessagesDisplayed){
		browser.messageDisplay.onMessagesDisplayed.addListener(async (Tab, Messages) => {
			// Will be hadled by onMessageDisplayed
			if(Messages.length<2){
				return;
			}

			await CurrentNote.silentlyPersistAndClose();

			CurrentTabId = getTabId(Tab);

			// disble icons for multi select
			updateIcons(false);

			mpUpdateForMultiMessage(Messages);
		});
	}

	messenger.NotifyTools.onNotifyBackground.addListener(async (data) => {
		if(data.command == "pop"){
			browser.messages.query({
				headerMessageId: data.messageId
			}).then(async MList => {
				if(MList.messages && (MList.messages.length === 1)){
					let Message = MList.messages[0];
					let flags = POP_EXISTING;
					if(Prefs.focusOnDisplay){
						flags |= POP_FOCUS;
					}

					QNotePopForMessage(Message.id, flags).then(isPopped =>{
						// Focus message pane in case popped
						if(isPopped && !Prefs.focusOnDisplay){
							focusMessagePane(CurrentNote.windowId);
						}
					});
				}
			});
		}
	});
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

waitForLoad().then(isAppStartup => initExtension());

// await browser.ResourceUrl.register("exampleapi", "modules");
