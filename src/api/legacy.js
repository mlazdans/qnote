var api = ChromeUtils.importESModule("resource://qnote/modules-exp/api.mjs");

var legacy = class extends ExtensionCommon.ExtensionAPI {
	getAPI() {
		return {
			legacy: api.LegacyAPI
		}
	}
}
