export type NoteType = QNoteFolder | XNoteFolder | QNoteLocalStorage;
export type NoteClassType = typeof QNoteFolder | typeof XNoteFolder | typeof QNoteLocalStorage;

export interface INoteData {
	text?: string
	left?: number
	top?: number
	width?: number
	height?: number
	ts?: number
}

export interface INote {
	readonly keyId: string; // message-id header or another unique id
	data: INoteData | null
	load(): Promise<INoteData | null>;
	save(): Promise<void>;
	delete(): Promise<void>;
}

// const l = ["aftersave", "afterdelete" , "afterupdate"];
// type NoteListener = typeof l[number];

export abstract class DefaultNote implements INote {
	readonly keyId: string;
	data: INoteData | null = null;

	constructor(keyId: string) {
		this.keyId = keyId;
		// super(["aftersave", "afterdelete", "afterupdate"]);
		// this.noteData = new NoteData();
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

	abstract save(): Promise<void>;
	abstract delete(): Promise<void>;
	protected abstract subload(): Promise<INoteData | null>;

	async load(): Promise<INoteData | null> {
		return this.data = await this.subload()
	}

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

export class QNoteLocalStorage extends DefaultNote {
	constructor(keyId: string) {
		super(keyId);
	}

	async subload(): Promise<INoteData | null> {
		return browser.storage.local
			.get(this.keyId)
			.then((store) =>
				store[this.keyId]
					? (this.data = store[this.keyId])
					: null
			);
	}

	async save() {
		this.data && browser.storage.local
			.set({
				[this.keyId]: this.data,
			})
			.then(() => true)
			.catch(() => false);
	}

	async delete() {
		browser.storage.local
			.remove(this.keyId)
			.then(() => true)
			.catch(() => false);
	}
}

export class QNoteFolder extends DefaultNote {
	root: string;

	constructor(keyId: string, root: string) {
		super(keyId);
		this.root = root;
	}

	async subload(): Promise<INoteData | null> {
		return browser.qnote.load(this.root, this.keyId).then((data) => {
			// Check maybe XNote exists
			return data ?? browser.xnote.load(this.root, this.keyId);
		});
	}

	async save() {
		this.data && browser.qnote
			.save(this.root, this.keyId, this.data)
			.then(() => true)
			.catch(() => false);
	}

	async delete() {
		await browser.xnote.delete(this.root, this.keyId);
		await browser.qnote.delete(this.root, this.keyId);
	}
}

export class XNoteFolder extends DefaultNote {
	root: string;

	constructor(keyId: string, root: string) {
		super(keyId);
		this.root = root;
	}

	async subload(): Promise<INoteData | null> {
		return browser.xnote.load(this.root, this.keyId);
	}

	async save() {
		this.data && browser.xnote
			.save(this.root, this.keyId, this.data)
			.then(() => true)
			.catch(() => false);
	}

	async delete() {
		browser.xnote
			.delete(this.root, this.keyId)
			.then(() => true)
			.catch(() => false);
	}
}
