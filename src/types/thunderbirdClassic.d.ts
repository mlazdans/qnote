/*!
Copyright 2019 Brummolix (AutoarchiveReloaded, https://github.com/Brummolix/AutoarchiveReloaded )

 This file is part of AutoarchiveReloaded.

    AutoarchiveReloaded is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    AutoarchiveReloaded is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with AutoarchiveReloaded.  If not, see <http://www.gnu.org/licenses/>.
*/

//Attention this file should have NO global imports! Only local imports like import("./something").type are allowed
//otherwise TS creates code with import instead of simpy using the stuff
//see https://stackoverflow.com/questions/39040108/import-class-in-definition-file-d-ts

//Attention:
//this types are not complete! I only added, what is used by AutoarchiveReloaded at the moment!

/* eslint-disable @typescript-eslint/class-name-casing */
/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable max-classes-per-file */

//general---------------------------------------------------------------------------------------------------------

//define a Type "keyword"
//see https://github.com/Microsoft/TypeScript/issues/20719
// eslint-disable-next-line @typescript-eslint/type-annotation-spacing
type Type<T> = new(...args: any[]) => T;

//LegacyAddOn--------------------------------------------------------------------------------------------------

//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIJSCID
declare interface nsIJSCID
{
	getService<T>(type: Type<T>): T;
	createInstance<T>(type: Type<T>): T;
}

type IteratorUtilsPath = "resource:///modules/iteratorUtils.jsm";
type MailServicesPath = "resource:///modules/MailServices.jsm";
type ExtensionPopupsPath = "resource:///modules/ExtensionPopups.jsm";
// type ExtensionPopupsSysPath = "resource:///modules/ExtensionPopups.sys.mjs";
type ExtensionParentPath = "resource://gre/modules/ExtensionParent.jsm";
type ExtensionCommonPath = "resource://gre/modules/ExtensionCommon.jsm";
type QEventDispatcherPath = "resource://qnote/modules/QEventDispatcher.mjs";
type XULNoteWindowPath = "resource://qnote/modules/XULNoteWindow.mjs";
type DOMLocalizatorPath = "resource://qnote/modules/DOMLocalizator.mjs"
type QCachePath = "resource://qnote/modules/QCache.mjs"
type ThreadPaneColumnsPath = "chrome://messenger/content/ThreadPaneColumns.mjs";
type ThreadPaneColumnsOldPath = "chrome://messenger/content/thread-pane-columns.mjs"
type QNoteFilePath = "resource://qnote/modules-exp/QNoteFile.mjs";
type XNoteFilePath = "resource://qnote/modules-exp/XNoteFile.mjs";
type FileUtilsPath = "resource://gre/modules/FileUtils.jsm";
type ServicesPath = "resource://gre/modules/Services.jsm";

interface QEventDispatcherExport {
	QEventDispatcher: typeof import("../modules/QEventDispatcher.mjs").QEventDispatcher;
}

interface XULNoteWindowExport {
	QPopupOptions: import("../modules/XULNoteWindow.mjs").QPopupOptions;
}

interface DOMLocalizatorExport {
	DOMLocalizator: typeof import("../modules/DOMLocalizator.mjs").DOMLocalizator;
}

interface QCacheExport {
	QCache: typeof import("../modules/QCache.mts").QCache;
}

// interface FileUtilsExport {
// 	FileUtils: typeof FileUtils
// }

// const extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
interface ExtensionParentFire {
	// Bug 1754866 fire.sync doesn't match documentation.
	sync(...args: any): any
	async(...args: any): any
	raw(...args: any): any
	asyncWithoutClone(...args: any): any
}

interface Extension {
	windowManager: WindowManager
	localizeMessage(name: string): string
}

declare class GlobalManager {
	getExtension(name: string): Extension;
}

interface ExtensionParent {
	GlobalManager: GlobalManager;

}

interface ExtensionParentExport {
	ExtensionParent: ExtensionParent
}

// namespace ExtensionParent
// {
// 	interface Fire {
// 		// Bug 1754866 fire.sync doesn't match documentation.
// 		sync(...args: any): any
// 		async(...args: any): any
// 		raw(...args: any): any
// 		asyncWithoutClone(...args: any): any
// 	}

// 	interface Extension {
// 	}

// 	class GlobalManager {
// 		getExtension(name: string): Extension;
// 	}
// 	// ExtensionParent: ExtensionParent;
// 	// GlobalManager: GlobalManager;
// }

declare class BP {
    static for(extension: any, window: any): any;
    constructor(extension: string, viewNode: any, popupURL: string, browserStyle: any, fixedWidth?: boolean, blockParser?: boolean);
    extension: any;
    popupURL: any;
    viewNode: any;
    browserStyle: any;
    window: Window;
    destroyed: boolean;
    fixedWidth: boolean;
    blockParser: boolean;
    contentReady: any;
    _resolveContentReady: any;
    browser: any;
    browserLoaded: any;
    browserLoadedDeferred: {
        resolve: any;
        reject: any;
    };
    browserReady: any;
    close(): void;
    destroy(): any;
    stack: any;
    destroyBrowser(browser: any, finalize?: boolean): void;
    receiveMessage({ name, data }: {
        name: any;
        data: any;
    }): void;
    get DESTROY_EVENT(): void;
    get STYLESHEETS(): string[];
    get panel(): any;
    dimensions: any;
    handleEvent(event: any): void;
    createBrowser(viewNode: any, popupURL?: any): any;
    unblockParser(): void;
    resizeBrowser({ width, height, detail }: {
        width: any;
        height: any;
        detail: any;
    }): void;
    lastCalculatedInViewHeight: number;
    setBackground(background: any): void;
    background: any;
}

interface BasePopupExport {
	BasePopup: typeof BP;
}

declare namespace Components
{
	class utils
	{
		//with TB67 the import is only possible with returning the imports, see https://wiki.mozilla.org/Thunderbird/Add-ons_Guide_63
		//therefore the import function returns different types depending on the input path

		public static import(path: IteratorUtilsPath): IteratorUtils;
		public static import(path: MailServicesPath): MailServicesExport;
		public static import(path: ExtensionPopupsPath): BasePopupExport;
		public static import(path: ExtensionParentPath): ExtensionParentExport;
		public static import(path: ExtensionCommonPath): any;
		public static import(path: FileUtilsPath): any;
		public static importESModule(path: QEventDispatcherPath): QEventDispatcherExport;
		public static importESModule(path: XULNoteWindowPath): XULNoteWindowExport;
		public static importESModule(path: DOMLocalizatorPath): DOMLocalizatorExport;
		public static importESModule(path: ExtensionPopupsPath): BasePopupExport;
		public static importESModule(path: QCachePath): QCacheExport;
		public static importESModule(path: ThreadPaneColumnsPath): any;
		public static importESModule(path: ThreadPaneColumnsOldPath): any;
		public static importESModule(path: QNoteFilePath): any;
		public static importESModule(path: XNoteFilePath): any;
		public static importESModule(path: FileUtilsPath): any;
		public static importESModule(path: ServicesPath): any;
		// public static importESModule(path: ExtensionPopupsSysPath): BasePopupExport;
		// public static importESModule(path: string): any;
		public static unload(path: string): void;
		public static defineModuleGetter(param1: any, param2: any, param3: any): void;
	}

	//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference
	namespace interfaces
	{
		class AString {
			length?: number | null
			value?: string | null
		}

		class nsISupports {}

		class nsIInputStream extends nsISupports {
			close(): void;
		}

		class nsIOutputStream extends nsISupports {
		}

		class nsIScriptableInputStream extends nsISupports {
			init(aInputStream: nsIInputStream): void;
			read(aCount: number): string;
			close(): void;
			// ACString readBytes(in unsigned long aCount);
		}

		class nsIUnicharInputStream extends nsISupports{
			// unsigned long readString(in unsigned long aCount, out AString aString);
			readString(aCount: number, aString: AString): number;
			close(): void;
		}

		class nsIConverterInputStream extends nsIUnicharInputStream {
			readonly DEFAULT_REPLACEMENT_CHARACTER = 0xFFFD;
			readonly ERRORS_ARE_FATAL = 0;
			init(nsIInputStream: nsIFile, aCharset: string, aBufferSize: number, aReplacementChar: number): void;
		}

		class nsIFileInputStream extends nsIInputStream {
			init(file: any,  ioFlags: number, perm: number, behaviorFlags: number | null): void;
		}

		type nsIIDRef = any; // TODO: ?
		class nsIProperties extends nsISupports {
			get(prop: string, iid: nsIIDRef): any
			set(prop: string, value: any): void
			has(prop: string): boolean
			undefine(prop: string): void
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIDOMWindow
		class nsIDOMWindow extends Window
		{

		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIPromptService
		class nsIPromptService
		{
			public alert(parent: nsIDOMWindow | null, title: string, msg: string): void;
			public confirm(parent: nsIDOMWindow | null, title: string, msg: string): boolean;
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIConsoleService
		class nsIConsoleService
		{
			public logStringMessage(msg: string): void;
		}

		class nsISimpleEnumerator<T>
		{

		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIMsgFolder
		class nsIMsgFolder
		{
			public name: string;
			public readonly server: nsIMsgIncomingServer;
			public readonly URI: string;
			public readonly hasSubFolders: boolean;
			public readonly subFolders: nsISimpleEnumerator<nsIMsgFolder>;

			public getFlag(flagName: nsMsgFolderFlags): boolean;
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Thunderbird/Thunderbird_extensions/HowTos/Activity_Manager
		class nsIActivityManager
		{
			public addActivity(activity: nsIActivity): void;
			public removeActivity(id: string): void;
		}

		//https://dxr.mozilla.org/comm-central/source/comm/mail/base/content/mailWindowOverlay.js
		class BatchMessageMover
		{
			public archiveMessages(messages: nsIMsgDBHdr[]): void;
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIMsgAccount
		class nsIMsgAccount
		{
			public incomingServer: nsIMsgIncomingServer;
			public key: string;
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIMsgIncomingServer
		class nsIMsgIncomingServer
		{
			public readonly serverURI: string;
			public type: "pop3" | "imap" | "nntp" | "none" | "im" | "rss" | "exquilla"; //"and so on"?
			public rootFolder: nsIMsgFolder;
			public prettyName: string;
			public readonly localStoreType: "mailbox" | "imap" | "news" | "exquilla";

			public getBoolValue(attr: string): boolean;
			public getIntValue(attr: string): number;
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIXULAppInfo
		class nsIXULAppInfo
		{
			public readonly ID: string;
			public readonly version: string;
			public readonly appBuildID: string;
			public readonly platformVersion: string;
			public readonly platformBuildID: string;
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIStringBundle
		class nsIStringBundle
		{
			public GetStringFromName(name: string): string;
			public formatStringFromName(name: string, params: string[], length: number): string;
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIMsgSearchSession
		class nsIMsgSearchSession
		{
			public addScopeTerm(scope: nsMsgSearchScope, folder: nsIMsgFolder): void;
			public createTerm(): nsMsgSearchTerm;
			public appendTerm(term: nsMsgSearchTerm): void;
			public registerListener(listener: nsIMsgSearchNotify): void;
			public search(window: nsIMsgWindow | null): void;
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIMsgWindow
		class nsIMsgWindow
		{
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIMsgSearchTerm
		class nsMsgSearchTerm
		{
			public attrib: nsMsgSearchAttrib;
			public value: nsIMsgSearchValue;
			public op: nsMsgSearchOp;
			public booleanAnd: boolean;
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIMsgSearchValue
		class nsIMsgSearchValue
		{
			public attrib: nsMsgSearchAttrib;
			public age: number;
			public status: nsMsgMessageFlags;
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIMsgSearchNotify
		interface nsIMsgSearchNotify
		{
			onSearchHit(header: nsIMsgDBHdr, folder: nsIMsgFolder): void;

			// notification that a search has finished.
			onSearchDone(status: number): void;

			/*
             * called when a new search begins
             */
			onNewSearch(): void;
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIFileOutputStream
		class nsIFileOutputStream
		{
			public init(file: nsIFile, ioFlags: number, perm: number, behaviorFlags: number): void;
			write(aBuf: string, aCount: number): number;
			close(): void;
			flush(): void;
		}

		class nsIFile
		{

		}

		class nsIURI
		{

		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIConverterOutputStream
		//https://dxr.mozilla.org/comm-central/source/obj-x86_64-pc-linux-gnu/dist/include/nsIUnicharOutputStream.h?q=nsIUnicharOutputStream&redirect_type=direct#27
		class nsIConverterOutputStream
		{
			public init(stream: nsIOutputStream, charset: string, bufferSize: number, replacementCharacter: number): void;
			public writeString(str: string): boolean;
			public close(): void;
		}

		// class nsIOutputStream
		// {

		// }

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIStringBundleService
		class nsIStringBundleService
		{
			public createBundle(urlSpec: string): nsIStringBundle;
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIWindowMediator
		class nsIWindowMediator
		{
			public getMostRecentWindow(windowType: string | null): nsIDOMWindow;
			public getMostRecentWindow(windowType: "mail:3pane"): Mail3Pane;

		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsMsgFolderFlagType
		class nsMsgFolderFlags
		{
			public static readonly Trash: nsMsgFolderFlags;
			public static readonly Junk: nsMsgFolderFlags;
			public static readonly Queue: nsMsgFolderFlags;
			public static readonly Drafts: nsMsgFolderFlags;
			public static readonly Templates: nsMsgFolderFlags;
			public static readonly Archive: nsMsgFolderFlags;
			public static readonly Virtual: nsMsgFolderFlags;
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsMsgSearchScope
		class nsMsgSearchScope
		{
			public static readonly offlineMail: nsMsgSearchScope;
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsMsgSearchOp
		class nsMsgSearchOp
		{
			public static readonly IsGreaterThan: nsMsgSearchOp;
			public static readonly Isnt: nsMsgSearchOp;
			public static readonly Contains: nsMsgSearchOp;
			public static readonly DoesntContain: nsMsgSearchOp;
			public static readonly Is: nsMsgSearchOp;
			public static readonly BeginsWith: nsMsgSearchOp;
			public static readonly EndsWith: nsMsgSearchOp;
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsMsgSearchAttrib
		class nsMsgSearchAttrib
		{
			public static readonly AgeInDays: nsMsgSearchAttrib;
			public static readonly MsgStatus: nsMsgSearchAttrib;
			public static readonly Custom: nsMsgSearchAttrib;
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/nsMsgMessagesFlags
		class nsMsgMessageFlags
		{
			public static readonly IMAPDeleted: nsMsgMessageFlags;
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/nsMsgNavigationType
		class nsMsgNavigationType
		{
			public static readonly firstMessage: nsMsgNavigationType;
		}

		class nsIActivity
		{
			public contextType: string;
			public contextObj: nsIMsgIncomingServer;
		}

		class nsIActivityEvent extends nsIActivity
		{
			public init(msg: string, value2: any, value3: string, time: number, date: number): void;
		}

		class nsIActivityStates
		{

		}

		class nsIActivityProcess extends nsIActivity
		{
			public static readonly STATE_COMPLETED: nsIActivityStates;

			public state: nsIActivityStates;
			public startTime: number;
			public id: string;

			public init(msg: string, value2: any): void;
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIPrefService
		class nsIPrefService
		{
			public getBranch(aPrefRoot: string): nsIPrefBranch;
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIMsgDBHdr
		class nsIMsgDBHdr
		{
			public readonly isRead: boolean;
			public readonly isFlagged: boolean;
			public readonly dateInSeconds: number;
			public readonly folder: nsIMsgFolder;
		}

		class nsIMsgTag
		{

		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIPrefBranch
		class nsIPrefBranch
		{
			public getBoolPref(name: string, defaultValue: boolean | undefined): boolean;
			public getCharPref(name: string, defaultValue: string | undefined): string;
			public getChildList(startingAt: string, obj: object): string[];
			public setBoolPref(name: string, value: boolean): void;
		}
	}

	//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Language_Bindings/Components.classes
	let classes: { [key: string]: nsIJSCID };
}

import Cu = Components.utils;
import ChromeUtils = Components.utils;
import Cc = Components.classes;
import Ci = Components.interfaces;

//https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/FileUtils.jsm
declare class FileUtils
{
	File: any
    MODE_RDONLY: number
    MODE_WRONLY: number
    MODE_RDWR: number
    MODE_CREATE: number
    MODE_APPEND: number
    MODE_TRUNCATE: number
    PERMS_FILE: number
    PERMS_DIRECTORY: number
	public static getFile(key: string, pathArray: string[], followLinks?: boolean): Ci.nsIFile
    getDir(key: any, pathArray: any): any;
    openFileOutputStream(file: any, modeFlags: any): any;
    openAtomicFileOutputStream(file: any, modeFlags: any): any;
    openSafeFileOutputStream(file: any, modeFlags: any): any;
    _initFileOutputStream(fos: any, file: any, modeFlags: any): any;
    closeAtomicFileOutputStream(stream: any): void;
    closeSafeFileOutputStream(stream: any): void;
}

//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/Toolkit_API/extIApplication
declare class Application
{
	public static console: extIConsole;
}

//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/Toolkit_API/extIConsole
declare class extIConsole
{
	public log(msg: string): void;
}

declare class MailServicesAccounts
{
	public accounts: Ci.nsISimpleEnumerator<Ci.nsIMsgAccount>;
}

declare interface MailServicesExport
{
	MailServices: MailServices;
}

declare interface MailServices
{
	accounts: MailServicesAccounts;
	filters: any;
}

//https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Add-on_Manager/Addon
declare class Addon
{
	public readonly type: string;
	public readonly name: string;
	public readonly id: string;
	public readonly version: string;
	public readonly isActive: boolean;
}

//https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Add-on_Manager/AddonManager
declare class AddonManager
{
	public static getAllAddons(AddonListCallback: (addons: Addon[]) => void): void;
}

interface IteratorUtils
{
	fixIterator<T>(collection: Ci.nsISimpleEnumerator<T>, objectType: Type<T>): T[];
}

//not official API
declare class FolderDisplayViewDb
{
	//show(folder:Ci.nsIMsgFolder):void;
}

//not official API
declare class FolderDisplayView
{
	public dbView: FolderDisplayViewDb;
}

//I don't know the real type name
declare class FolderDisplay
{
	public displayedFolder: Ci.nsIMsgFolder;
	public selectedCount: number;

	//not official API
	public view: FolderDisplayView;

	public navigate(type: Ci.nsMsgNavigationType): void;
	public show(folder: Ci.nsIMsgFolder): void;
}

//I don't know the real type name
declare class MessageIdentity
{
	public archiveEnabled: boolean;
}

declare class ThunderbirdNavigator extends Navigator
{
	public oscpu: string;
}

declare class Mail3Pane extends Ci.nsIDOMWindow
{
	public gFolderDisplay: FolderDisplay;
	// eslint-disable-next-line @typescript-eslint/type-annotation-spacing
	public BatchMessageMover: new() => Ci.BatchMessageMover; //tricky, this is an inner class
	public navigator: ThunderbirdNavigator;

	public getIdentityForHeader(msg: Ci.nsIMsgDBHdr): MessageIdentity;
}

declare class ThunderbirdError
{
	public fileName: string;
	public lineNumber: number;
	public stack: string;

	public toSource(): string;
}

//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIObserver
declare class nsIObserver
{

}

//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIWindowWatcher
declare interface nsIWindowWatcher
{
	registerNotification(observer: nsIObserver): void;
}

//https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Services.jsm
declare namespace Services
{
	let ww: nsIWindowWatcher;
	let wm: Ci.nsIWindowMediator;
	let prefs: any;
}

declare namespace ExtensionCommon
{
	abstract class  ExtensionAPI
	{
		public abstract getAPI(context: any): {};
	}

	class EventManager
	{
		public constructor(params: EventManagerParams);
		public api(): {};
	}

	interface EventManagerParams {
		context: object;
		module?: string;
		event?: string;
		extensionApi?: object;
		name: string;
		register: Function;
		inputHandling?: boolean;
	}
}

declare class ExperimentAPIManager
{

}

// //https://thunderbird-webextensions.readthedocs.io/en/latest/how-to/experiments.html
// interface FolderManager
// {
// 	get(accountId: string, path: string): Ci.nsIMsgFolder;
// 	convert(realFolder: Ci.nsIMsgFolder): MailFolder;
// }

// //https://thunderbird-webextensions.readthedocs.io/en/latest/how-to/experiments.html
// interface MessageManager
// {
// 	get(messageId: number): Ci.nsIMsgDBHdr;
// 	convert(realMessage: Ci.nsIMsgDBHdr): MessageHeader;

// 	// Start a MessageList from an array or enumerator of nsIMsgDBHdr ???
// 	//startMessageList(realFolder.messages);
// }

declare class ParentMessageManager
{

}

declare class WindowManager
{
	get(windowId: number): any
}

// //https://thunderbird-webextensions.readthedocs.io/en/latest/how-to/experiments.html
// interface ExtensionContextExtension
// {
// 	folderManager: FolderManager;
// 	messageManager: MessageManager;

// 	experimentAPIManager: ExperimentAPIManager;
// 	windowManager: WindowManager;
// 	parentMessageManager: ParentMessageManager;
// }

// interface ExtensionContext
// {
// 	extension: ExtensionContextExtension;
// }
