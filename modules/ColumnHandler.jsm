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
		let note = ColumnHandler.getNote(row,col);

		return note.exists ? note.shortText : null;
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
		let note = ColumnHandler.getNote(row,col);

		return note.exists ? extension.rootURI.resolve("images/icon-column.png") : null;
	},
	getSortLongForRow: function(hdr) {
	}
};

var Observer = {
	observe: function(aMsgFolder, aTopic, aData) {
		var view = ColumnHandler.getView();
		if(!view){
			return;
		}

		var w = Services.wm.getMostRecentWindow("mail:3pane");
		var qnoteCol = w.document.getElementById("qnoteCol");

		var html =
			'<splitter class="tree-splitter" />' +
			'<treecol id="qnoteCol" persist="ordinal width sortDirection" flex="1" closemenu="none" label="QNote">' +
			'<label class="treecol-text" flex="1" crop="right" />' +
			'<image class="treecol-sortdirection"/>' +
			'</treecol>'
		;

		var threadCols = w.document.getElementById("threadCols");
		if(!qnoteCol && threadCols){
			threadCols.appendChild(w.MozXULElement.parseXULToFragment(html));
		}

		view.addColumnHandler("qnoteCol", handler);
	}
};

ColumnHandler = {
	options: {},
	handlers: [],
	NotesCache: [],
	Observer: Observer,
	setTextLimit(limit){
		ColumnHandler.options.textLimit = limit;
	},
	saveNoteCache(note){
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
	getView() {
		return Services.wm.getMostRecentWindow("mail:3pane").gDBView;
	},
	getNote(row,col){
		let messageId;
		let view = ColumnHandler.getView();

		if(Number.isInteger(row)){
			try {
				messageId = view.getMsgHdrAt(row).messageId;
			} catch(e){
				return {};
			}
		} else {
			messageId = row;
		}

		var note = ColumnHandler.getNoteCache(messageId);

		if(note){
			var cloneNote = Object.assign({}, note);

			cloneNote.shortText = '';

			if(ColumnHandler.options.textLimit && (typeof cloneNote.text === 'string')){
				cloneNote.shortText = cloneNote.text.substring(0, ColumnHandler.options.textLimit);
			}

			return cloneNote;
		} else {
			if(ColumnHandler.options.onNoteRequest){
				ColumnHandler.options.onNoteRequest(messageId).then((data)=>{
					ColumnHandler.saveNoteCache(data);
					if(col){
						view.cycleCell(row, col);
					}
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

		Services.obs.addObserver(ColumnHandler.Observer, "MsgCreateDBView", false);
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
	}
};
