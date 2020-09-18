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

/*
UTF-8 Encoder / Decoder
Original code from Web Toolkit: http://www.webtoolkit.info/javascript-utf8.html
Modifications by Harry O.
*/
// var UTF8Coder = {
// 	encode(string) {
// 		string = string.replace(/\r\n/g,"\n");
// 		var utftext = "";
// 		for (var n = 0; n < string.length; n++) {
// 			var c = string.charCodeAt(n);
// 			if (c < 128) {
// 			utftext += String.fromCharCode(c);
// 			}
// 			else if((c > 127) && (c < 2048)) {
// 			utftext += String.fromCharCode((c >> 6) | 192);
// 			utftext += String.fromCharCode((c & 63) | 128);
// 			}
// 			else {
// 			utftext += String.fromCharCode((c >> 12) | 224);
// 			utftext += String.fromCharCode(((c >> 6) & 63) | 128);
// 			utftext += String.fromCharCode((c & 63) | 128);
// 			}
// 		}
// 		return utftext;
// 	},
// 	decode(utftext) {
// 		var string = "";
// 		var i = 0;
// 		var c = 0;
// 		var c1 = 0;
// 		var c2 = 0;
// 		while ( i < utftext.length ) {
// 			c = utftext.charCodeAt(i);
// 			if (c < 128) {
// 			string += String.fromCharCode(c);
// 			i++;
// 			}
// 			else if((c > 191) && (c < 224)) {
// 			c2 = utftext.charCodeAt(i+1);
// 			string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
// 			i += 2;
// 			}
// 			else {
// 			c2 = utftext.charCodeAt(i+1);
// 			c3 = utftext.charCodeAt(i+2);
// 			string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
// 			i += 3;
// 			}
// 		}
// 		return string;
// 	}
// };

// messageId = int messageId from messageList
async function createNote(messageId) {
	if(Prefs.storageOption === 'ext'){
		var note = new QNote(await getMessageId(messageId));
	} else if(Prefs.storageOption === 'folder'){
		var note = new XNote(await getMessageId(messageId), Prefs.storageFolder);
	}

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

	return await browser.messageDisplayAction.setIcon({path: icon}).then(()=>{
		return true;
	});
}

async function focusCurrentNote() {
	if(CurrentNote.windowId){
		return browser.windows.update(CurrentNote.windowId, {
			focused: true
		});
	}
}

async function deleteNoteForMessage(messageId){
	let note;
	if(CurrentNote && (CurrentNote.messageId === messageId)){
		note = CurrentNote;
		note.needSave = false;
		closeCurrentNote();
	} else {
		note = await createNote(messageId);
	}

	note.delete().then(async (deleted)=>{
		if(deleted){
			tagMessage(messageId, false);
			updateMessageIcon(false);
		}
	});
}

async function resetNoteForMessage(messageId){
	let note;
	if(CurrentNote && (CurrentNote.messageId === messageId)){
		note = CurrentNote;
	} else {
		note = await createNote(messageId);
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

	if(note.windowId && (note.messageId === messageId)){
		await browser.windows.update(note.windowId, {
			left: note.x,
			top: note.y,
			width: note.width,
			height: note.height,
			focused: true
		});

		return true;
	} else {
		return await note.save().then(()=>{
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

async function tagCurrentNote(toTag = true) {
	if(!CurrentNote || !CurrentNote.messageId){
		return;
	}

	return await tagMessage(CurrentNote.messageId, toTag);
}

async function closeCurrentNote() {
	if(CurrentNote && CurrentNote.windowId){
		return await browser.windows.remove(CurrentNote.windowId);
	}
}

async function popCurrentNote(messageId, createNew = false, pop = false) {
	if(CurrentNote && CurrentNote.popping){
		return;
	}

	if(CurrentNote && (CurrentNote.messageId === messageId)){
		focusCurrentNote();
		return;
	}

	if(CurrentNote){
		CurrentNote.popping = true;
	}

	closeCurrentNote();

	var note = await createNote(messageId);
	note.popping = true;

	var data = await note.load();

	updateMessageIcon(data?true:false);

	if((data && pop) || createNew){
		let opt = {
			url: "html/popup.html",
			type: "popup",
			width: note.width || Prefs.width,
			height: note.height || Prefs.height,
			left: note.x || Prefs.x,
			top: note.y || Prefs.y
		};

		await browser.windows.create(opt, (windowInfo)=>{
			CurrentNote = note;
			CurrentNote.windowId = windowInfo.id;
			CurrentNote.popping = false;
		});
	}
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
