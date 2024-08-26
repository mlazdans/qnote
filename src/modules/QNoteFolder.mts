import { DefaultNote } from './Note.mjs';

export class QNoteFolder extends DefaultNote {
	root: string;

	constructor(keyId: string, root: string) {
		super(keyId);
		this.root = root;
	}

	async load(): Promise<boolean> {
		let data;

		// Check for XNote
		if(!(data = await browser.qnote.loadNote(this.root, this.data.keyId))){
			data = await browser.xnote.loadNote(this.root, this.data.keyId);
		}

		if(data) {
			this.data = data;
			return true;
		}

		return false;
	}

	async save(){
		return browser.qnote.saveNote(this.root, this.data.keyId, this.data).then(() => true).catch(() => false);
		// return super.saver(() => browser.qnote.saveNote(this.root, this.data.keyId, this.data).then(() => true).catch(() => false));
	}

	async delete() {
		await browser.xnote.deleteNote(this.root, this.data.keyId);
		return browser.qnote.deleteNote(this.root, this.data.keyId);
		// return super.deleter(async () => {
		// 	// Remove XNote, if exists
		// 	await browser.xnote.deleteNote(this.root, this.data.keyId);

		// 	return browser.qnote.deleteNote(this.root, this.data.keyId);
		// });
	}
}
