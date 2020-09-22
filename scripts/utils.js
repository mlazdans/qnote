var _ = browser.i18n.getMessage;

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

	return await browser.messageDisplayAction.setIcon({path: icon}).then(()=>{
		return true;
	});
}

// messageId = int messageId from messageList
async function getMessageKeyId(messageId) {
	let partsParser = (parts) => {
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
		return new XNote(keyId, Prefs.storageFolder);
	}
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
		let data = await note.load();
		if(!data){
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
		await browser.windows.update(CurrentNote.windowId, {
			left: note.x,
			top: note.y,
			width: note.width,
			height: note.height,
			focused: true
		});

		return true;
	} else {
		return await note.save().then(async ()=>{
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

async function importLegacyXNotes(root){
	try {
		var legacyXNotes = await browser.xnote.getNotes(root);
	} catch (e) {
		console.error("Could not get XNotes", e);
		return false;
	}

	var stats = {
		err: 0,
		exist: 0,
		imported: 0
	};

	for (const note of legacyXNotes) {
		let xn = await browser.xnote.loadNote(root, note.fileName);
		if(xn === false){
			console.log(note.path + " xnote file not found");
			stats.err++;
			continue;
		}

		let yn = new QNote(xn.keyId);
		let data = await yn.load();
		if(data){
			stats.exist++;
			console.log(xn.keyId + " already exists in local store");
		} else {
			console.log(xn.keyId + " does NOT exists in local store");
			yn.x = xn.x;
			yn.y = xn.y;
			yn.width = xn.width;
			yn.height = xn.height;
			yn.text = xn.text;
			yn.ts = xn.ts;

			if(await yn.save()){
				stats.imported++;
			} else {
				console.log("Error saving note " + yn.keyId);
				stats.err++;
			}
		}
	}
	return stats;
}

async function savePrefs(p) {
	try {
		for(let k of Object.keys(DefaultPrefs)){
			if(p[k] !== undefined){
				await browser.storage.local.set({
					['pref.' + k]: p[k]
				});
			}
		}

		Prefs = await loadPrefs();
		return true;
	} catch {
		Prefs = await loadPrefs();
		return false;
	}
}

async function loadPrefs() {
	let p = {};
	try {
		for(let k of Object.keys(DefaultPrefs)){
			let v = await browser.storage.local.get('pref.' + k);
			if(v['pref.' + k] !== undefined){
				p[k] = DefaultPrefs[k].constructor(v['pref.' + k]); // Type cast
			}
		}

		// Check for legacy settings
		let isEmptyPrefs = Object.keys(p).length === 0;
		if(isEmptyPrefs){
			let lprefs = await browser.xnote.getPrefs();
			LegacyPrefs = legacyPrefsMapper(lprefs);
			for(let k of Object.keys(DefaultPrefs)){
				if(LegacyPrefs[k] === undefined){
					p[k] = DefaultPrefs[k];
				} else {
					p[k] = LegacyPrefs[k];
				}
			}
		}

		if(p.tagName){
			p.tagName = p.tagName.toLowerCase();
		}

		if(isEmptyPrefs){
			p.storageOption = p.storageFolder ? 'folder' : 'ext';
			await savePrefs(p);
		}

		return p;
	} catch {
		return DefaultPrefs;
	}
}

async function deleteNoteColumn(note){
	await browser.qnote.deleteNote(note.keyId);
	await browser.qnote.updateView();
}
async function updateNoteColumn(note){
	await browser.qnote.setNote({
		keyId: note.keyId,
		text: note.text.substring(0, Prefs.showFirstChars)
	});
	await browser.qnote.updateView();
}
