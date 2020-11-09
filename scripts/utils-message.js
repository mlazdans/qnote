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

	return new Promise(resolve => {
		browser.messages.getFull(messageId).then(parts => {
			resolve(partsParser(parts));
		});
	});
}

async function createNoteForMessage(messageId) {
	return new Promise(resolve => {
		getMessageKeyId(messageId).then(keyId => {
			let note;
			if(note = createNote(keyId)){
				resolve(note);
			}
		});
	});
}

async function loadNoteForMessage(messageId) {
	return new Promise(resolve => {
		createNoteForMessage(messageId).then(note => {
			note.load().then(()=> {
				resolve(note);
			});
		});
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
		return note.save();
		// return await note.save().then(async ()=>{
		// 	// TODO: move to createNoteForMessage as event
		// 	await afterNoteSave(note);
		// 	return true;
		// });
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

async function getDisplayedMessage(tabId) {
	return new Promise(resolve => {
		if(tabId){
			browser.messageDisplay.getDisplayedMessage(tabId).then(message => {
				if(message){
					resolve(message);
				}
			});
		}
	});
}

async function updateDisplayedMessage(tabId){
	getDisplayedMessage(tabId).then(message => {
		loadNoteForMessage(message.id).then(note => {
			// Update icons
			let on = note && note.exists;
			let icon = on ? "images/icon.svg" : "images/icon-disabled.svg";

			browser.browserAction.setIcon({path: icon});
			browser.messageDisplayAction.setIcon({path: icon});

			// Send updated note down to qapp
			browser.qapp.saveNoteCache(note2QappNote(note));

			// Attach note to message
			browser.qapp.attachNoteToMessage(note2QappNote(note));

			// Update column view
			browser.qapp.updateView();
		});
	});
}
