var ext = chrome.extension.getBackgroundPage();
var _ = browser.i18n.getMessage;

var Prefs;

var importLegacyXNotesButton = document.getElementById('importLegacyXNotesButton');
var saveButton = document.getElementById('saveButton');
var clearStorageButton = document.getElementById('clearStorageButton');
var exportStorageButton = document.getElementById('exportStorageButton');
var importFile = document.getElementById("importFile");
var importLegacyXNotesLoader = document.getElementById("importLegacyXNotesLoader");
var reloadExtensionButton = document.getElementById("reloadExtensionButton");
var storageFolderBrowseButton = document.getElementById("storageFolderBrowseButton");
var input_storageFolder = document.getElementById("input_storageFolder");

function isButton(node){
	return node.nodeName == "INPUT" && node.type.toLocaleUpperCase() === "BUTTON"
}
function isCheckbox(node){
	return node.nodeName == "INPUT" && node.type.toLocaleUpperCase() === "CHECKBOX"
}
function isRadio(node){
	return node.nodeName == "INPUT" && node.type.toLocaleUpperCase() === "RADIO"
}

function toggleLabelError(forE, color){
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

function importLegacyXNotes(path) {
	importLegacyXNotesButton.disabled = true;
	importLegacyXNotesLoader.style.display = '';

	return ext.importLegacyXNotes(path).then((stats)=>{
		if(stats){
			alert(_("xnote.import.finished.stats", [stats.imported, stats.err, stats.exist]));
		} else {
			alert(_("xnote.import.fail"));
		}
	}).finally(()=>{
		importLegacyXNotesButton.disabled = false;
		importLegacyXNotesLoader.style.display = 'none';
	});
}

async function savePrefs(){
	var oldPrefs = Object.assign({}, Prefs);

	if(storageOptionValue() == 'folder'){
		let isReadable = await ext.browser.legacy.isReadable(input_storageFolder.value);
		if(!isReadable){
			toggleLabelError('storageOptionFolder', 'red');
			alert(_("folder.unaccesible", input_storageFolder.value));
			return false;
		}
	}
	toggleLabelError('storageOptionFolder', '');

	var elements = document.forms[0].elements;
	for (i = 0; i < elements.length; i++) {
		var item = elements[i];
		var key = item.dataset.preference;
		var value = item.value;

		if (!key || isButton(item) || (isRadio(item) && !item.checked) || (ext.DefaultPrefs[key] === undefined)) {
			continue;
		}

		if (isCheckbox(item)){
			value = item.checked;
		}

		value = ext.DefaultPrefs[key].constructor(value); // Type cast

		Prefs[key] = value;
	}

	await ext.savePrefs(Prefs).then(async (saved)=>{
		if(saved){
			if(Prefs.storageOption != oldPrefs.storageOption){
				reloadExtension();
			} else if(Prefs.showFirstChars !== oldPrefs.showFirstChars){
				await ext.browser.qapp.setColumnTextLimit(Prefs.showFirstChars);
				await ext.browser.qapp.updateView();
			}
		}

		return saved;
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

async function clearStorage(){
	let conf = await ext.browser.legacy.confirm(_("confirm"), _("are.you.sure"));
	if(conf){
		await ext.CurrentNote.close();
		ext.browser.storage.local.clear().then(() => {
			alert(_("storage.cleared"));
			reloadExtension();
		}, (e) => {
			alert(_("storage.clear.failed", e.message));
		});
	}
}

async function exportStorage(){
	let storage = await ext.browser.storage.local.get(null);
	let blob = new Blob([JSON.stringify(storage)], {type : 'application/json'});
	let url = window.URL.createObjectURL(blob);

	return ext.browser.downloads.download({
		url: url,
		saveAs: true,
		filename: 'qnote-storage.json'
	});
}

async function importStorage() {
	const reader = new FileReader();
	const file = this.files[0];

	reader.onload = (e) => {
		try {
			var storage = JSON.parse(e.target.result);
		} catch(e){
			alert(_("json.parse.error", e.message));
			return false;
		}

		ext.browser.storage.local.set(storage).then(()=>{
			alert(_("storage.imported"));
			reloadExtension();
		}, (e)=>{
			alert(_("storage.import.failed", e.message));
		});
	};

	reader.readAsText(file);
}

async function initLegacyImportButton(){
	var path;

	var legacyPrefs = await ext.browser.xnote.getPrefs();
	if(legacyPrefs.storage_path){
		path = legacyPrefs.storage_path;
	} else if(!(path = await ext.browser.xnote.getStoragePath())) {
		path = await ext.browser.xnote.getProfilePath();
	}

	if(path){
		document.getElementById('xnoteFolderInfo').textContent = _("xnote.folder.found", path);
	} else {
		document.getElementById('xnoteFolderInfo').textContent = _("xnote.folder.inaccessible", profilePath);
	}

	importLegacyXNotesButton.addEventListener('click', ()=>{
		ext.browser.legacy.folderPicker({
			displayDirectory: path
		}).then((path)=>{
			return importLegacyXNotes(path);
		});
	});
}

async function reloadExtension(){
	await ext.CurrentNote.close();
	return await ext.browser.runtime.reload();
}

function storageOptionChange(option){
	for (const node of document.querySelectorAll('[class="storageFieldset"]')) {
		if(node.id === 'storageFieldset_' + option){
			node.style.display = '';
		} else {
			node.style.display = 'none';
		}
	}
}

function storageOptionValue(){
	var e = document.querySelector('input[name="storageOption"]:checked');
	return e ? e.value : ext.DefaultPrefs.storageFolder;
}

async function storageOption(){
	storageOptionChange(storageOptionValue());
}

async function storageFolderBrowse(){
	var path;

	if(Prefs.storageFolder){
		path = Prefs.storageFolder;
	} else if(!(path = await ext.browser.xnote.getStoragePath())) {
		path = await ext.browser.xnote.getProfilePath();
	}

	ext.browser.legacy.folderPicker({
		displayDirectory: path
	}).then((path)=>{
		input_storageFolder.value = path;
	});
}

async function initOptions(){
	Prefs = await ext.loadPrefs();
	let tags = await ext.browser.messages.listTags();

	initTags(tags);

	setTexts();
	setData();

	let info = await ext.browser.runtime.getBrowserInfo();
	let vers = await ext.browser.legacy.compareVersions("78", info.version);
	if(vers<0){
		exportStorageButton.disabled = false;
	} else {
		exportStorageButton.disabled = true;
	}

	initLegacyImportButton();
	saveButton.addEventListener('click', savePrefs);
	clearStorageButton.addEventListener('click', clearStorage);
	exportStorageButton.addEventListener('click', exportStorage);
	importFile.addEventListener("change", importStorage);
	reloadExtensionButton.addEventListener("click", reloadExtension);
	storageFolderBrowseButton.addEventListener("click", storageFolderBrowse);

	for (const node of document.querySelectorAll('input[name="storageOption"]')) {
		node.addEventListener("click", storageOption);
	}
	storageOption();
}

window.addEventListener("load",()=>{
	initOptions();
});
