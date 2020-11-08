var _ = browser.i18n.getMessage;

class NoteWindow {
	constructor() {
		this.init();
	}

	init(){
		this.note = undefined;
		this.messageId = undefined;
		this.windowId = undefined;
		this.tabId = undefined;
		this.popping = false;
		this.needSave = true;
	}

	async save(){
		if(await this.note.save()){
			this.onAfterSave(this);
			return true;
		} else {
			return false;
		}

	}

	async delete(){
		if(await this.note.delete()){
			this.onAfterDelete(this);
			return true;
		} else {
			return false;
		}
	}

	async updateWindow(){
	}

	async focus() {
	}

	async close() {
		// if(this.windowId){
		// 	focusCurrentWindow();
		// }
	}

	async pop(messageId, createNew, pop, popper) {
		if(this.popping){
			return;
		}

		await this.close();

		var note = await createNoteForMessage(messageId);

		if(!note.keyId){
			if(createNew){
				await browser.legacy.alert(_("no.message_id.header"));
			}
			return;
		}

		this.popping = true;
		this.note = note;
		this.messageId = messageId;

		var data = await note.load();

		await updateMessageDisplayIcon(data?true:false);
		await updateNoteMessage(data ? note : undefined);

		if((data && pop) || createNew){
			return popper(note).finally(data => {
				this.popping = false;
				return data;
			});
		} else {
			this.popping = false;
		}
	}
}

class WebExtensionNoteWindow extends NoteWindow {
	constructor() {
		super();

		browser.windows.onRemoved.addListener(async (windowId)=>{
			// We are interested only on current popup
			if(windowId !== this.windowId){
				return;
			}

			this.close(false);
		});
	}

	async updateWindow(opt){
		if(this.windowId){
			return browser.windows.update(this.windowId, opt);
		}
	}

	async focus() {
		return this.updateWindow({
			focused: true
		});
	}

	async close(closeWindow = true) {
		if(closeWindow && this.windowId){
			return await browser.windows.remove(this.windowId);
		}

		if(this.needSave && this.note){
			let f = this.note.text ? "save" : "delete"; // Ddelete if no text
			await this[f]();
		} else {
			this.init();
			this.focusPopup = undefined;
		}
		super.close();
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

	async focus() {
		if(this.windowId){
			await browser.qapp.popupFocus(this.windowId);
		}
	}

	async close(closeWindow = true) {
		if(closeWindow && this.windowId){
			await browser.qapp.popupClose(this.windowId);
		}

		if(this.needSave && this.note){
			let f = this.note.text ? "save" : "delete"; // Ddelete if no text
			await this[f]();
		} else {
			this.init();
		}
		super.close();
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
