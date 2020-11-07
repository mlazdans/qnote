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
		enablePrint: true,
		printAttachBottom: true,
		printAttachTop: false
	};
}

function getTabId(tab){
	return Number.isInteger(tab) ? tab : tab.id;
}

function legacyPrefsMapper(prefs){
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

async function updateMessageDisplayIcon(on = true){
	let icon = on ? "images/icon.svg" : "images/icon-disabled.svg";

	return browser.messageDisplayAction.setIcon({path: icon}).then(()=>{
		return true;
	}) && await browser.browserAction.setIcon({path: icon}).then(()=>{
		return true;
	});
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

// messageId = int messageId from messageList
async function getMessageKeyId(messageId) {
	let partsParser = (parts) => {
		// if(parts.headers['x-qnote-text']){
		// 	let qtext = parts.headers['x-qnote-text'][0];
		// 	console.log(utf8decode(qtext));
		// }

		if(!parts.headers || !parts.headers['message-id'] || !parts.headers['message-id'].length){
			return false;
		}

		let id = parts.headers['message-id'][0];

		return id.substring(1, id.length - 1);
	};

	let results = await browser.messages.getFull(messageId);

	return partsParser(results);
}

function createNote(keyId) {
	if(Prefs.storageOption === 'ext'){
		return new QNote(keyId);
	} else if(Prefs.storageOption === 'folder'){
		return new QNoteFolder(keyId, Prefs.storageFolder);
	}
}

async function loadNote(keyId) {
	return await createNote(keyId).load();
}

async function loadAllNotes() {
	let Notes = [];
	let noteList = [];

	if(Prefs.storageOption === 'ext'){
		// TODO: move notes and prefs in separete namespace
		let storage = await browser.storage.local.get(null);
		for(let keyId in storage){
			if(keyId.substr(0, 5) !== 'pref.') {
				Notes.push({
					keyId: keyId
				});
			}
		}
	} else if(Prefs.storageOption === 'folder'){
		let XNotes = await browser.xnote.getAllNotes(Prefs.storageFolder);
		let QNotes = await browser.qnote.getAllNotes(Prefs.storageFolder);
		Notes = Object.assign(XNotes, QNotes);
	}

	for(let i = 0; i < Notes.length; i++){
		let note = createNote(Notes[i].keyId);
		await note.load();
		noteList.push(note);
	}

	return noteList;
}

// messageId = int messageId from messageList
async function createNoteForMessage(messageId) {
	return createNote(await getMessageKeyId(messageId));
}

async function afterNoteDelete(messageId, note) {
	if(Prefs.useTag){
		tagMessage(messageId, false);
	}
	updateMessageDisplayIcon(false);
	await deleteNoteColumn(note);
}

async function afterNoteSave(messageId, note) {
	if(Prefs.useTag){
		tagMessage(messageId, true);
	}
	updateMessageDisplayIcon(true);
	await updateNoteColumn(note);
}

async function deleteNoteForMessage(messageId){
	let note;
	if(CurrentNote.messageId === messageId){
		note = CurrentNote.note;
		await CurrentNote.close();
	} else {
		note = await createNoteForMessage(messageId);
	}

	note.delete().then(async (deleted)=>{
		if(deleted){
			return afterNoteDelete(messageId, note);
		}
	});
}

async function resetNoteForMessage(messageId){
	let note;
	if(CurrentNote.messageId === messageId){
		note = CurrentNote.note;
	} else {
		note = await createNoteForMessage(messageId);
		if(await note.load()){
			return;
		}
	}

	note.reset({
		x: undefined,
		y: undefined,
		width: Prefs.width,
		height: Prefs.height
	});

	if(CurrentNote.messageId === messageId){
		await CurrentNote.updateWindow({
			left: note.x,
			top: note.y,
			width: note.width,
			height: note.height,
			focused: true
		});

		return true;
	} else {
		return await note.save().then(async ()=>{
			// TODO: move to createNoteForMessage as event
			await afterNoteSave(messageId, note);
			return true;
		});
	}
}

async function tagMessage(messageId, toTag = true) {
	let message = await browser.messages.get(messageId);

	if(!message){
		return;
	}

	let tags = message.tags;

	if(toTag){
		if(!message.tags.includes(Prefs.tagName)){
			tags.push(Prefs.tagName);
		}
	} else {
		tags = tags.filter(item => item !== Prefs.tagName);
	}

	return browser.messages.update(message.id, {
		tags: tags
	}).then(()=>{
		return true;
	});
}

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
		let exists = await yn.load();

		if(exists && !Prefs.overwriteExistingNotes){
			stats.exist++;
		} else {
			// Remove loaded note information so that original ts can be saved
			if(exists){
				yn.loadedNote = undefined;
			}
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
	let legacyPrefs = legacyPrefsMapper(await browser.xnote.getPrefs());

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
		let l = legacyPrefsMapper(await browser.xnote.getPrefs());
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

async function deleteNoteColumn(note){
	await browser.qapp.deleteNote(note.keyId);
	await browser.qapp.updateView();
}

async function updateQAppNote(note){
	if(note){
		return browser.qapp.updateNote({
			keyId: note.keyId,
			exists: true,
			text: note.text,
			ts: note.ts
		});
	}
}

async function loadAllQAppNotes(){
	let noteList = await loadAllNotes();
	for(let i = 0; i < noteList.length; i++){
		updateQAppNote(noteList[i]);
	}
	return true;
}

async function updateNoteColumn(note){
	await updateQAppNote(note);
	await browser.qapp.updateView();
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

function QNoteTabPop(tab, createNew = true, doPop = true, doFocus = true) {
	return browser.messageDisplay.getDisplayedMessage(getTabId(tab)).then(message => {
		if(!message){
			return;
		}
		// Pop only on main tab. Perhaps need configurable?
		// 	if(tab.mailTab){}

		// Pop only if message changed. Avoid popping on same message when, for example, toggle headers pane. Perhaps need configurable?
		if(!CurrentNote.windowId || (CurrentNote.messageId !== message.id)){
			CurrentNote.pop(message.id, createNew, doPop).then(()=>{
				if(doFocus){
					CurrentNote.focus();
				}
			});
		} else if(CurrentNote.windowId) {
			CurrentNote.close();
		}
	});
};
