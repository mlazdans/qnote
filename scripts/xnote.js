class XNote extends Note {
	constructor(keyId, root) {
		super(keyId);
		this.root = root;
	}

	async load(){
		return browser.xnote.loadNote(this.root, this.keyId + '.xnote').then((note)=>{
			this.reset(note);
			return note;
		});
	}

	async save(){
		var data = super.save();

		return browser.xnote.saveNote(this.root, this.keyId + '.xnote', data).then(()=>{
			return data;
		});
	}

	async delete() {
		return browser.xnote.deleteNote(this.root, this.keyId + '.xnote').then(()=>{
			return true;
		});
	}
}
