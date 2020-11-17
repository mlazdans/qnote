// TODO: note optionally next to message
// TODO: menu delete all notes from selected messages?
// TODO: suggest: nsIMsgFilterService->removeCustomAction, nsIMsgFilterService->removeCustomTerm
// TODO: suggest: QuickFilterManager.jsm > appendTerms() > term.customId = tfDef.customId;
// MAYBE: multiple notes simultaneously
// TODO: save note pos and dims locally, outside note
// TODO: create a solid blocker for pop/close
// TODO: hide popup while loading
// TODO: delete button
// TODO: structure app code separately
var Prefs;
var CurrentNote;
var CurrentTabId;
var CurrentWindowId;
var QDEB = true;

async function focusMessagePane(windowId){
	await browser.qapp.messagePaneFocus(windowId);
}

function initCurrentNote(){
	if(CurrentNote){
		CurrentNote.windowId = CurrentWindowId;
		return;
	}

	if(Prefs.windowOption === 'xul'){
		CurrentNote = new XULNoteWindow(CurrentWindowId);
	} else if(Prefs.windowOption == 'webext'){
		CurrentNote = new WebExtensionNoteWindow(CurrentWindowId);
	} else {
		throw new TypeError("Prefs.windowOption");
	}

	CurrentNote.addListener("afterupdate", (NoteWindow, action, isOk) => {
		QDEB&&console.debug("afterupdate", action, isOk);
		if(isOk && CurrentNote.messageId){
			mpUpdateForMessage(CurrentNote.messageId);
			if(Prefs.useTag){
				tagMessage(CurrentNote.messageId, Prefs.tagName, action === "save");
			}
		}
	});

	CurrentNote.addListener("afterclose", (NoteWindow, isClosed) => {
		if(isClosed){
			focusMessagePane(CurrentNote.windowId);
		}
	});
}

async function initExtension(){
	QDEB&&console.debug("initExtension()");

	Prefs = await loadPrefsWithDefaults();

	QDEB = !!Prefs.enableDebug;

	browser.qapp.setDebug(QDEB);

	CurrentWindowId = await getCurrentWindowId();

	// Return notes to qapp on request
	browser.qapp.onNoteRequest.addListener(getQAppNoteData);

	browser.qapp.enablePrintAttacher({
		topTitle: Prefs.printAttachTopTitle,
		topText: Prefs.printAttachTopText,
		bottomTitle: Prefs.printAttachBottomTitle,
		bottomText: Prefs.printAttachBottomText
	});

	// window.addEventListener("unhandledrejection", event => {
	// 	console.warn(`Unhandle: ${event.reason}`, event);
	// });

	initCurrentNote();

	await browser.qapp.init();

	browser.qapp.setColumnTextLimit(Prefs.showFirstChars);

	// KeyDown from qapp
	browser.qapp.onKeyDown.addListener(e => {
		let ret = {};
		if(e.key === 'Escape'){
			if(CurrentNote.shown){
				CurrentNote.needSaveOnClose = false;
				CurrentNote.close();
				ret.preventDefault = true;
			}
		}
		return ret;
	});

	// Change folders
	browser.mailTabs.onDisplayedFolderChanged.addListener(async (Tab, displayedFolder) => {
		QDEB&&console.debug("mailTabs.onDisplayedFolderChanged()");
		await CurrentNote.close();

		// CurrentTabId = getTabId(Tab);
		// CurrentWindowId = Tab.windowId;
		initCurrentNote();
		//updateCurrentMessage(CurrentTab);
	});

	// Change tabs
	browser.tabs.onActivated.addListener(async activeInfo => {
		QDEB&&console.debug("tabs.onActivated()", activeInfo);
		await CurrentNote.close();

		CurrentTabId = activeInfo.tabId;
		// CurrentWindowId = activeInfo.windowId;
		initCurrentNote();
		//updateCurrentMessage(CurrentTab);
	});

	// Create window
	// TODO: check, if window id is current popupid
	browser.windows.onCreated.addListener(async Window => {
		QDEB&&console.debug("windows.onCreated()");
		await CurrentNote.close();

		CurrentWindowId = Window.id;
		initCurrentNote();
		//updateCurrentMessage(CurrentTab);
	});

	// Change focus
	browser.windows.onFocusChanged.addListener(async windowId => {
		QDEB&&console.debug("windows.onFocusChanged(), windowId:", windowId, ", current windowId:", CurrentNote.windowId);
		if(
			windowId === browser.windows.WINDOW_ID_NONE ||
			windowId === CurrentNote.windowId
		){
			return;
		}

		QDEB&&console.debug("windows.onFocusChanged()", windowId, CurrentNote.windowId);
		await CurrentNote.close();

		CurrentWindowId = windowId;
		initCurrentNote();
		mpUpdateCurrent();
	});

	// Change message
	browser.messageDisplay.onMessageDisplayed.addListener(async (Tab, Message) => {
		QDEB&&console.debug("messageDisplay.onMessageDisplayed(), messageId:", Message.id);
		//updateCurrentMessage(CurrentTab);

		await CurrentNote.close();

		CurrentTabId = getTabId(Tab);
		// CurrentWindowId = Tab.windowId;
		// CurrentWindowId = await getCurrentWindowId();
		initCurrentNote();

		let flags = POP_EXISTING;
		if(Prefs.focusOnDisplay){
			flags |= POP_FOCUS;
		}

		QNotePopForMessage(Message.id, flags).then(isPopped =>{
			mpUpdateForMessage(Message.id);
			//mpUpdateCurrent();
			// Focus message pane in case popped
			if(isPopped && !Prefs.focusOnDisplay){
				focusMessagePane(CurrentNote.windowId);
			}
		});
	});

	// Click on main toolbar
	// TODO: when multiple windows are involved, Tab comes in undefined
	browser.browserAction.onClicked.addListener(Tab => {
		QDEB&&console.debug("browserAction.onClicked()");
		QNotePopToggle(Tab);
		// QNotePopToggle().then(()=>{
		// 	QNoteTabPop(tab);
		// });
		// CurrentTab = tab;
	});

	// // Click on QNote button
	browser.messageDisplayAction.onClicked.addListener(Tab => {
		QDEB&&console.debug("messageDisplayAction.onClicked()", Tab, CurrentTabId);
		QNotePopToggle(Tab);
		// QNotePopToggle().then(()=>{
		// 	QNoteTabPop(tab);
		// });
		// CurrentTab = tab;
	});

	// Handle keyboard shortcuts
	browser.commands.onCommand.addListener(command => {
		if(command === 'qnote') {
			QDEB&&console.debug("commands.onCommand()", command);
			QNotePopToggle(CurrentTabId);
		}
	});

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


	// browser.qpopup.onCreated.addListener(popup => {
	// 	console.log("qpopup.onCreated()", popup);
	// });

	// browser.qpopup.onRemoved.addListener(popup => {
	// 	console.log("qpopup.onRemoved()", popup);
	// });

	// browser.qpopup.create({
	// 	windowId: CurrentWindow.id,
	// 	url: "html/popup4.html",
	// 	width: 320,
	// 	height: 200,
	// 	top: 100,
	// 	left: 200
	// }).then(data => {
	// 	console.log("created", data);
	// 	let statuslogger = () => {
	// 		browser.qpopup.get(data.id).then(info => {
	// 			console.log("get", info);
	// 		});
	// 	}
	// 	statuslogger();

	// 	setTimeout(statuslogger, 2000);
	// 	// setTimeout(() => {
	// 	// 	console.log("setTimeout.remove");
	// 	// 	browser.qpopup.remove(data.id).then(r => {
	// 	// 		console.log("setTimeout.removed -", r);
	// 	// 	});
	// 	// }, 1250);
	// 	// setTimeout(() => {
	// 	// 	browser.qpopup.update(data.id, {
	// 	// 		// title: "dada",
	// 	// 		focused: true,
	// 	// 		// width: 600,
	// 	// 		// height: 600,
	// 	// 		// top: 600,
	// 	// 		// left: 600,
	// 	// 	});
	// 	// }, 1250);
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
