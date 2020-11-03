var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { BasePopup, ViewPopup } = ChromeUtils.import("resource:///modules/ExtensionPopups.jsm");

var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var { ColumnHandler } = ChromeUtils.import(extension.rootURI.resolve("modules/ColumnHandler.jsm"));
var { NotePopup } = ChromeUtils.import(extension.rootURI.resolve("modules/NotePopup.jsm"));
var { NoteFilter } = ChromeUtils.import(extension.rootURI.resolve("modules/NoteFilter.jsm"));

var qapp = class extends ExtensionCommon.ExtensionAPI {
	onShutdown() {
		Services.obs.notifyObservers(null, "startupcache-invalidate", null);

		ColumnHandler.uninstall();
		NoteFilter.uninstall();

		Components.utils.unload(extension.rootURI.resolve("modules/ColumnHandler.jsm"));
		Components.utils.unload(extension.rootURI.resolve("modules/NotePopup.jsm"));
		Components.utils.unload(extension.rootURI.resolve("modules/NoteFilter.jsm"));
	}
	getAPI(context) {
		var wex = Components.utils.waiveXrays(context.cloneScope);

		var noteGrabber = {
			listeners: {
				// function(keyId, data, params)
				// keyId - note key
				// data - note data
				// params - misc params passed to getNote()
				"noterequest": []
			},
			noteBlocker: new Map(),
			NotesCache: [],
			addListener(name, listener){
				noteGrabber.listeners[name].push(listener);
			},
			saveNoteCache(note){
				noteGrabber.NotesCache[note.keyId] = note;
			},
			getNoteCache(keyId){
				if(noteGrabber.NotesCache[keyId]){
					return noteGrabber.NotesCache[keyId];
				}
			},
			deleteNoteCache(keyId){
				noteGrabber.NotesCache[keyId] = undefined;
			},
			clearNoteCache(){
				noteGrabber.NotesCache = [];
			},
			getNote(keyId, params){
				let self = noteGrabber;
				let blocker = self.noteBlocker;

				// Block concurrent calls on same note as we will update column once it has been loded from local cache, local storage or file
				// Not 100% sure if necessary but calls to column update can be quite many
				if(blocker.has(keyId)){
					return {};
				}

				blocker.set(keyId, true);

				var note = self.getNoteCache(keyId);

				if(note){
					blocker.delete(keyId);

					return Object.assign({}, note);
				} else {
					var onNoteRequest = async (keyId) => {
						var data = await wex.loadNote(keyId);
						if(data){
							return {
								keyId: keyId,
								exists: true,
								text: data.text
							}
						} else {
							return {
								keyId: keyId,
								exists: false
							}
						}
					}

					onNoteRequest(keyId).then(data => {
						self.saveNoteCache(data);

						let listeners = noteGrabber.listeners['noterequest'];
						for(let i =0; i < listeners.length; i++){
							listeners[i](keyId, data, params);
						}

						blocker.delete(keyId);
					});

					return {};
				}
			}
		}

		return {
			qapp: {
				async init(){
					this.popups = new Map();

					await this.installColumnHandler();
					await this.installQuickFilter();
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
					var window = Services.wm.getMostRecentWindow(null);

					let escaper = e => {
						if(e.key === 'Escape'){
							if(wex.CurrentNote.windowId){
								wex.CurrentNote.needSave = false;
								wex.CurrentNote.close();
								e.preventDefault();
							}
						}
					};

					window.addEventListener("keydown", escaper);

					var n = new NotePopup(
						extension.getURL(opt.url),
						window
					);

					n.onResize = e => {
						wex.CurrentNote.note.width = e.width;
						wex.CurrentNote.note.height = e.height;
					};

					n.onMove = e => {
						wex.CurrentNote.note.x = e.x;
						wex.CurrentNote.note.y = e.y;
					};

					n.onClose = () => {
						window.removeEventListener("keydown", escaper);
					};

					var initNote = () => {
						var document = n.browser.contentWindow.document;
						var closeButton = document.getElementById('closeButton');
						var deleteButton = document.getElementById('deleteButton');

						closeButton.addEventListener("click", (e)=>{
							wex.CurrentNote.close();
						});

						deleteButton.addEventListener("click", (e)=>{
							wex.CurrentNote.note.text = '';
							wex.CurrentNote.close();
						});

						n.viewNode.moveTo(opt.left, opt.top);

						try {
							let focus = wex.Prefs.focusOnDisplay || !wex.CurrentNote.note.text;
							if(!focus){
								window.gFolderDisplay.tree.focus();
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
				async installQuickFilter(){
					NoteFilter.install({
						noteGrabber: noteGrabber
					});
				},
				async installColumnHandler(){
					ColumnHandler.install({
						textLimit: wex.Prefs.showFirstChars,
						noteGrabber: noteGrabber
					});
				},
				// TODO: rename column view update
				async updateView(){
					ColumnHandler.Observer.observe();
				},
				async updateNote(note){
					noteGrabber.saveNoteCache(note);
				},
				async deleteNote(keyId){
					noteGrabber.deleteNoteCache(keyId);
				},
				async clearNotes(){
					noteGrabber.clearNoteCache();
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
