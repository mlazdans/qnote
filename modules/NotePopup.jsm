var EXPORTED_SYMBOLS = ["NotePopup"];

const { BasePopup } = ChromeUtils.import("resource:///modules/ExtensionPopups.jsm");
const { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
const { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");

var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var PopupCounter = 0;

class NotePopup extends BasePopup {
	constructor(options) {
		let domId = "qnote-window-panel-" + (++PopupCounter);

		let { window } = options;
		let document = window.document;

		let panel = document.createXULElement("panel");
		panel.setAttribute("id", domId);
		panel.setAttribute("noautohide", true);
		document.getElementById("mainPopupSet").appendChild(panel);

		let popupURL = extension.getURL("html/qpopup.html");
		let browserStyle = false;
		let fixedWidth = false;
		let blockParser = false;

		super(extension, panel, popupURL, browserStyle, fixedWidth, blockParser);

		this.popupURL = popupURL;
		this.options = options;
		this.domId = domId;
		this.window = window;

		if(this.panel.adjustArrowPosition === undefined){
			this.panel.adjustArrowPosition = () => {
			};
		}

		this.shown = false;
	}

	/**
	 * @param {string} contents
	 */
	// set contents(contents) {
	// 	this.clontentsEl.innerHTML = contents;
	// }

	/**
	 * @param {string} title
	 */
	set title(title){
		this.titleTextEl.innerHTML = title;
	}

	get contentDocument(){
		try {
			return this.browser.contentWindow.document;
		} catch (e) {
			console.error(e);
		}
	}

	get popupEl(){
		return this.getFirstElementByClassName("qpopup");
	}

	get titleEl(){
		return this.getFirstElementByClassName("qpopup-title");
	}

	get titleTextEl(){
		return this.getFirstElementByClassName("qpopup-title-text");
	}

	get closeEl(){
		return this.getFirstElementByClassName("qpopup-title-closebutton");
	}

	// get clontentsEl(){
	// 	return this.getFirstElementByClassName("qpopup-contents");
	// }

	get resizeEl(){
		return this.getFirstElementByClassName("qpopup-controls-resize");
	}

	get customControlsEl(){
		return this.getFirstElementByClassName("qpopup-custom-controls");
	}

	get contentsFrame() {
		return this.getFirstElementByClassName("qpopup-contents-frame");
	}

	moveTo(x, y){
		this.panel.moveTo(x, y);
	}

	sizeTo(width, height){
		let popup = this.popupEl;

		// This seems to set rather size limits?
		//this.panel.sizeTo(width, height);

		popup.style.width = width + 'px';
		popup.style.height = height + 'px';
	}

	isFocused(){
		// let document = this.browser.contentWindow.document;
		// let YTextE = document.getElementById('qnote-text');

		// return document.activeElement === YTextE;
	}

	focus(){
		// let document = this.browser.contentWindow.document;
		// let YTextE = document.getElementById('qnote-text');

		// if(YTextE){
		// 	YTextE.focus();
		// }
	}

	close() {
		this.destroy();

		if(this.panel){
			this.panel.remove();
		}

		// if(this.onClose){
		// 	this.onClose();
		// }
		return true;
	}

	pop(){
		let self = this;
		let { left, top, width, height } = this.options;

		var initNote = () => {
			// var closeButton = this.closeEl;
			//var deleteButton = document.getElementById('deleteButton');

			// closeButton.addEventListener("click", e => {
			// 	console.log("close", e);
			// });

			// deleteButton.addEventListener("click", e => {
			// 	wex.CurrentNote.deleteNote();
			// });

			this.attachEvents();

			this.moveTo(left, top);
			this.sizeTo(width, height);
			// // TODO: code duplication!!
			// try {
			// 	let focus = wex.Prefs.focusOnDisplay || !wex.CurrentNote.note.text;
			// 	if(!focus && window.gFolderDisplay && window.gFolderDisplay.tree){
			// 		window.gFolderDisplay.tree.focus();
			// 	}
			// } catch(e) {
			// 	console.error(e);
			// }
		};

		return new Promise(function(resolve) {
			self.browser.addEventListener("DOMContentLoaded", () => {
				// We are not interested when about:blank been loaded
				if(self.contentDocument.URL !== self.popupURL){
					return;
				}

				self.browserLoaded.then(() => {
					initNote();
					resolve(true);
				});
				// n.contentReady.then(()=>{
				// });
				// n.browserReady.then(()=>{
				// });
			});

			let anchor = null;

			if(left && top) {
				self.panel.openPopup(anchor, "topleft", left, top);
			} else {
				self.panel.openPopup(anchor, "topleft");
			}
		});
	}

	attachEvents(){
		let self = this;
		let window = this.window;
		let panel = this.panel;
		let mDown = new WeakMap();

		let titleTextEl = this.titleTextEl;
		let titleEl = this.titleEl;
		let resizeEl = this.resizeEl;

		let tDrag = e => {
			let popup = self.popupEl;
			let el = e.target;
			let startX = e.screenX;
			let startY = e.screenY	;
			let startLeft = panel.screenX;
			let startTop = panel.screenY;

			el.style.cursor = 'move';

			let mover = e => {
				panel.moveTo(e.screenX - startX + startLeft, e.screenY - startY + startTop);
				return {
					x: e.screenX - startX + startLeft - window.screenX,
					y: e.screenY - startY + startTop - window.screenY
				}
			};

			let handleDragEnd = e => {
				window.removeEventListener("mousemove", mover);
				window.removeEventListener("mouseup", handleDragEnd);
				let pos = mover(e);
				popup.style.opacity = '1';
				el.style.cursor = '';
				if(self.onMove){
					self.onMove(pos, e);
				}
			}

			window.addEventListener("mouseup", handleDragEnd);
			window.addEventListener("mousemove", mover);

			popup.style.opacity = '0.4';
		};

		let tResize =  e => {
			let popup = self.popupEl;
			let startX = e.screenX;
			let startY = e.screenY;
			let startW = popup.offsetWidth;
			let startH = popup.offsetHeight;

			// TODO: move to separate function
			let rectLimit = {
				maxWidth: 800,
				maxHeight: 600,
				minWidth: 160,
				minHeight: 120
			};

			let resizer = (e) => {
				let w = startW + e.screenX - startX;
				let h = startH + e.screenY - startY;

				w = w > rectLimit.maxWidth ? rectLimit.maxWidth : w;
				w = w < rectLimit.minWidth ? rectLimit.minWidth : w;

				h = h > rectLimit.maxHeight ? rectLimit.maxHeight : h;
				h = h < rectLimit.minHeight ? rectLimit.minHeight : h;

				popup.style.width = w + 'px';
				popup.style.height = h + 'px';

				return {
					width: w,
					height: h
				}
			};

			let handleDragEnd = (e) => {
				window.removeEventListener("mousemove", resizer);
				window.removeEventListener("mouseup", handleDragEnd);
				let pos = resizer(e);
				popup.style.opacity = '1';

				if(self.onResize){
					self.onResize(pos, e);
				}
			}

			window.addEventListener("mouseup", handleDragEnd);
			window.addEventListener("mousemove", resizer);

			popup.style.opacity = '0.4';
		};

		mDown.set(titleEl, tDrag);
		mDown.set(titleTextEl, tDrag);
		mDown.set(resizeEl, tResize);

		let handleDragStart = e => {
			if(mDown.has(e.target)){
				mDown.get(e.target)(e);
			}
		}

		this.panel.addEventListener('mousedown', handleDragStart, false);
	}

	addControl(domEl){
		this.customControlsEl.appendChild(domEl);
	}

	getFirstElementByClassName(className){
		try {
			return this.contentDocument.querySelectorAll('.' + className).item(0);
		} catch (e) {
			console.error(e);
		}
	}
}
