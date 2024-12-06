// This code should run everywhere: background, content, experiments
import * as luxon from "../modules/luxon.mjs";

export type PopupAnchor          = "window" | "threadpane" | "message";
export type StorageOption        = "folder" | "ext";
export type WindowOption         = "xul" | "webext";
export type LuxonDateFormatGroup = "datetime_group" | "date_group" | "time_group"
export type LuxonPredefined      = keyof typeof luxon.DateTime
export type LuxonDateFormatsMap  = Map<LuxonDateFormatGroup, Array<LuxonPredefined>>

export interface IWritableQAppPreferences {
	storageOption      : StorageOption
	storageFolder      : string
	showFirstChars     : number
	messageAttachTop   : boolean
	messageAttachBottom: boolean
	attachTemplate     : string
	treatTextAsHtml    : boolean
	enableDebug        : boolean
}

export interface IWritablePreferences extends IWritableQAppPreferences {
	windowOption          : WindowOption
	focusOnDisplay        : boolean
	showOnSelect          : boolean
	useTag                : boolean
	tagName               : string
	dateFormat            : string
	dateFormatPredefined  : LuxonPredefined | ""
	dateLocale            : string
	width                 : number
	height                : number
	anchor                : PopupAnchor
	anchorPlacement       : string
	alwaysDefaultPlacement: boolean
	confirmDelete         : boolean
	enableSpellChecker    : boolean
	saveOnClose           : boolean
}

export type IPreferences = Readonly<IWritablePreferences>;
export type IQAppPreferences = Readonly<IWritableQAppPreferences>;

export interface IXNotePreferences {
	usetag                   : boolean,
	dateformat               : string;
	width                    : number,
	height                   : number,
	show_on_select           : boolean,
	show_first_x_chars_in_col: number,
	storage_path             : string,
	version                  : string,
}

export class QAppPrefs
{
	static readonly defaults: IQAppPreferences = {
		storageOption      : "folder",
		storageFolder      : "",
		showFirstChars     : 3,
		messageAttachTop   : true,
		messageAttachBottom: false,
		attachTemplate     : '<div class="qnote-title">QNote: {{ qnote_date }}</div>\n<div class="qnote-text">{{ qnote_text }}</div>',
		treatTextAsHtml    : false,
		enableDebug        : true,
	}
}

export class Prefs {
	static readonly defaults: IPreferences = {
		...QAppPrefs.defaults,
		windowOption          :"xul",
		focusOnDisplay        : true,
		showOnSelect          : true,
		useTag                : false,
		tagName               : "xnote",
		dateFormat            : "Y-m-d H:i", // See https://www.php.net/manual/en/datetime.format.php
		dateFormatPredefined  : "",
		dateLocale            : "",
		width                 : 320,
		height                : 200,
		enableDebug           : true,
		anchor                : "window",
		anchorPlacement       : "center", // see options.js generatePosGrid()
		alwaysDefaultPlacement: false,
		confirmDelete         : false,
		enableSpellChecker    : true,
		saveOnClose           : true,
	}
}

Object.freeze(Prefs.defaults);
Object.freeze(QAppPrefs.defaults);

export class NoKeyIdError extends Error {};
export class NoMessageError extends Error {};

export type MessageId = browser.messages.MessageId;
export type MessageHeader = browser.messages.MessageHeader;
export type MessagePart = browser.messages.MessagePart;

export type AtLeast<T, K extends keyof T> = Partial<T> & Pick<T, K>

export interface TypeCheckbox {
	type: "checkbox"
}

export interface TypeRadio {
	type: "radio"
}

export interface TypeButton {
	type: "button"
}

export interface TypeFile {
	type: "file"
}

export type HTMLInputButtonElement   = HTMLInputElement & TypeButton
export type HTMLInputCheckboxElement = HTMLInputElement & TypeCheckbox
export type HTMLInputRadioElement    = HTMLInputElement & TypeRadio
export type HTMLInputFileElement     = HTMLInputElement & TypeFile

export interface IBox {
	top   : number;
	left  : number;
	width : number;
	height: number;
}

export var Box = {
	center: function(innerBox: IBox, outerBox: IBox, absolute = true): IBox {
		const retBox: IBox = { top: 0, left: 0, width: 0, height: 0 };

		retBox.left = Math.round((outerBox.width - innerBox.width) / 2);
		retBox.top = Math.round((outerBox.height - innerBox.height) / 2);

		if (absolute) {
			retBox.left += outerBox.left;
			retBox.top += outerBox.top;
		}

		return retBox;
	}
}

export function xnotePrefsMapper(prefs: Partial<IXNotePreferences>): Partial<IPreferences> {
	const map: Map<keyof IXNotePreferences, keyof IWritablePreferences> = new Map([
		["usetag", 'useTag'],
		["width", "width"],
		["height", "height"],
		["show_on_select", "showOnSelect"],
		["show_first_x_chars_in_col", "showFirstChars"],
		["storage_path", "storageFolder"],
		["dateformat", "dateFormat"],
	]);

	const ret: Partial<IWritablePreferences> = {};

	map.forEach((qnoteKey, xnoteKey) => {
		if(prefs[xnoteKey] !== undefined){
			setProperty(ret, qnoteKey, prefs[xnoteKey]);
		}
	});

	return ret;
}

export function getProperty<O, K extends keyof O>(obj: O, key: K) {
	return obj[key];
}

export function setProperty<O, K extends keyof O>(obj: O, key: K, value: O[K]) {
	obj[key] = value;
}

export function getPropertyType<O, K extends keyof O>(obj: O, key: K) {
	return typeof obj[key];
}

function ts2jsdate(ts?: Date | number): Date {
	return ts === undefined ? new Date() : new Date(ts)
}

export function dateFormatWithPrefs(prefs: IPreferences, ts?: Date | number): string {
	const dt = luxon.DateTime.fromJSDate(ts2jsdate(ts)).setLocale(prefs.dateLocale)
	if(prefs.dateFormatPredefined){
		return dt.toLocaleString(luxon.DateTime[prefs.dateFormatPredefined]);
	} else if(prefs.dateFormat) {
		return php2luxon(prefs.dateFormat, dt);
	} else {
		return dt.toLocaleString(luxon.DateTime.DATETIME_FULL_WITH_SECONDS);
	}
}

// Inside parentheses are implemented date "characters"
// Day
// ========================================================================================================================
// (d)	Day of the month, 2 digits with leading zeros	01 to 31
// (D)	A textual representation of a day, three letters	Mon through Sun
// (j)	Day of the month without leading zeros	1 to 31
// (l)	A full textual representation of the day of the week	Sunday through Saturday
// (N)	ISO-8601 numeric representation of the day of the week (added in PHP 5.1.0)	1 (for Monday) through 7 (for Sunday)
// S	English ordinal suffix for the day of the month, 2 characters	st, nd, rd or th. Works well with j
// (w)	Numeric representation of the day of the week	0 (for Sunday) through 6 (for Saturday)
// (z)	The day of the year (starting from 0)	0 through 365

// Week
// (W)	ISO-8601 week number of year, weeks starting on Monday	Example: 42 (the 42nd week in the year)

// Month
// ========================================================================================================================
// (F)	A full textual representation of a month, such as January or March	January through December
// (m)	Numeric representation of a month, with leading zeros	01 through 12
// (M)	A short textual representation of a month, three letters	Jan through Dec
// (n)	Numeric representation of a month, without leading zeros	1 through 12
// (t)	Number of days in the given month	28 through 31

// Year
// ========================================================================================================================
// (L)	Whether it's a leap year	1 if it is a leap year, 0 otherwise.
// o	ISO-8601 week-numbering year. This has the same value as Y, except that if the ISO week number (W) belongs to the previous or next year, that year is used instead. (added in PHP 5.1.0)	Examples: 1999 or 2003
// (Y)	A full numeric representation of a year, 4 digits	Examples: 1999 or 2003
// (y)	A two digit representation of a year	Examples: 99 or 03

// Time
// ========================================================================================================================
// a	Lowercase Ante meridiem and Post meridiem	am or pm
// A	Uppercase Ante meridiem and Post meridiem	AM or PM
// B	Swatch Internet time	000 through 999
// g	12-hour format of an hour without leading zeros	1 through 12
// (G)	24-hour format of an hour without leading zeros	0 through 23
// h	12-hour format of an hour with leading zeros	01 through 12
// (H)	24-hour format of an hour with leading zeros	00 through 23
// (i)	Minutes with leading zeros	00 to 59
// (s)	Seconds with leading zeros	00 through 59
// u	Microseconds (added in PHP 5.2.2). Note that date() will always generate 000000 since it takes an int parameter, whereas DateTime::format() does support microseconds if DateTime was created with microseconds.	Example: 654321
// (v)	Milliseconds (added in PHP 7.0.0). Same note applies as for u.	Example: 654
export function php2luxon(format: string, dt: luxon.DateTime): string {
	function pad(o: any, l: number, c: string){
		return o.toString().padStart(l, c);
	}

	type ConvertMap = Map<string, string>

	const Con: ConvertMap = new Map(Object.entries({
		d: pad(dt.day, 2, "0"),
		D: dt.weekdayShort,
		j: dt.day,
		l: dt.weekdayLong,
		N: dt.weekday,
		// S: English ordinal suffix for the day of the month, 2 characters
		w: dt.weekday - 1,
		z: typeof dt.ordinal === "number" ? dt.ordinal - 1 : NaN,
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
		y: dt.year.toString().substring(-2),
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
	}));

	let conStr = '';
	for(const c of format.split('')){
		const entry = Con.get(c);
		if(entry){
			conStr += entry
		} else {
			conStr += c;
		}
	}

	return conStr;
}

export function coalesce(...args: any): any {
	for (let a of args) if (a != null) return a;

	return null;
}

// TODO: document is global, should not be here or should pass as arg
export function getElementByIdOrDie(id: string): HTMLElement {
	const el = document.getElementById(id);
	if(el)return el;
	throw new Error(`Required HTML element with id ${id} not found`);
}

export function querySelectorOrDie(selector: string, ParentNode?: Element): Element {
	const el = ParentNode ? ParentNode.querySelector(selector) : document.querySelector(selector);
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

export function convertPrefsToQAppPrefs(prefs: IPreferences): IQAppPreferences {
	return {
		storageOption      : prefs.storageOption,
		storageFolder      : prefs.storageFolder,
		showFirstChars     : prefs.showFirstChars,
		messageAttachTop   : prefs.messageAttachTop,
		messageAttachBottom: prefs.messageAttachBottom,
		attachTemplate     : prefs.attachTemplate,
		treatTextAsHtml    : prefs.treatTextAsHtml,
		enableDebug        : prefs.enableDebug,
	}
}

