class NoKeyIdError extends Error {};
class NoMessageError extends Error {};
class NoNoteError extends Error {};

// messageId = int messageId from messageList
let messagePartReturner = MessagePart => {
	if(MessagePart){
		return MessagePart;
	}
	throw new NoMessageError;
};

async function getMessage(messageId){
	return browser.messages.get(messageId).then(messagePartReturner);
}

async function getMessageFull(messageId){
	return browser.messages.getFull(messageId).then(messagePartReturner);
}

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

	return getMessageFull(messageId).then(parts => {
		return partsParser(parts);
	});
}

async function createNoteForMessage(messageId) {
	return getMessageKeyId(messageId).then(keyId => {
		if(keyId){
			return createNote(keyId);
		}
		throw new NoKeyIdError;
	});
}

async function loadNoteForMessage(messageId) {
	return createNoteForMessage(messageId).then(note => {
		if(note){
			return note.load().then(() => note);
		}
		throw new NoNoteError;
	});
}

async function deleteNoteForMessage(messageId){
	return createNoteForMessage(messageId).then(note => {
		return note.delete();
	});
}

async function saveNoteForMessage(messageId, data){
	return loadNoteForMessage(messageId).then(note => {
		if(!note.exists){
			return;
		}

		note.set(data);

		return note.save();
	});
}

async function tagMessage(messageId, tagName, toTag = true) {
	return getMessage(messageId).then(message => {
		qcon.debug(`tagMessage(${toTag})`, messageId, tagName);
		let tags = message.tags;

		if(toTag){
			if(!message.tags.includes(tagName)){
				tags.push(tagName);
			}
		} else {
			tags = tags.filter(item => item !== tagName);
		}

		return browser.messages.update(message.id, {
			tags: tags
		});
	});
}

async function getDisplayedMessage(tab) {
	return browser.messageDisplay.getDisplayedMessage(getTabId(tab)).then(messagePartReturner);
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
