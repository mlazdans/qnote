var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var { QuickFilterManager, MessageTextFilter } = ChromeUtils.import("resource:///modules/QuickFilterManager.jsm");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");
var { QCustomTerm } = ChromeUtils.import("resource://qnote/modules/QCustomTerm.js");

var EXPORTED_SYMBOLS = ["QNoteFilter"];

/*

Current problems:
1) match() does not expect promises
2) we can addCustomTerm() but can not remove it

*/

class QNoteFilter {
	// TODO: probably should move to WebExtensions
	getPrefsO(){
		return this.Services.prefs.QueryInterface(Ci.nsIPrefBranch).getBranch("extensions.qnote.");
	}

	getQNoteQFState(){
		let prefs = this.getPrefsO();
		if(prefs.prefHasUserValue("qfValue")){
			return prefs.getBoolPref("qfValue");
		} else {
			return false;
		}
	}

	saveQNoteQFState(state){
		return this.getPrefsO().setBoolPref("qfValue", state);
	}

	getQF(aFolderDisplay){
		if(!aFolderDisplay){
			return null;
		}

		let tab = aFolderDisplay._tabInfo;

		return "quickFilter" in tab._ext ? tab._ext.quickFilter : null;
	}

	removeListener(name, listener){
		this.listeners[name].delete(listener);
	}

	addListener(name, listener){
		this.listeners[name].add(listener);
	}

	updateSearch(aMuxer) {
		aMuxer.deferredUpdateSearch();
	}

	attachToWindow(w) {
		let QNoteFilter = this;
		let state = this.getQNoteQFState();

		if(!w.document.getElementById(this.qfQnoteDomId)){
			let button = w.document.createXULElement('toolbarbutton');
			button.setAttribute('id', this.qfQnoteDomId);
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

		let qfQnoteEl = w.document.getElementById(this.qfQnoteDomId);
		let qfTextBox = w.document.getElementById('qfb-qs-textbox');
		let aMuxer = w.QuickFilterBarMuxer;

		let commandHandler = function() {
			aMuxer.activeFilterer.setFilterValue('qnote', qfQnoteEl.checked ? qfTextBox.value : null);
			QNoteFilter.updateSearch(aMuxer);
		};

		qfTextBox.addEventListener("command", commandHandler);
		qfQnoteEl.addEventListener("command", commandHandler);

		this.addListener("uninstall", () => {
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
	}

	searchDialogHandler(aSubject, document){
		function callbackCustomSearchCondition(mutationList) {
			mutationList.forEach(mutation => {
				if(mutation.type == "childList"){
					mutation.addedNodes.forEach(el => {
						let boxes;
						if(el.querySelectorAll && ((boxes = el.querySelectorAll(".search-value-custom")).length > 0)){
							let textbox = document.createElementNS("http://www.w3.org/1999/xhtml", "input");
							textbox.classList.add("input-inline");
							textbox.classList.add("search-value-textbox");
							textbox.setAttribute("value", boxes[0].getAttribute("value"));
							textbox.addEventListener("input", function(){
								textbox.parentNode.setAttribute("value", this.value);
							});

							boxes[0].appendChild(textbox);
						}
					});
				}
			});
		}

		const observer = new aSubject.MutationObserver(callbackCustomSearchCondition);

		observer.observe(document.querySelector("#searchTermList"), {
			childList: true,
			attributes: true,
			subtree: true
		});

		this.addListener("uninstall", () => {
			observer.disconnect();
		});
	}

	constructor(options) {
		this.CustomTermId = 'qnote@dqdp.net#qnoteText';
		this.qfQnoteDomId = 'qfb-qs-qnote';
		this.listeners = {
			"uninstall": new Set()
		};
		this.Services = Services;
		this.QuickFilterManager = QuickFilterManager;
		let QNoteFilter = this;

		this.options = options;

		var CustomTermOptions = {
			id: this.CustomTermId,
			name: 'QNote',
			needsBody: false,
			notesRoot: options.notesRoot
		};

		if(MailServices.filters.getCustomTerm(this.CustomTermId)){
			// console.log("CustomTerm exists");
		} else {
			MailServices.filters.addCustomTerm(new QCustomTerm(CustomTermOptions));
		}

		let NoteQF = {
			name: "qnote",
			domId: this.qfQnoteDomId,
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
					term.customId = QNoteFilter.CustomTermId;
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

		this.QuickFilterManager.defineFilter(NoteQF);

		this.attachToWindow(options.w);
	}

	uninstall() {
		for (let listener of this.listeners["uninstall"]) {
			listener();
		}
		this.QuickFilterManager.killFilter("qnote");
	}
}
