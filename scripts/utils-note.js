function createNote(keyId) {
	qcon.debug("createNote()", keyId);
	if(Prefs.storageOption === 'ext'){
		return new QNote(keyId);
	} else if(Prefs.storageOption === 'folder'){
		return new QNoteFolder(keyId, Prefs.storageFolder);
	} else {
		throw new TypeError("Ivalid Prefs.storageOption");
	}
}

async function getNoteData(keyId) {
	return await createNote(keyId).load();
}

async function loadAllNotes() {
	let p;
	if(Prefs.storageOption === 'ext'){
		// TODO: move notes and prefs in separete namespace
		p = browser.storage.local.get(null).then(storage => {
			let keys = [];
			for(let keyId in storage){
				if(keyId.substr(0, 5) !== 'pref.') {
					keys.push({
						keyId: keyId
					});
				}
			}
			return keys;
		});
	} else if(Prefs.storageOption === 'folder'){
		p = Promise.all([
			browser.xnote.getAllNotes(Prefs.storageFolder),
			browser.qnote.getAllNotes(Prefs.storageFolder)
		]).then(values => {
			return Object.assign(values[0], values[1]);
		});
	}

	return p.then(async keys => {
		let Notes = [];
		for(let k of keys){
			var note = createNote(k.keyId);
			if(await note.load()){
				Notes.push(note);
			}
		}

		return Notes;
	});
}

// Prepare note for sending to qapp
function note2QappNote(note){
	return note ? {
		keyId: note.keyId,
		exists: note.exists || false,
		text: note.text || "",
		ts: note.ts || 0
	} : null;
}

async function loadAllQAppNotes(){
	loadAllNotes().then(notes => {
		for(let note of notes){
			browser.qapp.saveNoteCache(note2QappNote(note));
		}
	});
}
