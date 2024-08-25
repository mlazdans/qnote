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

/// <reference path="../sharedAll/thunderbird.d.ts" />

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

declare namespace Components
{
	class utils
	{
		//with TB67 the import is only possible with returning the imports, see https://wiki.mozilla.org/Thunderbird/Add-ons_Guide_63
		//therefore the import function returns different types depending on the input path

		public static import(path: IteratorUtilsPath): IteratorUtils;
		public static import(path: MailServicesPath): MailServicesExport;
		public static unload(path: string): void;
		public static defineModuleGetter(param1: any, param2: any, param3: any): void;
	}

	//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference
	namespace interfaces
	{
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

		class nsIOutputStream
		{

		}

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
		}

		//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsMsgSearchAttrib
		class nsMsgSearchAttrib
		{
			public static readonly AgeInDays: nsMsgSearchAttrib;
			public static readonly MsgStatus: nsMsgSearchAttrib;
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
	public static getFile(key: string, pathArray: string[], followLinks?: boolean): Ci.nsIFile;
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
}

declare namespace ExtensionCommon
{
	abstract class  ExtensionAPI
	{
		public abstract getAPI(context: any): {};
	}

	class EventManager
	{
		public constructor(arg: any);
	}
}

declare class ExperimentAPIManager
{

}

//https://thunderbird-webextensions.readthedocs.io/en/latest/how-to/experiments.html
interface FolderManager
{
	get(accountId: string, path: string): Ci.nsIMsgFolder;
	convert(realFolder: Ci.nsIMsgFolder): MailFolder;
}

//https://thunderbird-webextensions.readthedocs.io/en/latest/how-to/experiments.html
interface MessageManager
{
	get(messageId: number): Ci.nsIMsgDBHdr;
	convert(realMessage: Ci.nsIMsgDBHdr): MessageHeader;

	// Start a MessageList from an array or enumerator of nsIMsgDBHdr ???
	//startMessageList(realFolder.messages);
}

declare class ParentMessageManager
{

}

declare class WindowManager
{

}

//https://thunderbird-webextensions.readthedocs.io/en/latest/how-to/experiments.html
interface ExtensionContextExtension
{
	folderManager: FolderManager;
	messageManager: MessageManager;

	experimentAPIManager: ExperimentAPIManager;
	windowManager: WindowManager;
	parentMessageManager: ParentMessageManager;
}

interface ExtensionContext
{
	extension: ExtensionContextExtension;
}
