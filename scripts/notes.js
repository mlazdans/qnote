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

class QNote extends Note {
	constructor(keyId) {
		super(keyId);
		this.origin = "QNote";
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

class XNote extends Note {
	constructor(keyId, root) {
		super(keyId);
		this.root = root;
		this.origin = "XNote";
	}

	load(){
		return super.load(() => {
			return browser.xnote.loadNote(this.root, this.keyId);
		});
	}

	save(){
		return super.save(data => {
			return browser.xnote.saveNote(this.root, this.keyId, data);
		});
	}

	delete() {
		return super.delete(() => {
			return browser.xnote.deleteNote(this.root, this.keyId).then(()=>{
				return true;
			});
		});
	}
}

class QNoteFolder extends Note {
	constructor(keyId, root) {
		super(keyId);
		this.root = root;
		this.origin = "QNoteFolder";
	}

	load(){
		return super.load(async () => {
			let data;

			// Check for legacy XNote
			if(data = await browser.qnote.loadNote(this.root, this.keyId)){
				this.origin = "QNoteFolder:QNote";
			} else if(data = await browser.xnote.loadNote(this.root, this.keyId)){
				this.origin = "QNoteFolder:XNote";
			}

			return data;
		});
	}

	save(){
		return super.save(data => {
			return browser.qnote.saveNote(this.root, this.keyId, data);
		});
	}

	delete() {
		return super.delete(async () => {
			// Remove XNote, if exists
			await browser.xnote.deleteNote(this.root, this.keyId);

			return browser.qnote.deleteNote(this.root, this.keyId).then(()=>{
				return true;
			});
		});
	}
}
