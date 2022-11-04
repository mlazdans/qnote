var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { QNoteFile } = ChromeUtils.import("resource://qnote/modules/QNoteFile.js");

var EXPORTED_SYMBOLS = ["QCustomAction"];

class QCustomAction {
	constructor(options) {
		this.options = options;
		this.id = 'qnote@dqdp.net#qnoteAdd';
		this.name = options.name;
		this.needsBody = options.needsBody;
		this.notesRoot = options.notesRoot;
		this.isAsync = false;
		this.allowDuplicates = false;
		this.QN = new QNoteFile;
		this.Services = Services;
		this.API = options.API;
	}

	isValidForType(type, scope) {
		// console.log("isValidForType", type, scope);
		return true;
	}

	validateActionValue(actionValue, actionFolder, filterType) {
		// console.log("validateActionValue", actionValue, actionFolder, filterType);
		if (!actionValue) {
			return "QNote text required";
		}

		return null;
	}

	/**
	 * Apply the custom action to an array of messages
	 *
	 * @param msgHdrs      array of nsIMsgDBHdr objects of messages
	 * @param actionValue  user-set value to use in the action
	 * @param copyListener calling method (filterType Manual only)
	 * @param filterType   type of filter being applied
	 * @param msgWindow    message window
	 */
	applyAction(msgHdrs, actionValue, copyListener, filterType, msgWindow){
		// console.log("applyAction", msgHdrs.enumerate(), msgHdrs, actionValue, copyListener, filterType, msgWindow);
		if(!actionValue){
			return;
		}

		let ts = Date.now();
		let w = this.Services.wm.getMostRecentWindow("mail:3pane");

		msgHdrs.forEach(m => {
			this._apply(w, ts, actionValue, m.messageId)
		});
	}

	// Compatibility with older TB
	apply(msgHdrs, actionValue, copyListener, filterType, msgWindow){
		if(!actionValue){
			return;
		}

		let ts = Date.now();
		let w = this.Services.wm.getMostRecentWindow("mail:3pane");

		let en = msgHdrs.enumerate();
		while (en.hasMoreElements()) {
			var m = en.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
			this._apply(w, ts, actionValue, m.messageId)
		};
	}

	_apply(w, ts, actionValue, keyId){
		let note = {
			text: actionValue,
			ts: ts
		};

		if(!this.QN.getExistingFile(this.notesRoot, keyId)){
			this.QN.save(this.notesRoot, keyId, note);
			this.API.noteGrabber.delete(keyId);
			this.API.updateView(w, keyId);
		}
	}
};
