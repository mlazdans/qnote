var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

var EXPORTED_SYMBOLS = ["NoteColumnHandler"];

class NoteColumnHandler {
	constructor(options) {
		console.log("new NoteColumnHandler()");
		this.windows = new WeakSet();
		this.options = options;

		let self = this;

		this.dBViewListener = {
			// onCreatedView: aFolderDisplay => {
			// },
			onActiveCreatedView: aFolderDisplay => {
				console.log("onActiveCreatedView()");

				try {
					self.addColumnHandler(aFolderDisplay.view.dbView);
				} catch(e) {
					console.error(e);
				}
			},
			onDestroyingView: (aFolderDisplay, aFolderIsComingBack) => {
				console.log("onDestroyingView");
				self.removeColumnHandler(aFolderDisplay.view.dbView);
			}
			// onMessagesLoaded: (aFolderDisplay, aAll) => {
			// 	console.log("onMessagesLoaded");
			// }
		};
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
			console.log(`${fName} - already attached`);
			return false;
		}

		if(!this.setUpDOM(w)){
			console.log(`${fName} - not attachable`);
			return false;
		}

		// if(!w.gDBView){
		// 	console.log(`${fName} - no view present`);
		// 	return false;
		// }

		// Keep track when changing folders
		if(w.FolderDisplayListenerManager) {
			// TODO: suggest listenerExists or smth
			let idx = w.FolderDisplayListenerManager._listeners.indexOf(this.dBViewListener);
			if (idx >= 0) {
				console.log(`${fName} - FolderDisplayListenerManager.registerListener() - already installed`);
			} else {
				console.log(`${fName} - FolderDisplayListenerManager.registerListener()`);
				w.FolderDisplayListenerManager.registerListener(this.dBViewListener);
			}
		} else {
			console.log(`${fName} - FolderDisplayListenerManager -not found-`);
		}

		this.addColumnHandler(w.gDBView);

		return this.windows.add(w);
	}

	detachFromWindow(w){
		let fName = `${this.constructor.name}.detachFromWindow()`;

		if(!this.windows.has(w)){
			console.log(`${fName} - window not found`);
			return false;
		}

		console.log(`${fName}`);

		if(w.FolderDisplayListenerManager) {
			console.log(`${fName} - FolderDisplayListenerManager.unregisterListener()`);
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

	setUpDOM(w) {
		let qnoteCol = w.document.getElementById("qnoteCol");

		// Don't bother if already added to DOM
		if(qnoteCol){
			return true;
		}

		let threadCols = w.document.getElementById("threadCols");

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

		ordinal = ordinal ?? this.xulStoreGet("ordinal");
		width = (width ?? this.xulStoreGet("width")) || 24;
		visible = visible ?? (this.xulStoreGet("hidden") !== true);

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
