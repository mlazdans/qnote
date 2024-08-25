// var { BasePopup } = ChromeUtils.import("resource:///modules/ExtensionPopups.jsm");

import { QPopupOptions } from "./XULNoteWindow.mjs";

var PopupCounter = 0;

export interface Box {
	top: number,
	left: number,
	width: number,
	height: number,
}

export class QNotePopup extends BasePopup {
	onClose: Function | undefined;
	domId: string;
	isShown = false;
	options: QPopupOptions;

	constructor(window: MozWindow, extension: any, options: QPopupOptions) {
		// const extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

		let document = window.document;

		let mainPopupSet = document.getElementById("mainPopupSet");
		if(!mainPopupSet){
			throw new Error("mainPopupSet not found");
		}

		const domId = "qnote-window-panel-" + (++PopupCounter);

		const panel = document.createXULElement("panel");
		panel.setAttribute("id", domId);
		panel.setAttribute("noautohide", "true");
		panel.setAttribute("noautofocus", "true");
		panel.setAttribute("class", "mail-extension-panel panel-no-padding browser-extension-panel");
		panel.setAttribute("type", "arrow");
		panel.setAttribute("role", "group");

		mainPopupSet.appendChild(panel);


		let popupURL = extension.getURL("html/xulpopup.html");
		let browserStyle = false;
		let fixedWidth = false;
		let blockParser = false;

		super(extension, panel, popupURL, browserStyle, fixedWidth, blockParser);

		this.popupURL = popupURL;
		this.options = options;
		this.domId = domId;
		this.window = window;
	}

	moveTo(x: number, y: number){
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

		this.isShown = false;
	}

	// box = { top, left, width, height }
	_center(innerBox: Box, outerBox: Box, absolute = true){
		let retBox: Box = {
			top: 0,
			left: 0,
			width: 0,
			height: 0,
		};

		let iWidth = innerBox.width;
		let iHeight = innerBox.height;
		let oWidth = outerBox.width;
		let oHeight = outerBox.height;

		retBox.left = Math.round((oWidth - iWidth) / 2);
		retBox.top = Math.round((oHeight - iHeight) / 2);

		if(absolute) {
			retBox.left += outerBox.left;
			retBox.top += outerBox.top;
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

				if(anchor && (anchor in elements)){
					if(elements[anchor]){
						aEl = window.document.getElementById(elements[anchor]);
					}
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

				if(anchorPlacement){
					if(anchorPlacement === 'center'){
						const currBox: Box = {
							left: left||0,
							top: top||0,
							width: width||0,
							height: height||0
						};
						const adjBox = this._center(currBox, wBox, false);
						adjX = adjBox.left;
						adjY = adjBox.top;
					} else if(width && (anchorPlacement.startsWith("topcenter") || anchorPlacement.startsWith("bottomcenter"))){
						adjX = (width / 2) * (- 1);
					} else if(height && (anchorPlacement.startsWith("rightcenter") || anchorPlacement.startsWith("leftcenter"))){
						adjY = (height / 2) * (- 1);
					}
				}
				self.panel.openPopup(aEl, anchorPlacement, adjX, adjY);
			} else {
				self.panel.openPopup(null, "after_start", left, top);
				self.panel.moveTo(left, top);
			}

			this.isShown = true;

			resolve(true);
		});
	}
}
