var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { QuickFilterManager, MessageTextFilter, QuickFilterSearchListener } = ChromeUtils.import("resource:///modules/QuickFilterManager.jsm");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");
//var { IDBViewWrapperListener } = ChromeUtils.import("resource:///modules/DBViewWrapper.jsm");

var EXPORTED_SYMBOLS = ["NoteFilter"];

var NoteFilter = {};

{
let noteGrabber;
let qfQnoteCheckedId = 'qfb-qs-qnote-checked';
let qnoteCustomTermId = 'qnote@dqdp.net#qnoteText';
let ops = [Ci.nsMsgSearchOp.Contains, Ci.nsMsgSearchOp.DoesntContain, Ci.nsMsgSearchOp.Is, Ci.nsMsgSearchOp.Isnt];

let installQF = function(w){
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
		//console.log("buttonHandler", qfTextBox.value);
		aMuxer.activeFilterer.setFilterValue('qnote', qfQnoteChecked.checked ? qfTextBox.value : null);
		aMuxer.deferredUpdateSearch();
	};

	let textHandler = function() {
		if(qfQnoteChecked.checked){
			//console.log("textHandler", qfTextBox.value);
			aMuxer.activeFilterer.setFilterValue('qnote', qfTextBox.value);
		}
	}

	qfTextBox.addEventListener("command", textHandler);
	qfQnoteChecked.addEventListener("command", buttonHandler);

}

let Observer = {
	observe: function(aSubject, aTopic) {
		//console.log("observe fn", aTopic);
		if(aTopic === 'domwindowopened'){
			aSubject.addEventListener("DOMContentLoaded", e => {
				let document = e.target;

				if(document.URL !== 'chrome://messenger/content/messenger.xul' &&
					document.URL !== 'chrome://messenger/content/messenger.xhtml'
				) {
					return;
				}
				installQF(aSubject);
			});
		}
	}
}

NoteFilter.install = options => {
	//Services.obs.addObserver(Observer, "mail-startup-done", false);
	Services.ww.registerNotification(Observer);

	NoteFilter.options = options;
	noteGrabber = options.noteGrabber;

	let w = Services.wm.getMostRecentWindow("mail:3pane");
	let aMuxer = w.QuickFilterBarMuxer;

	// var l = new IDBViewWrapperListener();
	// l.onSearching = function(){
	// 	console.log("onSearch", arguments);
	// }

	// w.FolderDisplayListenerManager.registerListener(l);
	// console.log("FolderDisplayListenerManager", w.FolderDisplayListenerManager, l);

	installQF(w);

	QuickFilterManager.defineFilter({
		name: "qnote",
		domId: qfQnoteCheckedId,
		// propagateState: function(aTemplState, aSticky){
		// 	console.log("propagateState", aTemplState, aSticky);
		// },
		postFilterProcess: function(aState, aViewWrapper, aFiltering){
			//console.log("postFilterProcess", aState, aViewWrapper, aFiltering);
			return [aState, false, false];
		},
		onCommand: function(aState, aNode, aEvent, aDocument){
			//console.log("onCommand", aState, aNode, aEvent, aDocument);
			let qfTextBox = aDocument.getElementById('qfb-qs-textbox');
			let qfQnoteChecked = aDocument.getElementById(qfQnoteCheckedId);
			return [qfQnoteChecked.checked ? qfTextBox.value : null, true];
		},
		reflectInDOM: function(aDomNode, aFilterValue, aDoc, aMuxer){
			aDomNode.checked = !!aFilterValue;
			//console.log("reflectInDOM", aDomNode.checked, aDomNode, aFilterValue, aDoc, aMuxer);
		},
		appendTerms: function(aTermCreator, aTerms, aFilterValue) {
			//console.log("aFilterValue", aFilterValue);
			// Let us borrow an existing code just for a while :>
			let phrases = MessageTextFilter._parseSearchString(aFilterValue.toLowerCase());
			let term;
			let firstClause = true;
			//console.log("appendTerms", aFilterValue, phrases);

			for (let kw of phrases) {
				term = aTermCreator.createTerm();

				let value = term.value;
				value.str = kw;
				value.attrib = Ci.nsMsgSearchAttrib.Subject;
				term.value = value;

				term.attrib = Ci.nsMsgSearchAttrib.Custom;
				term.customId = customTerm.id;
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
	});

	// NOTE:
	// We need to completely restart TB if customTerm code changes
	// Currenlty there are no means to remove filter or there are but I'm not aware, please let me know qnote@dqdp.net
	var customTerm = {
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
			let note = noteGrabber.getNote(msgHdr.messageId);

			if(!note || !note.exists){
				return false;
			}

			let match = note.text.toLowerCase().search(searchValue)>=0;
			// console.log("match", searchValue, searchOp);
			// console.log("matched", msgHdr.messageId, note, match);

			return match;
		}
	};

	if(MailServices.filters.getCustomTerm(customTerm.id)){
		//console.log("customTerm exists");
	} else {
		MailServices.filters.addCustomTerm(customTerm);
	}

	aMuxer.deferredUpdateSearch();

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
};

NoteFilter.uninstall = () => {
	// Uninstall quick filter
	var w = Services.wm.getMostRecentWindow("mail:3pane");
	var qfQnoteChecked = w.document.getElementById(qfQnoteCheckedId);
	if(qfQnoteChecked){
		qfQnoteChecked.parentNode.removeChild(qfQnoteChecked);
	}

	QuickFilterManager.killFilter("qnote");
	Services.ww.unregisterNotification(Observer);

	// TODO: need to remove before shutdown
	//var aMuxer = gW.QuickFilterBarMuxer;
	//aMuxer.activeFilterer.setFilterValue('qnote', null);
}

}
