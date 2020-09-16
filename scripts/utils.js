// messageId = int messageId from messageList
async function createNote(messageId) {
	var note = new QNote(await getMessageId(messageId));

	note.messageId = messageId;

	return note;
}

// messageId = int messageId from messageList
async function getMessageId(messageId) {
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

async function updateMessageIcon(on = true){
	let icon = "images/icon-disabled.svg";
	if(on){
		icon = "images/icon.svg";
	}
	return await browser.messageDisplayAction.setIcon({path: icon});
}

async function resetCurrentNote() {
	await CurrentNote.reset();
	if(CurrentNote.windowId){
		browser.windows.update(CurrentNote.windowId, {
			left: undefined,
			top: undefined,
			width: CurrentNote.width,
			height: CurrentNote.height,
			focused: true
		});
	}
}

async function tagCurrentNote(toTag = true) {
	if(!CurrentNote.messageId){
		return false;
	}

	let message = await browser.messages.get(CurrentNote.messageId);

	if(!message){
		return false;
	}

	let tags = message.tags;

	if(toTag){
		if(!message.tags.includes(Prefs.tagName)){
			tags.push(Prefs.tagName);
		}
	} else {
		tags = tags.filter(item => item !== Prefs.tagName);
	}

	await browser.messages.update(message.id, {
		tags: tags
	});
}

async function closeCurrentNote() {
	if(!CurrentNote){
		return;
	}

	if(CurrentNote.text && CurrentNote.needSave){
		await CurrentNote.save();
		await tagCurrentNote(Prefs.useTag);
	}

	if(CurrentNote.windowId){
		try {
			await browser.windows.remove(CurrentNote.windowId);
		} catch {
		}
	}
	CurrentNote.windowId = undefined;
}

async function popCurrentNote(id, createNew = false, pop = false) {
	if(CurrentNote && CurrentNote.windowId){
		await closeCurrentNote();
	}

	var note = await createNote(id);
	CurrentNote = note;

	var data = await CurrentNote.load();
	if(data){
		updateMessageIcon(true);
	} else {
		updateMessageIcon(false);
	}

	if((data && pop) || createNew){
		var windowInfo = await browser.windows.create({
			url: browser.extension.getURL("html/popup.html"),
			type: "popup",
			width: CurrentNote.width,
			height: CurrentNote.height,
			left: CurrentNote.x,
			top: CurrentNote.y
		});
		CurrentNote.windowId = windowInfo.id;
	}
}

async function importLegacyXNotes(){
	try {
		var legacyXNotes = await browser.xnote.getNotes(Prefs.legacyStoragePath);
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
		let xn = await browser.xnote.loadNote(note.path);
		if(xn === false){
			console.log(note.path + " xnote file not found");
			stats.err++;
			continue;
		}

		let yn = new QNote(xn.messageId);
		let data = await yn.load();
		if(data){
			stats.exist++;
			console.log(xn.messageId + " already exists in local store");
		} else {
			console.log(xn.messageId + " does NOT exists in local store");
			yn.x = xn.x;
			yn.y = xn.y;
			yn.width = xn.width;
			yn.height = xn.height;
			yn.text = xn.text;
			yn.ts = decodeXNoteDate(xn.modificationDate);

			if(await yn.save()){
				stats.imported++;
			} else {
				console.log("Error saving note " + yn.messageId);
				stats.err++;
			}
		}
	}
	return stats;
}

// NOTE: Seems that "yyyy-mm-dd - HH:MM" format has been hardcoded?
function decodeXNoteDate(dateString) {
	var retDate = new Date();
	let [date, time] = dateString.split(" - ");
	if(date){
		let dateParts = date.split("-");
		retDate.setFullYear(dateParts[0]);
		retDate.setMonth(dateParts[1] - 1);
		retDate.setDate(dateParts[2]);
	}

	if(time){
		let timeParts = time.split(":");
		retDate.setHours(timeParts[0]);
		retDate.setMinutes(timeParts[1]);
	}

	return retDate;
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
			if(v['pref.' + k] === undefined){
				p[k] = DefaultPrefs[k];
			} else {
				p[k] = v['pref.' + k];
			}
		}
		if(p.tagName){
			p.tagName = p.tagName.toLowerCase();
		}
		return p;
	} catch {
		return DefaultPrefs;
	}
}
