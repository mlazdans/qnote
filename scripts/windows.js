var _ = browser.i18n.getMessage;

class NoteWindow {
	constructor() {
		this.init();
	}

	init(){
		this.note = undefined;
		this.messageId = undefined;
		this.windowId = undefined;
		this.popping = false;
		this.needSaveOnClose = true;
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

	async close(closer) {
		let isClosed = await closer();

		if(this.onAfterClose){
			await this.onAfterClose(isClosed, this);
		}
	}

	// return true if popped
	async pop(messageId, createNew, pop, popper) {
		if(this.popping){
			qcon.debug("NoteWindow.pop() - already popping");
			return false;
		}

		await this.close();

		return loadNoteForMessage(messageId).then(note => {
			console.log("loadNoteForMessage", this);
			this.note = note;
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
			if(e instanceof MissingKeyIdError){
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
	// TODO: implement updateWindow() for floating panel
	async updateWindow(opt){
		if(this.windowId){
			await browser.qapp.popupClose(this.windowId);
			await this.pop(this.messageId, false, true);
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
