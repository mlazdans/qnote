class Note {
	constructor(keyId) {
		this.keyId = keyId; // message-id header or another unique id
		this.exists = false;

		// Note properties
		this.left;
		this.top;
		this.width;
		this.height;
		this.text = '';
		this.ts;
	}

	load(loader) {
		return loader().then(data => {
			// Convert legacy x -> left, y -> top
			if(data.left === undefined && data.x !== undefined){
				data.left = data.x;
				delete data.x;
			}

			if(data.top === undefined && data.y !== undefined){
				data.top = data.y;
				delete data.y;
			}

			this.set(data);
			this.exists = !!data;

			return this.get();
		});
	}

	get(){
		return {
			left: this.left,
			top: this.top,
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
				QDEB&&console.debug("note.save() - saved");
			} else {
				QDEB&&console.debug("note.save() - failure");
			}
			return isSaved;
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
