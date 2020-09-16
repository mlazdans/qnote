var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var xnote = class extends ExtensionCommon.ExtensionAPI {
	getAPI(context) {
		return {
			xnote: {
				async loadNote(fileName){
					//var file = new FileUtils.File("D:\\thunderbird\\dev.profile\\XNote\\");
					try {
						var file = new FileUtils.File(fileName);
					} catch {
						console.error(`Can not open legacy xnote: ${fileName}`);
						return false;
					}
					var pub = {};

					//file.appendRelativePath(fileName);
					if(!file.exists() || !file.isReadable() || !file.isFile()){
						console.error(`Can't access ${fileName}`);
						return false;
					}

					var fileInStream = Components.classes['@mozilla.org/network/file-input-stream;1'].createInstance(Components.interfaces.nsIFileInputStream);
					var fileScriptableIO = Components.classes['@mozilla.org/scriptableinputstream;1'].createInstance(Components.interfaces.nsIScriptableInputStream);
					fileInStream.init(file, 0x01, parseInt("0444", 8), null );
					fileScriptableIO.init(fileInStream);
					pub.x = parseInt(fileScriptableIO.read(4));
					pub.y = parseInt(fileScriptableIO.read(4));
					pub.width = parseInt(fileScriptableIO.read(4));
					pub.height = parseInt(fileScriptableIO.read(4));
					pub.modificationDate = fileScriptableIO.read(32);
					pub.text = decodeURIComponent(fileScriptableIO.read(file.fileSize-48));
					pub.messageId = file.leafName.substring(0, file.leafName.length - 6);

					fileScriptableIO.close();
					fileInStream.close();

					pub.text = pub.text.replace(/<BR>/g,'\n');

					return pub;
				},
				async getNotes(path) {
					//var file = new FileUtils.File("D:\\thunderbird\\dev.profile\\XNote");
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
						notes.push((({ path, leafName }) => ({ path, leafName }))(o));
					}
					return notes;
				},
				getStoragePath: function() {
					var _storageDir;
					let directoryService = 	Components.classes['@mozilla.org/file/directory_service;1'].getService(Components.interfaces.nsIProperties);
					let profileDir = directoryService.get('ProfD', Components.interfaces.nsIFile);
					//console.log("profileDir: ", profileDir);
					//let defaultDir = profileDir.clone();
					let defaultDir = profileDir;
					//console.log("defaultDir: ", defaultDir);
					//let xnotePrefs = xnote.ns.Commons.xnotePrefs;
					let xnotePrefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.xnote.");
					//let xnotePrefs = Services.prefs;

					defaultDir.append('XNote');
					if (!xnotePrefs.prefHasUserValue("storage_path")) {
						_storageDir = defaultDir;
					} else try {
						//let storagePath = xnote.ns.UTF8Coder.decode(xnotePrefs.getCharPref('storage_path').trim());
						let storagePath = xnotePrefs.getCharPref('storage_path').trim();
						//let FileUtils = ChromeUtils.import("resource://gre/modules/FileUtils.jsm").FileUtils;
						if (storagePath != "") {
							if (storagePath.indexOf("[ProfD]") == 0) {
								_storageDir = new FileUtils.File(profileDir.path);
								_storageDir.appendRelativePath(storagePath.substring(7));
							}
							else {
								_storageDir = new FileUtils.File(storagePath);
							}
						}
						else {
							_storageDir = defaultDir;
						}
					} catch (e) {
						//~ dump("\nCould not get storage path:"+e+"\n"+e.stack+"\n...applying default storage path.");
						_storageDir = defaultDir;
					}
					//context._storageDir = _storageDir;
					//console.log("_storageDir: ", _storageDir.exists());
					return (_storageDir.exists() && _storageDir.isReadable() && _storageDir.isDirectory()) ? _storageDir.path : false;
					//return _storageDir.path;
				},
			}
		}
	}
}
