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
		// TODO: some loaders might return null and it fails then
		return loader().then(data => {
			// Convert x -> left, y -> top
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
		for(let k in data){
			this[k] = data[k];
		}

		return data;
	}

	save(saver){
		let fName = `${this.constructor.name}.save()`;
		QDEB&&console.debug(`${fName} - saving...`);

		// Prepare data to save. We do not want all note properties saved
		let data = this.get();

		return saver(data).then(() => {
			this.exists = true;
			QDEB&&console.debug(`${fName} - saved!`);
		}).catch(e => {
			QDEB&&console.debug(`${fName} - failure: ${e.message}`);
			return Promise.reject(e);
		});
	}

	delete(deleter) {
		let fName = `${this.constructor.name}.delete()`;
		QDEB&&console.debug(`${fName} - deleting...`);

		return deleter().then(() => {
			this.exists = false;
			QDEB&&console.debug(`${fName} - deleted!`);
		}).catch(e => {
			QDEB&&console.debug(`${fName} - failure: ${e.message}`);
			return Promise.reject(e);
		});
	}
}
