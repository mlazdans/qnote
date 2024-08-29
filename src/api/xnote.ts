var api = ChromeUtils.importESModule("resource://qnote/modules-exp/api.mjs");

var xnote = class extends ExtensionCommon.ExtensionAPI {
	getAPI() {
		return {
			xnote: api.XNoteFileAPI
		}
	}
}
