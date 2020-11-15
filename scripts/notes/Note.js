class Note {
	constructor(keyId) {
		this.keyId = keyId; // message-id header or another unique id
		this.x;
		this.y;
		this.width;
		this.height;
		this.text = '';
		this.ts;
		this.exists = false;
		this.origin = "Note";
	}

	// clone() {
	// 	let cloned = new this.constructor;
	// 	for(let k of Object.keys(this)){
	// 		cloned[k] = this[k];
	// 	}

	// 	return cloned;
	// }

	load(loader) {
		return loader().then(data => {
			this.set(data);
			this.exists = !!data;

			return this.get();
		});
	}

	get(){
		return {
			x: this.x,
			y: this.y,
			width: this.width,
			height: this.height,
			text: this.text,
			ts: this.ts
		};
	}

	set(data){
		for(let k of Object.keys(data)){
			this[k] = data[k];
		}

		return data;
	}

	save(saver){
		// Prepare data to save. We do not want all note properties saved
		let data = this.get();

		return saver(data).then(isSaved => {
			this.exists = isSaved;
			if(isSaved){
				qcon.debug("note.save() - saved");
				return data;
			}

			qcon.debug("note.save() - failure");
			return false;
		});
	}

	delete(deleter) {
		return deleter().then(isDeleted => {
			if(isDeleted) {
				this.exists = false;
			}
			return isDeleted;
		});
	}
}
