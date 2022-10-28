var { ExtensionError } = ExtensionUtils;
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var { XNoteFile } = ChromeUtils.import("resource://qnote/modules/XNoteFile.js");

var xnote = class extends ExtensionCommon.ExtensionAPI {
	getAPI(context) {
		var NF = new XNoteFile;
		return {
			xnote: {
				async saveNote(root, keyId, note){
					try {
						return NF.save(root, keyId, note);
					} catch(e) {
						throw new ExtensionError(e.message);
					}
				},
				async deleteNote(root, keyId){
					try {
						return NF.delete(root, keyId);
					} catch(e) {
						throw new ExtensionError(e.message);
					}
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
				async getPrefs(){
					return NF.getPrefs();
				},
				async getStoragePath(path) {
					return NF.getStoragePath(path);
				}
			}
		}
	}
}
