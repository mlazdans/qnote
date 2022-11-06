var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");
var { QCustomActionAdd } = ChromeUtils.import("resource://qnote/modules/QCustomActionAdd.js");
var { QCustomActionUpdate } = ChromeUtils.import("resource://qnote/modules/QCustomActionUpdate.js");

var EXPORTED_SYMBOLS = ["QNoteAction"];

class QNoteAction {
	constructor(options) {
		this.ruleMap = {};
		this.Services = Services;
		this.options = options;

		let caAdd = new QCustomActionAdd({
			name: 'Add QNote',
			notesRoot: options.notesRoot,
			API: options.API
		})

		try {
			MailServices.filters.getCustomAction(caAdd.id);
		} catch (e) {
			MailServices.filters.addCustomAction(caAdd);
		}
		this.ruleMap[caAdd.id] = caAdd.xulName;

		let caUpdate = new QCustomActionUpdate({
			name: 'Update QNote',
			notesRoot: options.notesRoot,
			API: options.API
		})

		try {
			MailServices.filters.getCustomAction(caUpdate.id);
		} catch (e) {
			MailServices.filters.addCustomAction(caUpdate);
		}
		this.ruleMap[caUpdate.id] = caUpdate.xulName;
	}

	filterEditorHandler(aSubject, document){
		let Action = this;

		(function(){
			let wrapper = aSubject.customElements.get("ruleactiontarget-wrapper");
			let _getChildNode;

			if (!wrapper || wrapper.prototype.hasOwnProperty("_QNoteAddAction") || !(_getChildNode = wrapper.prototype._getChildNode)) {
				return;
			}

			wrapper.prototype._getChildNode = function(type) {
				if(Action.ruleMap[type]){
					return document.createXULElement(Action.ruleMap[type]);
				} else {
					return _getChildNode(type);
				}

				// return type == "qnote@dqdp.net#qnoteAdd" ?
				// 	document.createXULElement("qnote-ruleactiontarget-add") :
				// 	_getChildNode(type);
			};
			wrapper.prototype._QNoteAddAction = true;
		})();

		const updateParentNode = parentNode => {
			if (parentNode.hasAttribute("initialActionIndex")) {
				let actionIndex = parentNode.getAttribute("initialActionIndex");
				let filterAction = aSubject.gFilter.getActionAt(actionIndex);
				parentNode.initWithAction(filterAction);
			}
			parentNode.updateRemoveButton();
		};

		// TODO: should find a better way processing these classes below
		// They depend on window.MozXULElement (aSubject)
		class actiontargetQNoteAdd extends aSubject.MozXULElement {
			connectedCallback() {
				const input = aSubject.document.createElementNS("http://www.w3.org/1999/xhtml", "input");
				input.classList.add("ruleactionitem", "input-inline");
				this.classList.add("input-container");
				this.classList.add("textbox-input");
				this.appendChild(input);
				updateParentNode(this.closest(".ruleaction"));
			}
		}
		class actiontargetQNoteUpdate extends aSubject.MozXULElement {
			connectedCallback() {
				const input = aSubject.document.createElementNS("http://www.w3.org/1999/xhtml", "input");
				input.classList.add("ruleactionitem", "input-inline");
				this.classList.add("input-container");
				this.classList.add("textbox-input");
				this.appendChild(input);
				updateParentNode(this.closest(".ruleaction"));
			}
		}

		if(!aSubject.customElements.get("qnote@dqdp.net#qnote-action-add")){
			aSubject.customElements.define("qnote-ruleactiontarget-add", actiontargetQNoteAdd);
		}

		if(!aSubject.customElements.get("qnote@dqdp.net#qnote-action-update")){
			aSubject.customElements.define("qnote-ruleactiontarget-update", actiontargetQNoteUpdate);
		}
	}

	uninstall() {
		// for (let listener of this.listeners["uninstall"]) {
		// 	listener();
		// }
		// this.QuickFilterManager.killFilter("qnote");
	}
}
