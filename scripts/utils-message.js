class NoKeyIdError extends Error {};
class NoMessageError extends Error {};

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
		// 	utf8decode(qtext);
		// }

		if(!parts.headers || !parts.headers['message-id'] || !parts.headers['message-id'].length){
			return false;
		}

		let id = parts.headers['message-id'][0];

		if((id[0] == '<') && (id[id.length] == '>')){
			return id.substring(1, id.length - 1);
		} else {
			return id;
		}
	};

	return getMessageFull(messageId).then(parts => {
		let mid = partsParser(parts);

		if(mid){
			return mid;
		}

		throw new NoKeyIdError;
	});
}

async function createNoteForMessage(messageId) {
	return getMessageKeyId(messageId).then(keyId => {
		return createNote(keyId);
	});
}

async function loadNoteForMessage(messageId) {
	return createNoteForMessage(messageId).then(note => {
		return note.load().then(() => note);
	});
}

async function deleteNoteForMessage(messageId){
	return createNoteForMessage(messageId).then(note => {
		return note.delete().then(() => note);
	});
}

async function saveNoteForMessage(messageId, data){
	return loadNoteForMessage(messageId).then(note => {
		note.set(data);
		return note.save();
	});
}

async function 	tagMessage(messageId, tagName, toTag = true) {
	return getMessage(messageId).then(message => {
		QDEB&&console.debug(`tagMessage(messageId:${messageId}, tagName:${tagName}, toTag:${toTag})`);
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

async function getDisplayedMessageForTab(tab) {
	return browser.messageDisplay.getDisplayedMessage(getTabId(tab)).then(messagePartReturner);
}
