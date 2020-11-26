class QNote extends Note {
	constructor(keyId) {
		super(keyId);
	}

	load(){
		return super.load(() => browser.storage.local.get(this.keyId).then(store => {
			if(!store || !store[this.keyId]){
				return null;
			}

			return store[this.keyId];
		}));
	}

	save(){
		return super.save(data => browser.storage.local.set({
			[this.keyId]: data
		}));
	}

	delete() {
		return super.delete(() => browser.storage.local.remove(this.keyId));
	}
}
