var api = ChromeUtils.importESModule("resource://qnote/modules-exp/api.mjs?version=0.14.1");

var xnote = class extends ExtensionCommon.ExtensionAPI {
	getAPI() {
		return {
			xnote: api.XNoteFileAPI
		}
	}
}
