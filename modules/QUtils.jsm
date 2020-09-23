var EXPORTED_SYMBOLS = ["QUtils"];

var QUtils = {
	getDefaultPrefs() {
		return {
			useTag: false,
			tagName: "xnote",
			dateFormat: "yyyy-mm-dd - HH:MM", // TODO: implement
			width: 320,
			height: 200,
			showFirstChars: 0,
			showOnSelect: true,
			storageOption: "folder",
			storageFolder: ""//,
			//version: browser.runtime.getManifest().version
		};
	},
	getProfilePath() {
		return Components.classes['@mozilla.org/file/directory_service;1']
			.getService(Components.interfaces.nsIProperties)
			.get('ProfD', Components.interfaces.nsIFile);
	}
};
