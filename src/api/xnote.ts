var ExtensionUtils = ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm").ExtensionUtils;
var { ExtensionError } = ExtensionUtils;
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");

var api = ChromeUtils.importESModule("resource://qnote/modules/api.mjs");

var xnote = class extends ExtensionCommon.ExtensionAPI {
	getAPI() {
		return {
			xnote: api.XNoteFileAPI
		}
	}
}
