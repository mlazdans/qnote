var EXPORTED_SYMBOLS = ["NotePopup"];

const { BasePopup } = ChromeUtils.import("resource:///modules/ExtensionPopups.jsm");
const { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var { makeWidgetId } = ExtensionCommon;

var PopupCounter = 0;
class NotePopup extends BasePopup {
	constructor(
		popupURL,
		window
		// browserStyle,
		// fixedWidth,
		// blockParser
	) {
		PopupCounter++;
		//let id = "qnote-window-panel-" + PopupCounter;
		let id = "qnote-window-panel";
		let document = window.document;
		let windowId = makeWidgetId(id);

		let panel = document.createXULElement("panel");
		panel.setAttribute("id", windowId);
		//panel.setAttribute("class", "mail-extension-panel panel-no-padding");
		panel.setAttribute("noautohide", true);
		//panel.setAttribute("type", "arrow");
		//panel.setAttribute("role", "group");
		document.getElementById("mainPopupSet").appendChild(panel);

		//let popupURL = extension.getURL("html/popup3.html");
		let browserStyle = false;
		let fixedWidth = false;
		let blockParser = false;

		super(extension, panel, popupURL, browserStyle, fixedWidth, blockParser);

		this.contentWindow = this.browser.contentWindow;
		this.windowId = windowId;
		this.window = window;
		//console.log("Note", this);
		this.attachEvents();

		if(this.panel.adjustArrowPosition === undefined){
			this.panel.adjustArrowPosition = () => {
			};
		}

		this.shown = false;
	}

	attachEvents(){
		let self = this;
		let window = this.window;
		let contentWindow = this.contentWindow;
		let panel = this.panel;
		let mDown = {};

		mDown.titleText = e => {
			let popup = contentWindow.document.getElementById('popup');
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

		mDown.resizeButton = (e) => {
			let popup = contentWindow.document.getElementById('popup');
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

		let handleDragStart = e => {
			if(mDown[e.target.id]){
				mDown[e.target.id](e);
			}
		}

		this.panel.addEventListener('mousedown', handleDragStart, false);
	}

	moveTo(x, y){
		this.panel.moveTo(x, y);
	}

	sizeTo(width, height){
		let document = this.contentWindow.document;
		let popup = document.getElementById('popup');

		// This seems to set rather size limits
		//this.panel.sizeTo(width, height);

		popup.style.width = width + 'px';
		popup.style.height = height + 'px';
	}

	isFocused(){
		let document = this.contentWindow.document;
		let YTextE = document.getElementById('qnote-text');

		return document.activeElement === YTextE;
	}

	focus(){
		let document = this.contentWindow.document;
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
