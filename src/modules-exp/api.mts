import { IQAppPreferences } from "../modules/api.mjs";
import { NoteData } from "../modules/Note.mjs"
import { IQNoteFileAPI } from "./QNoteFile.mjs";
import { IXNoteFileAPI } from "./XNoteFile.mjs";

var { ExtensionUtils } = ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");
var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { QNoteFile } = ChromeUtils.importESModule("resource://qnote/modules-exp/QNoteFile.mjs");
var { XNoteFile } = ChromeUtils.importESModule("resource://qnote/modules-exp/XNoteFile.mjs");
var { ExtensionError } = ExtensionUtils;

export interface INoteFileProvider {
	load(root: string, keyId: string): NoteData
	save(root: string, keyId: string, note: NoteData): void
	delete(root: string, keyId: string): void
	getAllKeys(root: string): Array<string>
}

export interface INoteFileAPI<T extends INoteFileProvider> {
	provider: T
	load(root: string, keyId: string): Promise<NoteData>
	save(root: string, keyId: string, note: NoteData): Promise<void>
	delete(root: string, keyId: string): Promise<void>
	getAllKeys(root: string): Promise<Array<string>>
}

export interface IQAppAPI {
	createStoragePath(): Promise<string>
	updateColumsView(): Promise<void>
	init(): Promise<void>
	setDebug(on: boolean): Promise<void>
	messagePaneFocus(windowId: number): Promise<void>
	setPrefs(prefs: IQAppPreferences): Promise<void>
	attachNoteToMessage(windowId: number, note: NoteData): Promise<void>
	saveNoteCache(note: NoteData): Promise<void>

	onNoteRequest: WebExtEvent<(keyId: string) => void>
	onKeyDown: WebExtEvent<(e: KeyboardEvent) => void>
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

// TODO: test
function Transferable(source: any) {
	// const nsTransferable = Components.Constructor("@mozilla.org/widget/transferable;1","nsITransferable");
	// let res = nsTransferable();
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
		async save(root: string, keyId: string, note: NoteData){
			try {
				provider.save(root, keyId, note);
			} catch(e: any) {
				throw new ExtensionError(e.message);
			}
		},
		async delete(root: string, keyId: string){
			try {
				provider.delete(root, keyId);
			} catch(e: any) {
				throw new ExtensionError(e.message);
			}
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
	async copyToClipboard(note: NoteData): Promise<boolean> {
		let txtWrapper = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
		txtWrapper.data = note.text;

		let noteWrapper = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
		try {
			noteWrapper.data = JSON.stringify(note);
		} catch {
			noteWrapper.data = JSON.stringify({});
		}

		let w = Services.wm.getMostRecentWindow("mail:3pane");
		let clipBoard = Services.clipboard;
		let transferable = Transferable(w);

		transferable.addDataFlavor("text/qnote");
		transferable.addDataFlavor("text/unicode");

		transferable.setTransferData("text/qnote", noteWrapper);
		transferable.setTransferData("text/unicode", txtWrapper);

		clipBoard.setData(transferable, null, Ci.nsIClipboard.kGlobalClipboard);

		return true;
	},

	async getFromClipboard(): Promise<NoteData | null> {
		let w = Services.wm.getMostRecentWindow("mail:3pane");
		let clipBoard = Services.clipboard;
		let transferable = Transferable(w);
		let flavour: AString = {};
		let data: AString = {};

		transferable.addDataFlavor("text/qnote");
		transferable.addDataFlavor("text/unicode");
		clipBoard.getData(transferable, Ci.nsIClipboard.kGlobalClipboard)

		try {
			transferable.getAnyTransferData(flavour, data);
		} catch {
			return null;
		}

		if(data.value){
			const intf = data.value as unknown as nsISupports;
			const contentIntf = intf.QueryInterface(Ci.nsISupportsString);
			if(contentIntf){
				let content = contentIntf.data;
				if(flavour.value == "text/qnote"){
					try {
						return JSON.parse(content);
					} catch {
						return null;
					}
				// TODO: test
				// } else if(flavour.value == "text/unicode"){
				// 	return {
				// 		text: content
				// 	}
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
	async compareVersions(a: string, b: string): Promise<number> {
		return Services.vc.compare(a, b);
	},
	async folderPicker(initialPath: string | null): Promise<string> {
		let fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);

		fp.init(Services.wm.getMostRecentWindow(null), "Select storage folder", fp.modeGetFolder);
		if(initialPath){
			fp.displayDirectory = new FileUtils.File(initialPath);
		}

		return new Promise(resolve => {
			fp.open((rv: Ci.nsIFilePicker_ResultCode) => {
				if(rv === fp.returnOK){
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
			let f = new FileUtils.File(path);
			return f.isReadable() && f.isDirectory();
		} catch {
			return false;
		}
	},
	async isFolderWritable(path: string): Promise<boolean> {
		try {
			let f = new FileUtils.File(path);
			return f.isWritable() && f.isDirectory();
		} catch {
			return false;
		}
	}
}
