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

class QNote extends Note {
	constructor(keyId) {
		super(keyId);
	}

	async load(){
		return browser.storage.local.get([this.keyId]).then(store => {
			if(!store || !store[this.keyId]){
				return false;
			}

			return super.load(store[this.keyId]);
		});
	}

	async save(){
		var data = super.save();

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

class XNote extends Note {
	constructor(keyId, root) {
		super(keyId);
		this.root = root;
	}

	async load(){
		return browser.xnote.loadNote(this.root, this.keyId).then(note => {
			return super.load(note);
		});
	}

	async save(){
		var data = super.save();

		return browser.xnote.saveNote(this.root, this.keyId, data).then(()=>{
			return data;
		});
	}

	async delete() {
		return browser.xnote.deleteNote(this.root, this.keyId).then(()=>{
			return true;
		});
	}
}

class QNoteFolder extends Note {
	constructor(keyId, root) {
		super(keyId);
		this.root = root;
	}

	async load(){
		var note = await browser.qnote.loadNote(this.root, this.keyId);

		// Check for legacy XNote
		if(!note){
			note = await browser.xnote.loadNote(this.root, this.keyId);
		}

		if(note) {
			return super.load(note);
		}
	}

	async save(){
		var data = super.save();

		return browser.qnote.saveNote(this.root, this.keyId, data).then(()=>{
			return data;
		});
	}

	async delete() {
		// Remove XNote, if exists
		await browser.xnote.deleteNote(this.root, this.keyId);

		return browser.qnote.deleteNote(this.root, this.keyId).then(()=>{
			return true;
		});
	}
}
