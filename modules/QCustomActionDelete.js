var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { QCustomActionAbstract } = ChromeUtils.import("resource://qnote/modules/QCustomActionAbstract.js");

var EXPORTED_SYMBOLS = ["QCustomActionDelete"];

class QCustomActionDelete extends QCustomActionAbstract {
	constructor(options) {
		super(options);
		this.id = 'qnote@dqdp.net#qnote-action-delete';
		this.xulName = "qnote-ruleactiontarget-delete";
	}

	validateActionValue() {
		return null;
	}

	_apply(keyIds, actionValue){
		let notesRoot = this.API.getStorageFolder();

		if(!notesRoot){
			return;
		}

		let w = this.Services.wm.getMostRecentWindow("mail:3pane");
		keyIds.forEach(keyId => {
			this.QN.delete(notesRoot, keyId);
			this.API.noteGrabber.delete(keyId);
			this.API.updateView(w, keyId);
		});
	}
};
