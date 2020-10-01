class QNote extends Note {
	constructor(keyId) {
		super(keyId);
	}

	async load(){
		return browser.storage.local.get([this.keyId]).then(store => {
			if(!store || !store[this.keyId]){
				return false;
			}

			return super.load(store[this.keyId]);
		});
	}

	async save(){
		var data = super.save();

		return browser.storage.local.set({
			[this.keyId]: data
		}).then(()=>{
			return data;
		});
	}

	async delete() {
		return browser.storage.local.remove(this.keyId).then(()=>{
			return true;
		});
	}
}
