import { DOMLocalizator } from "../modules/DOMLocalizator.mjs";
import { getElementByIdOrDie, HTMLInputCheckboxElement, HTMLInputFileElement, isInputElement, isSelectElement, isTextAreaElement, isTypeCheckbox, isTypeRadio, querySelectorOrDie, IPreferences, IWritablePreferences, LuxonDateFormatsMap, Prefs } from "../modules/common.mjs";
import { ExportStats, getPrefs, getXNoteStoragePath, loadAllExtNotes, loadAllFolderNotes, saveNotesAs, savePrefs } from "../modules/common-background.mjs";
import * as luxon from "../modules/luxon.mjs";
import { QNoteFolder, QNoteLocalStorage, XNoteFolder } from "../modules/Note.mjs";
import { PrefsUpdated } from "../modules/Messages.mjs";

let backgroundPort: browser.runtime.Port;
let isConnected: boolean;
connectToBackground();

let QDEB                        = true;
const debugHandle               = "[qnote:options]";
const i18n                      = new DOMLocalizator(browser.i18n.getMessage);
const importFolderButton        = getElementByIdOrDie("importFolderButton") as HTMLButtonElement;
const importFolderLoader        = getElementByIdOrDie("importFolderLoader");
const resetDefaultsButton       = getElementByIdOrDie("resetDefaultsButton") as HTMLButtonElement;
const clearStorageButton        = getElementByIdOrDie("clearStorageButton") as HTMLButtonElement;
const exportStorageButton       = getElementByIdOrDie("exportStorageButton");
const importFile                = getElementByIdOrDie("importFile") as HTMLInputFileElement;
const storageFolderBrowseButton = getElementByIdOrDie("storageFolderBrowseButton");
const input_storageFolder       = getElementByIdOrDie("input_storageFolder") as HTMLInputElement;
const overwriteExistingNotes    = getElementByIdOrDie("overwriteExistingNotes") as HTMLInputCheckboxElement;
const errorBox                  = getElementByIdOrDie("options-error-box") as HTMLDialogElement;
const posGrid                   = getElementByIdOrDie("posGrid");
const storageFieldset_folder    = getElementByIdOrDie("storageFieldset_folder");
const exportQNotesButton        = getElementByIdOrDie("exportQNotesButton") as HTMLButtonElement;
const exportXNotesButton        = getElementByIdOrDie("exportXNotesButton") as HTMLButtonElement;
const attachTemplate            = getElementByIdOrDie("attachTemplate") as HTMLTextAreaElement;
const resetTemplate             = getElementByIdOrDie("resetTemplate");
const anchorPlacement           = getElementByIdOrDie("anchorPlacement") as HTMLInputElement;

const dateFormats: LuxonDateFormatsMap = new Map;

dateFormats.set('datetime_group', [
	'DATETIME_FULL',
	'DATETIME_FULL_WITH_SECONDS',
	// 'DATETIME_HUGE',
	// 'DATETIME_HUGE_WITH_SECONDS',
	'DATETIME_MED',
	'DATETIME_MED_WITH_SECONDS',
	'DATETIME_MED_WITH_WEEKDAY',
	'DATETIME_SHORT',
	'DATETIME_SHORT_WITH_SECONDS',
])

dateFormats.set('date_group', [
	'DATE_FULL',
	'DATE_HUGE',
	'DATE_MED',
	'DATE_MED_WITH_WEEKDAY',
	'DATE_SHORT',
])

dateFormats.set('time_group', [
	'TIME_24_SIMPLE',
	// 'TIME_24_WITH_LONG_OFFSET',
	'TIME_24_WITH_SECONDS',
	'TIME_24_WITH_SHORT_OFFSET',
	'TIME_SIMPLE',
	// 'TIME_WITH_LONG_OFFSET',
	'TIME_WITH_SECONDS',
	'TIME_WITH_SHORT_OFFSET'
])

function setLabelColor(forE: string, color: string): void {
	(querySelectorOrDie('label[for=' + forE + ']') as HTMLLabelElement).style.color = color;
}

// async function saveOptionsDefaultHandler(prefs: IPreferences) {
// 	ext.CurrentNote && await ext.CurrentNote.silentlyPersistAndClose();

// 	let oldPrefs = Object.assign({}, ext.Prefs);

// 	ext.Prefs = await ext.loadPrefsWithDefaults();

// 	// Storage option changed
// 	if(prefs.storageOption !== oldPrefs.storageOption){
// 		await ext.browser.qapp.clearNoteCache();
// 	}

// 	// Folder changed
// 	if(prefs.storageFolder !== oldPrefs.storageFolder){
// 		await ext.browser.qapp.clearNoteCache();
// 	}

// 	await ext.setUpExtension();
// 	initOptionsPageValues();

// 	return true;
// };

function displayErrors(msgs: Array<string>){
	displayMsg(msgs, i18n._('error'));
}

function displayMsg(msgs: Array<string>, title: string){
	const closeButton = querySelectorOrDie(".qpopup-title-closebutton", errorBox);
	const titleBox = querySelectorOrDie(".qpopup-title-text", errorBox);
	const errorContent = querySelectorOrDie(".qnote-text", errorBox);

	titleBox.innerHTML = title;
	errorContent.innerHTML = msgs.join("<br>");

	closeButton.addEventListener("click", () => {
		errorBox.close();
	});

	errorBox.showModal();
}

async function getPrefFromHtml<K extends keyof Partial<IPreferences>>(key: K): Promise<IPreferences[K]> {
	return new Promise((resolve, reject) => {
		for(const node of document.querySelectorAll(`[name=${key}]`)){
			if(isTypeCheckbox(node)){
				return resolve(node.checked as IPreferences[K]);
			} else if(isInputElement(node) || isSelectElement(node) || isTextAreaElement(node)){
				const readyToReturn = isTypeRadio(node) ? node.checked : true;
				if(readyToReturn){
					const type = typeof Prefs.defaults[key];
					if(type == "string"){
						return resolve(node.value as IPreferences[K]);
					} else if(type == "number"){
						return resolve(Number(node.value) as IPreferences[K]);
					} else {
						return reject(`Unsupported type: ${type} for preference: ${key} from element: ${node.nodeName}.`);
					}
				}
			} else {
				return reject(`Unsupported element: ${node.nodeName}`);
			}
		}

		return reject(`Element(s) by name not found: ${key}`);
	});
}

async function setPrefFromHtml<K extends keyof Partial<IPreferences>>(p: Partial<IPreferences>, key: K): Promise<IPreferences[K]> {
	return getPrefFromHtml(key).then(v => {
		return p[key] = v;
	});
}

function connectToBackground() {
	backgroundPort = browser.runtime.connect();
	isConnected = true;
	backgroundPort.onDisconnect.addListener(data => {
		console.log(`${debugHandle} onDisconnect`, backgroundPort);
		isConnected = false;
	});
}

async function saveOption(name: keyof IPreferences){
	QDEB&&console.debug(`${debugHandle} saving option ${name}`);

	const newPrefs: Partial<IWritablePreferences> = {};
	const ErrMsg: Array<string> = [];
	await setPrefFromHtml(newPrefs, name);

	// await Promise.all([
	// 	setPrefFromHtml(prefs, "anchorPlacement"),
	// 	setPrefFromHtml(prefs, "windowOption"),
	// 	setPrefFromHtml(prefs, "anchor"),
	// 	setPrefFromHtml(prefs, "width"),
	// 	setPrefFromHtml(prefs, "height"),
	// 	setPrefFromHtml(prefs, "alwaysDefaultPlacement"),
	// 	setPrefFromHtml(prefs, "showOnSelect"),
	// 	setPrefFromHtml(prefs, "confirmDelete"),
	// 	setPrefFromHtml(prefs, "focusOnDisplay"),
	// 	setPrefFromHtml(prefs, "enableSpellChecker"),
	// 	setPrefFromHtml(prefs, "useTag"),
	// 	setPrefFromHtml(prefs, "tagName"),
	// 	setPrefFromHtml(prefs, "showFirstChars"),
	// 	setPrefFromHtml(prefs, "dateFormatPredefined"),
	// 	setPrefFromHtml(prefs, "dateFormat"),
	// 	setPrefFromHtml(prefs, "dateLocale"),
	// 	setPrefFromHtml(prefs, "messageAttachTop"),
	// 	setPrefFromHtml(prefs, "messageAttachBottom"),
	// 	setPrefFromHtml(prefs, "treatTextAsHtml"),
	// 	setPrefFromHtml(prefs, "attachTemplate"),
	// 	setPrefFromHtml(prefs, "storageOption"),
	// 	setPrefFromHtml(prefs, "storageFolder"),
	// 	setPrefFromHtml(prefs, "enableDebug"),
	// ]).catch(msg => {
	// 	ErrMsg.push(msg);
	// 	ErrMsg.push("");
	// 	ErrMsg.push('This should never happen. Please <a href="https://github.com/mlazdans/qnote/issues">report</a>!');
	// });

	// Some validations. TODO: to validate or not to validate other values?
	if((name == "storageOption") || (name == "storageFolder")) {
		await setPrefFromHtml(newPrefs, "storageFolder");
		await setPrefFromHtml(newPrefs, "storageOption");
		if(newPrefs.storageOption == "folder"){
			if(newPrefs.storageFolder && await browser.legacy.isFolderWritable(newPrefs.storageFolder)){
				setLabelColor("storageOptionFolder", '');
			} else {
				setLabelColor('storageOptionFolder', 'red');
				ErrMsg.push(i18n._("folder.unaccesible", newPrefs.storageFolder));
			}
		} else {
			newPrefs.storageFolder = "";
		}
	}

	if(ErrMsg.length){
		displayErrors(ErrMsg);
		return;
	}

	if(!isConnected){
		connectToBackground();
	}

	savePrefs(newPrefs).then(() => (new PrefsUpdated).post(backgroundPort));
}

function initTags(tags: Array<messenger.messages.tags.MessageTag>): void {
	const select = window.document.getElementById('select_tagName') as HTMLSelectElement;

	if(!select || !tags){
		return;
	}

	while(select.length > 0 ){
		select.remove(0);
	}

	for (const tag of tags) {
		var opt = document.createElement('option');
		opt.style.backgroundColor = tag.color;
		opt.text = tag.tag;
		opt.value = tag.key;
		select.add(opt);
	}
}

function initDateFormats(prefs: IPreferences): void {
	const select = window.document.getElementById('dateFormatPredefined');

	if(!select || !isSelectElement(select)){
		return;
	}

	select.addEventListener("change", dateFormatChange);

	while(select.children.length){
		select.children.item(0)?.remove();
	}

	// First option - custom
	const opts = document.createElement('option');
	opts.text = i18n._("date.format.custom");
	opts.value = "";
	select.add(opts);

	const d = luxon.DateTime.fromJSDate(new Date).setLocale(prefs.dateLocale);

	dateFormats.forEach((groups, groupKey) => {
		const gr = document.createElement('optgroup');
		gr.label = i18n._(groupKey);
		groups.forEach(k => {
			const opt = document.createElement('option');
			opt.text = d.toLocaleString(luxon.DateTime[k]);
			opt.value = k;
			opt.selected = prefs.dateFormatPredefined == k;
			gr.appendChild(opt);
		});
		select.add(gr);
	});
}

function dateFormatChange(){
	const select = window.document.getElementById('dateFormatPredefined') as HTMLSelectElement;
	if(select) {
		document.querySelectorAll(".customDateFormat").forEach(e => (e as HTMLDivElement).style.display = select.value ? 'none' : '');
	}
}

async function initXNoteFolderInfo(){
	const path = await getXNoteStoragePath();

	QDEB&&console.debug(`${debugHandle} trying XNote++ foder: `, path);

	if(await browser.legacy.isFolderWritable(path)){
		getElementByIdOrDie('xnoteFolderInfo').innerHTML = i18n._("xnote.folder.found", path);
	} else {
		getElementByIdOrDie('xnoteFolderInfo').innerHTML = i18n._("xnote.folder.inaccessible", path);
	}
}

function printImportStats(stats: ExportStats){
	displayMsg(
		[i18n._("import.finished.stats", [stats.imported, stats.errored, stats.existing, stats.overwritten]).replace(/\n/g, "<br>\n")],
		"Info"
	);
	// displayErrors([i18n._("import.fail")]);
}

function disableExportImportConstrols(yes: boolean): void {
	importFolderButton.disabled = yes;
	exportQNotesButton.disabled = yes;
	exportXNotesButton.disabled = yes;
	importFolderLoader.style.display = yes ? '' : 'none';
}

async function initExportButtons(prefs: IPreferences){
	let listener = (type: typeof QNoteFolder | typeof XNoteFolder) => {
		return async () => {
			console.log(`${debugHandle} exportButton<${type}>::click()`);

			// Select path where to put QNotes or XNotes
			browser.legacy.folderPicker(prefs.storageFolder ? prefs.storageFolder : null).then(async selectedPath => {
				disableExportImportConstrols(true);

				const notes =
					prefs.storageOption == 'folder'
					? await loadAllFolderNotes(prefs.storageFolder)
					: await loadAllExtNotes();

				await saveNotesAs(type, notes, !!overwriteExistingNotes.checked, selectedPath).then(printImportStats);

				disableExportImportConstrols(false);
			});
		}
	};

	exportQNotesButton.addEventListener('click', listener(QNoteFolder));
	exportXNotesButton.addEventListener('click', listener(XNoteFolder));
	importFolderButton.addEventListener('click', async () => {
		console.log(`${debugHandle} importFolderButton::click()`);

		// Select path from where import  QNotes or XNotes into local storate
		browser.legacy.folderPicker(prefs.storageFolder ? prefs.storageFolder : null).then(async selectedPath => {
			disableExportImportConstrols(true);

			const notes = await loadAllFolderNotes(selectedPath);

			await saveNotesAs(QNoteLocalStorage, notes, !!overwriteExistingNotes.checked).then(printImportStats);

			if(prefs.storageOption == "ext"){
				await browser.qapp.clearNoteCache();
			}

			disableExportImportConstrols(false);
		});
	});

}

async function storageOptionChange(){
	const option = await getPrefFromHtml("storageOption");
	// getStorageOptionValue();

	if(!input_storageFolder.value){
		input_storageFolder.value = await getXNoteStoragePath();
	}

	if(option == 'folder'){
		storageFieldset_folder.style.display = '';
	} else {
		storageFieldset_folder.style.display = 'none';
	}
}

async function storageFolderPicker(prefs: IPreferences){
	var path = await getXNoteStoragePath();

	if(!await browser.legacy.isFolderWritable(path)){
		path = prefs.storageFolder;
	}

	if(!await browser.legacy.isFolderWritable(path)){
		path = await browser.qapp.getProfilePath();
	}

	browser.legacy.folderPicker(await browser.legacy.isFolderWritable(path) ? path : null).then(selectedPath => {
		input_storageFolder.value = selectedPath;
		saveOption("storageFolder");
	});
}

function importInternalStorage(prefs: IPreferences) {
	const file = importFile.files?.item(0);

	if(!file){
		return;
	}

	const reader = new FileReader();

	reader.addEventListener("load", _e => {
		const result = reader.result?.toString();

		if(!result){
			QDEB&&console.debug(`${debugHandle} got empty from FileReader`);
			return;
		}

		try {
			var storage = JSON.parse(result.toString());

			browser.storage.local.set(storage).then(async () => {
				displayMsg([i18n._("storage.imported")], "Info");
				const newPrefs = await getPrefs();
				if(prefs.storageOption != newPrefs.storageOption){
					await browser.qapp.clearNoteCache();
				}
				initOptionsPageValues(newPrefs);
			}).catch((message: string) => {
				displayErrors([i18n._("storage.import.failed", message)]);
			});
		} catch(e){
			if(e instanceof SyntaxError) {
				displayErrors([i18n._("json.parse.error", e.message)]);
			} else if(e instanceof Error) {
				displayErrors([i18n._("storage.import.failed", e.message)]);
			} else {
				displayErrors(["Unknown error - see error console for more"]);
			}
		}
	});

	reader.readAsText(file);
}

// async function clearStorage(){
// 	if(confirm(i18n._("are.you.sure"))){
// 		return browser.storage.local.clear().then(async () => {
// 			await browser.qapp.clearNoteCache();
// 			setUpExtension();
// 			initOptionsPageValues();
// 			displayMsg([i18n._("storage.cleared")], "Info");
// 		}).catch((message: string) => {
// 			displayErrors([i18n._("storage.clear.failed", message)]);
// 		});
// 	}
// }

// async function resetDefaults(){
// 	return clearPrefs().then(async () => {
// 		await browser.qapp.clearNoteCache();
// 		setUpExtension();
// 		initOptionsPageValues();
// 		alert(i18n._("options.reset"));
// 	});
// }

function gridPosChange(){
	document.querySelectorAll("#posGrid .cell").forEach(el => {
		const cell = el as HTMLDivElement;
		if(cell.dataset["value"] == anchorPlacement.value){
			cell.classList.add("active");
		} else {
			cell.classList.remove("active");
		}
	});
}

async function initOptionsPageValues(prefs: IPreferences){
	i18n.setValues(document, prefs);
	initDateFormats(prefs);
	storageOptionChange();
	dateFormatChange();
	gridPosChange();
}

// Anchor
// ----------------
// topleft
// topright
// bottomleft
// bottomright
// leftcenter
// rightcenter
// topcenter
// bottomcenter

// Popup
// ----------------
// topleft
// topright
// bottomleft
// bottomright

// The first word specifies the anchor corner/edge and
// the second species the popup corner

function generatePosGrid(){
	let values = [
		["topleft bottomright" , "topleft topright" , "leftcenter topright" , "bottomleft bottomright" , "bottomleft topright"],
		["topleft bottomleft"  , "topleft topleft"  , "leftcenter topleft"  , "bottomleft bottomleft"  , "bottomleft topleft"],
		["topcenter bottomleft", "topcenter topleft", "center"              , "bottomcenter bottomleft", "bottomcenter topleft"],
		["topright bottomright", "topright topright", "rightcenter topright", "bottomright bottomright", "bottomright topright"],
		["topright bottomleft" , "topright topleft" , "rightcenter topleft" , "bottomright bottomleft" , "bottomright topleft"],
	];

	for(let i = 0; i < 5; i++){
		const col = document.createElement('div');
		col.className = "col";

		for(let j = 0; j < 5; j++){
			const cell = document.createElement('div');
			cell.className = "cell";
			cell.dataset["value"] = values[i][j];

			col.appendChild(cell);
		}

		posGrid.appendChild(col);
	}

	document.querySelectorAll("#posGrid .cell").forEach(e => e.addEventListener("click", () => {
		const cell = e as HTMLDivElement;
		if(cell.dataset["value"]){
			anchorPlacement.value = cell.dataset["value"];
		}
		saveOption("anchorPlacement");
		gridPosChange();
	}));
}

// Called only once, after DOM loaded
async function initOptionsPage(prefs: IPreferences){
	i18n.setTexts(document);

	initTags(await browser.messages.tags.list());
	generatePosGrid();
	initXNoteFolderInfo();
	initOptionsPageValues(prefs);
	initExportButtons(prefs);

	const unAccountedForListeners: Set<string> = new Set;
	if(QDEB) {
		for(const k in Prefs.defaults){
			unAccountedForListeners.add(k);
		}
		unAccountedForListeners.delete("anchorPlacement"); // This is handled by grid, not input listeners
	}

	const createSaveListener = (el: Element, method: string) => {
		if(!(isInputElement(el) || isSelectElement(el) || isTextAreaElement(el))){
			return;
		}

		if(!(el.name in Prefs.defaults)){
			return;
		}

		const prefKey = el.name as keyof IPreferences;

		unAccountedForListeners.delete(prefKey);

		return el.addEventListener(method, () => {
			console.log(`Saving: ${prefKey}`);
			saveOption(prefKey)
		});

		// return el.addEventListener(method, () => {
		// if(ext.CurrentNote.dirty){
		// 	ErrMsg = [i18n._("close.current.note")];
		// 	displayErrorBox();
		// 	e.preventDefault();
		// 	e.stopImmediatePropagation();
		// } else if(doSave) {
			// setTimeout(() => {
			// 	if(!--saving){
			// 		saveOptions();
			// 	}
			// }, 200);
			// saving++;
		// }
	};

	document.querySelectorAll("textarea,select,input[type=text],input[type=number]").forEach(el => createSaveListener(el, "change"));
	document.querySelectorAll("input[type=checkbox],input[type=radio]").forEach(el => createSaveListener(el, "click"));

	QDEB&&console.assert(unAccountedForListeners.size === 0, `${debugHandle} no event listeners for preferences: `, [...unAccountedForListeners.values()].join(", "));

	// Prevent buttons when note dirty
	// document.querySelectorAll("button").forEach(el => saveListener(el, "click", false));
	// document.querySelectorAll("input[type=file]").forEach(el => saveListener(el, "change", false));

	// TODO:
	// clearStorageButton.       addEventListener("click", clearStorage);
	// resetDefaultsButton.      addEventListener("click", resetDefaults);
	resetDefaultsButton.disabled = clearStorageButton.disabled = true;
	resetDefaultsButton.title = clearStorageButton.title = "TODO";

	exportStorageButton.      addEventListener("click", exportStorage);
	importFile.               addEventListener("change", () => importInternalStorage(prefs));
	storageFolderBrowseButton.addEventListener("click", () => storageFolderPicker(prefs));

	// Handle storage option click
	document.querySelectorAll("input[name=storageOption]").forEach(e => e.addEventListener("click", storageOptionChange));

	resetTemplate.addEventListener('click', () => {
		attachTemplate.value = Prefs.defaults.attachTemplate;
		saveOption("attachTemplate");
		return false;
	});
}

async function exportStorage(){
	const storage = await browser.storage.local.get();
	const blob = new Blob([JSON.stringify(storage)], {type : 'application/json'});

	return browser.downloads.download({
		url: window.URL.createObjectURL(blob),
		saveAs: true,
		filename: 'qnote-storage.json'
	});
}

window.addEventListener("DOMContentLoaded", async () => {
	QDEB&&console.log(`${debugHandle} DOMContentLoaded`);

	await initOptionsPage(await getPrefs());
});
