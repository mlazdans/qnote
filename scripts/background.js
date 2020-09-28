// TODO: uninstall listeners
// TODO: onDelete onReset as event

var Prefs;

//var CurrentNote = new WebExtensionNoteWindow();
var CurrentNote = new XULNoteWindow();

CurrentNote.onAfterDelete = async (note)=>{
	await afterNoteDelete(note.messageId, note.note);
	note.init();
}

CurrentNote.onAfterSave = async (note)=>{
	await afterNoteSave(note.messageId, note.note);
	note.init();
}

async function initExtension(){
	Prefs = await loadPrefsWithDefaults();

	await browser.qapp.installColumnHandler();

	// Context menu on message
	browser.menus.onShown.addListener((info) => {
		// Awoid context menu other than from messageList
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

	browser.mailTabs.onDisplayedFolderChanged.addListener((tab, displayedFolder)=>{
		return browser.qapp.updateView();
	});

	browser.qapp.updateView();

	// start:dev
	// browser.browserAction.onClicked.addListener((tab) => {
	// 	browser.runtime.reload();
	// });
	//browser.qapp.popup();
	// end:dev
}

window.addEventListener("load", ()=>{
	initExtension();
});
