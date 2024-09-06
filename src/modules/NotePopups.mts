import { IPreferences, PopupAnchor } from './api.mjs';
import { dateFormatWithPrefs } from './common.mjs';
import { INote, INoteData } from './Note.mjs';
import { QEventDispatcher } from './QEventDispatcher.mjs';

export interface INotePopup {
	keyId: string;
	windowId: number;
	handle: number;
	note: INote;
	flags: number | undefined;
	focus(): Promise<void>
	isFocused(): Promise<boolean>
	pop(): Promise<void>
}

export interface IPopupOptions {
	focused?: boolean
	top?: number
	left?: number
	offsetTop?: number
	offsetLeft?: number
	width?: number
	height?: number
	anchor?: PopupAnchor
	anchorPlacement?: string
	title?: string
	text?: string
	placeholder?: string
	focusOnDisplay?: boolean
	enableSpellChecker?: boolean
}

interface NoteListenerArgs {
	close: (handle: number, reason: string, note: INoteData) => void
}

class NoteEventDispatcher extends QEventDispatcher<NoteListenerArgs> {
	constructor() {
		super("close")
	}
}

export abstract class DefaultNotePopup extends NoteEventDispatcher implements INotePopup {
	keyId: string
	windowId: number
	handle: number
	note: INote;
	flags: number | undefined;

	constructor(keyId: string, windowId: number, handle: number, note: INote) {
		super()
		this.keyId = keyId
		this.windowId = windowId
		this.handle = handle
		this.note = note;

		// this.ed.addListener("close", (id: number)=>{});
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

	// get isModified(): boolean {
	// 	if(this.note){
	// 		const n1 = this.loadedNoteData;
	// 		const n2 = this.note;
	// 		if(n1 && n2 && n2.data){
	// 			return !this.isEqual(n1, n2.data);
	// 		}
	// 	}
	// 	return false;
	// }

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

	isEqual(n1: INoteData, n2: INoteData): boolean {
		let k1 = Object.keys(n1);
		let k2 = Object.keys(n2);

		if(k1.length != k2.length){
			return false;
		}

		for(let k of k1){
			var key = k as keyof INoteData;
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

export function note2QPopupOptions(note: INote, prefs: IPreferences): IPopupOptions {
	const opt: IPopupOptions = {};

	opt.width = note.data?.width || prefs.width;
	opt.height = note.data?.height || prefs.height;
	opt.left = note.data?.left;
	opt.top = note.data?.top;

	if(prefs.alwaysDefaultPlacement){
		opt.width = prefs.width;
		opt.height = prefs.height;
		opt.left = undefined;
		opt.top = undefined;
	}

	opt.text = note.data?.text;
	opt.title = "QNote: " + dateFormatWithPrefs(prefs, note.data?.ts);

	return opt;
}

export function QPopupOptions2note(state: IPopupOptions): INoteData {
	return {
		text: state.text,
		left: state.left,
		top: state.top,
		width: state.width,
		height: state.width,
	}
}

// Wrapper around qpopup API
export class QNotePopup extends DefaultNotePopup {
	prefs: IPreferences;

	private id: number; // id from qpopup.api

	// Use create() to instantiate object
	private constructor(id: number, keyId: string, windowId: number, handle: number, note: INote, prefs: IPreferences) {
		super(keyId, windowId, handle, note);
		this.handle = handle
		this.prefs = prefs
		this.id = id
		browser.qpopup.onClosed.addListener((id: number, reason: string, state: IPopupOptions) => {
			if(id == this.id){
				console.log("browser.qpopup.onClosed", id, reason, state);
				this.fireListeners("close", this.handle, reason, QPopupOptions2note(state));
			}
		});
	}

	static init(debugOn: boolean){
		browser.qpopup.setDebug(debugOn);
	}

	static async create(keyId: string, windowId: number, handle: number, note: INote, prefs: IPreferences): Promise<QNotePopup> {
		return browser.qpopup.create(windowId, note2QPopupOptions(note, prefs)).then(id => {
			console.log(`created qpopup ${id}`);

			return new QNotePopup(id, keyId, windowId, handle, note, prefs);
		});
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
		return browser.qpopup.pop(this.id);
		// browser.qpopup.pop(this.qpopupHandle).then(() => {
		// 	let l = (id: number) => {
		// 		console.log(`popped onRemoved ${this.qpopupHandle}:${id}`);
		// 		// super.close();
		// 		browser.qpopup.onRemoved.removeListener(l);
		// 	};
		// 	browser.qpopup.onRemoved.addListener(l);
		// 	console.log(`popped popup ${this.qpopupHandle}`);
		// });

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
