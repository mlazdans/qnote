var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");

var EXPORTED_SYMBOLS = ["QNoteFile"];

class QNoteFile {
	constructor(){
		this.FU = FileUtils;
	}
	exists(file){
		return file && file.exists();
	}
	encodeFileName(str){
		return encodeURIComponent(str)
			.replace(/\*/g, "%2A")
			.replace(/\~/g, "%7E")
		;
	}
	decodeFileName(str){
		return decodeURIComponent(str)
			.replace(/%2A/g, "*")
			.replace(/%7E/g, "~")
		;
	}
	getFile(root, keyId){
		// try {
			var file = new this.FU.File(root);

			file.appendRelativePath(this.encodeFileName(keyId + '.qnote'));

			return file;
		// } catch {
		// 	return false;
		// }
	}
	getExistingFile(root, keyId) {
		var file = this.getFile(root, keyId);

		if(this.exists(file)){
			return file;
		}

		return false;
	}
	load(root, keyId) {
		var file = this.getExistingFile(root, keyId);

		if(!file){
			return false;
		}

		var fileInStream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
		//var fileScriptableIO = Cc['@mozilla.org/scriptableinputstream;1'].createInstance(Ci.nsIScriptableInputStream);
		fileInStream.init(file, 0x01, parseInt("0444", 8), null);

		var con = Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(Ci.nsIConverterInputStream);
		con.init(fileInStream, "utf-8", 0, 0xFFFD); // U+FFFD = replacement character

		//fileScriptableIO.init(fileInStream);
		var data = '';
		var str = {};
		while (con.readString(4096, str) != 0) {
			data += str.value;
		}

		//fileScriptableIO.close();
		con.close();
		fileInStream.close();

		try {
			return JSON.parse(data);
		} catch {
			return null;
		}
	}
	delete(root, keyId){
		var file = this.getExistingFile(root, keyId);
		if(file){
			file.remove(false);
		}
	}
	save(root, keyId, note){
		var file = this.getFile(root, keyId);
		let data = JSON.stringify(note);

		let tempFile = file.parent.clone();
		tempFile.append("~" + file.leafName + ".tmp");
		tempFile.createUnique(tempFile.NORMAL_FILE_TYPE, parseInt("0660",8));

		let fileOutStream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
		fileOutStream.init(tempFile, 2, 0x200, false); // Opens for writing only

		var con = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
		con.init(fileOutStream, "utf-8", 0, 0xFFFD); // U+FFFD = replacement character
		con.writeString(data);
		con.close();

		// fileOutStream.init(tempFile, 2, 0x200, false); // Opens for writing only
		// fileOutStream.write(data, data.length);
		fileOutStream.close();

		tempFile.moveTo(null, file.leafName);
	}
	getAllKeys(root) {
		var file = new this.FU.File(root);
		var eFiles = file.directoryEntries;
		var notes = [];

		while (eFiles.hasMoreElements()) {
			var o = eFiles.getNext().QueryInterface(Components.interfaces.nsIFile);

			var fileName = this.decodeFileName(o.leafName);
			if(fileName.substring(fileName.length - 6) === '.qnote'){
				notes.push(fileName.substring(0, fileName.length - 6));
			}
		}

		return notes;
	}
};
