import { IQPopupOptions, IQPopupOptionsPartial } from "./NotePopups.mjs";

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

interface IPreferencesManager<T> {
	prefs: T
	readonly defaults: T | undefined
	setPartial(data: Partial<T>): void
}

// TODO: remove Manager from name after refactor
class PreferencesManager<T> implements IPreferencesManager<T> {
	prefs: T
	readonly defaults: T | undefined

	constructor(prefs: T){
		this.prefs = prefs
	}

	setPartial(data: Partial<T>){
		if(this.prefs) {
			throw new Error("Can't set partial data to undefined. Set prefs property first!");
		} else {
			Object.assign(this.prefs as object, data);
		}
	}
}

class QAppPrefsManager extends PreferencesManager<IQAppPreferences>
{
	static readonly defaults: IQAppPreferences = {
		storageOption      : "folder",
		storageFolder      : "",
		showFirstChars     : 3,
		printAttachTop     : true,
		printAttachBottom  : false,
		messageAttachTop   : true,
		messageAttachBottom: false,
		attachTemplate     : '',
		treatTextAsHtml    : false,
	}
}

export class PrefsManager extends PreferencesManager<IPreferences> {
	static readonly defaults: IPreferences = {
		...QAppPrefsManager.defaults,
		windowOption          :"xul",
		focusOnDisplay        : true,
		showOnSelect          : true,
		useTag                : false,
		tagName               : "xnote",
		dateFormat            : "Y-m-d H:i", // See https://www.php.net/manual/en/datetime.format.php
		dateFormatPredefined  : undefined,
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
