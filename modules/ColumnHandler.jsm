var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

var EXPORTED_SYMBOLS = ["ColumnHandler"];

var ColumnHandler;

{

let noteGrabber;

class QNoteColumnHandler {
	constructor(folder) {
		this.folder = folder;
		this.window = folder.msgWindow.domWindow;
		this.view = folder.view.dbView;
		this.setUpDOM();

		this.noteRowListener = (view, row) => {
			if(view && row){
				// Asynchronically here we update note row
				// That method is part of Mozilla API and has nothing to do with either XNote or QNote :)
				view.NoteChange(row, 1, 2);
			}
		}
	}

	setUpDOM() {
		let w = this.window;
		let threadCols = w.document.getElementById("threadCols");
		let qnoteCol = w.document.getElementById("qnoteCol");

		//if(!qnoteCol && threadCols){
		if(qnoteCol || !threadCols){
			return;
		}

		// TODO: check database for column state (see sample folderDisplay.js)?
		// let msgDatabase = this.view.displayedFolder.msgDatabase;

		// http://wbamberg.github.io/idl-reference/docs/nsIXULStore.html
		let width = 24;
		let ordinal;
		let colOrdinalStr = '';
		let splitOrdinalStr = '';

		let __xulStore = Cc["@mozilla.org/xul/xulstore;1"].getService(Ci.nsIXULStore);

		if(__xulStore.hasValue("chrome://messenger/content/messenger.xhtml", "qnoteCol", "width")){
			width = Number.parseInt(__xulStore.getValue("chrome://messenger/content/messenger.xhtml", "qnoteCol", "width"));
		}

		if(__xulStore.hasValue("chrome://messenger/content/messenger.xhtml", "qnoteCol", "ordinal")){
			ordinal = Number.parseInt(__xulStore.getValue("chrome://messenger/content/messenger.xhtml", "qnoteCol", "ordinal"));
		}

		// let cStates = w.gFolderDisplay.getColumnStates();
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
		// 	//let { width, ordinal } = cStates.qnoteCol;
		// }

		if(ordinal){
			// colOrdinalStr = `ordinal="${ordinal}" style="-moz-box-ordinal-group: ${ordinal};"`;
			// splitOrdinalStr = `style="-moz-box-ordinal-group: ${(ordinal - 1)};"`;
		}

		let html = `<splitter class="tree-splitter" resizeafter="farthest" ${splitOrdinalStr} />
			<treecol id="qnoteCol" persist="hidden ordinal width sortDirection" width="${width}" ${colOrdinalStr}
			label="QNote" minwidth="19" tooltiptext="QNote" currentView="unthreaded"
			is="treecol-image" class="treecol-image qnote-column-header"/>`
		;

		// '<label class="treecol-text" crop="right" value="QNote" />' +
		// '<image class="treecol-sortdirection" />' +
		let treecols = threadCols.querySelectorAll("treecol");
		let last = treecols[treecols.length - 1];

		last.parentNode.insertBefore(w.MozXULElement.parseXULToFragment(html), last.nextSibling);
	}

	isEditable(row, col) {
		return false;
	}

	// cycleCell(row, col) {
	// }

	getCellText(row, col) {
		let note = noteGrabber.getNote(this.view.getMsgHdrAt(row).messageId, () => {
			this.noteRowListener(this.view, row);
		});

		if(note.exists && !note.shortText && ColumnHandler.options.textLimit && (typeof note.text === 'string')){
			note.shortText = note.text.substring(0, ColumnHandler.options.textLimit);
		}

		return note.exists ? note.shortText : null;
	}

	getSortStringForRow(hdr) {
		let note = noteGrabber.getNote(hdr.messageId);

		return note.exists ? note.text : null;
	}

	isString() {
		return true;
	}

	// getCellProperties(row, col, props){
	// }

	// getRowProperties(row, props){
	// }

	getImageSrc(row, col) {
		let note = noteGrabber.getNote(this.view.getMsgHdrAt(row).messageId, () => {
			this.noteRowListener(this.view, row);
		});

		return note.exists ? extension.rootURI.resolve("images/icon-column.png") : null;
	}

	// getSortLongForRow(hdr) {
	// }
};

let WindowObserver = {
	observe: function(aSubject, aTopic) {
		if(aTopic === 'domwindowopened'){
			aSubject.addEventListener("DOMContentLoaded", e => {
				let document = e.target;
				let threadCols = document.getElementById("threadCols");

				if(threadCols) {
					ColumnHandler.attachToWindow(aSubject);
				}
			});
		}
	}
}

let DBViewListener = {
	onCreatedView: widget => {
		let view = widget.view.dbView;
		let qnCH = new QNoteColumnHandler(widget);

		view.addColumnHandler("qnoteCol", qnCH);

		ColumnHandler.handlers.push(qnCH);
	},
	onActiveCreatedView: widget => {
		widget.hintColumnsChanged();
	},
	onDestroyingView: (widget, aFolderIsComingBack) => {
	},
	onMessagesLoaded: (widget, aAll) => {
	}
};

ColumnHandler = {
	options: {},
	handlers: [],
	setTextLimit(limit){
		ColumnHandler.options.textLimit = limit;
	},
	attachToWindow(w){
		console.debug("ColumnHandler.attachToWindow()");
		w.FolderDisplayListenerManager.registerListener(DBViewListener);
		if(w.gFolderDisplay){
			DBViewListener.onCreatedView(w.gFolderDisplay);
		}
	},
	install(options) {
		console.debug("ColumnHandler.install()");
		ColumnHandler.options = options;
		noteGrabber = options.noteGrabber;
		Services.ww.registerNotification(WindowObserver);
		this.attachToWindow(Services.wm.getMostRecentWindow("mail:3pane"));
	},
	uninstall() {
		console.debug("ColumnHandler.uninstall()");
		let qnoteCol;

		for(let i = 0; i < ColumnHandler.handlers.length; i++){
			let w = ColumnHandler.handlers[i].window;
			let view = ColumnHandler.handlers[i].view;

			view.removeColumnHandler("qnoteCol");

			if(qnoteCol = w.document.getElementById("qnoteCol")){
				qnoteCol.parentNode.removeChild(qnoteCol.previousSibling);
				qnoteCol.parentNode.removeChild(qnoteCol);
			}

			w.FolderDisplayListenerManager.unregisterListener(DBViewListener);
		}

		Services.ww.unregisterNotification(WindowObserver);
	}
};
};
