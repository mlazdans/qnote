// TODO: note optionally next to message
var Prefs;
var CurrentNote;
var CurrentMessageId;

async function focusCurrentWindow(){
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

	CurrentNote.onAfterDelete = async note => {
		await afterNoteDelete(note.messageId, note.note);
		note.init();
	}

	CurrentNote.onAfterSave = async note => {
		await afterNoteSave(note.messageId, note.note);
		note.init();
	}
}

async function initExtension(){
	//browser.windows.onCreated.removeListener(initExtension);

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

		createNoteForMessage(Menu.getId(info)).then((note)=>{
			note.load().then(async (data)=>{
				Menu[data?"modify":"new"]();
				await browser.menus.refresh();
			});
		});
	});

	// Change folders
	browser.mailTabs.onDisplayedFolderChanged.addListener((tab, displayedFolder)=>{
		return CurrentNote.close().then(()=>{
			return browser.qapp.updateView();
		});
	});

	// Change tabs
	browser.tabs.onActivated.addListener(activeInfo => {
		browser.tabs.query({
			mailTab: true
		}).then(tabs => {
			for(let tab of tabs){
				if(tab.id === activeInfo.tabid){
					return;
				}
			}
			CurrentNote.close();
		});
	});

	// Handle keyboard shortcuts
	var QCommands = {
		qnote: async () => {
			if(!CurrentMessageId){
				return;
			}
			if(CurrentNote.windowId){
				await CurrentNote.close();
			} else {
				await CurrentNote.pop(CurrentMessageId, true, true);
				await CurrentNote.focus();
			}
		}
	};

	browser.commands.onCommand.addListener(async command => {
		if(QCommands[command]){
			await QCommands[command]();
		}
	});

	// Click on main window toolbar
	browser.browserAction.onClicked.addListener(tab => {
		return QNoteTabPop(tab);
	});

	// Click on QNote button
	browser.messageDisplayAction.onClicked.addListener(tab => {
		return QNoteTabPop(tab);
	});

	// Click on message
	browser.messageDisplay.onMessageDisplayed.addListener((tab, message) => {
		CurrentMessageId = message.id;
		return QNoteTabPop(tab, false, Prefs.showOnSelect, false);
		// browser.tabs.get(getTabId(tab)).then(tab => {
		// 	// Pop only on main tab. Perhaps need configurable?
		// 	if(tab.mailTab){
		// 		// Pop only if message changed. Avoid popping on same message when, for example, toggle headers pane. Perhaps need configurable?
		// 		if(!CurrentNote.windowId || (CurrentNote.messageId !== message.id)){
		// 			CurrentNote.pop(message.id, false, Prefs.showOnSelect);
		// 		}
		// 	}
		// });
	});

	//browser.qapp.updateView();
}

initExtension();

// window.addEventListener("load", ()=>{
// 	initExtension();
// });

// async function waitForLoad() {
// 	let windows = await browser.windows.getAll({windowTypes:["normal"]});
// 	if (windows.length > 0) {
// 		return false;
// 	}

// 	return new Promise(function(resolve, reject) {
// 		function listener() {
// 			browser.windows.onCreated.removeListener(listener);
// 			resolve(true);
// 		}
// 		browser.windows.onCreated.addListener(listener);
// 	});
// }

// waitForLoad().then((isAppStartup) => initExtension());
