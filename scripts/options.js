var ext = chrome.extension.getBackgroundPage();
var i18n = ext.i18n;
var _ = browser.i18n.getMessage;
var QDEB = ext.QDEB;

var DefaultPrefs;

var importFolderButton = document.getElementById('importFolderButton');
var importFolderLoader = document.getElementById("importFolderLoader");
// var saveButton = document.getElementById('saveButton');
var resetDefaultsButton = document.getElementById('resetDefaultsButton');
var clearStorageButton = document.getElementById('clearStorageButton');
var exportStorageButton = document.getElementById('exportStorageButton');
var importFile = document.getElementById("importFile");
var reloadExtensionButton = document.getElementById("reloadExtensionButton");
var storageFolderBrowseButton = document.getElementById("storageFolderBrowseButton");
var input_storageFolder = document.getElementById("input_storageFolder");
var overwriteExistingNotes = document.getElementById("overwriteExistingNotes");
var errorBox = document.getElementById("errorBox");

var dateFormats = {
	datetime_group: [
		'DATETIME_FULL',
		'DATETIME_FULL_WITH_SECONDS',
		// 'DATETIME_HUGE',
		// 'DATETIME_HUGE_WITH_SECONDS',
		'DATETIME_MED',
		'DATETIME_MED_WITH_SECONDS',
		'DATETIME_MED_WITH_WEEKDAY',
		'DATETIME_SHORT',
		'DATETIME_SHORT_WITH_SECONDS',
	],
	date_group: [
		'DATE_FULL',
		'DATE_HUGE',
		'DATE_MED',
		'DATE_MED_WITH_WEEKDAY',
		'DATE_SHORT',
	],
	time_group: [
		'TIME_24_SIMPLE',
		// 'TIME_24_WITH_LONG_OFFSET',
		'TIME_24_WITH_SECONDS',
		'TIME_24_WITH_SHORT_OFFSET',
		'TIME_SIMPLE',
		// 'TIME_WITH_LONG_OFFSET',
		'TIME_WITH_SECONDS',
		'TIME_WITH_SHORT_OFFSET'
	]
};

function setLabelColor(forE, color){
	let label = document.querySelectorAll('label[for=' + forE + ']')[0];

	label.style.color = color;

	return label;
}

async function saveOptionsDefaultHandler(prefs) {
	ext.CurrentNote && await ext.CurrentNote.close();

	let oldPrefs = Object.assign({}, ext.Prefs);

	ext.Prefs = await ext.loadPrefsWithDefaults();

	// if(prefs.showFirstChars !== oldPrefs.showFirstChars){
	// 	// await browser.qapp.clearNoteCache();
	// 	// await browser.qapp.setColumnTextLimit(prefs.showFirstChars);
	// }

	// Storage option changed
	if(prefs.storageOption !== oldPrefs.storageOption){
		await browser.qapp.clearNoteCache();
	}

	// Folder changed
	if(prefs.storageFolder !== oldPrefs.storageFolder){
		await browser.qapp.clearNoteCache();
		// ext.reloadExtension();
	}

	// if(prefs.windowOption !== oldPrefs.windowOption){
	// 	ext.reloadExtension();
	// }

	// if(prefs.enableSearch !== oldPrefs.enableSearch){
	// 	ext.reloadExtension();
	// }

	await ext.setUpExtension();
	initOptionsPageValues();

	return true;
};

function displayErrorBox(shown){
	errorBox.style.display = shown ? "block" : "none";
}

async function saveOptions(handler){
	QDEB&&console.debug("Saving options...");
	let prefs = await ext.loadPrefsWithDefaults();

	displayErrorBox(false);
	if(storageOptionValue() === 'folder'){
		if(!await ext.isFolderReadable(input_storageFolder.value)){
			setLabelColor('storageOptionFolder', 'red');
			displayErrorBox(true);
			// alert(_("folder.unaccesible", input_storageFolder.value));
			return false;
		}
	}

	setLabelColor('storageOptionFolder', '');

	var elements = document.forms[0].elements;
	for (i = 0; i < elements.length; i++) {
		var item = elements[i];
		var key = item.dataset.preference;
		var value = item.value;

		if (!key || i18n.isButton(item) || (i18n.isRadio(item) && !item.checked) || (DefaultPrefs[key] === undefined)) {
			continue;
		}

		if (i18n.isCheckbox(item)){
			value = item.checked;
		}

		value = DefaultPrefs[key].constructor(value); // Type cast

		prefs[key] = value;
	}

	return ext.savePrefs(prefs).then(saved => saved && (handler || saveOptionsDefaultHandler)(prefs));
}

function initTags(tags){
	var select = window.document.getElementById('select_tagName');
	if(!select || !tags){
		return false;
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

function initDateFormats(){
	let select = window.document.getElementById('dateFormatPredefined');
	select.addEventListener("change", dateFormatChange);

	if(!select){
		return false;
	}

	while(select.children.length){
		select.children.item(0).remove();
	}

	let opt = document.createElement('option');
	opt.text = _("date.format.custom");
	opt.value = "";
	select.add(opt);

	for (const group in dateFormats) {
		let gr = document.createElement('optgroup');
		gr.label = _(group);
		for (const df of dateFormats[group]) {
			let opt = document.createElement('option');
			opt.text = ext.qDateFormatPredefined(df);
			opt.value = df;
			opt.selected = ext.Prefs.dateFormatPredefined == df;
			gr.appendChild(opt);
		}

		select.add(gr);
	}
}

function dateFormatChange(){
	let select = window.document.getElementById('dateFormatPredefined');
	let customBlock = window.document.getElementById('block_dateFormat');

	if(select.value){
		customBlock.style.display = 'none';
	} else {
		customBlock.style.display = '';
	}
}

async function initExportStorageButton() {
	let info = await ext.browser.runtime.getBrowserInfo();
	let vers = await browser.legacy.compareVersions("78", info.version);

	if(vers<0){
		exportStorageButton.disabled = false;
	} else {
		exportStorageButton.disabled = true;
	}
}

async function initFolderImportButton(){
	var path = await ext.getXNoteStoragePath();

	if(path){
		if(await ext.isFolderReadable(path)){
			document.getElementById('xnoteFolderInfo').textContent = _("xnote.folder.found", path);
		} else {
			document.getElementById('xnoteFolderInfo').textContent = _("xnote.folder.inaccessible", path);
			path = '';
		}
	}

	importFolderButton.addEventListener('click', ()=>{
		let opt = {};
		if(path){
			opt.displayDirectory = path;
		}

		browser.legacy.folderPicker(opt).then(selectedPath => {
			importFolderButton.disabled = true;
			importFolderLoader.style.display = '';

			return ext.importFolderNotes(selectedPath, !!overwriteExistingNotes.checked).then(stats => {
				if(stats){
					alert(_("import.finished.stats", [stats.imported, stats.err, stats.exist, stats.overwritten]));
				} else {
					alert(_("import.fail"));
				}
			}).finally(async () => {
				// Reset cache since we might import some new data
				await browser.qapp.clearNoteCache();
				importFolderButton.disabled = false;
				importFolderLoader.style.display = 'none';
			});
		});
	});
}

function storageOptionValue(){
	var e = document.querySelector('input[name="storageOption"]:checked');

	return e ? e.value : DefaultPrefs.storageFolder;
}

async function storageOptionChange(){
	let option = storageOptionValue();

	if(!input_storageFolder.value){
		input_storageFolder.value = await ext.getXNoteStoragePath();
	}

	for (const node of document.querySelectorAll('[class="storageFieldset"]')) {
		if(node.id === 'storageFieldset_' + option){
			node.style.display = '';
		} else {
			node.style.display = 'none';
		}
	}
}

async function storageFolderBrowse(){
	var path = await ext.getXNoteStoragePath();

	if(!await ext.isFolderReadable(path)){
		path = ext.Prefs.storageFolder;
	}

	if(!await ext.isFolderReadable(path)){
		path = await browser.qapp.getProfilePath();
	}

	let opt = {};
	if(await ext.isFolderReadable(path)){
		opt.displayDirectory = path;
	}

	browser.legacy.folderPicker(opt).then(selectedPath => {
		input_storageFolder.value = selectedPath;
		saveOptions();
	});
}

function importInternalStorage() {
	const reader = new FileReader();
	const file = this.files[0];

	reader.onload = e => {
		try {
			var storage = JSON.parse(e.target.result);
		} catch(e){
			alert(_("json.parse.error", e.message));
			return false;
		}

		browser.storage.local.set(storage).then(async () => {
			alert(_("storage.imported"));
			await browser.qapp.clearNoteCache();
			ext.setUpExtension();
			initOptionsPageValues();
		}).catch(e => {
			alert(_("storage.import.failed", e.message));
		});
	};

	reader.readAsText(file);
}

async function clearStorage(){
	if(await browser.legacy.confirm(_("are.you.sure"))){
		ext.clearStorage().then(async () => {
			alert(_("storage.cleared"));
			await browser.qapp.clearNoteCache();
			ext.setUpExtension();
			initOptionsPageValues();
		}).catch(e => {
			alert(_("storage.clear.failed", e.message));
		});
	}
}

async function initOptionsPageValues(){
	i18n.setData(document, await ext.loadPrefsWithDefaults());
	initDateFormats();
	storageOptionChange();
	dateFormatChange();
}

async function resetDefaults(){
	QDEB&&console.debug("Resetting to defaults...");
	return ext.clearPrefs().then(() => {
		ext.setUpExtension();
		initOptionsPageValues();
	});
}

async function initOptionsPage(){
	// If background has not yet initialized, load our prefs
	if(!ext.Prefs){
		ext.Prefs = await ext.loadPrefsWithDefaults();
	}
	let tags = await ext.browser.messages.listTags();
	DefaultPrefs = ext.getDefaultPrefs();

	i18n.setTexts(document);

	initTags(tags);
	initOptionsPageValues();
	initFolderImportButton();
	initExportStorageButton();

	// saveButton.addEventListener('click', () => saveOptions());
	clearStorageButton.addEventListener('click', clearStorage);
	exportStorageButton.addEventListener('click', ext.exportStorage);
	importFile.addEventListener("change", importInternalStorage);
	reloadExtensionButton.addEventListener("click", ext.reloadExtension);
	storageFolderBrowseButton.addEventListener("click", storageFolderBrowse);
	resetDefaultsButton.addEventListener("click", resetDefaults);

	for (const node of document.querySelectorAll('input[name="storageOption"]')) {
		node.addEventListener("click", storageOptionChange);
	}

	document.querySelectorAll("input,select,textarea").forEach(el => el.addEventListener("input", () => saveOptions()));
}

window.addEventListener("load", ()=>{
	initOptionsPage();
});
