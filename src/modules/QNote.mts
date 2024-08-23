import { DefaultNote } from './Note.mjs';

export class QNote extends DefaultNote {
	constructor(keyId: string) {
		super(keyId);
	}

	async load(): Promise<boolean> {
		return browser.storage.local.get(this.data.keyId).then(store => {
			if(store[this.data.keyId]){
				this.data = store[this.data.keyId];
				return true;
			}

			return false;
		});
	}

	async save() {
		return super.saver(() => browser.storage.local.set({
			[this.data.keyId]: this.data
		}).then(() => true).catch(() => false));
	}

	async delete() {
		return super.deleter(() => browser.storage.local.remove(this.data.keyId).then(() => true).catch(() => false));
	}
}
