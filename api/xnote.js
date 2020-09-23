var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var { QUtils } = ChromeUtils.import(extension.rootURI.resolve("modules/QUtils.jsm"));
var { XUtils } = ChromeUtils.import(extension.rootURI.resolve("modules/XUtils.jsm"));

var xnote = class extends ExtensionCommon.ExtensionAPI {
	onShutdown(isAppShutdown) {
		if(isAppShutdown){
			return;
		}

		Services.obs.notifyObservers(null, "startupcache-invalidate", null);

		Components.utils.unload(extension.rootURI.resolve("modules/QUtils.jsm"));
		Components.utils.unload(extension.rootURI.resolve("modules/XUtils.jsm"));
	}
	getAPI(context) {
		return {
			xnote: {
				async getPrefs(){
					return XUtils.getPrefs();
				},
				async getDefaultPrefs() {
					return QUtils.getDefaultPrefs();
				},
				async saveNote(root, fileName, note){
					var file = XUtils.noteFile(root, fileName);
					if(!file){
						console.error(`Can not open xnote: ${fileName}`);
						return false;
					}

					let tempFile = file.parent.clone();
					tempFile.append("~" + file.leafName + ".tmp");
					// Using 0660 instead of 0600 so that sharing notes accross users
					// within the same group is possible on Linux.
					tempFile.createUnique(tempFile.NORMAL_FILE_TYPE, parseInt("0660",8));

					let fileOutStream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);

					fileOutStream.init(tempFile, 2, 0x200, false); // Opens for writing only
					fileOutStream.write(String(note.x), 4);
					fileOutStream.write(String(note.y), 4);
					fileOutStream.write(String(note.width), 4);
					fileOutStream.write(String(note.height), 4);

					let d = XUtils.dateToNoteDate(new Date(note.ts), XUtils.getPrefs().dateformat || XUtils.getDefaultPrefs().dateformat);
					fileOutStream.write(d, 32);

					let contentencode = encodeURIComponent(note.text.replace(/\n/g,'<BR>'));
					fileOutStream.write(contentencode, contentencode.length);

					fileOutStream.close();

					try {
						tempFile.moveTo(null, file.leafName);
						return true;
					} catch {
						return false;
					}
				},
				async noteExists(root, fileName){
					var file = XUtils.noteFile(root, fileName);
					return file && file.exists() && file.isFile();
				},
				async deleteNote(root, fileName){
					var file = XUtils.noteFile(root, fileName);
					try {
						file.remove(false);
						return true;
					} catch {
						return false;
					}
				},
				async loadNote(root, fileName){
					var file = XUtils.noteFile(root, fileName);
					if(!file || !file.exists() || !file.isReadable() || !file.isFile()){
						return false;
					}

					var note = {};

					var fileInStream = Components.classes['@mozilla.org/network/file-input-stream;1'].createInstance(Components.interfaces.nsIFileInputStream);
					var fileScriptableIO = Components.classes['@mozilla.org/scriptableinputstream;1'].createInstance(Components.interfaces.nsIScriptableInputStream);
					fileInStream.init(file, 0x01, parseInt("0444", 8), null);
					fileScriptableIO.init(fileInStream);

					note.keyId = file.leafName.substring(0, file.leafName.length - 6);
					note.x = parseInt(fileScriptableIO.read(4));
					note.y = parseInt(fileScriptableIO.read(4));
					note.width = parseInt(fileScriptableIO.read(4));
					note.height = parseInt(fileScriptableIO.read(4));
					note.ts = XUtils.noteDateToDate(fileScriptableIO.read(32));
					note.text = decodeURIComponent(fileScriptableIO.read(file.fileSize-48));

					fileScriptableIO.close();
					fileInStream.close();

					note.text = note.text.replace(/<BR>/g,'\n');

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
						if(o.leafName.substring(o.leafName.length - 6) === '.xnote'){
							notes.push({
								keyId: o.leafName.substring(0, o.leafName.length - 6),
								fileName: o.leafName
							});
						}
					}

					return notes;
				},
				async getStoragePath() {
					var _storageDir = QUtils.getProfilePath();
					_storageDir.append('XNote');
					return (_storageDir.exists() && _storageDir.isReadable() && _storageDir.isDirectory()) ? _storageDir.path : undefined;
				}
			}
		}
	}
}
