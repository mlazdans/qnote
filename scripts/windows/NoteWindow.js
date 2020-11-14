var _ = browser.i18n.getMessage;

class NoteWindow extends QEventDispatcher {
	constructor() {
		super(["aftersave","afterdelete","afterupdate","afterclose"]);
		this.init();
	}

	init(){
		console.log(this.listeners);
		this.note = undefined;
		this.messageId = undefined;
		this.popupId = undefined;
		this.popping = false;
		this.needSaveOnClose = true;
	}

	// NOTE: probably should generalize
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

	async deleteNote(){
		this.note.text = '';

		return this.close();
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

	// We currently manage saving or delete via close
	// TODO: make a batter design
	async close(closer) {
		let fName = `${this.constructor.name}.close()`;
		let isClosed = closer ? await closer() : true;

		await this.fireListeners("afterclose", isClosed, this);

		if(!isClosed){
			return qcon.debug(`${fName}, -not popped-`);
		}

		if(!this.needSaveOnClose){
			return qcon.debug(`${fName}, !needSaveOnClose`);
		}

		// Probably we'll need this check
		// if(this.note)

		let action;
		if(this.note.exists){ // Update, delete
			action = this.note.text ? "save" : "delete"; // delete if no text
		} else {
			if(this.note.text){ // Create new
				action = "save";
			}
		}

		let wasUpdated;
		let noteData = this.note.get();
		// let defExecutor = listener => {
		// 	listener(this);
		// };

		if(action === 'save') {
			console.log(action);
			if(this.loadedNoteData){
				if(this.loadedNoteData.text !== noteData.text){
					this.note.ts = Date.now();
				}
			}

			if(this.modified) {
				qcon.debug(`${fName}, note.save()`);
				this.note.save();
				//await this.execListeners("aftersave", defExecutor);
				await this.fireListeners("aftersave", this);
				wasUpdated = action;
			} else {
				qcon.debug(`${fName}, not modified`);
			}
		} else if(action === 'delete'){
			qcon.debug(`${fName}, note.delete()`);
			this.note.delete();
			//await this.execListeners("afterdelete", defExecutor);
			await this.fireListeners("afterdelete", this);
			wasUpdated = action;
		} else {
			qcon.debug(`${fName}, -do nothing-`);
		}

		if(wasUpdated){
			await this.fireListeners("afterupdate", wasUpdated, this);
			// await this.execListeners("afterupdate", listener => {
			// 	listener(wasUpdated, this);
			// });
		}
		this.init();
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
