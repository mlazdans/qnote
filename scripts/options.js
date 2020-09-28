var ext = chrome.extension.getBackgroundPage();
var _ = browser.i18n.getMessage;

var Prefs;
var DefaultPrefs;

var importLegacyXNotesButton = document.getElementById('importLegacyXNotesButton');
var importLegacyXNotesLoader = document.getElementById("importLegacyXNotesLoader");
var saveButton = document.getElementById('saveButton');
var clearStorageButton = document.getElementById('clearStorageButton');
var exportStorageButton = document.getElementById('exportStorageButton');
var importFile = document.getElementById("importFile");
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

	if(storageOptionValue() === 'folder'){
		let isReadable = await ext.browser.legacy.isReadable(input_storageFolder.value);
		if(!isReadable){
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
				await ext.browser.qapp.clearColumnNotes();
			}

			if(Prefs.showFirstChars !== oldPrefs.showFirstChars){
				await ext.browser.qapp.setColumnTextLimit(Prefs.showFirstChars);
			}

			// Invalidate column cache
			if(Prefs.storageFolder !== oldPrefs.storageFolder){
				await ext.browser.qapp.clearColumnNotes();
			}

			if(Prefs.windowOption !== oldPrefs.windowOption){
				reloadExtension();
			}

			await ext.browser.qapp.updateView();
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

// TODO: to utils.js
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

async function initExportStorageButton() {
	let info = await ext.browser.runtime.getBrowserInfo();
	let vers = await ext.browser.legacy.compareVersions("78", info.version);

	if(vers<0){
		exportStorageButton.disabled = false;
	} else {
		exportStorageButton.disabled = true;
	}
}

async function initXNoteImportButton(){
	var path;
	var legacyPrefs = ext.legacyPrefsMapper(await ext.browser.xnote.getPrefs());

	if(legacyPrefs.storageFolder){
		path = legacyPrefs.storageFolder;
	} else if(!(path = await ext.browser.xnote.getStoragePath())) {
		path = await ext.browser.qapp.getProfilePath();
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
	var path;

	if(Prefs.storageFolder){
		path = Prefs.storageFolder;
	} else if(!(path = await ext.browser.xnote.getStoragePath())) {
		path = await ext.browser.qapp.getProfilePath();
	}

	ext.browser.legacy.folderPicker({
		displayDirectory: path
	}).then((path)=>{
		input_storageFolder.value = path;
	});
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
	exportStorageButton.addEventListener('click', exportStorage);
	importFile.addEventListener("change", importStorage);
	reloadExtensionButton.addEventListener("click", reloadExtension);
	storageFolderBrowseButton.addEventListener("click", storageFolderBrowse);

	for (const node of document.querySelectorAll('input[name="storageOption"]')) {
		node.addEventListener("click", storageOptionChange);
	}
	storageOptionChange();
}

window.addEventListener("load", ()=>{
	initOptionsPage();
});
