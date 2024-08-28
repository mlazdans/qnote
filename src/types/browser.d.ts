import 'thunderbird-webext-browser';
import { NoteData } from '../modules/Note.mjs';
import { QAppPreferences, XNotePreferences } from '../modules/Preferences.mjs';
import { QPopupOptions, QPopupOptionsPartial } from '../modules/XULNoteWindow.mts';

export {}

declare global {
	// Numeric typedefs, useful as a quick reference in method signatures.
	type double = number;
	type float = number;
	type i16 = number;
	type i32 = number;
	type i64 = number;
	type u16 = number;
	type u32 = number;
	type u64 = number;
	type u8 = number;

	class AString {
		length?: number | null
		value?: string | null
	}

	class XULDocument extends Document{
		createXULElement(name: string): Element
	}

	class MozXULElement extends XULElement{
	}

	class MozWindow extends Window {
		gFilter: any
		gTabmail: any
		gFolderDisplay: any
		document: XULDocument
		MozXULElement: typeof MozXULElement
		MutationObserver: typeof MutationObserver
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
			function updateColumsView(): Promise<void>;
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
			function get(id: number): Promise<QPopupOptions>;
			function pop(id: number): Promise<void>;
			function create(windowsId: number, options: QPopupOptions | QPopupOptionsPartial): Promise<void>;
			function update(options: QPopupOptions | QPopupOptionsPartial): Promise<QPopupOptions>;
			export const onRemoved: WebExtEvent<(id: number) => void>;
		}
		export namespace ResourceUrl {
			function register(name: string): Promise<void>;
		}
		export namespace NotifyTools {
			export const onNotifyBackground: WebExtEvent<(e: any) => void>;
		}
	}
}
