var api = ChromeUtils.importESModule("resource://qnote/modules-exp/api.mjs?version=version");

var qnote = class extends ExtensionCommon.ExtensionAPI {
	getAPI() {
		return {
			qnote: api.QNoteFileAPI
		}
	}
}
