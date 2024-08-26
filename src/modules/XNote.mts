import { DefaultNote } from './Note.mjs';

export class XNote extends DefaultNote {
	root: string;

	constructor(keyId: string, root: string) {
		super(keyId);
		this.root = root;
	}

	async load(): Promise<boolean> {
		return browser.xnote.loadNote(this.root, this.data.keyId).then(data => {
			if(data) {
				this.data = data;
				return true;
			}
			return false;
		});
	}

	async save(){
		return browser.xnote.saveNote(this.root, this.data.keyId, this.data).then(() => true).catch(() => false);
		// return super.saver(() => browser.xnote.saveNote(this.root, this.data.keyId, this.data).then(() => true).catch(() => false));
	}

	async delete() {
		return browser.xnote.deleteNote(this.root, this.data.keyId).then(() => true).catch(() => false);
		// return super.deleter(() => browser.xnote.deleteNote(this.root, this.data.keyId).then(() => true).catch(() => false));
	}
}
