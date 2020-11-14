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
		// if(this.popupId){
			return browser.windows.update(this.popupId, opt);
		// }
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
			// TODO: ugly
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
