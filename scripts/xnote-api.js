var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

var getView = () => {
	return Services.wm.getMostRecentWindow("mail:3pane").gDBView;
}

var XNoteObserver = {
	observe: function(aMsgFolder, aTopic, aData) {
		if(aTopic !== "MsgCreateDBView"){
			return;
		}
		addColumnHandler();
	}
};

var columnHandler = {
	isEditable: function(row, col) {
		console.log("isEditable", row, col);
		return false;
	},
	cycleCell: function(row,col) {
		console.log("cycleCell", row, col);
	},
	getCellText: function(row, col) {
		console.log("getCellText", row, col);
		// let xnotePrefs = xnote.ns.Commons.xnotePrefs;
		// if (xnotePrefs.getIntPref("show_first_x_chars_in_col") > 0) {
		// 	let note = new xnote.ns.Note(getHeaderForRow(row).messageId);
		// 	if (note.exists()) {
		// 		return " " + note.text.substr(0,xnotePrefs.getIntPref("show_first_x_chars_in_col"));
		// 	}
		// }
		// return null;
	},
	getSortStringForRow: function(hdr) {
		console.log("getSortStringForRow", hdr);
		// let xnotePrefs = xnote.ns.Commons.xnotePrefs;
		// if (xnotePrefs.getIntPref("show_first_x_chars_in_col") > 0) {
		// 	let note = new xnote.ns.Note(hdr.messageId);
		// 	if (note.exists()) {
		// 		return " " + note.text.substr(0,xnotePrefs.getIntPref("show_first_x_chars_in_col"));
		// 	} else {
		// 		return "";
		// 	}
		// }
		// return pub.hasNote(hdr.messageId);
	},
	isString: function() {
		console.log("isString");
		return true;
	},
	getCellProperties: function(row, col, props){
		console.log("getCellProperties", row, col, props);
	},
	getRowProperties: function(row, props){
		console.log("getRowProperties", row, props);
	},
	getImageSrc: function(row, col) {
		console.log("getImageSrc", row, col);
		return extension.getURL("images/xnote_context.png");
		//return "../images/xnote_context.png";
		// let hdr = getHeaderForRow(row);
		// if(pub.hasNote(hdr.messageId)){
		// 	return "chrome://xnote/skin/xnote_context.png";
		// } else {
		// 	return null;
		// }
	},
	getSortLongForRow: function(hdr) {
		console.log("getSortLongForRow", hdr);
		//return pub.hasNote(hdr.messageId);
	}
};

// for (const node of w.document.querySelectorAll('treecol')) {
// 	if(node.getAttribute('label') == 'QNote'){
// 		console.log(node);
// 	}
// }
var addColumnHandler = () => {
	var w = Services.wm.getMostRecentWindow("mail:3pane");

	var threadCols = w.document.getElementById("threadCols");
	var xnoteCol = w.document.getElementById("xnoteCol");


	if(xnoteCol){
		console.log("xnoteCol exists", xnoteCol);
		xnoteCol.parentNode.removeChild(xnoteCol.previousSibling);
		xnoteCol.parentNode.removeChild(xnoteCol);
		try {
			getView().removeColumnHandler("xnoteCol");
		} catch (e) {
			console.log(e);
		}
	}

	var html =
		'<splitter class="tree-splitter" />' +
		'<treecol id="xnoteCol" persist="ordinal width" label="QNote" currentView="unthreaded" ' +
		'is="treecol-image" class="treecol-image xnote-column-header">' +
		'<label class="treecol-text" flex="1" crop="right" value="Q" />' +
		'</treecol>';

	threadCols.appendChild(w.MozXULElement.parseXULToFragment(html));
	console.log("firstc", html);

	getView().addColumnHandler("xnoteCol", columnHandler);
	console.log("addColumnHandler", columnHandler);
	//dbView.addColumnHandler("xnoteCol", columnHandler);
	//this.addCustomColumnHandler();
};

var xnote = class extends ExtensionCommon.ExtensionAPI {
	/*
	onShutdown(isAppShutdown) {
		if(isAppShutdown){
			return;
		}
		console.log("onShutdown", isAppShutdown);
		try {
			getView().removeColumnHandler("xnoteCol");
		} catch {
		}

		try {
			Services.obs.removeObserver(XNoteObserver, "MsgCreateDBView");
		} catch {
		}
	}
	*/
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
				__getProfilePath() {
					return Components.classes['@mozilla.org/file/directory_service;1']
						.getService(Components.interfaces.nsIProperties)
						.get('ProfD', Components.interfaces.nsIFile);
				},
				// NOTE: Seems that "yyyy-mm-dd - HH:MM" format has been hardcoded?
				decodeXNoteDate(dateString) {
					var retDate = new Date();
					let [date, time] = dateString.split(" - ");
					if(date){
						let dateParts = date.split("-");
						retDate.setFullYear(dateParts[0]);
						retDate.setMonth(dateParts[1] - 1);
						retDate.setDate(dateParts[2]);
					}

					if(time){
						let timeParts = time.split(":");
						retDate.setHours(timeParts[0]);
						retDate.setMinutes(timeParts[1]);
					}

					return retDate;
				},
				dateFormat(d, mask) {
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
				},
				async getDefaultPrefs() {
					return this.__getDefaultPrefs();
				},
				async getPrefs(){
					return this.__getPrefs();
				},
				noteFile(root, fileName){
					try {
						var file = new FileUtils.File(root);
						file.appendRelativePath(fileName);
						return file;
					} catch {
						return false;
					}
				},
				async saveNote(root, fileName, note){
					var file = this.noteFile(root, fileName);
					if(!file){
						console.error(`Can not open xnote: ${fileName}`);
						return false;
					}

					var prefs = this.__getPrefs();

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

					let d = this.dateFormat(new Date(note.ts), prefs.dateformat);
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
					var file = this.noteFile(root, fileName);
					return file && file.exists() && file.isFile();
				},
				async deleteNote(root, fileName){
					var file = this.noteFile(root, fileName);
					try {
						file.remove(false);
						return true;
					} catch {
						return false;
					}
				},
				async loadNote(root, fileName){
					var file = this.noteFile(root, fileName);
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
					note.ts = this.decodeXNoteDate(fileScriptableIO.read(32));
					note.text = decodeURIComponent(fileScriptableIO.read(file.fileSize-48));

					fileScriptableIO.close();
					fileInStream.close();

					note.text = note.text.replace(/<BR>/g,'\n');

					return note;
				},
				async getNotes(root) {
					try {
						var file = new FileUtils.File(root);
					} catch {
						console.error(`Can not open xnotes folder: ${root}`);
						return false;
					}

					var eFiles = file.directoryEntries;
					var notes = [];

					while (eFiles.hasMoreElements()) {
						var o = eFiles.getNext().QueryInterface(Components.interfaces.nsIFile);
						if(o.leafName.substring(o.leafName.length - 6) === '.xnote'){
							notes.push({
								fileName: o.leafName
							});
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
				},
				async installObserver() {
					// return;
					// var eObservers = Services.obs.enumerateObservers("MsgCreateDBView");
					// while (eObservers.hasMoreElements()) {
					// 	var o = eObservers.getNext().QueryInterface(Ci.nsIObserver);
					// 	Services.obs.removeObserver(o, "MsgCreateDBView");
					// }

					//Services.obs.addObserver(XNoteObserver, "MsgCreateDBView", false);
				},
				async uninstallObserver() {
					Services.obs.removeObserver(XNoteObserver, "MsgCreateDBView");
				}
			}
		}
	}
}

