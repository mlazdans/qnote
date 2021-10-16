var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var { NotePopup } = ChromeUtils.import(extension.rootURI.resolve("modules/NotePopup.jsm"));
var { QEventDispatcher } = ChromeUtils.import(extension.rootURI.resolve("modules/QEventDispatcher.js"));
var { DOMLocalizator } = ChromeUtils.import(extension.rootURI.resolve("modules/DOMLocalizator.js"));

var PopupEventDispatcher = new QEventDispatcher(["oncreated", "onremoved", "onmove", "onresize"]);

var qpopup = class extends ExtensionCommon.ExtensionAPI {
	onShutdown() {
	}

	getAPI(context) {
		var QDEB = true;

		this.i18n = new DOMLocalizator(id => {
			return extension.localizeMessage(id);
		});

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

					var popup = new NotePopup({
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
