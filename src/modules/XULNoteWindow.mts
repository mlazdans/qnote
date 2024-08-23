import { Note, NoteData } from "./Note.mjs";
import { DefaultNoteWindow } from "./NoteWindow.mjs";
import { Preferences } from "./Preferences.mjs";

export interface PopupOptions {
	id: number | undefined;
	windowId: number | undefined;
	focused: boolean | undefined;
	top: number | undefined;
	left: number | undefined;
	offsetTop: number | undefined;
	offsetLeft: number | undefined;
	width: number | undefined;
	height: number | undefined;
	anchor: string | undefined;
	anchorPlacement: string | undefined;
	title: string | undefined;
	placeholder: string | undefined;
}

function getDefaultPopupOptions(): PopupOptions {
	return {
		id: undefined,
		windowId: undefined,
		focused: undefined,
		top: undefined,
		left: undefined,
		offsetTop: undefined,
		offsetLeft: undefined,
		width: undefined,
		height: undefined,
		anchor: undefined,
		anchorPlacement: undefined,
		title: undefined,
		placeholder: undefined,
	}
}

export class XULNoteWindow extends DefaultNoteWindow {
	popupId: number;
	prefs: Preferences;

	constructor(popupId: number, prefs: Preferences) {
		super();
		this.popupId = popupId;
		this.prefs = prefs;
	}

	// async update(opt: NoteData){
	// 	return browser.qpopup.update(this.popupId, opt);
	// }

	// TODO: fix
	async isFocused() {
		return true;
		// return browser.qpopup.get(this.popupId).then(popupInfo => popupInfo ? popupInfo.focused : false);
	}

	// TODO: fix
	async focus() {
		// return this.update({
		// 	focused: true
		// });
	}

	async close() {
		browser.qpopup.remove(this.popupId);
		super.close();
	}

	async pop(note: Note) {
		const opt = getDefaultPopupOptions();
		const Prefs = this.prefs;

		opt.width = note.data.width || Prefs.width;
		opt.height = note.data.height || Prefs.height;
		opt.left = note.data.left;
		opt.top = note.data.top;

		if(Prefs.alwaysDefaultPlacement){
			opt.width = Prefs.width;
			opt.height = Prefs.height;
			opt.left = undefined;
			opt.top = undefined;
		}

		browser.qpopup.create(opt).then((popupInfo: PopupOptions) => {
			if(popupInfo.id)
				this.popupId = popupInfo.id;

			return popupInfo;
		});

		// return super.pop(async opt => {
		// 	opt = Object.assign(opt, {
		// 		windowId: this.windowId,
		// 		anchor: Prefs.anchor,
		// 		anchorPlacement: Prefs.anchorPlacement
		// 	});

		// 	return browser.qpopup.create(opt).then(popupInfo => {
		// 		this.popupId = popupInfo.id;
		// 		return popupInfo;
		// 	});
		// });
	}
}
