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

		printAttachTop: true,
		printAttachTopTitle: true,
		printAttachTopText: true,

		printAttachBottom: false,
		printAttachBottomTitle: true,
		printAttachBottomText: true,

		messageAttachTop: true,
		messageAttachTopTitle: true,
		messageAttachTopText: true,

		messageAttachBottom: false,
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
			yn.x = xn.x;
			yn.y = xn.y;
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

function QNoteMessagePop(Message, createNew = true, doPop = true, doFocus = true) {
	// Pop only if message changed. Avoid popping on same message when, for example, toggle headers pane. Perhaps need configurable?
	if(
		!CurrentNote.windowId
		|| CurrentNote.messageId !== Message.id
	) {
		CurrentNote.pop(Message.id, createNew, doPop).then(isPopped => {
			if(doFocus){
				CurrentNote.focus();
			}
		});
	}
}

function QNoteTabPop(Tab, createNew = true, doPop = true, doFocus = true) {
	getDisplayedMessage(Tab).then(Message => {
		QNoteMessagePop(Message, createNew, doPop, doFocus);
	});
};

function QNotePopToggle() {
	return new Promise(async resolve => {
		if(CurrentNote.windowId){
			if(await CurrentNote.isFocused()){
				CurrentNote.close();
			} else {
				CurrentNote.focus();
			}
		} else {
			resolve();
		}
	});
}

async function updateIcons(on){
	let icon = on ? "images/icon.svg" : "images/icon-disabled.svg";

	browser.browserAction.setIcon({path: icon});
	browser.messageDisplayAction.setIcon({path: icon});
}

// Not so silent :>
function silentCatcher(){
	return (...args) => {
		qcon.debug(...args);
	}
}
