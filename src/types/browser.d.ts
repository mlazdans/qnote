import 'thunderbird-webext-browser';
import { IQNoteFileAPI } from '../modules-exp/QNoteFile.mts';
import { IXNoteFileAPI } from '../modules-exp/XNoteFile.mts';
import { ILegacyAPI, IQAppAPI, IQPopupAPI } from '../modules-exp/api.mts';

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
		createXULElement(name: string): XULElement
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
		export const qnote: IQNoteFileAPI;
		export const xnote: IXNoteFileAPI;
		export const qpopup: IQPopupAPI;
		export const qapp: IQAppAPI;
		export const legacy: ILegacyAPI;
		export const LegacyCSS: any;

		export namespace ResourceUrl {
			function register(name: string): Promise<void>;
		}

		export namespace NotifyTools {
			export const onNotifyBackground: WebExtEvent<(e: any) => void>;
		}

		export namespace scripting {
			const messageDisplay: any;
			function getRegisteredContentScripts(): any;
		}
	}

	var FileUtils: typeof globalThis;
	var ExtensionUtils: typeof globalThis;
	var ExtensionParent: typeof globalThis;
	var MailServices: typeof globalThis;
}
