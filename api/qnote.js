var qnote = class extends ExtensionCommon.ExtensionAPI {
	getAPI(context) {
		let { extension } = context;

		var API = extension.apiManager.apis.get(extension);

		var browser = {
			storage: API.get('storage').getAPI(context).storage
		};

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
