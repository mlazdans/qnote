import { DefaultNote, NoteData } from './Note.mjs';

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
