var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var qnote = class extends ExtensionCommon.ExtensionAPI {
	onShutdown(isAppShutdown) {
		if(isAppShutdown){
			return;
		}

		Services.obs.notifyObservers(null, "startupcache-invalidate", null);
	}
	getAPI(context) {
		var wex = Components.utils.waiveXrays(context.cloneScope);
		var { browser } = wex;

		return {
			qnote: {
				async deleteNote(keyId){
					return browser.storage.local.remove(keyId).then(()=>{
						return true;
					});
				},
				async loadNote(keyId){
					return browser.storage.local.get([keyId]).then((store)=>{
						if(!store || !store[keyId]){
							return false;
						}

						return store[keyId];
					});
				},
				async saveNote(keyId, note){
					return browser.storage.local.set({
						[keyId]: note
					}).then(()=>{
						return note;
					});
				}
			}
		}
	}
}
