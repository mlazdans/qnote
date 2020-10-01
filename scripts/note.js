class Note {
	constructor(keyId) {
		this.keyId = keyId; // message-id header or another unique id
		this.x;
		this.y;
		this.width;
		this.height;
		this.text = '';
		this.ts;
		this.loadedNote;
	}

	load(data){
		return this.loadedNote = this.reset(data);
	}

	reset(data){
		for(let k of Object.keys(data)){
			this[k] = data[k];
		}

		return data;
	}

	save(){
		let data = {
			x: this.x,
			y: this.y,
			width: this.width,
			height: this.height,
			text: this.text,
			ts: this.ts || Date.now()
		};

		if(this.loadedNote){
			if(this.loadedNote.text !== this.text){
				data.ts = Date.now();
			}
		}

		return data;
	}
}
