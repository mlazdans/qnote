import { INote } from "./Note.mjs";
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

// All fields will be sent to qpopup API, optional fields set to null
export class QPopupOptions {
	id: number
	focused: boolean | null = null
	top: number | null = null
	left: number | null = null
	offsetTop: number | null = null
	offsetLeft: number | null = null
	width: number | null = null
	height: number | null = null
	anchor: PopupAnchor | null = null
	anchorPlacement: string | null = null
	title: string | null = null
	text: string | null = null
	placeholder: string | null = null
	focusOnDisplay: boolean | null = null
	enableSpellChecker: boolean | null = null
	constructor(id: number) {
		this.id = id;
	}
}

type AtLeast<T, K extends keyof T> = Partial<T> & Pick<T, K>

export type QPopupOptionsPartial = AtLeast<QPopupOptions, 'id'>

export class XULNoteWindow extends DefaultNoteWindow {
	prefs: Preferences;

	constructor(id: number, windowId: number, note: INote, prefs: Preferences) {
		super(id, windowId, note);
		this.prefs = prefs;

		browser.qpopup.create(windowId, this.note2QPopupOptions()).then(() => {
			console.log(`created popup ${id}`);
		});
	}

	note2QPopupOptions(): QPopupOptionsPartial {
		const opt: QPopupOptionsPartial = { id: this.id };

		opt.width = this.note.data.width || this.prefs.width;
		opt.height = this.note.data.height || this.prefs.height;
		opt.left = this.note.data.left;
		opt.top = this.note.data.top;

		if(this.prefs.alwaysDefaultPlacement){
			opt.width = this.prefs.width;
			opt.height = this.prefs.height;
			opt.left = null;
			opt.top = null;
		}

		opt.text = this.note.data.text;
		opt.title = "QNote: " + this.note.data.ts; // TODO: format

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
