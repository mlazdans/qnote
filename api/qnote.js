var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionError } = ExtensionUtils;
var { NoteFile } = ChromeUtils.import(extension.rootURI.resolve("modules/NoteFile.js"));

var qnote = class extends ExtensionCommon.ExtensionAPI {
	getAPI(context) {
		return {
			qnote: {
				async saveNote(root, keyId, note){
					try {
						return NoteFile.save(root, keyId, note)
					} catch(e) {
						throw new ExtensionError(e.message);
					}
				},
				async deleteNote(root, keyId){
					try {
						return NoteFile.delete(root, keyId);
					} catch(e) {
						throw new ExtensionError(e.message);
					}
				},
				async loadNote(root, keyId){
					try {
						return NoteFile.load(root, keyId);
					} catch(e) {
						throw new ExtensionError(e.message);
					}
				},
				async getAllKeys(root) {
					try {
						return NoteFile.getAllKeys(root);
					} catch(e) {
						throw new ExtensionError(e.message);
					}
				}
			}
		}
	}
}
