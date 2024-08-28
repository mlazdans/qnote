// TODO: localize
// const Services = globalThis.Services || ChromeUtils.import(
//   "resource://gre/modules/Services.jsm"
// ).Services;

var { NoteData } = ChromeUtils.importESModule("resource://qnote/modules/Note.mjs");
var { QNoteFile } = ChromeUtils.importESModule("resource://qnote/modules-exp/QNoteFile.mjs");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

export interface QNoteActionOptions {
	API: QApp
	QDEB: boolean
}

export class QNoteAction {
	API
	ruleMap: Map<string, string>;
	Services

	constructor(options: QNoteActionOptions) {
		this.ruleMap = new Map;
		this.Services = Services;
		this.API = options.API;

		// Add
		var caAdd = new QCustomAddAction();
		if(caAdd.install()){
			this.ruleMap.set(caAdd.id, "qnote-ruleactiontarget-add");
		}

		// Update
		var caUpdate = new QCustomUpdateAction();
		if(caUpdate.install()){
			this.ruleMap.set(caUpdate.id, "qnote-ruleactiontarget-update");
		}

		// Delete
		let caDelete = new QCustomDeleteAction()
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

		const updateParentNode = (parentNode: HTMLElement) => {
			if (parentNode.hasAttribute("initialActionIndex")) {
				let actionIndex = parentNode.getAttribute("initialActionIndex");
				let filterAction = aSubject.gFilter.getActionAt(actionIndex);
				parentNode.initWithAction(filterAction);
			}
			parentNode.updateRemoveButton();
		};

		// TODO: should find a better way processing these classes below
		// They depend on window.MozXULElement (aSubject)
		class atQNote extends aSubject.MozXULElement {
			connectedCallback() {
				if(Action.API.getStorageFolder()){
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
				updateParentNode(this.closest(".ruleaction"));
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
				updateParentNode(this.closest(".ruleaction"));
			}
		}
		class actiontargetQNoteDelete extends atQNote {
			_connectedCallback() {
				// Add dummy child
				const input = aSubject.document.createElementNS("http://www.w3.org/1999/xhtml", "span");
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

		if(!aSubject.customElements.get("qnote@dqdp.net#qnote-action-delete")){
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

abstract class QCustomActionAbstract implements nsIMsgFilterCustomAction {
	id: string
	name: string
	allowDuplicates = false
	isAsync = false
	needsBody = false

	private QN
	private Services

	constructor(id: string, name: string) {
		this.id = id;
		this.name = name;
		this.QN = new QNoteFile;
		// this.API = options.API;
		this.Services = Services;
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

class QCustomAddAction extends QCustomActionAbstract {
	constructor() {
		super('qnote@dqdp.net#qnote-action-add', 'Add QNote');
	}

	applyAction(msgHdrs: Array<nsIMsgDBHdr>, actionValue: string, copyListener: nsIMsgCopyServiceListener, filterType: nsMsgFilterTypeType, msgWindow: nsIMsgWindow): void {
		const notesRoot = this.API.getStorageFolder();

		if(!actionValue || !notesRoot){
			return;
		}

		const QN = new QNoteFile;
		const ts = Date.now();
		msgHdrs.forEach(m => {
			const keyId = m.messageId;
			const note = new NoteData(keyId);

			note.text = actionValue;
			note.ts = ts;

			if(!QN.getExistingFile(notesRoot, keyId)){
				QN.save(notesRoot, keyId, note);
				this.API.noteGrabber.delete(keyId);
			}
		});
		this.API.updateView();
	}
}

class QCustomUpdateAction extends QCustomActionAbstract {
	constructor() {
		super('qnote@dqdp.net#qnote-action-update', 'Update QNote');
	}

	applyAction(msgHdrs: Array<nsIMsgDBHdr>, actionValue: string, copyListener: nsIMsgCopyServiceListener, filterType: nsMsgFilterTypeType, msgWindow: nsIMsgWindow): void {
		const notesRoot = this.API.getStorageFolder();

		if(!actionValue || !notesRoot){
			return;
		}

		const QN = new QNoteFile;
		let ts = Date.now();
		msgHdrs.forEach(m => {
			const keyId = m.messageId;
			const note = new NoteData(keyId);

			note.text = actionValue;
			note.ts = ts;

			QN.save(notesRoot, keyId, note);
			this.API.noteGrabber.delete(keyId); // TODO: maybe update?
		});
		this.API.updateView();
	}
}

class QCustomDeleteAction extends QCustomActionAbstract {
	constructor() {
		super('qnote@dqdp.net#qnote-action-delete', 'Delete QNote');
	}

	validateActionValue() {
		return "";
	}

	applyAction(msgHdrs: Array<nsIMsgDBHdr>, actionValue: string, copyListener: nsIMsgCopyServiceListener, filterType: nsMsgFilterTypeType, msgWindow: nsIMsgWindow): void {
		const notesRoot = this.API.getStorageFolder();

		if(!notesRoot){
			return;
		}

		const QN = new QNoteFile;
		msgHdrs.forEach(m => {
			QN.delete(notesRoot, m.messageId);
			this.API.noteGrabber.delete(m.messageId);
		});
		this.API.updateView();
	}
}
