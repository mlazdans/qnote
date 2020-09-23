var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var { ColumnHandler } = ChromeUtils.import(extension.rootURI.resolve("modules/ColumnHandler.jsm"));

var qapp = class extends ExtensionCommon.ExtensionAPI {
	onShutdown(isAppShutdown) {
		if(isAppShutdown){
			return;
		}

		Services.obs.notifyObservers(null, "startupcache-invalidate", null);

		ColumnHandler.uninstall();

		Components.utils.unload(extension.rootURI.resolve("modules/ColumnHandler.jsm"));
	}
	getAPI(context) {
		var wex = Components.utils.waiveXrays(context.cloneScope);

		return {
			qapp: {
				async installColumnHandler(){
					ColumnHandler.install({
						textLimit: wex.Prefs.showFirstChars,
						onNoteRequest: async (messageId) => {
							var data = await wex.loadNote(messageId);
							if(data){
								return {
									keyId: messageId,
									exists: true,
									text: data.text
								}
							} else {
								return {
									keyId: messageId,
									exists: false
								}
							}
						}
					});
				},
				async updateView(){
					ColumnHandler.Observer.observe();
				},
				async updateColumnNote(note){
					ColumnHandler.saveNoteCache(note);
				},
				async deleteColumnNote(keyId){
					ColumnHandler.deleteNoteCache(keyId);
				},
				async setColumnTextLimit(limit){
					ColumnHandler.setTextLimit(limit);
				}
			}
		}
	}
}
