var EXPORTED_SYMBOLS = ["NotePopup"];

const { BasePopup } = ChromeUtils.import("resource:///modules/ExtensionPopups.jsm");
const { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var { makeWidgetId } = ExtensionCommon;

var PopupCounter = 0;
class NotePopup extends BasePopup {
	constructor(options) {
		let id = "qnote-window-panel-" + (++PopupCounter);

		let { window } = options;
		let document = window.document;
		let popupId = makeWidgetId(id);

		let panel = document.createXULElement("panel");
		panel.setAttribute("id", popupId);
		panel.setAttribute("noautohide", true);
		document.getElementById("mainPopupSet").appendChild(panel);

		let popupURL = extension.getURL("html/qpopup.html");
		let browserStyle = false;
		let fixedWidth = false;
		let blockParser = false;

		super(extension, panel, popupURL, browserStyle, fixedWidth, blockParser);

		this.popupURL = popupURL;
		this.options = options;
		this.popupId = popupId;
		this.window = window;

		if(this.panel.adjustArrowPosition === undefined){
			this.panel.adjustArrowPosition = () => {
			};
		}

		this.shown = false;
	}

	getFirstElementByClassName(className){
		try {
			var document = this.browser.contentWindow.document;
			return document.getElementsByClassName(className).item(0);
		} catch (e) {
			console.error(e);
		}
	}

	getPopupEl(){
		return this.getFirstElementByClassName("qpopup");
	}

	getTitleEl(){
		return this.getFirstElementByClassName("qpopup-title");
	}

	getCloseEl(){
		return this.getFirstElementByClassName("qpopup-title-closebutton");
	}

	getResizeEl(){
		return this.getFirstElementByClassName("qpopup-controls-resize");
	}

	pop(){
		let anchor = null;
		let { left, top, width, height } = this.options;

		var initNote = () => {
			var closeButton = this.getCloseEl();
			//var deleteButton = document.getElementById('deleteButton');

			closeButton.addEventListener("click", e => {
				console.log("close", e);
			});

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

		this.browser.addEventListener("DOMContentLoaded", () => {
			// We are not interested when about:blank been loaded
			if(this.browser.contentWindow.document.URL !== this.popupURL){
				return;
			}

			this.browserLoaded.then(() => {
				initNote();
				//self.popups.set(n.windowId, n);
				//resolve(n.windowId);
			});
			// n.contentReady.then(()=>{
			// });
			// n.browserReady.then(()=>{
			// });
		});

		if(left && top) {
			this.viewNode.openPopup(anchor, "topleft", left, top);
		} else {
			this.viewNode.openPopup(anchor, "topleft");
		}
	}

	attachEvents(){
		let self = this;
		let window = this.window;
		//let contentWindow = this.browser.contentWindow;
		let panel = this.panel; // TODO: panel should be same as this? Test!
		let mDown = new WeakMap();

		let titleEl = this.getTitleEl();
		let resizeEl = this.getResizeEl();

		//mDown.titleText = e => {
		mDown.set(titleEl, e => {
			let popup = self.getPopupEl();
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
		});

		//mDown.resizeButton = (e) => {
		mDown.set(resizeEl, e => {
			let popup = self.getPopupEl();
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
		});

		let handleDragStart = e => {
			if(mDown.has(e.target)){
				mDown.get(e.target)(e);
			}
			// if(mDown[e.target.id]){
			// 	mDown[e.target.id](e);
			// }
		}

		this.panel.addEventListener('mousedown', handleDragStart, false);
	}

	moveTo(x, y){
		this.panel.moveTo(x, y);
	}

	sizeTo(width, height){
		//this.panel.sizeTo(width, height);
		let document = this.browser.contentWindow.document;
		let win = this.browser.contentWindow;
		//let popup = document.getElementById('popup');
		let popup = this.getPopupEl();

		// This seems to set rather size limits
		//this.panel.sizeTo(width, height);

		popup.style.width = width + 'px';
		popup.style.height = height + 'px';
	}

	isFocused(){
		let document = this.browser.contentWindow.document;
		let YTextE = document.getElementById('qnote-text');

		return document.activeElement === YTextE;
	}

	focus(){
		let document = this.browser.contentWindow.document;
		let YTextE = document.getElementById('qnote-text');

		if(YTextE){
			YTextE.focus();
		}
	}

	close() {
		this.destroy();

		if(this.panel){
			this.panel.remove();
		}

		if(this.onClose){
			this.onClose();
		}
	}
}
