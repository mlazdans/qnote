var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var legacy = class extends ExtensionCommon.ExtensionAPI {
	getAPI(context) {
		return {
			legacy: {
				// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIPromptService#prompt_example
				async alert(title, msg){
					var args = [null];

					if(msg === null){
						msg = title;
						title = null;
					}

					args.push(title);
					args.push(msg);

					return Services.prompt.alert(...args);
				},
				async confirm(title, msg){
					var args = [null];

					if(msg === null){
						msg = title;
						title = null;
					}

					args.push(title);
					args.push(msg);

					return Services.prompt.confirm(...args);
				},
				async compareVersions(v1, v2){
					return Services.vc.compare(v1, v2);

				},
				async folderPicker(options){
					let fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);

					fp.init(Services.wm.getMostRecentWindow(null), "Select storage folder", fp.modeGetFolder);
					if(options && options.displayDirectory){
						fp.displayDirectory = new FileUtils.File(options.displayDirectory);
					}

					return new Promise(function(resolve, reject) {
						fp.open(rv => {
							if(rv === fp.returnOK){
								resolve(fp.file.path);
							}
						});
					});
				},
				async isReadable(path){
					try {
						return (new FileUtils.File(path)).isReadable();
					} catch {
						return false;
					}
				},
				async isFolderReadable(path){
					try {
						let f = new FileUtils.File(path);
						return f.isReadable() && f.isDirectory();
					} catch {
						return false;
					}
				}
			}
		}
	}
}
