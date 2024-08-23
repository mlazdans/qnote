var Services = globalThis.Services || ChromeUtils.import(
  "resource://gre/modules/Services.jsm"
).Services;
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var { QNotePopup } = ChromeUtils.import("resource://qnote/modules/QNotePopup.js");
var { QNoteFilter } = ChromeUtils.import("resource://qnote/modules/QNoteFilter.js");
var { QNoteAction } = ChromeUtils.import("resource://qnote/modules/QNoteAction.js");
var { QEventDispatcher } = ChromeUtils.import("resource://qnote/modules/QEventDispatcher.js");
var { QCache } = ChromeUtils.import("resource://qnote/modules/QCache.js");

var ThreadPaneColumns;
try {
	({ ThreadPaneColumns } = ChromeUtils.importESModule("chrome://messenger/content/thread-pane-columns.mjs"));
} catch (err) {
	try {
		({ ThreadPaneColumns } = ChromeUtils.importESModule("chrome://messenger/content/ThreadPaneColumns.mjs"));
	} catch (err) {
	}
}

Services.scriptloader.loadSubScript(extension.rootURI.resolve("scripts/notifyTools.js"), null, "UTF-8");

var QDEB = true;
var qapp = class extends ExtensionCommon.ExtensionAPI {
	constructor(...args){
		let fName = "new qapp()";
		QDEB&&console.debug(`${fName}`);
		super(...args);

		var API = this;

		// We'll update cache and call listener once item arrives
		// init() caller must install onNoteRequest listener
		this.noteGrabber = new QCache();
		this.Prefs = {};

		this.EventDispatcher = new QEventDispatcher(["domwindowopened", "domwindowclosed", "keydown", "onShutdown", "domcomplete"]);
		this.KeyboardHandler = {
			windows: new WeakSet(),
			addTo: w => {
				let fName = "KeyboardHandler.addTo()";
				QDEB&&console.debug(`${fName} - attaching...`);

				let kh = API.KeyboardHandler;

				if(kh.windows.has(w)){
					QDEB&&console.debug(`${fName} - already exists`);
				} else if(
					w &&
					w.document &&
					w.document.URL &&
					w.document.URL.includes('chrome://messenger/content/messenger') ||
					w.document.URL.includes('chrome://messenger/content/messageWindow')
				) {
					w.addEventListener("keydown", kh.handler);
					kh.windows.add(w);
					API.EventDispatcher.addListener('onShutdown', () => {
						kh.removeFrom(w);
					});

					QDEB&&console.debug(`${fName} - attached!`);

					return true;
				} else {
					QDEB&&console.debug(`${fName} - not attachable`);
				}

				return false;
			},
			removeFrom: w => {
				let fName = "KeyboardHandler.removeFrom()";
				QDEB&&console.debug(`${fName} - removing...`);

				let kh = API.KeyboardHandler;

				if(kh.windows.has(w)){
					w.removeEventListener("keydown", kh.handler)
					kh.windows.delete(w);

					QDEB&&console.debug(`${fName} - removed!`);

					return true;
				} else {
					QDEB&&console.debug(`${fName} - does not exist`);
				}

				return false;
			},
			handler: e => {
				// QDEB&&console.debug("KeyboardHandler.handler()", e.code);
				API.EventDispatcher.fireListeners("keydown", e);
			}
		}

		this.WindowObserver = {
			observe: function(aSubject, aTopic, aData) {
				let fName = "qapp.WindowObserver.observe()";
				QDEB&&console.debug(`${fName} ${aTopic}`, aSubject.document.URL);

				if(aTopic === 'domwindowopened' || aTopic === 'domwindowclosed'){
					API.EventDispatcher.fireListeners(aTopic, aSubject, aTopic, aData);
				}

				if(aTopic === 'domwindowopened'){
					aSubject.addEventListener("load", e => {
						API.EventDispatcher.fireListeners("domcomplete", aSubject, aTopic, aData, e);
					}, {
						once: true
					});
				}

				if(aTopic === 'domwindowopened'){
					aSubject.addEventListener("DOMContentLoaded", e => {
						let document = e.target;

						QDEB&&console.debug(`${fName} [DOMContentLoaded]`, document.URL);

						// Attach to QuickFilter
						if(document.URL.includes('chrome://messenger/content/messenger')){
							if(API.QNoteFilter && document.getElementById('tabmail')){
								API.QNoteFilter.attachToWindow(aSubject, document);
							}
						}

						// Attach to SearchDialog
						if(API.QNoteFilter && (
							document.URL.includes('chrome://messenger/content/SearchDialog') ||
							document.URL.includes('chrome://messenger/content/virtualFolderProperties')
						)){
							API.QNoteFilter.searchDialogHandler(aSubject, document);
						}

						// Attach to FilterEditor
						if(API.QNoteFilter && API.QNoteAction && document.URL.includes('chrome://messenger/content/FilterEditor')){
							API.QNoteFilter.searchDialogHandler(aSubject, document);
							API.QNoteAction.filterEditorHandler(aSubject, document);
						}

						// Multi message view
						if(document.URL.includes('chrome://messenger/content/multimessageview')){
							// console.log("multimessageview", aSubject, document);
						}
					});
				}
			}
		};
	}

	uninstallCSS(cssUri) {
		try {
			let cssService = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
			let uri = Services.io.newURI(extension.getURL(cssUri), null, null);
			if(cssService.sheetRegistered(uri, cssService.USER_SHEET)){
				QDEB&&console.debug(`Unregistering ${cssUri}`);
				cssService.unregisterSheet(uri, cssService.USER_SHEET);
			}
		} catch(e) {
			console.error(e);
		}
	}

	installCSS(cssUri) {
		try {
			let cssService = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
			let uri = Services.io.newURI(extension.getURL(cssUri), null, null);
			if(!cssService.sheetRegistered(uri, cssService.USER_SHEET)){
				QDEB&&console.debug(`Registering ${cssUri}`);
				cssService.loadAndRegisterSheet(uri, cssService.USER_SHEET);
			}
		} catch(e) {
			console.error(e);
		}
	}

	installKeyboardHandler(w){
		let kf = this.KeyboardHandler;

		kf.addTo(w);

		this.EventDispatcher.addListener('domcomplete', aWindow => kf.addTo(aWindow));
	}

	uninstallKeyboardHandler(w){
		this.KeyboardHandler.removeFrom(w);
	}

	onShutdown(isAppShutdown) {
		console.debug("QNote.shutdown()");

		if (isAppShutdown) {
			return;
		}

		Services.ww.unregisterNotification(this.WindowObserver);

		this.EventDispatcher.fireListeners("onShutdown");
		this.uninstallCSS("html/background.css");
		if(this.QNoteFilter){
			this.QNoteFilter.uninstall();
		}

		if(this.QNoteAction){
			this.QNoteAction.uninstall();
		}
	}

	id2RealWindow(w){
		try {
			return Number.isInteger(w) ? extension.windowManager.get(w).window : w;
		} catch {
		}
	}

	updateView(w, keyId){
		if(ThreadPaneColumns){
			ThreadPaneColumns.refreshCustomColumn("qnote");
			return;
		}

		let fName = `qapp.updateView(w, ${keyId})`;

		if(!w || !w.document){
			w = Services.wm.getMostRecentWindow("mail:3pane")
		}

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
	}

	getStorageFolder(){
		return this.Prefs.storageOption == "folder" ? this.Prefs.storageFolder : "";
	}

	// Not used currently
	// realWindowWrap(realWindow){
	// 	try {
	// 		return extension.windowManager.getWrapper(realWindow);
	// 	} catch {
	// 	}
	// }

	getAPI(context) {
		var API = this;
		context.callOnClose(API);

		return {
			qapp: {
				onNoteRequest: new ExtensionCommon.EventManager({
					context,
					name: "qapp.onNoteRequest",
					register: fire => {
						// It makes sense to allow only one note requester
						API.noteGrabber.setProvider(keyId => {
							return fire.async(keyId);
						});

						return () => {
						}
					}
				}).api(),
				onKeyDown: new ExtensionCommon.EventManager({
					context,
					name: "qapp.onKeyDown",
					register: fire => {
						let interested = ["altKey", "code", "ctrlKey", "isComposing", "key", "location", "metaKey", "repeat", "shiftKey"];
						const l = e => {
							let e1 = {};
							for(let k of interested){
								// e1[k] = e[k] !== undefined ? e[k] : undefined;
								e1[k] = e[k];
							}

							let e2 = fire.sync(e1);

							// MAYBE: implement some other features
							if(e2.preventDefault){
								e.preventDefault();
							}

							return e2;
						};

						API.EventDispatcher.addListener("keydown", l);

						return () => {
							API.EventDispatcher.removeListener("keydown", l);
						};
					}
				}).api(),
				// TODO: pass windowId
				async init(options){
					QDEB&&console.debug("qapp.init()");

					// Remove old style sheet in case it still lay around, for example, after update
					API.uninstallCSS("html/background.css");
					API.installCSS("html/background.css");

					Services.ww.registerNotification(API.WindowObserver);

					let w = Services.wm.getMostRecentWindow("mail:3pane");

					if(ThreadPaneColumns){
						const icon = {
							id: "qnote_exists",
							url: extension.baseURI.resolve("resource://qnote/images/icon-column.png"),
						};
						const icon2 = {
							id: "qnote_off",
							url: extension.baseURI.resolve("resource://qnote/images/1x1.gif"),
						};
						const iconCellDefinitions = [icon, icon2];

						QDEB&&console.log("ThreadPaneColumns.addCustomColumn");
						ThreadPaneColumns.addCustomColumn('qnote', {
							name: "QNote",
							hidden: false,
							icon: true,
							resizable: true,
							sortable: true,
							textCallback: function(msgHdr){
								let note = API.noteGrabber.get(msgHdr.messageId, () => {
									ThreadPaneColumns.refreshCustomColumn("qnote");
								});

								return note.exists ? note.text : null;
							},
							iconCellDefinitions: iconCellDefinitions,
							iconHeaderUrl: extension.baseURI.resolve("resource://qnote/images/icon-column.png"),
							iconCallback: function(msgHdr){
								let note = API.noteGrabber.get(msgHdr.messageId, () => {
									ThreadPaneColumns.refreshCustomColumn("qnote");
								});

								return note.exists ? "qnote_exists" : "qnote_off";
							}
						});
					}

					API.installKeyboardHandler(w);

					// TODO: probably window not needed. Should scan suitable windows instead
					QDEB&&console.debug("Installing custom filter");
					API.QNoteFilter = new QNoteFilter({
						API: API,
						QDEB: QDEB,
						w: w
					});

					QDEB&&console.debug("Installing custom action");
					API.QNoteAction = new QNoteAction({
						API: API,
					});

					API.EventDispatcher.addListener('domwindowopened', aSubject => {
						this.printerAttacher(aSubject);
					});
				},
				async setDebug(on){
					QDEB = on;
				},
				async setPrefs(Prefs){
					API.Prefs = Prefs;

					// TODO: currently it is not possible to have text and icon simultaneously
					// if(ThreadPaneColumns){
					// } else {
					// 	API.ColumnHandler.columnHandler.limit = Prefs.showFirstChars;
					// }
				},
				async attachNoteToPrinter(windowId, data){
					let fName = "qapp.attachNoteToPrinter()";

					if(!API.Prefs.printAttachTop && !API.Prefs.printAttachBottom){
						QDEB&&console.debug(`${fName} - no prefs`);
						return;
					}

					if(!(data && data.exists)){
						QDEB&&console.debug(`${fName} - no note`);
						return;
					}

					let w = API.id2RealWindow(windowId);
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

					if(API.Prefs.printAttachTop){
						body.insertAdjacentHTML(
							'afterbegin',
							'<div class="qnote-insidenote qnote-insidenote-top" style="margin: 0; padding: 0; border: 1px solid black;">' +
								this.applyTemplate(API.Prefs.attachTemplate, data) +
							'</div>'
						);

						const el = document.querySelector('.qnote-insidenote-top .qnote-text-span');
						if(el){
							if(API.Prefs.treatTextAsHtml){
								el.innerHTML = data.text;
							} else {
								el.textContent = data.text;
							}
						}
					}

					if(API.Prefs.printAttachBottom){
						body.insertAdjacentHTML(
							'beforeend',
							'<div class="qnote-insidenote qnote-insidenote-bottom" style="margin: 0; padding: 0; border: 1px solid black;">' +
								this.applyTemplate(API.Prefs.attachTemplate, data) +
							'</div>'
						);

						const el = document.querySelector('.qnote-insidenote-bottom .qnote-text-span');
						if(el){
							if(API.Prefs.treatTextAsHtml){
								el.innerHTML = data.text;
							} else {
								el.textContent = data.text;
							}
						}
					}
				},
				// We need this step to grab messageUrisToPrint list
				printerAttacher(aSubject) {
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

						self.attachNoteToPrinter(document.defaultView, API.noteGrabber.get(msg.messageId));
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
					let w = API.id2RealWindow(windowId);
					if(w && w.gFolderDisplay && w.gFolderDisplay.tree){
						w.gFolderDisplay.tree.focus();
					}
				},
				async updateView(windowId, keyId){
					let w = null;
					if(windowId) {
						w = API.id2RealWindow(windowId);
					}

					API.updateView(w, keyId);
				},
				applyTemplate(t, data) {
					return t
						.replace("{{ qnote_date }}", data.tsFormatted)
						.replace("{{ qnote_text }}", '<span class="qnote-text-span"></span>')
					;
				},
				async attachToMessagePane(messagepane, aMessageDisplay, data){
					let fName = `qapp.attachToMessagePane()`;

					if(!API.Prefs.messageAttachTop && !API.Prefs.messageAttachBottom){
						QDEB&&console.debug(`${fName} - no prefs`);
						return;
					}

					if(!messagepane || !messagepane.contentDocument){
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

					if(!aMessageDisplay) {
						QDEB&&console.debug(`${fName} - no MessageDisplay`);
						return;
					}

					// Bail if no data or trying to attach to alien message
					if(aMessageDisplay.messageId !== data.keyId){
						QDEB&&console.debug(`${fName} - trying to attach to alien message`);
						return;
					}

					QDEB&&console.debug(`${fName}`);

					// Cleanup attached notes
					let domNodes = document.getElementsByClassName('qnote-insidenote');
					while(domNodes.length){
						domNodes[0].remove();
					}

					// Return after cleanup, if note deleted
					if(!data.exists){
						QDEB&&console.debug(`${fName} - note doest no exist`);
						return;
					}

					if(API.Prefs.messageAttachTop){
						body.insertAdjacentHTML(
							'afterbegin',
							'<div class="qnote-insidenote qnote-insidenote-top">' +
								this.applyTemplate(API.Prefs.attachTemplate, data) +
							'</div>'
						);

						const el = document.querySelector('.qnote-insidenote-top .qnote-text-span');
						if(el){
							if(API.Prefs.treatTextAsHtml){
								el.innerHTML = data.text;
							} else {
								el.textContent = data.text;
							}
						}
					}

					if(API.Prefs.messageAttachBottom){
						body.insertAdjacentHTML(
							'beforeend',
							'<div class="qnote-insidenote qnote-insidenote-bottom">' +
								this.applyTemplate(API.Prefs.attachTemplate, data) +
							'</div>'
						);

						const el = document.querySelector('.qnote-insidenote-bottom .qnote-text-span');
						if(el){
							if(API.Prefs.treatTextAsHtml){
								el.innerHTML = data.text;
							} else {
								el.textContent = data.text;
							}
						}
					}

					// Double click on embedded message
					document.querySelectorAll('.qnote-insidenote').forEach(function(e, i){
						e.addEventListener("dblclick", function(){
							notifyTools.notifyBackground({
								command: "pop",
								messageId: data.keyId
							});
							return false;
						});
					});
				},
				async attachNoteToMessage(windowId, data){
					return;
					let fName = `qapp.attachNoteToMessage(${windowId})`;

					if(!API.Prefs.messageAttachTop && !API.Prefs.messageAttachBottom){
						QDEB&&console.debug(`${fName} - no prefs`);
						return;
					}

					if(!data){
						QDEB&&console.debug(`${fName} - no note data`);
						return;
					}

					let w = API.id2RealWindow(windowId);
					if(!w || !w.document){
						QDEB&&console.debug(`${fName} - no window`);
						return;
					}

					let messagepane;
					let aMessageDisplay;

					// about:message, new window
					if(w.messageBrowser && w.messageBrowser.contentWindow){
						let mailMessageWindow = w.messageBrowser.contentWindow;

						messagepane = mailMessageWindow.document.getElementById('messagepane');
						aMessageDisplay = mailMessageWindow.gMessage;
						this.attachToMessagePane(messagepane, aMessageDisplay, data);
					} else if(w.gTabmail){
						// TODO: Update only changed tab. Now we iterate through all mail tabs.
						w.gTabmail.tabInfo.filter(
							t => t.mode.name == "mailMessageTab"
						).map(t => {
							let mailMessageWindow = t.chromeBrowser.contentWindow;

							messagepane = mailMessageWindow.document.getElementById('messagepane');
							aMessageDisplay = mailMessageWindow.gMessage;

							this.attachToMessagePane(messagepane, aMessageDisplay, data);
						});

						// Current pane
						if(w.gTabmail.currentAbout3Pane){
							let mail3PaneWindow = w.gTabmail.currentAbout3Pane;
							let mailMessageWindow = mail3PaneWindow.messageBrowser.contentWindow

							messagepane = mailMessageWindow.document.getElementById('messagepane');
							aMessageDisplay = mailMessageWindow.gMessage;

							this.attachToMessagePane(messagepane, aMessageDisplay, data);
						}
					} else if(w.gMessageDisplay && w.gMessageDisplay.displayedMessage) {
						// Legacy
						messagepane = w.document.getElementById('messagepane');
						aMessageDisplay = w.gMessageDisplay.displayedMessage;
						this.attachToMessagePane(messagepane, aMessageDisplay, data);
					}
				},
				/**
				 * @param {number} windowId
				 * @param {Array} NoteArray
				 */
				async attachNotesToMultiMessage(windowId, NoteArray){
					// TODO: does not work with TB128
					let fName = `qapp.attachNotesToMultiMessage(${windowId})`;

					if(!NoteArray){
						QDEB&&console.debug(`${fName} - no note data`);
						return;
					}

					let w = API.id2RealWindow(windowId);
					if(!w || !w.document){
						QDEB&&console.debug(`${fName} - no window`);
						return;
					}

					let messagepane = w.document.getElementById('multimessage');
					if(!messagepane || !messagepane.contentDocument){
						QDEB&&console.debug(`${fName} - no multimessage`);
						return;
					}

					/**
					 * @type Document
					 */
					let document = messagepane.contentDocument;
					let cw = messagepane.contentWindow;
					// let messenger = w.messenger;
					let aFolderDisplay = w.gFolderDisplay;
					if(!(aFolderDisplay && aFolderDisplay.view && aFolderDisplay.view.dbView)){
						QDEB&&console.debug(`${fName} - no dbView`);
						return;
					}

					if(!cw || !cw.gMessageSummary || !cw.gMessageSummary._msgNodes){
						QDEB&&console.debug(`${fName} - no gMessageSummary`);
						return;
					}

					let view = aFolderDisplay.view.dbView;
					let summaryNodes = cw.gMessageSummary._msgNodes;

					document.querySelectorAll(".qnote-mm").forEach(e => {
						e.remove();
					});

					if(summaryNodes){
						NoteArray.forEach(note => {
							let msgHdr = view.db.getMsgHdrForMessageID(note.keyId);
							if(msgHdr){
								// summaryKey based on mail\base\content\multimessageview.js
								let summaryKey = msgHdr.messageKey + msgHdr.folder.URI;
								if(note.exists && summaryNodes[summaryKey]){
									let row = summaryNodes[summaryKey].querySelector('.item_header');
									if(row){
										let qNote = document.createElement('span');
										qNote.classList.add("qnote-mm");

										row.appendChild(qNote);
									}
								}
							}
						});
					}
				},
				async saveNoteCache(note){
					API.noteGrabber.set(note.keyId, note);
				},
				async clearNoteCache(){
					API.noteGrabber.clear();
				},
				async deleteNoteCache(keyId){
					API.noteGrabber.delete(keyId);
				},
				async getProfilePath() {
					return Cc['@mozilla.org/file/directory_service;1']
						.getService(Ci.nsIProperties)
						.get('ProfD', Ci.nsIFile)
						.path
					;
				},
				async createStoragePath() {
					let path = Cc['@mozilla.org/file/directory_service;1']
						.getService(Ci.nsIProperties)
						.get('ProfD', Ci.nsIFile)
					;
					path.appendRelativePath('QNote');
					if(!path.exists()){
						try {
							path.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
						} catch (e) {
							console.error(e);
						}
					}
					return path.path;
				}
			}
		}
	}
	close() {
		ThreadPaneColumns.removeCustomColumn('qnote');
	}
}
