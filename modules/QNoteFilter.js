var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
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
			button.setAttribute('class', 'toolbarbutton-1');
			button.setAttribute('orient', 'horizontal');
			button.setAttribute('label', 'QNote');
			// button.setAttribute('value', 'QNote');
			// if(!QNoteFilter.options.API.getStorageFolder()){
			// 	button.setAttribute("disabled", true);
			// 	button.setAttribute('checked', false);
			// } else {
			// 	button.setAttribute("disabled", false);
				if(state){
					button.setAttribute('checked', true);
				}
			// }

			let filterBar = w.document.getElementById("quick-filter-bar-filter-text-bar");
			filterBar.appendChild(button);
		}

		let qfQnoteEl = w.document.getElementById(this.qfQnoteDomId);
		let qfTextBox = w.document.getElementById('qfb-qs-textbox');
		let aMuxer = w.QuickFilterBarMuxer;

		let commandHandler = e => {
			// console.log("commandHandler", QNoteFilter.options.API.getStorageFolder(), e);
			if(!QNoteFilter.options.API.getStorageFolder()){
				qfQnoteEl.setAttribute("disabled", true);
				qfQnoteEl.setAttribute("checked", false);
				qfQnoteEl.setAttribute("tooltiptext", "Filtering currently available only with Folder storage option");
				aMuxer.activeFilterer.setFilterValue("qnote", null);
			} else {
				qfQnoteEl.setAttribute("disabled", false);
				qfQnoteEl.setAttribute("tooltiptext", "");
				aMuxer.activeFilterer.setFilterValue("qnote", qfQnoteEl.checked ? qfTextBox.value : null);
			}
			QNoteFilter.updateSearch(aMuxer);
		};

		qfTextBox.addEventListener("command", commandHandler);
		qfQnoteEl.addEventListener("command", commandHandler);
		qfTextBox.inputField.addEventListener("focus", commandHandler);

		this.addListener("uninstall", () => {
			let filterer = QNoteFilter.getQF(w.gFolderDisplay);
			if(filterer){
				// Should manage state persistence ourselves
				QNoteFilter.saveQNoteQFState(qfQnoteEl.checked);
				// We need to remove state because QF gets mad if we disable, for example, search and then leave state as is
				filterer.setFilterValue("qnote", null);
			}

			qfTextBox.removeEventListener("command", commandHandler);
			qfQnoteEl.removeEventListener("command", commandHandler);
			qfQnoteEl.parentNode.removeChild(qfQnoteEl);
		});
	}

	searchDialogHandler(aSubject, document){
		const API = this.options.API;
		const applyInputs = box => {
			if(!box.attributes || !box.attributes.searchAttribute || (box.attributes.searchAttribute.value !== "qnote@dqdp.net#qnoteText")){
				return;
			}

			// if(box.tagName != "hbox"){
			// 	console.log("got replaced");
			// 	if(box.value){
			// 		box.setAttribute("value", box.value);
			// 		box.childList[0].setAttribute("value", box.value);
			// 	}
			// 	return;
			// }

			if(!API.getStorageFolder()){
				let textbox = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
				textbox.textContent = "Filtering currently available only with Folder storage option";
				textbox.style.display = "inline";

				// If warning message exists, replace it
				if(box.children.length){
					box.replace(textbox, box.children[0]);
				} else {
					box.appendChild(textbox);
				}
				return;
			} else {
				// Remove text node in case storage option has changed
				if(box.children.length && (box.children[0].attributes.searchAttribute != box.attributes.searchAttribute)){
					box.removeChild(box.children[0]);
				}
			}

			// If input exists
			if(box.children.length){
				return;
			}

			// NOTE: please contact me if you know more clear way to attach text field to search/filter dialogs

			// console.log(box.getAttribute("disabled"), box.getAttribute("value"), box.attributes.searchAttribute, box.attributes.searchAttribute.value === "qnote@dqdp.net#qnoteText", box);
			// let textbox = aSubject.MozXULElement.parseXULToFragment(`<html:input class="input-inline search-value-input" inherits="disabled" />`);
			let textbox = document.createElementNS("http://www.w3.org/1999/xhtml", "input");
			// let textbox = document.createElement("input");
			// let textbox = document.createXULElement("marrtins");
			// let textbox = new TestEl();
			textbox.classList.add("input-inline");
			textbox.classList.add("search-value-textbox");
			textbox.classList.add("search-value-input");
			textbox.setAttribute("inherits", "disabled");
			textbox.setAttribute("value", box.getAttribute("value"));
			textbox.setAttribute("replaced", true);
			textbox.attributes.searchAttribute = box.attributes.searchAttribute;
			// textbox.setAttribute("value", "dada");
			textbox.setAttribute("flex", 1);
			textbox.style.setProperty("width", "100%", "important")
			// textbox.style.display = "flex";
			// textbox.setAttribute("type", "text");
			// textbox.setAttribute("label", "test");

			textbox.addEventListener("input", function(){
				// console.log("set value", this.value);
				textbox.setAttribute("value", this.value);
				// textbox.parentNode.setAttribute("value", this.value);
				box.setAttribute("value", this.value);
				// box.value = this.value
				// box.parentNode.setAttribute("value", this.value);
			});

			// box.classList.add("search-value-textbox");
			// box.classList.add("input-container");
			// box.classList.remove("search-value-custom");
			// textbox.setAttribute("flex", 1);
			// textbox.style.display = "flex";

			box.setAttribute("flex", 1);
			box.style.display = "flex";
			// box.style.width = "100%";
			box.style.setProperty("width", "100%", "important")
			// box.classList.add("text-input");

			box.appendChild(textbox);
			// aSubject.updateSearchAttributes();
			// if(box.parentNode){
			// 	box.parentNode.replaceChild(textbox, box);
			// }
		};

		const callbackCustomSearchCondition = mutationList => {
			mutationList.forEach(mutation => {
				if(mutation.type == "childList"){
					mutation.addedNodes.forEach(el => {
						let boxes;
						if(!el.querySelectorAll || !((boxes = el.querySelectorAll(".search-value-custom")).length)){
							return;
						}

						// console.log("mutation.addedNodes");
						boxes.forEach(applyInputs);
					});
				} else if(mutation.type == "attributes"){
					let box = mutation.target;
					if(!box.attributes || !box.attributes.searchAttribute || (box.attributes.searchAttribute.value !== "qnote@dqdp.net#qnoteText")){
						return;
					}
					// console.log("mutation=", mutation.attributeName, mutation);

					if(mutation.attributeName == "searchAttribute"){
						if(mutation.oldValue != box.attributes.searchAttribute){
							// console.log("mutation.attributeName=searchAttribute", box.getAttribute("value"), box.value);
							applyInputs(box);
						}
					}
					// if(mutation.attributeName == "value"){
					// 	console.log("mutation.attributeName=value", box.getAttribute("value"), box.value);
					// }
					// if(mutation.attributeName == "value"){
					// 	console.log("mutation.attributeName=value", el.getAttribute("value"), el.value);
					// 	// if(!el.querySelectorAll || !((boxes = el.querySelectorAll(".search-value-custom")).length)){
					// 	// 	return;
					// 	// }

					// 	// applyInputs(mutation.target);
					// }
				}
			});
		}

		document.querySelectorAll(".search-value-custom").forEach(applyInputs);

		const observer = new aSubject.MutationObserver(callbackCustomSearchCondition);

		observer.observe(document.querySelector("#searchTermList"), {
			childList: true,
			attributes: true,
			subtree: true,
			attributeOldValue: true
			// attributeFilter: ["searchAttribute"]
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


		if(MailServices.filters.getCustomTerm(this.CustomTermId)){
		} else {
			MailServices.filters.addCustomTerm(new QCustomTerm({
				API: QNoteFilter.options.API
			}));
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
