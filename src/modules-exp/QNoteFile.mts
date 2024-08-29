import { INoteFileProvider } from "../modules/api.mjs";
import { NoteData } from "../modules/Note.mjs";
var FileUtils = ChromeUtils.import("resource://gre/modules/FileUtils.jsm").FileUtils;

export class QNoteFile implements INoteFileProvider {
	exists(file: any){
		return file && file.exists();
	}

	encodeFileName(str: string){
		return encodeURIComponent(str)
			.replace(/\*/g, "%2A")
			.replace(/\~/g, "%7E")
		;
	}

	decodeFileName(str: string){
		return decodeURIComponent(str)
			.replace(/%2A/g, "*")
			.replace(/%7E/g, "~")
		;
	}

	getFile(root:string, keyId: string){
		var file = new FileUtils.File(root);

		file.appendRelativePath(this.encodeFileName(keyId + '.qnote'));

		return file;
	}

	getExistingFile(root: string, keyId: string) {
		var file = this.getFile(root, keyId);

		if(this.exists(file)){
			return file;
		}

		return false;
	}

	load(root: string, keyId: string): NoteData {
		var file = this.getExistingFile(root, keyId);
		var note = new NoteData(keyId);

		if(!file){
			return note;
		}

		var fileInStream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
		fileInStream.init(file, 0x01, parseInt("0444", 8), null);

		var con = Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(Ci.nsIConverterInputStream);
		con.init(fileInStream, "utf-8", 0, 0xFFFD); // U+FFFD = replacement character

		var data = '';
		var str: AString = {};
		while (con.readString(4096, str) != 0) {
			data += str.value;
		}

		con.close();
		fileInStream.close();

		note = JSON.parse(data);
		note.exists = true;
		note.keyId = keyId;

		return note;
	}

	delete(root: string, keyId: string){
		const file = this.getExistingFile(root, keyId);
		if(file){
			file.remove(false);
		}
	}

	save(root: string, keyId: string, note: NoteData) {
		var file = this.getFile(root, keyId);
		let data = JSON.stringify(note);

		let tempFile = file.parent.clone();
		tempFile.append("~" + file.leafName + ".tmp");
		tempFile.createUnique(tempFile.NORMAL_FILE_TYPE, parseInt("0660",8));

		let fileOutStream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
		fileOutStream.init(tempFile, 2, 0x200, 0); // Opens for writing only

		var con = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
		// con.init(fileOutStream, "utf-8", 0, 0xFFFD); // U+FFFD = replacement character
		con.init(fileOutStream, "utf-8"); // TODO: test - removed extra paramaters
		con.writeString(data);
		con.close();

		fileOutStream.close();

		tempFile.moveTo(null, file.leafName);
	}

	getAllKeys(root: string) {
		var file = new FileUtils.File(root);
		var eFiles = file.directoryEntries;
		var notes = [];

		while (eFiles.hasMoreElements()) {
			var o = eFiles.getNext().QueryInterface(Ci.nsIFile);

			var fileName = this.decodeFileName(o.leafName);
			if(fileName.substring(fileName.length - 6) === '.qnote'){
				notes.push(fileName.substring(0, fileName.length - 6));
			}
		}

		return notes;
	}
};
