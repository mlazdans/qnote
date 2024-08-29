var api = ChromeUtils.importESModule("resource://qnote/modules/api.mjs");

var qnote = class extends ExtensionCommon.ExtensionAPI {
	getAPI() {
		return {
			qnote: api.QNoteFileAPI
		}
	}
}
