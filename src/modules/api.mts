import * as luxon from "../modules/luxon.mjs";
import { IPopupOptions } from "./NotePopups.mjs";

export interface IQPopupAPI {
	setDebug(on: boolean): Promise<void>
	close(id: number, reason: "close" | "escape" | "delete"): Promise<void>
	get(id: number): Promise<IPopupOptions>
	pop(id: number): Promise<void>
	create(windowsId: number, options: IPopupOptions): Promise<number>
	update(id: number, options: IPopupOptions): Promise<IPopupOptions>
	onClose: WebExtEvent<(id: number, reason: string, state: IPopupOptions) => void>
	onFocus: WebExtEvent<(id: number) => void>
	onBlur: WebExtEvent<(id: number) => void>
}

export type PopupAnchor          = "window" | "threadpane" | "message";
export type StorageOption        = "folder" | "ext";
export type WindowOption         = "xul" | "webext";
export type LuxonDateFormatGroup = "datetime_group" | "date_group" | "time_group"
export type LuxonPredefined      = keyof typeof luxon.DateTime
export type LuxonDateFormatsMap  = Map<LuxonDateFormatGroup, Array<LuxonPredefined>>

export interface IXNotePreferences {
	usetag: boolean,
	dateformat: string;
	width: number,
	height: number,
	show_on_select: boolean,
	show_first_x_chars_in_col: number,
	storage_path: string,
	version: string,
}

export interface IWritableQAppPreferences {
	storageOption      : StorageOption
	storageFolder      : string
	showFirstChars     : number
	messageAttachTop   : boolean
	messageAttachBottom: boolean
	attachTemplate     : string
	treatTextAsHtml    : boolean
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
	enableDebug           : boolean
	anchor                : PopupAnchor
	anchorPlacement       : string
	alwaysDefaultPlacement: boolean
	confirmDelete         : boolean
	enableSpellChecker    : boolean
}

export type IPreferences = Readonly<IWritablePreferences>;
export type IQAppPreferences = Readonly<IWritableQAppPreferences>;

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
		enableDebug           : false,
		anchor                : "window",
		anchorPlacement       : "center", // see options.js generatePosGrid()
		alwaysDefaultPlacement: false,
		confirmDelete         : false,
		enableSpellChecker    : true,
	}
}

Object.freeze(Prefs.defaults);
Object.freeze(QAppPrefs.defaults);
