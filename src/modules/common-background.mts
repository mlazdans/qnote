// This code should run in background and content
import { IPreferences, PrefsManager } from "./api.mjs";
import { getPropertyType, setProperty } from "./common.mjs";
import { NoteData, NoteType, QNote, QNoteFolder, XNote } from "./Note.mjs";

export interface ExportStats {
	err: number
	exist: number
	imported: number
	overwritten: number
}

var QDEB = true;
var _ = browser.i18n.getMessage;

// Prev loadPrefsWithDefaults
export async function getPrefs() {
	let p = await getSavedPrefs();
	let isEmpty = await isPrefsEmpty();
	// TODO: handle XNote prefs
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

// Load all note keys from folder, prioritizing qnote if both qnote and xnote exists
async function loadAllFolderKeys(folder: string) {
	return Promise.all([
		browser.xnote.getAllKeys(folder),
		browser.qnote.getAllKeys(folder)
	]).then(values => {
		return Object.assign(values[0], values[1]);
	});
}

export async function loadAllFolderNotes(folder: string): Promise<Array<NoteData>> {
	return loadAllFolderKeys(folder).then(async keys => {
		let Notes = [];
		for(let keyId of keys){
			let note = new QNoteFolder(keyId, folder);
			await note.load();
			Notes.push(note.data);
		}
		return Notes;
	});
}

async function importQNotes(notes: Array<NoteData>, overwrite = false){
	let stats = {
		err: 0,
		exist: 0,
		imported: 0,
		overwritten: 0
	};

	for (const note of notes) {
		let yn = new QNote(note.keyId);

		await yn.load();

		let exists = yn.data.exists;

		if(exists && !overwrite){
			stats.exist++;
		} else {
			yn.data = note;
			await yn.save().then(() => {
				stats[exists ? "overwritten" : "imported"]++;
			}).catch(e => {
				console.error(_("error.saving.note"), e.message, yn.data.keyId);
				stats.err++;
			});
		}
	}

	return stats;
}

export async function importFolderNotes(root: string, overwrite = false){
	return loadAllFolderNotes(root).then(notes => importQNotes(notes, overwrite));
}

async function exportNotesToFolder(root: string, type: NoteType, notes: Array<NoteData>, overwrite: boolean) {
	let stats: ExportStats = {
		err: 0,
		exist: 0,
		imported: 0,
		overwritten: 0
	};

	for (const note of notes) {
		let yn;
		if(type == "xnote"){
			yn = new XNote(note.keyId, root);
		} else {
			yn = new QNoteFolder(note.keyId, root);
		}

		await yn.load();

		if(yn.data.exists && !overwrite){
			stats.exist++;
		} else {
			yn.data =  note;
			await yn.save().then(() => {
				stats[yn.data.exists ? "overwritten" : "imported"]++;
			}).catch(e => {
				console.error(_("error.saving.note"), e.message, yn.keyId);
				stats.err++;
			});
		}
	}

	return stats;
}

// Load all note keys from local storage
async function loadAllExtKeys() {
	return browser.storage.local.get().then(storage => {
		let keys = [];
		for(let keyId in storage){
			if(keyId.substr(0, 5) !== 'pref.') {
				keys.push(keyId);
			}
		}
		return keys;
	});
}

async function loadAllExtNotes(): Promise<Array<NoteData>> {
	return loadAllExtKeys().then(async keys => {
		let Notes = [];
		for(let keyId of keys){
			let note = new QNote(keyId);
			await note.load();
			Notes.push(note.data);
		}
		return Notes;
	});
}

export async function exportQAppNotesToFolder(root: string, type: NoteType, overwrite: boolean, prefs: IPreferences) {
	if(prefs.storageOption == 'folder'){
		return loadAllFolderNotes(prefs.storageFolder).then(notes => exportNotesToFolder(root, type, notes, overwrite));
	} else {
		return loadAllExtNotes().then(notes => exportNotesToFolder(root, type, notes, overwrite));
	}
}

export async function clearPrefs() {
	let p = [];
	for(let k in PrefsManager.defaults){
		p.push(browser.storage.local.remove('pref.' + k));
	}

	return Promise.all(p);
}

// function resetTbState(){
export async function updateTabMenusAndIcons(){
	browser.menus.removeAll();
	getCurrentTabIdAnd().then(tabId => updateIcons(false, tabId));
}

export async function updateIcons(on: boolean, tabId?: number){
	let icon = on ? "images/icon.svg" : "images/icon-disabled.svg";

	let BrowserAction = browser.action ? browser.action : browser.browserAction;

	BrowserAction.setIcon({
		path: icon,
		tabId: tabId
	});

	browser.messageDisplayAction.setIcon({
		path: icon,
		tabId: tabId
	});
}

export async function mpUpdateForNote(note: NoteData){
	// Marks icons active
	updateIcons(note.exists);
	browser.qapp.saveNoteCache(note);
	browser.qapp.updateColumsView();
	getCurrentWindowIdAnd().then(windowId => browser.qapp.attachNoteToMessage(windowId, note));
}

async function getCurrentWindow(){
	return browser.windows.getCurrent();
}

export async function getCurrentWindowId(){
	return getCurrentWindow().then(Window => {
		return Window.id;
	});
}

export async function getCurrentWindowIdAnd(): Promise<number> {
	return new Promise(async resolve => {
		return getCurrentWindowId().then(windowId => {
			if(windowId)resolve(windowId);
		});
	});
}

export async function getCurrentTab(){
	return browser.tabs.getCurrent();
}

export async function getCurrentTabId(){
	return getCurrentTab().then(Tab => {
		if(Tab?.id){
			return Tab.id;
		} else {
			return getCurrentWindowIdAnd().then(windowId => getWindowActiveTab(windowId).then(Tab => Tab?.id));
		}
	});

	// var Tab;
	// if(Tab = await getCurrentTab()){
	// 	return Tab.id;
	// } else {
	// 	const windowId = await getCurrentWindowId();
	// 	if(windowId){
	// 		if(Tab = await getWindowActiveTab(windowId)){
	// 			return Tab.id;
	// 		}
	// 	}
	// }

	// return undefined;
	// return .then(async Tab => Tab ? Tab.id : await getWindowActiveTab(CurrentWindowId)));
}

async function getWindowActiveTab(windowId: number){
	return browser.windows.get(windowId, { populate: true }).then(Window => {
		if(Window.tabs){
			for(let t of Window.tabs){
				if(t.active){
					return t;
				}
			}
		}
		return undefined;
	});
}

export async function getCurrentTabIdAnd(): Promise<number> {
	return new Promise(async resolve => {
		return getCurrentTabId().then(tabId => {
			if(tabId)resolve(tabId);
		});
	});
}

// We call this after options has been changed
export async function sendPrefsToQApp(prefs: IPreferences){
	browser.qapp.setPrefs({
		storageOption: prefs.storageOption,
		storageFolder: prefs.storageFolder,
		showFirstChars: prefs.showFirstChars,
		printAttachTop: prefs.printAttachTop,
		printAttachBottom: prefs.printAttachBottom,
		messageAttachTop: prefs.messageAttachTop,
		messageAttachBottom: prefs.messageAttachBottom,
		attachTemplate: prefs.attachTemplate,
		treatTextAsHtml: prefs.treatTextAsHtml,
	});
}

export async function savePrefs(p: IPreferences) {
	let k: keyof typeof p;

	for(k in p){
		await browser.storage.local.set({
			['pref.' + k]: p[k]
		});
	}
}

async function saveSinglePref(k: keyof IPreferences, v: any) {
	return browser.storage.local.set({
		['pref.' + k]: v
	});
}

export async function isPrefsEmpty(): Promise<boolean> {
	let p = PrefsManager.defaults;
	let k: keyof typeof p;

	for(k in p){
		const v = await browser.storage.local.get('pref.' + k);
		if(v['pref.' + k] !== undefined){
			return false;
		}
	}

	return true;
}

export async function getSavedPrefs(){
	let p = PrefsManager.defaults;
	let k: keyof typeof p;

	for(k in p){
		const v = await browser.storage.local.get('pref.' + k);
		if(v['pref.' + k] !== undefined){
			const type = getPropertyType(p, k);
			if(type === "number"){
				setProperty(p, k, Number(v));
			} else if(typeof v === "boolean"){
				setProperty(p, k, Boolean(v));
			} else if(typeof v === "string"){
				setProperty(p, k, String(v));
			} else {
				console.error(`Unsupported preference type: ${type} for key ${k}`);
			}
		}
	}

	return p;
}
