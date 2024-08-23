import { PopupAnchor, StorageOption, WindowOption } from "./utils.mjs";

export class QAppPreferences {
	storageOption: StorageOption = "folder";
	storageFolder = "";
	showFirstChars = 3;
	printAttachTop = true;
	printAttachBottom = false;
	messageAttachTop = true;
	messageAttachBottom = false;
	attachTemplate = '';
	treatTextAsHtml = false;
}

export class Preferences extends QAppPreferences {
	windowOption: WindowOption = "xul";
	focusOnDisplay = true;
	showOnSelect = true;
	useTag = false;
	tagName = "xnote";
	dateFormat = "Y-m-d H:i"; // See https://www.php.net/manual/en/datetime.format.php
	dateFormatPredefined = "";
	dateLocale = "";
	width = 320;
	height = 200;
	enableDebug = false;
	anchor: PopupAnchor = "window"; // window; threadpane; message
	anchorPlacement = "center"; // see options.js generatePosGrid() for options
	alwaysDefaultPlacement = false;
	confirmDelete = false;
}

// TODO: class
export interface XNotePreferences {
	usetag: boolean,
	dateformat: string;
	width: number,
	height: number,
	show_on_select: boolean,
	show_first_x_chars_in_col: number,
	storage_path: string,
	version: string,
}
