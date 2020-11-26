class XNote extends Note {
	constructor(keyId, root) {
		super(keyId);
		this.root = root;
	}

	load(){
		return super.load(() => browser.xnote.loadNote(this.root, this.keyId));
	}

	save(){
		return super.save(data => browser.xnote.saveNote(this.root, this.keyId, data));
	}

	delete() {
		return super.delete(() => browser.xnote.deleteNote(this.root, this.keyId));
	}
}
