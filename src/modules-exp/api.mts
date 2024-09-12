import { PanelStyle } from "../api/qpopup";
import { IQAppPreferences } from "../modules/common.mjs";
import { INoteData } from "../modules/Note.mjs";
import { IPopupState } from "../modules/NotePopups.mjs";
import { IQNoteFileAPI } from "./QNoteFile.mjs";
import { IXNoteFileAPI } from "./XNoteFile.mjs";

var { ExtensionUtils } = ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");
var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { QNoteFile } = ChromeUtils.importESModule("resource://qnote/modules-exp/QNoteFile.mjs");
var { XNoteFile } = ChromeUtils.importESModule("resource://qnote/modules-exp/XNoteFile.mjs");
var { ExtensionError } = ExtensionUtils;

export interface IXNotePreferences {
	usetag: boolean,
	dateformat: string;
	width: number,
	height: number,
	show_on_select: boolean,
	show_first_x_chars_in_col: number,
	storage_path: string,
	version: string,
}

export interface INoteFileProvider {
	load(root: string, keyId: string): INoteData | null
	save(root: string, keyId: string, note: INoteData): void
	delete(root: string, keyId: string): void
	getAllKeys(root: string): Array<string> // TODO: maybe use Generator/yield?
}

export interface INoteFileAPI<T extends INoteFileProvider> {
	provider: T
	load(root: string, keyId: string): Promise<INoteData | null>
	save(root: string, keyId: string, note: INoteData): Promise<boolean>
	delete(root: string, keyId: string): Promise<boolean>
	getAllKeys(root: string): Promise<Array<string>>
}

// Keep as example
// const QAPP_ON_KEYDOWN_MAP = ["altKey", "code", "ctrlKey", "isComposing", "key", "location", "metaKey", "repeat", "shiftKey"] as const;
// type KeyDownEventKeys = typeof QAPP_ON_KEYDOWN_MAP[number];

export interface IQAppAPI {
	createStoragePath(): Promise<string>
	updateColumsView(): Promise<void>
	init(Prefs: IQAppPreferences): Promise<void>
	setDebug(on: boolean): Promise<void>
	setPrefs(prefs: IQAppPreferences): Promise<void>
	getProfilePath(): Promise<string>
	focusSave(): Promise<void>
	focusRestore(): Promise<void>
	attachNotesToMultiMessage(windowId: number, notes: Array<INoteData>, keys: Array<string>): Promise<void>
}

export interface ILegacyAPI {
	alert(title: string, text?: string | null): Promise<void>
	confirm(title: string, text?: string | null): Promise<boolean>
	compareVersions(a: string, b: string): Promise<number>
	folderPicker(initialPath: string | null): Promise<string>
	isReadable(path: string): Promise<boolean>
	isFolderReadable(path: string): Promise<boolean>
	isFolderWritable(path: string): Promise<boolean>
}

export interface IQPopupAPI {
	setDebug(on: boolean): Promise<void>
	close(id: number, reason: "close" | "escape" | "delete"): Promise<void>
	get(id: number): Promise<IPopupState>
	pop(id: number): Promise<void>
	create(windowsId: number, state: IPopupState): Promise<number>
	update(id: number, state: IPopupState): Promise<IPopupState>
	takeScreenshot(id: number): Promise<boolean>
	resetPosition(id: number): Promise<void>
	setPanelStyle(id: number, style: PanelStyle): Promise<void>
	onClose: WebExtEvent<(id: number, reason: string, state: IPopupState) => void>
	onFocus: WebExtEvent<(id: number) => void>
	onBlur: WebExtEvent<(id: number) => void>
}

function Transferable(source: any) {
	const res = Cc["@mozilla.org/widget/transferable;1"].createInstance(Ci.nsITransferable);

	if ("init" in res) {
		// When passed a Window object, find a suitable privacy context for it.
		if (source instanceof Ci.nsIDOMWindow) {
			source = source.docShell
				.QueryInterface(Ci.nsIInterfaceRequestor)
				.getInterface(Ci.nsIWebNavigation);
		}

		res.init(source);
	}
	return res;
}

function gen<T1 extends INoteFileProvider>(provider: T1): INoteFileAPI<T1> {
	const api: INoteFileAPI<T1> = {
		provider: provider,
		async save(root: string, keyId: string, note: INoteData){
			try {
				provider.save(root, keyId, note);
			} catch(e: any) {
				throw new ExtensionError(e.message);
			}
			return true;
		},
		async delete(root: string, keyId: string){
			try {
				provider.delete(root, keyId);
			} catch(e: any) {
				throw new ExtensionError(e.message);
			}
			return true;
		},
		async load(root: string, keyId: string){
			try {
				return provider.load(root, keyId);
			} catch(e: any) {
				throw new ExtensionError(e.message);
			}
		},
		async getAllKeys(root: string) {
			try {
				return provider.getAllKeys(root);
			} catch(e: any) {
				throw new ExtensionError(e.message);
			}
		}
	}

	return api;
}

export const QNoteFileAPI: IQNoteFileAPI = {
	...gen(new QNoteFile()),
	async copyToClipboard(note: INoteData): Promise<boolean> {
		const txtWrapper = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
		txtWrapper.data = note.text;

		const noteWrapper = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
		try {
			noteWrapper.data = JSON.stringify(note);
		} catch {
			noteWrapper.data = JSON.stringify({});
		}

		const w = Services.wm.getMostRecentWindow("mail:3pane");
		const clipBoard = Services.clipboard;
		const transferable = Transferable(w);

		transferable.addDataFlavor("text/qnote");
		transferable.addDataFlavor("text/unicode");

		transferable.setTransferData("text/qnote", noteWrapper);
		transferable.setTransferData("text/unicode", txtWrapper);

		clipBoard.setData(transferable, null, Ci.nsIClipboard.kGlobalClipboard);

		return true;
	},

	async getFromClipboard(): Promise<INoteData | null> {
		const w = Services.wm.getMostRecentWindow("mail:3pane");
		const clipBoard = Services.clipboard;
		const transferable = Transferable(w);
		const flavour: AString = {};
		const data: AString = {};

		transferable.addDataFlavor("text/qnote");
		transferable.addDataFlavor("text/unicode");
		transferable.addDataFlavor("text/plain");
		transferable.addDataFlavor("text/html");
		clipBoard.getData(transferable, Ci.nsIClipboard.kGlobalClipboard)

		try {
			transferable.getAnyTransferData(flavour, data);
		} catch {
			return null;
		}

		if(data.value && flavour.value){
			const intf = data.value as unknown as nsISupports;
			const content = intf.QueryInterface(Ci.nsISupportsString);
			if(content){
				if(flavour.value == "text/qnote"){
					try {
						return JSON.parse(content.data);
					} catch {
						return null;
					}
				} else if(flavour.value.startsWith("text/")){
					return {
						text: content.data
					}
				}
			}
		}

		return null;
	}
};

export const XNoteFileAPI: IXNoteFileAPI = {
	...gen(new XNoteFile()),
	async getPrefs(){
		return XNoteFileAPI.provider.getPrefs();
	},
	async getStoragePath(path: string | null) {
		return XNoteFileAPI.provider.getStoragePath(path);
	}
}

export const LegacyAPI: ILegacyAPI = {
	async alert(title: string, text?: string | null): Promise<void> {
		return Services.prompt.alert(null, text ? title : null, text ? text : title);
	},
	async confirm(title: string, text?: string | null): Promise<boolean> {
		return Services.prompt.confirm(null, text ? title : null, text ? text : title);
	},
	/**
	 * Compare two version strings
	 * @param   A   The first version
	 * @param   B   The second version
	 * @returns < 0 if A < B
	 *          = 0 if A == B
	 *          > 0 if A > B
	 */
	async compareVersions(a: string, b: string): Promise<number> {
		return Services.vc.compare(a, b);
	},
	async folderPicker(initialPath: string | null): Promise<string> {
		const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);

		fp.init(Services.wm.getMostRecentWindow(null).browsingContext, "Select storage folder", Ci.nsIFilePicker.modeGetFolder);
		if(initialPath){
			fp.displayDirectory = new FileUtils.File(initialPath);
		}

		return new Promise(resolve => {
			fp.open((rv: Ci.nsIFilePicker_ResultCode) => {
				if(rv === Ci.nsIFilePicker.returnOK){
					resolve(fp.file.path);
				}
			});
		});
	},
	async isReadable(path: string): Promise<boolean> {
		try {
			return (new FileUtils.File(path)).isReadable();
		} catch {
			return false;
		}
	},
	async isFolderReadable(path: string): Promise<boolean> {
		try {
			const f = new FileUtils.File(path);
			return f.isReadable() && f.isDirectory();
		} catch {
			return false;
		}
	},
	async isFolderWritable(path: string): Promise<boolean> {
		try {
			const f = new FileUtils.File(path);
			return f.isWritable() && f.isDirectory();
		} catch {
			return false;
		}
	}
}
