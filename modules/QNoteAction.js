var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");
var { QCustomActionAdd } = ChromeUtils.import("resource://qnote/modules/QCustomActionAdd.js");

var EXPORTED_SYMBOLS = ["QNoteAction"];

class QNoteAction {
	filterEditorHandler(aSubject, document){
		(function(){
			let wrapper = aSubject.customElements.get("ruleactiontarget-wrapper");
			let _getChildNode;

			if (!wrapper || wrapper.prototype.hasOwnProperty("_QNoteAddAction") || !(_getChildNode = wrapper.prototype._getChildNode)) {
				return;
			}

			wrapper.prototype._getChildNode = function(type) {
				return type == "qnote@dqdp.net#qnoteAdd" ?
					document.createXULElement("qnote-ruleactiontarget-add") :
					_getChildNode(type);
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

		if(!aSubject.customElements.get("qnote@dqdp.net#qnoteAdd")){
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
			aSubject.customElements.define("qnote-ruleactiontarget-add", actiontargetQNoteAdd);
		}
	}

	constructor(options) {
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
	}

	uninstall() {
		// for (let listener of this.listeners["uninstall"]) {
		// 	listener();
		// }
		// this.QuickFilterManager.killFilter("qnote");
	}
}
