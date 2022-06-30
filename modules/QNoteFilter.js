var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var { QuickFilterManager, MessageTextFilter } = ChromeUtils.import("resource:///modules/QuickFilterManager.jsm");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
// var { QCustomTerm } = ChromeUtils.import(extension.rootURI.resolve("modules/QCustomTerm.js"));
var { QCustomTerm } = ChromeUtils.import("resource://qnote/modules/QCustomTerm.js");

var EXPORTED_SYMBOLS = ["QNoteFilter"];

/*

Current problems:
1) match() does not expect promises
2) we can addCustomTerm() but can not remove it

*/

var QNoteFilter;

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

				// let filterer = QNoteFilter.getQF(aSubject.gFolderDisplay);
				// console.log("Attach to win", filterer);
				let tabmail = document.getElementById('tabmail');
				if(tabmail){
					QNoteFilter.attachToWindow(aSubject);
				}
			});
		}
	}
}

let NoteQF = {
	name: "qnote",
	domId: qfQnoteDomId,
	reflectInDOM: function(aDomNode, aFilterValue, aDocument, aMuxer){
		let state = QNoteFilter.getQNoteQFState();
		let textFilter = aMuxer.getFilterValueForMutation("text");
		if(state){
			aMuxer.setFilterValue("qnote", textFilter.text);
		}
		QNoteFilter.updateSearch(aMuxer);
	},
	// https://stackoverflow.com/a/6969486/10973173
	escapeRegExp(string) {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
	},
	appendTerms: function(aTermCreator, aTerms, aFilterValue) {
		// Let us borrow an existing code just for a while :>
		let filterValue = this.escapeRegExp(aFilterValue).toLowerCase();
		var phrases = MessageTextFilter._parseSearchString(filterValue);
		var firstClause = true;
		var l = phrases.length;

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

QNoteFilter = {
	listeners: {
		"uninstall": new Set()
	},
	// TODO: probably should move to WebExtensions
	getPrefsO(){
		return Services.prefs.QueryInterface(Ci.nsIPrefBranch).getBranch("extensions.qnote.");
	},
	getQNoteQFState(){
		let prefs = QNoteFilter.getPrefsO();
		if(prefs.prefHasUserValue("qfValue")){
			return prefs.getBoolPref("qfValue");
		} else {
			return false;
		}
	},
	saveQNoteQFState(state){
		return QNoteFilter.getPrefsO().setBoolPref("qfValue", state);
	},
	getQF(aFolderDisplay){
		if(!aFolderDisplay){
			return null;
		}

		let tab = aFolderDisplay._tabInfo;

		return "quickFilter" in tab._ext ? tab._ext.quickFilter : null;
	},
	removeListener(name, listener){
		QNoteFilter.listeners[name].delete(listener);
	},
	addListener(name, listener){
		QNoteFilter.listeners[name].add(listener);
	},
	updateSearch: aMuxer => {
		aMuxer.deferredUpdateSearch();
	},
	attachToWindow: w => {
		let state = QNoteFilter.getQNoteQFState();

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

			let filterBar = w.document.getElementById("quick-filter-bar-filter-text-bar");
			filterBar.appendChild(button);
		}

		let qfQnoteEl = w.document.getElementById(qfQnoteDomId);
		let qfTextBox = w.document.getElementById('qfb-qs-textbox');
		let aMuxer = w.QuickFilterBarMuxer;

		let commandHandler = function() {
			aMuxer.activeFilterer.setFilterValue('qnote', qfQnoteEl.checked ? qfTextBox.value : null);
			QNoteFilter.updateSearch(aMuxer);
		};

		qfTextBox.addEventListener("command", commandHandler);
		qfQnoteEl.addEventListener("command", commandHandler);

		QNoteFilter.addListener("uninstall", () => {
			let filterer = QNoteFilter.getQF(w.gFolderDisplay);
			if(filterer){
				// Should manage state persistence ourselves
				QNoteFilter.saveQNoteQFState(qfQnoteEl.checked);
				// We need to remove state because QF gets mad if we disable, for example, search and then leave state as is
				filterer.setFilterValue('qnote', null);
			}

			qfTextBox.removeEventListener("command", commandHandler);
			qfQnoteEl.removeEventListener("command", commandHandler);
			qfQnoteEl.parentNode.removeChild(qfQnoteEl);
		});
	},
	install: options => {
		Services.ww.registerNotification(WindowObserver);

		QNoteFilter.options = options;

		var CustomTermOptions = {
			id: CustomTermId,
			name: 'QNote',
			needsBody: false,
			notesRoot: options.notesRoot
		};

		if(MailServices.filters.getCustomTerm(CustomTermId)){
			// console.log("CustomTerm exists");
		} else {
			MailServices.filters.addCustomTerm(new QCustomTerm(CustomTermOptions));
		}

		QuickFilterManager.defineFilter(NoteQF);

		QNoteFilter.attachToWindow(options.w);
	},
	uninstall: () => {
		for (let listener of QNoteFilter.listeners["uninstall"]) {
			listener();
		}
		QuickFilterManager.killFilter("qnote");
		Services.ww.unregisterNotification(WindowObserver);
	}
}
}
