var _ = browser.i18n.getMessage;

const POP_NONE = 0;
const POP_FOCUS = (1<<0);
const POP_EXISTING = (1<<1);

// No undefined values please
function getDefaultPrefs() {
	return {
		useTag: false,
		tagName: "xnote",
		dateFormat: "Y-m-d H:i", // See https://www.php.net/manual/en/datetime.format.php
		dateFormatPredefined: "",
		dateLocale: "",
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
		printAttachBottomTitle: false,
		printAttachBottomText: false,

		messageAttachTopTitle: true,
		messageAttachTopText: true,
		messageAttachBottomTitle: false,
		messageAttachBottomText: false,

		enableDebug: false,

		anchor: "window", // window, threadpane, message
		anchorPlacement: "center", // see options.js generatePosGrid() for options
		alwaysDefaultPlacement: false,
		confirmDelete: false
	};
}

function getTabId(Tab){
	if(Tab){
		return Number.isInteger(Tab) ? Tab : Tab.id;
	}
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

	for(let k in map){
		if(prefs[k] !== undefined){
			ret[map[k]] = prefs[k];
		}
	}

	return ret;
}

async function getPrefs(){
	let p = {};
	let defaultPrefs = getDefaultPrefs();

	for(let k in defaultPrefs){
		let v = await browser.storage.local.get('pref.' + k);
		if(v['pref.' + k] !== undefined){
			p[k] = defaultPrefs[k].constructor(v['pref.' + k]); // Type cast
		}
	}

	return p;
}

async function savePrefs(p) {
	for(let k in getDefaultPrefs()){
		if(p[k] !== undefined){
			await browser.storage.local.set({
				['pref.' + k]: p[k]
			});
		}
	}
}

async function clearPrefs() {
	for(let k in getDefaultPrefs()){
		await browser.storage.local.remove('pref.' + k);
	}
}

async function saveSinglePref(k, v) {
	return browser.storage.local.set({
		['pref.' + k]: v
	});
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

async function importQNotes(notes, overwrite = false){
	let stats = {
		err: 0,
		exist: 0,
		imported: 0,
		overwritten: 0
	};

	for (const note of notes) {
		let yn = new QNote(note.keyId);

		await yn.load();

		let exists = yn.exists;

		if(exists && !overwrite){
			stats.exist++;
		} else {
			yn.set(note.get());
			await yn.save().then(() => {
				stats[exists ? "overwritten" : "imported"]++;
			}).catch(e => {
				console.error(_("error.saving.note"), e.message, yn.keyId);
				stats.err++;
			});
		}
	}

	return stats;
}

async function importFolderNotes(root, overwrite = false){
	return loadAllFolderNotes(root).then(notes => importQNotes(notes, overwrite));
}

async function isReadable(path){
	return path && await browser.legacy.isReadable(path);
}

async function isFolderReadable(path){
	return path && await browser.legacy.isFolderReadable(path);
}

async function getXNoteStoragePath(){
	let xnotePrefs = xnotePrefsMapper(await browser.xnote.getPrefs());

	if(xnotePrefs.storageFolder){
		QDEB&&console.debug("XNote++ storage folder setting found:", xnotePrefs.storageFolder);

		let path = await browser.xnote.getStoragePath(xnotePrefs.storageFolder);

		if(await isFolderReadable(path)){
			return path;
		} else {
			QDEB&&console.debug("Does not exists or not readable: ", path);
		}
	}

	return await browser.xnote.getStoragePath();
}

async function loadPrefsWithDefaults() {
	let p = await getPrefs();
	let defaultPrefs = getDefaultPrefs();
	let isEmptyPrefs = Object.keys(p).length === 0;

	// Check for xnote settings if no settings at all
	if(isEmptyPrefs){
		let l = xnotePrefsMapper(await browser.xnote.getPrefs());
		for(let k in defaultPrefs){
			if(l[k] === undefined){
				p[k] = defaultPrefs[k];
			} else {
				p[k] = l[k];
			}
		}
	}

	// Apply defaults
	for(let k in defaultPrefs){
		if(p[k] === undefined){
			p[k] = defaultPrefs[k];
		}
	}

	if(p.tagName){
		p.tagName = p.tagName.toLowerCase();
	}

	if(isEmptyPrefs){
		// By default we set internal storage
		// If XNote++ storage_path is set and readable, then use it
		// else check if XNote folder exists inside profile directory
		let path = await getXNoteStoragePath();

		if(await isFolderReadable(path)){
			p.storageOption = 'folder';
			p.storageFolder = path;
		} else {
			p.storageOption = 'ext';
		}
	}

	// Override old default "yyyy-mm-dd - HH:MM"
	if(p.dateFormat === "yyyy-mm-dd - HH:MM"){
		p.dateFormat = 'Y-m-d H:i';
	}

	return p;
}

async function reloadExtension(){
	await CurrentNote.silentlyPersistAndClose();
	return await browser.runtime.reload();
}

async function clearStorage(){
	await CurrentNote.silentlyPersistAndClose();
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
			// if(CurrentNote.popping){
			// 	QDEB&&console.debug("already popping");
			// 	return false;
			// }

			// CurrentNote.popping = true;
			return CurrentNote.pop().then(isPopped => {
				if(setFocus && isPopped){
					CurrentNote.focus();
				}

				mpUpdateForNote(note);

				return isPopped;
			// }).finally(() => {
			// 	CurrentNote.popping = false;
			});
		} else {
			mpUpdateForNote(note);
		}
	}).catch(e => {
		if(e instanceof NoKeyIdError){
			if(createNew){
				browser.legacy.alert(_("no.message_id.header"));
			}
		} else if(e instanceof DirtyStateError){
			if(createNew){
				browser.legacy.alert(_("close.current.note"));
			}
		} else {
			console.error(e);
		}
	});
}

async function QNotePopForTab(Tab, flags = POP_NONE) {
	return getDisplayedMessageForTab(Tab).then(async Message => {
		await CurrentNote.silentlyPersistAndClose();

		return QNotePopForMessage(Message.id, flags);
	});
};

async function QNotePopToggle(Tab) {
	if(CurrentNote.shown){
		// This logic won't work with WebExtensionNoteWindow when clicking on buttons because window will loose focus hence report no focus
		if(await CurrentNote.isFocused()){
			QDEB&&console.debug(`QNotePopToggle(), popupId = ${CurrentNote.popupId} - focused, waiting to close`);
			await CurrentNote.persistAndClose().catch(e => {
				if(e instanceof DirtyStateError){
					browser.legacy.alert(_("close.current.note"));
				} else {
					throw e;
				}
			});
		} else {
			QDEB&&console.debug(`QNotePopToggle(), popupId = ${CurrentNote.popupId} - opened, waiting to gain focus`);
			await CurrentNote.focus();
		}
	} else {
		QDEB&&console.debug("QNotePopToggle(), popupId = -not set-");
		QNotePopForTab(Tab, POP_FOCUS).then(isPopped => {
			QDEB&&console.debug("QNotePopToggle(), isPopped =", isPopped);
		}).catch(silentCatcher());
	}
}

// TODO: icons should be updated to specified tab
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
async function mpUpdateForNote(note){
	// Marks icons active
	updateIcons(note && note.exists);

	// Send updated note down to qapp
	updateNoteView(note);

	// Attach note to message
	browser.qapp.attachNoteToMessage(CurrentWindowId, note2QAppNote(note));
}

async function mpUpdateForMessage(messageId){
	return loadNoteForMessage(messageId).then(note => {
		mpUpdateForNote(note);
	}).catch(silentCatcher());
}

async function mpUpdateCurrent(){
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
	return getCurrentTab().then(async Tab => getTabId(Tab ? Tab : await getWindowActiveTab(CurrentWindowId)));
}

async function getWindowActiveTab(windowId){
	return browser.windows.get(windowId, { populate: true }).then(Window => {
		if(Window.tabs){
			for(let t of Window.tabs){
				if(t.active){
					return t;
				}
			}
		}
	});
}

async function getWindowMailTab(windowId){
	return browser.windows.get(windowId, { populate: true }).then(Window => {
		if(Window.tabs){
			for(let t of Window.tabs){
				if(t.mailTab){
					return t;
				}
			}
		}
	});
}
async function getWindowMailTabId(windowId){
	return getWindowMailTab(windowId).then(Tab => {
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

async function confirmDelete(){
	return Prefs.confirmDelete ? await browser.legacy.confirm(_("delete.note"), _("are.you.sure")) : true;
}

function _qDateFormat(locale, ts){
	if(Prefs.dateFormatPredefined){
		return dateFormatPredefined(locale, Prefs.dateFormatPredefined, ts);
	} else {
		if(Prefs.dateFormat){
			return dateFormat(locale, Prefs.dateFormat, ts);
		} else {
			return dateFormatPredefined(locale, 'DATETIME_FULL_WITH_SECONDS', ts);
		}
	}
}

function qDateFormat(ts){
	if(Prefs.dateLocale){
		try {
			return _qDateFormat(Prefs.dateLocale, ts);
		} catch {
		}
	}

	return _qDateFormat(CurrentLang, ts);
}

function qDateFormatPredefined(format, ts){
	if(Prefs.dateLocale){
		try {
			return dateFormatPredefined(Prefs.dateLocale, format, ts);
		} catch {
		}
	}

	return dateFormatPredefined(CurrentLang, format, ts);
}

async function focusMessagePane(windowId){
	QDEB&&console.debug("focusMessagePane()");
	await browser.qapp.messagePaneFocus(windowId);
}
