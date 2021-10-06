var ext = chrome.extension.getBackgroundPage();
var i18n = ext.i18n;
var _ = ext.browser.i18n.getMessage;
var QDEB = true;

var DefaultPrefs;
var ErrMsg = [];

var importFolderButton = document.getElementById('importFolderButton');
var importFolderLoader = document.getElementById("importFolderLoader");
var resetDefaultsButton = document.getElementById('resetDefaultsButton');
var clearStorageButton = document.getElementById('clearStorageButton');
var exportStorageButton = document.getElementById('exportStorageButton');
var importFile = document.getElementById("importFile");
var reloadExtensionButton = document.getElementById("reloadExtensionButton");
var storageFolderBrowseButton = document.getElementById("storageFolderBrowseButton");
var input_storageFolder = document.getElementById("input_storageFolder");
var overwriteExistingNotes = document.getElementById("overwriteExistingNotes");
var errorBox = document.getElementById("errorBox");
var posGrid = document.getElementById("posGrid");
var anchorPlacement = document.querySelector("[name=anchorPlacement]");

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
	ext.CurrentNote && await ext.CurrentNote.silentlyPersistAndClose();

	let oldPrefs = Object.assign({}, ext.Prefs);

	ext.Prefs = await ext.loadPrefsWithDefaults();

	// Storage option changed
	if(prefs.storageOption !== oldPrefs.storageOption){
		await ext.browser.qapp.clearNoteCache();
	}

	// Folder changed
	if(prefs.storageFolder !== oldPrefs.storageFolder){
		await ext.browser.qapp.clearNoteCache();
	}

	await ext.setUpExtension();
	initOptionsPageValues();

	return true;
};

function displayErrorBox(){
	errorBox.innerHTML = ErrMsg.join("<br>");
	errorBox.style.display = ErrMsg.length > 0 ? "block" : "none";
}

async function saveOptions(handler){
	QDEB&&console.debug("Saving options...");
	let prefs = await ext.loadPrefsWithDefaults();

	ErrMsg = [];
	displayErrorBox();
	setLabelColor('storageOptionFolder', '');

	if(storageOptionValue() === 'folder'){
		if(!await ext.isFolderReadable(input_storageFolder.value)){
			setLabelColor('storageOptionFolder', 'red');
			ErrMsg.push(_("folder.unaccesible", input_storageFolder.value));
		}
	}

	if(ext.CurrentNote && ext.CurrentNote.dirty){
		ErrMsg.push(_("close.current.note"));
	}

	if(ErrMsg.length){
		displayErrorBox();
		return false;
	}

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

	return ext.savePrefs(prefs).then(() => (handler || saveOptionsDefaultHandler)(prefs));
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
	document.querySelectorAll(".customDateFormat").forEach(e => e.style.display = select.value ? 'none' : '');
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

		ext.browser.legacy.folderPicker(opt).then(selectedPath => {
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
				await ext.browser.qapp.clearNoteCache();
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
		path = await ext.browser.qapp.getProfilePath();
	}

	let opt = {};
	if(await ext.isFolderReadable(path)){
		opt.displayDirectory = path;
	}

	ext.browser.legacy.folderPicker(opt).then(selectedPath => {
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

		ext.browser.storage.local.set(storage).then(async () => {
			alert(_("storage.imported"));
			await ext.browser.qapp.clearNoteCache();
			ext.setUpExtension();
			initOptionsPageValues();
		}).catch(e => {
			alert(_("storage.import.failed", e.message));
		});
	};

	reader.readAsText(file);
}

async function clearStorage(){
	if(await ext.browser.legacy.confirm(_("are.you.sure"))){
		return ext.clearStorage().then(async () => {
			await ext.browser.qapp.clearNoteCache();
			ext.setUpExtension();
			initOptionsPageValues();
			alert(_("storage.cleared"));
		}).catch(e => {
			alert(_("storage.clear.failed", e.message));
		});
	}
}

async function resetDefaults(){
	return ext.clearPrefs().then(async () => {
		await ext.browser.qapp.clearNoteCache();
		ext.setUpExtension();
		initOptionsPageValues();
		alert(_("options.reset"));
	});
}

function gridPosChange(){
	document.querySelectorAll("#posGrid .cell").forEach(cell => {
		if(cell.dataset["value"] == anchorPlacement.value){
			cell.classList.add("active");
		} else {
			cell.classList.remove("active");
		}
	});
}

async function initOptionsPageValues(){
	i18n.setData(document, await ext.loadPrefsWithDefaults());
	initDateFormats();
	storageOptionChange();
	dateFormatChange();
	gridPosChange();
	QDEB = ext.QDEB;
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
	let values = {
		0: {
			0: "topleft bottomright",
			1: "topleft topright",
			2: "leftcenter topright",
			3: "bottomleft bottomright",
			4: "bottomleft topright"
		},
		1: {
			0: "topleft bottomleft",
			1: "topleft topleft",
			2: "leftcenter topleft",
			3: "bottomleft bottomleft",
			4: "bottomleft topleft"
		},
		2: {
			0: "topcenter bottomleft",
			1: "topcenter topleft",
			2: "center",
			3: "bottomcenter bottomleft",
			4: "bottomcenter topleft"
		},
		3: {
			0: "topright bottomright",
			1: "topright topright",
			2: "rightcenter topright",
			3: "bottomright bottomright",
			4: "bottomright topright"
		},
		4: {
			0: "topright bottomleft",
			1: "topright topleft",
			2: "rightcenter topleft",
			3: "bottomright bottomleft",
			4: "bottomright topleft"
		}
	};

	let col;
	let cell;

	for(let i = 0; i < 5; i++){
		col = document.createElement('div');
		col.className = "col";

		for(let j = 0; j < 5; j++){
			cell = document.createElement('div');
			cell.className = "cell";
			cell.dataset["value"] = values[i][j];

			col.appendChild(cell);
		}

		posGrid.appendChild(col);
	}

	document.querySelectorAll("#posGrid .cell").forEach(e => e.addEventListener("click", () => {
		anchorPlacement.value = e.dataset["value"];
		saveOptions();
	}));
}

async function initOptionsPage(){
	// Force load our prefs if background has not yet initialized (for example options page already open and has been loaded first)
	if(!ext.Prefs){
		ext.Prefs = await ext.loadPrefsWithDefaults();
	}
	let tags = await ext.browser.messages.listTags();
	DefaultPrefs = ext.getDefaultPrefs();

	i18n.setTexts(document);

	// Add auto-save to the controls
	// Also prevent if note dirty
	// Also prevent too fast changing
	let saving = 0;
	let saveListener = (el, method, doSave = true) => el.addEventListener(method, e => {
		if(ext.CurrentNote.dirty){
			ErrMsg = [_("close.current.note")];
			displayErrorBox();
			e.preventDefault();
			e.stopImmediatePropagation();
		} else if(doSave) {
			setTimeout(() => {
				if(!--saving){
					saveOptions();
				}
			}, 200);
			saving++;
		}
	});
	document.querySelectorAll("input[type=text],input[type=number]").forEach(el => saveListener(el, "keyup"));
	document.querySelectorAll("select,input[type=number]").forEach(el => saveListener(el, "change"));
	document.querySelectorAll("input[type=checkbox],input[type=radio]").forEach(el => saveListener(el, "click"));

	// Prevent buttons when note dirty
	document.querySelectorAll("button").forEach(el => saveListener(el, "click", false));
	document.querySelectorAll("input[type=file]").forEach(el => saveListener(el, "change", false));

	initTags(tags);
	generatePosGrid();
	initOptionsPageValues();
	initFolderImportButton();
	initExportStorageButton();

	clearStorageButton.addEventListener('click', clearStorage);
	exportStorageButton.addEventListener('click', ext.exportStorage);
	importFile.addEventListener("change", importInternalStorage);
	reloadExtensionButton.addEventListener("click", ext.reloadExtension);
	storageFolderBrowseButton.addEventListener("click", storageFolderBrowse);
	resetDefaultsButton.addEventListener("click", resetDefaults);

	// Handle storage option click
	document.querySelectorAll("input[name=storageOption]").forEach(e => e.addEventListener("click", storageOptionChange));
}

window.addEventListener("load", ()=>{
	initOptionsPage();
});
