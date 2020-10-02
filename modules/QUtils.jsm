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
			focusOnDisplay: false,
			windowOption: "xul",
			storageOption: "folder",
			storageFolder: ""//,
			//version: browser.runtime.getManifest().version
		};
	},
	encodeFileName(str){
		return escape(str).replace(/\//g, "%2F");
	},
	decodeFileName(str){
		return unescape(str.replace("%2F", "/"));
	}
};
