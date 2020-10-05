var _ = browser.i18n.getMessage;

class NoteWindow {
	constructor() {
		this.init();

		// Click on QNote button
		browser.messageDisplayAction.onClicked.addListener((tab) => {
			browser.messageDisplay.getDisplayedMessage(getTabId(tab)).then(message => {
				this.pop(message.id, true, true).then(()=>{
					this.focus();
				});
			});
		});

		// Click on message
		browser.messageDisplay.onMessageDisplayed.addListener((tab, message) => {
			browser.tabs.get(getTabId(tab)).then((tab)=>{
				// Pop only on main tab. Perhaps need configurable?
				if(tab.mailTab){
					// Pop only if message changed. Avoid popping on same message when, for example, toggle headers pane. Perhaps need configurable?
					if(!this.windowId || (this.messageId !== message.id)){
						this.pop(message.id, false, Prefs.showOnSelect);
					}
				}
			});
		});
	}

	init(){
		this.note = undefined;
		this.messageId = undefined;
		this.windowId = undefined;
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
	}

	async pop() {
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
	}

	async pop(messageId, createNew = false, pop = false) {
		if(this.popping){
			return;
		}

		if(this.messageId === messageId){
			await this.focus();
			return;
		}

		await this.close();

		this.popping = true;

		var note = await createNoteForMessage(messageId);
		var data = await note.load();

		await updateMessageDisplayIcon(data?true:false);

		if((data && pop) || createNew){
			let opt = {
				url: "html/popup.html",
				type: "popup",
				width: note.width || Prefs.width,
				height: note.height || Prefs.height,
				left: note.x || Prefs.x,
				top: note.y || Prefs.y
			};

			this.note = note;
			this.messageId = messageId;

			return browser.windows
				.create(opt)
				.then((windowInfo)=>{
					this.windowId = windowInfo.id;

					return true;
				}).finally(()=>{
					this.popping = false;
				});
		} else {
			this.popping = false;
		}
	}
}

class XULNoteWindow extends NoteWindow {
	async focus() {
		if(this.windowId){
			await browser.qapp.popupFocus(this.windowId);
		}
	}

	async close(closeWindow = true) {
		if(closeWindow && this.windowId){
			await browser.qapp.popupClose(this.windowId);
			//return await browser.windows.remove(this.windowId);
		}

		if(this.needSave && this.note){
			let f = this.note.text ? "save" : "delete"; // Ddelete if no text
			await this[f]();
		} else {
			this.init();
		}
	}

	async pop(messageId, createNew = false, pop = false) {
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

		var data = await note.load();

		await updateMessageDisplayIcon(data?true:false);

		let w = await browser.windows.getCurrent();

		if((data && pop) || createNew){
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

			this.note = note;
			this.messageId = messageId;

			return browser.qapp.popup(opt).then(windowId => {
				this.windowId = windowId;

				return true;
			}).finally(()=>{
				this.popping = false;
			});
		} else {
			this.popping = false;
		}
	}
}
