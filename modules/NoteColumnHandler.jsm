var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var EXPORTED_SYMBOLS = ["NoteColumnHandler"];

var QDEB = true;

class NoteColumnHandler {
	constructor(options) {
		this.windows = new WeakSet();
		this.options = options;

		let self = this;

		this.dBViewListener = {
			// onCreatedView: aFolderDisplay => {
			// },
			onActiveCreatedView: aFolderDisplay => {
				try {
					self.addColumnHandler(aFolderDisplay.view.dbView);
				} catch(e) {
					console.error(e);
				}
			},
			onDestroyingView: (aFolderDisplay, aFolderIsComingBack) => {
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
			if(view){
				view.addColumnHandler("qnoteCol", this.options.columnHandler);
			}
		} catch(e){
			console.error(e);
		}
	}

	removeColumnHandler(view){
		try {
			if(view){
				view.removeColumnHandler("qnoteCol");
			}
		} catch(e){
			console.error(e);
		}
	}

	attachToWindow(w){
		let fName = `${this.constructor.name}.attachToWindow()`;

		if(this.windows.has(w)){
			QDEB&&console.debug(`${fName} - already attached`);
			return false;
		}

		if(!this.setUpDOM(w)){
			QDEB&&console.debug(`${fName} - not attachable`);
			return false;
		}

		// Keep track when changing folders
		if(w.FolderDisplayListenerManager) {
			// TODO: suggest listenerExists or smth
			let idx = w.FolderDisplayListenerManager._listeners.indexOf(this.dBViewListener);
			if (idx >= 0) {
				QDEB&&console.debug(`${fName} - FolderDisplayListenerManager.registerListener() - already installed`);
			} else {
				QDEB&&console.debug(`${fName} - FolderDisplayListenerManager.registerListener()`);
				w.FolderDisplayListenerManager.registerListener(this.dBViewListener);
			}
		} else {
			QDEB&&console.debug(`${fName} - FolderDisplayListenerManager -not found-`);
		}

		this.addColumnHandler(w.gDBView);

		return this.windows.add(w);
	}

	detachFromWindow(w){
		let fName = `${this.constructor.name}.detachFromWindow()`;

		if(!this.windows.has(w)){
			QDEB&&console.debug(`${fName} - window not found`);
			return false;
		}

		QDEB&&console.debug(`${fName}`);

		if(w.FolderDisplayListenerManager) {
			QDEB&&console.debug(`${fName} - FolderDisplayListenerManager.unregisterListener()`);
			w.FolderDisplayListenerManager.unregisterListener(this.dBViewListener);
		}

		this.removeColumnHandler(w.gDBView);

		// If we remove from DOM then column properties does not get saved
		// if(qnoteCol = w.document.getElementById("qnoteCol")){
		// 	//qnoteCol.parentNode.removeChild(qnoteCol.previousSibling); // Splitter
		// 	qnoteCol.parentNode.removeChild(qnoteCol);
		// }

		return this.windows.delete(w);
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
		let qnoteCol = this.getElementById(w, "qnoteCol");

		// Don't bother if already added to DOM
		if(qnoteCol){
			return true;
		}

		let threadCols = this.getElementById(w, "threadCols");

		// If threadCols not found, assume it is not right window
		if(!threadCols){
			return false;
		}

		// Not sure what and where gets saved. I'm guessing `ordinal/visible` are stored within folder column states and `width` using xulstore?
		let width, ordinal, visible;
		let newState, colStates;

		let aFolderDisplay = w.gFolderDisplay;
		if(aFolderDisplay){
			colStates = aFolderDisplay.getColumnStates();
			newState = Object.assign({}, colStates.qnoteCol);

			ordinal = newState.ordinal;
			visible = newState.visible;
		}

		// Can't use ?? here because of TB68
		ordinal = ordinal === undefined || ordinal === null ? this.xulStoreGet("ordinal") : ordinal;
		width = (width === undefined || width === null ? this.xulStoreGet("width") : width) || 24;
		visible = visible === undefined || visible ===null ? (this.xulStoreGet("hidden") !== true) : visible;

		// Some casts
		visible = !!visible;
		ordinal = ordinal + "";
		width = width + "";

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

		let html = '';
		// Disabled splitter for now, will see
		//html += `<splitter class="tree-splitter" resizeafter="farthest" ${splitOrdinalStr} />`;
		html += `<treecol id="qnoteCol" persist="hidden ordinal width sortDirection" ${widthStr} ${colOrdinalStr}
			label="QNote" minwidth="19" tooltiptext="QNote" currentView="unthreaded"
			is="treecol-image" class="treecol-image qnote-column-header"/>`
			;

		// '<label class="treecol-text" crop="right" value="QNote" />' +
		// '<image class="treecol-sortdirection" />' +
		let treecols = threadCols.querySelectorAll("treecol");
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
