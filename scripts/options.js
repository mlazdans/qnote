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

function isButton(node){
	return node.nodeName == "INPUT" && node.type.toLocaleUpperCase() == "BUTTON"
}
function isCheckbox(node){
	return node.nodeName == "INPUT" && node.type.toLocaleUpperCase() == "CHECKBOX"
}

// Localize texts
for (const node of document.querySelectorAll('[data-i18n]')) {
	let id = node.dataset.i18n;
	var text = _(id);
	if(isButton(node)){
		node.value = text;
	}else{
		node.appendChild(document.createTextNode(text));
	}
}

async function setNode(node){
	let pref = node.dataset.preference;
	let value = Prefs[pref];
	switch(node.nodeName) {
		case "SELECT":
			var option = node.querySelectorAll('[value='+value+']')[0];
			if(option){
				option.selected = true;
			}
			break;
		case "INPUT":
			if(isCheckbox(node)){
				node.checked = value;
			}else{
				node.value = value;
			}
			break;
		default:
			console.error("Unknown node type " + node.nodeName);
			console.error(node);
	}
}

function importLegacyXNotes() {
	importLegacyXNotesButton.disabled = true;
	importLegacyXNotesLoader.style.display = 'block';

	ext.importLegacyXNotes()
	.then((stats)=>{
		if(stats){
			alert(_("import.finished.stats", [stats.imported, stats.err, stats.exist]));
		} else {
			alert(_("Could not import legacy notes"));
		}
	}).finally(()=>{
		initLegacyImportButton();
		importLegacyXNotesLoader.style.display = 'none';
	});
}

function saveChanges(){
	var elements = document.forms[0].elements;
	for (i = 0; i < elements.length; i++) {
		var item = elements[i];
		var key = item.dataset.preference;
		var value = item.value;
		if (!key || isButton(item)) {
			continue;
		}
		if (isCheckbox(item)){
			value = item.checked;
		}
		Prefs[key] = value;
	}
	ext.savePrefs(Prefs);
}

function initTags(){
	var select = window.document.getElementById('select_tagName');
	if(!select || !Prefs.tags){
		return false;
	}

	while(select.length > 0 ){
		select.remove(0);
	}

	for (const tag of Prefs.tags) {
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
		await ext.closeCurrentNote();
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
		filename: 'storage.json'
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
	var path = await ext.browser.xnote.getStoragePath();
	var profilePath = await ext.browser.xnote.getProfilePath();

	if(path){
		Prefs.legacyStoragePath = path;
		ext.Prefs.legacyStoragePath = path;

		document.getElementById('xnoteFolderInfo').textContent = _("xnote.folder.found", path);

		importLegacyXNotesButton.disabled = false;
	} else {
		document.getElementById('xnoteFolderInfo').textContent = _("xnote.folder.unaccesible", profilePath);

		importLegacyXNotesButton.disabled = true;
	}
}

async function reloadExtension(){
	await ext.closeCurrentNote();
	return ext.browser.runtime.reload();
}

async function initOptions(){
	Prefs = await ext.loadPrefs();

	Prefs.tags = await ext.browser.messages.listTags();

	initTags();

	for (const node of document.querySelectorAll('[data-preference]')) {
		setNode(node);
	}

	saveButton.addEventListener('click', saveChanges);
	importLegacyXNotesButton.addEventListener('click', importLegacyXNotes);
	clearStorageButton.addEventListener('click', clearStorage);
	exportStorageButton.addEventListener('click', exportStorage);
	importFile.addEventListener("change", importStorage);
	reloadExtensionButton.addEventListener("click", reloadExtension);

	//let vers = await ext.browser.legacy.compareVersions("78", );
	let info = await ext.browser.runtime.getBrowserInfo();
	let vers = await ext.browser.legacy.compareVersions("78", info.version);
	if(vers<0){
		exportStorageButton.disabled = false;
	} else {
		exportStorageButton.disabled = true;
	}

	initLegacyImportButton();
}

initOptions();
