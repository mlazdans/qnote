var { QNoteFile } = ChromeUtils.importESModule("resource://qnote/modules-exp/QNoteFile.mjs");
var { XNoteFile } = ChromeUtils.importESModule("resource://qnote/modules-exp/XNoteFile.mjs");

// NOTE:
// We need completely restart TB if CustomTerm code changes
// Currenlty there are no means to remove filter or there is but I'm not aware, please let me know: qnote@dqdp.net

// TODO: try brind all calls to options.API
// TODO: scopes
export interface QCustomTermOptions {
	API: QApp
	QDEB: boolean
	name?: string
}

export class QCustomTerm {
	id: string
	name: string
	needsBody: boolean = false
	ops: Array<Ci.nsMsgSearchOp>
	API: QApp
	QN
	XN
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
	match(msgHdr: any, searchValue: string, searchOp: Ci.nsMsgSearchOp): boolean {
		const notesRoot = this.API.getStorageFolder();

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

		if(!note || note.exists){
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
