import 'thunderbird-webext-browser';
import { NoteData } from '../modules/Note.mjs';
import { QAppPreferences, XNotePreferences } from '../modules/Preferences.mjs';
import { QPopupOptions } from '../modules/XULNoteWindow.mts';

export {}

declare class BasePopup {
    static for(extension: any, window: any): any;
    constructor(extension: string, viewNode: any, popupURL: string, browserStyle: any, fixedWidth?: boolean, blockParser?: boolean);
    extension: any;
    popupURL: any;
    viewNode: any;
    browserStyle: any;
    window: any;
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

declare global {
	// ChromeUtils.importESModule("resource://qnote/modules/QEventDispatcher.mjs")

	interface BasePopupExport
	{
		BasePopup: BasePopup;
	}

	class XULDocument extends Document{
		createXULElement(name: string): Element;
	}

	class MozWindow extends Window {
		document: XULDocument;
	}

	namespace browser {
		export namespace qnote {
			function loadNote(root: string, keyId: string): Promise<NoteData>;
			function saveNote(root: string, keyId: string, data: NoteData): Promise<boolean>;
			function deleteNote(root: string, keyId: string): Promise<boolean>;
			function getAllKeys(root: string): Promise<Array<string>>;
			function copyToClipboard(note: NoteData): Promise<void>;
			function getFromClipboard(): Promise<NoteData>;
		}
		export namespace xnote {
			function getPrefs(): Promise<XNotePreferences>;
			function getStoragePath(path?: string): Promise<string>;
			function loadNote(root: string, keyId: string): Promise<NoteData>;
			function saveNote(root: string, keyId: string, data: NoteData): Promise<boolean>;
			function deleteNote(root: string, keyId: string): Promise<boolean>;
			function getAllKeys(root: string): Promise<Array<string>>;
		}
		export namespace legacy {
			function isReadable(path: string): Promise<boolean>;
			function isFolderReadable(path: string): Promise<boolean>;
			function isFolderWritable(path: string): Promise<boolean>;
			function alert(title: string, msg?: string): Promise<void>;
			function confirm(title: string, msg?: string): Promise<boolean>;
		}
		export namespace qapp {
			export const onNoteRequest: WebExtEvent<(keyId: string) => void>;
			export const onKeyDown: WebExtEvent<(e: KeyboardEvent) => void>;
			function createStoragePath(): Promise<string>;
			function updateView(windowId: number, keyId?: string): Promise<void>;
			function init(): Promise<void>;
			function setDebug(on: boolean): Promise<void>;
			function messagePaneFocus(windowId: number): Promise<void>;
			function setPrefs(prefs: QAppPreferences): Promise<void>;
			function attachNoteToMessage(windowId: number, note: NoteData): Promise<void>;
			function saveNoteCache(note: NoteData): Promise<void>;
		}
		export namespace qpopup {
			function setDebug(on: boolean): Promise<void>;
			function remove(id: number): Promise<void>;
			function create(note: QPopupOptions): Promise<QPopupOptions>;
			function update(id: number, note: QPopupOptions): Promise<QPopupOptions>;
		}
		export namespace ResourceUrl {
			function register(name: string): Promise<void>;
		}
		export namespace NotifyTools {
			export const onNotifyBackground: WebExtEvent<(e: any) => void>;
		}
	}
}
