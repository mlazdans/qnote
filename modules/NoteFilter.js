var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var { QuickFilterManager, MessageTextFilter } = ChromeUtils.import("resource:///modules/QuickFilterManager.jsm");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var { CustomTerm } = ChromeUtils.import(extension.rootURI.resolve("modules/CustomTerm.js"));

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

let CustomTermId = 'qnote@dqdp.net#qnoteText';
let qfQnoteDomId = 'qfb-qs-qnote';

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

let NoteQF = {
	name: "qnote",
	domId: qfQnoteDomId,
	reflectInDOM: function(aDomNode, aFilterValue, aDocument, aMuxer){
		let state = NoteFilter.getQNoteQFState();
		let textFilter = aMuxer.getFilterValueForMutation("text");
		if(state){
			aMuxer.setFilterValue("qnote", textFilter.text);
		}
		NoteFilter.updateSearch(aMuxer);
	},
	appendTerms: function(aTermCreator, aTerms, aFilterValue) {
		// Let us borrow an existing code just for a while :>
		var phrases = MessageTextFilter._parseSearchString(aFilterValue.toLowerCase());
		var firstClause = true;
		var l = phrases.length;

		// for (let kw of phrases) {
		for (let i = 0; i < l; i++) {
			let kw = phrases[i];
			let term = aTermCreator.createTerm();
			var value = term.value;
			// value.attrib = Ci.nsMsgSearchAttrib.Subject;
			value.attrib = Ci.nsMsgSearchAttrib.Custom;
			value.str = kw;


			term.attrib = Ci.nsMsgSearchAttrib.Custom;
			term.customId = CustomTermId;
			term.op = Ci.nsMsgSearchOp.Contains;
			term.booleanAnd = !firstClause; // We need OR-ed with other QuickFilters and AND-ed with phrases
			term.beginsGrouping = firstClause;
			term.value = value;

			if (i + 1 == l) {
				term.endsGrouping = true;
			}

			aTerms.push(term);

			firstClause = false;
		}
	}
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
		let state = NoteFilter.getQNoteQFState();

		if(!w.document.getElementById(qfQnoteDomId)){
			let button = w.document.createXULElement('toolbarbutton');
			button.setAttribute('id', qfQnoteDomId);
			button.setAttribute('type', 'checkbox');
			button.setAttribute('class', 'toolbarbutton-1 qfb-tag-button');
			button.setAttribute('label', 'QNote');
			// button.setAttribute('value', 'QNote');
			if(state){
				button.setAttribute('checked', "true");
			}
			// button.setAttribute("label", tag.tag);
			// button.setAttribute("value", tag.key);

			let filterBar = w.document.getElementById("quick-filter-bar-filter-text-bar");
			// let filterBar = w.document.getElementById("quick-filter-bar-tab-bar");
			// let senderButton = w.document.getElementById("qfb-qs-sender");
			// filterBar.insertBefore(button, senderButton);
			filterBar.appendChild(button);
		}

		let qfQnoteEl = w.document.getElementById(qfQnoteDomId);
		let qfTextBox = w.document.getElementById('qfb-qs-textbox');
		let aMuxer = w.QuickFilterBarMuxer;

		let commandHandler = function() {
			aMuxer.activeFilterer.setFilterValue('qnote', qfQnoteEl.checked ? qfTextBox.value : null);
			NoteFilter.updateSearch(aMuxer);
		};

		qfTextBox.addEventListener("command", commandHandler);
		qfQnoteEl.addEventListener("command", commandHandler);

		NoteFilter.addListener("uninstall", () => {
			let filterer = NoteFilter.getQF(w.gFolderDisplay);
			if(filterer){
				// Should manage state persistence ourselves
				NoteFilter.saveQNoteQFState(qfQnoteEl.checked);
				// We need to remove state because QF gets mad if we disable, for example, search and then leave state as is
				filterer.setFilterValue('qnote', null);
				// console.log("unset filter", filterer, qfQnoteEl.checked);
			}

			qfTextBox.removeEventListener("command", commandHandler);
			qfQnoteEl.removeEventListener("command", commandHandler);
			qfQnoteEl.parentNode.removeChild(qfQnoteEl);
		});

		// NoteFilter.updateSearch(aMuxer);
		// console.log("updateSearch", aMuxer);
	},
	install: options => {
		// console.debug("NoteFilter.install()");
		Services.ww.registerNotification(WindowObserver);

		NoteFilter.options = options;

		var CustomTermOptions = {
			id: CustomTermId,
			name: 'QNote',
			needsBody: false,
			notesRoot: options.notesRoot
		};

		if(MailServices.filters.getCustomTerm(CustomTermId)){
			// console.log("CustomTerm exists");
		} else {
			MailServices.filters.addCustomTerm(new CustomTerm(CustomTermOptions));
		}

		QuickFilterManager.defineFilter(NoteQF);
		// MessageTextFilter.defineTextFilter(NoteQF);

		// let w = Services.wm.getMostRecentWindow("mail:3pane");

		NoteFilter.attachToWindow(options.w);

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

		// var terms = MailServices.filters.getCustomTerms();
		// // var a = terms.QueryInterface(Ci.nsIMutableArray);
		// console.log("terms", terms);
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
