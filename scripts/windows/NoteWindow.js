var _ = browser.i18n.getMessage;

class NoteWindow extends QEventDispatcher {
	constructor() {
		// afterclose fires after closed but before save/delete/update
		super(["aftersave", "afterdelete", "afterupdate", "afterclose"]);
		this.note = undefined;
		this.messageId = undefined;
		this.popupId = undefined;
		this.popping = false;
		this.needSaveOnClose = true;
	}

	// init(){
	// }

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

	async updateWindow(){
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

	async deleteNote(){
		qcon.debug(`win.deleteNote()`);
		return this.note.delete().then(async isDeleted => {
			await this.fireListeners("afterdelete", this, isDeleted);
			await this.fireListeners("afterupdate", this, isDeleted);
			return isDeleted;
		});
		// this.note.text = '';
		// return this.close();
	}

	async saveNote(){
		let noteData = this.note.get();

		if(this.loadedNoteData){
			if(this.loadedNoteData.text !== noteData.text){
				this.note.ts = Date.now();
			}
		}

		qcon.debug("win.saveNote()");
		if(this.modified) {
			qcon.debug("-saving");
			return this.note.save().then(async isSaved => {
				await this.fireListeners("aftersave", this, isSaved);
				await this.fireListeners("afterupdate", this, isSaved);
				return isSaved;
			});
		} else {
			qcon.debug("-not modified");
		}

		return false;
	}

	async _close(){
		qcon.debug("win._close()");

		// TODO: get rid off needSaveOnClose property
		if(!this.needSaveOnClose){
			qcon.debug("-!needSaveOnClose");
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
			qcon.debug(`-save`);
			return this.saveNote();
		} else if(action === 'delete'){
			qcon.debug(`-delete`);
			return this.deleteNote();
		} else {
			qcon.debug(`-do nothing`);
		}
	}

	// TODO: make a better design
	async close(closer) {
		if(!closer){
			return this._close();
		}

		return closer().then(async isClosed => {
			await this.fireListeners("afterclose", this, isClosed);
			if(isClosed){
				return this._close();
			} else {
				return false;
			}
		});
	}

	// return true if popped
	async pop(messageId, createNew, pop, popper) {
		// TODO: maybe return new Promise and finally() this.popping = false;
		if(this.popping){
			qcon.debug("NoteWindow.pop() - already popping");
			return false;
		}

		await this.close();

		return loadNoteForMessage(messageId).then(note => {
			this.note = note;
			this.loadedNoteData = note.get();
			this.messageId = messageId;

			if((this.note.exists && pop) || createNew){
				this.popping = true;
				// TODO: remove .then()
				return popper(this.note).then(isPopped => {
					return isPopped;
				}).finally(() => {
					this.popping = false;
				});
			}

			return false;
		}).catch(e =>{
			if(e instanceof NoKeyIdError){
				if(createNew){
					console.error(e);
					// TODO: move to app level
					browser.legacy.alert(_("no.message_id.header"));
				}
			} else {
				console.error(e);
			}

			return false;
		});
	}
}
