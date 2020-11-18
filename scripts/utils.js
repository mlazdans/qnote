const POP_NONE = 0;
const POP_FOCUS = (1<<0);
const POP_EXISTING = (1<<1);

function getDefaultPrefs() {
	return {
		useTag: false,
		tagName: "xnote",
		dateFormat: "yyyy-mm-dd - HH:MM", // TODO: implement
		width: 320,
		height: 200,
		showFirstChars: 0,
		showOnSelect: true,
		focusOnDisplay: false,
		windowOption: "xul",
		storageOption: "folder",
		storageFolder: "",
		enableSearch: false, // defaults to false for now, because of poor implementation

		printAttachTopTitle: true,
		printAttachTopText: true,
		printAttachBottomTitle: true,
		printAttachBottomText: true,

		messageAttachTopTitle: true,
		messageAttachTopText: true,
		messageAttachBottomTitle: true,
		messageAttachBottomText: true,

		enableDebug: false
	};
}

function getTabId(tab){
	return Number.isInteger(tab) ? tab : tab.id;
}

function xnotePrefsMapper(prefs){
	var ret = {};
	var map = {
		usetag: 'useTag',
		width: 'width',
		height: 'height',
		show_on_select: 'showOnSelect',
		show_first_x_chars_in_col: 'showFirstChars',
		storage_path: 'storageFolder'
	}

	for(let k of Object.keys(map)){
		if(prefs[k] !== undefined){
			ret[map[k]] = prefs[k];
		}
	}

	return ret;
}

async function getPrefs(){
	let p = {};
	let defaultPrefs = getDefaultPrefs();

	for(let k of Object.keys(defaultPrefs)){
		let v = await browser.storage.local.get('pref.' + k);
		if(v['pref.' + k] !== undefined){
			p[k] = defaultPrefs[k].constructor(v['pref.' + k]); // Type cast
		}
	}

	return p;
}

async function savePrefs(p) {
	var defaultPrefs = getDefaultPrefs();
	for(let k of Object.keys(defaultPrefs)){
		if(p[k] !== undefined){
			await browser.storage.local.set({
				['pref.' + k]: p[k]
			});
		}
	}

	return true;
}

async function saveSinglePref(k, v) {
	await browser.storage.local.set({
		['pref.' + k]: v
	});

	return true;
}

// utf8decode = function (utftext) {
// 	var string = "";
// 	var i = 0;
// 	var c = 0;
// 	var c1 = 0;
// 	var c2 = 0;
// 	while ( i < utftext.length ) {
// 		c = utftext.charCodeAt(i);
// 		if (c < 128) {
// 		string += String.fromCharCode(c);
// 		i++;
// 		}
// 		else if((c > 191) && (c < 224)) {
// 		c2 = utftext.charCodeAt(i+1);
// 		string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
// 		i += 2;
// 		}
// 		else {
// 		c2 = utftext.charCodeAt(i+1);
// 		c3 = utftext.charCodeAt(i+2);
// 		string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
// 		i += 3;
// 		}
// 	}
// 	return string;
// }

async function importXNotes(root){
	var legacyXNotes = await browser.xnote.getAllNotes(root);
	if(!legacyXNotes){
		return;
	}

	var stats = {
		err: 0,
		exist: 0,
		imported: 0,
		overwritten: 0
	};

	for (const note of legacyXNotes) {
		let xn = new XNote(note.keyId, root);
		if(!(await xn.load())){
			console.error("Error loading xnote " + xn.keyId);
			stats.err++;
			continue;
		}

		let yn = new QNote(note.keyId);

		await yn.load();

		let exists = yn.exists;

		if(exists && !Prefs.overwriteExistingNotes){
			stats.exist++;
		} else {
			yn.left = xn.left;
			yn.top = xn.top;
			yn.width = xn.width;
			yn.height = xn.height;
			yn.text = xn.text;
			yn.ts = xn.ts;

			if(await yn.save()){
				if(exists){
					stats.overwritten++;
				} else {
					stats.imported++;
				}
			} else {
				console.error("Error saving qnote " + yn.keyId);
				stats.err++;
			}
		}
	}

	return stats;
}

async function isReadable(path){
	return path && await browser.legacy.isReadable(path);
}

async function getXNoteStoragePath(){
	let path;
	let legacyPrefs = xnotePrefsMapper(await browser.xnote.getPrefs());

	if(legacyPrefs.storageFolder){
		path = legacyPrefs.storageFolder;
	}

	if(await isReadable(path)){
		return path;
	}

	return await browser.xnote.getStoragePath();
}

async function loadPrefsWithDefaults() {
	let p = await getPrefs();
	let defaultPrefs = getDefaultPrefs();
	let isEmptyPrefs = Object.keys(p).length === 0;

	// Check for legacy settings if no settings at all
	if(isEmptyPrefs){
		let l = xnotePrefsMapper(await browser.xnote.getPrefs());
		for(let k of Object.keys(defaultPrefs)){
			if(l[k] === undefined){
				p[k] = defaultPrefs[k];
			} else {
				p[k] = l[k];
			}
		}
	}

	// Apply defaults
	for(let k of Object.keys(defaultPrefs)){
		if(p[k] === undefined){
			p[k] = defaultPrefs[k];
		}
	}

	if(p.tagName){
		p.tagName = p.tagName.toLowerCase();
	}

	if(isEmptyPrefs){
		// By default we set internal storage
		// If legacy XNote storage_path is set and readable, then use it
		//  else check if XNote folder exists inside profile directory
		p.storageOption = 'ext';

		let path = await getXNoteStoragePath();

		if(await isReadable(path)){
			p.storageOption = 'folder';
			p.storageFolder = path;
		}
	}

	return p;
}

async function reloadExtension(){
	await CurrentNote.close();
	return await browser.runtime.reload();
}

async function clearStorage(){
	await CurrentNote.close();
	return browser.storage.local.clear();
}

async function exportStorage(){
	let storage = await browser.storage.local.get(null);
	let blob = new Blob([JSON.stringify(storage)], {type : 'application/json'});
	let url = window.URL.createObjectURL(blob);

	return browser.downloads.download({
		url: url,
		saveAs: true,
		filename: 'qnote-storage.json'
	});
}

async function QNotePopForMessage(messageId, flags = POP_NONE) {
	// Pop only if message changed. Avoid popping on same message when, for example, toggle headers pane. Perhaps need configurable?
	// if(
	// 	!CurrentNote.popupId
	// 	|| CurrentNote.messageId !== Message.id
	// )

	let createNew = !(flags & POP_EXISTING);
	let setFocus = flags & POP_FOCUS;

	return CurrentNote.loadNoteForMessage(messageId).then(note => {
		CurrentNote.messageId = messageId;
		if(note.exists || createNew){
			if(CurrentNote.popping){
				QDEB&&console.debug("already popping");
				return false;
			}

			CurrentNote.popping = true;
			return CurrentNote.pop().then(isPopped => {
				if(setFocus && isPopped){
					CurrentNote.focus();
				}
				return isPopped;
			}).finally(() => {
				CurrentNote.popping = false;
			});
		}
	}).catch(e => {
		if(e instanceof NoKeyIdError){
			if(createNew){
				browser.legacy.alert(_("no.message_id.header"));
			}
		} else {
			console.error(e);
		}
	});
}

async function QNotePopForTab(Tab, flags = POP_NONE) {
	return getDisplayedMessageForTab(Tab).then(async Message => {
		await CurrentNote.close();

		// CurrentTabId = getTabId(Tab);
		// CurrentWindowId = Tab.windowId;
		initCurrentNote();

		return QNotePopForMessage(Message.id, flags);
	});
};

async function QNotePopToggle(Tab) {
	if(CurrentNote.popping){
		QDEB&&console.debug("QNotePopToggle() - already popping");
		return;
	}

	if(CurrentNote.shown){
		// This logic won't work with WebExtensionNoteWindow when clicking on buttons
		// Window will loose focus hence report no focus
		if(await CurrentNote.isFocused()){
			QDEB&&console.debug(`QNotePopToggle(), popupId = ${CurrentNote.popupId} - focused, waiting to close`);
			CurrentNote.close();
		} else {
			QDEB&&console.debug(`QNotePopToggle(), popupId = ${CurrentNote.popupId} - opened, waiting to gain focus`);
			CurrentNote.focus();
		}
	} else {
		QDEB&&console.debug("QNotePopToggle(), popupId = -not set-");
		QNotePopForTab(Tab, POP_FOCUS).then(isPopped => {
			QDEB&&console.debug("QNotePopToggle(), isPopped =", isPopped);
		}).catch(silentCatcher());
	}
}

async function updateIcons(on){
	let icon = on ? "images/icon.svg" : "images/icon-disabled.svg";

	browser.browserAction.setIcon({path: icon});
	browser.messageDisplayAction.setIcon({path: icon});
}

// Not so silent :>
function silentCatcher(){
	return (...args) => {
		QDEB&&console.debug(...args);
	}
}

// mp = message pane
async function mpUpdateForMessage(messageId){
	return loadNoteForMessage(messageId).then(note => {
		// Marks icons active
		updateIcons(note && note.exists);

		// Send updated note down to qapp
		updateNoteView(note);

		// Attach note to message
		let prefs = {
			topTitle: Prefs.messageAttachTopTitle,
			topText: Prefs.messageAttachTopText,
			bottomTitle: Prefs.messageAttachBottomTitle,
			bottomText: Prefs.messageAttachBottomText
		};
		browser.qapp.attachNoteToMessage(CurrentWindowId, note2QAppNote(note), prefs);
	});
}

async function mpUpdateCurrent(){
	// if(CurrentNote.popupId){
	// 	console.log("updateCurrentMessage", CurrentNote.popupId);
	// 	await CurrentNote.close();
	// }

	// return getCurrentTabId().then(tabId => {
	// 	console.log("mpUpdateCurrent", tabId);
	return getDisplayedMessageForTab(CurrentTabId).then(message => {
		return mpUpdateForMessage(message.id);
	}).catch(silentCatcher());
}

async function getCurrentWindow(){
	return browser.windows.getCurrent();
}

async function getCurrentWindowId(){
	return getCurrentWindow().then(Window => {
		return Window.id;
	});
}

async function getCurrentTab(){
	return browser.tabs.getCurrent();
}

async function getCurrentTabId(){
	return getCurrentTab().then(Tab => {
		return getTabId(Tab);
	});
}

function updateNoteView(note){
	if(note){
		return sendNoteToQApp(note).then(() => {
			browser.qapp.updateView(CurrentWindowId, note.keyId);
		});
	} else {
		return browser.qapp.updateView(CurrentWindowId);
	}
}
