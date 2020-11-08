var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { QuickFilterManager, MessageTextFilter, QuickFilterSearchListener } = ChromeUtils.import("resource:///modules/QuickFilterManager.jsm");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");

var EXPORTED_SYMBOLS = ["NoteFilter"];

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

				let tabmail = document.getElementById('tabmail');
				if(tabmail){
					NoteFilter.attachToWindow(aSubject);
				}
			});
		}

		if(aTopic === 'domwindowclosed'){
			// TODO: need to remove before uninstall
			//let aMuxer = aSubject.QuickFilterBarMuxer;
			//aMuxer.activeFilterer.setFilterValue('qnote', null);
		}
	}
}

// NOTE:
// We need to completely restart TB if CustomTerm code changes
// Currenlty there are no means to remove filter or there are but I'm not aware, please let me know qnote@dqdp.net
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
		let note = noteGrabber.getNote(msgHdr.messageId);

		return note && note.exists && (note.text.toLowerCase().search(searchValue)>=0);
	}
};

let QuickFilter = {
	name: "qnote",
	domId: qfQnoteCheckedId,
	// propagateState: function(aTemplState, aSticky){
	// 	console.log("propagateState", aTemplState, aSticky);
	// },
	postFilterProcess: function(aState, aViewWrapper, aFiltering){
		//console.log("postFilterProcess", aState, aViewWrapper, aFiltering);
		return [aState, false, false];
	},
	// onCommand: function(aState, aNode, aEvent, aDocument){
	// 	console.log("onCommand", aState, aNode, aEvent, aDocument);
	// 	let qfTextBox = aDocument.getElementById('qfb-qs-textbox');
	// 	let qfQnoteChecked = aDocument.getElementById(qfQnoteCheckedId);
	// 	return [qfQnoteChecked.checked ? qfTextBox.value : null, true];
	// },
	reflectInDOM: function(aDomNode, aFilterValue, aDocument, aMuxer){
		if(aMuxer.activeFilterer.getFilterValue('qnote')){
			aDomNode.checked = true;
		} else {
			aDomNode.checked = false;
		}
		//aDomNode.checked = !!aFilterValue;
		//console.log("reflectInDOM", aFilterValue, aDomNode.checked, aDomNode, aDocument, aMuxer);
		NoteFilter.updateSearch(aMuxer);
	},
	appendTerms: function(aTermCreator, aTerms, aFilterValue) {
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
		if(!w.document.getElementById(qfQnoteCheckedId)){
			//console.log("attachToWindow");
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
			qfTextBox.removeEventListener("command", textHandler);
			qfQnoteChecked.removeEventListener("command", buttonHandler);
			qfQnoteChecked.parentNode.removeChild(qfQnoteChecked);
		});

		NoteFilter.updateSearch(aMuxer);
	},
	install: options => {
		Services.ww.registerNotification(WindowObserver);

		NoteFilter.options = options;
		noteGrabber = options.noteGrabber;

		QuickFilterManager.defineFilter(QuickFilter);

		if(MailServices.filters.getCustomTerm(CustomTerm.id)){
			//console.log("CustomTerm exists");
		} else {
			MailServices.filters.addCustomTerm(CustomTerm);
		}

		NoteFilter.attachToWindow(Services.wm.getMostRecentWindow("mail:3pane"));

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
		for (let listener of NoteFilter.listeners["uninstall"]) {
			listener();
		}
		QuickFilterManager.killFilter("qnote");
		Services.ww.unregisterNotification(WindowObserver);
	}
}

}
