import { IQAppPreferences } from "../modules/common.mjs";
import { INoteData } from "../modules/Note.mjs";

var { ExtensionParent }                       = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var { MailServices }                          = ChromeUtils.import("resource:///modules/MailServices.jsm");
var { ThreadPaneColumns }                     = ChromeUtils.importESModule("chrome://messenger/content/ThreadPaneColumns.mjs");
var { QNoteFilter, QNoteAction, QCustomTerm } = ChromeUtils.importESModule("resource://qnote/modules-exp/QNoteFilters.mjs");
var { QEventDispatcher }                      = ChromeUtils.importESModule("resource://qnote/modules/QEventDispatcher.mjs");
var { QNoteFile } = ChromeUtils.importESModule("resource://qnote/modules-exp/QNoteFile.mjs");
var { XNoteFile } = ChromeUtils.importESModule("resource://qnote/modules-exp/XNoteFile.mjs");

var QDEB = true;
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

class QAppEventDispatcher extends QEventDispatcher<{
	domwindowopened: (aSubject: MozWindow, aTopic: string, aData: any) => void,
	domwindowclosed: (aSubject: MozWindow, aTopic: string, aData: any) => void,
	keydown: (e: KeyboardEvent) => void,
	domcomplete: (aSubject: MozWindow, aTopic: string, aData: any, e: Event) => void,
}> {}

class QApp extends ExtensionCommon.ExtensionAPI {
	EventDispatcher: QAppEventDispatcher
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

		QDEB&&console.debug("Installing custom term");
		this.customTerm = new QCustomTerm();

		QDEB&&console.debug("Installing custom action");
		this.customAction = new QNoteAction();

		QDEB&&console.debug("Installing filters");
		this.customFilter = new QNoteFilter();

		this.Prefs = null;

		this.EventDispatcher = new QAppEventDispatcher();

		// TODO: Is this used anymore?
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

	// https://developer.thunderbird.net/add-ons/mailextensions/experiments#managing-your-experiments-lifecycle
	onShutdown(isAppShutdown: boolean) {
		console.debug("QNote.shutdown(), isAppShutdown:", isAppShutdown);

		if (isAppShutdown) {
			return;
		}

		Services.obs.notifyObservers(null, "startupcache-invalidate");

		if(ThreadPaneColumns){
			ThreadPaneColumns.removeCustomColumn('qnote');
		}

		this.uninstallCSS("html/background.css");

		if(this.customAction){
			this.customAction.uninstall();
		}

		Services.ww.unregisterNotification(this.WindowObserver);
	}

	getAPI(context: any) {
		let API: QApp = this;
		let focusSavedElement: Element | null = null;

		// TODO: code dup in filters
		function getFolderNoteData(keyId: string): INoteData | null {
			if(!API.Prefs?.storageFolder){
				return null;
			}

			const QN = new QNoteFile;
			const XN = new XNoteFile;

			let note = QN.load(API.Prefs.storageFolder, keyId);

			if(!note){
				note = XN.load(API.Prefs.storageFolder, keyId);
			}

			return note;
		}

		return {
			qapp: {
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

					if(ThreadPaneColumns && ThreadPaneColumns.getColumn('qnote') == null){
						const icon = {
							id: "qnote_exists",
							url: extension.baseURI.resolve("resource://qnote/images/icons/qnote.svg"),
						};
						const icon2 = {
							id: "qnote_off",
							url: extension.baseURI.resolve("resource://qnote/images/1x1.gif"),
						};

						QDEB&&console.log("ThreadPaneColumns.addCustomColumn");
						ThreadPaneColumns.addCustomColumn('qnote', {
							name: "QNote",
							hidden: false,
							icon: true,
							resizable: true,
							sortable: true,
							textCallback: function(msgHdr: any){
								const note = getFolderNoteData(msgHdr.messageId);
								return note ? note.text : null;
							},
							iconCellDefinitions: [icon, icon2],
							iconHeaderUrl: extension.baseURI.resolve("resource://qnote/images/icons/qnote.svg"),
							iconCallback: function(msgHdr: any){
								return getFolderNoteData(msgHdr.messageId) ? "qnote_exists" : "qnote_off";
							}
						});
					} else {
						QDEB&&console.debug("qnote column already exists");
					}

					if(ThreadPaneColumns && ThreadPaneColumns.getColumn('qnote-text') == null){
						ThreadPaneColumns.addCustomColumn('qnote-text', {
							name: "QText",
							hidden: true,
							resizable: true,
							sortable: true,
							textCallback: function(msgHdr: any){
								const note = getFolderNoteData(msgHdr.messageId);
								if(note?.text){
									return note.text.substring(0, API.Prefs?.showFirstChars ?? 3);
								} else {
									return null;
								}
							},
						});
					} else {
						QDEB&&console.debug("qnote-text column already exists");
					}

					QDEB&&console.debug("Installing custom term");

					if(MailServices.filters.getCustomTerm(API.customTermId)){
						QDEB&&console.debug(`CustomTerm ${API.customTermId} already defined`);
					} else {
						QDEB&&console.debug(`Defining CustomTerm ${API.customTermId}`);
						MailServices.filters.addCustomTerm(API.customTerm);
					}
				},
				async setDebug(on: boolean){
					QDEB = on;
				},
				async setPrefs(prefs: IQAppPreferences){
					API.Prefs = prefs;
					API.customAction.storageFolder = prefs.storageFolder;
					API.customFilter.storageFolder = prefs.storageFolder;
					API.customTerm.storageFolder = prefs.storageFolder;
				},
				async updateColumsView() {
					if(ThreadPaneColumns){
						ThreadPaneColumns.refreshCustomColumn("qnote");
						ThreadPaneColumns.refreshCustomColumn("qnote-text");
					}
				},
				async attachNotesToMultiMessage(keys: Array<string>){
					const fName = `qapp.attachNotesToMultiMessage()`;

					const w = Services.wm.getMostRecentWindow("mail:3pane");
					if(!w || !w.document){
						QDEB&&console.log(`${fName}: window not found, bail`);
						return;
					}

					const browser = w.document.querySelector("browser[src='about:3pane']") as any;
					if(!browser){
						QDEB&&console.log(`${fName}: about:3pane browser element not found, bail`);
						return;
					}

					if(!browser.contentDocument){
						QDEB&&console.log(`${fName}: browser.contentDocument not found, bail`);
						return;
					}

					const multiMessageBrowser = browser.contentDocument.getElementById('multiMessageBrowser') as any;
					if(!multiMessageBrowser){
						QDEB&&console.log(`${fName}: multiMessageBrowser not found, bail`);
						return;
					}

					const document = multiMessageBrowser.contentDocument as Document
					if(!document){
						QDEB&&console.log(`${fName}: multiMessageBrowser.contentDocument not found, bail`);
						return;
					}

					const keySet = new Set(keys);
					const messageList = document.querySelectorAll("#messageList > li") as NodeListOf<HTMLLIElement>;
					document.querySelectorAll("#messageList span.qnote-mm").forEach(e => e.remove());
					for(const li of messageList){
						const keyId = li.dataset.messageId;
						const row = li.querySelector('.item-header');
						if(!keyId || !keySet.has(keyId) || !row || row.querySelector("span.qnote-mm")){
							continue;
						}

						const noteIndicator = document.createElement("span");
						noteIndicator.classList.add("qnote-mm");
						row.appendChild(noteIndicator);
					}
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
}

var qapp = QApp;
