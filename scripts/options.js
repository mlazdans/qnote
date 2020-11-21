var ext = chrome.extension.getBackgroundPage();
var i18n = ext.i18n;
var _ = browser.i18n.getMessage;

var Prefs;
var DefaultPrefs;

var importXNotesButton = document.getElementById('importXNotesButton');
var importXNotesLoader = document.getElementById("importXNotesLoader");
var saveButton = document.getElementById('saveButton');
var clearStorageButton = document.getElementById('clearStorageButton');
var exportStorageButton = document.getElementById('exportStorageButton');
var importFile = document.getElementById("importFile");
var reloadExtensionButton = document.getElementById("reloadExtensionButton");
var storageFolderBrowseButton = document.getElementById("storageFolderBrowseButton");
var input_storageFolder = document.getElementById("input_storageFolder");
var input_overwriteExistingNotes = document.getElementById("input_overwriteExistingNotes");

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

async function saveOptions(handler){
	var oldPrefs = Object.assign({}, Prefs);

	if(storageOptionValue() === 'folder'){
		if(!await ext.isReadable(input_storageFolder.value)){
			setLabelColor('storageOptionFolder', 'red');
			alert(_("folder.unaccesible", input_storageFolder.value));
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

		Prefs[key] = value;
	}

	let defaultHandler = async saved => {
		if(!saved){
			return;
		}

		// Update extension prefs
		ext.Prefs = await ext.loadPrefsWithDefaults();

		// if(Prefs.showFirstChars !== oldPrefs.showFirstChars){
		// 	// await browser.qapp.clearNoteCache();
		// 	// await browser.qapp.setColumnTextLimit(Prefs.showFirstChars);
		// }

		// Storage option changed
		if(Prefs.storageOption !== oldPrefs.storageOption){
			await browser.qapp.clearNoteCache();
		}

		// Folder changed
		if(Prefs.storageFolder !== oldPrefs.storageFolder){
			await browser.qapp.clearNoteCache();
			// ext.reloadExtension();
		}

		// if(Prefs.windowOption !== oldPrefs.windowOption){
		// 	ext.reloadExtension();
		// }

		// if(Prefs.enableSearch !== oldPrefs.enableSearch){
		// 	ext.reloadExtension();
		// }

		await ext.CurrentNote.close();
		await ext.setUpExtension();
	};

	await ext.savePrefs(Prefs).then(handler || defaultHandler);
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

	while(select.length > 0 ){
		select.remove(0);
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
			opt.text = ext.dateFormatPredefined(ext.CurrentLang, df);
			opt.value = df;
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

async function initXNoteImportButton(){
	var path = await ext.getXNoteStoragePath();

	if(path){
		if(await ext.isReadable(path)){
			document.getElementById('xnoteFolderInfo').textContent = _("xnote.folder.found", path);
		} else {
			document.getElementById('xnoteFolderInfo').textContent = _("xnote.folder.inaccessible", path);
			path = '';
		}
	}

	importXNotesButton.addEventListener('click', ()=>{
		let opt = {};
		if(path){
			opt.displayDirectory = path;
		}

		browser.legacy.folderPicker(opt).then((selectedPath)=>{
			importXNotesButton.disabled = true;
			importXNotesLoader.style.display = '';

			return ext.importXNotes(selectedPath).then(stats => {
				if(stats){
					alert(_("xnote.import.finished.stats", [stats.imported, stats.err, stats.exist, stats.overwritten]));
				} else {
					alert(_("xnote.import.fail"));
				}

				// TODO: We need to get possible new data down to qapp cache. Quick hack is just to reload. Or just clear cache. Hmm...
				saveOptions(async saved => {
					ext.reloadExtension();
				});
			}).finally(()=>{
				importXNotesButton.disabled = false;
				importXNotesLoader.style.display = 'none';
			});
		});
	});
}

function storageOptionValue(){
	var e = document.querySelector('input[name="storageOption"]:checked');

	return e ? e.value : DefaultPrefs.storageFolder;
}

function storageOptionChange(){
	let option = storageOptionValue();

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

	if(!await ext.isReadable(path)){
		path = await browser.qapp.getProfilePath();
	}

	let opt = {};
	if(await ext.isReadable(path)){
		opt.displayDirectory = path;
	}

	browser.legacy.folderPicker(opt).then((selectedPath)=>{
		input_storageFolder.value = selectedPath;
	});
}

function importInternalStorage() {
	const reader = new FileReader();
	const file = this.files[0];

	reader.onload = (e) => {
		try {
			var storage = JSON.parse(e.target.result);
		} catch(e){
			alert(_("json.parse.error", e.message));
			return false;
		}

		browser.storage.local.set(storage).then(()=>{
			alert(_("storage.imported"));
			ext.reloadExtension();
		}, (e)=>{
			alert(_("storage.import.failed", e.message));
		});
	};

	reader.readAsText(file);
}

async function clearStorage(){
	if(await browser.legacy.confirm(_("are.you.sure"))){
		ext.clearStorage().then(() => {
			alert(_("storage.cleared"));
			ext.reloadExtension();
		}, (e) => {
			alert(_("storage.clear.failed", e.message));
		});
	}
}

async function initOptionsPage(){
	let tags = await ext.browser.messages.listTags();
	Prefs = await ext.loadPrefsWithDefaults();
	DefaultPrefs = ext.getDefaultPrefs();

	initTags(tags);
	initDateFormats();

	i18n.setTexts(document);
	i18n.setData(document, Prefs);

	initXNoteImportButton();
	initExportStorageButton();

	saveButton.addEventListener('click', () => {
		saveOptions();
	});
	clearStorageButton.addEventListener('click', clearStorage);
	exportStorageButton.addEventListener('click', ext.exportStorage);
	importFile.addEventListener("change", importInternalStorage);
	reloadExtensionButton.addEventListener("click", ext.reloadExtension);
	storageFolderBrowseButton.addEventListener("click", storageFolderBrowse);
	input_overwriteExistingNotes.addEventListener("click", ()=>{
		ext.Prefs.overwriteExistingNotes = input_overwriteExistingNotes.checked;
	});

	for (const node of document.querySelectorAll('input[name="storageOption"]')) {
		node.addEventListener("click", storageOptionChange);
	}

	storageOptionChange();
	dateFormatChange();
}

window.addEventListener("load", ()=>{
	initOptionsPage();
});
