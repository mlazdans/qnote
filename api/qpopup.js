// TODO: get rid of var wex
var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { BasePopup, ViewPopup } = ChromeUtils.import("resource:///modules/ExtensionPopups.jsm");

var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var { NoteColumnHandler } = ChromeUtils.import(extension.rootURI.resolve("modules/NoteColumnHandler.jsm"));
var { NotePopup } = ChromeUtils.import(extension.rootURI.resolve("modules/NotePopup.jsm"));
var { NoteFilter } = ChromeUtils.import(extension.rootURI.resolve("modules/NoteFilter.jsm"));
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

					if(popup){
						popup.close();
						popupManager.remove(id);
						return popup.popupInfo;
					}

					return false;
				},
				async update(id, data){
					let popup = popupManager.get(id);

					if(popup){
						console.log("update() - implement", popup);
					}

					return false;
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
						popup.popupInfo.left = p.x;
						popup.popupInfo.top = p.y;
						PopupEventDispatcher.fireListeners("onmove", popup.popupInfo);
					};

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
							popup.popupInfo.title = popup.title = popup.iframeDocument.title;
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
