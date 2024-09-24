// This code should run in background and content
import { getPropertyType, convertPrefsToQAppPrefs, setProperty, IPreferences, IWritablePreferences, Prefs, xnotePrefsMapper } from "./common.mjs";
import { INoteData, QNoteFolder, QNoteLocalStorage, XNoteFolder } from "./Note.mjs";

let QDEB = true;
const debugHandle = "[qnote:common-background]";
const _ = browser.i18n.getMessage;

export type NoteDataMap = Map<string, INoteData>
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
	const savedPrefs = await getSavedPrefs();
	const prefs: IWritablePreferences = Object.assign({}, Prefs.defaults, savedPrefs);
	const isEmpty = Object.keys(savedPrefs).length === 0;

	QDEB&&console.group("getPrefs()");
	QDEB&&console.debug("savedPrefs", savedPrefs);
	QDEB&&console.debug("prefs", prefs);
	QDEB&&console.debug("isEmpty?", isEmpty);

	if(isEmpty){
		QDEB&&console.log(`No saved preferences, fallback to defaults`);

		// Set xnote prefs
		Object.assign(prefs, xnotePrefsMapper(await browser.xnote.getPrefs()));

		if(prefs.tagName){
			prefs.tagName = prefs.tagName.toLowerCase();
		}

		// Override old XNote default "yyyy-mm-dd - HH:MM"
		if(prefs.dateFormat === "yyyy-mm-dd - HH:MM"){
			prefs.dateFormat = 'Y-m-d H:i';
		}
	}

	if(!prefs.storageOption || !prefs.storageFolder) {
		prefs.storageOption = 'folder';
		prefs.storageFolder = await browser.qapp.createStoragePath();
		QDEB&&console.debug("Set prefs.storageFolder to default:", prefs.storageFolder);
	}

	QDEB&&console.groupEnd();

	return prefs;
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
			let data = await (new QNoteFolder(keyId, folder)).load();

			// Try .xnote
			if(!data){
				data = await (new XNoteFolder(keyId, folder)).load();
			}

			Notes.set(keyId, data);
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

	for(const [keyId, data] of importNotes.entries()){
		let N = ctor(keyId);
		await N.load().then(async oldData => {
			if(oldData && !overwrite){
				stats.existing++;
			} else {
				N.assignData(data);
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
			Notes.set(keyId, note.getData());
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

export async function getCurrentWindowId(){
	return browser.windows.getCurrent().then(Window => Window.id);
}

export async function getCurrentTabId(){
	return browser.tabs.getCurrent().then(tab => {
		if(tab?.id){
			return tab.id;
		} else {
			return browser.windows.getCurrent({ populate: true }).then(window => {
				if(window.tabs){
					for(const t of window.tabs){
						if(t.active){
							return t.id;
						}
					}
				}
				return undefined;
			});
		}
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

export function isClipboardSet(content: INoteData | null): content is INoteData {
	return content && content.text && content.text.trim ? content.text.trim().length > 0 : false;
}

export async function confirmDelete(): Promise<boolean> {
	return browser.legacy.confirm(_("delete.note"), _("are.you.sure"));
}
