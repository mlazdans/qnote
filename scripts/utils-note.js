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
// MAYBE: merge these 2 formats into one?
function note2QAppNote(note){
	return note ? {
		keyId: note.keyId,
		exists: note.exists || false,
		text: note.text || "",
		ts: note.ts || 0,
		tsFormatted: qDateFormat(note.ts)
	} : null;
}

function note2QNote(note){
	return note ? {
		left: note.left,
		top: note.top,
		width: note.width,
		height: note.height,
		text: note.text,
		ts: note.ts
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

/**
 * @param {string} root
 * @param {"xnote"|"qnote"} type
 * @param {Note[]} notes
 * @param {boolean} overwrite
 */
 async function exportNotesToFolder(root, type, notes, overwrite){
	let stats = {
		err: 0,
		exist: 0,
		imported: 0,
		overwritten: 0
	};

	for (const note of notes) {
		let yn;
		if(type == "xnote"){
			yn = new XNote(note.keyId, root);
		} else {
			yn = new QNoteFolder(note.keyId, root);
		}

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

async function addToClipboard(note){
	await browser.qnote.copyToClipboard(note2QNote(note));
}

async function getFromClipboard(){
	return browser.qnote.getFromClipboard();
}

async function isClipboardSet(){
	return getFromClipboard().then(content => {
		return content && content.text && content.text.trim ? content.text.trim().length > 0 : false;
	});
}
