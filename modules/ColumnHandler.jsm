var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

var EXPORTED_SYMBOLS = ["ColumnHandler"];

var ColumnHandler;

{
let noteGrabber;

let handler = {
	isEditable: function(row, col) {
		return false;
	},
	cycleCell: function(row, col) {
	},
	getCellText: function(row, col) {
		let note = noteGrabber.getNote(ColumnHandler.getView().getMsgHdrAt(row).messageId, {row: row});

		if(note.exists && !note.shortText && ColumnHandler.options.textLimit && (typeof note.text === 'string')){
			note.shortText = note.text.substring(0, ColumnHandler.options.textLimit);
		}

		return note.exists ? note.shortText : null;
	},
	getSortStringForRow: function(hdr) {
		let note = noteGrabber.getNote(hdr.messageId);

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
		let note = noteGrabber.getNote(ColumnHandler.getView().getMsgHdrAt(row).messageId, {row: row});

		return note.exists ? extension.rootURI.resolve("images/icon-column.png") : null;
	},
	getSortLongForRow: function(hdr) {
	}
};

let Observer = {
	observe: function(aMsgFolder, aTopic, aData) {
		var view = ColumnHandler.getView();

		if(!view){
			return;
		}

		try {
			let cssService = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
			let uri = Services.io.newURI(extension.getURL("html/background.css"), null, null);
			if(!cssService.sheetRegistered(uri, cssService.USER_SHEET)){
				cssService.loadAndRegisterSheet(uri, cssService.USER_SHEET);
			}
		} catch(e) {
			console.error(e);
		}

		var w = Services.wm.getMostRecentWindow("mail:3pane");
		var threadCols = w.document.getElementById("threadCols");
		var qnoteCol = w.document.getElementById("qnoteCol");

		if(!qnoteCol && threadCols){
			// http://wbamberg.github.io/idl-reference/docs/nsIXULStore.html
			let width = 24;
			let ordinal;
			let colOrdinalStr = '';
			let splitOrdinalStr = '';

			var __xulStore = Cc["@mozilla.org/xul/xulstore;1"].getService(Ci.nsIXULStore);

			if(__xulStore.hasValue("chrome://messenger/content/messenger.xhtml", "qnoteCol", "width")){
				width = Number.parseInt(__xulStore.getValue("chrome://messenger/content/messenger.xhtml", "qnoteCol", "width"));
			}

			if(__xulStore.hasValue("chrome://messenger/content/messenger.xhtml", "qnoteCol", "ordinal")){
				ordinal = Number.parseInt(__xulStore.getValue("chrome://messenger/content/messenger.xhtml", "qnoteCol", "ordinal"));
			}

			// var cStates = w.gFolderDisplay.getColumnStates();

			// console.log("view1", cStates.qnoteCol);

			// if(cStates.qnoteCol === undefined){
			// 	cStates.qnoteCol = {
			// 		width: width,
			// 		visible: true
			// 	};
			// 	if(ordinal){
			// 		cStates.qnoteCol.ordinal = ordinal
			// 	}
			// } else {
			// 	if(cStates.qnoteCol.width){
			// 		width = Number.parseInt(cStates.qnoteCol.width);
			// 	}
			// 	if(cStates.qnoteCol.ordinal){
			// 		ordinal = Number.parseInt(cStates.qnoteCol.ordinal);
			// 	}
			// 	//var { width, ordinal } = cStates.qnoteCol;
			// }

			if(ordinal){
				// colOrdinalStr = `ordinal="${ordinal}" style="-moz-box-ordinal-group: ${ordinal};"`;
				// splitOrdinalStr = `style="-moz-box-ordinal-group: ${(ordinal - 1)};"`;
			}
			//console.log("ordinals", ordinal, colOrdinalStr, splitOrdinalStr);

			var html = `<splitter class="tree-splitter" resizeafter="farthest" ${splitOrdinalStr} />
				<treecol id="qnoteCol" persist="hidden ordinal width sortDirection" width="${width}" ${colOrdinalStr}
				label="QNote" minwidth="19" tooltiptext="QNote" currentView="unthreaded"
				is="treecol-image" class="treecol-image qnote-column-header"/>`
			;

			// '<label class="treecol-text" crop="right" value="QNote" />' +
			// '<image class="treecol-sortdirection" />' +
			let treecols = threadCols.querySelectorAll("treecol");
			let last = treecols[treecols.length - 1];
			last.parentNode.insertBefore(w.MozXULElement.parseXULToFragment(html), last.nextSibling);
			//console.log("no col");
			//w.gFolderDisplay.hintColumnsChanged();

			//if(cStates.qnoteCol === undefined){
			//w.gFolderDisplay.setColumnStates(cStates);
			//}
			//threadCols.appendChild(w.MozXULElement.parseXULToFragment(html));
		} else {
			//qnoteCol.trigger('resize');
			// threadCols.style.display='none';
			// threadCols.style.display='';
			//console.log("qnoteCol", qnoteCol, threadCols);
		}

		view.addColumnHandler("qnoteCol", handler);
		//console.log("addColumnHandler");
		w.gFolderDisplay.hintColumnsChanged();
	}
};

ColumnHandler = {
	options: {},
	//handlers: [],
	Observer: Observer,
	setTextLimit(limit){
		ColumnHandler.options.textLimit = limit;
	},
	getView() {
		// TODO: add colum to search dialog
		return Services.wm.getMostRecentWindow("mail:3pane").gDBView;
	},
	install(options) {
		ColumnHandler.options = options;
		noteGrabber = options.noteGrabber;
		noteGrabber.addListener("noterequest", (keyId, data, params) => {
			var view = ColumnHandler.getView();
			if(view && params && params.row){
				// Asynchronically here we update note column.
				// That method is part of Mozilla API and has nothing to do with either XNote or QNote :)
				view.NoteChange(params.row, 1, 2);
			}
		});

		var eObservers = Services.obs.enumerateObservers("MsgCreateDBView");
		while (eObservers.hasMoreElements()) {
			var o = eObservers.getNext().QueryInterface(Ci.nsIObserver);
			Services.obs.removeObserver(o, "MsgCreateDBView");
		}

		Services.obs.addObserver(ColumnHandler.Observer, "MsgCreateDBView", false);
	},
	uninstall() {
		// for(let k of ColumnHandler.handlers){
		// 	try {
		// 		k.removeColumnHandler("qnoteCol");
		// 	} catch {
		// 	}
		// }

		try {
			Services.obs.removeObserver(ColumnHandler.Observer, "MsgCreateDBView");
		} catch {
		}

		var w = Services.wm.getMostRecentWindow("mail:3pane");
		var qnoteCol = w.document.getElementById("qnoteCol");
		if(qnoteCol){
			qnoteCol.parentNode.removeChild(qnoteCol.previousSibling);
			qnoteCol.parentNode.removeChild(qnoteCol);
		}
	}
};
};
