class XULNoteWindow extends NoteWindow {
	constructor(windowId) {
		super(windowId);

		// TODO: need to add some filters to the events

		// Close
		browser.qpopup.onRemoved.addListener(popupId => {
			if(popupId === this.popupId){
				super.close();
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
		return browser.qpopup.get(this.popupId).then(popupInfo => {
			return popupInfo ? popupInfo.focused : false;
		});
	}

	async focus() {
		return this.update({
			focused: true
		});
	}

	async close() {
		super.close(async () => {
			if(this.popupId){
				return browser.qpopup.remove(this.popupId);
			}
		});
	}

	async pop() {
		return super.pop(async () => {
			let note = this.note;
			let opt = {
				windowId: this.windowId,
				url: "html/popup4.html",
				controlsCSS: '../html/popup4-controls.css',
				title: "QNote",
				width: note.width || Prefs.width,
				height: note.height || Prefs.height,
				left: note.left,
				top: note.top,
				anchor: Prefs.anchor,
				anchorPlacement: Prefs.anchorPlacement,
				anchorIsOutside: Prefs.anchorOutside,
				minWidth: 200,
				minHeight: 125,
				maxWidth: 800,
				maxHeight: 500,
			};

			return browser.qpopup.create(opt).then(popupInfo => {
				this.popupId = popupInfo.id;
				return true;
			});
		});
	}
}
