var _ = browser.i18n.getMessage;

class NoteWindow extends QEventDispatcher {
	constructor() {
		super(["aftersave","afterdelete","afterupdate","afterclose"]);
		this.init();
	}

	init(){
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

	// We manage saving or delete via close
	async close(closer) {
		let fName = `${this.constructor.name}.close()`;
		let isClosed = await closer();

		await this.fireListeners("afterclose", isClosed, this);
		// await this.execListeners("afterclose", listener => {
		// 	listener(isClosed, this);
		// });

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
			if(windowId === this.popupId){
				this.close(false);
			}
		});
	}

	async updateWindow(opt){
		if(this.popupId){
			return browser.windows.update(this.popupId, opt);
		}
	}

	async isFocused() {
		return browser.windows.get(this.popupId).then(window => {
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
			if(closeWindow && this.popupId){
				return browser.windows.remove(this.popupId).then(() => {
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
				this.popupId = windowInfo.id;

				return true;
			});
		};

		return super.pop(messageId, createNew, pop, popper);
	}
}

class XULNoteWindow extends NoteWindow {
	constructor() {
		super();

		// TODO: need to add some filters to the events

		// Close
		browser.qpopup.onRemoved.addListener(popupId => {
			if(popupId === this.popupId){
				this.close(false);
			}
		});

		// Move around
		browser.qpopup.onMove.addListener(popup => {
			if(popup.id === this.popupId){
				let { top, left } = popup;
				this.note.x = left;
				this.note.y = top;
			}
		});

		// Resize
		browser.qpopup.onResize.addListener(popup => {
			if(popup.id === this.popupId){
				let { width, height } = popup;
				this.note.width = width;
				this.note.height = height;
			}
		});
	}

	async updateWindow(opt){
		if(this.popupId){
			return browser.qpopup.update(this.popupId, opt);
		}
	}

	// let escaper = e => {
	// 	if(e.key === 'Escape'){
	// 		if(wex.CurrentNote.windowId){
	// 			wex.CurrentNote.needSaveOnClose = false;
	// 			wex.CurrentNote.close();
	// 			e.preventDefault();
	// 		}
	// 	}
	// };

	// window.addEventListener("keydown", escaper);

	// n.onClose = () => {
	// 	window.removeEventListener("keydown", escaper);
	// };
	// async popupIsFocused(id){
	// 	if(this.popups.has(id)){
	// 		return this.popups.get(id).isFocused();
	// 	}
	// },
	// async popupFocus(id){
	// 	if(this.popups.has(id)){
	// 		return this.popups.get(id).focus();
	// 	}
	// },

	async isFocused() {
		console.log("isFocused() - implement");
		// return browser.qapp.popupIsFocused(this.windowId);
	}

	async focus() {
		return this.updateWindow({
			focused: true
		});
	}

	async close() {
		super.close(() => {
			if(this.popupId){
				return browser.qpopup.remove(this.popupId).then(() => {
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
		let popper = async note => {
			let w = await browser.windows.get(CurrentWindow.id);
			let opt = {
				windowId: CurrentWindow.id,
				url: "html/popup4.html",
				title: "QNote",
				width: note.width || Prefs.width,
				height: note.height || Prefs.height,
				left: note.x || 0,
				top: note.y || 0
			};

			// Center
			// TODO: preconfigured positions?
			if(!opt.left){
				opt.left = Math.round((w.width - w.left) / 2);
			}

			if(!opt.top){
				opt.top = Math.round((w.height - w.top) / 2);
			}

			opt.left += w.left;
			opt.top += w.top;

			return browser.qpopup.create(opt).then(popupInfo => {
				this.popupId = popupInfo.id;
				return true;
			});
		};

		return super.pop(messageId, createNew, pop, popper);
	}
}
