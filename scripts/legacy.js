var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var legacy = class extends ExtensionCommon.ExtensionAPI {
	getAPI(context) {
		return {
			legacy: {
				async confirm(title, msg){
					// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIPromptService#prompt_example
					return Services.prompt.confirm(null, title, msg);
				},
				async compareVersions(v1, v2){
					return Services.vc.compare(v1, v2);
				},
				async folderPicker(){
					let fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
					fp.init(Services.wm.getMostRecentWindow(null), "Select.storage.dir", fp.modeGetFolder);
					return new Promise(function(resolve, reject) {
						fp.open(rv => {
							if(rv === fp.returnOK){
								resolve(fp.file.path);
							}
						});
					});
				}
			}
		}
	}
}
