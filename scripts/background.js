// TODO: note optionally next to message
// TODO: check xnote version setting
// TODO: rename xnote, qnote API
// TODO: menu delete all notes from selected messages?
var Prefs;
var CurrentNote;
var CurrentTab;

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
	}

	CurrentNote.onAfterDelete = note => {
		console.debug("CurrentNote.onAfterDelete", note);
		if(Prefs.useTag){
			tagMessage(note.keyId, false);
		}
		updateDisplayedMessage(CurrentTab);
	}

	CurrentNote.onAfterSave = note => {
		console.debug("CurrentNote.onAfterSave", note);
		if(Prefs.useTag){
			tagMessage(note.keyId, true);
		}
		updateDisplayedMessage(CurrentTab);
	}
}

async function initExtension(){
	console.debug("initExtension()");
	Prefs = await loadPrefsWithDefaults();

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
		console.debug("browser.mailTabs.onDisplayedFolderChanged()");
		await CurrentNote.close();
		updateDisplayedMessage(tab);
	});

	// Change tabs
	browser.tabs.onActivated.addListener(async activeInfo => {
		console.debug("browser.tabs.onActivated()");
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

	// Click on main window toolbar
	browser.browserAction.onClicked.addListener(tab => {
		console.debug("browser.browserAction.onClicked()");
		QNotePopToggle().then(()=>{
			QNoteTabPop(tab);
		});
	});

	// Click on QNote button
	browser.messageDisplayAction.onClicked.addListener(tab => {
		console.debug("browser.messageDisplayAction.onClicked()");
		QNotePopToggle().then(()=>{
			QNoteTabPop(tab);
		});
	});

	// Change message
	browser.messageDisplay.onMessageDisplayed.addListener((tab, message) => {
		console.debug("browser.messageDisplay.onMessageDisplayed()");
		QNoteMessagePop(message, false, Prefs.showOnSelect, false);
		updateDisplayedMessage(tab);
	});

	browser.qapp.updateView();
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
