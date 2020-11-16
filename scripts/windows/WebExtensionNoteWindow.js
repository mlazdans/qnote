class WebExtensionNoteWindow extends NoteWindow {
	constructor(windowId) {
		super(windowId);

		browser.windows.onRemoved.addListener(windowId => {
			// We are interested only on current popup
			if(windowId === this.popupId){
				this.close(false);
			}
		});
	}

	async update(opt){
		return browser.windows.update(this.popupId, opt);
	}

	async isFocused() {
		return browser.windows.get(this.popupId).then(Window => {
			return Window.focused;
		});
	}

	async focus() {
		return this.update({
			focused: true
		});
	}

	async close(closeWindow = true) {
		super.close(async () => {
			// return new Promise(resolve => {
			// 	if(closeWindow && this.popupId){
			// 		browser.windows.remove(this.popupId).then(() => {
			// 			resolve(true);
			// 		}).catch(e => {
			// 			console.error("Can't close", e);
			// 			resolve(false);
			// 		});
			// 	} else {
			// 		resolve(true);
			// 	}
			// });
			if(closeWindow && this.popupId){
				return browser.windows.remove(this.popupId).then(() => { // API will reject, in case of problem
					return true;
				},() => {
					return false;
				});
			} else {
				return false;
			}
		});
	}

	async pop() {
		return super.pop(async () => {
			let note = this.note;
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
		});
	}
}
