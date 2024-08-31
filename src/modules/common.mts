// This code should run everywhere: background, content, experiments
// TODO: remove functions with side effects

import { NoteData } from './Note.mjs';
import { IPreferences } from './api.mjs';
import * as luxon from "../modules/luxon.mjs";

export class NoKeyIdError extends Error {};
export class NoMessageError extends Error {};

export type MessageId = browser.messages.MessageId;
export type MessageHeader = browser.messages.MessageHeader;
export type MessagePart = browser.messages.MessagePart;

// Bitmask
export const POP_NONE     = 0;
export const POP_FOCUS    = 1;
export const POP_EXISTING = 2;

export interface TypeCheckbox {
	type: "checkbox"
}

export interface TypeRadio {
	type: "radio"
}

export interface TypeButton {
	type: "button"
}

export type HTMLInputButtonElement   = HTMLInputElement & TypeButton
export type HTMLInputCheckboxElement = HTMLInputElement & TypeCheckbox
export type HTMLInputRadioElement    = HTMLInputElement & TypeRadio

// export function getDefaultPrefs(): IPreferences {
// 	var defaults: IPreferences = {
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

export function getProperty<T, K extends keyof T>(obj: T, key: K) {
	return obj[key];
}

export function setProperty<T, K extends keyof T>(obj: T, key: K, value: T[K]) {
	obj[key] = value;
}

export function getPropertyType<T, K extends keyof T>(obj: T, key: K) {
	return typeof obj[key];
}

export function silentCatcher(){
	return (...args: any) => {
		// QDEB&&console.debug(...args);
		console.debug(...args);
	}
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

// NOTE: current ThreadPaneColumns implementation does not allow updating single row anyways
// function updateNoteView(note?: NoteData){
// 	if(note){
// 		sendNoteToQApp(note).then(() => {
// 			getCurrentWindowIdAnd().then(windowId => browser.qapp.updateView(windowId, note.keyId));
// 		});
// 	} else {
// 		getCurrentWindowIdAnd().then(windowId => browser.qapp.updateView(windowId));
// 	}
// }

export async function focusMessagePane(windowId: number){
	return browser.qapp.messagePaneFocus(windowId);
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
	console.error("TODO: dateFormat");

	// let dt = luxon.DateTime.fromJSDate(ts2jsdate(ts)).setLocale(locale);

	// function pad(o: any, l: number, c: string){
	// 	return o.toString().padStart(l, c);
	// }

	// let Con = {
	// 	d: pad(dt.day, 2, "0"),
	// 	D: dt.weekdayShort,
	// 	j: dt.day,
	// 	l: dt.weekdayLong,
	// 	N: dt.weekday,
	// 	// S: English ordinal suffix for the day of the month, 2 characters
	// 	w: dt.weekday - 1,
	// 	z: dt.ordinal - 1,
	// 	W: dt.weekNumber,
	// 	F: dt.monthLong,
	// 	m: pad(dt.month, 2, "0"),
	// 	M: dt.monthShort,
	// 	n: dt.month,
	// 	t: dt.daysInMonth,
	// 	L: dt.isInLeapYear ? 1 : 0,
	// 	// o: ISO 8601 week-numbering year. This has the same value as Y, except that if the ISO week number (W) belongs to the previous or next year, that year is used instead.
	// 	// X: An expanded full numeric representation of a year, at least 4 digits, with - for years BCE, and + for years CE.
	// 	// x: An expanded full numeric representation if required, or a standard full numeral representation if possible (like Y). At least four digits. Years BCE are prefixed with a -. Years beyond (and including) 10000 are prefixed by a +.
	// 	Y: dt.year,
	// 	y: dt.year.toString().substr(-2),
	// 	a: dt.toFormat('a').toLowerCase(),
	// 	A: dt.toFormat('a'),
	// 	// B: Swatch Internet time
	// 	g: dt.toFormat('h'),
	// 	G: dt.hour,
	// 	h: dt.toFormat('hh'),
	// 	H: pad(dt.hour, 2, "0"),
	// 	i: pad(dt.minute, 2, "0"),
	// 	s: pad(dt.second, 2, "0"),
	// 	// u: Microseconds
	// 	v: dt.millisecond,
	// 	e: dt.toFormat('z'),
	// };

	// console.error("TODO: format date string");
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

// export function coalesce(...args: any): any {
// 	for(let a of args)
// 		if(a !== null)
// 			return a;

// 	return null;
// }

export function getElementByIdOrDie(id: string): HTMLElement {
	const el = document.getElementById(id);
	if(el)return el;
	throw new Error(`Required HTML element with id ${id} not found`);
}

export function querySelectorOrDie(selector: string): Element {
	const el = document.querySelector(selector);
	if(el)return el;
	throw new Error(`Required HTML element with selector ${selector} not found`);
}

export function isHTMLElement(node: Element): node is HTMLElement {
	return node instanceof HTMLElement
}

export function isTextAreaElement(node: Element): node is HTMLTextAreaElement {
	return node instanceof HTMLTextAreaElement
}

export function isSelectElement(node: Element): node is HTMLSelectElement {
	return node instanceof HTMLSelectElement
}

export function isButtonElement(node: Element): node is HTMLButtonElement {
	return node instanceof HTMLButtonElement
}

export function isInputElement(node: Element): node is HTMLInputElement {
	return node instanceof HTMLInputElement
}

export function isTypeButton(node: Element): node is HTMLInputButtonElement {
	return isInputElement(node) && (node.type.toUpperCase() == "BUTTON");
}

export function isTypeCheckbox(node: Element): node is HTMLInputCheckboxElement {
	return isInputElement(node) && (node.type.toUpperCase() == "CHECKBOX");
}

export function isTypeRadio(node: Element): node is HTMLInputRadioElement {
	return isInputElement(node) && (node.type.toUpperCase() == "RADIO");
}
