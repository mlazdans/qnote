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
		// panel.setAttribute("class", "browser-extension-panel panel-no-padding");
		panel.setAttribute("type", "arrow");
		// panel.setAttribute("role", "group");

		document.getElementById("mainPopupSet").appendChild(panel);

		let popupURL = extension.getURL("html/xulpopup.html");
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

	moveTo(x, y){
		this.panel.moveTo(x, y);
	}

	// TODO: broken
	// sizeTo(width, height){
	// 	let popup = this.popupEl;

	// 	// This seems to set rather size limits?
	// 	//this.panel.sizeTo(width, height);

	// 	popup.style.width = width + 'px';
	// 	popup.style.height = height + 'px';
	// }

	// TODO: fix
	focus(){
	}

	close() {
		this.destroy();

		if(this.panel){
			this.panel.remove();
		}

		if(this.onClose){
			this.onClose();
		}

		this.shown = false;
	}

	// box = { top, left, width, height }
	_center(innerBox, outerBox, absolute = true){
		let retBox = {};

		let iWidth = innerBox.width||0;
		let iHeight = innerBox.height||0;
		let oWidth = outerBox.width||0;
		let oHeight = outerBox.height||0;

		retBox.left = Math.round((oWidth - iWidth) / 2);
		retBox.top = Math.round((oHeight - iHeight) / 2);

		if(absolute) {
			retBox.left += outerBox.left||0;
			retBox.top += outerBox.top||0;
		}

		return retBox;
	}

	pop(){
		let self = this;
		let { left, top, width, height, anchor, anchorPlacement } = this.options;
		let window = self.window;

		return new Promise(resolve => {
			let elements = {
				window: "",
				threadpane: "threadContentArea",
				message: "messagepane",
			};

			if((left === null) && (top === null)){
				let aEl;
				let adjX = 0;
				let adjY = 0;

				if(anchor && elements[anchor]){
					aEl = window.document.getElementById(elements[anchor]);
				}

				// Fall back to window in case referring element is not visible
				if(!aEl || !aEl.clientWidth || !aEl.clientHeight){
					aEl = window.document.querySelector("#messengerWindow");
				}

				let wBox = {
					top: aEl.screenY,
					left: aEl.screenX,
					width: aEl.clientWidth,
					height: aEl.clientHeight
				};

				if(anchorPlacement === 'center'){
					let adjBox = this._center(self.options, wBox, false);
					adjX = adjBox.left;
					adjY = adjBox.top;
				} else if(anchorPlacement.startsWith("topcenter") || anchorPlacement.startsWith("bottomcenter")){
					adjX = (width / 2) * (- 1);
				} else if(anchorPlacement.startsWith("rightcenter") || anchorPlacement.startsWith("leftcenter")){
					adjY = (height / 2) * (- 1);
				}
				self.panel.openPopup(aEl, anchorPlacement, adjX, adjY);
			} else {
				self.panel.openPopup(null, "after_start", left, top);
				self.panel.moveTo(left, top);
			}

			this.shown = true;

			resolve(true);
		});
	}
}
