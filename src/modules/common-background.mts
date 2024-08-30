import { Preferences } from "./api.mjs";
import { dateFormat, getPrefs, isPrefsEmpty } from "./common.mjs";

var QDEB = true;
var _ = browser.i18n.getMessage;

// This code should run in background and content
export async function loadPrefsWithDefaults() {
	let p = await getPrefs();
	let isEmpty = await isPrefsEmpty();
	// let defaultPrefs = getDefaultPrefs();
	// let isEmptyPrefs = Object.keys(p).length === 0;

	// Check for xnote settings if no settings at all
	// if(isEmptyPrefs){
	// 	let l = xnotePrefsMapper(await browser.xnote.getPrefs());
	// 	for(let k in defaultPrefs){
	// 		if(l[k] === undefined){
	// 			p[k] = defaultPrefs[k];
	// 		} else {
	// 			p[k] = l[k];
	// 		}
	// 	}
	// }

	// Apply defaults
	// for(let k in defaultPrefs){
	// 	if(p[k] === undefined){
	// 		p[k] = defaultPrefs[k];
	// 	}
	// }

	if(p.tagName){
		p.tagName = p.tagName.toLowerCase();
	}

	if(isEmpty){
		// If XNote++ storage_path is set and readable, then use it
		// else check if XNote folder exists inside profile directory
		let path = await getXNoteStoragePath();

		if(await isFolderWritable(path)){
			p.storageOption = 'folder';
			p.storageFolder = path;
		} else {
			path = await browser.qapp.createStoragePath();
			if(await isFolderWritable(path)){
				p.storageOption = 'folder';
				p.storageFolder = path;
			} else {
				browser.legacy.alert(_("could.not.initialize.storage.folder"));
				p.storageOption = 'ext';
			}
		}
	}

	// Override old default "yyyy-mm-dd - HH:MM"
	if(p.dateFormat === "yyyy-mm-dd - HH:MM"){
		p.dateFormat = 'Y-m-d H:i';
	}

	return p;
}

export async function getXNoteStoragePath(): Promise<string> {
	let xnotePrefs = await browser.xnote.getPrefs();

	if(xnotePrefs.storage_path){
		QDEB&&console.debug("XNote++ storage folder setting found:", xnotePrefs.storage_path);

		let path = await browser.xnote.getStoragePath(xnotePrefs.storage_path);

		if(await isFolderWritable(path)){
			return path;
		} else {
			QDEB&&console.debug("XNote++ storage folder not writable: ", path);
		}
	}

	return await browser.xnote.getStoragePath();
}

async function isReadable(path: string){
	return await browser.legacy.isReadable(path);
}

async function isFolderReadable(path: string){
	return await browser.legacy.isFolderReadable(path);
}

export async function isFolderWritable(path: string){
	return await browser.legacy.isFolderWritable(path);
}

// TODO: cleanup this mess with date functions
export function qDateFormatPredefined(format: string, ts: Date, prefs: Preferences){
	if(prefs.dateLocale){
		try {
			return dateFormatPredefined(prefs.dateLocale, format, ts);
		} catch {
		}
	}

	return dateFormatPredefined(browser.i18n.getUILanguage(), format, ts);
}

function dateFormatPredefined(locale: string, format: string, ts: Date) {
	console.error("TODO: dateFormatPredefined");
	return "";
	// return luxon.DateTime.fromJSDate(ts2jsdate(ts)).setLocale(locale).toFormat(format);
}

function _qDateFormat(locale: string, ts: number, prefs: Preferences){
	if(prefs.dateFormatPredefined){
		return dateFormatPredefined(locale, prefs.dateFormatPredefined, new Date(ts));
	} else {
		if(prefs.dateFormat){
			return dateFormat(locale, prefs.dateFormat, new Date(ts));
		} else {
			return dateFormatPredefined(locale, 'DATETIME_FULL_WITH_SECONDS', new Date(ts));
		}
	}
}

function qDateFormat(ts: number, prefs: Preferences){
	if(prefs.dateLocale){
		try {
			return _qDateFormat(prefs.dateLocale, ts, prefs);
		} catch {
		}
	}

	return _qDateFormat(browser.i18n.getUILanguage(), ts, prefs);
}
