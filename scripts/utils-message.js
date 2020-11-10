class MissingKeyIdError extends Error {
	constructor(message) {
		super(message);
		this.name = "MissingKeyIdError";
	}
};

// messageId = int messageId from messageList
async function getMessageKeyId(messageId) {
	let partsParser = parts => {
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

	return browser.messages.getFull(messageId).then(parts => {
		return partsParser(parts);
	});
}

async function createNoteForMessage(messageId) {
	return getMessageKeyId(messageId).then(keyId => {
		if(!keyId){
			throw new MissingKeyIdError;
		}
		return createNote(keyId);
	});
}

async function loadNoteForMessage(messageId) {
	return createNoteForMessage(messageId).then(async note => {
		await note.load();
		return note;
	});
}

async function deleteNoteForMessage(messageId){
	if(CurrentNote.messageId === messageId){
		return CurrentNote.deleteNote();
	} else {
		return createNoteForMessage(messageId).then(note => {
			return note.delete();
		});
	}
}

async function resetNoteForMessage(messageId){
	let note;
	if(CurrentNote.messageId === messageId){
		note = CurrentNote.note;
	} else {
		note = await loadNoteForMessage(messageId);
	}

	if(!note.exists){
		return;
	}

	note.reset({
		x: undefined,
		y: undefined,
		width: Prefs.width,
		height: Prefs.height
	});

	if(CurrentNote.messageId === messageId){
		return CurrentNote.updateWindow({
			left: note.x,
			top: note.y,
			width: note.width,
			height: note.height,
			focused: true
		});
	} else {
		return note.save();
	}
}

async function tagMessage(messageId, toTag = true) {
	let message = await browser.messages.get(messageId);

	if(!message){
		qcon.debug(`tagMessage(${toTag}) - no message found`, messageId);
		return;
	}

	qcon.debug(`tagMessage(${toTag})`, messageId);

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

async function getDisplayedMessage(tab) {
	let tabId = getTabId(tab);

	if(tabId){
		return browser.messageDisplay.getDisplayedMessage(tabId).then(message => {
			return message;
		});
	} else {
		return false;
	}
}

function updateDisplayedMessage(tab){
	// Marks icons inactive by default
	updateIcons(false);

	getDisplayedMessage(tab).then(message => {
		return loadNoteForMessage(message.id)
	}).then(note => {
		// Marks icons active
		if(note && note.exists) {
			updateIcons(true);
		}

		// Send updated note down to qapp
		browser.qapp.saveNoteCache(note2QappNote(note));

		// Attach note to message
		browser.qapp.attachNoteToMessage(note2QappNote(note));

		// Update column view
		browser.qapp.updateView();
	}).catch(silentCatcher());
}
