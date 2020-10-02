var ext = chrome.extension.getBackgroundPage();
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

function isButton(node){
	return node.nodeName == "INPUT" && node.type.toLocaleUpperCase() === "BUTTON"
}
function isCheckbox(node){
	return node.nodeName == "INPUT" && node.type.toLocaleUpperCase() === "CHECKBOX"
}
function isRadio(node){
	return node.nodeName == "INPUT" && node.type.toLocaleUpperCase() === "RADIO"
}

function setLabelColor(forE, color){
	let label = document.querySelectorAll('label[for=' + forE + ']')[0];
	label.style.color = color;
	return label;
}

function setTexts(){
	for (const node of document.querySelectorAll('[data-i18n]')) {
		let id = node.dataset.i18n;
		var text = _(id);
		if(isButton(node)){
			node.value = text;
		} else {
			node.appendChild(document.createTextNode(text));
		}
	}
}

function setData(){
	for (const node of document.querySelectorAll('[data-preference]')) {
		setNode(node);
	}
}

async function setNode(node){
	let pref = node.dataset.preference;
	let value = Prefs[pref];

	switch(node.nodeName) {
		case "SELECT":
			for(let option of node.querySelectorAll("option")){
				if(option.value == value){
					option.selected = true;
					break;
				}
			}
			break;
		case "INPUT":
			if(isCheckbox(node)){
				node.checked = value;
			} else if(isRadio(node)){
				node.checked = (value === node.value);
			} else {
				node.value = value;
			}
			break;
		default:
			console.error("Unknown node type " + node.nodeName);
			console.error(node);
	}
}

async function savePrefs(){
	var oldPrefs = Object.assign({}, Prefs);

	if(storageOptionValue() === 'folder'){
		if(!await isReadable(input_storageFolder.value)){
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

		if (!key || isButton(item) || (isRadio(item) && !item.checked) || (DefaultPrefs[key] === undefined)) {
			continue;
		}

		if (isCheckbox(item)){
			value = item.checked;
		}

		value = DefaultPrefs[key].constructor(value); // Type cast

		Prefs[key] = value;
	}

	await ext.savePrefs(Prefs).then(async (saved)=>{
		if(saved){
			// Update extension prefs
			ext.Prefs = await ext.loadPrefsWithDefaults();

			if(Prefs.storageOption != oldPrefs.storageOption){
				await browser.qapp.clearColumnNotes();
			}

			if(Prefs.showFirstChars !== oldPrefs.showFirstChars){
				await browser.qapp.setColumnTextLimit(Prefs.showFirstChars);
			}

			// Invalidate column cache
			if(Prefs.storageFolder !== oldPrefs.storageFolder){
				await browser.qapp.clearColumnNotes();
			}

			if(Prefs.windowOption !== oldPrefs.windowOption){
				ext.reloadExtension();
			}

			await browser.qapp.updateView();
		}
	});
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

async function initExportStorageButton() {
	let info = await ext.browser.runtime.getBrowserInfo();
	let vers = await browser.legacy.compareVersions("78", info.version);

	if(vers<0){
		exportStorageButton.disabled = false;
	} else {
		exportStorageButton.disabled = true;
	}
}

async function isReadable(path){
	return path && await browser.legacy.isReadable(path);
}

async function getXNoteStoragePath(){
	var path;
	var legacyPrefs = ext.legacyPrefsMapper(await browser.xnote.getPrefs());

	if(legacyPrefs.storageFolder){
		path = legacyPrefs.storageFolder;
	}

	if(!await isReadable(path)){
		path = await browser.xnote.getStoragePath();
	}

	return path;
}

async function initXNoteImportButton(){
	var path = await getXNoteStoragePath();

	if(path){
		if(await isReadable(path)){
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
	var path = await getXNoteStoragePath();

	if(!await isReadable(path)){
		path = await browser.qapp.getProfilePath();
	}

	let opt = {};
	if(await isReadable(path)){
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
	let conf = await browser.legacy.confirm(_("confirm"), _("are.you.sure"));
	if(conf){
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
	setTexts();
	setData();

	initXNoteImportButton();
	initExportStorageButton();

	saveButton.addEventListener('click', savePrefs);

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
}

window.addEventListener("load", ()=>{
	initOptionsPage();
});
