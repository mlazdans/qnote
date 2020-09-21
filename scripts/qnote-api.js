var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var { DBViewWrapper } = ChromeUtils.import("resource:///modules/DBViewWrapper.jsm");

var NotesCache = [];
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

var columnHandler = {
	getNote(row){
		let m = cHandler.getView().getMsgHdrAt(row);
		if(m && NotesCache[m.messageId] && NotesCache[m.messageId].text){
			return NotesCache[m.messageId];
		}
	},
	isEditable: function(row, col) {
		return false;
	},
	cycleCell: function(row,col) {
	},
	getCellText: function(row, col) {
		let note = columnHandler.getNote(row);
		if(note && note.text){
			return note.text;
		}

		return null;
		// let xnotePrefs = xnote.ns.Commons.xnotePrefs;
		// if (xnotePrefs.getIntPref("show_first_x_chars_in_col") > 0) {
		// 	let note = new xnote.ns.Note(getHeaderForRow(row).messageId);
		// 	if (note.exists()) {
		// 		return " " + note.text.substr(0,xnotePrefs.getIntPref("show_first_x_chars_in_col"));
		// 	}
		// }
		// return null;
	},
	getSortStringForRow: function(hdr) {
		// let xnotePrefs = xnote.ns.Commons.xnotePrefs;
		// if (xnotePrefs.getIntPref("show_first_x_chars_in_col") > 0) {
		// 	let note = new xnote.ns.Note(hdr.messageId);
		// 	if (note.exists()) {
		// 		return " " + note.text.substr(0,xnotePrefs.getIntPref("show_first_x_chars_in_col"));
		// 	} else {
		// 		return "";
		// 	}
		// }
		// return pub.hasNote(hdr.messageId);
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
		if(note && note.text){
			return extension.getURL("images/icon-column.png");
		}
		//return "../images/xnote_context.png";
		// let hdr = getHeaderForRow(row);
		// if(pub.hasNote(hdr.messageId)){
		// 	return "chrome://xnote/skin/xnote_context.png";
		// } else {
		// 	return null;
		// }
	},
	getSortLongForRow: function(hdr) {
		//return pub.hasNote(hdr.messageId);
	}
};

// for (const node of w.document.querySelectorAll('treecol')) {
// 	if(node.getAttribute('label') == 'QNote'){
// 		console.log(node);
// 	}
// }

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
			//console.log("w.view", w.gFolderDisplay.view);
			var qnoteCol = w.document.getElementById("qnoteCol");
			var html =
				'<splitter class="tree-splitter" />' +
				'<treecol id="qnoteCol" persist="ordinal width" label="QNote" currentView="unthreaded" ' +
				'is="treecol-image" class="treecol-image xnote-column-header">' +
				'<label class="treecol-text" flex="1" crop="right" value=" QNote " />' +
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
				async installObserver() {
					//let realMessage = context.extension.messageManager.get(messageId);
					//var w = Services.wm.getMostRecentWindow("mail:3pane");
					//gFolderDisplay.view.setMailView(MailViewConstants.kViewItemAll);;
					//w.MsgSearchMessages();
					//console.log(context.extension.apiManager.apis.get(extension).get('backgroundPage'));
					//var e = context.extension.apiManager.apis.get(extension);
					//var e = context.extension.apiManager.modulePaths.children.get('storage');
					//var e = context.extension;
					// e.forEach((a,b)=>{
					// 	console.log("forEach", a,b);
					// });
					//console.log(e, e.get('menus'));
					//.get('backgroundPage')
					//console.log(context.extension.windowManager.getWrapper(w).id);
					// Get a real tab from a tab ID:
					// let tabObject = context.extension.tabManager.get(tabId);
					// let realTab = tabObject.nativeTab;
					// let realTabWindow = tabObject.window;

					// // Get a tab ID from a real tab:
					// context.extension.tabManager.getWrapper(realTab).id;

					// // Query tabs: (note this returns a Generator, not an array like the API)
					// context.extension.tabManager.query(queryInfo);

					//cHandler.install();
				},
				async uninstallObserver() {
					//Services.obs.removeObserver(XNoteObserver, "MsgCreateDBView");
				},
				async setNote(note){
					NotesCache[note.keyId] = note;
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
					//var w = Services.wm.getMostRecentWindow("mail:3pane");
					if(cHandler.getView()){
						cHandler.XNoteObserver.observe();
					}
					//w.gFolderDisplay._activeCreatedView();
					//w.gFolderDisplay.show("Inbox");
					// w.gFolderDisplay.COLUMNS_MAP_NOSORT.add("qnoteCol");
					// console.log(w.gFolderDisplay.COLUMNS_MAP_NOSORT);
					// console.log(w.gFolderDisplay.getColumnStates());
					//console.log(w.gFolderDisplay.hintColumnsChanged());
					return;

					let messagepane = w.document.getElementById("messagepane");
					let tabmail = w.document.getElementById("threadTree");

					let wra = DBViewWrapper(cHandler.getView());
					//this.messageDisplay.onDisplayingMessage(msgHdr);
					//messageDisplay
					// var q = tabManager.query({
					// 	active: true,
					// 	currentWindow: true,
					// 	lastFocusedWindow : true,
					// 	mailTab: true,
					// 	windowId: w.windowId,

					// 	// All of these are needed for tabManager to return every tab we want.
					// 	index: null,
					// 	screen: null,
					// 	url: null,
					// 	windowType: null,
					// });
					//w.updateMailPaneUI();
					//console.log(w,w.nsMsgWindowCommands());
					//console.log(tabManager.get());

					//var w = Services.wm.getMostRecentWindow("mail:3pane");
					//console.log(w);
					//console.log(cHandler.getView().getColumnHandler("qnoteCol"));
				}
			}
		}
	}
}
