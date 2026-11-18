import { INoteData } from "../modules/Note.mjs";
import { INoteFileAPI, INoteFileProvider } from "./api.mjs";

var { FileUtils } = ChromeUtils.importESModule("resource://gre/modules/FileUtils.sys.mjs");

export interface IQNoteFileAPI extends INoteFileAPI<QNoteFile> {
	copyToClipboard(note: INoteData): Promise<boolean>
	getFromClipboard(): Promise<INoteData | null>
}

// keyId is stored only in files with hashed (long) names
interface IQNoteFileData extends INoteData {
	keyId?: string;
}

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

	md5(str: string){
		const ch = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
		ch.init(ch.MD5);
		const data = new TextEncoder().encode(str);
		ch.update(data, data.length);
		const bin: string = ch.finish(false);

		return Array.from(bin, c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
	}

	// Windows fails on paths longer than ~255 (temp file adds "~" and ".tmp"), 250 leaves some margin.
	// Existing files keep their name. New too long ones become "<prefix>~<md5>.qnote",
	// raw "~" never appears in encoded names.
	getFile(root:string, keyId: string){
		const MAX_PATH = 250;
		const enc = this.encodeFileName(keyId);

		const file = new FileUtils.File(root);
		file.append(enc + ".qnote");

		if(file.exists()){
			return file;
		}

		// Fixed prefix length, so hashed name does not depend on the folder path
		const prefix = enc.substring(0, 60).replace(/%[0-9A-F]?$/i, "");

		const hashedFile = new FileUtils.File(root);
		hashedFile.append(prefix + "~" + this.md5(keyId) + ".qnote");

		// Hashed file exists (e.g. folder moved to a shorter path) or full name is too long
		if(hashedFile.exists() || ("~" + file.path + ".tmp").length > MAX_PATH){
			return hashedFile;
		}

		return file;
	}

	getExistingFile(root: string, keyId: string) {
		var file = this.getFile(root, keyId);

		if(this.exists(file)){
			return file;
		}

		return false;
	}

	load(root: string, keyId: string): INoteData | null {
		var file = this.getExistingFile(root, keyId);

		if(!file){
			return null;
		}

		const { keyId: _, ...data } = this.readFile(file);

		return data;
	}

	readFile(file: any): IQNoteFileData {
		var fileInStream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
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

		return JSON.parse(data);
	}

	delete(root: string, keyId: string){
		const file = this.getExistingFile(root, keyId);
		if(file){
			file.remove(false);
		}
	}

	save(root: string, keyId: string, note: INoteData) {
		var file = this.getFile(root, keyId);
		const fileData: IQNoteFileData = { ...note };

		// Hashed name can't be decoded back, so keep keyId inside
		if(file.leafName.includes("~")){
			fileData.keyId = keyId;
		}

		let data = JSON.stringify(fileData);

		let tempFile = file.parent.clone();
		tempFile.append("~" + file.leafName + ".tmp");
		tempFile.createUnique(tempFile.NORMAL_FILE_TYPE, parseInt("0660",8));

		let fileOutStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
		const PR_WRONLY = 0x02, PR_TRUNCATE = 0x20;
		// Adding "PR_TRUNCATE" here is necessary for saving to work with Linux Gvfs drives
		// This fixes https://github.com/mlazdans/qnote/issues/107
		fileOutStream.init(tempFile, PR_WRONLY | PR_TRUNCATE, 0x200, 0); // Opens for writing only

		var con = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
		// con.init(fileOutStream, "utf-8", 0, 0xFFFD); // U+FFFD = replacement character
		con.init(fileOutStream, "utf-8");
		con.writeString(data);
		con.close();

		fileOutStream.close();

		try {
			tempFile.moveTo(null, file.leafName);
		} catch(e) {
			tempFile.remove(false);
			throw e;
		}
	}

	getAllKeys(root: string) {
		var file = new FileUtils.File(root);
		var eFiles = file.directoryEntries;
		var notes = [];

		while (eFiles.hasMoreElements()) {
			var o = eFiles.getNext().QueryInterface(Ci.nsIFile);

			const name: string = o.leafName;
			if(!name.endsWith(".qnote")){
				continue;
			}

			if(name.includes("~")){
				const keyId = this.readFile(o).keyId;
				if(keyId){
					notes.push(keyId);
				}
			} else {
				notes.push(this.decodeFileName(name.slice(0, -6)));
			}
		}

		return notes;
	}
};
