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
		this.exists = false;
		this.modified = false;
		this.created = false;
		this.origin = "Note";
	}

	// clone() {
	// 	let cloned = new this.constructor;
	// 	for(let k of Object.keys(this)){
	// 		cloned[k] = this[k];
	// 	}

	// 	return cloned;
	// }

	isNotesEqual(n1, n2){
		let k1 = Object.keys(n1);
		let k2 = Object.keys(n2);

		if(k1.length != k2.length){
			return false;
		}

		for(let k of k1){
			if(n1[k] !== n2[k]){
				return false;
			}
		}

		return true;
	}

	async load(loader) {
		return loader().then(data => {
			this.loadedNote = this.reset(data);
			this.exists = !!data;

			return data;
		});
	}

	reset(data){
		for(let k of Object.keys(data)){
			this[k] = data[k];
		}

		return data;
	}

	async save(saver){
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
			this.modified = !this.isNotesEqual(this.loadedNote, data);
		} else {
			this.created = true;
		}

		this.reset(data);

		if(this.modified || this.created) {
			return saver(data).then(isSaved => {
				this.exists = isSaved;
				if(isSaved){
					console.debug("note.save() - saved");
					return data;
				}

				console.debug("note.save() - failure");
				return false;
			});
		} else {
			console.debug("note.save() - nothing changed, do not save");
			return false;
		}
	}

	async delete(deleter) {
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

	async load(){
		return super.load(async () => {
			return browser.storage.local.get([this.keyId]).then(store => {
				if(!store || !store[this.keyId]){
					return false;
				}

				return store[this.keyId];
			})
		});
	}

	async save(){
		return super.save(data => {
			return browser.storage.local.set({
				[this.keyId]: data
			}).then(() => {
				return true;
			});
		});
	}

	async delete() {
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

	async load(){
		return super.load(async () => {
			return browser.xnote.loadNote(this.root, this.keyId);
		});
	}

	async save(){
		return super.save(data => {
			return browser.xnote.saveNote(this.root, this.keyId, data);
		});
	}

	async delete() {
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

	async load(){
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

	async save(){
		return super.save(data => {
			return browser.qnote.saveNote(this.root, this.keyId, data);
		});
	}

	async delete() {
		return super.delete(async () => {
			// Remove XNote, if exists
			await browser.xnote.deleteNote(this.root, this.keyId);

			return browser.qnote.deleteNote(this.root, this.keyId).then(()=>{
				return true;
			});
		});
	}
}
