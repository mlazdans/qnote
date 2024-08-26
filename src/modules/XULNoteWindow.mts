import { INote } from "./Note.mjs";
import { DefaultNoteWindow } from "./NoteWindow.mjs";
import { Preferences } from "./Preferences.mjs";
import { PopupAnchor } from "./utils.mjs";

export type QPopupOptions = {
	id: number;
	focused?: boolean | null;
	top?: number | null;
	left?: number | null;
	offsetTop?: number | null;
	offsetLeft?: number | null;
	width?: number | null;
	height?: number | null;
	anchor?: PopupAnchor | null;
	anchorPlacement?: string | null;
	title?: string | null;
	placeholder?: string | null;
	focusOnDisplay?: boolean | null;
}

export class XULNoteWindow extends DefaultNoteWindow {
	prefs: Preferences;

	constructor(id: number, windowId: number, note: INote, prefs: Preferences) {
		super(id, windowId, note);
		this.prefs = prefs;

		const opt: QPopupOptions = { id };

		opt.width = note.data.width || this.prefs.width;
		opt.height = note.data.height || this.prefs.height;
		opt.left = note.data.left;
		opt.top = note.data.top;

		if(this.prefs.alwaysDefaultPlacement){
			opt.width = this.prefs.width;
			opt.height = this.prefs.height;
			opt.left = null;
			opt.top = null;
		}

		browser.qpopup.create(windowId, opt).then(() => {
			console.log(`created popup ${id}`);
		});
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
		if(this.id){
			browser.qpopup.remove(this.id);
		}
		super.close();
	}

	async pop() {
		browser.qpopup.pop(this.id).then(() => {
			console.log(`popped popup ${this.id}`);
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
