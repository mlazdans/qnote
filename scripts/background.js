// TODO: uninstall listeners
var Prefs;
var LegacyPrefs;
var DefaultPrefs = {
	useTag: false,
	tagName: "xnote",
	dateFormat: "yyyy-mm-dd - HH:MM", // TODO: implement
	width: 320,
	height: 200,
	showFirstChars: 0,
	showOnSelect: true,
	storageOption: "ext",
	storageFolder: "",
	version: browser.runtime.getManifest().version
}

var CurrentNote = {
	init(){
		CurrentNote.note = undefined;
		CurrentNote.messageId = undefined;
		CurrentNote.windowId = undefined;
		CurrentNote.popping = false;
		CurrentNote.needSave = true;
	},
	async onAfterDelete(){
		await afterNoteDelete(CurrentNote.messageId, CurrentNote.note);
		CurrentNote.init();
	},
	async onAfterSave(){
		await afterNoteSave(CurrentNote.messageId, CurrentNote.note);
		CurrentNote.init();
	},
	async save(){
		let res = await CurrentNote.note.save();
		if(res){
			CurrentNote.onAfterSave();
			return true;
		} else {
			return false;
		}

	},
	async delete(){
		let res = await CurrentNote.note.delete();
		if(res){
			CurrentNote.onAfterDelete();
			return true;
		} else {
			return false;
		}
	},
	async focus() {
		if(CurrentNote.windowId){
			return browser.windows.update(CurrentNote.windowId, {
				focused: true
			});
		}
	},
	async close(closeWindow = true) {
		if(closeWindow && CurrentNote.windowId){
			return await browser.windows.remove(CurrentNote.windowId);
		}

		if(CurrentNote.needSave && CurrentNote.note){
			let f = CurrentNote.note.text ? "save" : "delete"; // Ddelete if no text
			await CurrentNote[f]();
		} else {
			CurrentNote.init();
		}
	},
	async pop(messageId, createNew = false, pop = false) {
		if(CurrentNote.popping){
			return;
		}

		if(CurrentNote.messageId === messageId){
			await CurrentNote.focus();
			return;
		}

		await CurrentNote.close();

		CurrentNote.popping = true;

		var note = await createNoteForMessage(messageId);
		var data = await note.load();

		await updateMessageDisplayIcon(data?true:false);

		if((data && pop) || createNew){
			let opt = {
				url: "html/popup.html",
				type: "popup",
				width: note.width || Prefs.width,
				height: note.height || Prefs.height,
				left: note.x || Prefs.x,
				top: note.y || Prefs.y
			};

			return browser.windows
			.create(opt).then((windowInfo)=>{
				CurrentNote.note = note;
				CurrentNote.messageId = messageId;
				CurrentNote.windowId = windowInfo.id;
				CurrentNote.popping = false;
				return true;
			}).finally(()=>{
				CurrentNote.popping = false;
			});
		} else {
			CurrentNote.popping = false;
		}
	}
}

function initExt(){
	browser.windows.onRemoved.addListener(async (windowId)=>{
		// We are interested only on current popup
		if(windowId !== CurrentNote.windowId){
			return;
		}

		CurrentNote.close(false);
	});

	// Click on QNote button
	browser.messageDisplayAction.onClicked.addListener((tab) => {
		browser.messageDisplay.getDisplayedMessage(getTabId(tab)).then((message) => {
			CurrentNote.pop(message.id, true, true);
		});
	});

	// Click on message
	browser.messageDisplay.onMessageDisplayed.addListener((tab, message) => {
		// Pop only on main tab. Perhaps need configurable?
		if(getTabId(tab) === 1){
			// Pop only if message changed. Avoid popping on same message when, for example, toggle headers pane. Perhaps need configurable?
			if(!CurrentNote.windowId || (CurrentNote.messageId !== message.id)){
				CurrentNote.pop(message.id, false, Prefs.showOnSelect);
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

		createNoteForMessage(Menu.getId(info)).then((note)=>{
			note.load().then(async (data)=>{
				Menu[data?"modify":"new"]();
				await browser.menus.refresh();
			});
		});
	});

	browser.mailTabs.onDisplayedFolderChanged.addListener((tab, displayedFolder)=>{
		browser.qapp.updateView();
	});
}

window.addEventListener("load", async ()=>{
	loadPrefs().then(async (prefs)=>{
		Prefs = prefs;
		CurrentNote.init();
		initExt();
		browser.qapp.installColumnHandler().then(()=>{
			browser.qapp.updateView();
		})
	});
});
