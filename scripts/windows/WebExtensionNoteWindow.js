class WebExtensionNoteWindow extends NoteWindow {
	constructor(windowId) {
		super(windowId);

		browser.windows.onRemoved.addListener(async windowId => {
			if(windowId === this.popupId){
				await this.silentlyPersistAndClose();
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

	async close() {
		browser.windows.remove(this.popupId);
		super.close();
	}

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

				let adjX = 0;
				let adjY = 0;

				await browser.windows.get(this.windowId).then(Window => {
					adjX = Window.left;
					adjY = Window.top;
				});

				if(opt.left && opt.top){
					await browser.windows.update(windowInfo.id, {
						left: opt.left + adjX,
						top: opt.top + adjY
					});
				}

				return true;
			});
		});
	}
}
