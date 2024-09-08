// var { QuickFilterManager, MessageTextFilter } = ChromeUtils.import("resource:///modules/QuickFilterManager.jsm");
import { INoteData } from "../modules/Note.mjs";
import { QCache } from "../modules/QCache.mjs";

var { QEventDispatcher } = ChromeUtils.importESModule("resource://qnote/modules/QEventDispatcher.mjs");
var { QNoteFile } = ChromeUtils.importESModule("resource://qnote/modules-exp/QNoteFile.mjs");
var { XNoteFile } = ChromeUtils.importESModule("resource://qnote/modules-exp/XNoteFile.mjs");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var { ThreadPaneColumns } = ChromeUtils.importESModule("chrome://messenger/content/ThreadPaneColumns.mjs");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

class QFiltersEventDispatcher extends QEventDispatcher<{
	uninstall: () => void,
}> {}

// Current problems:
// 1) match() does not expect promises
// 2) we can addCustomTerm() but can not remove it
export class QNoteFilter
{
	storageFolder: string | undefined // TODO: sync after prefs change
	ed
	// qfQnoteDomId = 'qfb-qs-qnote'
	// QuickFilterManager: any;

	constructor(storageFolder?: string) {
		this.storageFolder = storageFolder;
		this.ed = new QFiltersEventDispatcher();
		// this.Services = globalThis.Services || ChromeUtils.import("resource://gre/modules/Services.jsm").Services;
		// this.QuickFilterManager = QuickFilterManager;

		// let NoteQF = {
		// 	name: "qnote",
		// 	domId: this.qfQnoteDomId,
		// 	// https://stackoverflow.com/a/6969486/10973173
		// 	escapeRegExp(s: string) {
		// 		return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
		// 	},
		// 	appendTerms: function(aTermCreator: any, aTerms: Array<string>, aFilterValue: string) {
		// 		// Let us borrow an existing code just for a while :>
		// 		let filterValue = this.escapeRegExp(aFilterValue).toLowerCase();
		// 		var phrases = MessageTextFilter._parseSearchString(filterValue);
		// 		QDEB&&console.log("[QNoteFilter] appendTerms", phrases);
		// 		var firstClause = true;
		// 		var l = phrases.length;

		// 		for (let i = 0; i < l; i++) {
		// 			let kw = phrases[i];
		// 			let term = aTermCreator.createTerm();
		// 			var value = term.value;
		// 			// value.attrib = Ci.nsMsgSearchAttrib.Subject;
		// 			value.attrib = Ci.nsMsgSearchAttrib.Custom;
		// 			value.str = kw;


		// 			term.attrib = Ci.nsMsgSearchAttrib.Custom;
		// 			term.customId = QNoteFilter.CustomTermId;
		// 			term.op = Ci.nsMsgSearchOp.Contains;
		// 			term.booleanAnd = !firstClause; // We need OR-ed with other QuickFilters and AND-ed with phrases
		// 			term.beginsGrouping = firstClause;
		// 			term.value = value;

		// 			if (i + 1 == l) {
		// 				term.endsGrouping = true;
		// 			}

		// 			aTerms.push(term);

		// 			firstClause = false;
		// 		}
		// 	}
		// };

		// if(options.w.gTabmail){
		// 	QDEB&&console.log(`[QNoteFilter] broken on TB 115, disabling`);
		// } else {
		// 	this.QuickFilterManager.defineFilter(NoteQF);
		// }

		// this.attachToWindow(options.w);
	}

	// TODO: probably should move to WebExtensions
	// getPrefsO(){
	// 	return this.Services.prefs.QueryInterface(Ci.nsIPrefBranch).getBranch("extensions.qnote.");
	// }

	// getQNoteQFState(){
	// 	let prefs = this.getPrefsO();
	// 	if(prefs.prefHasUserValue("qfValue")){
	// 		return prefs.getBoolPref("qfValue");
	// 	} else {
	// 		return false;
	// 	}
	// }

	// saveQNoteQFState(state: boolean){
	// 	return this.getPrefsO().setBoolPref("qfValue", state);
	// }

	// getQF(aFolderDisplay: any){
	// 	if(!aFolderDisplay){
	// 		return null;
	// 	}

	// 	let tab = aFolderDisplay._tabInfo;

	// 	return "quickFilter" in tab._ext ? tab._ext.quickFilter : null;
	// }

	// removeListener(name, listener){
	// 	this.listeners[name].delete(listener);
	// }

	// addListener(name, listener){
	// 	this.listeners[name].add(listener);
	// }

	// updateSearch(aMuxer: any) {
	// 	aMuxer.deferredUpdateSearch();
	// }

	// We currently can not attach qnote dom representation to TB115 such as it persist between new window or tab
	// Bellow are some (unsuccessful) attempts.
	// Bail for now
	// attachToWindowTB115(win: any) {
	// 	let w = win.gTabmail.tabInfo.find(
	// 		t => t.mode.name == "mail3PaneTab"
	// 	).chromeBrowser.contentWindow;

	// 	let tabmail = win.document.querySelector("#mail3PaneTabTemplate");
	// 	let browser = tabmail.content.querySelector("browser");

	// 	console.log("[tabmail]", tabmail, browser);

	// 	const observer = new win.MutationObserver(function(mutations){
	// 		console.log("[observer]", mutations);
	// 	});

	// 	observer.observe(tabmail, {
	// 		childList: true,
	// 		attributes: true,
	// 		subtree: true,
	// 		attributeOldValue: true
	// 	});

	// 	// Below this point it works but only on main tab. This will destroy new window/tab.
	// 	let filterBar = w.document.querySelector("#quick-filter-bar-filter-text-bar > div.button-group");

	// 	if(!filterBar) {
	// 		return;
	// 	}

	// 	let node = w.document.getElementById(this.qfQnoteDomId);

	// 	if(node){
	// 		node.remove();
	// 	}

	// 	let state = w.quickFilterBar.getFilterValueForMutation(MessageTextFilter.name);
	// 	QDEB&&console.log(`[QNoteFilter] initital state`, state);

	// 	let holder = w.document.createElement('button');

	// 	if(state && ("qnote" in state)){
	// 		holder.pressed2 = !!state.qnote;
	// 	} else {
	// 		holder.pressed2 = true;
	// 	}
	// 	state["qnote"] = holder.pressed2;
	// 	QDEB&&console.log(`[holder.pressed]`, holder.pressed2);

	// 	holder.setAttribute("id", this.qfQnoteDomId);
	// 	holder.setAttribute("is", "toggle-button");
	// 	holder.setAttribute("aria-pressed", holder.pressed2);
	// 	holder.textContent = "QNote";
	// 	holder.classList.add("button");
	// 	holder.classList.add("check-button");
	// 	holder.addEventListener("click", () => {
	// 		holder.pressed2 = !holder.pressed2;
	// 		holder.setAttribute("aria-pressed", holder.pressed2);

	// 		let state = w.quickFilterBar.getFilterValueForMutation(MessageTextFilter.name);

	// 		state["qnote"] = holder.pressed2;

	// 		QDEB&&console.log(`[QNoteFilter] click`, state);

	// 		if(holder.pressed2){
	// 			w.quickFilterBar.setFilterValue("qnote", state.text);
	// 		} else {
	// 			w.quickFilterBar.setFilterValue("qnote", "");
	// 		}

	// 		w.quickFilterBar.updateSearch(holder);
	// 	});

	// 	let commandHandler = () => {
	// 		let state = w.quickFilterBar.getFilterValueForMutation(MessageTextFilter.name);
	// 		QDEB&&console.log(`[QNoteFilter] text`, state);
	// 		if(holder.pressed2){
	// 			w.quickFilterBar.setFilterValue("qnote", state.text);
	// 		} else {
	// 			w.quickFilterBar.setFilterValue("qnote", "");
	// 		}
	// 	};

	// 	let qfTextBox = w.document.getElementById('qfb-qs-textbox');
	// 	qfTextBox.addEventListener("command", commandHandler);

	// 	this.addListener("uninstall", () => {
	// 		qfTextBox.removeEventListener("command", commandHandler);
	// 	});

	// 	filterBar.appendChild(holder);

	// 	if(holder.pressed2){
	// 		w.quickFilterBar.setFilterValue("qnote", state.text);
	// 	} else {
	// 		w.quickFilterBar.setFilterValue("qnote", "");
	// 	}
	// }

	// attachToWindow(w: any) {
	// 	if(w.gTabmail){
	// 		return this.attachToWindowTB115(w);
	// 	}

	// 	let QNoteFilter = this;
	// 	let state = this.getQNoteQFState();

	// 	if(!w.document.getElementById(this.qfQnoteDomId)){
	// 		let filterBar = w.document.getElementById("quick-filter-bar-filter-text-bar");

	// 		if(!filterBar) {
	// 			return;
	// 		}

	// 		let button = w.document.createXULElement('toolbarbutton');
	// 		button.setAttribute('id', this.qfQnoteDomId);
	// 		button.setAttribute('type', 'checkbox');
	// 		button.setAttribute('class', 'toolbarbutton-1');
	// 		button.setAttribute('orient', 'horizontal');
	// 		button.setAttribute('label', 'QNote');
	// 		// button.setAttribute('value', 'QNote');
	// 		// if(!QNoteFilter.options.API.getStorageFolder()){
	// 		// 	button.setAttribute("disabled", true);
	// 		// 	button.setAttribute('checked', false);
	// 		// } else {
	// 		// 	button.setAttribute("disabled", false);
	// 			if(state){
	// 				button.setAttribute('checked', true);
	// 			}
	// 		// }

	// 		filterBar.appendChild(button);
	// 	}

	// 	let qfQnoteEl = w.document.getElementById(this.qfQnoteDomId);
	// 	let qfTextBox = w.document.getElementById('qfb-qs-textbox');
	// 	let aMuxer = w.QuickFilterBarMuxer;

	// 	if(!qfTextBox || !aMuxer){
	// 		console.error("Quick filter not found!");
	// 		return;
	// 	}

	// 	let oldChecked: boolean = false;
	// 	let oldValue: string = "";

	// 	let commandHandler = () => {
	// 		if(QNoteFilter.options.API.getStorageFolder()){
	// 			qfQnoteEl.setAttribute("disabled", false);
	// 			qfQnoteEl.setAttribute("tooltiptext", "");
	// 			aMuxer.activeFilterer.setFilterValue("qnote", qfQnoteEl.checked ? qfTextBox.value : null);
	// 		} else {
	// 			qfQnoteEl.setAttribute("disabled", true);
	// 			qfQnoteEl.setAttribute("checked", false);
	// 			qfQnoteEl.setAttribute("tooltiptext", extension.localizeMessage("filters.unavailable"));
	// 			aMuxer.activeFilterer.setFilterValue("qnote", null);
	// 		}

	// 		if((oldChecked !== qfQnoteEl.checked) || (oldValue !== qfTextBox.value)){
	// 			// Needed for older versions
	// 			QNoteFilter.updateSearch(aMuxer);
	// 		}

	// 		oldChecked = qfQnoteEl.checked;
	// 		oldValue = qfTextBox.value;
	// 	};

	// 	qfTextBox.addEventListener("command", commandHandler);
	// 	qfQnoteEl.addEventListener("command", commandHandler);

	// 	this.ed.addListener("uninstall", () => {
	// 		let filterer = QNoteFilter.getQF(w.gFolderDisplay);
	// 		if(filterer){
	// 			// Should manage state persistence ourselves
	// 			QNoteFilter.saveQNoteQFState(qfQnoteEl.checked);
	// 			// We need to remove state because QF gets mad if we disable, for example, search and then leave state as is
	// 			filterer.setFilterValue("qnote", null);
	// 		}

	// 		qfTextBox.removeEventListener("command", commandHandler);
	// 		qfQnoteEl.removeEventListener("command", commandHandler);
	// 		qfQnoteEl.parentNode.removeChild(qfQnoteEl);
	// 	});
	// }

	searchDialogHandler(aSubject: MozWindow, document: Document){
		const applyInputs = (box: any) => {
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

			if(!this.storageFolder){
				let textbox = document.createElementNS("http://www.w3.org/1999/xhtml", "span") as HTMLSpanElement;
				if(textbox){
					textbox.textContent = extension.localizeMessage("filters.unavailable");
					textbox.style.display = "inline";

					// If warning message exists, replace it
					if(box.children.length){
						box.replace(textbox, box.children[0]);
					} else {
						box.appendChild(textbox);
					}
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

			// NOTE: please contact me if you know more cleaner way to attach text field to search/filter dialogs

			// console.log(box.getAttribute("disabled"), box.getAttribute("value"), box.attributes.searchAttribute, box.attributes.searchAttribute.value === "qnote@dqdp.net#qnoteText", box);
			// let textbox = aSubject.MozXULElement.parseXULToFragment(`<html:input class="input-inline search-value-input" inherits="disabled" />`);
			let textbox = document.createElementNS("http://www.w3.org/1999/xhtml", "input") as HTMLInputElement;
			// let textbox = document.createElement("input");
			// let textbox = document.createXULElement("marrtins");
			// let textbox = new TestEl();
			textbox.classList.add("input-inline");
			textbox.classList.add("search-value-textbox");
			textbox.classList.add("search-value-input");
			textbox.setAttribute("inherits", "disabled");
			textbox.setAttribute("value", box.getAttribute("value") ? box.getAttribute("value") : "");
			textbox.setAttribute("replaced", "true");
			// @ts-ignore
			textbox.attributes.searchAttribute = box.attributes.searchAttribute;
			// textbox.setAttribute("value", "dada");
			textbox.setAttribute("flex", "1");
			textbox.style.setProperty("width", "100%", "important")
			// textbox.style.display = "flex";
			// textbox.setAttribute("type", "text");
			// textbox.setAttribute("label", "test");

			textbox.addEventListener("input", function(){
				let e = this as HTMLInputElement;
				// console.log("set value", this.value);
				textbox.setAttribute("value", e.value);
				// textbox.parentNode.setAttribute("value", this.value);
				box.setAttribute("value", e.value);
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

		const callbackCustomSearchCondition = (mutationList: any) => {
			mutationList.forEach((mutation: any) => {
				if(mutation.type == "childList"){
					mutation.addedNodes.forEach((el: HTMLElement) => {
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

		const elements = document.querySelector("#searchTermList");

		if(elements){
			const observer = new aSubject.MutationObserver(callbackCustomSearchCondition);

			observer.observe(elements, {
				childList: true,
				attributes: true,
				subtree: true,
				attributeOldValue: true
				// attributeFilter: ["searchAttribute"]
			});

			this.ed.addListener("uninstall", () => {
				observer.disconnect();
			});
		}
	}

	uninstall() {
		this.ed.fireListeners("uninstall");
		// this.QuickFilterManager.killFilter("qnote");
	}
}

// NOTE:
// We need completely restart TB if CustomTerm code changes
// Currenlty there are no means to remove filter or there is but I'm not aware, please let me know: qnote@dqdp.net

// TODO: try brind all calls to options.API
// TODO: scopes
export class QCustomTerm implements Ci.nsIMsgSearchCustomTerm {
	id: string
	name: string
	needsBody: boolean = false
	ops: Array<Ci.nsMsgSearchOpValue>
	QN
	XN
	storageFolder: string | undefined // TODO: sync after prefs change

	constructor(storageFolder?: string) {
		this.id = 'qnote@dqdp.net#qnoteText';
		this.name = "QNote";
		this.storageFolder = storageFolder;

		this.ops = [
			Ci.nsMsgSearchOp.Contains,
			Ci.nsMsgSearchOp.DoesntContain,
			Ci.nsMsgSearchOp.Is,
			Ci.nsMsgSearchOp.Isnt,
			Ci.nsMsgSearchOp.BeginsWith,
			Ci.nsMsgSearchOp.EndsWith
		];

		this.QN = new QNoteFile;
		this.XN = new XNoteFile;
	}

	getEnabled(scope: any, op: any) {
		return true;
	}
	getAvailable(scope: any, op: any) {
		return true;
	}
	getAvailableOperators(scope: nsMsgSearchScopeValue) {
		return this.ops;
	}
	match(msgHdr: nsIMsgDBHdr, searchValue: string, searchOp: Ci.nsMsgSearchOpValue): boolean {
		const notesRoot = this.storageFolder;

		if(!notesRoot){
			return false;
		}

		var note;
		try {
			note = this.QN.load(notesRoot, msgHdr.messageId);
			if(!note){
				note = this.XN.load(notesRoot, msgHdr.messageId);
			}
		} catch(e) {
			return false;
		}

		if(!note){
			return false;
		}

		const keyw = searchValue.toLowerCase();
		const text = note.text ? note.text.toLowerCase() : "";

		if(searchOp == Ci.nsMsgSearchOp.Contains){
			return !keyw || (text.search(keyw) >= 0);
		}

		if(searchOp == Ci.nsMsgSearchOp.DoesntContain){
			return !keyw || (text.search(keyw) == -1);
		}

		if(searchOp == Ci.nsMsgSearchOp.Is){
			return text == keyw;
		}

		if(searchOp == Ci.nsMsgSearchOp.Isnt){
			return text != keyw;
		}

		if(searchOp == Ci.nsMsgSearchOp.BeginsWith){
			return !keyw || text.startsWith(keyw);
		}

		if(searchOp == Ci.nsMsgSearchOp.EndsWith){
			return !keyw || text.toLowerCase().endsWith(keyw);
		}

		return false;
	}
}

export class QNoteAction
{
	storageFolder: string | undefined // TODO: sync after prefs change
	noteGrabber: QCache
	ruleMap: Map<string, string>

	constructor(noteGrabber: QCache, storageFolder?: string) {
		this.noteGrabber = noteGrabber;
		this.storageFolder = storageFolder;
		this.ruleMap = new Map;

		// Add
		var caAdd = new QCustomAddAction(noteGrabber, storageFolder);
		if(caAdd.install()){
			this.ruleMap.set(caAdd.id, "qnote-ruleactiontarget-add");
		}

		// Update
		var caUpdate = new QCustomUpdateAction(noteGrabber, storageFolder);
		if(caUpdate.install()){
			this.ruleMap.set(caUpdate.id, "qnote-ruleactiontarget-update");
		}

		// Delete
		let caDelete = new QCustomDeleteAction(noteGrabber, storageFolder);
		if(caDelete.install()){
			this.ruleMap.set(caDelete.id, "qnote-ruleactiontarget-delete");
		}
	}

	filterEditorHandler(aSubject: MozWindow, document: XULDocument){
		let Action = this;

		(function(){
			let wrapper = aSubject.customElements.get("ruleactiontarget-wrapper");
			let _getChildNode;

			if (!wrapper || wrapper.prototype.hasOwnProperty("_QNoteAddAction") || !(_getChildNode = wrapper.prototype._getChildNode)) {
				return;
			}

			wrapper.prototype._getChildNode = function(type: string) {
				let name = Action.ruleMap.get(type);
				if(name){
					return document.createXULElement(name);
				} else {
					return _getChildNode(type);
				}

				// return type == "qnote@dqdp.net#qnoteAdd" ?
				// 	document.createXULElement("qnote-ruleactiontarget-add") :
				// 	_getChildNode(type);
			};
			wrapper.prototype._QNoteAddAction = true;
		})();

		const updateParentNode = (parentNode: any) => {
			if (parentNode.hasAttribute("initialActionIndex")) {
				let actionIndex = parentNode.getAttribute("initialActionIndex");
				let filterAction = aSubject.gFilter.getActionAt(actionIndex);
				parentNode.initWithAction(filterAction);
			}
			parentNode.updateRemoveButton();
		};

		// TODO: should find a better way processing these classes below
		// They depend on window.MozXULElement (aSubject)
		abstract class atQNote extends aSubject.MozXULElement {
			abstract _connectedCallback(): void
			connectedCallback() {
				if(Action.storageFolder){
					if(this._connectedCallback){
						this._connectedCallback();
					}
				} else {
					let textbox = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
					textbox.textContent = extension.localizeMessage("actions.unavailable");
					textbox.style.display = "inline";
					textbox.style.padding = "1ex";
					textbox.style.verticalAlign = "middle";
					this.appendChild(textbox);
				}
				const el = this.closest(".ruleaction") as HTMLElement;
				if(el)updateParentNode(el);
			}
		}
		class actiontargetQNoteAdd extends atQNote {
			_connectedCallback() {
				const input = aSubject.document.createElementNS("http://www.w3.org/1999/xhtml", "input");
				input.classList.add("ruleactionitem", "input-inline");
				this.classList.add("input-container");
				this.classList.add("textbox-input");
				this.appendChild(input);
			}
		}
		class actiontargetQNoteUpdate extends atQNote {
			_connectedCallback() {
				const input = aSubject.document.createElementNS("http://www.w3.org/1999/xhtml", "input");
				input.classList.add("ruleactionitem", "input-inline");
				this.classList.add("input-container");
				this.classList.add("textbox-input");
				this.appendChild(input);

				const el = this.closest(".ruleaction") as HTMLElement;
				if(el)updateParentNode(el);
			}
		}
		class actiontargetQNoteDelete extends atQNote {
			_connectedCallback() {
				// Add dummy child
				const input = aSubject.document.createElementNS("http://www.w3.org/1999/xhtml", "span");
				this.appendChild(input);
				const el = this.closest(".ruleaction") as HTMLElement;
				if(el)updateParentNode(el);
			}
		}

		if(!aSubject.customElements.get("qnote@dqdp.net#qnote-action-add")){
			// @ts-ignore
			aSubject.customElements.define("qnote-ruleactiontarget-add", actiontargetQNoteAdd);
		}

		if(!aSubject.customElements.get("qnote@dqdp.net#qnote-action-update")){
			// @ts-ignore
			aSubject.customElements.define("qnote-ruleactiontarget-update", actiontargetQNoteUpdate);
		}

		if(!aSubject.customElements.get("qnote@dqdp.net#qnote-action-delete")){
			// @ts-ignore
			aSubject.customElements.define("qnote-ruleactiontarget-delete", actiontargetQNoteDelete);
		}
	}

	uninstall() {
		// for (let listener of this.listeners["uninstall"]) {
		// 	listener();
		// }
		// this.QuickFilterManager.killFilter("qnote");
	}
}

abstract class QCustomActionAbstract implements nsIMsgFilterCustomAction
{
	id: string
	name: string
	allowDuplicates = false
	isAsync = false
	needsBody = false

	storageFolder: string | undefined // TODO: sync after prefs change
	noteGrabber: QCache

	constructor(id: string, name: string, noteGrabber: QCache, storageFolder?: string) {
		this.storageFolder = storageFolder;
		this.noteGrabber = noteGrabber;
		this.id = id;
		this.name = name;
	}

	isValidForType(type: nsMsgFilterTypeType, scope: nsMsgSearchScopeValue): boolean {
		return true;
	}

	validateActionValue(actionValue: string, actionFolder: nsIMsgFolder, filterType: nsMsgFilterTypeType): string {
		if (actionValue) {
			return "";
		}

		return "QNote text required";
	}

	abstract applyAction(msgHdrs: Array<nsIMsgDBHdr>, actionValue: string, copyListener: nsIMsgCopyServiceListener, filterType: nsMsgFilterTypeType, msgWindow: nsIMsgWindow): void;

	install(): boolean {
		try {
			MailServices.filters.getCustomAction(this.id);
		} catch (e) {
			MailServices.filters.addCustomAction(this);
		}
		return true;
	}

	updateView(): void {
		ThreadPaneColumns?.refreshCustomColumn("qnote");
	}
	// applyAction(msgHdrs: Array<nsIMsgDBHdr>, actionValue: string){
	// 	this.apply(msgHdrs.map(m => {
	// 		return m.messageId;
	// 	}), actionValue);
	// }

	// abstract apply(m: nsIMsgDBHdr);

	// Compatibility with older TB
	// apply(msgHdrs, actionValue, copyListener, filterType, msgWindow){
	// 	let en = msgHdrs.enumerate();
	// 	let keyIds = [];
	// 	while (en.hasMoreElements()) {
	// 		keyIds.push((en.getNext().QueryInterface(Ci.nsIMsgDBHdr)).messageId);
	// 	};
	// 	this._apply(keyIds, actionValue);
	// }

	// _apply(msgHdrs, actionValue){
	// 	throw new Error('Must be implemented by subclass!');
	// }
};

class QCustomAddAction extends QCustomActionAbstract
{
	constructor(noteGrabber: QCache, storageFolder?: string) {
		super('qnote@dqdp.net#qnote-action-add', 'Add QNote', noteGrabber, storageFolder);
	}

	applyAction(msgHdrs: Array<nsIMsgDBHdr>, actionValue: string, copyListener: nsIMsgCopyServiceListener, filterType: nsMsgFilterTypeType, msgWindow: nsIMsgWindow): void {
		const notesRoot = this.storageFolder;

		if(!actionValue || !notesRoot){
			return;
		}

		const QN = new QNoteFile;
		const ts = Date.now();
		msgHdrs.forEach(m => {
			const keyId = m.messageId;
			const note: INoteData = {}; // TODO: test

			note.text = actionValue;
			note.ts = ts;

			if(!QN.getExistingFile(notesRoot, keyId)){
				QN.save(notesRoot, keyId, note);
				this.noteGrabber.delete(keyId);
			}
		});
		this.updateView();
	}
}

class QCustomUpdateAction extends QCustomActionAbstract
{
	constructor(noteGrabber: QCache, storageFolder?: string) {
		super('qnote@dqdp.net#qnote-action-update', 'Update QNote', noteGrabber, storageFolder);
	}

	applyAction(msgHdrs: Array<nsIMsgDBHdr>, actionValue: string, copyListener: nsIMsgCopyServiceListener, filterType: nsMsgFilterTypeType, msgWindow: nsIMsgWindow): void {
		const notesRoot = this.storageFolder;

		if(!actionValue || !notesRoot){
			return;
		}

		const QN = new QNoteFile;
		let ts = Date.now();
		msgHdrs.forEach(m => {
			const keyId = m.messageId;
			const note: INoteData = {}; // TODO: test

			note.text = actionValue;
			note.ts = ts;

			QN.save(notesRoot, keyId, note);
			this.noteGrabber.delete(keyId); // TODO: maybe update?
		});
		this.updateView();
	}
}

class QCustomDeleteAction extends QCustomActionAbstract
{
	constructor(noteGrabber: QCache, storageFolder?: string) {
		super('qnote@dqdp.net#qnote-action-delete', 'Delete QNote', noteGrabber, storageFolder);
	}

	validateActionValue() {
		return "";
	}

	applyAction(msgHdrs: Array<nsIMsgDBHdr>, actionValue: string, copyListener: nsIMsgCopyServiceListener, filterType: nsMsgFilterTypeType, msgWindow: nsIMsgWindow): void {
		const notesRoot = this.storageFolder;

		if(!notesRoot){
			return;
		}

		const QN = new QNoteFile;
		msgHdrs.forEach(m => {
			QN.delete(notesRoot, m.messageId);
			this.noteGrabber.delete(m.messageId);
		});
		this.updateView();
	}
}
