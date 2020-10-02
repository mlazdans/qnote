var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

function noteFile(root, fileName){
	try {
		var file = new FileUtils.File(root);

		file.appendRelativePath(encodeFileName(fileName + '.qnote'));

		return file;
	} catch {
		return false;
	}
}

function fileExists(file){
	return file && file.exists() && file.isFile() && file.isReadable();
}

function getExistingNoteFile(root, fileName) {
	var file = noteFile(root, fileName);

	if(fileExists(file)){
		return file;
	}

	return false;
}

function encodeFileName(str){
	return encodeURIComponent(str)
		.replace(/\*/g, "%2A")
		.replace(/\~/g, "%7E")
	;
}

function decodeFileName(str){
	return decodeURIComponent(str)
		.replace(/%2A/g, "*")
		.replace(/%7E/g, "~")
	;
}

var qnote = class extends ExtensionCommon.ExtensionAPI {
	onShutdown(isAppShutdown) {
		if(isAppShutdown){
			return;
		}

		Services.obs.notifyObservers(null, "startupcache-invalidate", null);
	}
	getAPI(context) {
		return {
			qnote: {
				async saveNote(root, fileName, note){
					var file = noteFile(root, fileName);
					if(!file){
						console.error(`Can not open xnote: ${fileName}`);
						return false;
					}

					let data = JSON.stringify(note);

					let tempFile = file.parent.clone();
					tempFile.append("~" + file.leafName + ".tmp");
					tempFile.createUnique(tempFile.NORMAL_FILE_TYPE, parseInt("0660",8));

					let fileOutStream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
					fileOutStream.init(tempFile, 2, 0x200, false); // Opens for writing only
					fileOutStream.write(data, data.length);
					fileOutStream.close();

					try {
						tempFile.moveTo(null, file.leafName);
						return true;
					} catch {
						return false;
					}
				},
				async deleteNote(root, fileName){
					var file = getExistingNoteFile(root, fileName);
					try {
						file.remove(false);
						return true;
					} catch {
						return false;
					}
				},
				async loadNote(root, fileName){
					var file = getExistingNoteFile(root, fileName);
					if(!file){
						return false;
					}

					var fileInStream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
					var fileScriptableIO = Cc['@mozilla.org/scriptableinputstream;1'].createInstance(Ci.nsIScriptableInputStream);
					fileInStream.init(file, 0x01, parseInt("0444", 8), null);
					fileScriptableIO.init(fileInStream);

					var noteData = fileScriptableIO.read(file.fileSize);
					var note = JSON.parse(noteData);

					fileScriptableIO.close();
					fileInStream.close();

					return note;
				},
				async getAllNotes(root) {
					try {
						var file = new FileUtils.File(root);
					} catch {
						console.error(`Can not open xnotes folder: ${root}`);
						return;
					}

					var eFiles = file.directoryEntries;
					var notes = [];

					while (eFiles.hasMoreElements()) {
						var o = eFiles.getNext().QueryInterface(Components.interfaces.nsIFile);

						var fileName = decodeFileName(o.leafName);
						if(fileName.substring(fileName.length - 6) === '.qnote'){
							notes.push({
								keyId: fileName.substring(0, fileName.length - 6),
								fileName: fileName
							});
						}
					}

					return notes;
				}
			}
		}
	}
}
