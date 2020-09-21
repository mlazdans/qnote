class Note {
	constructor(keyId) {
		this.keyId = keyId; // message-id header or another unique id
		this.x;
		this.y;
		this.width;
		this.height;
		this.text = '';
		this.ts;
	}

	reset(data){
		for(let k of Object.keys(data)){
			this[k] = data[k];
		}

		return data;
	}

	save(){
		return {
			x: this.x,
			y: this.y,
			width: this.width,
			height: this.height,
			text: this.text,
			ts: Date.now()
		};
	}
}
