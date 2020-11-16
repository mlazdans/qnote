var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var xnote = class extends ExtensionCommon.ExtensionAPI {
	onShutdown(isAppShutdown) {
		if(isAppShutdown){
			return;
		}

		Services.obs.notifyObservers(null, "startupcache-invalidate", null);
	}
	getAPI(context) {
		const NF_DO_ENCODE = 1;
		const NF_DO_NOT_ENCODE = 0;

		function getDefaultPrefs() {
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
		}

		// NOTE: Seems that "yyyy-mm-dd - HH:MM" format has been hardcoded for some time?
		function noteDateToDate(dateString) {
			let dateParsers = [
				// "yyyy-mm-dd - HH:MM"
				ds => {
					let D = new Date();
					let [date, time] = ds.split(" - ");

					if(date){
						let dateParts = date.split("-");
						D.setFullYear(dateParts[0]);
						D.setMonth(dateParts[1] - 1);
						D.setDate(dateParts[2]);
					}

					if(time){
						let timeParts = time.split(":");
						D.setHours(timeParts[0]);
						D.setMinutes(timeParts[1]);
					}

					return D;
				},
				// "dd/mm/yyyy - HH:MM"
				ds => {
					let D = new Date();
					let [date, time] = ds.split(" - ");

					if(date){
						let dateParts = date.split("/");
						D.setFullYear(dateParts[2]);
						D.setMonth(dateParts[1] - 1);
						D.setDate(dateParts[0]);
					}

					if(time){
						let timeParts = time.split(":");
						D.setHours(timeParts[0]);
						D.setMinutes(timeParts[1]);
					}

					return D;
				}
			];

			for(let ds of dateParsers){
				let D = ds(dateString);
				if(D.getTime()){
					return D;
				}
			}
		}

		function dateToNoteDate(d, mask) {
			// If preferred, zeroise() can be moved out of the format() method for performance and reuse purposes
			var zeroize = function (value, length) {
				if (!length) length = 2;
				value = String(value);
				for (var i = 0, zeros = ''; i < (length - value.length); i++) {
					zeros += '0';
				}
				return zeros + value;
			};

			return mask.replace(/"[^"]*"|'[^']*'|\b(?:d{1,4}|m{1,4}|yy(?:yy)?|([hHMs])\1?|TT|tt|[lL])\b/g, function($0) {
				switch($0) {
					case 'd':	return d.getDate();
					case 'dd':	return zeroize(d.getDate());
					case 'ddd':	return ['Sun','Mon','Tue','Wed','Thr','Fri','Sat'][d.getDay()];
					case 'dddd':	return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
					case 'm':	return d.getMonth() + 1;
					case 'mm':	return zeroize(d.getMonth() + 1);
					case 'mmm':	return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
					case 'mmmm':	return ['January','February','March','April','May','June','July','August','September','October','November','December'][d.getMonth()];
					case 'yy':	return String(d.getFullYear()).substr(2);
					case 'yyyy':	return d.getFullYear();
					case 'h':	return d.getHours() % 12 || 12;
					case 'hh':	return zeroize(d.getHours() % 12 || 12);
					case 'H':	return d.getHours();
					case 'HH':	return zeroize(d.getHours());
					case 'M':	return d.getMinutes();
					case 'MM':	return zeroize(d.getMinutes());
					case 's':	return d.getSeconds();
					case 'ss':	return zeroize(d.getSeconds());
					case 'l':	return zeroize(d.getMilliseconds(), 3);
					case 'L':	var m = d.getMilliseconds();
							if (m > 99) m = Math.round(m / 10);
							return zeroize(m);
					case 'tt':	return d.getHours() < 12 ? 'am' : 'pm';
					case 'TT':	return d.getHours() < 12 ? 'AM' : 'PM';
					// Return quoted strings with the surrounding quotes removed
					default:	return $0.substr(1, $0.length - 2);
				}
			});
		}

		function encodeFileName(str){
			return escape(str).replace(/\//g, "%2F");
		}

		function decodeFileName(str){
			return unescape(str.replace(/%2F/g, "/"));
		}

		function noteFile(root, keyId, enFileName = NF_DO_ENCODE){
			try {
				var file = new FileUtils.File(root);
				if(enFileName === NF_DO_ENCODE){
					file.appendRelativePath(encodeFileName(keyId + '.xnote'));
				} else {
					file.appendRelativePath(keyId + '.xnote');
				}
				return file;
			} catch {
				return false;
			}
		}

		function getPrefs(){
			var _xnotePrefs = Services.prefs.QueryInterface(Components.interfaces.nsIPrefBranch).getBranch("extensions.xnote.");
			var defaultPrefs = getDefaultPrefs();
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

		function fileExists(file){
			return file && file.exists() && file.isFile() && file.isReadable();
		}

		function getExistingNoteFile(root, keyId){
			let file;

			if(fileExists(file = noteFile(root, keyId, NF_DO_ENCODE))){
				return file;
			}

			if(fileExists(file = noteFile(root, keyId, NF_DO_NOT_ENCODE))){
				return file;
			}

			return false;
		}

		return {
			xnote: {
				async getPrefs(){
					return getPrefs();
				},
				async saveNote(root, keyId, note){
					var file = noteFile(root, keyId);
					if(!file){
						console.error(`Can not open xnote: ${keyId}`);
						return false;
					}

					let tempFile = file.parent.clone();
					tempFile.append("~" + file.leafName + ".tmp");
					// Using 0660 instead of 0600 so that sharing notes accross users
					// within the same group is possible on Linux.
					tempFile.createUnique(tempFile.NORMAL_FILE_TYPE, parseInt("0660",8));

					let fileOutStream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);

					fileOutStream.init(tempFile, 2, 0x200, false); // Opens for writing only
					fileOutStream.write(String(note.left), 4);
					fileOutStream.write(String(note.top), 4);
					fileOutStream.write(String(note.width), 4);
					fileOutStream.write(String(note.height), 4);

					let d = dateToNoteDate(new Date(note.ts), getPrefs().dateformat || getDefaultPrefs().dateformat);
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
				async deleteNote(root, keyId){
					var file = getExistingNoteFile(root, keyId);
					try {
						file.remove(false);
						return true;
					} catch {
						return false;
					}
				},
				async loadNote(root, keyId){
					var file = getExistingNoteFile(root, keyId);
					if(!file){
						return false;
					}

					var note = {};

					var fileInStream = Components.classes['@mozilla.org/network/file-input-stream;1'].createInstance(Components.interfaces.nsIFileInputStream);
					var fileScriptableIO = Components.classes['@mozilla.org/scriptableinputstream;1'].createInstance(Components.interfaces.nsIScriptableInputStream);
					fileInStream.init(file, 0x01, parseInt("0444", 8), null);
					fileScriptableIO.init(fileInStream);

					//note.keyId = file.leafName.substring(0, file.leafName.length - 6);
					note.left = parseInt(fileScriptableIO.read(4));
					note.top = parseInt(fileScriptableIO.read(4));
					note.width = parseInt(fileScriptableIO.read(4));
					note.height = parseInt(fileScriptableIO.read(4));
					let tsPart = fileScriptableIO.read(32);
					note.ts = noteDateToDate(tsPart);
					if(note.ts){
						note.ts = note.ts.getTime();
					} else {
						note.ts = 0;
					}
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

						var fileName = decodeFileName(o.leafName);
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
