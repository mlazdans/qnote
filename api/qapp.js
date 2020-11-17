var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var { NoteColumnHandler } = ChromeUtils.import(extension.rootURI.resolve("modules/NoteColumnHandler.jsm"));
var { NotePopup } = ChromeUtils.import(extension.rootURI.resolve("modules/NotePopup.jsm"));
var { NoteFilter } = ChromeUtils.import(extension.rootURI.resolve("modules/NoteFilter.jsm"));
var { QEventDispatcher } = ChromeUtils.import(extension.rootURI.resolve("modules/QEventDispatcher.js"));
var { QCache } = ChromeUtils.import(extension.rootURI.resolve("modules/QCache.js"));

var QDEB = true;
var QAppColumnHandler;
var QAppEventDispatcher = new QEventDispatcher(["domwindowopened","domwindowclosed","DOMContentLoaded"]);
var QAppWindowObserver = {
	observe: function(aSubject, aTopic, aData) {
		if(aTopic === 'domwindowopened' || aTopic === 'domwindowclosed'){
			QAppEventDispatcher.fireListeners(aTopic, aSubject, aTopic, aData);
		}

		if(aTopic === 'domwindowopened'){
			aSubject.addEventListener("DOMContentLoaded", e => {
				QAppEventDispatcher.fireListeners("DOMContentLoaded", aSubject, aTopic, aData, e);
			});
		}
	}
};

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
			QDEB&&console.debug("Unregistering html/background.css");
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
			QDEB&&console.debug("Registering html/background.css");
			cssService.loadAndRegisterSheet(uri, cssService.USER_SHEET);
		}
	} catch(e) {
		console.error(e);
	}
}

var qapp = class extends ExtensionCommon.ExtensionAPI {
	onShutdown() {
		QDEB&&console.debug("QNote.shutdown()");

		uninstallQNoteCSS();

		Services.obs.notifyObservers(null, "startupcache-invalidate", null);

		if(QAppColumnHandler){
			QAppColumnHandler.detachFromWindow(Services.wm.getMostRecentWindow("mail:3pane"));
		}

		Services.ww.unregisterNotification(QAppWindowObserver);

		Components.utils.unload(extension.rootURI.resolve("modules/NoteColumnHandler.jsm"));
		Components.utils.unload(extension.rootURI.resolve("modules/NotePopup.jsm"));
		Components.utils.unload(extension.rootURI.resolve("modules/NoteFilter.jsm"));
		Components.utils.unload(extension.rootURI.resolve("modules/QEventDispatcher.js"));
		Components.utils.unload(extension.rootURI.resolve("modules/QCache.js"));
	}

	getAPI(context) {
		// var wex = Cu.waiveXrays(context.cloneScope);
		var noteRequester;
		var noteGrabber;

		function id2RealWindow(windowId){
			try {
				return extension.windowManager.get(windowId).window;
			} catch {
			}
		}

		function realWindowWrap(realWindow){
			try {
				return extension.windowManager.getWrapper(realWindow);
			} catch {
			}
		}

		var colHandler = {
			limit: 0,
			noteRowListener(view, row) {
				if(view && Number.isInteger(row)){
					// That method is part of Mozilla API and has nothing to do with either XNote or QNote :)
					view.NoteChange(row, 1, 2);
				}
			},
			getMessageId(row, col){
				try {
					return this.getView(col).getMsgHdrAt(row).messageId;
				} catch {
				}
			},
			getView(col){
				try {
					return col.element.ownerGlobal.gDBView;
				} catch {
				}
			},
			isEditable(row, col) {
				return false;
			},
			// cycleCell(row, col) {
			// },
			getCellText(row, col) {
				let note = noteGrabber.get(this.getMessageId(row, col), () => {
					this.noteRowListener(this.getView(col), row);
				});

				if(note.exists && !note.shortText && this.limit && (typeof note.text === 'string')){
					note.shortText = note.text.substring(0, this.limit);
				}

				return note.exists ? note.shortText : null;
			},
			getSortStringForRow(hdr) {
				let note = noteGrabber.get(hdr.messageId);

				return note.exists ? note.text : null;
			},
			isString() {
				return true;
			},
			// getCellProperties(row, col, props){
			// },
			// getRowProperties(row, props){
			// },
			getImageSrc(row, col) {
				let note = noteGrabber.get(this.getMessageId(row, col), () => {
					this.noteRowListener(this.getView(col), row);
				});

				return note.exists ? extension.rootURI.resolve("images/icon-column.png") : null;
			},
			// getSortLongForRow(hdr) {
			// }
		};

		return {
			qapp: {
				onNoteRequest: new ExtensionCommon.EventManager({
					context,
					name: "qapp.onNoteRequest",
					register: fire => {
						// It makes sense to allow only one note requester
						noteRequester = (keyId) => {
							return fire.async(keyId);
						}
						return () => {
						}
					}
				}).api(),
				async init(){
					QDEB&&console.debug("qapp.init()");

					// Remove old style sheet in case it still lay around, for example, after update
					uninstallQNoteCSS();
					installQNoteCSS();

					// We'll update cache and call listener once item arrives
					// init() caller must install onNoteRequest listener
					noteGrabber = new QCache(noteRequester);

					this.popups = new Map();

					Services.ww.registerNotification(QAppWindowObserver);

					this.installColumnHandler();
				},
				async setDebug(on){
					QDEB = on;
				},
				async enablePrintAttacher(prefs){
					QDEB&&console.debug("qapp.enablePrintAttacher()", prefs);
					QAppEventDispatcher.addListener('domwindowopened', aSubject => {
						this.printerAttacher(aSubject, prefs);
					});
				},
				async attachNoteToPrinter(windowId, data, prefs){
					let fName = "qapp.attachNoteToPrinter()";

					if(!(data && data.exists)){
						QDEB&&console.debug(`${fName} - no note`);
						return;
					}

					if(!prefs){
						QDEB&&console.debug(`${fName} - no prefs`);
						return;
					}

					let w = Number.isInteger(windowId) ? id2RealWindow(windowId) : windowId;
					if(!w || !w.document){
						QDEB&&console.debug(`${fName} - no window`);
						return;
					}

					let body = w.document.getElementsByTagName('body');
					if(body.length){
						body = body[0];
					} else {
						QDEB&&console.debug(`${fName} - no BODY`);
						return;
					}

					QDEB&&console.debug(`${fName}`, data);

					// Cleanup attached notes
					let domNodes = w.document.getElementsByClassName('qnote-insidenote');
					while(domNodes.length){
						domNodes[0].remove();
					}

					let formatted = formatQNoteData(data);

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

					if(prefs.topTitle || prefs.topText){
						let html = htmlFormatter(
							prefs.topTitle ? formatted.title : false,
							prefs.topText ? formatted.text : false,
						);
						body.insertAdjacentHTML('afterbegin', html + "<br>");
					}

					if(prefs.bottomTitle || prefs.bottomText){
						let html = htmlFormatter(
							prefs.bottomTitle ? formatted.title : false,
							prefs.bottomText ? formatted.text : false,
						);
						body.insertAdjacentHTML('beforeend', "<br>" + html);
					}
				},
				printerAttacher(aSubject, prefs) {
					// Save list of printing urls
					var messageUrisToPrint;
					var self = this;

					let printerWindowDOMListener = e => {
						let document = e.target;

						// Not interested
						if(
							document.URL === 'about:blank' ||
							!aSubject.opener ||
							!aSubject.opener.messenger
						){
							return;
						}

						// If not uris to print
						if(!(messageUrisToPrint && messageUrisToPrint.shift)){
							return;
						}

						let messenger = aSubject.opener.messenger;

						// let msg = messenger.msgHdrFromURI(messageUrisToPrint.shift());
						let msg = messenger.msgHdrFromURI(messageUrisToPrint[0]);

						self.attachNoteToPrinter(document.defaultView, noteGrabber.get(msg.messageId), prefs);
					};

					let domLoadedListener = e => {
						let document = e.target;

						// Level 1 filter - check if this print or print-preview window
						if(!(document && document.URL.includes('chrome://messenger/content/msgPrintEngine'))){
							return;
						}

						let pDocument = document.getElementById('content');
						if(!pDocument){
							return;
						}

						messageUrisToPrint = document.defaultView.arguments[1];

						pDocument.addEventListener("DOMContentLoaded", printerWindowDOMListener);
					};

					aSubject.addEventListener("DOMContentLoaded", domLoadedListener);
				},
				async messagePaneFocus(windowId){
					let w = id2RealWindow(windowId);
					if(w && w.gFolderDisplay && w.gFolderDisplay.tree){
						w.gFolderDisplay.tree.focus();
					}
				},
				installColumnHandler(){
					QAppColumnHandler = new NoteColumnHandler({
						columnHandler: colHandler
					});

					QAppColumnHandler.setDebug(QDEB);
					QAppColumnHandler.attachToWindow(Services.wm.getMostRecentWindow("mail:3pane"));

					QAppEventDispatcher.addListener('DOMContentLoaded', (aSubject, aTopic, aData) => {
						QAppColumnHandler.attachToWindow(aSubject);
					});

					QAppEventDispatcher.addListener('domwindowclosed', (aSubject, aTopic, aData) => {
						QAppColumnHandler.detachFromWindow(aSubject);
					});
				},
				async installQuickFilter(){
					console.warn("search has been temporarily disabled until we found a better solution");
					// TODO: need to re-think better solution
					// wex.loadAllQAppNotes().then(() => {
					// 	NoteFilter.install({
					// 		noteGrabber: noteGrabber
					// 	});
					// });
				},
				async updateView(windowId, keyId){
					let fName = "qapp.updateView()";

					let w = id2RealWindow(windowId);
					if(!w || !w.document){
						QDEB&&console.debug(`${fName} - no window`);
						return;
					}

					let mainPopupSet = w.document.getElementById('mainPopupSet');
					if(!mainPopupSet){
						QDEB&&console.debug(`${fName} - no mainPopupSet`);
						return;
					}

					let aFolderDisplay = w.gFolderDisplay;
					if(!(aFolderDisplay && aFolderDisplay.view && aFolderDisplay.view.dbView)){
						QDEB&&console.debug(`${fName} - no dbView`);
						return;
					}

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

					// MAYBE: probably a good idea to change all rows in a view or at least add func parameter
					// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsITreeBoxObject#invalidateCell
					view.NoteChange(row, 1, 2);
				},
				async attachNoteToMessage(windowId, data, prefs){
					let fName = "qapp.attachNoteToMessage()";

					if(!(data && data.exists)){
						QDEB&&console.debug(`${fName} - no note`);
						return;
					}

					if(!prefs){
						QDEB&&console.debug(`${fName} - no prefs`);
						return;
					}

					let w = id2RealWindow(windowId);
					if(!w || !w.document){
						QDEB&&console.debug(`${fName} - no window`);
						return;
					}

					let messagepane = w.document.getElementById('messagepane');
					if(!messagepane){
						QDEB&&console.debug(`${fName} - no messagepane`);
						return;
					}
					let document = messagepane.contentDocument;

					let body = document.getElementsByTagName('body');
					if(body.length){
						body = body[0];
					} else {
						QDEB&&console.debug(`${fName} - no BODY`);
						return;
					}

					let aMessageDisplay = w.gMessageDisplay;
					if(!(aMessageDisplay && aMessageDisplay.displayedMessage)) {
						QDEB&&console.debug(`${fName} - no MessageDisplay`);
						return;
					}

					// Bail if no data or trying to attach to alien message
					if(aMessageDisplay.displayedMessage.messageId !== data.keyId){
						QDEB&&console.debug(`${fName} - trying to attach to alien message`);
						return
					}

					QDEB&&console.debug(`${fName}`);

					// Cleanup attached notes
					let domNodes = document.getElementsByClassName('qnote-insidenote');
					while(domNodes.length){
						domNodes[0].remove();
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

					if(prefs.topTitle || prefs.topText){
						let html = htmlFormatter(
							prefs.topTitle ? formatted.title : false,
							prefs.topText ? formatted.text : false,
						);
						body.insertAdjacentHTML('afterbegin', '<div class="qnote-insidenote qnote-insidenote-top">' + html + '</div>');
					}

					if(prefs.bottomTitle || prefs.bottomText){
						let html = htmlFormatter(
							prefs.bottomTitle ? formatted.title : false,
							prefs.bottomText ? formatted.text : false,
						);
						body.insertAdjacentHTML('beforeend', '<div class="qnote-insidenote qnote-insidenote-bottom">' + html + '</div>');
					}
				},
				async saveNoteCache(note){
					noteGrabber.set(note.keyId, note);
				},
				async clearNoteCache(){
					noteGrabber.clear();
				},
				async deleteNoteCache(keyId){
					noteGrabber.delete(keyId);
				},
				async setColumnTextLimit(limit){
					colHandler.limit = limit;
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
