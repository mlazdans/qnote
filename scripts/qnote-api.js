var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var { DBViewWrapper } = ChromeUtils.import("resource:///modules/DBViewWrapper.jsm");

var NotesCache = [];
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

var columnHandler = {
	getNote(row){
		let messageId;

		if(Number.isInteger(row)){
			messageId = cHandler.getView().getMsgHdrAt(row).messageId;
		} else {
			messageId = row;
		}

		if(messageId && NotesCache[messageId]){
			return NotesCache[messageId];
		} else {
			return {};
		}
	},
	isEditable: function(row, col) {
		return false;
	},
	cycleCell: function(row,col) {
	},
	getCellText: function(row, col) {
		let note = columnHandler.getNote(row);

		return note.keyId ? note.text : null;
	},
	getSortStringForRow: function(hdr) {
		let note = columnHandler.getNote(hdr.messageId);

		return note.keyId ? note.text : null;
	},
	isString: function() {
		return true;
	},
	getCellProperties: function(row, col, props){
	},
	getRowProperties: function(row, props){
	},
	getImageSrc: function(row, col) {
		let note = columnHandler.getNote(row);

		return note.keyId ? extension.getURL("images/icon-column.png") : null;
	},
	getSortLongForRow: function(hdr) {
	}
};

var cHandler = {
	install() {
		var eObservers = Services.obs.enumerateObservers("MsgCreateDBView");
		while (eObservers.hasMoreElements()) {
			var o = eObservers.getNext().QueryInterface(Ci.nsIObserver);
			Services.obs.removeObserver(o, "MsgCreateDBView");
		}

		Services.obs.addObserver(cHandler.XNoteObserver, "MsgCreateDBView", false);
	},
	uninstall() {
		for(let k of cHandler.handlers){
			try {
				k.removeColumnHandler("qnoteCol");
			} catch (e) {
				//console.error(e);
			}
		}
		Services.obs.removeObserver(cHandler.XNoteObserver, "MsgCreateDBView");

		var w = Services.wm.getMostRecentWindow("mail:3pane");
		var qnoteCol = w.document.getElementById("qnoteCol");
		if(qnoteCol){
			qnoteCol.parentNode.removeChild(qnoteCol.previousSibling);
			qnoteCol.parentNode.removeChild(qnoteCol);
		}
	},
	getView() {
		return Services.wm.getMostRecentWindow("mail:3pane").gDBView;
	},
	handlers: [],
	XNoteObserver: {
		observe: function(aMsgFolder, aTopic, aData) {
			var w = Services.wm.getMostRecentWindow("mail:3pane");
			var qnoteCol = w.document.getElementById("qnoteCol");
			var html =
				'<splitter class="tree-splitter" />' +
				'<treecol id="qnoteCol" persist="ordinal width sortDirection" flex="2" closemenu="none" label="QNote">' +
				'<label class="treecol-text" flex="1" crop="right" />' +
				'<image class="treecol-sortdirection"/>' +
				'</treecol>'
			;

			var threadCols = w.document.getElementById("threadCols");
			if(!qnoteCol && threadCols){
				threadCols.appendChild(w.MozXULElement.parseXULToFragment(html));
			}

			if(threadCols){
				cHandler.getView().addColumnHandler("qnoteCol", columnHandler);

				// https://www.xulplanet.com/references/xpcomref/ifaces/nsMsgViewNotificationCode/
				cHandler.getView().NoteChange(0, cHandler.getView().rowCount, 2);
				//cHandler.handlers.push(cHandler.getView());
			}
		}
	},
	columnHandler: columnHandler
};

cHandler.install();

var qnote = class extends ExtensionCommon.ExtensionAPI {
	onShutdown(isAppShutdown) {
		if(isAppShutdown){
			return;
		}

		Services.obs.notifyObservers(null, "startupcache-invalidate");

		cHandler.uninstall();
	}
	getAPI(context) {
		return {
			qnote: {
				async setNote(note){
					NotesCache[note.keyId] = note;
				},
				async deleteNote(keyId){
					NotesCache[keyId] = undefined;
				},
				async getVisibleMessages(){
					var i;
					var ret = [];
					var view = cHandler.getView();
					for(i = 0; i < view.rowCount; i++){
						let m = view.getMsgHdrAt(i);
						ret.push({
							messageId: m.messageId
						});
					}
					return ret;
				},
				async updateView(){
					if(cHandler.getView()){
						cHandler.XNoteObserver.observe();
					}
				}
			}
		}
	}
}

