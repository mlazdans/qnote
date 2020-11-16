var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var { NoteColumnHandler } = ChromeUtils.import(extension.rootURI.resolve("modules/NoteColumnHandler.jsm"));
var { NotePopup } = ChromeUtils.import(extension.rootURI.resolve("modules/NotePopup.jsm"));
var { NoteFilter } = ChromeUtils.import(extension.rootURI.resolve("modules/NoteFilter.jsm"));
var { QEventDispatcher } = ChromeUtils.import(extension.rootURI.resolve("modules/QEventDispatcher.js"));
var { QCache } = ChromeUtils.import(extension.rootURI.resolve("modules/QCache.js"));

// TODO: get rid of wex
// TODO: get rid of globals
var QDEB = true;
var QAppColumnHandler;
var QAppEventDispatcher = new QEventDispatcher(["domwindowopened","domwindowclosed","DOMContentLoaded",]);
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

		QAppColumnHandler.detachFromWindow(Services.wm.getMostRecentWindow("mail:3pane"));

		//NoteFilter.uninstall();

		Services.ww.unregisterNotification(QAppWindowObserver);

		Components.utils.unload(extension.rootURI.resolve("modules/NoteColumnHandler.jsm"));
		Components.utils.unload(extension.rootURI.resolve("modules/NotePopup.jsm"));
		Components.utils.unload(extension.rootURI.resolve("modules/NoteFilter.jsm"));
		Components.utils.unload(extension.rootURI.resolve("modules/QEventDispatcher.js"));
		Components.utils.unload(extension.rootURI.resolve("modules/QCache.js"));
	}

	getAPI(context) {
		var wex = Cu.waiveXrays(context.cloneScope);

		QDEB = !!wex.Prefs.enableDebug;

		// We'll update cache and call listener once item arrives
		// MAYBE: send down function from WebExtension
		var noteGrabber = new QCache(wex.getQAppNoteData);

		function id2RealWindow(windowId){
			try {
				return extension.windowManager.get(windowId).window;
			} catch {
			}
		}

		var colHandler = {
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

				let limit = wex.Prefs.showFirstChars;
				if(note.exists && !note.shortText && limit && (typeof note.text === 'string')){
					note.shortText = note.text.substring(0, limit);
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
				printerQNoteAttacher(aSubject) {
					var messageUrisToPrint;
					let printerWindowDOMListener = e => {
						let document = e.target;

						let body = document.getElementsByTagName('body');
						if(body.length){
							body = body[0];
						} else {
							QDEB&&console.debug("print - body not found");
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
						let note = noteGrabber.get(msg.messageId);
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
							body.insertAdjacentHTML('afterbegin', html + "<br>");
						}

						if(wex.Prefs.printAttachBottom){
							let html = htmlFormatter(
								wex.Prefs.printAttachBottomTitle ? formatted.title : false,
								wex.Prefs.printAttachBottomText ? formatted.text : false,
							);
							body.insertAdjacentHTML('beforeend', "<br>" + html);
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
							QDEB&&console.debug("print - content not found");
							return;
						}

						pDocument.addEventListener("DOMContentLoaded", printerWindowDOMListener);
					};

					aSubject.addEventListener("DOMContentLoaded", domLoadedListener);
				},
				async init(){
					QDEB&&console.debug("qapp.init()");

					// Remove old style sheet in case it still lay around, for example, after update
					uninstallQNoteCSS();
					installQNoteCSS();

					this.popups = new Map();

					Services.ww.registerNotification(QAppWindowObserver);

					QAppEventDispatcher.addListener('domwindowopened', this.printerQNoteAttacher);

					if(wex.Prefs.enableSearch){
						this.installQuickFilter();
					}

					this.installColumnHandler();
				},
				async messagePaneFocus(windowId){
					let w = id2RealWindow(windowId);
					if(w && w.gFolderDisplay && w.gFolderDisplay.tree){
						w.gFolderDisplay.tree.focus();
					}
				},
				installColumnHandler(){
					this.setColumnTextLimit(wex.Prefs.showFirstChars);
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
				// TODO: keep track of windows
				async updateView(windowId, keyId){
					let fName = `${this.constructor.name}.updateView()`;

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

					// TODO: probably a good idea to change all rows in a view or at least add func parameter
					// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsITreeBoxObject#invalidateCell
					view.NoteChange(row, 1, 2);
				},
				async attachNoteToMessage(windowId, data){
					let fName = `${this.constructor.name}.attachNoteToMessage()`;

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

					QDEB&&console.debug(`${fName}, windowId:`, windowId);

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
						!aMessageDisplay.displayedMessage ||
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
					noteGrabber.set(note.keyId, note);
				},
				async clearNoteCache(){
					noteGrabber.clear();
				},
				async deleteNoteCache(keyId){
					noteGrabber.delete(keyId);
				},
				// MAYBE: remove?
				async setColumnTextLimit(limit){
					// console.log(`setColumnTextLimit(${limit})`);
					// colHandler.limit = limit;
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
