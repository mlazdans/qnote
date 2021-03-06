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

	CurrentNote.addListener("afterupdate", (NoteWindow, action) => {
		QDEB&&console.debug("afterupdate", action);
		if(CurrentNote.messageId){
			mpUpdateForMessage(CurrentNote.messageId);
			if(Prefs.useTag){
				tagMessage(CurrentNote.messageId, Prefs.tagName, action === "save");
			}
		}
	});

	CurrentNote.addListener("afterclose", () => {
		QDEB&&console.debug("afterclose");
		focusMessagePane(CurrentNote.windowId);
	});
}

// We call this after options has been changed
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

	browser.qapp.setColumnTextLimit(Prefs.showFirstChars);

	browser.qapp.setPrinterAttacherPrefs({
		topTitle: Prefs.printAttachTopTitle,
		topText: Prefs.printAttachTopText,
		bottomTitle: Prefs.printAttachBottomTitle,
		bottomText: Prefs.printAttachBottomText
	});

	browser.qapp.setMessageAttacherPrefs({
		topTitle: Prefs.messageAttachTopTitle,
		topText: Prefs.messageAttachTopText,
		bottomTitle: Prefs.messageAttachBottomTitle,
		bottomText: Prefs.messageAttachBottomText
	});
}

async function initExtension(){
	QDEB&&console.debug("initExtension()");

	await setUpExtension();

	// Return notes to qapp on request
	browser.qapp.onNoteRequest.addListener(getQAppNoteData);

	// window.addEventListener("unhandledrejection", event => {
	// 	console.warn(`Unhandle: ${event.reason}`, event);
	// });

	await browser.qapp.init();

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

	// Click on main toolbar
	browser.browserAction.onClicked.addListener(Tab => {
		QDEB&&console.debug("browserAction.onClicked()");

		QNotePopToggle(Tab || CurrentTabId);
	});

	// // Click on QNote button
	browser.messageDisplayAction.onClicked.addListener(Tab => {
		QDEB&&console.debug("messageDisplayAction.onClicked()");

		QNotePopToggle(Tab || CurrentTabId);
	});

	// Handle keyboard shortcuts
	browser.commands.onCommand.addListener(command => {
		if(command === 'qnote') {
			QDEB&&console.debug("commands.onCommand()", command);

			QNotePopToggle(CurrentTabId);
		}
	});

	// Context menu on message
	// TODO: menu delete all notes from selected messages?
	browser.menus.onShown.addListener(async info => {
		await browser.menus.removeAll();

		// Avoid context menu other than from messageList
		if(info.selectedMessages === undefined){
			return;
		}

		if(info.selectedMessages.messages.length != 1){
			return;
		}

		loadNoteForMessage(Menu.getId(info)).then(note => {
			Menu[note.exists ? "modify" : "new"]();
			browser.menus.refresh();
		}).catch(silentCatcher());
	});

	// TODO: attach at least note icon to multi message display (since TB78.4)
	// browser.messageDisplay.onMessagesDisplayed.addListener(async (Tab, Messages) => {
	// });

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
