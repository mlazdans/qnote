export type NoteType = "xnote" | "qnote";

// Need nulls to send to experiment's API
export class NoteData {
	exists: boolean = false;
	text: string | null = "";
	left: number | null = null;
	top: number | null = null;
	width: number | null = null;
	height: number | null = null;
	ts: number | null = null;
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
	keyId: string; // message-id header or another unique id
	data: NoteData;

	constructor(keyId: string) {
		this.keyId = keyId;
		// super(["aftersave", "afterdelete", "afterupdate"]);
		this.data = new NoteData();
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
	protected abstract subload(): Promise<NoteData>;

	// Needed in case new fields will be added to NoteData struct
	async load(): Promise<NoteData> {
		return Object.assign(this.data, await this.subload());
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

export class QNote extends DefaultNote {
	constructor(keyId: string) {
		super(keyId);
	}

	async subload(): Promise<NoteData> {
		return browser.storage.local
			.get(this.keyId)
			.then((store) =>
				store[this.keyId]
					? (this.data = store[this.keyId])
					: (this.data = new NoteData())
			);
	}

	async save() {
		browser.storage.local
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

	async subload(): Promise<NoteData> {
		return browser.qnote.load(this.root, this.keyId).then((data) => {
			if (data.exists) {
				return data;
			} else {
				// Check maybe XNote exists
				return browser.xnote.load(this.root, this.keyId);
			}
		});
	}

	async save() {
		browser.qnote
			.save(this.root, this.keyId, this.data)
			.then(() => true)
			.catch(() => false);
	}

	async delete() {
		await browser.xnote.delete(this.root, this.keyId);
		await browser.qnote.delete(this.root, this.keyId);
	}
}

export class XNote extends DefaultNote {
	root: string;

	constructor(keyId: string, root: string) {
		super(keyId);
		this.root = root;
	}

	async subload(): Promise<NoteData> {
		return browser.xnote.load(this.root, this.keyId);
	}

	async save() {
		browser.xnote
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
