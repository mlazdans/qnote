var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { BasePopup, ViewPopup } = ChromeUtils.import("resource:///modules/ExtensionPopups.jsm");

var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var { ColumnHandler } = ChromeUtils.import(extension.rootURI.resolve("modules/ColumnHandler.jsm"));
var { NotePopup } = ChromeUtils.import(extension.rootURI.resolve("modules/NotePopup.jsm"));

let escaper;

var qapp = class extends ExtensionCommon.ExtensionAPI {
	onShutdown(isAppShutdown) {
		if(isAppShutdown){
			return;
		}

		try {
			Services.wm.getMostRecentWindow("mail:3pane").removeEventListener("keydown", escaper);
		} catch {
		}

		Services.obs.notifyObservers(null, "startupcache-invalidate", null);

		ColumnHandler.uninstall();

		Components.utils.unload(extension.rootURI.resolve("modules/ColumnHandler.jsm"));
		Components.utils.unload(extension.rootURI.resolve("modules/NotePopup.jsm"));
	}
	getAPI(context) {
		var wex = Components.utils.waiveXrays(context.cloneScope);

		return {
			qapp: {
				async init(){
					this.popups = new Map();
					try {
						let styleSheetService = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
						let uri = Services.io.newURI(extension.getURL("html/background.css"), null, null);
						styleSheetService.loadAndRegisterSheet(uri, styleSheetService.USER_SHEET);
					} catch(e) {
						console.error(e);
					}

					await this.installColumnHandler();

					escaper = e => {
						if(e.key === 'Escape'){
							if(wex.CurrentNote.windowId){
								wex.CurrentNote.needSave = false;
								wex.CurrentNote.close();
								e.preventDefault();
							}
						}
					};

					try {
						Services.wm.getMostRecentWindow("mail:3pane").addEventListener("keydown", escaper);
					} catch {
					}
				},
				async messagesFocus(){
					try {
						Services.wm.getMostRecentWindow("mail:3pane").gFolderDisplay.tree.focus();
					} catch {
					}
				},
				async popupClose(id){
					if(this.popups.has(id)){
						this.popups.get(id).close();
						this.popups.delete(id);
					}
				},
				async popupFocus(id){
					if(!this.popups.has(id)){
						return;
					}

					let n = this.popups.get(id);
					let document = n.browser.contentWindow.document;
					let YTextE = document.getElementById('qnote-text');

					if(YTextE){
						YTextE.focus();
					}
				},
				async popup(opt){
					var self = this;
					var n = new NotePopup(
						extension.getURL(opt.url)
					);

					n.onResize = (e)=>{
						wex.CurrentNote.note.width = e.width;
						wex.CurrentNote.note.height = e.height;
					};

					n.onMove = (e)=>{
						wex.CurrentNote.note.x = e.x;
						wex.CurrentNote.note.y = e.y;
					};

					var initNote = ()=>{
						var document = n.browser.contentWindow.document;
						var closeButton = document.getElementById('closeButton');
						closeButton.addEventListener("click", (e)=>{
							wex.CurrentNote.close();
						});

						var deleteButton = document.getElementById('deleteButton');
						deleteButton.addEventListener("click", (e)=>{
							wex.CurrentNote.note.text = '';
							wex.CurrentNote.close();
						});

						n.viewNode.moveTo(opt.left, opt.top);

						// var w = Services.wm.getMostRecentWindow("mail:3pane");

						// var escaper = (e)=>{
						// 	if(e.key === 'Escape'){
						// 		wex.CurrentNote.needSave = false;
						// 		wex.CurrentNote.close();
						// 		e.preventDefault();
						// 		w.removeEventListener("keydown", escaper);
						// 	}
						// };

						// // Attaching to main window for escaping non-focused notes
						// w.addEventListener("keydown", escaper);

						try {
							let focus = wex.Prefs.focusOnDisplay || !wex.CurrentNote.note.text;
							if(!focus){
								Services.wm.getMostRecentWindow("mail:3pane").gFolderDisplay.tree.focus();
							}
						} catch(e) {
							console.error(e);
						}
					};

					return new Promise(function(resolve, reject) {
						// https://developer.mozilla.org/en-US/docs/Archive/Mozilla/XUL/Method/openPopup
						// https://developer.mozilla.org/en-US/docs/Archive/Mozilla/XUL/PopupGuide/Positioning
						// Possible values for position are:
						// before_start, before_end, after_start, after_end, start_before, start_after,
						// end_before, end_after, overlap, and after_pointer.
						if(opt.left && opt.top) {
							n.viewNode.openPopup(null, "topleft", opt.left, opt.top);
						} else {
							n.viewNode.openPopup(null, "topleft");
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
				},
				async installColumnHandler(){
					ColumnHandler.install({
						textLimit: wex.Prefs.showFirstChars,
						onNoteRequest: async (messageId) => {
							var data = await wex.loadNote(messageId);
							if(data){
								return {
									keyId: messageId,
									exists: true,
									text: data.text
								}
							} else {
								return {
									keyId: messageId,
									exists: false
								}
							}
						}
					});
				},
				async updateView(){
					ColumnHandler.Observer.observe();
				},
				async updateColumnNote(note){
					ColumnHandler.saveNoteCache(note);
				},
				async deleteColumnNote(keyId){
					ColumnHandler.deleteNoteCache(keyId);
				},
				async clearColumnNotes(){
					ColumnHandler.clearNoteCache();
				},
				async setColumnTextLimit(limit){
					ColumnHandler.setTextLimit(limit);
				},
				async getProfilePath() {
					return Cc['@mozilla.org/file/directory_service;1']
						.getService(Ci.nsIProperties)
						.get('ProfD', Ci.nsIFile)
						.path
					;
				}
			}
		}
	}
}
