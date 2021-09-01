class XULNoteWindow extends NoteWindow {
	async update(opt){
		return browser.qpopup.update(this.popupId, opt);
	}

	// TODO: fix
	async isFocused() {
		return true;
		// return browser.qpopup.get(this.popupId).then(popupInfo => popupInfo ? popupInfo.focused : false);
	}

	// TODO: fix
	async focus() {
		// return this.update({
		// 	focused: true
		// });
	}

	async close() {
		browser.qpopup.remove(this.popupId);
		super.close();
	}

	async pop() {
		return super.pop(async opt => {
			opt = Object.assign(opt, {
				windowId: this.windowId,
				anchor: Prefs.anchor,
				anchorPlacement: Prefs.anchorPlacement
			});

			return browser.qpopup.create(opt).then(popupInfo => {
				this.popupId = popupInfo.id;
				return popupInfo;
			});
		});
	}
}
