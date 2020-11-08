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
		this.modified = false;
		this.created = false;
		this.origin = "Note";
	}

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
			this.modified = !this.isNotesEqual(this.loadedNote, data);
		} else {
			this.created = true;
		}

		return this.reset(data);
	}
}

class QNote extends Note {
	constructor(keyId) {
		super(keyId);
		this.origin = "QNote";
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
		this.origin = "XNote";
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
		this.origin = "QNoteFolder";
	}

	async load(){
		var note = await browser.qnote.loadNote(this.root, this.keyId);

		// Check for legacy XNote
		if(note){
			this.origin = "QNoteFolder:QNote";
		} else {
			if(note = await browser.xnote.loadNote(this.root, this.keyId)){
				this.origin = "QNoteFolder:XNote";
			}
		}

		if(note) {
			return super.load(note);
		}
	}

	async save(){
		var data = super.save();

		if(this.modified || this.created) {
			return browser.qnote.saveNote(this.root, this.keyId, data).then(()=>{
				return data;
			});
		} else {
			return data;
		}
	}

	async delete() {
		// Remove XNote, if exists
		await browser.xnote.deleteNote(this.root, this.keyId);

		return browser.qnote.deleteNote(this.root, this.keyId).then(()=>{
			return true;
		});
	}
}
