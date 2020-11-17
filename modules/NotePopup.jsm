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
		panel.setAttribute("noautofocus", true);
		panel.setAttribute("class", "mail-extension-panel panel-no-padding");
		// panel.setAttribute("type", "arrow");
		// panel.setAttribute("role", "group");

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
		this.shown = false;

		// TB68
		if(this.panel.adjustArrowPosition === undefined){
			this.panel.adjustArrowPosition = () => {
			};
		}
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

	get title(){
		return this.titleTextEl.innerHTML;
	}

	get isFocused(){
		let cae = this.contentDocument.activeElement;

		return cae ? cae.tagName !== 'BODY' : false;
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

	get iframeEl() {
		return this.getFirstElementByClassName("qpopup-contents-frame");
	}

	get iframeWindow() {
		return this.iframeEl.contentWindow;
	}

	get iframeDocument() {
		return this.iframeWindow.document;
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

	focus(){
		this.iframeWindow.focus();
	}

	close() {
		this.destroy();

		if(this.panel){
			this.panel.remove();
			if(this.onClose){
				this.onClose();
			}
		}

		this.shown = false;

		return true;
	}

	pop(){
		let self = this;
		let { left, top, width, height, title } = this.options;

		var initNote = () => {
			// MAYBE: install default .close();
			// closeButton.addEventListener("click", e => {
			// 	console.log("close", e);
			// });

			this.attachEvents();

			this.moveTo(left, top);
			this.sizeTo(width, height);
			this.shown = true;
		};

		return new Promise(function(resolve) {
			let loadListener = (e0) => {
				//self.browser.style.display = "none";

				// We are not interested when about:blank been loaded
				if(e0.target.URL !== self.popupURL){
					return;
				}

				self.contentReady.then((e1, e2) => {
					self.title = title;
					self.contentDocument.addEventListener("focus", e => {
						if(self.onFocus){
							self.onFocus(e);
						}
						self.iframeWindow.focus();
					});

					self.contentDocument.addEventListener("blur", e => {
						if(self.onBlur){
							self.onBlur(e);
						}
					});

					initNote();
					resolve(true);
				});
				// browserLoaded
				// n.contentReady.then(()=>{
				// });
				// n.browserReady.then(()=>{
				// });
			};

			self.browser.addEventListener("DOMContentLoaded", loadListener);

			let anchor = null;

			// TODO: handle relative coords
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
					left: e.screenX - startX + startLeft,
					top: e.screenY - startY + startTop
					// x: e.screenX - startX + startLeft - window.screenX,
					// y: e.screenY - startY + startTop - window.screenY
				}
			};

			let handleDragEnd = e => {
				window.removeEventListener("mousemove", mover);
				window.removeEventListener("mouseup", handleDragEnd);
				popup.style.opacity = '1';
				el.style.cursor = '';
				if(self.onMove){
					self.onMove(mover(e), e);
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
				maxHeight: 500,
				minWidth: 200,
				minHeight: 125
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

			let handleDragEnd = e => {
				window.removeEventListener("mousemove", resizer);
				window.removeEventListener("mouseup", handleDragEnd);
				popup.style.opacity = '1';

				if(self.onResize){
					self.onResize(resizer(e), e);
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

	getFirstElementByTagName(tagName){
		try {
			return this.contentDocument.getElementsByTagName(tagName).item(0);
		} catch (e) {
			console.error(e);
		}
	}
}
