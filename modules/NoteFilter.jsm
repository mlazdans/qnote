var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { QuickFilterManager, MessageTextFilter, QuickFilterSearchListener } = ChromeUtils.import("resource:///modules/QuickFilterManager.jsm");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");

var EXPORTED_SYMBOLS = ["NoteFilter"];

/*

Current problems:
1) match() does not expect promises
2) we can addCustomTerm() but can not remove
This leads to dead object problems once extension goes away.
Seems that this is TB core related

*/

var NoteFilter;

{

let noteGrabber;
let qfQnoteCheckedId = 'qfb-qs-qnote-checked';
let qnoteCustomTermId = 'qnote@dqdp.net#qnoteText';
let ops = [Ci.nsMsgSearchOp.Contains, Ci.nsMsgSearchOp.DoesntContain, Ci.nsMsgSearchOp.Is, Ci.nsMsgSearchOp.Isnt];

let WindowObserver = {
	observe: function(aSubject, aTopic) {
		if(aTopic === 'domwindowopened'){
			aSubject.addEventListener("DOMContentLoaded", e => {
				let document = e.target;

				if(!document.URL.includes('chrome://messenger/content/messenger')){
					return;
				}

				// let filterer = NoteFilter.getQF(aSubject.gFolderDisplay);
				// console.log("Attach to win", filterer);
				let tabmail = document.getElementById('tabmail');
				if(tabmail){
					NoteFilter.attachToWindow(aSubject);
				}
			});
		}
	}
}

// NOTE:
// We need completely restart TB if CustomTerm code changes
// Currenlty there are no means to remove filter or there is but I'm not aware, please let me know: qnote@dqdp.net
let CustomTerm = {
	id: qnoteCustomTermId,
	name: 'QNote',
	needsBody: false,
	getEnabled: function(scope, op) {
		return false;
		//return ops.includes(op);
	},
	// Currently disabled in search dialogs, because can't figure out how to add text box to the filter
	// Probably through XUL or something
	getAvailable: function(scope, op) {
		return false;
		//return ops.includes(op);
	},
	getAvailableOperators: function(scope, length) {
		if(length){
			length.value = ops.length;
		}
		return ops;
	},
	match: function(msgHdr, searchValue, searchOp) {
		console.log("match", msgHdr, searchValue, searchOp);
		// // TODO: we get dead objects here because we can not unload CustomTerm
		// let note = noteGrabber.getNote(msgHdr.messageId);

		// return note && note.exists && (note.text.toLowerCase().search(searchValue)>=0);
	}
};

let NoteQF = {
	name: "qnote",
	domId: qfQnoteCheckedId,
	propagateState: function(aTemplState, aSticky){
		console.log("propagateState", aTemplState, aSticky);
	},
	// postFilterProcess: function(aState, aViewWrapper, aFiltering){
	// 	console.log("postFilterProcess", aState, aViewWrapper, aFiltering);
	// 	return [aState, false, false];
	// },
	onCommand: function(aState, aNode, aEvent, aDocument){
		console.log("onCommand", aState, aNode, aEvent, aDocument);
		let qfTextBox = aDocument.getElementById('qfb-qs-textbox');
		let qfQnoteChecked = aDocument.getElementById(qfQnoteCheckedId);
		return [qfQnoteChecked.checked ? qfTextBox.value : null, true];
	},
	reflectInDOM: function(aDomNode, aFilterValue, aDocument, aMuxer){
		let qnoteFilterer = aMuxer.getFilterValueForMutation('qnote');
		console.log("reflectInDOM", aFilterValue, aDomNode.checked, qnoteFilterer);
		if(qnoteFilterer === undefined){
			aDomNode.checked = NoteFilter.getQNoteQFState()
			let textFilter = aMuxer.getFilterValueForMutation("text");
			console.log("restore filter", textFilter);
			aMuxer.setFilterValue('qnote', textFilter ? textFilter.text : "");
		} else {
			aDomNode.checked = !!qnoteFilterer;
		}

		// if(aMuxer.activeFilterer.getFilterValue('qnote')){
		// 	aDomNode.checked = true;
		// } else {
		// 	aDomNode.checked = false;
		// }
		//aDomNode.checked = !!aFilterValue;
		console.log("reflectInDOM - finish", aDomNode.checked);
		NoteFilter.updateSearch(aMuxer);
	},
	appendTerms: function(aTermCreator, aTerms, aFilterValue) {
		console.log("appendTerms", aFilterValue, aTerms, aTermCreator);

		// Let us borrow an existing code just for a while :>
		let phrases = MessageTextFilter._parseSearchString(aFilterValue.toLowerCase());
		let term;
		let firstClause = true;

		for (let kw of phrases) {
			term = aTermCreator.createTerm();

			let value = term.value;
			value.str = kw;
			value.attrib = Ci.nsMsgSearchAttrib.Subject;
			term.value = value;

			term.attrib = Ci.nsMsgSearchAttrib.Custom;
			term.customId = CustomTerm.id;
			term.op = Ci.nsMsgSearchOp.Contains;
			term.booleanAnd = !firstClause; // We need OR-ed with other QuickFilters and AND-ed with phrases
			term.beginsGrouping = firstClause;

			aTerms.push(term);

			firstClause = false;
		}

		if (term) {
			term.endsGrouping = true;
		}
	}
	// domBindExtra: function(aDocument, aMuxer, aNode){
	// 	console.log("domBindExtra", aDocument, aMuxer, aNode);
	// }
};

NoteFilter = {
	listeners: {
		"uninstall": new Set()
	},
	// TODO: probably should move to WebExtensions
	getPrefsO(){
		return Services.prefs.QueryInterface(Ci.nsIPrefBranch).getBranch("extensions.qnote.");
	},
	getQNoteQFState(){
		let prefs = NoteFilter.getPrefsO();
		if(prefs.prefHasUserValue("qfValue")){
			return prefs.getBoolPref("qfValue");
		} else {
			return false;
		}
	},
	saveQNoteQFState(state){
		return NoteFilter.getPrefsO().setBoolPref("qfValue", state);
	},
	getQF(aFolderDisplay){
		if(!aFolderDisplay){
			return null;
		}

		let tab = aFolderDisplay._tabInfo;

		return "quickFilter" in tab._ext ? tab._ext.quickFilter : null;
	},
	removeListener(name, listener){
		NoteFilter.listeners[name].delete(listener);
	},
	addListener(name, listener){
		NoteFilter.listeners[name].add(listener);
	},
	updateSearch: aMuxer => {
		aMuxer.deferredUpdateSearch();
	},
	attachToWindow: w => {
		console.debug("NoteFilter.attachToWindow()");
		if(!w.document.getElementById(qfQnoteCheckedId)){
			let button = w.document.createXULElement('toolbarbutton');
			button.setAttribute('id',qfQnoteCheckedId);
			button.setAttribute('type','checkbox');
			button.setAttribute('class','toolbarbuton-1');
			button.setAttribute('label', 'QNote');

			let filterBar = w.document.getElementById("quick-filter-bar-filter-text-bar");
			let senderButton = w.document.getElementById("qfb-qs-sender");
			filterBar.insertBefore(button, senderButton);
		}

		let qfQnoteChecked = w.document.getElementById(qfQnoteCheckedId);
		let qfTextBox = w.document.getElementById('qfb-qs-textbox');
		let aMuxer = w.QuickFilterBarMuxer;

		let buttonHandler = function() {
			let qfQnoteChecked = w.document.getElementById(qfQnoteCheckedId);
			let qfTextBox = w.document.getElementById('qfb-qs-textbox');
			//console.log("buttonHandler", qfQnoteChecked.checked, qfTextBox.value);
			aMuxer.activeFilterer.setFilterValue('qnote', qfQnoteChecked.checked ? qfTextBox.value : null);
			NoteFilter.updateSearch(aMuxer);
		};

		let textHandler = function() {
			let qfQnoteChecked = w.document.getElementById(qfQnoteCheckedId);
			let qfTextBox = w.document.getElementById('qfb-qs-textbox');
			aMuxer.activeFilterer.setFilterValue('qnote', qfQnoteChecked.checked ? qfTextBox.value : null);
			// if(qfQnoteChecked.checked){
			// 	console.log("textHandler", qfQnoteChecked.checked, qfTextBox.value);
			// 	aMuxer.activeFilterer.setFilterValue('qnote', qfTextBox.value);
			// }
		}

		qfTextBox.addEventListener("command", textHandler);
		qfQnoteChecked.addEventListener("command", buttonHandler);

		NoteFilter.addListener("uninstall", () => {
			let filterer = NoteFilter.getQF(w.gFolderDisplay);
			if(filterer){
				// Should manage state persistence ourselves
				NoteFilter.saveQNoteQFState(qfQnoteChecked.checked);
				// We need to remove state because QF gets mad if we disable, for example, search and then leave state as is
				filterer.setFilterValue('qnote', null);
				console.log("unset filter", filterer, qfQnoteChecked.checked);
			}

			qfTextBox.removeEventListener("command", textHandler);
			qfQnoteChecked.removeEventListener("command", buttonHandler);
			qfQnoteChecked.parentNode.removeChild(qfQnoteChecked);
		});

		// NoteFilter.updateSearch(aMuxer);
		// console.log("updateSearch", aMuxer);
	},
	install: options => {
		console.debug("NoteFilter.install()");
		Services.ww.registerNotification(WindowObserver);

		NoteFilter.options = options;
		noteGrabber = options.noteGrabber;

		QuickFilterManager.defineFilter(NoteQF);

		if(MailServices.filters.getCustomTerm(CustomTerm.id)){
			//console.log("CustomTerm exists", term);
		} else {
			MailServices.filters.addCustomTerm(CustomTerm);
		}

		let w = Services.wm.getMostRecentWindow("mail:3pane");

		NoteFilter.attachToWindow(w);

		// Restore filterer state
		// let aMuxer = w.QuickFilterBarMuxer;
		// let filterer = aMuxer.maybeActiveFilterer;
		// console.log("filterer", aMuxer, filterer);
		// if(filterer){
		// 	if(NoteFilter.getQNoteQFState()){
		// 		let textFilter = filterer.getFilterValue("text");
		// 		if(textFilter.text){
		// 			console.log("restore filter", filterer, textFilter);
		// 			textFilter.setFilterValue('qnote', textFilter.text);
		// 		}
		// 	}
		// }

		// let aMuxer = w.QuickFilterBarMuxer;
		// let filterer = NoteFilter.getQF(w.gFolderDisplay);
		// if(filterer){
		// 	if(NoteFilter.getQNoteQFState()){
		// 		let textFilter = filterer.getFilterValue("text");
		// 		if(textFilter.text){
		// 			console.log("restore filter", filterer, textFilter);
		// 			aMuxer.setFilterValue('qnote', textFilter.text);
		// 		}
		// 	}
		// }

		//var terms = MailServices.filters.getCustomTerms();
		//var a = terms.QueryInterface(Ci.nsIMutableArray);
		//console.log("terms", terms, a);
		// while (terms.hasMoreElements()) {
		// 	var f = terms.getNext().QueryInterface(Ci.nsIMsgSearchCustomTerm);
		// 	console.log("term", f);
		// }

		// MessageTextFilter.defineTextFilter({
		// 	name: "qnote",
		// 	domId: "qfb-qs-qnote-text",
		// 	attrib: Ci.nsMsgSearchAttrib.Custom,
		// 	//attrib: Ci.nsMsgSearchAttrib.Subject,
		// 	defaultState: false,
		// 	customId: customTerm.id
		// 	// ,
		// 	// appendTerms: function(aTermCreator, aTerms, aFilterValue) {
		// 	// 	console.log("appendTerms TXT");
		// 	// 	// let text=w.document.getElementById('qfb-qs-textbox').value;
		// 	// 	// // console.log(aTermCreator, aTerms, aFilterValue, text);
		// 	// 	// if (text) {
		// 	// 	// 	searchTerm(text, aTermCreator, aTerms);
		// 	// 	// }
		// 	// },
		// 	// onCommand: function(aState, aNode, aEvent, aDocument){
		// 	// 	console.log("onCommand", aState, aNode, aEvent, aDocument);
		// 	// 	return [aState, false];
		// 	// }
		// });
	},
	uninstall: () => {
		console.debug("NoteFilter.uninstall()");
		for (let listener of NoteFilter.listeners["uninstall"]) {
			listener();
		}
		QuickFilterManager.killFilter("qnote");
		Services.ww.unregisterNotification(WindowObserver);
		// MailServices.filters.addCustomTerm({
		// 	id: CustomTerm.id,
		// 	getEnabled: function(scope, op) {
		// 		return false;
		// 		//return ops.includes(op);
		// 	},
		// 	// Currently disabled in search dialogs, because can't figure out how to add text box to the filter
		// 	// Probably through XUL or something
		// 	getAvailable: function(scope, op) {
		// 		return false;
		// 		//return ops.includes(op);
		// 	},
		// 	getAvailableOperators: function(scope, length) {
		// 		if(length){
		// 			length.value = 0;
		// 		}
		// 		return [];
		// 	},
		// 	match: function(msgHdr, searchValue, searchOp) {
		// 		console.log("match from disabled");
		// 		return false;
		// 	}
		// });
	}
}
}
