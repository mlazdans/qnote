// TODO: note optionally next to message
// TODO: check xnote version setting
// TODO: rename xnote, qnote API
// TODO: menu delete all notes from selected messages?
// TODO: note on new window
// TODO: note on new tab after dblClick
// TODO: suggest: nsIMsgFilterService->removeCustomAction, nsIMsgFilterService->removeCustomTerm
// TODO: suggest: QuickFilterManager.jsm > appendTerms() > term.customId = tfDef.customId;
// TODO: multiple notes simultaneously
var Prefs;
var CurrentNote;
var CurrentTab;
var CurrentWindow;
var qcon = new QConsole(console);

// TODO: track window changes so we do not lose focus inside lone message window
async function focusMessagePane(){
	return browser.windows.getCurrent().then(async window => {
		await browser.windows.update(window.id, {
			focused: true
		});

		// browser.windows.update() will focus main window, but not message list
		await browser.qapp.messagesFocus();
	});
}

function initCurrentNote(){
	if(Prefs.windowOption === 'xul'){
		CurrentNote = new XULNoteWindow();
	} else if(Prefs.windowOption == 'webext'){
		CurrentNote = new WebExtensionNoteWindow();
	} else {
		throw new TypeError("Prefs.windowOption");
	}

	CurrentNote.addListener("afterupdate", (action, NoteWindow) => {
		updateDisplayedMessage(CurrentTab);
		updateNoteView(NoteWindow.note); // In case opened NoteWindow is not for currently selected message
		if(Prefs.useTag){
			tagMessage(CurrentNote.messageId, Prefs.tagName, action === "save");
		}
	});

	CurrentNote.addListener("afterclose", isClosed => {
		if(isClosed){
			focusMessagePane();
		}
	});
}

async function initExtension(){
	qcon.debug("initExtension()");

	Prefs = await loadPrefsWithDefaults();
	CurrentTab = await browser.tabs.getCurrent();
	CurrentWindow = await browser.windows.getCurrent();

	qcon.debugEnabled = !!Prefs.enableDebug;

	// window.addEventListener("unhandledrejection", event => {
	// 	console.warn(`Unhandle: ${event.reason}`, event);
	// });

	initCurrentNote();

	await browser.qapp.init();

	// Context menu on message
	browser.menus.onShown.addListener(info => {
		// Avoid context menu other than from messageList
		if(info.selectedMessages === undefined){
			return;
		}

		browser.menus.removeAll();

		if(info.selectedMessages.messages.length != 1){
			return;
		}

		loadNoteForMessage(Menu.getId(info)).then(note => {
			Menu[note.exists ? "modify" : "new"]();
			browser.menus.refresh();
		});
	});

	// Change folders
	browser.mailTabs.onDisplayedFolderChanged.addListener(async (tab, displayedFolder) => {
		qcon.debug("mailTabs.onDisplayedFolderChanged()");
		CurrentTab = tab;
		await CurrentNote.close();
		updateDisplayedMessage(CurrentTab);
	});

	// Change tabs
	browser.tabs.onActivated.addListener(async activeInfo => {
		qcon.debug("tabs.onActivated()");
		CurrentTab = activeInfo.tabId;
		await CurrentNote.close();
		updateDisplayedMessage(CurrentTab);
	});

	// Handle keyboard shortcuts
	browser.commands.onCommand.addListener(command => {
		if(command === 'qnote') {
			QNotePopToggle().then(()=>{
				QNoteTabPop(CurrentTab, true, true, true);
			});
		}
	});

	// Click on main toolbar
	browser.browserAction.onClicked.addListener(tab => {
		qcon.debug("browserAction.onClicked()");
		QNotePopToggle().then(()=>{
			QNoteTabPop(tab);
		});
		CurrentTab = tab;
	});

	// Click on QNote button
	browser.messageDisplayAction.onClicked.addListener(tab => {
		qcon.debug("messageDisplayAction.onClicked()");
		QNotePopToggle().then(()=>{
			QNoteTabPop(tab);
		});
		CurrentTab = tab;
	});

	// Change message
	browser.messageDisplay.onMessageDisplayed.addListener((tab, message) => {
		qcon.debug("messageDisplay.onMessageDisplayed()");
		CurrentTab = tab;
		QNoteMessagePop(message, false, Prefs.showOnSelect, false);
		updateDisplayedMessage(CurrentTab);
	});

	// Create window
	browser.windows.onCreated.addListener(async window => {
		qcon.debug("windows.onCreated()", window);
		CurrentWindow = window;
		await CurrentNote.close();
		updateDisplayedMessage(CurrentTab);
	});

	browser.qpopup.onCreated.addListener(popup => {
		console.log("qpopup.onCreated()", popup);
	});

	// let a = browser.qpopup.create({
	// 	windowId: CurrentWindow.id,
	// 	url: "html/popup4.html",
	// 	width: 320,
	// 	height: 200,
	// 	top: 100,
	// 	left: 200
	// });
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
