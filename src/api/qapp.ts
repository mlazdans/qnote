import { IQAppPreferences } from "../modules/common.mjs";

var { ExtensionParent }                       = ChromeUtils.importESModule("resource://gre/modules/ExtensionParent.sys.mjs");
var { MailServices }                          = ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
var { ThreadPaneColumns }                     = ChromeUtils.importESModule("chrome://messenger/content/ThreadPaneColumns.mjs");
var { QNoteFilter, QNoteAction, QCustomTerm } = ChromeUtils.importESModule("resource://qnote/modules-exp/QNoteFilters.mjs?version=version");
var { QEventDispatcher }                      = ChromeUtils.importESModule("resource://qnote/modules/QEventDispatcher.mjs?version=version");
var { getFolderNoteData }                     = ChromeUtils.importESModule("resource://qnote/modules-exp/api.mjs?version=version");

var QDEB = true;
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var debugHandle = "[qnote:qapp]";

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
	customTerm: typeof QCustomTerm.prototype
	customAction: typeof QNoteAction.prototype
	customFilter: typeof QNoteFilter.prototype

	constructor(...args: ConstructorParameters<typeof ExtensionCommon.ExtensionAPI>){
		// TODO: do some experiments
		// context.messageManager.sendAsyncMessage("ex:customui:onEvent",
		// 	{type: message.data.type, token: message.data.token, result});
		// });

		QDEB&&console.log(`${debugHandle} new QApp()`);

		super(...args);

		QDEB&&console.debug(`${debugHandle} installing custom term`);
		this.customTerm = new QCustomTerm();

		QDEB&&console.debug(`${debugHandle} installing custom action`);
		this.customAction = new QNoteAction();

		QDEB&&console.debug(`${debugHandle} installing filters`);
		this.customFilter = new QNoteFilter();

		this.Prefs = null;

		this.EventDispatcher = new QAppEventDispatcher();

		const API = this;
		const windowObserverDebugHandle = `${debugHandle}[WindowObserver]`;
		this.WindowObserver = {
			observe: function(aSubject: MozWindow, aTopic: string, aData: any) {
				QDEB&&console.debug(`${windowObserverDebugHandle} ${aTopic}`, aSubject.document.URL);

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

						QDEB&&console.debug(`${windowObserverDebugHandle} DOMContentLoaded`, document.URL);

						// TODO: broken with TB > 115, disabling for now
						// Attach to QuickFilter
						// if(document.URL.includes('chrome://messenger/content/messenger')){
						// 	if(API.QNoteFilter && document.getElementById('tabmail')){
						// 		API.QNoteFilter.attachToWindow(aSubject, document);
						// 	}
						// }

						// TB bug workaround: SearchDialog's threadPane.updateColumns() iterates
						// ThreadPaneColumns.getDefaultColumns() (which includes custom columns) but,
						// unlike about3Pane, never creates row template cells for custom columns,
						// so it crashes on `cell.hidden`. Add the missing cells before its "load" handler runs.
						// NOTE: file was renamed SearchDialog.xhtml -> searchDialog.xhtml at some point, match case-insensitively
						const url = document.URL.toLowerCase();
						const isSearchDialog = url.includes('chrome://messenger/content/searchdialog');
						const isVirtualFolderProperties = url.includes('chrome://messenger/content/virtualfolderproperties');
						if(isSearchDialog){
							API.addCustomColumnCells(document);
						}

						// // Attach to SearchDialog
						if(API.customFilter && (isSearchDialog || isVirtualFolderProperties)){
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

	// Mirrors about3Pane's threadPane.makeCustomColumnCell()
	addCustomColumnCells(document: Document) {
		const template = document.getElementById("threadPaneRowTemplate") as HTMLTemplateElement | null;
		if(!template || !ThreadPaneColumns){
			return;
		}

		// SearchDialog is a XUL document: plain createElement() would yield XUL elements (no dataset etc.)
		const XHTML_NS = "http://www.w3.org/1999/xhtml";

		try {
			for(const column of ThreadPaneColumns.getDefaultColumns().filter((c: any) => c.custom)){
				const columnName = column.id.toLowerCase();
				if(template.content.querySelector(`.${columnName}-column`)){
					continue;
				}

				const cell = document.createElementNS(XHTML_NS, "td") as HTMLTableCellElement;
				cell.classList.add(`${columnName}-column`);
				cell.setAttribute("data-column-name", columnName);
				if(column.icon && column.iconCellDefinitions){
					cell.classList.add("button-column");
					for(const { id, url, title, alt } of column.iconCellDefinitions){
						const img = document.createElementNS(XHTML_NS, "img") as HTMLImageElement;
						img.setAttribute("data-cell-icon-id", id);
						img.setAttribute("src", url);
						img.setAttribute("alt", alt || "");
						img.setAttribute("title", title || "");
						img.setAttribute("hidden", "hidden");
						cell.appendChild(img);
					}
				}
				template.content.appendChild(cell);
				QDEB&&console.debug(`${debugHandle} added SearchDialog row template cell for custom column:`, column.id);
			}
		} catch(e: any) {
			console.error(`${debugHandle} addCustomColumnCells() failed:`, e);
		}
	}

	// https://developer.thunderbird.net/add-ons/mailextensions/experiments#managing-your-experiments-lifecycle
	onShutdown(isAppShutdown: boolean) {
		QDEB&&console.debug(`${debugHandle} shutdown`);

		if (isAppShutdown) {
			return;
		}

		Services.obs.notifyObservers(null, "startupcache-invalidate");

		if(ThreadPaneColumns){
			ThreadPaneColumns.removeCustomColumn('qnote');
			ThreadPaneColumns.removeCustomColumn('qnote-text');
		}

		// this.uninstallCSS("html/background.css");

		if(this.customAction){
			this.customAction.uninstall();
		}

		Services.ww.unregisterNotification(this.WindowObserver);
	}

	getAPI(context: any) {
		const API: QApp = this;
		let focusSavedElement: Element | null = null;

		return {
			qapp: {
				async saveFocus() {
					focusSavedElement = Services.focus.focusedElement;
				},
				async restoreFocus() {
					if(focusSavedElement){
						try {
							Services.focus.setFocus(focusSavedElement, 0);
						} catch (e: any) {
							console.error(`${debugHandle} restoreFocus() failed:`, e);
						}
					} else {
						QDEB&&console.warn(`${debugHandle} focusSavedElement is not set`);
					}
				},
				async init(prefs: IQAppPreferences){
					QDEB&&console.debug(`${debugHandle} init()`);
					this.setPrefs(prefs);

					// Remove old style sheet in case it still lay around, for example, after update
					// API.uninstallCSS("html/background.css");
					// API.installCSS("html/background.css");

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

						QDEB&&console.log(`${debugHandle} ThreadPaneColumns.addCustomColumn("qnote")`);
						ThreadPaneColumns.addCustomColumn('qnote', {
							name: "QNote",
							hidden: false,
							icon: true,
							resizable: true,
							sortable: true,
							textCallback: function(msgHdr: any){
								if(API.Prefs?.storageFolder){
									const note = getFolderNoteData(msgHdr.messageId, API.Prefs.storageFolder);
									return note?.text ?? "";
								} else {
									return "";
								}
							},
							iconCellDefinitions: [icon, icon2],
							iconHeaderUrl: extension.baseURI.resolve("resource://qnote/images/icons/qnote.svg?version=version"),
							iconCallback: function(msgHdr: any){
								if(API.Prefs?.storageFolder){
									return getFolderNoteData(msgHdr.messageId, API.Prefs.storageFolder) ? "qnote_exists" : "qnote_off";
								} else {
									return 'qnote_off';
								}
							}
						});
					} else {
						QDEB&&console.debug(`${debugHandle} qnote column already exists`);
					}

					QDEB&&console.log(`${debugHandle} ThreadPaneColumns.addCustomColumn("qnote-text")`);
					if(ThreadPaneColumns && ThreadPaneColumns.getColumn('qnote-text') == null){
						ThreadPaneColumns.addCustomColumn('qnote-text', {
							name: "QText",
							hidden: true,
							resizable: true,
							sortable: true,
							textCallback: function(msgHdr: any){
								if(API.Prefs?.storageFolder){
									const note = getFolderNoteData(msgHdr.messageId, API.Prefs.storageFolder);
									if(note?.text){
										return note.text.substring(0, API.Prefs.showFirstChars ?? 3);
									}
								}
								return "";
							},
						});
					} else {
						QDEB&&console.debug(`${debugHandle} qnote-text column already exists`);
					}

					if(MailServices.filters.getCustomTerm(API.customTermId)){
						QDEB&&console.debug(`${debugHandle} custom term already exists:`, API.customTermId);
					} else {
						QDEB&&console.debug(`${debugHandle} installing custom term:`, API.customTermId);
						MailServices.filters.addCustomTerm(API.customTerm);
					}
				},
				async setPrefs(prefs: IQAppPreferences){
					API.Prefs = prefs;
					QDEB = prefs.enableDebug;
					API.customAction.setStorageFolder(prefs.storageFolder);
					API.customFilter.setStorageFolder(prefs.storageFolder);
					API.customTerm.setStorageFolder(prefs.storageFolder);
				},
				async updateColumsView() {
					if(ThreadPaneColumns){
						ThreadPaneColumns.refreshCustomColumn("qnote");
						ThreadPaneColumns.refreshCustomColumn("qnote-text");
					}
				},
				async attachNotesToMultiMessage(keys: Array<string>){
					const fName = `${debugHandle}[attachNotesToMultiMessage]`;

					const w = Services.wm.getMostRecentWindow("mail:3pane");
					if(!w || !w.document){
						QDEB&&console.log(`${fName} window not found, bail`);
						return;
					}

					const browser = w.document.querySelector("browser[src='about:3pane']") as any;
					if(!browser){
						QDEB&&console.log(`${fName} about:3pane browser element not found, bail`);
						return;
					}

					if(!browser.contentDocument){
						QDEB&&console.log(`${fName} browser.contentDocument not found, bail`);
						return;
					}

					const multiMessageBrowser = browser.contentDocument.getElementById('multiMessageBrowser') as any;
					if(!multiMessageBrowser){
						QDEB&&console.log(`${fName} multiMessageBrowser not found, bail`);
						return;
					}

					const document = multiMessageBrowser.contentDocument as Document
					if(!document){
						QDEB&&console.log(`${fName} multiMessageBrowser.contentDocument not found, bail`);
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
							console.error(`${debugHandle} createStoragePath() failed:`, e);
							return undefined;
						}
					}
					return path.path;
				}
			}
		}
	}
}

var qapp = QApp;
