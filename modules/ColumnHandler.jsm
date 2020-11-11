var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

var EXPORTED_SYMBOLS = ["ColumnHandler"];

var ColumnHandler;

{

// TODO: try
// class MozThreadPaneTreecols extends customElements.get("treecols") {
let noteGrabber;

class QNoteColumnHandler {
	constructor(folder) {
		// console.log("new QNoteColumnHandler");
		this.folder = folder;
		this.window = folder.msgWindow.domWindow;
		this.view = folder.view.dbView;
		this.installed = this.setUpDOM();

		this.noteRowListener = (view, row) => {
			if(view && Number.isInteger(row)){
				// That method is part of Mozilla API and has nothing to do with either XNote or QNote :)
				view.NoteChange(row, 1, 2);
			}
		}
	}

	// http://wbamberg.github.io/idl-reference/docs/nsIXULStore.html
	xulStoreGet(key){
		let stores = [
			"chrome://messenger/content/messenger.xhtml",
			"chrome://messenger/content/messenger.xul" // TB68
		];

		for(let uri of stores){
			if(Services.xulStore.hasValue(uri, "qnoteCol", key)){
				return Services.xulStore.getValue(uri, "qnoteCol", key);
			}
		}
	}

	setUpDOM() {
		let w = this.window;
		let threadCols = w.document.getElementById("threadCols");
		let qnoteCol = w.document.getElementById("qnoteCol");

		// if(qnoteCol){
		// 	console.log("setUpDOM() - qnoteCol defined");
		// }

		// if(!threadCols){
		// 	console.log("setUpDOM() - threadCols not defined");
		// }

		if(qnoteCol || !threadCols){
			return;
		}

		let colStates = this.folder.getColumnStates();
		let newState = Object.assign({}, colStates.qnoteCol);

		let width;
		let { ordinal, visible } = newState;

		// console.log("before parse", colStates, newState, width, ordinal, visible);

		// Not sure what and where gets saved. I'm guessing `ordinal/visible` are stored within folder column states and `width` using xulstore?
		if(ordinal === undefined){
			ordinal = this.xulStoreGet("ordinal");
			// console.log(`ColumnHandler.setUpDOM XUL: ordinal=${ordinal}`);
		}

		if(width === undefined){
			width = this.xulStoreGet("width");
			// console.log(`ColumnHandler.setUpDOM XUL: width=${width}`);
		}

		if(visible === undefined){
			visible = this.xulStoreGet("hidden") !== true;
			// console.log(`ColumnHandler.setUpDOM XUL: visible =`, visible);
		}

		if(!width){
			width = 24;
		}

		// Some casts
		visible = !!visible;
		ordinal = ordinal + "";
		width = width + "";

		newState = { visible, ordinal };

		// console.log("after parse", colStates, newState, width, ordinal, visible);

		let widthStr = '';
		let colOrdinalStr = '';
		let splitOrdinalStr = '';

		if(ordinal){
			let splitOrdinal = ordinal - 1;
			colOrdinalStr = `ordinal="${ordinal}" style="-moz-box-ordinal-group: ${ordinal};"`;
			splitOrdinalStr = `style="-moz-box-ordinal-group: ${splitOrdinal};"`;
		}

		if(width){
			widthStr = `width="${width}"`;
		}

		let html = '';
		// Disabled splitter for now, will see
		//html += `<splitter class="tree-splitter" resizeafter="farthest" ${splitOrdinalStr} />`;
		html += `<treecol id="qnoteCol" persist="hidden ordinal width sortDirection" ${widthStr} ${colOrdinalStr}
			label="QNote" minwidth="19" tooltiptext="QNote" currentView="unthreaded"
			is="treecol-image" class="treecol-image qnote-column-header"/>`
			;

		// '<label class="treecol-text" crop="right" value="QNote" />' +
		// '<image class="treecol-sortdirection" />' +
		let treecols = threadCols.querySelectorAll("treecol");
		if(treecols.length){
			let last = treecols[treecols.length - 1];
			if(last){
				last.parentNode.insertBefore(w.MozXULElement.parseXULToFragment(html), last.nextSibling);
			}
		}

		colStates.qnoteCol = newState;

		this.folder.setColumnStates(colStates, true);

		return true;
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
		// console.log("WindowObserver->", aTopic);
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
	onCreatedView: aFolderDisplay => {
		// console.log("onCreatedView");
		//ColumnHandler.handlers.push(qnCH);
	},
	onActiveCreatedView: aFolderDisplay => {
		// console.log("onActiveCreatedView");
		let qnCH = new QNoteColumnHandler(aFolderDisplay);
		aFolderDisplay.view.dbView.addColumnHandler("qnoteCol", qnCH);
		// if(aFolderDisplay.view.dbView.refresh){
		// 	console.log("refresh");
		// 	aFolderDisplay.view.dbView.refresh();
		// }
	},
	onDestroyingView: (aFolderDisplay, aFolderIsComingBack) => {
		// console.log("onDestroyingView");
		try {
			aFolderDisplay.view.dbView.removeColumnHandler("qnoteCol");
		} catch (e) {
			console.error(e);
		}
	}
	// onMessagesLoaded: (aFolderDisplay, aAll) => {
	// 	console.log("onMessagesLoaded");
	// }
};

ColumnHandler = {
	options: {},
	windows: [],
	setTextLimit(limit){
		ColumnHandler.options.textLimit = limit;
	},
	attachToWindow(w){
		// console.debug("ColumnHandler.attachToWindow()");
		w.FolderDisplayListenerManager.registerListener(DBViewListener);
		if(w.gFolderDisplay){
			//DBViewListener.onCreatedView(w.gFolderDisplay);
			DBViewListener.onActiveCreatedView(w.gFolderDisplay);
		}
		this.windows.push(w);
	},
	install(options) {
		console.debug("ColumnHandler.install()");
		ColumnHandler.options = options;
		noteGrabber = options.noteGrabber;

		Services.ww.registerNotification(WindowObserver);

		// TODO: pass windows parameter
		this.attachToWindow(Services.wm.getMostRecentWindow("mail:3pane"));
	},
	uninstall() {
		console.debug("ColumnHandler.uninstall()");
		let qnoteCol;

		for(let w of this.windows){
			w.FolderDisplayListenerManager.unregisterListener(DBViewListener);

			try {
				w.gFolderDisplay.view.dbView.removeColumnHandler("qnoteCol");
			} catch (e) {
				console.error(e);
			}

			// if(qnoteCol = w.document.getElementById("qnoteCol")){
			// 	//qnoteCol.parentNode.removeChild(qnoteCol.previousSibling); // Splitter
			// 	qnoteCol.parentNode.removeChild(qnoteCol);
			// }
		}
		// for(let i = 0; i < ColumnHandler.handlers.length; i++){
		// 	let w = ColumnHandler.handlers[i].window;
		// 	let view = ColumnHandler.handlers[i].view;

		// 	//view.removeColumnHandler("qnoteCol");

		// 	if(qnoteCol = w.document.getElementById("qnoteCol")){
		// 		//qnoteCol.parentNode.removeChild(qnoteCol.previousSibling); // Splitter
		// 		qnoteCol.parentNode.removeChild(qnoteCol);
		// 	}

		// 	w.FolderDisplayListenerManager.unregisterListener(DBViewListener);
		// }

		Services.ww.unregisterNotification(WindowObserver);
	}
};
};
