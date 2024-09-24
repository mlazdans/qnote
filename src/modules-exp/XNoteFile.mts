import { INoteData } from "../modules/Note.mjs";
import { IXNotePreferences, setProperty } from "../modules/common.mjs";
import { INoteFileAPI, INoteFileProvider } from "./api.mjs";

var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");

const NF_DO_ENCODE = 1;
const NF_DO_NOT_ENCODE = 0;

export interface IXNoteFileAPI extends INoteFileAPI<XNoteFile> {
	getPrefs(): Promise<Partial<IXNotePreferences>>
	getStoragePath(path?: string | null): Promise<string>
}

export class XNoteFile implements INoteFileProvider {
	getDefaultPrefs(): IXNotePreferences {
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

	// Seems that "yyyy-mm-dd - HH:MM" format has been hardcoded for some time?
	noteDateToDate(dateString: string): Date | undefined {
		let dateParsers = [
			// "yyyy-mm-dd - HH:MM"
			(ds: string) => {
				let D = new Date();
				let [date, time] = ds.split(" - ");

				if(date){
					let dateParts = date.split("-");
					D.setFullYear(parseInt(dateParts[0]));
					D.setMonth(parseInt(dateParts[1]) - 1);
					D.setDate(parseInt(dateParts[2]));
				}

				if(time){
					let timeParts = time.split(":");
					D.setHours(parseInt(timeParts[0]));
					D.setMinutes(parseInt(timeParts[1]));
				}

				return D;
			},
			// "dd/mm/yyyy - HH:MM"
			(ds: string) => {
				let D = new Date();
				let [date, time] = ds.split(" - ");

				if(date){
					let dateParts = date.split("/");
					D.setFullYear(parseInt(dateParts[2]));
					D.setMonth(parseInt(dateParts[1]) - 1);
					D.setDate(parseInt(dateParts[0]));
				}

				if(time){
					let timeParts = time.split(":");
					D.setHours(parseInt(timeParts[0]));
					D.setMinutes(parseInt(timeParts[1]));
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

		return undefined;
	}

	dateToNoteDate(d: Date, mask: string) {
		// If preferred, zeroise() can be moved out of the format() method for performance and reuse purposes
		var zeroize = function (value: any, length?: number): string {
			if (!length) length = 2;
			value = String(value);
			for (var i = 0, zeros = ''; i < (length - value.length); i++) {
				zeros += '0';
			}
			return zeros + value;
		};

		return mask.replace(/"[^"]*"|'[^']*'|\b(?:d{1,4}|m{1,4}|yy(?:yy)?|([hHMs])\1?|TT|tt|[lL])\b/g, function($0: string): string {
			switch($0) {
				case 'd':	return d.getDate().toString();
				case 'dd':	return zeroize(d.getDate());
				case 'ddd':	return ['Sun','Mon','Tue','Wed','Thr','Fri','Sat'][d.getDay()];
				case 'dddd':	return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
				case 'm':	return (d.getMonth() + 1).toString();;
				case 'mm':	return zeroize(d.getMonth() + 1);
				case 'mmm':	return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
				case 'mmmm':	return ['January','February','March','April','May','June','July','August','September','October','November','December'][d.getMonth()];
				case 'yy':	return String(d.getFullYear()).substring(2);
				case 'yyyy':	return d.getFullYear().toString();
				case 'h':	return (d.getHours() % 12 || 12).toString();;
				case 'hh':	return zeroize(d.getHours() % 12 || 12);
				case 'H':	return d.getHours().toString();;
				case 'HH':	return zeroize(d.getHours());
				case 'M':	return d.getMinutes().toString();;
				case 'MM':	return zeroize(d.getMinutes());
				case 's':	return d.getSeconds().toString();;
				case 'ss':	return zeroize(d.getSeconds());
				case 'l':	return zeroize(d.getMilliseconds(), 3);
				case 'L':	var m = d.getMilliseconds();
						if (m > 99) m = Math.round(m / 10);
						return zeroize(m);
				case 'tt':	return d.getHours() < 12 ? 'am' : 'pm';
				case 'TT':	return d.getHours() < 12 ? 'AM' : 'PM';
				// Return quoted strings with the surrounding quotes removed
				default:	return $0.substring(1, $0.length - 2);
			}
		});
	}

	encodeFileName(str: string){
		return escape(str).replace(/\//g, "%2F");
	}

	decodeFileName(str: string){
		return unescape(str.replace(/%2F/g, "/"));
	}

	noteFile(root: string, keyId: string, enFileName = NF_DO_ENCODE){
		try {
			var file = new FileUtils.File(root);
			if(enFileName === NF_DO_ENCODE){
				file.appendRelativePath(this.encodeFileName(keyId + '.xnote'));
			} else {
				file.appendRelativePath(keyId + '.xnote');
			}
			return file;
		} catch {
			return false;
		}
	}

	getPrefs(){
		const pi = Services.prefs.QueryInterface(Ci.nsIPrefBranch).getBranch("extensions.xnote.");
		const defaultPrefs = this.getDefaultPrefs();
		const prefs = {} as Partial<IXNotePreferences>;

		for(const _k of Object.keys(defaultPrefs)){
			if(!pi.prefHasUserValue(_k)){
				continue;
			}

			const k = _k as keyof IXNotePreferences;
			const t = typeof defaultPrefs[k];

			if(t === 'boolean'){
				setProperty(prefs, k, pi.getBoolPref(k));
			} else if(t === 'string'){
				setProperty(prefs, k, pi.getCharPref(k));
			} else if(t === 'number'){
				setProperty(prefs, k, pi.getIntPref(k));
			} else {
				console.error(`[qnote:xnote] BUG: unsupported preference type: ${t}, key: ${k}`);
			}
		}

		return prefs;
	}

	fileExists(file: any){
		return file && file.exists();
	}

	getExistingFile(root: string, keyId: string){
		let file;

		if(this.fileExists(file = this.noteFile(root, keyId, NF_DO_ENCODE))){
			return file;
		}

		if(this.fileExists(file = this.noteFile(root, keyId, NF_DO_NOT_ENCODE))){
			return file;
		}

		return false;
	}

	save(root: string, keyId: string, note: INoteData){
		var file = this.noteFile(root, keyId);

		let tempFile = file.parent.clone();
		tempFile.append("~" + file.leafName + ".tmp");
		// Using 0660 instead of 0600 so that sharing notes accross users
		// within the same group is possible on Linux.
		tempFile.createUnique(tempFile.NORMAL_FILE_TYPE, parseInt("0660",8));

		let fileOutStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);

		// fileOutStream.init(tempFile, 2, 0x200, false); // Opens for writing only
		fileOutStream.init(tempFile, 2, 0x200, 0); // false can't be used as number? TODO: test
		fileOutStream.write(String(note.left), 4);
		fileOutStream.write(String(note.top), 4);
		fileOutStream.write(String(note.width), 4);
		fileOutStream.write(String(note.height), 4);

		let ts = note.ts ? new Date(note.ts) : new Date();
		let d = this.dateToNoteDate(ts, this.getPrefs().dateformat || this.getDefaultPrefs().dateformat);
		fileOutStream.write(d, 32);

		let text = note.text ? note.text.replace(/\n/g,'<BR>') : "";
		let contentencode = encodeURIComponent(text);
		fileOutStream.write(contentencode, contentencode.length);

		fileOutStream.close();

		tempFile.moveTo(null, file.leafName);
	}

	delete(root: string, keyId: string){
		const file = this.getExistingFile(root, keyId);
		if(file){
			file.remove(false);
		}
	}

	load(root: string, keyId: string): INoteData | null {
		var file = this.getExistingFile(root, keyId);

		if(!file){
			return null;
		}

		var fileInStream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
		var fileScriptableIO = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
		fileInStream.init(file, 0x01, parseInt("0444", 8), null);
		fileScriptableIO.init(fileInStream);

		//note.keyId = file.leafName.substring(0, file.leafName.length - 6);
		const note: INoteData = {};
		note.left = parseInt(fileScriptableIO.read(4));
		note.top = parseInt(fileScriptableIO.read(4));
		note.width = parseInt(fileScriptableIO.read(4));
		note.height = parseInt(fileScriptableIO.read(4));
		let tsPart = fileScriptableIO.read(32);
		let d = this.noteDateToDate(tsPart);
		if(d){
			note.ts = d.getTime();
		} else {
			note.ts = 0;
		}
		note.text = decodeURIComponent(fileScriptableIO.read(file.fileSize-48));

		fileScriptableIO.close();
		fileInStream.close();

		note.text = note.text.replace(/<BR>/g,'\n');

		return note;
	}

	getAllKeys(root: string) {
		var file = new FileUtils.File(root);
		var eFiles = file.directoryEntries;
		var notes = [];

		while (eFiles.hasMoreElements()) {
			var o = eFiles.getNext().QueryInterface(Ci.nsIFile);

			var fileName = this.decodeFileName(o.leafName);
			if(fileName.substring(fileName.length - 6) === '.xnote'){
				notes.push(fileName.substring(0, fileName.length - 6));
			}
		}

		return notes;
	}

	getProfilePath() {
		return Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get('ProfD', Ci.nsIFile);
	}

	getStoragePath(path: string | null) {
		let prof = this.getProfilePath();

		if(path){
			if(path.startsWith("[ProfD]")) {
				prof.appendRelativePath(path.substring(7));
			} else {
				return path;
			}
		} else {
			prof.append('XNote');
		}

		return prof.path;
	}
};
