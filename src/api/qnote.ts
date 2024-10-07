var api = ChromeUtils.importESModule("resource://qnote/modules-exp/api.mjs?version=0.14.3");

var qnote = class extends ExtensionCommon.ExtensionAPI {
	getAPI() {
		return {
			qnote: api.QNoteFileAPI
		}
	}
}
