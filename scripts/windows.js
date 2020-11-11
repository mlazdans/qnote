var _ = browser.i18n.getMessage;

class NoteWindow {
	// TODO: generalize
	// TODO: move to notes?
	removeListener(name, listener){
		this.listeners[name].delete(listener);
	}

	addListener(name, listener){
		this.listeners[name].add(listener);
	}

	async execListeners(name, executor){
		return new Promise(resolve => {
			for (let listener of this.listeners[name]) {
				executor(listener);
			}
			resolve();
		});
	}

	constructor() {
		this.init();
		this.listeners = {
			"aftersave": new Set(),
			"afterdelete": new Set(),
			"afterupdate": new Set(),
			"afterclose": new Set()
		}
	}

	init(){
		this.note = undefined;
		this.messageId = undefined;
		this.windowId = undefined;
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

	// We manage saving or delete via close
	async close(closer) {
		let fName = `${this.constructor.name}.close()`;
		let isClosed = await closer();

		await this.execListeners("afterclose", listener => {
			listener(isClosed, this);
		});

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
		let defExecutor = listener => {
			listener(this);
		};

		if(action === 'save') {
			if(this.loadedNoteData){
				if(this.loadedNoteData.text !== noteData.text){
					this.note.ts = Date.now();
				}
			}

			if(this.modified) {
				qcon.debug(`${fName}, note.save()`);
				this.note.save();
				await this.execListeners("aftersave", defExecutor);
				wasUpdated = action;
			} else {
				qcon.debug(`${fName}, not modified`);
			}
		} else if(action === 'delete'){
			qcon.debug(`${fName}, note.delete()`);
			this.note.delete();
			await this.execListeners("afterdelete", defExecutor);
			wasUpdated = action;
		} else {
			qcon.debug(`${fName}, -do nothing-`);
		}

		if(wasUpdated){
			await this.execListeners("afterupdate", listener => {
				listener(wasUpdated, this);
			});
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
				return popper(this.note).then(isPopped => {
					if(isPopped && this.onAfterPop){
						this.onAfterPop(this);
					}

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
					browser.legacy.alert(_("no.message_id.header"));
				}
			} else {
				console.error(e);
			}

			return false;
		});
	}
}

class WebExtensionNoteWindow extends NoteWindow {
	constructor() {
		super();

		browser.windows.onRemoved.addListener(windowId => {
			// We are interested only on current popup
			if(windowId === this.windowId){
				this.close(false);
			}
		});
	}

	async updateWindow(opt){
		if(this.windowId){
			return browser.windows.update(this.windowId, opt);
		}
	}

	async isFocused() {
		return browser.windows.get(this.windowId).then(window => {
			return window.focused;
		});
	}

	async focus() {
		return this.updateWindow({
			focused: true
		});
	}

	async close(closeWindow = true) {
		super.close(() => {
			if(closeWindow && this.windowId){
				return browser.windows.remove(this.windowId).then(() => {
					return true;
				},() => {
					return false;
				});
			} else {
				return false;
			}
		});
	}

	async pop(messageId, createNew = false, pop = false) {
		// if(this.messageId === messageId){
		// 	await this.focus();
		// 	return;
		// }
		let popper = async note => {
			let opt = {
				url: "html/popup.html",
				type: "popup",
				width: note.width || Prefs.width,
				height: note.height || Prefs.height,
				left: note.x || Prefs.x,
				top: note.y || Prefs.y
			};

			return browser.windows.create(opt).then(windowInfo => {
				this.windowId = windowInfo.id;

				return true;
			});
		};

		return super.pop(messageId, createNew, pop, popper);
	}
}

class XULNoteWindow extends NoteWindow {
	async updateWindow(opt){
		if(this.windowId){
			return browser.qapp.popupUpdate(this.windowId, opt);
			// await browser.qapp.popupClose(this.windowId);
			// await this.pop(this.messageId, false, true);
		}
	}

	async isFocused() {
		return browser.qapp.popupIsFocused(this.windowId);
	}

	async focus() {
		if(this.windowId){
			await browser.qapp.popupFocus(this.windowId);
		}
	}

	async close() {
		super.close(() => {
			if(this.windowId){
				return browser.qapp.popupClose(this.windowId);
			} else {
				return false;
			}
		});
	}

	async pop(messageId, createNew = false, pop = false) {
		let popper = async note => {
			let w = await browser.windows.getCurrent();
			note.width = note.width || Prefs.width;
			note.height = note.height || Prefs.height;
			let opt = {
				url: "html/popup3.html",
				width: note.width,
				height: note.height,
				left: note.x || 0,
				top: note.y || 0
			};

			// TODO: move to separate function
			if(!opt.left){
				opt.left = Math.round((w.width - w.left) / 2);
			}

			if(!opt.top){
				opt.top = Math.round((w.height - w.top) / 2);
			}

			opt.left += w.left;
			opt.top += w.top;

			return browser.qapp.popup(opt).then(windowId => {
				this.windowId = windowId;

				return true;
			});
		};

		return super.pop(messageId, createNew, pop, popper);
	}
}
