var DefaultPrefs = {
	useTag: false,
	tagName: 'xnote',
	dateFormat: "yyyy-mm-dd - HH:MM", // TODO: implement
	width: 320,
	height: 200,
	showOnSelect: true
}

var CurrentNote;
var Prefs;

function initExt(){
	// Click on QNote button
	browser.messageDisplayAction.onClicked.addListener((tab, info) => {
		browser.messageDisplay.getDisplayedMessage(tab.id).then((message) => {
			popCurrentNote(message.id, true, true);
		});
	});

	// Click on message
	browser.messageDisplay.onMessageDisplayed.addListener((tab, message) => {
		// Pop only on main tab. Perhaps need configurable?
		if(tab.index == 0){
			// Pop only if message changed. Avoid popping on same message when, for example, toggle headers pane. Perhaps need configurable?
			if(!CurrentNote || (CurrentNote.messageId != message.id)){
				popCurrentNote(message.id, false, Prefs.showOnSelect);
			}
		} else {
			popCurrentNote(message.id, false, false);
		}
	});

	// Context menu on message
	browser.menus.onShown.addListener((info) => {
		browser.menus.removeAll();

		if(info.selectedMessages.messages.length != 1){
			return;
		}

		createNote(Menu.getId(info)).then((note)=>{
			note.load().then((data)=>{
				if(data){
					Menu.modify();
				} else {
					Menu.new();
				}
				browser.menus.refresh();
			});
		});
	});
}

loadPrefs().then((prefs)=>{
	Prefs = prefs;
	initExt();
});
