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
				__getProfilePath: function() {
					return Components.classes['@mozilla.org/file/directory_service;1']
						.getService(Components.interfaces.nsIProperties)
						.get('ProfD', Components.interfaces.nsIFile);
				},
				getProfilePath: function() {
					var _storageDir = this.__getProfilePath();
					return _storageDir.path;
				},
				getStoragePath: function() {
					var _storageDir = this.__getProfilePath();
					_storageDir.append('XNote');
					return (_storageDir.exists() && _storageDir.isReadable() && _storageDir.isDirectory()) ? _storageDir.path : false;
				},
			}
		}
	}
}
