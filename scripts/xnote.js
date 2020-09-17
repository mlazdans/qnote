var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var xnote = class extends ExtensionCommon.ExtensionAPI {
	getAPI(context) {
		return {
			xnote: {
				__getDefaultPrefs() {
					return {
						usetag: false,
						dateformat: "yyyy-mm-dd - HH:MM",
						width: 250,
						height: 200,
						show_on_select: true,
						show_first_x_chars_in_col: 0,
						storage_path: '',
						version: '2.3.1'
					};
				},
				__getPrefs(){
					var _xnotePrefs = Services.prefs.QueryInterface(Components.interfaces.nsIPrefBranch).getBranch("extensions.xnote.");
					var DefaultPrefs = this.__getDefaultPrefs();
					var p = {};

					for(let k of Object.keys(DefaultPrefs)){
						let f;
						let t = typeof DefaultPrefs[k];

						if(t === 'boolean'){
							f = 'getBoolPref';
						} else if(t === 'string'){
							f = 'getCharPref';
						} else if(t === 'number'){
							f = 'getIntPref';
						}

						p[k] = DefaultPrefs[k];

						if(f && _xnotePrefs.prefHasUserValue(k)){
							p[k] = _xnotePrefs[f](k);
						}
					}

					return p;
				},
				__getProfilePath: function() {
					return Components.classes['@mozilla.org/file/directory_service;1']
						.getService(Components.interfaces.nsIProperties)
						.get('ProfD', Components.interfaces.nsIFile);
				},
				async getDefaultPrefs() {
					return this.__getDefaultPrefs();
				},
				async getPrefs(){
					return this.__getPrefs();
				},
				async loadNote(fileName){
					try {
						var file = new FileUtils.File(fileName);
					} catch {
						console.error(`Can not open legacy xnote: ${fileName}`);
						return false;
					}

					var note = {};

					if(!file.exists() || !file.isReadable() || !file.isFile()){
						console.error(`Can't access ${fileName}`);
						return false;
					}

					var fileInStream = Components.classes['@mozilla.org/network/file-input-stream;1'].createInstance(Components.interfaces.nsIFileInputStream);
					var fileScriptableIO = Components.classes['@mozilla.org/scriptableinputstream;1'].createInstance(Components.interfaces.nsIScriptableInputStream);
					fileInStream.init(file, 0x01, parseInt("0444", 8), null);
					fileScriptableIO.init(fileInStream);

					note.x = parseInt(fileScriptableIO.read(4));
					note.y = parseInt(fileScriptableIO.read(4));
					note.width = parseInt(fileScriptableIO.read(4));
					note.height = parseInt(fileScriptableIO.read(4));
					note.modificationDate = fileScriptableIO.read(32);
					note.text = decodeURIComponent(fileScriptableIO.read(file.fileSize-48));
					note.messageId = file.leafName.substring(0, file.leafName.length - 6);

					fileScriptableIO.close();
					fileInStream.close();

					note.text = note.text.replace(/<BR>/g,'\n');

					return note;
				},
				async getNotes(path) {
					try {
						var file = new FileUtils.File(path);
					} catch {
						console.error(`Can not open legacy xnotes path: ${path}`);
						return false;
					}
					var eFiles = file.directoryEntries;
					var notes = [];

					while (eFiles.hasMoreElements()) {
						var o = eFiles.getNext().QueryInterface(Components.interfaces.nsIFile);
						if(o.leafName.substring(o.leafName.length - 6) === '.xnote'){
							notes.push((({ path, leafName }) => ({ path, leafName }))(o));
						}
					}

					return notes;
				},
				async getProfilePath() {
					return this.__getProfilePath().path;
				},
				async getStoragePath() {
					var _storageDir = this.__getProfilePath();
					_storageDir.append('XNote');
					return (_storageDir.exists() && _storageDir.isReadable() && _storageDir.isDirectory()) ? _storageDir.path : false;
				}
			}
		}
	}
}
