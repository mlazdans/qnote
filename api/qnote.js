var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionError } = ExtensionUtils;

var qnote = class extends ExtensionCommon.ExtensionAPI {
	onShutdown(isAppShutdown) {
		if(isAppShutdown){
			return;
		}

		Services.obs.notifyObservers(null, "startupcache-invalidate", null);
	}
	getAPI(context) {
		function noteFile(root, keyId){
			try {
				var file = new FileUtils.File(root);

				file.appendRelativePath(encodeFileName(keyId + '.qnote'));

				return file;
			} catch {
				return false;
			}
		}

		function fileExists(file){
			return file && file.exists() /*&& file.isFile() && file.isReadable()*/;
		}

		function getExistingNoteFile(root, keyId) {
			var file = noteFile(root, keyId);

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

		return {
			qnote: {
				async saveNote(root, keyId, note){
					var file = noteFile(root, keyId);
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

					return true;
				},
				async deleteNote(root, keyId){
					var file = getExistingNoteFile(root, keyId);

					file.remove(false);

					return true;
				},
				async loadNote(root, keyId){
					var file = getExistingNoteFile(root, keyId);

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
				},
				async getAllKeys(root) {
					var file = new FileUtils.File(root);
					var eFiles = file.directoryEntries;
					var notes = [];

					while (eFiles.hasMoreElements()) {
						var o = eFiles.getNext().QueryInterface(Components.interfaces.nsIFile);

						var fileName = decodeFileName(o.leafName);
						if(fileName.substring(fileName.length - 6) === '.qnote'){
							notes.push(fileName.substring(0, fileName.length - 6));
						}
					}

					return notes;
				}
			}
		}
	}
}
