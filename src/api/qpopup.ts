import { IPopupOptions } from "../modules/NotePopups.mjs";

var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var { BasePopup } = ChromeUtils.importESModule("resource:///modules/ExtensionPopups.sys.mjs");
// var { QBasePopup } = ChromeUtils.importESModule("resource://qnote/modules-exp/QPopups.sys.mjs");
var { QEventDispatcher } = ChromeUtils.importESModule("resource://qnote/modules/QEventDispatcher.mjs");

var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

interface Box {
	top: number,
	left: number,
	width: number,
	height: number,
}

function coalesce(...args: any): any {
	for(let a of args)
		if(a !== null)
			return a;

	return null;
}

var PopupEventDispatcher = new QEventDispatcher("oncreated", "onremoved", "onmove", "onresize");

var QDEB = true;

var popupManager = {
	counter: 0,
	popups: new Map<number, QNotePopup>,
	add(popup: QNotePopup): void {
		QDEB&&console.debug(`qpopup.popupManager: Adding new popup with id ${popup.id}`);
		if(this.has(popup.id)){
			throw new Error(`qpopup: id ${popup.id} already exists`);
		} else {
			this.popups.set(popup.id, popup);
		}
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

var qpopup = class extends ExtensionCommon.ExtensionAPI {
	onShutdown() {
	}

	getAPI(context: any) {
		// this.i18n = new DOMLocalizator(id => {
		// 	return extension.localizeMessage(id);
		// });

		function id2RealWindow(windowId: number): MozWindow {
			try {
				return extension.windowManager.get(windowId).window;
			} catch {
				// QDEB&&console.debug("windowManager fail");
				throw new Error("windowManager fail");
			}
			// return undefined;
			// Get a window ID from a real window:
			// context.extension.windowManager.getWrapper(realWindow).id;

			// // Get all windows: (note this returns a Generator, not an array like the API)
			// context.extension.windowManager.getAll();
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
					popupManager.get(id).close();
					popupManager.remove(id);
					PopupEventDispatcher.fireListeners("onremoved", id);
				},
				async get(id: number){
					return popupManager.get(id).options;
					// popup.popupInfo.focused = popup.isFocused;
				},
				async update(id: number, options: IPopupOptions){
					let popup = popupManager.get(id);

					let pi = popup.options;

					// options come in null-ed
					let { top, left, focused, offsetTop, offsetLeft } = options;

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
				async pop(id: number){
					return popupManager.get(id).pop();
					// const popup = popupManager.get(id);
					// return popup.pop().then(status => {
					// 	// popup.options.top = popup.panel.screenY;
					// 	// popup.options.left = popup.panel.screenX;

					// 	return popup.id;
					// });
				},
				async create(windowId: number, options: IPopupOptions) {
					QDEB&&console.debug("qpopup.create()");

					var popup = new QNotePopup(id2RealWindow(windowId), extension, options);

					PopupEventDispatcher.fireListeners("oncreated", popup.options);

					return popup.id;
				}
			}
		}
	}
}

class QNotePopup extends BasePopup {
	id: number;
	onClose: Function | undefined;
	isShown = false;
	options: IPopupOptions;

	constructor(window: MozWindow, extension: any, options: IPopupOptions) {
		// const extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

		let document = window.document;

		let mainPopupSet = document.getElementById("mainPopupSet");
		if(!mainPopupSet){
			throw new Error("mainPopupSet not found");
		}

		const id = (++popupManager.counter);

		const panel = document.createXULElement("panel");
		panel.setAttribute("id", "qnote-window-panel-" + id);
		panel.setAttribute("noautohide", "true");
		panel.setAttribute("noautofocus", "true");
		panel.setAttribute("class", "mail-extension-panel panel-no-padding browser-extension-panel");
		panel.setAttribute("type", "arrow");
		panel.setAttribute("role", "group");

		// window.addEventListener("click", () => {
		// 	console.error("click from api");
		// });

		// window.addEventListener("WebExtPopupResized", () => {
		// 	console.error("WebExtPopup:Resized from api");
		// });

		// window.addEventListener("WebExtPopupLoaded", () => {
		// 	console.error("WebExtPopup:Loaded from api");
		// });

		mainPopupSet.appendChild(panel);

		const url = "html/qpopup.html?id=" + id;

		const popupURL = extension.getURL(url);
		const browserStyle = false;
		const fixedWidth = false;
		const blockParser = false;

		super(extension, panel, popupURL, browserStyle, fixedWidth, blockParser);

		// TODO: experiment
		// panel.addEventListener("popupshowing", () => {
		// 	// const titleEl = document.querySelector(".qpopup-title") as HTMLElement;
		// 	// console.error("popupshowing from api", panel);
		// 	// console.error("shadowRoot", panel.shadowRoot);
		// });

		this.id = id;
		this.options = options;
		popupManager.add(this);
	}

	moveTo(x: number, y: number){
		this.panel.moveTo(x, y);
	}

	// sizeTo(width: number, height: number){
	// 	this.panel.sizeTo(width, height);
	// }

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
		const retBox: Box = {
			top: 0,
			left: 0,
			width: 0,
			height: 0,
		};

		const iWidth = innerBox.width;
		const iHeight = innerBox.height;
		const oWidth = outerBox.width;
		const oHeight = outerBox.height;

		retBox.left = Math.round((oWidth - iWidth) / 2);
		retBox.top = Math.round((oHeight - iHeight) / 2);

		if(absolute) {
			retBox.left += outerBox.left;
			retBox.top += outerBox.top;
		}

		return retBox;
	}

	pop(){
		QDEB&&console.debug("qpopup.pop()", this.options);
		const { left, top, width, height, anchor, anchorPlacement } = this.options;
		const window = this.window;

		return new Promise(resolve => {
			const elements = {
				window: "",
				threadpane: "threadContentArea",
				message: "messagepane",
			};

			if((left === null) && (top === null)){
				let aEl: HTMLElement | null = null;
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

				if(aEl && anchorPlacement){
					if(anchorPlacement === 'center'){
						const wBox = {
							top: (aEl as any).screenY, // TODO any
							left: (aEl as any).screenX,
							width: aEl.clientWidth,
							height: aEl.clientHeight
						};
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
				this.panel.openPopup(aEl, anchorPlacement);
				this.panel.moveTo(adjX, adjY);
			} else {
				this.panel.openPopup(null, "after_start");
				this.panel.moveTo(left, top);
			}

			this.isShown = true;

			resolve(true);
		});
	}
}
