import { DefaultNote, NoteData } from './Note.mjs';

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
