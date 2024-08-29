import { INoteFileAPIWClipboard } from "../modules-exp/INoteFileAPI.mjs";
import { QNoteFile } from "../modules-exp/QNoteFile.mjs";
import { NoteData } from "../modules/Note.mjs";

var { ExtensionUtils } = ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");
var { ExtensionError } = ExtensionUtils;

// TODO: test
function Transferable(source: any) {
	// const nsTransferable = Components.Constructor("@mozilla.org/widget/transferable;1","nsITransferable");
	// let res = nsTransferable();
	const res = Cc['@mozilla.org/widget/transferable;1'].createInstance(Ci.nsITransferable);

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

export var QNoteFileAPI: INoteFileAPIWClipboard = {
	provider: new QNoteFile(),

	async save(root: string, keyId: string, note: NoteData){
		try {
			QNoteFileAPI.provider.save(root, keyId, note);
		} catch(e: any) {
			throw new ExtensionError(e.message);
		}
		return true;
	},

	async delete(root: string, keyId: string){
		try {
			QNoteFileAPI.provider.delete(root, keyId);
		} catch(e: any) {
			throw new ExtensionError(e.message);
		}
		return true;
	},

	async load(root: string, keyId: string){
		try {
			return QNoteFileAPI.provider.load(root, keyId);
		} catch(e: any) {
			throw new ExtensionError(e.message);
		}
	},

	async getAllKeys(root: string) {
		try {
			return QNoteFileAPI.provider.getAllKeys(root);
		} catch(e: any) {
			throw new ExtensionError(e.message);
		}
	},

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
}
