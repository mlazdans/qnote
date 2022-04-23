var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

var EXPORTED_SYMBOLS = ["QNoteColumnHandler"];

var QDEB = true;

class QNoteColumnHandler {
	constructor(options) {
		this.windows = new WeakSet();
		this.options = options;
		this.columnHandler = options.columnHandler;

		let self = this;

		this.dBViewListener = {
			// onCreatedView: aFolderDisplay => {
			// },
			onActiveCreatedView: aFolderDisplay => {
				QDEB&&console.debug("QNoteColumnHandler: onActiveCreatedView()");
				self.addColumnHandler(aFolderDisplay.view.dbView);
			},
			onDestroyingView: (aFolderDisplay, aFolderIsComingBack) => {
				QDEB&&console.debug("QNoteColumnHandler: onDestroyingView()");
				self.removeColumnHandler(aFolderDisplay.view.dbView);
			}
			// onMessagesLoaded: (aFolderDisplay, aAll) => {
			// }
		};
	}

	setDebug(doDebubMsg){
		QDEB = doDebubMsg;
	}

	addColumnHandler(view){
		try {
			view.addColumnHandler("qnoteCol", this.columnHandler);
			return true;
		} catch(e){
			console.debug(e);
		}
	}

	removeColumnHandler(view){
		try {
			view.removeColumnHandler("qnoteCol");
			return true;
		} catch(e){
			console.debug(e);
		}
	}

	attachToWindow(w){
		let fName = `${this.constructor.name}.attachToWindow()`;
		QDEB&&console.debug(`${fName} - attaching...`);

		if(this.windows.has(w)){
			QDEB&&console.debug(`${fName} - already attached!`);
			return false;
		}

		if(!this.setUpDOM(w)){
			QDEB&&console.debug(`${fName} - not attachable!`);
			return false;
		}

		this.windows.add(w);

		// Keep track when changing folders
		if(w.FolderDisplayListenerManager) {
			// MAYBE: suggest listenerExists or smth
			let idx = w.FolderDisplayListenerManager._listeners.indexOf(this.dBViewListener);
			if (idx >= 0) {
				QDEB&&console.debug(`${fName} - FolderDisplayListenerManager: listener already installed`);
			} else {
				QDEB&&console.debug(`${fName} - FolderDisplayListenerManager.registerListener()`);
				w.FolderDisplayListenerManager.registerListener(this.dBViewListener);
			}
		} else {
			QDEB&&console.debug(`${fName} - FolderDisplayListenerManager: not found`);
		}

		if(w.gDBView){
			this.addColumnHandler(w.gDBView);
		}

		return true;
	}

	detachFromWindow(w){
		let fName = `${this.constructor.name}.detachFromWindow()`;
		QDEB&&console.debug(`${fName} - detaching...`);

		if(!this.windows.has(w)){
			QDEB&&console.debug(`${fName} - window not found!`);
			return false;
		}

		this.windows.delete(w);

		this.removeColumnHandler(w.gDBView)

		if(w.FolderDisplayListenerManager) {
			QDEB&&console.debug(`${fName} - FolderDisplayListenerManager.unregisterListener()`);
			w.FolderDisplayListenerManager.unregisterListener(this.dBViewListener);
		}

		// If we remove from DOM then column properties does not get saved
		// if(qnoteCol = w.document.getElementById("qnoteCol")){
		// 	//qnoteCol.parentNode.removeChild(qnoteCol.previousSibling); // Splitter
		// 	qnoteCol.parentNode.removeChild(qnoteCol);
		// }

		return true;
	}

	// http://wbamberg.github.io/idl-reference/docs/nsIXULStore.html
	xulStoreGet(key){
		let stores = [
			"chrome://messenger/content/messenger.xhtml",
			"chrome://messenger/content/messenger.xul" // TB68
		];

		for(let uri of stores){
			if(Services.xulStore.hasValue(uri, "qnoteCol", key)){
				return Services.xulStore.getValue(uri, "qnoteCol", key);
			}
		}
	}

	getElementById(w, id){
		try {
			return w.document.getElementById(id);
		} catch {
		}
	}

	setUpDOM(w) {
		// Don't bother if already added to DOM
		if(this.getElementById(w, "qnoteCol")){
			QDEB&&console.debug("qnoteCol DOM entry already present");
			return true;
		}

		// If threadCols not found, assume it is not right window
		let threadCols = this.getElementById(w, "threadCols");
		if(!threadCols){
			return false;
		}

		// Not sure what and where gets saved. I'm guessing `ordinal/visible` are stored within folder column states and `width` using xulstore?
		// Probably even don't have to worry
		let width, ordinal, visible;
		let newState, colStates;

		let aFolderDisplay = w.gFolderDisplay;
		if(aFolderDisplay){
			colStates = aFolderDisplay.getColumnStates();
			if(colStates.hasOwnProperty("qnoteCol")){
				newState = Object.assign({}, colStates.qnoteCol);
				QDEB&&console.debug("qnoteCol found sate:", newState);
				ordinal = newState.ordinal;
				visible = newState.visible;
			}

		}

		QDEB&&console.debug("qnoteCol xulStoreGet sate: hidden:", this.xulStoreGet("hidden"), ", ordinal:", this.xulStoreGet("ordinal"), ", width:", this.xulStoreGet("width"));

		// Can't use ?? here because of TB68
		ordinal = ordinal === undefined || ordinal === null ? this.xulStoreGet("ordinal") : ordinal;
		width = (width === undefined || width === null ? this.xulStoreGet("width") : width) || 24;
		visible = visible === undefined || visible === null ? (this.xulStoreGet("hidden") !== "true") : visible; // xulStore returned values appear to be strings

		// Some casts
		visible = !!visible;
		ordinal = ordinal + "";
		width = width + "";

		QDEB&&console.debug("qnoteCol new sate: visible:", visible, ", ordinal:", ordinal, ", width:", width);

		newState = { visible, ordinal };

		let widthStr = '';
		let colOrdinalStr = '';
		let splitOrdinalStr = '';

		if(ordinal){
			let splitOrdinal = ordinal - 1;
			colOrdinalStr = `ordinal="${ordinal}" style="-moz-box-ordinal-group: ${ordinal};"`;
			splitOrdinalStr = `style="-moz-box-ordinal-group: ${splitOrdinal};"`;
		}

		if(width){
			widthStr = `width="${width}"`;
		}

		let imgURL = extension.getURL("images/icon-column.png");

		let html = '';
		// Disabled splitter for now, will see
		//html += `<splitter class="tree-splitter" resizeafter="farthest" ${splitOrdinalStr} />`;
		html += `<treecol id="qnoteCol" persist="hidden ordinal width sortDirection" ${widthStr} ${colOrdinalStr}
			label="QNote" minwidth="19" tooltiptext="QNote" currentView="unthreaded"
			is="treecol-image" class="treecol-image qnote-column-header"><img
				src="${imgURL}"
				xmlns="http://www.w3.org/1999/xhtml" class="treecol-icon"
			/></treecol>`
		;

		// '<label class="treecol-text" crop="right" value="QNote" />' +
		// '<image class="treecol-sortdirection" />' +
		let treecols = threadCols.querySelectorAll("treecol");
		// Assume treecols probably will not be empty, but it could - beware
		if(treecols.length){
			let last = treecols[treecols.length - 1];
			if(last){
				last.parentNode.insertBefore(w.MozXULElement.parseXULToFragment(html), last.nextSibling);
			}
		}

		if(aFolderDisplay){
			colStates.qnoteCol = newState;
			aFolderDisplay.setColumnStates(colStates, true);
		}

		return true;
	}
};
