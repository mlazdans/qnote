var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var { NotePopup } = ChromeUtils.import(extension.rootURI.resolve("modules/NotePopup.jsm"));
var { QEventDispatcher } = ChromeUtils.import(extension.rootURI.resolve("modules/QEventDispatcher.js"));
var { DOMLocalizator } = ChromeUtils.import(extension.rootURI.resolve("modules/DOMLocalizator.js"));

var PopupEventDispatcher = new QEventDispatcher(["oncreated", "onremoved", "onmove", "onresize", "oncontrols"]);

var qpopup = class extends ExtensionCommon.ExtensionAPI {
	onShutdown() {
	}

	getAPI(context) {
		var API = this;
		var QDEB = true;

		this.i18n = new DOMLocalizator(id => {
			return extension.localizeMessage(id);
		});

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
				onControls: new ExtensionCommon.EventManager({
					context,
					name: "qpopup.onControls",
					register: fire => {
						const l = (action, controlId, popupInfo) => {
							fire.async(action, controlId, popupInfo);
						};

						PopupEventDispatcher.addListener("oncontrols", l);

						return () => {
							PopupEventDispatcher.removeListener("oncontrols", l);
						};
					}
				}).api(),
				async setDebug(on){
					QDEB = on;
				},
				async remove(id){
					// console.log("api.remove", id);
					popupManager.get(id).close();
					popupManager.remove(id);
					PopupEventDispatcher.fireListeners("onremoved", id);
				},
				async get(id){
					let popup = popupManager.get(id);

					popup.popupInfo.focused = popup.isFocused;

					return popup.popupInfo;
				},
				async update(id, options){
					let popup = popupManager.get(id);

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

					// MAYBE: implement lose focus too
					if(focused){
						popup.focus();
					}

					if(title){
						popup.title = title;
					}
				},
				async create(options){
					let {
						windowId, top, left, width, height, url, title, controlsCSS, anchor, anchorPlacement,
						minWidth, minHeight, maxWidth, maxHeight
					} = options;

					let window = id2RealWindow(windowId);

					var popup = new NotePopup({
						window: window,
						title: title,
						top: top,
						left: left,
						width: width,
						height: height,
						minWidth: minWidth,
						minHeight: minHeight,
						maxWidth: maxWidth,
						maxHeight: maxHeight,
						anchor: anchor,
						anchorPlacement: anchorPlacement
					});

					popup.onResize = p => {
						popup.popupInfo.width = p.width;
						popup.popupInfo.height = p.height;
						PopupEventDispatcher.fireListeners("onresize", popup.popupInfo);
					};

					popup.onMove = p => {
						// NOTE: This coordinate is reported in CSS pixels, not in hardware pixels. That means it can be affected by the zoom level; to compute the actual number of physical screen pixels, you should use the nsIDOMWindowUtils.screenPixelsPerCSSPixel property.
						// window.windowUtils.screenPixelsPerCSSPixel
						popup.popupInfo.left = p.left - window.mozInnerScreenX;
						popup.popupInfo.top = p.top - window.mozInnerScreenY;
						PopupEventDispatcher.fireListeners("onmove", popup.popupInfo);
					};

					// popup.onClose = () => {
					// 	if(popupManager.has(popup.popupInfo.id)){
					// 		this.remove(popup.popupInfo.id, false);
					// 	}
					// };

					// TODO: implement
					// popup.onFocus = e => {
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
						API.i18n.setTexts(popup.contentDocument);
						if(controlsCSS){
							let head = popup.getFirstElementByTagName('head');
							let css = `<link rel="stylesheet" href="${controlsCSS}" type="text/css">`
							head.insertAdjacentHTML('beforeend', css);
						}

						if(url){
							popup.iframeEl.src = extension.getURL(url);
						}

						popup.iframeEl.addEventListener("load", e => {
							API.i18n.setTexts(popup.iframeDocument);
							let uControls = popup.iframeDocument.querySelector('.qpopup-user-controls');
							for(let el of uControls.children){
								// let elCl = popup.contentDocument.importNode(el, true);
								// let elCl = popup.iframeDocument.importNode(el, true);
								try {
									let elCl = el.cloneNode(true);
									popup.addControl(elCl);
									elCl.addEventListener('click', e => {
										PopupEventDispatcher.fireListeners("oncontrols", "click", el.id, popup.popupInfo);
									});
								} catch (e){
									console.warn(e);
								}
							}

							let MutationObserver = popup.iframeWindow.MutationObserver;

							// TODO: watch controls change
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
							// popup.close();
							this.remove(popup.popupInfo.id);
						});

						return popup.popupInfo;
					});
				}
			}
		}
	}
}
