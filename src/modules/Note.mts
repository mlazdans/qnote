export type NoteType = QNoteFolder | XNoteFolder | QNoteLocalStorage;
export type NoteClassType =
	| typeof QNoteFolder
	| typeof XNoteFolder
	| typeof QNoteLocalStorage;

export interface INoteData {
	text?: string;
	left?: number;
	top?: number;
	width?: number;
	height?: number;
	ts?: number;
}

export interface INote {
	readonly keyId: string; // message-id header or another unique id
	load(): Promise<INoteData | null>;
	save(): Promise<boolean>;
	delete(): Promise<boolean>;
	assignData(data: INoteData): void;
	getData(): INoteData | null;
	exists(): boolean;
}

export abstract class DefaultNote implements INote {
	readonly keyId: string;
	protected data: INoteData | null = null;

	constructor(keyId: string) {
		this.keyId = keyId;
	}

	abstract save(): Promise<boolean>;
	abstract delete(): Promise<boolean>;
	protected abstract subload(): Promise<INoteData | null>;

	async load(): Promise<INoteData | null> {
		try {
			this.data = await this.subload();
			return this.getData();
		} catch(e) {
			if(e instanceof Error){
				console.error("Error loading note:", e.message);
			} else {
				console.error("Error loading note:", e);
			}
			return null;
		}
	}

	assignData(data: INoteData) {
		this.data = Object.assign(this.data || {}, data);
	}

	getData(): INoteData | null {
		return this.data ? Object.assign({}, this.data) : null; // Don't want to pass a reference
	}

	exists(): boolean {
		return this.data !== null;
	}
}

export class QNoteLocalStorage extends DefaultNote {
	constructor(keyId: string) {
		super(keyId);
	}

	async subload(): Promise<INoteData | null> {
		return browser.storage.local
			.get(this.keyId)
			.then((store) => (store[this.keyId] ? store[this.keyId] : null));
	}

	async save() {
		return this.data
			? browser.storage.local
					.set({
						[this.keyId]: this.data,
					})
					.then(() => true)
					.catch(() => false)
			: false;
	}

	async delete() {
		return browser.storage.local
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
			return data ?? browser.xnote.load(this.root, this.keyId);
		});
	}

	async save() {
		return this.data
			? browser.qnote
					.save(this.root, this.keyId, this.data)
					.then(() => true)
					.catch(() => false)
			: false;
	}

	async delete() {
		const d1 = await browser.xnote.delete(this.root, this.keyId);
		const d2 = await browser.qnote.delete(this.root, this.keyId);
		return d1 || d2;
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
		return this.data
			? browser.xnote
					.save(this.root, this.keyId, this.data)
					.then(() => true)
					.catch(() => false)
			: false;
	}

	async delete() {
		return browser.xnote
			.delete(this.root, this.keyId)
			.then(() => true)
			.catch(() => false);
	}
}
