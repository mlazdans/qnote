class QNote {

	constructor(keyId) {
		this.keyId = keyId;
		this.x;
		this.y;
		this.width = Number.parseInt(Prefs.width);
		this.height = Number.parseInt(Prefs.height);
		this.text = '';
		this.ts;

		this.keyId; // message-id header or another unique id
		this.needSave = true;
	}

	async reset(){
		this.x = undefined;
		this.y = undefined;
		this.width = Prefs.width;
		this.height = Prefs.height;
		this.needSave = true;
		await this.save();
	}

	async load(){
		let store = await browser.storage.local.get([this.keyId]);

		if(!store || !store[this.keyId]){
			return;
		}

		let data = store[this.keyId];

		this.x = data.x;
		this.y = data.y;
		this.width = data.width;
		this.height = data.height;
		this.text = data.text;
		this.ts = data.ts;

		return data;
	}

	async save(){
		var data = {
			x: this.x,
			y: this.y,
			width: this.width,
			height: this.height,
			text: this.text,
			ts: this.ts ? this.ts : Date.now()
		};

		try {
			await browser.storage.local.set({
				[this.keyId]: data
			});
			return data;
		} catch (e) {
			console.error(e);
			return false;
		}
	}

	async delete() {
		await browser.storage.local.remove(this.keyId)
	}
}
