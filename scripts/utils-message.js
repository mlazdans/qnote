class NoKeyIdError extends Error {};
class NoMessageError extends Error {};

let messagePartReturner = MessagePart => {
	if(MessagePart){
		return MessagePart;
	}
	throw new NoMessageError;
};

async function getMessage(id){
	return browser.messages.get(id).then(messagePartReturner);
}

async function getMessageFull(id){
	return browser.messages.getFull(id).then(messagePartReturner);
}

async function getMessageKeyId(id) {
	let partsParser = parts => {
		// if(parts.headers['x-qnote-text']){
		// 	let qtext = parts.headers['x-qnote-text'][0];
		// 	utf8decode(qtext);
		// }

		if(!parts.headers || !parts.headers['message-id'] || !parts.headers['message-id'].length){
			return false;
		}

		let id = parts.headers['message-id'][0];

		if((id[0] == '<') && (id[id.length - 1] == '>')){
			return id.substring(1, id.length - 1);
		} else {
			return id;
		}
	};

	return getMessage(id).then(parts => {
		if(parts.headerMessageId){
			return parts.headerMessageId
		} else {
			return getMessageFull(id).then(parts => {
				let mid = partsParser(parts);

				if(mid){
					return mid;
				} else {
					throw new NoKeyIdError;
				}
			});
		}
	});
}

async function createNoteForMessage(id) {
	return getMessageKeyId(id).then(keyId => {
		let note = createNote(keyId);

		note.addListener("afterupdate", (n, action) => {
			QDEB&&console.debug("afterupdate", action);
			if(Prefs.useTag){
				tagMessage(id, Prefs.tagName, action === "save");
			}

			mpUpdateForMessage(id);
		});

		return note;
	});
}

async function loadNoteForMessage(id) {
	return createNoteForMessage(id).then(note => {
		return note.load().then(() => note);
	});
}

async function deleteNoteForMessage(id){
	return createNoteForMessage(id).then(note => {
		return note.delete().then(() => note);
	});
}

async function saveNoteForMessage(id, data){
	return loadNoteForMessage(id).then(note => {
		note.set(data);
		return note.save();
	});
}

async function tagMessage(id, tagName, toTag = true) {
	return getMessage(id).then(message => {
		QDEB&&console.debug(`tagMessage(id:${id}, tagName:${tagName}, toTag:${toTag})`);
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
