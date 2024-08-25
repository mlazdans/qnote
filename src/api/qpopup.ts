import { QEventDispatcher } from "../modules/QEventDispatcher.mjs";
import { QNotePopup } from "../modules/QNotePopup.mjs";
import { QPopupOptions } from "../modules/XULNoteWindow.mjs";

var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var PopupEventDispatcher = new QEventDispatcher(["oncreated", "onremoved", "onmove", "onresize"]);

var qpopup = class extends ExtensionCommon.ExtensionAPI {
	onShutdown() {
	}

	getAPI(context: any) {
		var QDEB = true;

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

		return {
			qpopup: {
				onCreated: new ExtensionCommon.EventManager({
					context,
					name: "qpopup.onCreated",
					register: (fire: ExtensionParent.Fire) => {
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
					register: (fire: ExtensionParent.Fire) => {
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
					register: (fire: ExtensionParent.Fire) => {
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
					register: (fire: ExtensionParent.Fire) => {
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
				async update(id: number, options: QPopupOptions){
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
				async create(options: QPopupOptions){
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
