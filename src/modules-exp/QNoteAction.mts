// TODO: localize
// const Services = globalThis.Services || ChromeUtils.import(
//   "resource://gre/modules/Services.jsm"
// ).Services;

import { QCache } from "../modules/QCache.mjs";

var { NoteData } = ChromeUtils.importESModule("resource://qnote/modules/Note.mjs");
var { QNoteFile } = ChromeUtils.importESModule("resource://qnote/modules-exp/QNoteFile.mjs");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var { ThreadPaneColumns } = ChromeUtils.importESModule("chrome://messenger/content/ThreadPaneColumns.mjs");

var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

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
			const note = new NoteData(keyId);

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
			const note = new NoteData(keyId);

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
