class QNote {

	constructor(keyId) {
		this.keyId = keyId; // message-id header or another unique id
		this.x;
		this.y;
		this.width;
		this.height;
		this.text = '';
		this.ts;
		this.needSave = true;
	}

	reset(data){
		for(let k of Object.keys(data)){
			this[k] = data[k];
		}
	}

	async load(){
		return browser.storage.local.get([this.keyId]).then((store)=>{
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
		});
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
