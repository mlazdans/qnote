function createNote(keyId) {
	QDEB&&console.debug(`createNote(${keyId})`);
	if(Prefs.storageOption === 'ext'){
		return new QNote(keyId);
	} else if(Prefs.storageOption === 'folder'){
		return new QNoteFolder(keyId, Prefs.storageFolder);
	} else {
		throw new TypeError("Ivalid Prefs.storageOption");
	}
}

async function getQAppNoteData(keyId) {
	return loadNote(keyId).then(note => {
		return note2QAppNote(note);
	});
}

async function loadNote(keyId) {
	let note = createNote(keyId);
	return note.load().then(() => note);
}

// Load all note keys from local storage
async function loadAllExtKeys() {
	return browser.storage.local.get(null).then(storage => {
		let keys = [];
		for(let keyId in storage){
			if(keyId.substr(0, 5) !== 'pref.') {
				keys.push(keyId);
			}
		}
		return keys;
	});
}

async function loadAllExtNotes() {
	return loadAllExtKeys().then(async keys => {
		let Notes = [];
		for(let keyId of keys){
			let note = new QNote(keyId);
			await note.load();
			Notes.push(note);
		}
		return Notes;
	});
}

// Load all note keys from folder, prioritizing qnote if both qnote and xnote exists
async function loadAllFolderKeys(folder) {
	return Promise.all([
		browser.xnote.getAllKeys(folder),
		browser.qnote.getAllKeys(folder)
	]).then(values => {
		return Object.assign(values[0], values[1]);
	});
}

async function loadAllFolderNotes(folder) {
	return loadAllFolderKeys(folder).then(async keys => {
		let Notes = [];
		for(let keyId of keys){
			let note = new QNoteFolder(keyId, folder);
			await note.load();
			Notes.push(note);
		}
		return Notes;
	});
}

// async function loadAllNotes() {
// 	let p;
// 	if(Prefs.storageOption === 'ext'){
// 		p = loadAllExtKeys();
// 	} else if(Prefs.storageOption === 'folder'){
// 		p = loadAllFolderKeys(Prefs.storageFolder);
// 	} else {
// 		throw new TypeError("Ivalid Prefs.storageOption");
// 	}

// 	return p.then(async keys => {
// 		let Notes = [];
// 		for(let k of keys){
// 			loadNote(k.keyId).then(note => {
// 				Notes.push(note);
// 			});
// 		}

// 		return Notes;
// 	});
// }

// Prepare note for sending to qapp
function note2QAppNote(note){
	return note ? {
		keyId: note.keyId,
		exists: note.exists || false,
		text: note.text || "",
		ts: note.ts || 0,
		tsFormatted: qDateFormat(note.ts)
	} : null;
}

// async function loadAllQAppNotes(){
// 	return loadAllNotes().then(notes => {
// 		for(let note of notes){
// 			sendNoteToQApp(note);
// 		}
// 	});
// }

function sendNoteToQApp(note){
	return browser.qapp.saveNoteCache(note2QAppNote(note));
}
