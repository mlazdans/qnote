var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var { XUtils } = ChromeUtils.import(extension.rootURI.resolve("modules/XUtils.jsm"));

var xnote = class extends ExtensionCommon.ExtensionAPI {
	onShutdown(isAppShutdown) {
		if(isAppShutdown){
			return;
		}

		Services.obs.notifyObservers(null, "startupcache-invalidate", null);

		Components.utils.unload(extension.rootURI.resolve("modules/XUtils.jsm"));
	}
	getAPI(context) {
		const NF_DO_ENCODE = 1;
		const NF_DO_NOT_ENCODE = 0;

		let noteFile = (root, fileName, encodeFileName = NF_DO_ENCODE) => {
			try {
				var file = new FileUtils.File(root);
				if(encodeFileName === NF_DO_ENCODE){
					file.appendRelativePath(XUtils.encodeFileName(fileName));
				} else {
					file.appendRelativePath(fileName);
				}
				return file;
			} catch {
				return false;
			}
		};

		let getPrefs = () => {
			var _xnotePrefs = Services.prefs.QueryInterface(Components.interfaces.nsIPrefBranch).getBranch("extensions.xnote.");
			var defaultPrefs = XUtils.getDefaultPrefs();
			var p = {};

			for(let k of Object.keys(defaultPrefs)){
				let f;
				let t = typeof defaultPrefs[k];

				if(t === 'boolean'){
					f = 'getBoolPref';
				} else if(t === 'string'){
					f = 'getCharPref';
				} else if(t === 'number'){
					f = 'getIntPref';
				}

				//p[k] = defaultPrefs[k];

				if(f && _xnotePrefs.prefHasUserValue(k)){
					p[k] = _xnotePrefs[f](k);
					p[k] = defaultPrefs[k].constructor(p[k]); // Type cast
				}
			}

			return p;
		}

		let fileExists = (file) => {
			return file && file.exists() && file.isFile() && file.isReadable();
		};

		let getExistingNoteFile = (root, fileName) => {
			var file = noteFile(root, fileName, NF_DO_ENCODE);
			if(fileExists(file)){
				return file;
			}

			var file = noteFile(root, fileName, NF_DO_NOT_ENCODE);
			if(fileExists(file)){
				return file;
			}

			return false;
		}

		return {
			xnote: {
				async getPrefs(){
					return getPrefs();
				},
				async getDefaultPrefs() {
					return XUtils.getDefaultPrefs();
				},
				async saveNote(root, fileName, note){
					var file = noteFile(root, fileName);
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

					let d = XUtils.dateToNoteDate(new Date(note.ts), getPrefs().dateformat || XUtils.getDefaultPrefs().dateformat);
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

					var note = {};

					var fileInStream = Components.classes['@mozilla.org/network/file-input-stream;1'].createInstance(Components.interfaces.nsIFileInputStream);
					var fileScriptableIO = Components.classes['@mozilla.org/scriptableinputstream;1'].createInstance(Components.interfaces.nsIScriptableInputStream);
					fileInStream.init(file, 0x01, parseInt("0444", 8), null);
					fileScriptableIO.init(fileInStream);

					//note.keyId = file.leafName.substring(0, file.leafName.length - 6);
					note.x = parseInt(fileScriptableIO.read(4));
					note.y = parseInt(fileScriptableIO.read(4));
					note.width = parseInt(fileScriptableIO.read(4));
					note.height = parseInt(fileScriptableIO.read(4));
					note.ts = XUtils.noteDateToDate(fileScriptableIO.read(32)).getTime();
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

						var fileName = XUtils.decodeFileName(o.leafName);
						if(fileName.substring(fileName.length - 6) === '.xnote'){
							notes.push({
								keyId: fileName.substring(0, fileName.length - 6),
								fileName: fileName
							});
						}
					}

					return notes;
				},
				async getStoragePath() {
					var _storageDir =
						Components.classes['@mozilla.org/file/directory_service;1']
						.getService(Components.interfaces.nsIProperties)
						.get('ProfD', Components.interfaces.nsIFile)
					;

					_storageDir.append('XNote');

					return _storageDir.path;
				}
			}
		}
	}
}
