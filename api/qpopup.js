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

var PopupEventDispatcher = new QEventDispatcher(["oncreated"]);

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

		return {
			qpopup: {
				counter: 0,
				onCreated: new ExtensionCommon.EventManager({
					context,
					name: "qpopup.onCreated",
					register: fire => {
						const l = value => {
							fire.async(value);
						};

						PopupEventDispatcher.addListener("oncreated", l);

						return () => {
							console.log("unregister");
							PopupEventDispatcher.removeListener("oncreated", l);
						};
					}
				}).api(),
				async create(options){
					let { windowId, top, left, width, height } = options;
					let window = id2RealWindow(windowId);

					// let escaper = e => {
					// 	if(e.key === 'Escape'){
					// 		if(wex.CurrentNote.windowId){
					// 			wex.CurrentNote.needSaveOnClose = false;
					// 			wex.CurrentNote.close();
					// 			e.preventDefault();
					// 		}
					// 	}
					// };

					// window.addEventListener("keydown", escaper);

					var n = new NotePopup({
						window: window,
						top: top,
						left: left,
						width: width,
						height: height
					});

					PopupEventDispatcher.fireListeners("oncreated", "tuc tuc");

					n.pop();

					return;

					// n.onResize = e => {
					// 	wex.CurrentNote.note.width = e.width;
					// 	wex.CurrentNote.note.height = e.height;
					// };

					// n.onMove = e => {
					// 	wex.CurrentNote.note.x = e.x;
					// 	wex.CurrentNote.note.y = e.y;
					// };

					// n.onClose = () => {
					// 	window.removeEventListener("keydown", escaper);
					// };

					var initNote = () => {
						var document = n.browser.contentWindow.document;
						var closeButton = document.getElementById('closeButton');
						var deleteButton = document.getElementById('deleteButton');

						closeButton.addEventListener("click", e => {
							wex.CurrentNote.close();
						});

						deleteButton.addEventListener("click", e => {
							wex.CurrentNote.deleteNote();
						});

						n.moveTo(opt.left, opt.top);
						n.sizeTo(opt.width, opt.height);

						// TODO: code duplication!!
						try {
							let focus = wex.Prefs.focusOnDisplay || !wex.CurrentNote.note.text;
							if(!focus && window.gFolderDisplay && window.gFolderDisplay.tree){
								window.gFolderDisplay.tree.focus();
							}
						} catch(e) {
							console.error(e);
						}
					};

					return new Promise(function(resolve) {
						// https://developer.mozilla.org/en-US/docs/Archive/Mozilla/XUL/Method/openPopup
						// https://developer.mozilla.org/en-US/docs/Archive/Mozilla/XUL/PopupGuide/Positioning
						// Possible values for position are:
						// before_start, before_end, after_start, after_end,
						// start_before, start_after, end_before, end_after
						// overlap, after_pointer

						let anchor = null;

						// threadPaneBox, messagepanewrapper, status-bar, folderPaneBox
						// anchor = window.document.getElementById('folderPaneBox');
						// if(!anchor){
						// 	anchor = null;
						// }
						// n.viewNode.openPopup(anchor, "bottomcenter bottomright");

						if(opt.left && opt.top) {
							n.viewNode.openPopup(anchor, "topleft", opt.left, opt.top);
						} else {
							n.viewNode.openPopup(anchor, "topleft");
						}

						n.browser.addEventListener("DOMContentLoaded", ()=>{
							// We are not interested when about:blank been loaded
							if(n.browser.contentWindow.document.URL !== extension.getURL(opt.url)){
								return;
							}

							n.browserLoaded.then(()=>{
								initNote();
								self.popups.set(n.windowId, n);
								resolve(n.windowId);
							});
							// n.contentReady.then(()=>{
							// });
							// n.browserReady.then(()=>{
							// });
						});
					});
				}
			}
		}
	}
}
