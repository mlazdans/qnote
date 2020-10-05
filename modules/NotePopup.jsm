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
		// browserStyle,
		// fixedWidth,
		// blockParser
	) {
		PopupCounter++;
		//let id = "qnote-window-panel-" + PopupCounter;
		let id = "qnote-window-panel";
		let window = Services.wm.getMostRecentWindow("mail:3pane");
		let document = window.document;
		let windowId = makeWidgetId(id);

		//let panel = document.getElementById(windowId);

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

		this.windowId = windowId;

		var self = this;

		var mDown = {};

		mDown.titleText = (e) => {
			var el = e.target;
			var popup = self.viewNode;
			var realpopup = e.target.ownerDocument.getElementById('popup');
			var startX = e.screenX;
			var startY = e.screenY	;
			var startLeft = popup.screenX;
			var startTop = popup.screenY;

			el.style.cursor = 'move';

			var mover = (e) => {
				self.viewNode.moveTo(e.screenX - startX + startLeft, e.screenY - startY + startTop);
				return {
					x: e.screenX - startX + startLeft - window.screenX,
					y: e.screenY - startY + startTop - window.screenY
				}
			};

			var handleDragEnd = (e) => {
				window.removeEventListener("mousemove", mover);
				window.removeEventListener("mouseup", handleDragEnd);
				var pos = mover(e);
				realpopup.style.opacity = '1';
				el.style.cursor = '';
				if(self.onMove){
					self.onMove(pos, e);
				}
			}

			window.addEventListener("mouseup", handleDragEnd);
			window.addEventListener("mousemove", mover);

			realpopup.style.opacity = '0.4';
		};

		mDown.resizeButton = (e) => {
			var popup = e.target.ownerDocument.getElementById('popup');
			var startX = e.screenX;
			var startY = e.screenY;
			var startW = popup.offsetWidth;
			var startH = popup.offsetHeight;

			var rectLimit = {
				maxWidth: 800,
				maxHeight: 600,
				minWidth: 160,
				minHeight: 120
			};

			var resizer = (e) => {
				var w = startW + e.screenX - startX;
				var h = startH + e.screenY - startY;

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

			var handleDragEnd = (e) => {
				window.removeEventListener("mousemove", resizer);
				window.removeEventListener("mouseup", handleDragEnd);
				var pos = resizer(e);
				popup.style.opacity = '1';

				if(self.onResize){
					self.onResize(pos, e);
				}
			}

			window.addEventListener("mouseup", handleDragEnd);
			window.addEventListener("mousemove", resizer);

			popup.style.opacity = '0.4';
		};

		var handleDragStart = (e) => {
			if(mDown[e.target.id]){
				mDown[e.target.id](e);
			}
		}

		panel.addEventListener('mousedown', handleDragStart, false);

		if(panel.adjustArrowPosition === undefined){
			panel.adjustArrowPosition = () => {
			};
		}

		this.shown = false;
	}

	close() {
		this.destroy();
	}
}
