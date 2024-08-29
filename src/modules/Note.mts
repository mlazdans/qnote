export class NoteData {
	keyId: string; // message-id header or another unique id
	exists: boolean = false;
	text: string | null = "";
	left: number | null = null;
	top: number | null = null;
	width: number | null = null;
	height: number | null = null;
	ts: number | null = null;
	tsFormatted: string | null = null;
	constructor(keyId: string) {
		this.keyId = keyId;
	};
}

export interface INote {
	data: NoteData;
	// get(): NoteData;
	// set(data: NoteData): void;
	load(): Promise<NoteData>;
	save(): Promise<void>;
	delete(): Promise<void>;
}

// type NoteSaver = () => Promise<boolean>;
// type NoteDeleter = () => Promise<boolean>;

// const l = ["aftersave", "afterdelete" , "afterupdate"];
// type NoteListener = typeof l[number];

// export type Note = (QNote | QNoteFolder) & QEventDispatcher;

export abstract class DefaultNote implements INote {
	keyId: string;
	data: NoteData;

	constructor(keyId: string) {
		this.keyId = keyId;
		// super(["aftersave", "afterdelete", "afterupdate"]);
		this.data = new NoteData(keyId);
	}

	// addListener(name: NoteListener, listener: Function): void {
	// 	super.addListener(name, listener);
	// }

	// async load(loader: Function): Promise<NoteData> {
	// 	return loader().then((data: NoteData) => {
	// 		this.set(data);
	// 		this.data.exists = !!data;

	// 		return this.get();
	// 	});
	// }

	abstract load(): Promise<NoteData>
	abstract save(): Promise<void>
	abstract delete(): Promise<void>

	// protected async saver(saver: NoteSaver): Promise<boolean> {
	// 	return saver().then(saved => {
	// 		if(saved){
	// 			this.data.exists = true;
	// 			this.fireListeners("aftersave", this);
	// 			this.fireListeners("afterupdate", this, "save");
	// 		}
	// 		return saved;
	// 	});
	// }

	// protected async deleter(deleter: NoteDeleter): Promise<boolean> {
	// 	return deleter().then(deleted => {
	// 		if(deleted){
	// 			this.data.exists = false;
	// 			this.fireListeners("afterdelete", this);
	// 			this.fireListeners("afterupdate", this, "delete");
	// 		}
	// 		return deleted;
	// 	});
	// }
}

export class QNote extends DefaultNote {
	constructor(keyId: string) {
		super(keyId);
	}

	async load(): Promise<NoteData> {
		this.data = new NoteData(this.keyId);
		return browser.storage.local.get(this.data.keyId).then(store => store[this.data.keyId] ? this.data = store[this.data.keyId] : this.data);
	}

	async save() {
		browser.storage.local.set({
			[this.data.keyId]: this.data
		}).then(() => true).catch(() => false);
		// return super.saver(() => browser.storage.local.set({
		// 	[this.data.keyId]: this.data
		// }).then(() => true).catch(() => false));
	}

	async delete() {
		browser.storage.local.remove(this.data.keyId).then(() => true).catch(() => false);
		// return super.deleter(() => browser.storage.local.remove(this.data.keyId).then(() => true).catch(() => false));
	}
}

export class QNoteFolder extends DefaultNote {
	root: string;

	constructor(keyId: string, root: string) {
		super(keyId);
		this.root = root;
	}

	async load(): Promise<NoteData> {
		this.data = new NoteData(this.keyId);

		let data = await browser.qnote.load(this.root, this.data.keyId);

		// Check maybe XNote exists
		if(!data.exists){
			data = await browser.xnote.load(this.root, this.data.keyId);
		}

		if(data.exists){
			this.data = data;
		}

		return this.data;
	}

	async save(){
		browser.qnote.save(this.root, this.data.keyId, this.data).then(() => true).catch(() => false);
		// return super.saver(() => browser.qnote.saveNote(this.root, this.data.keyId, this.data).then(() => true).catch(() => false));
	}

	async delete() {
		await browser.xnote.delete(this.root, this.data.keyId);
		await browser.qnote.delete(this.root, this.data.keyId);
		// return super.deleter(async () => {
		// 	// Remove XNote, if exists
		// 	await browser.xnote.deleteNote(this.root, this.data.keyId);

		// 	return browser.qnote.deleteNote(this.root, this.data.keyId);
		// });
	}
}

export class XNote extends DefaultNote {
	root: string;

	constructor(keyId: string, root: string) {
		super(keyId);
		this.root = root;
	}

	async load(): Promise<NoteData> {
		this.data = new NoteData(this.keyId);
		return browser.xnote.load(this.root, this.data.keyId).then(data => this.data = data);
	}

	async save(){
		browser.xnote.save(this.root, this.data.keyId, this.data).then(() => true).catch(() => false);
		// return super.saver(() => browser.xnote.saveNote(this.root, this.data.keyId, this.data).then(() => true).catch(() => false));
	}

	async delete() {
		browser.xnote.delete(this.root, this.data.keyId).then(() => true).catch(() => false);
		// return super.deleter(() => browser.xnote.deleteNote(this.root, this.data.keyId).then(() => true).catch(() => false));
	}
}
