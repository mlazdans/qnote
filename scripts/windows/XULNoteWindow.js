class XULNoteWindow extends NoteWindow {
	constructor(windowId) {
		super(windowId);

		// TODO: need to add some filters to the events
		browser.qpopup.onControls.addListener(async (action, id, pi) => {
			QDEB&&console.debug("browser.qpopup.onControls()", action, id);
			if(action !== 'click' || pi.id != this.popupId){
				return;
			}

			if(id === 'qpopup-close'){
				await this.silentlyPersistAndClose();
			}

			if(id === 'note-delete'){
				await this.silentlyDeleteAndClose();
			}
		});

		// Move around
		browser.qpopup.onMove.addListener(popup => {
			if(popup.id === this.popupId){
				let { top, left } = popup;
				this.note.left = left;
				this.note.top = top;
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

	async update(opt){
		return browser.qpopup.update(this.popupId, opt);
	}

	async isFocused() {
		return browser.qpopup.get(this.popupId).then(popupInfo => popupInfo ? popupInfo.focused : false);
	}

	async focus() {
		return this.update({
			focused: true
		});
	}

	async close() {
		browser.qpopup.remove(this.popupId);
		super.close();
	}

	async pop() {
		return super.pop(async opt => {
			opt = Object.assign(opt, {
				windowId: this.windowId,
				title: "QNote",
				url: "html/popup4.html",
				controlsCSS: '../html/popup4-controls.css',
				anchor: Prefs.anchor,
				anchorPlacement: Prefs.anchorPlacement,
				minWidth: 200,
				minHeight: 125,
				maxWidth: 800,
				maxHeight: 500
			});

			return browser.qpopup.create(opt).then(popupInfo => {
				this.popupId = popupInfo.id;
				return true;
			});
		});
	}
}
