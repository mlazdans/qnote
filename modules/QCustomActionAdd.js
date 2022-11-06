var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { QNoteFile } = ChromeUtils.import("resource://qnote/modules/QNoteFile.js");

var EXPORTED_SYMBOLS = ["QCustomActionAdd"];

class QCustomActionAdd {
	constructor(options) {
		this.id = 'qnote@dqdp.net#qnoteAdd';
		this.needsBody = true;
		this.isAsync = false;
		this.allowDuplicates = false;

		this.name = options.name;
		this.notesRoot = options.notesRoot;

		this.QN = new QNoteFile;
		this.API = options.API;
		this.Services = Services;
	}

	isValidForType(type, scope) {
		return true;
	}

	validateActionValue(actionValue, actionFolder, filterType) {
		if (actionValue) {
			return null;
		}

		return "QNote text required";
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
		this._wrap(msgHdrs => {
			return msgHdrs.map(m => {
				return m.messageId;
			});
		}, msgHdrs, actionValue)
	}

	// Compatibility with older TB
	apply(msgHdrs, actionValue, copyListener, filterType, msgWindow){
		this._wrap(msgHdrs => {
			let en = msgHdrs.enumerate();
			let ret = [];
			while (en.hasMoreElements()) {
				ret.push((en.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr)).messageId);
			};
			return ret;
		}, msgHdrs, actionValue);
	}

	_wrap(msgHdrsFunc, msgHdrs, actionValue){
		if(!actionValue){
			return;
		}

		let ts = Date.now();
		let w = this.Services.wm.getMostRecentWindow("mail:3pane");

		msgHdrsFunc(msgHdrs).forEach(keyId => {
			let note = {
				text: actionValue,
				ts: ts
			};

			if(!this.QN.getExistingFile(this.notesRoot, keyId)){
				this.QN.save(this.notesRoot, keyId, note);
				this.API.noteGrabber.delete(keyId);
				this.API.updateView(w, keyId);
			}
		});
	}
};
