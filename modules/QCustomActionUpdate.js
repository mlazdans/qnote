const Services = globalThis.Services || ChromeUtils.import(
  "resource://gre/modules/Services.jsm"
).Services;
var { QCustomActionAbstract } = ChromeUtils.import("resource://qnote/modules/QCustomActionAbstract.js");

var EXPORTED_SYMBOLS = ["QCustomActionUpdate"];

class QCustomActionUpdate extends QCustomActionAbstract {
	constructor(options) {
		super(options);
		this.id = 'qnote@dqdp.net#qnote-action-update';
		this.xulName = "qnote-ruleactiontarget-update";
	}

	_apply(keyIds, actionValue){
		let notesRoot = this.API.getStorageFolder();

		if(!actionValue || !notesRoot){
			return;
		}

		let ts = Date.now();
		let w = this.Services.wm.getMostRecentWindow("mail:3pane");

		keyIds.forEach(keyId => {
			let note = {
				text: actionValue,
				ts: ts
			};

			this.QN.save(notesRoot, keyId, note);
			this.API.noteGrabber.delete(keyId);
			this.API.updateView(w, keyId);
		});
	}
};
