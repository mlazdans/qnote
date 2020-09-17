var DefaultPrefs = {
	useTag: false,
	tagName: 'xnote',
	dateFormat: "yyyy-mm-dd - HH:MM", // TODO: implement
	width: 320,
	height: 200,
	showOnSelect: true,
	version: browser.runtime.getManifest().version
}

var CurrentNote;
var Prefs;

function initExt(){
	browser.windows.onRemoved.addListener((windowId)=>{
		// We are interested only on current popup
		if(windowId !== CurrentNote.windowId){
			return;
		}

		if(CurrentNote.text && CurrentNote.needSave){
			CurrentNote.save().then(async (res)=>{
				tagCurrentNote(Prefs.useTag);
				updateMessageIcon(res?true:false);
				CurrentNote = undefined;
			});
		} else {
			CurrentNote = undefined;
		}
	});

	// Click on QNote button
	browser.messageDisplayAction.onClicked.addListener((tab) => {
		browser.messageDisplay.getDisplayedMessage(getTabId(tab)).then((message) => {
			popCurrentNote(message.id, true, true);
		});
	});

	// Click on message
	browser.messageDisplay.onMessageDisplayed.addListener((tab, message) => {
		// Pop only on main tab. Perhaps need configurable?
		if(getTabId(tab) === 1){
			// Pop only if message changed. Avoid popping on same message when, for example, toggle headers pane. Perhaps need configurable?
			if(!CurrentNote || (CurrentNote.windowId === undefined) || (CurrentNote.messageId !== message.id)){
				popCurrentNote(message.id, false, Prefs.showOnSelect);
			}
		}
	});

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

		createNote(Menu.getId(info)).then((note)=>{
			note.load().then((data)=>{
				Menu[data?"modify":"new"]();
				browser.menus.refresh();
			});
		});
	});
}

loadPrefs().then((prefs)=>{
	Prefs = prefs;
	initExt();
});
