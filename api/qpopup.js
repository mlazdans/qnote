var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var { NotePopup } = ChromeUtils.import(extension.rootURI.resolve("modules/NotePopup.jsm"));
var { QEventDispatcher } = ChromeUtils.import(extension.rootURI.resolve("modules/QEventDispatcher.js"));

var PopupEventDispatcher = new QEventDispatcher(["oncreated", "onremoved", "onmove", "onresize"]);

var qpopup = class extends ExtensionCommon.ExtensionAPI {
	onShutdown() {
	}

	getAPI(context) {

		function id2RealWindow(windowId){
			try {
				return extension.windowManager.get(windowId).window;
			} catch {
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
				return this.popups.delete(id);
			},
			get(id){
				return this.popups.get(id);
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
				async remove(id){
					let popup = popupManager.get(id);

					if(!popup){
						return false;
					}

					popupManager.remove(id);

					popup.close();

					PopupEventDispatcher.fireListeners("onremoved", id);

					return true;
				},
				async get(id){
					let popup = popupManager.get(id);

					if(!popup){
						return null;
					}

					popup.popupInfo.focused = popup.isFocused;

					return popup.popupInfo;
				},
				async update(id, options){
					let popup = popupManager.get(id);

					if(!popup){
						return false;
					}

					let pi = popup.popupInfo;

					// options come in null-ed
					let { top, left, width, height, url, title, focused } = options;

					if(top !== null || left !== null){
						pi.top = coalesce(top, pi.top);
						pi.left = coalesce(left, pi.left);
						popup.moveTo(pi.left, pi.top);
					}

					if(width !== null || height !== null){
						pi.width = coalesce(width, pi.width);
						pi.height = coalesce(height, pi.height);
						popup.sizeTo(pi.width, pi.height);
					}

					// TODO: maybe implement lose focus too
					if(focused){
						popup.focus();
					}

					if(title){
						popup.title = title;
					}

					return true;
				},
				async create(options){
					let { windowId, top, left, width, height, url, title } = options;
					let window = id2RealWindow(windowId);

					var popup = new NotePopup({
						window: window,
						title: title,
						top: top,
						left: left,
						width: width,
						height: height
					});

					popup.onResize = p => {
						popup.popupInfo.width = p.width;
						popup.popupInfo.height = p.height;
						PopupEventDispatcher.fireListeners("onresize", popup.popupInfo);
					};

					popup.onMove = p => {
						popup.popupInfo.left = p.left;
						popup.popupInfo.top = p.top;
						PopupEventDispatcher.fireListeners("onmove", popup.popupInfo);
					};

					popup.onClose = () => {
						this.remove(popup.popupInfo.id);
					};

					// TODO: implement
					// popup.onFocus = e => {
					// 	console.log("popup.onFocus");
					// 	popup.popupInfo.focused = true;
					// 	PopupEventDispatcher.fireListeners("onfocus", popup.popupInfo);
					// };
					// popup.onBlur = e => {
					// 	popup.popupInfo.focused = false;
					// 	PopupEventDispatcher.fireListeners("onblur", popup.popupInfo);
					// };

					popup.popupInfo = options;
					popup.popupInfo.id = popupManager.add(popup);

					PopupEventDispatcher.fireListeners("oncreated", popup.popupInfo);

					return popup.pop().then(status => {
						if(url){
							popup.iframeEl.src = extension.getURL(url);
						}

						popup.iframeEl.addEventListener("load", e => {
							let MutationObserver = popup.iframeWindow.MutationObserver;
							// Watch title change
							if(MutationObserver){
								new MutationObserver(function(mutations) {
									try {
										popup.popupInfo.title = popup.title = mutations[0].target.text;
									} catch {
									}
								}).observe(
									popup.iframeDocument.querySelector('title'),
									{ subtree: true, characterData: true, childList: true }
								);
							}

							// Set title from iframe document
							if(popup.iframeDocument.title){
								popup.popupInfo.title = popup.title = popup.iframeDocument.title;
							}
						});

						popup.closeEl.addEventListener("click", e => {
							popup.close();
						});

						return popup.popupInfo;
					});
				}
			}
		}
	}
}
