import * as luxon from 'luxon';
import { NoteData } from './Note.mjs';
import { QNote } from './QNote.mjs';
import { QNoteFolder } from './QNoteFolder.mjs';
import { Preferences } from './Preferences.mjs';

export class NoKeyIdError extends Error {};
export class NoMessageError extends Error {};

export type MessageId = browser.messages.MessageId;
export type MessageHeader = browser.messages.MessageHeader;
export type MessagePart = browser.messages.MessagePart;
export type PopupAnchor = "window" | "threadpane" | "message";
export type StorageOption = "folder" | "ext";
export type WindowOption = "xul" | "webext";

// Bitmask
export const POP_NONE     = 0;
export const POP_FOCUS    = 1;
export const POP_EXISTING = 2;

// TODO: remove
var QDEB = true;
// var Prefs = new Preferences;
//

var _ = browser.i18n.getMessage;

// export interface Preferences {
// 	useTag: boolean,
// 	tagName: string,
// 	dateFormat: string, // See https://www.php.net/manual/en/datetime.format.php
// 	dateFormatPredefined: string,
// 	dateLocale: string,
// 	width: number,
// 	height: number,
// 	showFirstChars: number,
// 	showOnSelect: boolean,
// 	focusOnDisplay: boolean,
// 	enableSpellChecker: boolean,
// 	windowOption: string,
// 	storageOption: string,
// 	storageFolder: string,
// 	printAttachTop: boolean,
// 	printAttachBottom: boolean,
// 	messageAttachTop: boolean,
// 	messageAttachBottom: boolean,
// 	attachTemplate: string,
// 	enableDebug: boolean,
// 	anchor: PopupAnchor,
// 	anchorPlacement: string, // see options.js generatePosGrid() for options
// 	alwaysDefaultPlacement: boolean,
// 	confirmDelete: boolean,
// 	treatTextAsHtml: boolean,
// }

// No undefined values please
// export function getDefaultPrefs(): Preferences {
// 	var defaults:Preferences = {
// 		useTag: false,
// 		tagName: "xnote",
// 		dateFormat: "Y-m-d H:i", // See https://www.php.net/manual/en/datetime.format.php
// 		dateFormatPredefined: "",
// 		dateLocale: "",
// 		width: 320,
// 		height: 200,
// 		showFirstChars: 3,
// 		showOnSelect: true,
// 		focusOnDisplay: true,
// 		enableSpellChecker: true,
// 		windowOption: "xul",
// 		storageOption: "folder",
// 		storageFolder: "",
// 		printAttachTop: true,
// 		printAttachBottom: false,
// 		messageAttachTop: true,
// 		messageAttachBottom: false,
// 		attachTemplate: '',
// 		enableDebug: false,
// 		anchor: "window", // window, threadpane, message
// 		anchorPlacement: "center", // see options.js generatePosGrid() for options
// 		alwaysDefaultPlacement: false,
// 		confirmDelete: false,
// 		treatTextAsHtml: false,
// 	};

// 	defaults.attachTemplate += '<div class="qnote-title">QNote: {{ qnote_date }}</div>\n';
// 	defaults.attachTemplate += '<div class="qnote-text">{{ qnote_text }}</div>';

// 	return defaults;
// }

// TODO: remove
// function getTabId(Tab: messenger.tabs.Tab | undefined){
// 	return Tab ? Tab.id : undefined;
// }

// function xnotePrefsMapper(prefs: XNotePrefs): object {
// 	var map = {
// 		usetag: 'useTag',
// 		width: 'width',
// 		height: 'height',
// 		show_on_select: 'showOnSelect',
// 		show_first_x_chars_in_col: 'showFirstChars',
// 		storage_path: 'storageFolder'
// 	};

// 	for(let k in map){
// 		// key as keyof MyClass
// 		if(prefs[k as keyof XNotePrefs] !== undefined){
// 			ret[map[k] as keyof Prefs] = prefs[k];
// 		}
// 	}

// 	return ret;
// }

// export async function getPrefs(): Promise<Prefs> {
// 	// TODO: salabot, pagaidām nevar izdomāt, kā labāk uzstādīt values loopā
// 	// return getDefaultPrefs();
// 	let p: Prefs = getDefaultPrefs();
// 	let k: keyof Prefs;
// 	let O: Prefs

// 	for(k in p){
// 		let v = await browser.storage.local.get('pref.' + k);
// 		const val = v['pref.' + k];

// 		p[k] = val;
// 	}

// 	return p;
// }

function getProperty<T, K extends keyof T>(obj: T, key: K) {
	return obj[key];
}

function setProperty<T, K extends keyof T>(obj: T, key: K, value: T[K]) {
	obj[key] = value;
}

function getPropertyType<T, K extends keyof T>(obj: T, key: K) {
	return typeof obj[key];
}

async function isPrefsEmpty(): Promise<boolean> {
	let p = new Preferences;
	let k: keyof typeof p;

	for(k in p){
		const v = await browser.storage.local.get('pref.' + k);
		if(v['pref.' + k] !== undefined){
			return false;
		}
	}

	return true;
}

async function getPrefs(){
	let p = new Preferences;
	let k: keyof typeof p;

	for(k in p){
		const v = await browser.storage.local.get('pref.' + k);
		if(v['pref.' + k] !== undefined){
			const type = getPropertyType(p, k);
			if(type === "number"){
				setProperty(p, k, Number(v));
			} else if(typeof v === "boolean"){
				setProperty(p, k, Boolean(v));
			} else if(typeof v === "string"){
				setProperty(p, k, String(v));
			} else {
				console.error(`Unsupported preference type: ${type} for key ${k}`);
			}

		}
	}

	return p;
}


async function savePrefs(p: Preferences) {
	let k: keyof typeof p;

	for(k in p){
		await browser.storage.local.set({
			['pref.' + k]: p[k]
		});
	}
}

async function saveSinglePref(k: keyof Preferences, v: any) {
	return browser.storage.local.set({
		['pref.' + k]: v
	});
}

async function importQNotes(notes: Array<NoteData>, overwrite = false){
	let stats = {
		err: 0,
		exist: 0,
		imported: 0,
		overwritten: 0
	};

	for (const note of notes) {
		let yn = new QNote(note.keyId);

		await yn.load();

		let exists = yn.data.exists;

		if(exists && !overwrite){
			stats.exist++;
		} else {
			yn.set(note);
			await yn.save().then(() => {
				stats[exists ? "overwritten" : "imported"]++;
			}).catch(e => {
				console.error(_("error.saving.note"), e.message, yn.data.keyId);
				stats.err++;
			});
		}
	}

	return stats;
}

async function importFolderNotes(root: string, overwrite = false){
	return loadAllFolderNotes(root).then(notes => importQNotes(notes, overwrite));
}

async function isReadable(path: string){
	return await browser.legacy.isReadable(path);
}

async function isFolderReadable(path: string){
	return await browser.legacy.isFolderReadable(path);
}

async function isFolderWritable(path: string){
	return await browser.legacy.isFolderWritable(path);
}

async function getXNoteStoragePath(): Promise<string> {
	let xnotePrefs = await browser.xnote.getPrefs();

	if(xnotePrefs.storage_path){
		QDEB&&console.debug("XNote++ storage folder setting found:", xnotePrefs.storage_path);

		let path = await browser.xnote.getStoragePath(xnotePrefs.storage_path);

		if(await isFolderWritable(path)){
			return path;
		} else {
			QDEB&&console.debug("XNote++ storage folder not writable: ", path);
		}
	}

	return await browser.xnote.getStoragePath();
}

async function createQNoteStoragePath(){
	return browser.qapp.createStoragePath();
}

export async function loadPrefsWithDefaults() {
	let p = await getPrefs();
	let isEmpty = await isPrefsEmpty();
	// let defaultPrefs = getDefaultPrefs();
	// let isEmptyPrefs = Object.keys(p).length === 0;

	// Check for xnote settings if no settings at all
	// if(isEmptyPrefs){
	// 	let l = xnotePrefsMapper(await browser.xnote.getPrefs());
	// 	for(let k in defaultPrefs){
	// 		if(l[k] === undefined){
	// 			p[k] = defaultPrefs[k];
	// 		} else {
	// 			p[k] = l[k];
	// 		}
	// 	}
	// }

	// Apply defaults
	// for(let k in defaultPrefs){
	// 	if(p[k] === undefined){
	// 		p[k] = defaultPrefs[k];
	// 	}
	// }

	if(p.tagName){
		p.tagName = p.tagName.toLowerCase();
	}

	if(isEmpty){
		// If XNote++ storage_path is set and readable, then use it
		// else check if XNote folder exists inside profile directory
		let path = await getXNoteStoragePath();

		if(await isFolderWritable(path)){
			p.storageOption = 'folder';
			p.storageFolder = path;
		} else {
			path = await createQNoteStoragePath();
			if(await isFolderWritable(path)){
				p.storageOption = 'folder';
				p.storageFolder = path;
			} else {
				browser.legacy.alert(_("could.not.initialize.storage.folder"));
				p.storageOption = 'ext';
			}
		}
	}

	// Override old default "yyyy-mm-dd - HH:MM"
	if(p.dateFormat === "yyyy-mm-dd - HH:MM"){
		p.dateFormat = 'Y-m-d H:i';
	}

	return p;
}

// async function reloadExtension(){
// 	await CurrentNote.silentlyPersistAndClose();
// 	return browser.runtime.reload();
// }

async function clearPrefs() {
	let p = [];
	for(let k in new Preferences){
		p.push(browser.storage.local.remove('pref.' + k));
	}

	return Promise.all(p);
}

async function clearStorage(){
	return browser.storage.local.clear();
}

async function exportStorage(){
	let storage = await browser.storage.local.get();
	let blob = new Blob([JSON.stringify(storage)], {type : 'application/json'});
	let url = window.URL.createObjectURL(blob);

	return browser.downloads.download({
		url: url,
		saveAs: true,
		filename: 'qnote-storage.json'
	});
}

export async function updateIcons(on: boolean, tabId?: number){
	let icon = on ? "images/icon.svg" : "images/icon-disabled.svg";

	browser.action.setIcon({
		path: icon,
		tabId: tabId
	});

	browser.messageDisplayAction.setIcon({
		path: icon,
		tabId: tabId
	});
}

export function silentCatcher(){
	return (...args: any) => {
		// QDEB&&console.debug(...args);
		console.debug(...args);
	}
}

export async function getCurrentWindowIdAnd(): Promise<number> {
	return new Promise(async resolve => {
		return getCurrentWindowId().then(windowId => {
			if(windowId)resolve(windowId);
		});
	});
}

export async function mpUpdateForNote(note: NoteData){
	// Marks icons active
	updateIcons(note.exists);

	// Send updated note down to qapp
	updateNoteView(note);

	getCurrentWindowIdAnd().then(windowId => browser.qapp.attachNoteToMessage(windowId, note));
}

// TODO:
// async function mpUpdateForMultiMessage(messages){
// 	let noteArray = [];
// 	for(let m of messages){
// 		await loadNoteForMessage(m.id).then(note => {
// 			noteArray.push(note2QAppNote(note));
// 		});
// 	};
// 	browser.qapp.attachNotesToMultiMessage(CurrentWindowId, noteArray);
// }

// TODO:
// async function mpUpdateCurrent(){
// 	return getDisplayedMessageForTab(CurrentTabId).then(message => {
// 		return mpUpdateForMessage(message.id);
// 	}).catch(silentCatcher());
// }

async function getCurrentWindow(){
	return browser.windows.getCurrent();
}

export async function getCurrentWindowId(){
	return getCurrentWindow().then(Window => {
		return Window.id;
	});
}

export async function getCurrentTab(){
	return browser.tabs.getCurrent();
}

export async function getCurrentTabId(){
	return getCurrentTab().then(Tab => {
		if(Tab?.id){
		return Tab.id;
	} else {
			return getCurrentWindowIdAnd().then(windowId => getWindowActiveTab(windowId).then(Tab => Tab?.id));
		}
	});

	// var Tab;
	// if(Tab = await getCurrentTab()){
	// 	return Tab.id;
	// } else {
	// 	const windowId = await getCurrentWindowId();
	// 	if(windowId){
	// 		if(Tab = await getWindowActiveTab(windowId)){
	// 			return Tab.id;
	// 		}
	// 	}
	// }

	// return undefined;
	// return .then(async Tab => Tab ? Tab.id : await getWindowActiveTab(CurrentWindowId)));
}

export async function getCurrentTabIdAnd(): Promise<number> {
	return new Promise(async resolve => {
		return getCurrentTabId().then(tabId => {
			if(tabId)resolve(tabId);
		});
	});
}

async function getWindowActiveTab(windowId: number){
	return browser.windows.get(windowId, { populate: true }).then(Window => {
		if(Window.tabs){
			for(let t of Window.tabs){
				if(t.active){
					return t;
				}
			}
		}
		return undefined;
	});
}

// TODO: dead code?
// async function getWindowMailTab(windowId){
// 	return browser.windows.get(windowId, { populate: true }).then(Window => {
// 		if(Window.tabs){
// 			for(let t of Window.tabs){
// 				if(t.mailTab){
// 					return t;
// 				}
// 			}
// 		}
// 	});
// }
// async function getWindowMailTabId(windowId){
// 	return getWindowMailTab(windowId).then(Tab => {
// 		return getTabId(Tab);
// 	});
// }

function updateNoteView(note?: NoteData){
	if(note){
		sendNoteToQApp(note).then(() => {
			getCurrentWindowIdAnd().then(windowId => browser.qapp.updateView(windowId, note.keyId));
		});
	} else {
		getCurrentWindowIdAnd().then(windowId => browser.qapp.updateView(windowId));
	}
}

export async function confirmDelete(shouldConfirm: boolean): Promise<boolean> {
	return shouldConfirm ? await browser.legacy.confirm(_("delete.note"), _("are.you.sure")) : true;
}

export async function focusMessagePane(windowId: number){
	return browser.qapp.messagePaneFocus(windowId);
}

// /**
//  * @param {string} root
//  * @param {"xnote"|"qnote"} type
//  * @param {boolean} overwrite
//  */
// async function exportQAppNotesToFolder(root, type, overwrite){
// 	if(Prefs.storageOption == 'folder'){
// 		return loadAllFolderNotes(Prefs.storageFolder).then(notes => exportNotesToFolder(root, type, notes, overwrite));
// 	} else {
// 		return loadAllExtNotes().then(notes => exportNotesToFolder(root, type, notes, overwrite));
// 	}
// }

// Load all note keys from local storage
async function loadAllExtKeys() {
	return browser.storage.local.get().then(storage => {
		let keys = [];
		for(let keyId in storage){
			if(keyId.substr(0, 5) !== 'pref.') {
				keys.push(keyId);
			}
		}
		return keys;
	});
}

async function loadAllExtNotes(): Promise<Array<NoteData>> {
	return loadAllExtKeys().then(async keys => {
		let Notes = [];
		for(let keyId of keys){
			let note = new QNote(keyId);
			await note.load();
			Notes.push(note.data);
		}
		return Notes;
	});
}

// Load all note keys from folder, prioritizing qnote if both qnote and xnote exists
async function loadAllFolderKeys(folder: string) {
	return Promise.all([
		browser.xnote.getAllKeys(folder),
		browser.qnote.getAllKeys(folder)
	]).then(values => {
		return Object.assign(values[0], values[1]);
	});
}

export async function loadAllFolderNotes(folder: string): Promise<Array<NoteData>> {
	return loadAllFolderKeys(folder).then(async keys => {
		let Notes = [];
		for(let keyId of keys){
			let note = new QNoteFolder(keyId, folder);
			await note.load();
			Notes.push(note.data);
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
// function note2QAppNote(note){
// 	return note ? {
// 		keyId: note.keyId,
// 		exists: note.exists || false,
// 		text: note.text || "",
// 		ts: note.ts || 0,
// 		tsFormatted: qDateFormat(note.ts)
// 	} : null;
// }

// function note2QNote(note){
// 	return note ? {
// 		left: note.left,
// 		top: note.top,
// 		width: note.width,
// 		height: note.height,
// 		text: note.text,
// 		ts: note.ts
// 	} : null;
// }

// async function loadAllQAppNotes(){
// 	return loadAllNotes().then(notes => {
// 		for(let note of notes){
// 			sendNoteToQApp(note);
// 		}
// 	});
// }

function sendNoteToQApp(note: NoteData){
	return browser.qapp.saveNoteCache(note);
}

// TODO:
// /**
//  * @param {string} root
//  * @param {"xnote"|"qnote"} type
//  * @param {Note[]} notes
//  * @param {boolean} overwrite
//  */
//  async function exportNotesToFolder(root, type, notes, overwrite){
// 	let stats = {
// 		err: 0,
// 		exist: 0,
// 		imported: 0,
// 		overwritten: 0
// 	};

// 	for (const note of notes) {
// 		let yn;
// 		if(type == "xnote"){
// 			yn = new XNote(note.keyId, root);
// 		} else {
// 			yn = new QNoteFolder(note.keyId, root);
// 		}

// 		await yn.load();

// 		let exists = yn.exists;

// 		if(exists && !overwrite){
// 			stats.exist++;
// 		} else {
// 			yn.set(note.get());
// 			await yn.save().then(() => {
// 				stats[exists ? "overwritten" : "imported"]++;
// 			}).catch(e => {
// 				console.error(_("error.saving.note"), e.message, yn.keyId);
// 				stats.err++;
// 			});
// 		}
// 	}

// 	return stats;
// }

async function addToClipboard(note: NoteData){
	await browser.qnote.copyToClipboard(note);
}

async function getFromClipboard(){
	return browser.qnote.getFromClipboard();
}

async function isClipboardSet(){
	return getFromClipboard().then(content => {
		return content && content.text && content.text.trim ? content.text.trim().length > 0 : false;
	});
}

// let messageHeaderReturner = (MessageHeader: MessageHeader) => {
// 	if(MessageHeader){
// 		return MessageHeader;
// 	}
// 	throw new NoMessageError;
// };

// let messagePartReturner = (MessagePart: MessagePart) => {
// 	if(MessagePart){
// 		return MessagePart;
// 	}
// 	throw new NoMessageError;
// };


export function ts2jsdate(ts: Date | undefined): Date {
	return (ts === undefined ? new Date() // Not provided
		: (ts instanceof Date) ? new Date(ts) // JS Date()
			: new Date(ts) // ts
	);
}

export function dateFormat(locale: string, format: string, ts?: Date) {
	let dt = luxon.DateTime.fromJSDate(ts2jsdate(ts)).setLocale(locale);

	function pad(o: any, l: number, c: string){
		return o.toString().padStart(l, c);
	}

	let Con = {
		d: pad(dt.day, 2, "0"),
		D: dt.weekdayShort,
		j: dt.day,
		l: dt.weekdayLong,
		N: dt.weekday,
		// S: English ordinal suffix for the day of the month, 2 characters
		w: dt.weekday - 1,
		z: dt.ordinal - 1,
		W: dt.weekNumber,
		F: dt.monthLong,
		m: pad(dt.month, 2, "0"),
		M: dt.monthShort,
		n: dt.month,
		t: dt.daysInMonth,
		L: dt.isInLeapYear ? 1 : 0,
		// o: ISO 8601 week-numbering year. This has the same value as Y, except that if the ISO week number (W) belongs to the previous or next year, that year is used instead.
		// X: An expanded full numeric representation of a year, at least 4 digits, with - for years BCE, and + for years CE.
		// x: An expanded full numeric representation if required, or a standard full numeral representation if possible (like Y). At least four digits. Years BCE are prefixed with a -. Years beyond (and including) 10000 are prefixed by a +.
		Y: dt.year,
		y: dt.year.toString().substr(-2),
		a: dt.toFormat('a').toLowerCase(),
		A: dt.toFormat('a'),
		// B: Swatch Internet time
		g: dt.toFormat('h'),
		G: dt.hour,
		h: dt.toFormat('hh'),
		H: pad(dt.hour, 2, "0"),
		i: pad(dt.minute, 2, "0"),
		s: pad(dt.second, 2, "0"),
		// u: Microseconds
		v: dt.millisecond,
		e: dt.toFormat('z'),
	};

	console.error("TODO: format date string");
	// return format.replace(/\\?(.?)/gi, (c: string, s: string): string => {
	// 	let con = c;
	// 	if(Con[c] !== undefined){
	// 		if(typeof Con[c] === "function"){
	// 			con = Con[c]();
	// 		} else {
	// 			con = Con[c];
	// 		}
	// 	}
	// 	return con;
	// 	// conStr += con;
	// });
}
