import { NoteData } from "./Note.mjs";
import { DefaultNoteWindow } from "./NoteWindow.mjs";
import { Preferences } from "./Preferences.mjs";
import { PopupAnchor } from "./utils.mjs";

/**
 * These are handled by qpopup API:
 *      focused?: boolean | null;
 *      top?: number | null;
 *      left?: number | null;
 *      offsetTop?: number | null;
 *      offsetLeft?: number | null;
 *      anchor?: PopupAnchor | null;
 *      anchorPlacement?: string | null;
 * These are handled by qpopup content script
 *     width?: number | null;
 *     height?: number | null;
 *     title?: string | null;
 *     text?: string | null;
 *     placeholder?: string | null;
 *     focusOnDisplay?: boolean | null;
 *     enableSpellChecker?: boolean | null;
 */

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
	text?: string | null;
	placeholder?: string | null;
	focusOnDisplay?: boolean | null;
	enableSpellChecker?: boolean | null;
}

export class XULNoteWindow extends DefaultNoteWindow {
	prefs: Preferences;

	constructor(id: number, windowId: number, note: NoteData, prefs: Preferences) {
		super(id, windowId, note);
		this.prefs = prefs;

		browser.qpopup.create(windowId, this.note2QPopupOptions()).then(() => {
			console.log(`created popup ${id}`);
		});
	}

	note2QPopupOptions(): QPopupOptions {
		const opt: QPopupOptions = { id: this.id };

		opt.width = this.note.width || this.prefs.width;
		opt.height = this.note.height || this.prefs.height;
		opt.left = this.note.left;
		opt.top = this.note.top;

		if(this.prefs.alwaysDefaultPlacement){
			opt.width = this.prefs.width;
			opt.height = this.prefs.height;
			opt.left = null;
			opt.top = null;
		}

		opt.text = this.note.text;
		opt.title = "QNote: " + this.note.ts; // TODO: format

		return opt;
	}

	async update(){
		return browser.qpopup.update(this.note2QPopupOptions());
	}

	// TODO: fix
	async isFocused() {
		console.error("TODO XULNoteWindow.isFocused()");
		return true;
		// return browser.qpopup.get(this.popupId).then(popupInfo => popupInfo ? popupInfo.focused : false);
	}

	// TODO: fix
	async focus() {
		console.error("TODO XULNoteWindow.focus()");
		// return this.update({
		// 	focused: true
		// });
	}

	async close() {
		browser.qpopup.remove(this.id).then(super.close);
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
