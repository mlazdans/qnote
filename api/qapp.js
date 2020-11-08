var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { BasePopup, ViewPopup } = ChromeUtils.import("resource:///modules/ExtensionPopups.jsm");

var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var { ColumnHandler } = ChromeUtils.import(extension.rootURI.resolve("modules/ColumnHandler.jsm"));
var { NotePopup } = ChromeUtils.import(extension.rootURI.resolve("modules/NotePopup.jsm"));
var { NoteFilter } = ChromeUtils.import(extension.rootURI.resolve("modules/NoteFilter.jsm"));

var QAppWindowObserver = {
	listeners: {
		"domwindowopened": new Set(),
		"domwindowclosed": new Set()
	},
	removeListener(name, listener){
		QAppWindowObserver.listeners[name].delete(listener);
	},
	addListener(name, listener){
		QAppWindowObserver.listeners[name].add(listener);
	},
	observe: function(aSubject, aTopic, aData) {
		if(aTopic === 'domwindowopened' || aTopic === 'domwindowclosed'){
			for (let listener of QAppWindowObserver.listeners[aTopic]) {
				listener(aSubject, aTopic, aData);
			}
		}
	}
};

// TODO: make consistent with popups
var formatQNoteHTML = data => {
	// https://searchfox.org/mozilla-central/source/dom/base/nsIDocumentEncoder.idl
	let flags =
		Ci.nsIDocumentEncoder.OutputPreformatted
		| Ci.nsIDocumentEncoder.OutputForPlainTextClipboardCopy
		// Ci.nsIDocumentEncoder.OutputDropInvisibleBreak
		// | Ci.nsIDocumentEncoder.OutputFormatFlowed
		// | Ci.nsIDocumentEncoder.OutputFormatted
		// | Ci.nsIDocumentEncoder.OutputLFLineBreak
		;

	// Strip tags, etc
	let parserUtils = Cc["@mozilla.org/parserutils;1"].getService(Ci.nsIParserUtils);
	let text = parserUtils.convertToPlainText(data.text, flags, 0);
	text = text.replace("\r\n", "<br>");
	text = text.replace("\n", "<br>");

	return {
		title: 'QNote: ' + (new Date(data.ts)).toLocaleString(),
		text: text
	}
};

var qapp = class extends ExtensionCommon.ExtensionAPI {
	onShutdown() {
		Services.obs.notifyObservers(null, "startupcache-invalidate", null);

		ColumnHandler.uninstall();
		NoteFilter.uninstall();

		Services.ww.unregisterNotification(QAppWindowObserver);
		//Services.obs.removeObserver(this.MsgMsgDisplayed, "MsgMsgDisplayed");

		Components.utils.unload(extension.rootURI.resolve("modules/ColumnHandler.jsm"));
		Components.utils.unload(extension.rootURI.resolve("modules/NotePopup.jsm"));
		Components.utils.unload(extension.rootURI.resolve("modules/NoteFilter.jsm"));
	}

	getAPI(context) {
		var wex = Components.utils.waiveXrays(context.cloneScope);
		//var QAppWindowObserver = this.QAppWindowObserver;
		//var MsgMsgDisplayed = this.MsgMsgDisplayed;

		var noteGrabber = {
			// function noterequest(keyId, data, params)
			//  keyId - note key
			//  data - note data
			//  params - misc params passed to getNote()
			listeners: {
				"noterequest": new Set()
			},
			noteBlocker: new Map(),
			NotesCache: [], // TODO: Set(), Map()?
			removeListener(name, listener){
				noteGrabber.listeners[name].delete(listener);
			},
			addListener(name, listener){
				noteGrabber.listeners[name].add(listener);
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
					let onNoteRequest = async (keyId) => {
						var data = await wex.loadNote(keyId);
						if(data){
							return {
								keyId: keyId,
								exists: true,
								text: data.text,
								ts: data.ts
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

						for (let listener of noteGrabber.listeners.noterequest) {
							listener(keyId, data, params);
						}

						blocker.delete(keyId);
					});

					return {};
				}
			}
		}

		return {
			qapp: {
				getMessageSuitableWindow(){
					let w = Services.wm.getMostRecentWindow(null);

					if(w.document.getElementById("messagepane")){
						return w;
					}

					return Services.wm.getMostRecentWindow("mail:3pane");
				},
				getQNoteSuitableWindow(){
					let w = Services.wm.getMostRecentWindow(null);

					if(w.document.getElementById("mainPopupSet")){
						return w;
					}

					return Services.wm.getMostRecentWindow("mail:3pane");
				},
				printerQNoteAttacher(aSubject) {
					let domLoadedEvent = e => {
						let document = e.target;
						if(!document.URL.includes('chrome://messenger/content/msgPrintEngine')){
							return;
						}

						let messageUrisToPrint = document.defaultView.arguments[1];

						let pDocument = document.getElementById('content');
						if(!pDocument){
							console.log("Print content not found");
							return;
						}

						let printerWindowDOMListener = e => {
							let document = e.target;

							let body = document.getElementsByTagName('body');
							if(body){
								body = body[0];
							} else {
								console.log("Body not found");
								return;
							}

							let domNodes = document.getElementsByClassName('qnote-insidenote');
							while(domNodes.length){
								domNodes[0].remove();
							}

							if(
								document.URL === 'about:blank' ||
								!aSubject.opener ||
								!aSubject.opener.messenger ||
								!messageUrisToPrint ||
								!messageUrisToPrint.shift
							){
								return;
							}

							let messenger = aSubject.opener.messenger;

							//let uri =  "imap-message://dev%40dqdp.net@mail.dqdp.net/INBOX#13";
							let msg = messenger.msgHdrFromURI(messageUrisToPrint.shift());
							let note = noteGrabber.getNote(msg.messageId);
							if(!note || !note.exists){
								return;
							}

							let formated = formatQNoteHTML(note);

							let html = `<div class="qnote-insidenote" style="margin: 0; padding: 0; border: 1px solid black;">
								<div style="border-bottom: 1px solid black;">${formated.title}</div>
								<div>${formated.text}</div>
							</div>`;

							if(wex.Prefs.printAttachTop){
								body.insertAdjacentHTML('afterbegin', html);
							}

							if(wex.Prefs.printAttachBottom){
								body.insertAdjacentHTML('beforeend', html);
							}
						};
						pDocument.addEventListener("DOMContentLoaded", printerWindowDOMListener);
					};

					aSubject.addEventListener("DOMContentLoaded", domLoadedEvent);
				},
				async init(){
					this.popups = new Map();

					//Services.obs.addObserver(MsgMsgDisplayed, "MsgMsgDisplayed");

					if(wex.Prefs.enablePrintAttach){
						Services.ww.registerNotification(QAppWindowObserver);
						QAppWindowObserver.addListener('domwindowopened', this.printerQNoteAttacher);
					}

					if(wex.Prefs.enableSearch){
						this.installQuickFilter();
					}

					this.installColumnHandler();
				},
				async messagesFocus(){
					let w = this.getQNoteSuitableWindow();
					if(w.gFolderDisplay && w.gFolderDisplay.tree){
						w.gFolderDisplay.tree.focus();
						//w = Services.wm.getMostRecentWindow("mail:3pane");
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
					var window = this.getQNoteSuitableWindow();

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
							if(!focus && window.gFolderDisplay && window.gFolderDisplay.tree){
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
						// before_start, before_end, after_start, after_end,
						// start_before, start_after, end_before, end_after
						// overlap, after_pointer

						let anchor = null;

						// threadPaneBox, messagepanewrapper, status-bar, folderPaneBox
						// anchor = window.document.getElementById('folderPaneBox');
						// if(!anchor){
						// 	anchor = null;
						// }

						// console.log("anchor", anchor);
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
				},
				async installQuickFilter(){
					// TODO: need to re-think better solution
					wex.loadAllQAppNotes().then(() => {
						NoteFilter.install({
							noteGrabber: noteGrabber
						});
					});
				},
				async installColumnHandler(){
					ColumnHandler.install({
						textLimit: wex.Prefs.showFirstChars,
						noteGrabber: noteGrabber
					});
				},
				async updateView(){
					let w = this.getQNoteSuitableWindow();
					let gFolderDisplay = w.gFolderDisplay;
					if(gFolderDisplay){
						let view = gFolderDisplay.view.dbView;
						//let rangeCount = treeSelection.getRangeCount();
						//console.log("updateView", view.rowCount, gFolderDisplay.tree.currentIndex, view.currentlyDisplayedMessage);
						// nsIMsgDBView.idl
						// NoteChange(nsMsgViewIndex, PRInt32, nsMsgViewNotificationCodeValue)
						// const nsMsgViewNotificationCodeValue changed = 2;
						/**
						 * Notify tree that rows have changed.
						 *
						 * @param aFirstLineChanged   first view index for changed rows.
						 * @param aNumRows            number of rows changed; < 0 means removed.
						 * @param aChangeType         changeType.
						 */
						// void NoteChange(in nsMsgViewIndex aFirstLineChanged, in long aNumRows,
						// 	in nsMsgViewNotificationCodeValue aChangeType);

						// TODO: probably a good idea to change all rows in a view or at least add func parameter
						view.NoteChange(view.currentlyDisplayedMessage, 1, 2);
					}
				},
				async attachNoteToMessage(data){
					let w = this.getMessageSuitableWindow();
					let messagepane = w.document.getElementById('messagepane');
					let document = messagepane.contentDocument;
					// let gFolderDisplay = w.gFolderDisplay;
					// let gMessageDisplay = w.gMessageDisplay;
					// let view;
					// if(gFolderDisplay){
					// 	view = gFolderDisplay.view.dbView;
					// }

					let body = document.getElementsByTagName('body');
					if(body){
						body = body[0];
					} else {
						return;
					}

					let domNodes = document.getElementsByClassName('qnote-insidenote');
					while(domNodes.length){
						domNodes[0].remove();
					}

					if(!data || !wex.Prefs.enableMessageAttach){
						return;
					}

					let formated = formatQNoteHTML(data);

					let css = `<style>
					.qnote-title {
						color: black;
						background-color: #fff08d;
						display: flex;
						align-items: baseline;
						font-size: small;
						font-weight: bolder;
						border: solid 1px #d19231;
						margin: 0;
						padding: 6px;
					}
					.qnote-text {
						color: black;
						box-sizing: border-box;
						margin: 0;
						padding: 6px;
						background-color: #FBFEBF;
						border: solid 1px #FAF098;
					}
					</style>`;

					let html = `<div class="qnote-insidenote">
						${css}
						<div class="qnote-title">${formated.title}</div>
						<div class="qnote-text">${formated.text}</div>
					</div>`;

					if(wex.Prefs.messageAttachTop){
						body.insertAdjacentHTML('afterbegin', html);
					}

					if(wex.Prefs.messageAttachBottom){
						body.insertAdjacentHTML('beforeend', html);
					}
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
