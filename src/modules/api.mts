import { NoteData } from "../modules/Note.mjs";
import { IQPopupOptions, IQPopupOptionsPartial } from "./NotePopups.mjs";

// var { ExtensionUtils } = ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");
// var { ExtensionError } = ExtensionUtils;

export interface IQPopupAPI {
	setDebug(on: boolean): Promise<void>
	remove(id: number): Promise<void>
	get(id: number): Promise<IQPopupOptions>
	pop(id: number): Promise<void>
	create(windowsId: number, options: IQPopupOptions | IQPopupOptionsPartial): Promise<void>
	update(options: IQPopupOptions | IQPopupOptionsPartial): Promise<IQPopupOptions>
	onRemoved: WebExtEvent<(id: number) => void>
}

export type PopupAnchor   = "window" | "threadpane" | "message";
export type StorageOption = "folder" | "ext";
export type WindowOption  = "xul" | "webext";

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

export interface IQAppPreferences {
	storageOption      : StorageOption
	storageFolder      : string
	showFirstChars     : number
	printAttachTop     : boolean
	printAttachBottom  : boolean
	messageAttachTop   : boolean
	messageAttachBottom: boolean
	attachTemplate     : string
	treatTextAsHtml    : boolean
}

export interface IPreferences extends IQAppPreferences {
	windowOption          : WindowOption
	focusOnDisplay        : boolean
	showOnSelect          : boolean
	useTag                : boolean
	tagName               : string
	dateFormat            : string
	dateFormatPredefined  : string
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

export class QAppPreferences implements IQAppPreferences {
	storageOption: StorageOption = "folder"
	storageFolder                = ""
	showFirstChars               = 3
	printAttachTop               = true
	printAttachBottom            = false
	messageAttachTop             = true
	messageAttachBottom          = false
	attachTemplate               = ''
	treatTextAsHtml              = false
}

export class Preferences extends QAppPreferences {
	windowOption: WindowOption = "xul"
	focusOnDisplay             = true
	showOnSelect               = true
	useTag                     = false
	tagName                    = "xnote"
	dateFormat                 = "Y-m-d H:i" // See https://www.php.net/manual/en/datetime.format.php
	dateFormatPredefined       = ""
	dateLocale                 = ""
	width                      = 320
	height                     = 200
	enableDebug                = false
	anchor: PopupAnchor        = "window"; // window; threadpane; messag
	anchorPlacement            = "center"; // see options.js generatePosGrid() for option
	alwaysDefaultPlacement     = false
	confirmDelete              = false
	enableSpellChecker         = true
}

export interface IQAppAPI {
	createStoragePath(): Promise<string>
	updateColumsView(): Promise<void>
	init(): Promise<void>
	setDebug(on: boolean): Promise<void>
	messagePaneFocus(windowId: number): Promise<void>
	setPrefs(prefs: IQAppPreferences): Promise<void>
	attachNoteToMessage(windowId: number, note: NoteData): Promise<void>
	saveNoteCache(note: NoteData): Promise<void>

	onNoteRequest: WebExtEvent<(keyId: string) => void>
	onKeyDown: WebExtEvent<(e: KeyboardEvent) => void>
}

