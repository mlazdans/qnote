// This code should run in background and content
import { IPreferences, IWritablePreferences, Prefs } from "./api.mjs";
import { getPropertyType, convertPrefsToQAppPrefs, setProperty } from "./common.mjs";
import { NoteData, QNoteFolder, QNoteLocalStorage, XNoteFolder } from "./Note.mjs";

let QDEB = true;
const debugHandle = "[qnote:common-background]";
const _ = browser.i18n.getMessage;

export type NoteDataMap = Map<string, NoteData>
export interface ExportStats {
	errored: number
	existing: number
	imported: number
	overwritten: number
}

type SaveNotesAsArgs =  typeof QNoteFolder | typeof XNoteFolder | typeof QNoteLocalStorage extends infer R ?
	R extends typeof QNoteFolder | typeof XNoteFolder
		? [instanceType: R, importNotes: NoteDataMap, overwrite: boolean, root: string]
		: R extends typeof QNoteLocalStorage
			? [instanceType: R, importNotes: NoteDataMap, overwrite: boolean]
			: never
		: never
;

export async function getPrefs(): Promise<IPreferences> {
	const fName = "getPrefs()";
	const prefs = await getSavedPrefs();
	const retPrefs: IWritablePreferences = structuredClone(Prefs.defaults);

	const isEmpty = Object.keys(prefs).length === 0;

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

	if(isEmpty){
		QDEB&&console.debug(`${fName} - preferences is empty`);
		// If XNote++ storage_path is set and readable, then use it
		// else check if XNote folder exists inside profile directory
		let path = await getXNoteStoragePath();

		if(await browser.legacy.isFolderWritable(path)){
			retPrefs.storageOption = 'folder';
			retPrefs.storageFolder = path;
		} else {
			path = await browser.qapp.createStoragePath();
			if(await browser.legacy.isFolderWritable(path)){
				retPrefs.storageOption = 'folder';
				retPrefs.storageFolder = path;
			} else {
				browser.legacy.alert(_("could.not.initialize.storage.folder"));
				retPrefs.storageOption = 'ext';
			}
		}
	} else {
		QDEB&&console.debug(`${fName} - loading preferences`);
		// Apply to defaults
		Object.assign(retPrefs, prefs);
	}

	if(retPrefs.tagName){
		retPrefs.tagName = retPrefs.tagName.toLowerCase();
	}

	// Override old XNote default "yyyy-mm-dd - HH:MM"
	if(retPrefs.dateFormat === "yyyy-mm-dd - HH:MM"){
		retPrefs.dateFormat = 'Y-m-d H:i';
	}

	return retPrefs;
}

export async function getXNoteStoragePath(): Promise<string> {
	const xnotePrefs = await browser.xnote.getPrefs();

	if(xnotePrefs.storage_path){
		QDEB&&console.debug(`${debugHandle} XNote++ storage folder setting found: ${xnotePrefs.storage_path}`);

		const path = await browser.xnote.getStoragePath(xnotePrefs.storage_path);

		if(await browser.legacy.isFolderWritable(path)){
			return path;
		} else {
			QDEB&&console.debug(`${debugHandle} XNote++ storage folder not writable: ${path}`);
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

// Load all note keys from folder, prioritizing qnote if both qnote and xnote exists
async function loadAllFolderKeys(folder: string) {
	return Promise.all([
		browser.xnote.getAllKeys(folder),
		browser.qnote.getAllKeys(folder)
	]).then(values => {
		return Object.assign(values[0], values[1]);
	});
}

export async function loadAllFolderNotes(folder: string): Promise<NoteDataMap> {
	return loadAllFolderKeys(folder).then(async keys => {
		const Notes = new Map;
		for(const keyId of keys){
			let note = new QNoteFolder(keyId, folder);
			await note.load();
			Notes.set(keyId, note.data);
		}
		return Notes;
	});
}

export async function saveNotesAs(...[instanceType, importNotes, overwrite, root]: SaveNotesAsArgs): Promise<ExportStats>{
	let stats: ExportStats = {
		errored: 0,
		existing: 0,
		imported: 0,
		overwritten: 0
	};

	function ctor(keyId: string){
		if(root && (instanceType == QNoteFolder || instanceType == XNoteFolder)){
			return new instanceType(keyId, root);
		} else if(instanceType == QNoteLocalStorage) {
			return new instanceType(keyId);
		} else {
			throw new Error(`${debugHandle} unreachable`);
		}
	}

	for(const [keyId, note] of importNotes.entries()){
		let N = ctor(keyId);
		await N.load().then(async oldData => {
			if(oldData && !overwrite){
				stats.existing++;
			} else {
				N.data =  note;
				return N.save().then(() => {
					stats[oldData ? "overwritten" : "imported"]++;
				}).catch(e => {
					console.error(_("error.saving.note"), keyId, e.message);
					stats.errored++;
				});
			}
		});
	}

	return stats;
}

// Load all note keys from local storage
async function loadAllExtKeys() {
	return browser.storage.local.get().then(storage => {
		let keys = [];
		for(let keyId in storage){
			if(keyId.substring(0, 5) !== 'pref.') {
				keys.push(keyId);
			}
		}
		return keys;
	});
}

export async function loadAllExtNotes(): Promise<NoteDataMap> {
	return loadAllExtKeys().then(async keys => {
		const Notes = new Map;
		for(const keyId of keys){
			let note = new QNoteLocalStorage(keyId);
			await note.load();
			Notes.set(keyId, note.data);
		}
		return Notes;
	});
}

export async function clearPrefs() {
	let p = [];
	for(const k in Prefs.defaults){
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

export async function mpUpdateForNote(keyId: string, note: NoteData | null){
	// Marks icons active
	updateIcons(!!note);

	if(note) {
		browser.qapp.saveNoteCache(keyId, note);
		// getCurrentWindowIdAnd().then(windowId => browser.qapp.attachNoteToMessage(windowId, note));
	}

	browser.qapp.updateColumsView();
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
	browser.qapp.setPrefs(convertPrefsToQAppPrefs(prefs));
}

export async function savePrefs(p: Partial<IPreferences>) {
	let k: keyof typeof p;

	for(k in p){
		await browser.storage.local.set({
			['pref.' + k]: p[k]
		});
	}
}

async function getSavedPrefs(): Promise<Partial<IPreferences>> {
	let ret: Partial<IWritablePreferences> = {}
	let k: keyof typeof Prefs.defaults;

	for(k in Prefs.defaults){
		const v = await browser.storage.local.get('pref.' + k);
		if(v['pref.' + k] !== undefined){
			const val = v['pref.' + k];
			const type = getPropertyType(Prefs.defaults, k);
			if(type === "number"){
				setProperty(ret, k, Number(val));
			} else if(type === "boolean"){
				setProperty(ret, k, Boolean(val));
			} else if(type === "string"){
				setProperty(ret, k, String(val));
			} else {
				console.error(`Unsupported preference type: ${type} for key ${k}`);
			}
		}
	}

	return ret;
}
