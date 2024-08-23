var { ExtensionError } = ExtensionUtils;
var { QNoteFile } = ChromeUtils.import("resource://qnote/modules/QNoteFile.js");

var qnote = class extends ExtensionCommon.ExtensionAPI {
	Transferable(source) {
		const nsTransferable = Components.Constructor(
			"@mozilla.org/widget/transferable;1",
			"nsITransferable"
		);

		let res = nsTransferable();
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

	getFromClipboard(){
		let w = Services.wm.getMostRecentWindow("mail:3pane");
		let clipBoard = Services.clipboard;
		let transferable = this.Transferable(w);
		let flavour = {};
		let data = {};

		transferable.addDataFlavor("text/qnote");
		transferable.addDataFlavor("text/unicode");
		clipBoard.getData(transferable, Ci.nsIClipboard.kGlobalClipboard)

		try {
			transferable.getAnyTransferData(flavour, data);
		} catch {
			return {};
		}

		let content = data.value.QueryInterface(Ci.nsISupportsString).data;

		if(flavour.value == "text/qnote"){
			try {
				return JSON.parse(content);
			} catch {
				return {}
			}
		} else if(flavour.value == "text/unicode"){
			return {
				text: content
			}
		}
	}

	copyToClipboard(note) {
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
		let transferable = this.Transferable(w);

		transferable.addDataFlavor("text/qnote");
		transferable.addDataFlavor("text/unicode");

		transferable.setTransferData("text/qnote", noteWrapper);
		transferable.setTransferData("text/unicode", txtWrapper);

		clipBoard.setData(transferable, null, Ci.nsIClipboard.kGlobalClipboard);

		return true;
	}

	getAPI(context) {
		var NF = new QNoteFile;
		var API = this;
		return {
			qnote: {
				async saveNote(root, keyId, note){
					try {
						NF.save(root, keyId, note);
					} catch(e) {
						throw new ExtensionError(e.message);
					}
					return true;
				},
				async deleteNote(root, keyId){
					try {
						NF.delete(root, keyId);
					} catch(e) {
						throw new ExtensionError(e.message);
					}
					return true;
				},
				async loadNote(root, keyId){
					try {
						return NF.load(root, keyId);
					} catch(e) {
						throw new ExtensionError(e.message);
					}
				},
				async getAllKeys(root) {
					try {
						return NF.getAllKeys(root);
					} catch(e) {
						throw new ExtensionError(e.message);
					}
				},
				async copyToClipboard(note){
					return API.copyToClipboard(note);
				},
				async getFromClipboard(){
					return API.getFromClipboard();
				}
			}
		}
	}
}
