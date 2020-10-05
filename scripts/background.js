// TODO: column disappears when new window is created
// TODO: keyboard shortcuts
var Prefs;
var CurrentNote;

function initCurrentNote(){
	if(Prefs.windowOption === 'xul'){
		CurrentNote = new XULNoteWindow();
	} else if(Prefs.windowOption == 'webext'){
		CurrentNote = new WebExtensionNoteWindow();
	}
	CurrentNote.onAfterDelete = async (note)=>{
		await afterNoteDelete(note.messageId, note.note);
		note.init();
	}

	CurrentNote.onAfterSave = async (note)=>{
		await afterNoteSave(note.messageId, note.note);
		note.init();
	}
}

async function initExtension(){
	Prefs = await loadPrefsWithDefaults();

	initCurrentNote();

	await browser.qapp.installColumnHandler();

	// Context menu on message
	browser.menus.onShown.addListener((info) => {
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

	browser.qapp.updateView();
}

window.addEventListener("load", ()=>{
	initExtension();
});
