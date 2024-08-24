var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var { BasePopup } = ChromeUtils.import("resource:///modules/ExtensionPopups.jsm");

var PopupEventDispatcher = new QEventDispatcher(["oncreated", "onremoved", "onmove", "onresize"]);
var PopupCounter = 0;

class QNotePopup extends BasePopup {
	constructor(options) {
		// const extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

		let domId = "qnote-window-panel-" + (++PopupCounter);

		let { window } = options;
		let document = window.document;

		let panel = document.createXULElement("panel");
		panel.setAttribute("id", domId);
		panel.setAttribute("noautohide", true);
		panel.setAttribute("noautofocus", true);
		panel.setAttribute("class", "mail-extension-panel panel-no-padding browser-extension-panel");
		panel.setAttribute("type", "arrow");
		panel.setAttribute("role", "group");

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

var qpopup = class extends ExtensionCommon.ExtensionAPI {
	onShutdown() {
	}

	getAPI(context) {
		var QDEB = true;

		function id2RealWindow(windowId){
			try {
				return extension.windowManager.get(windowId).window;
			} catch {
				QDEB&&console.debug("windowManager fail");
			}
			// Get a window ID from a real window:
			// context.extension.windowManager.getWrapper(realWindow).id;

			// // Get all windows: (note this returns a Generator, not an array like the API)
			// context.extension.windowManager.getAll();
		}

		var popupManager = {
			counter: 0,
			popups: new Map(),
			add(popup) {
				this.popups.set(++this.counter, popup);
				return this.counter;
			},
			remove(id){
				if(this.get(id)){
					return this.popups.delete(id);
				}
			},
			get(id){
				if(this.has(id)){
					return this.popups.get(id);
				}
				throw new ExtensionError(`Invalid popup ID: ${id}`);
			},
			has(id){
				return this.popups.has(id);
			}
		}

		function coalesce(...args){
			for(let a of args)
				if(a !== null)
					return a;
			return null;
		}

		return {
			qpopup: {
				onCreated: new ExtensionCommon.EventManager({
					context,
					name: "qpopup.onCreated",
					register: fire => {
						const l = value => {
							fire.async(value);
						};

						PopupEventDispatcher.addListener("oncreated", l);

						return () => {
							PopupEventDispatcher.removeListener("oncreated", l);
						};
					}
				}).api(),
				onRemoved: new ExtensionCommon.EventManager({
					context,
					name: "qpopup.onRemoved",
					register: fire => {
						const l = value => {
							fire.async(value);
						};

						PopupEventDispatcher.addListener("onremoved", l);

						return () => {
							PopupEventDispatcher.removeListener("onremoved", l);
						};
					}
				}).api(),
				onMove: new ExtensionCommon.EventManager({
					context,
					name: "qpopup.onMove",
					register: fire => {
						const l = value => {
							fire.async(value);
						};

						PopupEventDispatcher.addListener("onmove", l);

						return () => {
							PopupEventDispatcher.removeListener("onmove", l);
						};
					}
				}).api(),
				onResize: new ExtensionCommon.EventManager({
					context,
					name: "qpopup.onResize",
					register: fire => {
						const l = value => {
							fire.async(value);
						};

						PopupEventDispatcher.addListener("onresize", l);

						return () => {
							PopupEventDispatcher.removeListener("onresize", l);
						};
					}
				}).api(),
				async setDebug(on){
					QDEB = on;
				},
				async remove(id){
					QDEB&&console.debug("qpopup.remove()", id);
					popupManager.get(id).close();
					popupManager.remove(id);
					PopupEventDispatcher.fireListeners("onremoved", id);
				},
				async get(id){
					let popup = popupManager.get(id);

					// popup.popupInfo.focused = popup.isFocused;

					return popup.popupInfo;
				},
				async update(id, options){
					let popup = popupManager.get(id);

					let pi = popup.popupInfo;

					// options come in null-ed
					let { top, left, width, height, url, title, focused, offsetTop, offsetLeft } = options;

					if(top !== null || left !== null){
						pi.top = coalesce(top, pi.top);
						pi.left = coalesce(left, pi.left);
						popup.moveTo(pi.left, pi.top);
					}

					if(offsetTop !== null || offsetLeft !== null){
						pi.top = pi.top + coalesce(offsetTop, 0);
						pi.left = pi.left + coalesce(offsetLeft, 0);
						popup.moveTo(pi.left, pi.top);
					}

					// TODO: broken
					// if(width !== null || height !== null){
					// 	pi.width = coalesce(width, pi.width);
					// 	pi.height = coalesce(height, pi.height);
					// 	popup.sizeTo(pi.width, pi.height);
					// }

					// MAYBE: implement lose focus too
					if(focused){
						popup.focus();
					}

					if(title){
						popup.title = title;
					}

					return pi;
				},
				async create(options){
					QDEB&&console.debug("qpopup.create()");
					let {
						windowId, top, left, width, height, anchor, anchorPlacement
					} = options;

					let window = id2RealWindow(windowId);

					var popup = new QNotePopup({
						window: window,
						top: top,
						left: left,
						width: width,
						height: height,
						anchor: anchor,
						anchorPlacement: anchorPlacement
					});

					popup.popupInfo = options;
					popup.popupInfo.id = popupManager.add(popup);

					PopupEventDispatcher.fireListeners("oncreated", popup.popupInfo);

					return popup.pop().then(status => {
						popup.popupInfo.top = popup.panel.screenY;
						popup.popupInfo.left = popup.panel.screenX;

						return popup.popupInfo;
					});
				}
			}
		}
	}
}
