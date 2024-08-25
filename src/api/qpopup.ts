var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var { BasePopup } = ChromeUtils.import("resource:///modules/ExtensionPopups.jsm");
var { QEventDispatcher } = ChromeUtils.importESModule("resource://qnote/modules/QEventDispatcher.mjs");
var { QPopupOptions } = ChromeUtils.importESModule("resource://qnote/modules/XULNoteWindow.mjs");
// var { DOMLocalizator } = ChromeUtils.importESModule("resource://qnote/modules/DOMLocalizator.mjs");

interface Box {
	top: number,
	left: number,
	width: number,
	height: number,
}
var PopupCounter = 0;
var PopupEventDispatcher = new QEventDispatcher(["oncreated", "onremoved", "onmove", "onresize"]);
type Q = typeof QPopupOptions;
var QDEB = true;

var qpopup = class extends ExtensionCommon.ExtensionAPI {
	onShutdown() {
	}

	getAPI(context: any) {
		// this.i18n = new DOMLocalizator(id => {
		// 	return extension.localizeMessage(id);
		// });

		function id2RealWindow(windowId: number){
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
			popups: new Map<number, QNotePopup>,
			add(popup: QNotePopup): number {
				this.popups.set(++this.counter, popup);
				return this.counter;
			},
			remove(id: number): boolean {
				return this.get(id) ? this.popups.delete(id) : false;
			},
			get(id: number): QNotePopup {
				let p = this.popups.get(id);
				if(p){
					return p;
				}
				throw new Error(`qpopup: id ${id} not found`);
			},
			has(id: number): boolean {
				return this.popups.has(id);
			}
		}

		function coalesce(...args: any): any {
			for(let a of args)
				if(a !== null)
					return a;
			return null;
		}

		class QNotePopup extends BasePopup {
			onClose: Function | undefined;
			domId: string;
			isShown = false;
			options: Q;

			constructor(window: MozWindow, extension: any, options: Q) {
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


				let popupURL = extension.getURL("html/qpopup.html");
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

		// ext no context?
		return {
			qpopup: {
				onCreated: new ExtensionCommon.EventManager({
					context,
					name: "qpopup.onCreated",
					register: (fire: ExtensionParentFire) => {
						const l = (value: any) => {
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
					register: (fire: ExtensionParentFire) => {
						const l = (value: any) => {
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
					register: (fire: ExtensionParentFire) => {
						const l = (value: any) => {
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
					register: (fire: ExtensionParentFire) => {
						const l = (value: any) => {
							fire.async(value);
						};

						PopupEventDispatcher.addListener("onresize", l);

						return () => {
							PopupEventDispatcher.removeListener("onresize", l);
						};
					}
				}).api(),
				async setDebug(on: boolean){
					QDEB = on;
				},
				async remove(id: number){
					QDEB&&console.debug("qpopup.remove()", id);
					const p = popupManager.get(id);
					if(p){
						p.close();
						popupManager.remove(id);
						PopupEventDispatcher.fireListeners("onremoved", id);
					} else {
						console.error(`qpopup: id ${id} not found`);
					}
				},
				async get(id: number){
					return popupManager.get(id);
					// popup.popupInfo.focused = popup.isFocused;

				},
				async update(id: number, options: Q){
					let popup = popupManager.get(id);

					let pi = popup.options;

					// options come in null-ed
					let { top, left, title, focused, offsetTop, offsetLeft } = options;

					if(top !== null || left !== null){
						pi.top = coalesce(top, pi.top);
						pi.left = coalesce(left, pi.left);
						popup.moveTo(pi.left||0, pi.top||0);
					}

					if(offsetTop !== null || offsetLeft !== null){
						pi.top = pi.top + coalesce(offsetTop, 0);
						pi.left = pi.left + coalesce(offsetLeft, 0);
						popup.moveTo(pi.left||0, pi.top||0);
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

					// if(title){
					// 	popup.title = title;
					// }

					return pi;
				},
				async create(options: Q){
					QDEB&&console.debug("qpopup.create()");
					let window = id2RealWindow(options.windowId);

					var popup = new QNotePopup(window, extension, options);

					popup.options.id = popupManager.add(popup);

					PopupEventDispatcher.fireListeners("oncreated", popup.options);

					return popup.pop().then(status => {
						popup.options.top = popup.panel.screenY;
						popup.options.left = popup.panel.screenX;

						return popup.options;
					});
				}
			}
		}
	}
}

