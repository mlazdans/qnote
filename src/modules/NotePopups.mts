import { INote, NoteData } from './Note.mjs';
import { Preferences } from './Preferences.mjs';
import { PopupAnchor } from './utils.mjs';

type AtLeast<T, K extends keyof T> = Partial<T> & Pick<T, K>

export class DirtyStateError extends Error {};

export interface NotePopup {
	id: number;
	windowId: number;
	note: INote;
	flags: number | undefined;
	// loadedNoteData: NoteData | undefined;
	// messageId: string | undefined;
	// needSaveOnClose: boolean;
	// shown: boolean;
	// dirty: boolean;
	// constructor(windowId: number);
	// update(note: NoteData): Promise<void>
	focus(): Promise<void>
	isFocused(): Promise<boolean>
	pop(): Promise<void>
	// close(): Promise<void>
}

// All fields will be sent to qpopup API, optional fields set to null
// These are handled by qpopup API:
//      focused?: boolean | null;
//      top?: number | null;
//      left?: number | null;
//      offsetTop?: number | null;
//      offsetLeft?: number | null;
//      anchor?: PopupAnchor | null;
//      anchorPlacement?: string | null;
// These are handled by qpopup content script
//     width?: number | null;
//     height?: number | null;
//     title?: string | null;
//     text?: string | null;
//     placeholder?: string | null;
//     focusOnDisplay?: boolean | null;
//     enableSpellChecker?: boolean | null;
export interface IQPopupOptions {
	id: number
	focused: boolean | null
	top: number | null
	left: number | null
	offsetTop: number | null
	offsetLeft: number | null
	width: number | null
	height: number | null
	anchor: PopupAnchor | null
	anchorPlacement: string | null
	title: string | null
	text: string | null
	placeholder: string | null
	focusOnDisplay: boolean | null
	enableSpellChecker: boolean | null
}

export type IQPopupOptionsPartial = AtLeast<IQPopupOptions, 'id'>

export abstract class DefaultNotePopup implements NotePopup {
	id: number;
	windowId: number;
	note: INote;
	loadedNoteData: NoteData | undefined;
	// messageId: string | undefined;
	// needSaveOnClose = true;
	// shown = false;
	// dirty = false;
	flags: number | undefined;

	constructor(id: number, windowId: number, note: INote) {
		// super(["afterclose"]);
		this.id = id;
		this.note = note;
		this.windowId = windowId;
	}

	// addListener(name: DefaultNoteWindowListener, listener: (w: NoteWindow) => void): void {
	// 	super.addListener(name, listener);
	// }

	// async loadNoteForMessage(id: MessageId) {
	// 	return loadNoteForMessage(id).then(note => {
	// 		this.note = note;
	// 		this.loadedNoteData = note.get();

	// 		return note;
	// 	});
	// }

	abstract pop(): Promise<void>
	abstract focus(): Promise<void>
	abstract isFocused(): Promise<boolean>
	// abstract update(note: NoteData): Promise<void>

	// async close(){
	// 	this.fireListeners("afterclose", this);
	// 	this.removeAllListeners();
	// 	// this.popupId = undefined;
	// 	// this.messageId = undefined;
	// 	// this.needSaveOnClose = true;
	// 	// this.shown = false;
	// }

	get isModified(): boolean {
		if(this.note){
			const n1 = this.loadedNoteData;
			const n2 = this.note;
			if(n1 && n2){
				return !this.isEqual(n1, n2.data);
			}
		}
		return false;
	}

	// async reset(){
	// 	if(!this.note){
	// 		return;
	// 	}

	// 	let opt = structuredClone(this.note.data);
	// 	opt.left = undefined;
	// 	opt.top = undefined;

	// 	// TODO: Prefs
	// 	// opt.width = Prefs.width;
	// 	// opt.height = Prefs.height;
	// 	this.note.set(opt);

	// 	return this.update(opt);
	// }

	// async deleteNote(){
	// 	let fName = `${this.constructor.name}.deleteNote()`;

	// 	QDEB&&console.debug(`${fName} - deleting...`);

	// 	if(await confirmDelete()) {
	// 		if(this.note){
	// 			return this.note.delete().then(() => true).catch(e => browser.legacy.alert(_("error.deleting.note"), e.message));
	// 		}
	// 	} else {
	// 		QDEB&&console.debug(`${fName} - canceled!`);
	// 		return false;
	// 	}
	// }

	isEqual(n1: NoteData, n2: NoteData): boolean {
		let k1 = Object.keys(n1);
		let k2 = Object.keys(n2);

		if(k1.length != k2.length){
			return false;
		}

		for(let k of k1){
			var key = k as keyof NoteData;
			if(n1[key] !== n2[key]){
				return false;
			}
		}

		return true;
	}


	// async saveNote(){
	// 	let fName = `${this.constructor.name}.saveNote()`;
	// 	if(this.needSaveOnClose){
	// 		QDEB&&console.debug(`${fName} - saving...`);
	// 		return this.note.save().catch(e => browser.legacy.alert(_("error.saving.note"), e.message));
	// 		// return this.note.save().then(async () => {
	// 		// 	QDEB&&console.debug(`${fName} - saved!`);
	// 		// 	await this.fireListeners("aftersave", this);
	// 		// 	await this.fireListeners("afterupdate", this, "save");
	// 		// }).catch(e => browser.legacy.alert(_("error.saving.note"), e.message));
	// 	} else {
	// 		QDEB&&console.debug(`${fName}, needSaveOnClose = false, do nothing`);
	// 	}
	// }

	// async doNothing(){
	// 	let fName = `${this.constructor.name}.doNothing()`;
	// 	QDEB&&console.debug(`${fName}, doing nothing... Done!`);
	// 	return true;
	// }

	// async persist(){
	// 	let fName = `${this.constructor.name}.persist()`;
	// 	QDEB&&console.debug(`${fName} - persisting...`);

	// 	let noteData = this.note.get();
	// 	if(this.loadedNoteData){
	// 		if(this.loadedNoteData.text !== noteData.text){
	// 			this.note.ts = Date.now();
	// 		}
	// 	}

	// 	let action = 'doNothing';
	// 	if(this.modified) {
	// 		if(this.note.exists){ // Update, delete
	// 			action = this.note.text ? "saveNote" : "deleteNote"; // delete if no text
	// 		} else {
	// 			if(this.note.text){ // Create new
	// 				action = "saveNote";
	// 			}
	// 		}
	// 	} else {
	// 		QDEB&&console.debug(`${fName} - not modified`);
	// 	}

	// 	return this[action]();
	// }

	// async persistAndClose(){
	// 	return this.wrapDirty(async () => {
	// 		let fName = `${this.constructor.name}.persistAndClose()`;
	// 		QDEB&&console.debug(`${fName} - closing...`);

	// 		if(!this.shown){
	// 			QDEB&&console.debug(`${fName} - not shown!`);
	// 			return;
	// 		}

	// 		return this.persist().then(() => this.close());
	// 	});
	// }

	// async silentlyPersistAndClose(){
	// 	return this.persistAndClose().catch(silentCatcher());
	// }

	// async deleteAndClose(){
	// 	return this.wrapDirty(async () => {
	// 		let fName = `${this.constructor.name}.deleteAndClose()`;
	// 		return this.deleteNote().then(async hasDeleted => {
	// 			QDEB&&console.debug(`${fName} resulted in: ${hasDeleted}`);
	// 			if(hasDeleted){
	// 				this.close();
	// 			}
	// 		});
	// 	});
	// }

	// async silentlyDeleteAndClose(){
	// 	return this.deleteAndClose().catch(silentCatcher());
	// }

	// return true if popped
	// async pop(popper) {
	// 	return this.wrapDirty(async () => {
	// 		let fName = `${this.constructor.name}.pop()`;
	// 		QDEB&&console.debug(`${fName} - popping...`);

	// 		if(this.shown){
	// 			QDEB&&console.debug(`${fName} - already popped...`);
	// 			return false;
	// 		}

	// 		let note = this.note;

	// 		let opt = {
	// 			width: note.width || Prefs.width,
	// 			height: note.height || Prefs.height,
	// 			left: note.left,
	// 			top: note.top
	// 		};

	// 		if(Prefs.alwaysDefaultPlacement){
	// 			opt.width = Prefs.width;
	// 			opt.height = Prefs.height;
	// 			opt.left = undefined;
	// 			opt.top = undefined;
	// 		}

	// 		return popper(opt).then(isPopped => {
	// 			this.shown = !!isPopped;
	// 			return isPopped;
	// 		});
	// 	});
	// }

	// async wrapDirty(action){
	// 	let self = this;
	// 	return new Promise(resolve => {
	// 		if(self.dirty){
	// 			throw new DirtyStateError;
	// 		} else {
	// 			self.dirty = true;
	// 			return resolve(action().finally(() => self.dirty = false));
	// 		}
	// 	});
	// }

}

export class QNotePopup extends DefaultNotePopup {
	prefs: Preferences;

	constructor(id: number, windowId: number, note: INote, prefs: Preferences) {
		super(id, windowId, note);
		this.prefs = prefs;

		browser.qpopup.create(windowId, this.note2QPopupOptions()).then(() => {
			console.log(`created popup ${id}`);
		});
	}

	note2QPopupOptions(): IQPopupOptionsPartial {
		const opt: IQPopupOptionsPartial = { id: this.id };

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

	// async update(){
	// 	return browser.qpopup.update(this.note2QPopupOptions());
	// }

	// TODO: fix
	async isFocused() {
		console.error("TODO QNotePopup.isFocused()");
		return true;
		// return browser.qpopup.get(this.popupId).then(popupInfo => popupInfo ? popupInfo.focused : false);
	}

	// TODO: fix
	async focus() {
		console.error("TODO QNotePopup.focus()");
		// return this.update({
		// 	focused: true
		// });
	}

	// async close() {
	// 	browser.qpopup.remove(this.id).then(super.close);
	// }

	async pop() {
		browser.qpopup.pop(this.id).then(() => {
			let l = (id: number) => {
				console.log(`popped onRemoved ${this.id}:${id}`);
				// super.close();
				browser.qpopup.onRemoved.removeListener(l);
			};
			browser.qpopup.onRemoved.addListener(l);
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
