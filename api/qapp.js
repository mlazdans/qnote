var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { BasePopup, ViewPopup } = ChromeUtils.import("resource:///modules/ExtensionPopups.jsm");

var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var { ColumnHandler } = ChromeUtils.import(extension.rootURI.resolve("modules/ColumnHandler.jsm"));
var { NotePopup } = ChromeUtils.import(extension.rootURI.resolve("modules/NotePopup.jsm"));

var qapp = class extends ExtensionCommon.ExtensionAPI {
	onShutdown(isAppShutdown) {
		if(isAppShutdown){
			return;
		}

		Services.obs.notifyObservers(null, "startupcache-invalidate", null);

		ColumnHandler.uninstall();

		Components.utils.unload(extension.rootURI.resolve("modules/ColumnHandler.jsm"));
		Components.utils.unload(extension.rootURI.resolve("modules/NotePopup.jsm"));
	}
	getAPI(context) {
		var wex = Components.utils.waiveXrays(context.cloneScope);
		var popups = new Map();

		return {
			qapp: {
				async popupClose(id){
					if(popups.has(id)){
						popups.get(id).closePopup();
						popups.delete(id);
					}
				},
				async popup(opt){
					// https://developer.mozilla.org/en-US/docs/Archive/Mozilla/XUL/Method/openPopup
					// https://developer.mozilla.org/en-US/docs/Archive/Mozilla/XUL/PopupGuide/Positioning
					// Possible values for position are:
					// before_start, before_end, after_start, after_end, start_before, start_after,
					// end_before, end_after, overlap, and after_pointer.

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

					if(opt.left && opt.top) {
						n.viewNode.openPopup(null, "topleft", opt.left, opt.top);
					} else {
						n.viewNode.openPopup(null, "topleft");
					}

					n.contentReady.then((e)=>{
						n.browser.contentWindow.addEventListener("DOMContentLoaded", ()=>{
							var closeButton = n.tempBrowser.contentWindow.document.getElementById('closeButton');
							closeButton.addEventListener("click", (e)=>{
								wex.CurrentNote.close();
							});

							var deleteButton = n.tempBrowser.contentWindow.document.getElementById('deleteButton');
							deleteButton.addEventListener("click", (e)=>{
								wex.CurrentNote.note.text = '';
								wex.CurrentNote.close();
							});

							n.viewNode.addEventListener("keydown", (e)=>{
								if(e.key === 'Escape'){
									wex.CurrentNote.needSave = false;
									wex.CurrentNote.close();
									e.preventDefault();
								}
							}, false);

							n.viewNode.moveTo(opt.left, opt.top);
							// await n.resizeBrowser({
							// 	width: wex.CurrentNote.note.width || opt.width,
							// 	height: wex.CurrentNote.note.height || opt.height
							// });
							// await n.resizeBrowser({
							// 	width: wex.CurrentNote.note.width || opt.width,
							// 	height: wex.CurrentNote.note.height || opt.height
							// });
						});
					});

					popups.set(n.windowId, n);

					return n.windowId;
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
					return Components.classes['@mozilla.org/file/directory_service;1']
						.getService(Components.interfaces.nsIProperties)
						.get('ProfD', Components.interfaces.nsIFile)
						.path
					;
				}
			}
		}
	}
}
