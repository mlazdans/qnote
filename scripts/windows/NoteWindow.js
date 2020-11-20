class NoteWindow extends QEventDispatcher {
	constructor(windowId) {
		// afterclose fires after closed but before save/delete/update
		super(["aftersave", "afterdelete", "afterupdate", "afterclose"]);

		this.note;
		this.popupId;
		this.needSaveOnClose = true;
		this.shown = false;
		this.windowId = windowId;
	}

	isEqual(n1, n2){
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

	async update(){
		console.error("Not implemented");
	}

	async focus() {
		console.error("Not implemented");
	}

	async isFocused() {
		console.error("Not implemented");
	}

	get modified() {
		return !this.isEqual(this.loadedNoteData, this.note.get());
	}

	async reset(){
		let opt = {
			left: undefined,
			top: undefined,
			width: Prefs.width,
			height: Prefs.height
		};

		this.note.set(opt);

		return this.update(opt);
	}

	async deleteNote(){
		QDEB&&console.debug(`win.deleteNote()`);
		return this.note.delete().then(async isDeleted => {
			await this.fireListeners("afterdelete", this, isDeleted);
			await this.fireListeners("afterupdate", this, "delete", isDeleted);
			return isDeleted;
		});
	}

	async saveNote(){
		let fName = `${this.constructor.name}.saveNote()`;
		let noteData = this.note.get();

		if(this.loadedNoteData){
			if(this.loadedNoteData.text !== noteData.text){
				this.note.ts = Date.now();
			}
		}

		if(this.modified) {
			QDEB&&console.debug(`${fName} - saving...`);
			return this.note.save().then(async isSaved => {
				await this.fireListeners("aftersave", this, isSaved);
				await this.fireListeners("afterupdate", this, "save", isSaved);
				return isSaved;
			});
		} else {
			QDEB&&console.debug(`${fName} - not modified`);
		}

		return false;
	}

	async _close(){
		let fName = `${this.constructor.name}._close()`;

		this.shown = false;

		if(!this.needSaveOnClose){
			QDEB&&console.debug(`${fName}, needSaveOnClose = false, do nothing`);
			return false;
		}

		let action;

		if(this.note.exists){ // Update, delete
			action = this.note.text ? "save" : "delete"; // delete if no text
		} else {
			if(this.note.text){ // Create new
				action = "save";
			}
		}

		if(action === 'save') {
			return this.saveNote();
		} else if(action === 'delete'){
			return this.deleteNote();
		} else {
			QDEB&&console.debug(`${fName}, do nothing`);
		}
	}

	async close(closer) {
		if(!this.shown){
			return false;
		}

		this.shown = false;

		if(!closer){
			return this._close();
		}

		return closer().then(async isClosed => {
			await this.fireListeners("afterclose", this, isClosed);
			return this._close();
		});
	}

	async loadNote(keyId) {
		return loadNote(keyId).then(note => {
			this.note = note;
			this.loadedNoteData = note.get();

			return note;
		});
	}

	async loadNoteForMessage(messageId) {
		return getMessageKeyId(messageId).then(keyId => {
			return this.loadNote(keyId);
		});
	}

	// return true if popped
	async pop(popper) {
		return popper().then(isPopped => {
			return this.shown = isPopped;
		});
	}
}
