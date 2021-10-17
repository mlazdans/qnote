class DirtyStateError extends Error {};
class NoteWindow extends QEventDispatcher {
	constructor(windowId) {
		super(["afterclose"]);

		this.note;
		this.popupId;
		this.messageId;
		this.needSaveOnClose = true;
		this.shown = false;
		this.dirty = false;
		this.windowId = windowId;
		this.flags = undefined;
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

	async loadNoteForMessage(id) {
		return loadNoteForMessage(id).then(note => {
			this.note = note;
			this.loadedNoteData = note.get();

			note.addListener("afterupdate", () => {
				if(this.messageId){
					mpUpdateForMessage(this.messageId);
				}
			});

			return note;
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
		this.popupId = undefined;
		this.messageId = undefined;
		this.needSaveOnClose = true;
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
			return this.note.delete().catch(e => browser.legacy.alert(_("error.deleting.note"), e.message));
			// return this.note.delete().then(async () => {
			// 	QDEB&&console.debug(`${fName} - deleted!`);
			// }).catch(e => browser.legacy.alert(_("error.deleting.note"), e.message));
		} else {
			QDEB&&console.debug(`${fName} - canceled!`);
		}
	}

	async saveNote(){
		let fName = `${this.constructor.name}.saveNote()`;
		if(this.needSaveOnClose){
			QDEB&&console.debug(`${fName} - saving...`);
			return this.note.save().catch(e => browser.legacy.alert(_("error.saving.note"), e.message));
			// return this.note.save().then(async () => {
			// 	QDEB&&console.debug(`${fName} - saved!`);
			// 	await this.fireListeners("aftersave", this);
			// 	await this.fireListeners("afterupdate", this, "save");
			// }).catch(e => browser.legacy.alert(_("error.saving.note"), e.message));
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
			QDEB&&console.debug(`${fName} - not modified`);
		}

		return this[action]();
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
		});
	}

	async silentlyPersistAndClose(){
		return this.persistAndClose().catch(silentCatcher());
	}

	async deleteAndClose(){
		return this.wrapDirty(async () => {
			let fName = `${this.constructor.name}.deleteAndClose()`;
			return this.deleteNote().then(async () => {
				QDEB&&console.debug(`${fName} resulted in: ${status}`);
				this.close();
			});
		});
	}

	async silentlyDeleteAndClose(){
		return this.deleteAndClose().catch(silentCatcher());
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

			let note = this.note;

			let opt = {
				width: note.width || Prefs.width,
				height: note.height || Prefs.height,
				left: note.left,
				top: note.top
			};

			if(Prefs.alwaysDefaultPlacement){
				opt.width = Prefs.width;
				opt.height = Prefs.height;
				opt.left = undefined;
				opt.top = undefined;
			}

			return popper(opt).then(isPopped => {
				this.shown = !!isPopped;
				return isPopped;
			});
		});
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
