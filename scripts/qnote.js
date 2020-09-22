class QNote extends Note {
	constructor(keyId) {
		super(keyId);
	}

	async load(){
		return browser.qnote.loadNote(this.keyId).then((note)=>{
			this.reset(note);
			return note;
		});
	}

	async save(){
		var data = super.save();

		return browser.qnote.saveNote(this.keyId, data).then(()=>{
			return data;
		});
	}

	async delete() {
		return browser.qnote.deleteNote(this.keyId).then(()=>{
			return true;
		});
	}
}
