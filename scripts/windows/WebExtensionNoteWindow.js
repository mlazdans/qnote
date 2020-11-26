class WebExtensionNoteWindow extends NoteWindow {
	constructor(windowId) {
		super(windowId);

		browser.windows.onRemoved.addListener(windowId => {
			if(windowId === this.popupId){
				this.close(false);
			}
		});
	}

	async update(opt){
		return browser.windows.update(this.popupId, opt);
	}

	async isFocused() {
		return browser.windows.get(this.popupId).then(Window => Window.focused);
	}

	async focus() {
		return this.update({
			focused: true
		});
	}

	async close(closeWindow = true) {
		return super.close(async () => closeWindow && browser.windows.remove(this.popupId));
	}

	// TODO: adjust position to match relative positions XULWindow using
	async pop() {
		return super.pop(async () => {
			let note = this.note;
			let opt = {
				url: "html/popup.html",
				type: "popup",
				width: note.width || Prefs.width,
				height: note.height || Prefs.height,
				left: note.left || 0,
				top: note.top || 0
			};

			return browser.windows.create(opt).then(async windowInfo => {
				this.popupId = windowInfo.id;

				if(opt.left && opt.top){
					await browser.windows.update(windowInfo.id, {
						left: opt.left,
						top: opt.top
					});
				}

				return true;
			});
		});
	}
}
