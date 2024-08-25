import { Note } from "./Note.mjs";
import { DefaultNoteWindow } from "./NoteWindow.mjs";
import { Preferences } from "./Preferences.mjs";
import { PopupAnchor } from "./utils.mjs";

export type QPopupOptions = {
	windowId: number;
	id: number | null;
	focused: boolean | null;
	top: number | null;
	left: number | null;
	offsetTop: number | null;
	offsetLeft: number | null;
	width: number | null;
	height: number | null;
	anchor: PopupAnchor | null;
	anchorPlacement: string | null;
	title: string | null;
	placeholder: string | null;
}

function getDefaultPopupOptions(windowId: number): QPopupOptions {
	return {
		windowId: windowId,
		id: null,
		focused: null,
		top: null,
		left: null,
		offsetTop: null,
		offsetLeft: null,
		width: null,
		height: null,
		anchor: null,
		anchorPlacement: null,
		title: null,
		placeholder: null,
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
		const opt = getDefaultPopupOptions(this.windowId);
		const Prefs = this.prefs;

		opt.width = note.data.width || Prefs.width;
		opt.height = note.data.height || Prefs.height;
		opt.left = note.data.left;
		opt.top = note.data.top;

		if(Prefs.alwaysDefaultPlacement){
			opt.width = Prefs.width;
			opt.height = Prefs.height;
			opt.left = null;
			opt.top = null;
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
