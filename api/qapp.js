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
var formatQNoteData = data => {
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
	// text = text.replace(/\r\n/g, "<br>");
	// text = text.replace(/\n/g, "<br>");

	return {
		title: 'QNote: ' + (new Date(data.ts)).toLocaleString(),
		text: '<pre class="moz-quote-pre" wrap="" style="margin: 0;">' + text + '</pre>'
	}
};

function uninstallQNoteCSS() {
	try {
		let cssService = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
		let uri = Services.io.newURI(extension.getURL("html/background.css"), null, null);
		if(cssService.sheetRegistered(uri, cssService.USER_SHEET)){
			console.debug("Unregistering html/background.css");
			cssService.unregisterSheet(uri, cssService.USER_SHEET);
		}
	} catch(e) {
		console.error(e);
	}
}

function installQNoteCSS() {
	try {
		let cssService = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
		let uri = Services.io.newURI(extension.getURL("html/background.css"), null, null);
		if(!cssService.sheetRegistered(uri, cssService.USER_SHEET)){
			console.debug("Registering html/background.css");
			cssService.loadAndRegisterSheet(uri, cssService.USER_SHEET);
		}
	} catch(e) {
		console.error(e);
	}
}

var qapp = class extends ExtensionCommon.ExtensionAPI {
	onShutdown() {
		console.debug("QNote.shutdown()");

		uninstallQNoteCSS();

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
		var wex;
		//var QAppWindowObserver = this.QAppWindowObserver;
		//var MsgMsgDisplayed = this.MsgMsgDisplayed;

		var noteGrabber = {
			noteBlocker: new Map(),
			noteCache: new Map(),
			saveNoteCache(note){
				noteGrabber.noteCache.set(note.keyId, note);
			},
			getNoteCache(keyId){
				return noteGrabber.noteCache.get(keyId);
			},
			deleteNoteCache(keyId){
				noteGrabber.noteCache.delete(keyId);
			},
			clearNoteCache(){
				noteGrabber.noteCache = new Map();
			},
			// function listener(keyId, data, params)
			//  keyId - note key
			//  data - note data
			//  params - misc params passed to getNote()
			getNote(keyId, listener){
				let data = noteGrabber.getNoteCache(keyId);
				if(data){
					return Object.assign({}, data);
				} else {
					let blocker = noteGrabber.noteBlocker;

					// Block concurrent calls on same note as we will update column once it has been loded from local cache, local storage or file
					// Not 100% sure if necessary but calls to column update can be quite many
					if(blocker.has(keyId)){
						wex.qcon.debug(`blocker.has(${keyId})`);
					} else {
						blocker.set(keyId, true);
						// We'll update cache and call listener once note arrives
						wex.getQAppNoteData(keyId).then(data => {
							noteGrabber.saveNoteCache(data);
							if(listener){
								listener(keyId, data);
							}
						}).finally(() => {
							wex.qcon.debug(`blocker.delete(${keyId})`);
							// Unblock concurrent calls
							blocker.delete(keyId);
						});
					}

					// return empty object to keep getNote() call synchronous
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
					var messageUrisToPrint;
					let printerWindowDOMListener = e => {
						let document = e.target;

						let body = document.getElementsByTagName('body');
						if(body.length){
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

						let msg = messenger.msgHdrFromURI(messageUrisToPrint.shift());
						let note = noteGrabber.getNote(msg.messageId);
						if(!note || !note.exists){
							return;
						}

						let formatted = formatQNoteData(note);

						let htmlFormatter = (title, text) => {
							let html = ['<div class="qnote-insidenote" style="margin: 0; padding: 0; border: 1px solid black;">'];
							if(title){
								html.push(`<div style="border-bottom: 1px solid black;">${title}</div>`);
							}
							if(text){
								html.push(`<div>${text}</div>`);
							}
							html.push('</div>');

							return html.join("");
						};

						if(wex.Prefs.printAttachTop){
							let html = htmlFormatter(
								wex.Prefs.printAttachTopTitle ? formatted.title : false,
								wex.Prefs.printAttachTopText ? formatted.text : false,
							);
							body.insertAdjacentHTML('afterbegin', html);
						}

						if(wex.Prefs.printAttachBottom){
							let html = htmlFormatter(
								wex.Prefs.printAttachBottomTitle ? formatted.title : false,
								wex.Prefs.printAttachBottomText ? formatted.text : false,
							);
							body.insertAdjacentHTML('beforeend', html);
						}
					};

					let domLoadedListener = e => {
						let document = e.target;
						if(!document.URL.includes('chrome://messenger/content/msgPrintEngine')){
							return;
						}

						messageUrisToPrint = document.defaultView.arguments[1];

						let pDocument = document.getElementById('content');
						if(!pDocument){
							console.log("Print content not found");
							return;
						}

						pDocument.addEventListener("DOMContentLoaded", printerWindowDOMListener);
					};

					aSubject.addEventListener("DOMContentLoaded", domLoadedListener);
				},
				async init(){
					console.debug("qapp.init()");

					wex = Components.utils.waiveXrays(context.cloneScope);

					// Remove old style after upgrade
					uninstallQNoteCSS();
					installQNoteCSS();

					this.popups = new Map();

					//Services.obs.addObserver(MsgMsgDisplayed, "MsgMsgDisplayed");

					Services.ww.registerNotification(QAppWindowObserver);
					QAppWindowObserver.addListener('domwindowopened', this.printerQNoteAttacher);

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
				async popupUpdate(id, opt){
					if(!this.popups.has(id)){
						return false;
					}

					let n = this.popups.get(id);
					let window = n.window;
					let w = {
						left: window.screenLeft,
						top: window.screenTop,
						width: window.outerWidth,
						height: window.outerHeight
					}

					// TODO: move to separate function
					if(!opt.left){
						opt.left = Math.round((w.width - w.left) / 2);
					}

					if(!opt.top){
						opt.top = Math.round((w.height - w.top) / 2);
					}

					opt.left += w.left;
					opt.top += w.top;

					n.moveTo(opt.left, opt.top);
					n.sizeTo(opt.width, opt.height);

					return true;
				},
				async popupClose(id){
					if(this.popups.has(id)){
						this.popups.get(id).close();
						this.popups.delete(id);
						return true;
					} else {
						return false;
					}
				},
				async popupIsFocused(id){
					if(this.popups.has(id)){
						return this.popups.get(id).isFocused();
					}
				},
				async popupFocus(id){
					if(this.popups.has(id)){
						return this.popups.get(id).focus();
					}
				},
				async popup(opt){
					var self = this;
					var window = this.getQNoteSuitableWindow();

					let escaper = e => {
						if(e.key === 'Escape'){
							if(wex.CurrentNote.windowId){
								wex.CurrentNote.needSaveOnClose = false;
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
				},
				async installQuickFilter(){
					console.log("search has been temporarily disabled until we found a better solution");
					// TODO: need to re-think better solution
					// wex.loadAllQAppNotes().then(() => {
					// 	NoteFilter.install({
					// 		noteGrabber: noteGrabber
					// 	});
					// });
				},
				async installColumnHandler(){
					ColumnHandler.install({
						textLimit: wex.Prefs.showFirstChars,
						noteGrabber: noteGrabber
					});
				},
				async updateView(keyId){
					let w = this.getQNoteSuitableWindow();
					let aFolderDisplay = w.gFolderDisplay;
					if(aFolderDisplay && aFolderDisplay.view && aFolderDisplay.view.dbView){
						let view = aFolderDisplay.view.dbView;
						let row;

						if(keyId && view.db){
							let msgHdr = view.db.getMsgHdrForMessageID(keyId);
							if(msgHdr){
								row = view.findIndexOfMsgHdr(msgHdr, false);
							}
						} else {
							row = view.currentlyDisplayedMessage;
						}

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
						// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsITreeBoxObject#invalidateCell
						view.NoteChange(row, 1, 2);
					}
				},
				async attachNoteToMessage(data){
					let w = this.getMessageSuitableWindow();
					let messagepane = w.document.getElementById('messagepane');
					if(!messagepane){
						return;
					}
					let document = messagepane.contentDocument;

					let body = document.getElementsByTagName('body');
					if(body.length){
						body = body[0];
					} else {
						return;
					}

					// Cleanup attached notes
					let domNodes = document.getElementsByClassName('qnote-insidenote');
					while(domNodes.length){
						domNodes[0].remove();
					}

					let aMessageDisplay = w.gMessageDisplay;

					// Bail if no data or trying to attach to alien message
					if(
						!data || !data.exists ||
						!aMessageDisplay ||
						aMessageDisplay.displayedMessage.messageId !== data.keyId
					) {
						return;
					}

					let formatted = formatQNoteData(data);

					let htmlFormatter = (title, text) => {
						let html = [];
						if(title){
							html.push(`<div class="qnote-title">${title}</div>`);
						}
						if(text){
							html.push(`<div class="qnote-text">${text}</div>`);
						}

						return html.join("");
					};

					if(wex.Prefs.messageAttachTop){
						let html = htmlFormatter(
							wex.Prefs.messageAttachTopTitle ? formatted.title : false,
							wex.Prefs.messageAttachTopText ? formatted.text : false,
						);
						body.insertAdjacentHTML('afterbegin', '<div class="qnote-insidenote qnote-insidenote-top">' + html + '</div>');
					}

					if(wex.Prefs.messageAttachBottom){
						let html = htmlFormatter(
							wex.Prefs.messageAttachBottomTitle ? formatted.title : false,
							wex.Prefs.messageAttachBottomText ? formatted.text : false,
						);
						body.insertAdjacentHTML('beforeend', '<div class="qnote-insidenote qnote-insidenote-bottom">' + html + '</div>');
					}
				},
				async saveNoteCache(note){
					noteGrabber.saveNoteCache(note);
				},
				async clearNoteCache(){
					noteGrabber.clearNoteCache();
				},
				async deleteNoteCache(keyId){
					noteGrabber.deleteNoteCache(keyId);
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
