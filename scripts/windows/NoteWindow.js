class DirtyStateError extends Error {};
class NoteWindow extends QEventDispatcher {
	constructor(windowId) {
		super(["aftersave", "afterdelete", "afterupdate", "afterclose"]);

		this.note;
		this.popupId;
		this.needSaveOnClose = true;
		this.shown = false;
		this.dirty = false;
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

	async update(){
		console.error("Not implemented");
	}

	async focus() {
		console.error("Not implemented");
	}

	async isFocused() {
		console.error("Not implemented");
	}

	async close(){
		this.shown = false;
		this.fireListeners("afterclose", this);
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
		let fName = `${this.constructor.name}.deleteNote()`;

		QDEB&&console.debug(`${fName} - deleting...`);

		if(await confirmDelete()) {
			this.note.delete().then(async () => {
				QDEB&&console.debug(`${fName} - deleted!`);
				await this.fireListeners("afterdelete", this);
				await this.fireListeners("afterupdate", this, "delete");
			}).catch(e => browser.legacy.alert(_("error.deleting.note"), e.message));
		} else {
			QDEB&&console.debug(`${fName} - canceled!`);
		}
	}

	async saveNote(){
		let fName = `${this.constructor.name}.saveNote()`;
		if(this.needSaveOnClose){
			QDEB&&console.debug(`${fName} - saving...`);
			this.note.save().then(async () => {
				QDEB&&console.debug(`${fName} - saved!`);
				await this.fireListeners("aftersave", this);
				await this.fireListeners("afterupdate", this, "save");
			}).catch(e => browser.legacy.alert(_("error.saving.note"), e.message));
		} else {
			QDEB&&console.debug(`${fName}, needSaveOnClose = false, do nothing`);
		}
	}

	async doNothing(){
		let fName = `${this.constructor.name}.doNothing()`;
		QDEB&&console.debug(`${fName}, doing nothing... Done!`);
		return true;
	}

	async persist(){
		let fName = `${this.constructor.name}.persist()`;
		QDEB&&console.debug(`${fName} - persisting...`);

		let noteData = this.note.get();
		if(this.loadedNoteData){
			if(this.loadedNoteData.text !== noteData.text){
				this.note.ts = Date.now();
			}
		}

		let action = 'doNothing';
		if(this.modified) {
			if(this.note.exists){ // Update, delete
				action = this.note.text ? "saveNote" : "deleteNote"; // delete if no text
			} else {
				if(this.note.text){ // Create new
					action = "saveNote";
				}
			}
		} else {
			QDEB&&console.debug(`${fName} - not modified`, noteData, this.loadedNoteData);
		}

		return this[action]();
	}

	async deleteAndClose(){
		return this.wrapDirty(async () => {
			let fName = `${this.constructor.name}.deleteAndClose()`;
			return this.deleteNote().then(async () => {
				QDEB&&console.debug(`${fName} resulted in: ${status}`);
				this.close();
			});
		}).catch(silentCatcher());
	}

	async persistAndClose(){
		return this.wrapDirty(async () => {
			let fName = `${this.constructor.name}.persistAndClose()`;
			QDEB&&console.debug(`${fName} - closing...`);

			if(!this.shown){
				QDEB&&console.debug(`${fName} - not shown!`);
				return;
			}

			return this.persist().then(() => this.close());
		}).catch(silentCatcher());
	}

	// return true if popped
	async pop(popper) {
		return this.wrapDirty(async () => {
			let fName = `${this.constructor.name}.pop()`;
			QDEB&&console.debug(`${fName} - popping...`);

			if(this.shown){
				QDEB&&console.debug(`${fName} - already popped...`);
				return false;
			}

			return popper().then(isPopped => this.shown = isPopped);
		}).catch(silentCatcher());
	}

	async wrapDirty(action){
		let self = this;
		return new Promise(resolve => {
			if(self.dirty){
				throw new DirtyStateError;
			} else {
				self.dirty = true;
				return resolve(action().finally(() => self.dirty = false));
			}
		});
	}

}
