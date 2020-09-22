var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

var EXPORTED_SYMBOLS = ["ColumnHandler"];

var ColumnHandler;

var handler = {
	isEditable: function(row, col) {
		return false;
	},
	cycleCell: function(row,col) {
	},
	getCellText: function(row, col) {
		let note = ColumnHandler.getNote(row);

		return note.exists ? note.text : null;
	},
	getSortStringForRow: function(hdr) {
		let note = ColumnHandler.getNote(hdr.messageId);

		return note.exists ? note.text : null;
	},
	isString: function() {
		return true;
	},
	getCellProperties: function(row, col, props){
	},
	getRowProperties: function(row, props){
	},
	getImageSrc: function(row, col) {
		let note = ColumnHandler.getNote(row);

		return note.exists ? extension.rootURI.resolve("images/icon-column.png") : null;
	},
	getSortLongForRow: function(hdr) {
	}
};

var Observer = {
	observe: function(aMsgFolder, aTopic, aData) {
		if(!ColumnHandler.getView()){
			return;
		}

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
			ColumnHandler.getView().addColumnHandler("qnoteCol", handler);

			// https://www.xulplanet.com/references/xpcomref/ifaces/nsMsgViewNotificationCode/
			ColumnHandler.getView().NoteChange(0, ColumnHandler.getView().rowCount, 2);
			//ColumnHandler.handlers.push(ColumnHandler.getView());
		}
	}
};

ColumnHandler = {
	options: {},
	handlers: [],
	NotesCache: [],
	Observer: Observer,
	saveNoteCache(note){
		if(ColumnHandler.options.textLimit){
			if(typeof note.text === 'string'){
				note.text = note.text.substring(0, ColumnHandler.options.textLimit);
			}
		} else {
			note.text = '';
		}
		ColumnHandler.NotesCache[note.keyId] = note;
	},
	getNoteCache(keyId){
		if(ColumnHandler.NotesCache[keyId]){
			return ColumnHandler.NotesCache[keyId];
		}
	},
	deleteNoteCache(keyId){
		ColumnHandler.NotesCache[keyId] = undefined;
	},
	getNote(row){
		let messageId;

		if(Number.isInteger(row)){
			try {
				messageId = ColumnHandler.getView().getMsgHdrAt(row).messageId;
			} catch(e){
				return {};
			}
		} else {
			messageId = row;
		}

		let note = ColumnHandler.getNoteCache(messageId);

		if(note){
			return note;
		} else {
			if(ColumnHandler.options.onNoteRequest){
				ColumnHandler.options.onNoteRequest(messageId).then((note)=>{
					ColumnHandler.saveNoteCache(note);
				});
			}

			return {};
		}
	},
	install(options) {
		ColumnHandler.options = options;

		var eObservers = Services.obs.enumerateObservers("MsgCreateDBView");
		while (eObservers.hasMoreElements()) {
			var o = eObservers.getNext().QueryInterface(Ci.nsIObserver);
			Services.obs.removeObserver(o, "MsgCreateDBView");
		}

		//if(ColumnHandler.getView()){
			Services.obs.addObserver(ColumnHandler.Observer, "MsgCreateDBView", false);
		//}
	},
	uninstall() {
		for(let k of ColumnHandler.handlers){
			try {
				k.removeColumnHandler("qnoteCol");
			} catch {
			}
		}

		Services.obs.removeObserver(ColumnHandler.Observer, "MsgCreateDBView");

		var w = Services.wm.getMostRecentWindow("mail:3pane");
		var qnoteCol = w.document.getElementById("qnoteCol");
		if(qnoteCol){
			qnoteCol.parentNode.removeChild(qnoteCol.previousSibling);
			qnoteCol.parentNode.removeChild(qnoteCol);
		}
	},
	getView() {
		return Services.wm.getMostRecentWindow("mail:3pane").gDBView;
	}
};
