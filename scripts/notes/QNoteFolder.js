class QNoteFolder extends Note {
	constructor(keyId, root) {
		super(keyId);
		this.root = root;
	}

	load(){
		return super.load(async () => {
			let data;

			// Check for XNote
			if(!(data = await browser.qnote.loadNote(this.root, this.keyId))){
				data = await browser.xnote.loadNote(this.root, this.keyId);
			}

			return data;
		});
	}

	save(){
		return super.save(data => browser.qnote.saveNote(this.root, this.keyId, data));
	}

	delete() {
		return super.delete(async () => {
			// Remove XNote, if exists
			await browser.xnote.deleteNote(this.root, this.keyId).catch(e => QDEB&&console.debug(e));

			return browser.qnote.deleteNote(this.root, this.keyId);
		});
	}
}
