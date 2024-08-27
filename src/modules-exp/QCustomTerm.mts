var { QNoteFile } = ChromeUtils.importESModule("resource://qnote/modules-exp/QNoteFile.mjs");
var { XNoteFile } = ChromeUtils.importESModule("resource://qnote/modules-exp/XNoteFile.mjs");

// NOTE:
// We need completely restart TB if CustomTerm code changes
// Currenlty there are no means to remove filter or there is but I'm not aware, please let me know: qnote@dqdp.net

// TODO: try brind all calls to options.API
// TODO: scopes
export interface QCustomTermOptions {
	QDEB: boolean
	API: QApp
	w: MozWindow
	name: string
}

export class QCustomTerm {
	id: string
	name: string
	needsBody: boolean = false
	ops: Array<Ci.nsMsgSearchOp>
	API: QApp
	QN: typeof XNoteFile
	XN: typeof XNoteFile
	constructor(options: QCustomTermOptions) {
		this.id = 'qnote@dqdp.net#qnoteText';
		this.name = options.name || "QNote";

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
		this.API = options.API;
	}

	getEnabled(scope: any, op: any) {
		return true;
	}
	getAvailable(scope: any, op: any) {
		return true;
	}
	getAvailableOperators(scope: any, length: any) {
		if(length){
			length.value = this.ops.length;
		}

		return this.ops;
	}
	match(msgHdr: any, searchValue: string, searchOp: Ci.nsMsgSearchOp) {
		let notesRoot = this.API.getStorageFolder();

		if(!notesRoot){
			return false;
		}

		let note;
		try {
			note = this.QN.load(notesRoot, msgHdr.messageId);
			if(!note){
				note = this.XN.load(notesRoot, msgHdr.messageId);
			}
		} catch(e) { }

		let keyw = searchValue.toLowerCase();

		if(searchOp == Ci.nsMsgSearchOp.Contains){
			return note && (!keyw || (note.text.toLowerCase().search(keyw) >= 0));
		}

		if(searchOp == Ci.nsMsgSearchOp.DoesntContain){
			return (!note && !keyw) || (note && keyw && (note.text.toLowerCase().search(keyw) == -1));
		}

		if(searchOp == Ci.nsMsgSearchOp.Is){
			return note && note.text.toLowerCase() == keyw;
		}

		if(searchOp == Ci.nsMsgSearchOp.Isnt){
			return note && note.text.toLowerCase() != keyw;
		}

		if(searchOp == Ci.nsMsgSearchOp.BeginsWith){
			return note && (!keyw || note.text.toLowerCase().startsWith(keyw));
		}

		if(searchOp == Ci.nsMsgSearchOp.EndsWith){
			return note && (!keyw || note.text.toLowerCase().endsWith(keyw));
		}
	}
}
