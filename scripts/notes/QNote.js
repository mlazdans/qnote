class QNote extends Note {
	constructor(keyId) {
		super(keyId);
	}

	load(){
		return super.load(() => {
			return browser.storage.local.get(this.keyId).then(store => {
				if(!store || !store[this.keyId]){
					return false;
				}

				return store[this.keyId];
			})
		});
	}

	save(){
		return super.save(data => {
			return browser.storage.local.set({
				[this.keyId]: data
			}).then(() => {
				return true;
			});
		});
	}

	delete() {
		return super.delete(() => {
			return browser.storage.local.remove(this.keyId).then(()=>{
				return true;
			});
		});
	}
}
