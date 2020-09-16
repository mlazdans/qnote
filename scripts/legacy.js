var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var legacy = class extends ExtensionCommon.ExtensionAPI {
	getAPI(context) {
		return {
			legacy: {
				async confirm(title, msg){
					// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIPromptService#prompt_example
					return Services.prompt.confirm(null, title, msg);
				}
			}
		}
	}
}
