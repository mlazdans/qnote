import { IQAppPreferences } from "../modules/api.mjs";
import { INoteData } from "../modules/Note.mjs";

var { ExtensionParent }                       = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var { MailServices }                          = ChromeUtils.import("resource:///modules/MailServices.jsm");
var { ThreadPaneColumns }                     = ChromeUtils.importESModule("chrome://messenger/content/ThreadPaneColumns.mjs");
var { QNoteFilter, QNoteAction, QCustomTerm } = ChromeUtils.importESModule("resource://qnote/modules-exp/QNoteFilters.mjs");
var { QEventDispatcher }                      = ChromeUtils.importESModule("resource://qnote/modules/QEventDispatcher.mjs");
var { QCache }                                = ChromeUtils.importESModule("resource://qnote/modules/QCache.mjs");

var QDEB = true;
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

class QAppEventDispatcher extends QEventDispatcher<{
	domwindowopened: (aSubject: MozWindow, aTopic: string, aData: any) => void,
	domwindowclosed: (aSubject: MozWindow, aTopic: string, aData: any) => void,
	keydown: (e: KeyboardEvent) => void,
	onShutdown: () => void,
	domcomplete: (aSubject: MozWindow, aTopic: string, aData: any, e: Event) => void,
}> {}

class QApp extends ExtensionCommon.ExtensionAPI {
	noteGrabber
	EventDispatcher
	WindowObserver
	Prefs: IQAppPreferences | null

	customTermId = 'qnote@dqdp.net#qnoteText'
	customTerm
	customAction
	customFilter

	constructor(...args: ConstructorParameters<typeof ExtensionCommon.ExtensionAPI>){
		// TODO: do some experiments
		// context.messageManager.sendAsyncMessage("ex:customui:onEvent",
		// 	{type: message.data.type, token: message.data.token, result});
		// });

		const fName = "new qapp()";
		QDEB&&console.debug(`${fName}`);
		super(...args);

		var API = this;

		// We'll update cache and call listener once item arrives
		// Caller must install onNoteRequest listener before init()
		QDEB&&console.debug("Installing noteGrabber");
		this.noteGrabber = new QCache();

		QDEB&&console.debug("Installing custom term");
		this.customTerm = new QCustomTerm();

		QDEB&&console.debug("Installing custom action");
		this.customAction = new QNoteAction(this.noteGrabber);

		QDEB&&console.debug("Installing filters");
		this.customFilter = new QNoteFilter();

		this.Prefs = null;

		this.EventDispatcher = new QAppEventDispatcher();

		this.WindowObserver = {
			observe: function(aSubject: MozWindow, aTopic: string, aData: any) {
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
						let document = e.target as XULDocument;

						if(document === null){
							return;
						}

						QDEB&&console.debug(`${fName} [DOMContentLoaded]`, document.URL);

						// TODO: broken with TB > 115, disabling for now
						// Attach to QuickFilter
						// if(document.URL.includes('chrome://messenger/content/messenger')){
						// 	if(API.QNoteFilter && document.getElementById('tabmail')){
						// 		API.QNoteFilter.attachToWindow(aSubject, document);
						// 	}
						// }

						// // Attach to SearchDialog
						if(API.customFilter && (
							document.URL.includes('chrome://messenger/content/SearchDialog') ||
							document.URL.includes('chrome://messenger/content/virtualFolderProperties')
						)){
							API.customFilter.searchDialogHandler(aSubject, document);
						}

						// Attach to FilterEditor
						if(API.customFilter && API.customAction && document.URL.includes('chrome://messenger/content/FilterEditor')){
							API.customFilter.searchDialogHandler(aSubject, document);
							API.customAction.filterEditorHandler(aSubject, document);
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

	uninstallCSS(cssUri: string) {
		try {
			let cssService = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
			let uri = Services.io.newURI(extension.getURL(cssUri), null, null);
			if(cssService.sheetRegistered(uri, cssService.USER_SHEET)){
				QDEB&&console.debug(`Unregistering ${cssUri}`);
				cssService.unregisterSheet(uri, cssService.USER_SHEET);
			}
		} catch (e: any) {
			console.error("uninstallCSS() failed:", e);
		}
	}

	installCSS(cssUri: string) {
		try {
			let cssService = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
			let uri = Services.io.newURI(extension.getURL(cssUri), null, null);
			if(!cssService.sheetRegistered(uri, cssService.USER_SHEET)){
				QDEB&&console.debug(`Registering ${cssUri}`);
				cssService.loadAndRegisterSheet(uri, cssService.USER_SHEET);
			}
		} catch (e: any) {
			console.error("installCSS() failed:", e);
		}
	}

	onShutdown(isAppShutdown: boolean) {
		console.debug("QNote.shutdown()");

		if (isAppShutdown) {
			return;
		}

		Services.ww.unregisterNotification(this.WindowObserver);

		this.EventDispatcher.fireListeners("onShutdown");
		this.uninstallCSS("html/background.css");
		// if(this.QNoteFilter){
		// 	this.QNoteFilter.uninstall();
		// }

		if(this.customAction){
			this.customAction.uninstall();
		}
	}

	// Legacy column
	// updateView(w, keyId){
	// 	let fName = `qapp.updateView(w, ${keyId})`;

	// 	if(!w || !w.document){
	// 		w = Services.wm.getMostRecentWindow("mail:3pane")
	// 	}

	// 	if(!w || !w.document){
	// 		QDEB&&console.debug(`${fName} - no window`);
	// 		return;
	// 	}

	// 	let mainPopupSet = w.document.getElementById('mainPopupSet');
	// 	if(!mainPopupSet){
	// 		QDEB&&console.debug(`${fName} - no mainPopupSet`);
	// 		return;
	// 	}

	// 	let aFolderDisplay = w.gFolderDisplay;
	// 	if(!(aFolderDisplay && aFolderDisplay.view && aFolderDisplay.view.dbView)){
	// 		QDEB&&console.debug(`${fName} - no dbView`);
	// 		return;
	// 	}

	// 	let view = aFolderDisplay.view.dbView;
	// 	let row;

	// 	if(keyId && view.db){
	// 		let msgHdr = view.db.getMsgHdrForMessageID(keyId);
	// 		if(msgHdr){
	// 			row = view.findIndexOfMsgHdr(msgHdr, false);
	// 		}
	// 	} else {
	// 		row = view.currentlyDisplayedMessage;
	// 	}

	// 	//let rangeCount = treeSelection.getRangeCount();
	// 	// nsIMsgDBView.idl
	// 	// NoteChange(nsMsgViewIndex, PRInt32, nsMsgViewNotificationCodeValue)
	// 	// const nsMsgViewNotificationCodeValue changed = 2;
	// 	/**
	// 	 * Notify tree that rows have changed.
	// 	 *
	// 	 * @param aFirstLineChanged   first view index for changed rows.
	// 	 * @param aNumRows            number of rows changed; < 0 means removed.
	// 	 * @param aChangeType         changeType.
	// 	 */
	// 	// void NoteChange(in nsMsgViewIndex aFirstLineChanged, in long aNumRows,
	// 	// 	in nsMsgViewNotificationCodeValue aChangeType);

	// 	// MAYBE: probably a good idea to change all rows in a view or at least add func parameter
	// 	// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsITreeBoxObject#invalidateCell
	// 	view.NoteChange(row, 1, 2);
	// }

	getAPI(context: any) {
		let API: QApp = this;
		let focusSavedElement: Element | null = null;

		context.callOnClose(API);

		return {
			qapp: {
				onNoteRequest: new ExtensionCommon.EventManager({
					context,
					name: "qapp.onNoteRequest",
					register: (fire: ExtensionCommon.Fire) => {
						// It makes sense to allow only one note requester
						API.noteGrabber.setProvider(keyId => {
							return fire.async(keyId);
						});

						return () => {
						}
					}
				}).api(),
				async focusSave() {
					focusSavedElement = Services.focus.focusedElement;
				},
				async focusRestore() {
					if(focusSavedElement){
						try {
							Services.focus.setFocus(focusSavedElement, 0);
						} catch (e: any) {
							console.error("focusRestore() failed:", e);
						}
					} else {
						console.warn("focusSavedWindow or focusSavedElement is not set");
					}
				},
				async init(prefs: IQAppPreferences){
					QDEB&&console.debug("qapp.init()");
					this.setPrefs(prefs);

					// Remove old style sheet in case it still lay around, for example, after update
					API.uninstallCSS("html/background.css");
					API.installCSS("html/background.css");

					Services.ww.registerNotification(API.WindowObserver);

					let w = Services.wm.getMostRecentWindow("mail:3pane");

					if(ThreadPaneColumns && ThreadPaneColumns.getColumn('qnote') === null){
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
							textCallback: function(msgHdr: any){
								// TODO: batch multiple note requests
								let note = API.noteGrabber.get(msgHdr.messageId, () => {
									ThreadPaneColumns.refreshCustomColumn("qnote");
								});

								return note ? note.text : null;
							},
							iconCellDefinitions: iconCellDefinitions,
							iconHeaderUrl: extension.baseURI.resolve("resource://qnote/images/icon-column.png"),
							iconCallback: function(msgHdr: any){
								let note = API.noteGrabber.get(msgHdr.messageId, () => {
									ThreadPaneColumns.refreshCustomColumn("qnote");
								});

								return note ? "qnote_exists" : "qnote_off";
							}
						});
					} else {
						QDEB&&console.log("ThreadPaneColumn already exists");
					}

					QDEB&&console.debug("Installing custom term");

					if(MailServices.filters.getCustomTerm(API.customTermId)){
						QDEB&&console.log(`CustomTerm ${API.customTermId} already defined`);
					} else {
						QDEB&&console.log(`Defining CustomTerm ${API.customTermId}`);
						MailServices.filters.addCustomTerm(API.customTerm);
					}

					// TODO: broken with TB > 115, disabling for now
					// API.QNoteFilter = new QNoteFilter({
					// 	API: API,
					// 	QDEB: QDEB,
					// 	w: w
					// });

					// QDEB&&console.debug("Installing custom action");
					// API.QNoteAction = new QNoteAction({
					// 	API: API,
					// });
				},
				async setDebug(on: boolean){
					QDEB = on;
				},
				async setPrefs(prefs: IQAppPreferences){
					API.Prefs = prefs;

					API.customAction.storageFolder = prefs.storageFolder;
					API.customFilter.storageFolder = prefs.storageFolder;
					API.customTerm.storageFolder = prefs.storageFolder;

					// TODO: currently it is not possible to have text and icon simultaneously
					// if(ThreadPaneColumns){
					// } else {
					// 	API.ColumnHandler.columnHandler.limit = Prefs.showFirstChars;
					// }
				},
				async updateColumsView() {
					// TODO: it does not update sometimes
					ThreadPaneColumns?.refreshCustomColumn("qnote");
				},
				// async updateView(windowId: number, keyId: string){
				// 	let w = null;
				// 	if(windowId) {
				// 		w = API.id2RealWindow(windowId);
				// 	}

				// 	API.updateView(w, keyId);
				// },
				// async attachNotesToMultiMessage(windowId: number, notes: Array<NoteData>){
				// 	// TODO: does not work with TB128
				// 	let fName = `qapp.attachNotesToMultiMessage(${windowId})`;

				// 	// if(!notes){
				// 	// 	QDEB&&console.debug(`${fName} - no note data`);
				// 	// 	return;
				// 	// }

				// 	let w = API.id2RealWindow(windowId);
				// 	if(!w || !w.document){
				// 		QDEB&&console.debug(`${fName} - no window`);
				// 		return;
				// 	}

				// 	let messagepane = w.document.getElementById('multimessage') as any;
				// 	if(!messagepane || !messagepane.contentDocument){
				// 		QDEB&&console.debug(`${fName} - no multimessage`);
				// 		return;
				// 	}

				// 	/**
				// 	 * @type Document
				// 	 */
				// 	let document = messagepane.contentDocument;
				// 	let cw = messagepane.contentWindow;
				// 	// let messenger = w.messenger;
				// 	let aFolderDisplay = w.gFolderDisplay;
				// 	if(!(aFolderDisplay && aFolderDisplay.view && aFolderDisplay.view.dbView)){
				// 		QDEB&&console.debug(`${fName} - no dbView`);
				// 		return;
				// 	}

				// 	if(!cw || !cw.gMessageSummary || !cw.gMessageSummary._msgNodes){
				// 		QDEB&&console.debug(`${fName} - no gMessageSummary`);
				// 		return;
				// 	}

				// 	let view = aFolderDisplay.view.dbView;
				// 	let summaryNodes = cw.gMessageSummary._msgNodes;

				// 	document.querySelectorAll(".qnote-mm").forEach((e: HTMLElement) => {
				// 		e.remove();
				// 	});

				// 	if(summaryNodes){
				// 		notes.forEach(note => {
				// 			let msgHdr = view.db.getMsgHdrForMessageID(note.keyId);
				// 			if(msgHdr){
				// 				// summaryKey based on mail\base\content\multimessageview.js
				// 				let summaryKey = msgHdr.messageKey + msgHdr.folder.URI;
				// 				if(note.exists && summaryNodes[summaryKey]){
				// 					let row = summaryNodes[summaryKey].querySelector('.item_header');
				// 					if(row){
				// 						let qNote = document.createElement('span');
				// 						qNote.classList.add("qnote-mm");

				// 						row.appendChild(qNote);
				// 					}
				// 				}
				// 			}
				// 		});
				// 	}
				// },
				async saveNoteCache(keyId: string, note: INoteData){
					API.noteGrabber.set(keyId, note);
				},
				async clearNoteCache(){
					API.noteGrabber.clear();
				},
				async deleteNoteCache(keyId: string){
					API.noteGrabber.delete(keyId);
				},
				async getProfilePath() {
					return Cc["@mozilla.org/file/directory_service;1"]
						.getService(Ci.nsIProperties)
						.get('ProfD', Ci.nsIFile)
						.path
					;
				},
				async createStoragePath() {
					let path = Cc["@mozilla.org/file/directory_service;1"]
						.getService(Ci.nsIProperties)
						.get('ProfD', Ci.nsIFile)
					;
					path.appendRelativePath('QNote');
					if(!path.exists()){
						try {
							path.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
						} catch (e: any) {
							console.error("path.create() failed:", e);
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

var qapp = QApp;
