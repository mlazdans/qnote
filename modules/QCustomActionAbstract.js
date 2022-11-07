var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { QNoteFile } = ChromeUtils.import("resource://qnote/modules/QNoteFile.js");

var EXPORTED_SYMBOLS = ["QCustomActionAbstract"];

class QCustomActionAbstract {
	constructor(options) {
		this.needsBody = true;
		this.isAsync = false;
		this.allowDuplicates = false;

		this.name = options.name;

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
		this._apply(msgHdrs.map(m => {
			return m.messageId;
		}), actionValue);
	}

	// Compatibility with older TB
	apply(msgHdrs, actionValue, copyListener, filterType, msgWindow){
		let en = msgHdrs.enumerate();
		let keyIds = [];
		while (en.hasMoreElements()) {
			keyIds.push((en.getNext().QueryInterface(Ci.nsIMsgDBHdr)).messageId);
		};
		this._apply(keyIds, actionValue);
	}

	/**
	 * Apply action rules here
	 * @abstract
	 */
	_apply(msgHdrs, actionValue){
		throw new Error('Must be implemented by subclass!');
	}
};
