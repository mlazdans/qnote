var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

var EXPORTED_SYMBOLS = ["NoteColumnHandler"];

class NoteColumnHandler {
	constructor(options) {
		console.debug("new NoteColumnHandler()");
		this.windows = new WeakSet();
		this.options = options;

		let self = this;

		// this.windowObserver = {
		// 	observe: function(aSubject, aTopic) {
		// 		if(aTopic === 'domwindowopened'){
		// 			aSubject.addEventListener("DOMContentLoaded", e => {
		// 				let document = e.target;
		// 				let threadCols = document.getElementById("threadCols");

		// 				if(threadCols) {
		// 					self.attachToWindow(aSubject);
		// 				}
		// 			});
		// 		}
		// 	}
		// };

		// Services.ww.registerNotification(this.windowObserver);

		this.dBViewListener = {
			onCreatedView: aFolderDisplay => {
				console.log("onCreatedView");
			},
			onActiveCreatedView: aFolderDisplay => {
				console.log("onActiveCreatedView");

				try {
					aFolderDisplay.view.dbView.addColumnHandler("qnoteCol", options.columnHandler);
				} catch(e) {
					console.error(e);
				}
			},
			onDestroyingView: (aFolderDisplay, aFolderIsComingBack) => {
				console.log("onDestroyingView");
				self.removeColumnHandlerFromFolder(aFolderDisplay);
			}
			// onMessagesLoaded: (aFolderDisplay, aAll) => {
			// 	console.log("onMessagesLoaded");
			// }
		};
	}

	attachToWindow(w){
		let fName = `${this.constructor.name}.attachToWindow()`;

		if(this.windows.has(w)){
			console.debug(`${fName} - already attached`);
			return false;
		}

		console.debug(`${fName}`);

		this.setUpDOM(w);

		w.FolderDisplayListenerManager.registerListener(this.dBViewListener);

		this.dBViewListener.onActiveCreatedView(w.gFolderDisplay);

		return this.windows.add(w);
	}

	detachFromWindow(w){
		let fName = `${this.constructor.name}.detachFromWindow()`;

		if(!this.windows.has(w)){
			console.debug(`${fName} - window not found`);
			return false;
		}

		console.debug(`${fName}`);

		w.FolderDisplayListenerManager.unregisterListener(this.dBViewListener);

		this.removeColumnHandlerFromFolder(w.gFolderDisplay);

		// If we remove from DOM then column properties does not get saved
		// if(qnoteCol = w.document.getElementById("qnoteCol")){
		// 	//qnoteCol.parentNode.removeChild(qnoteCol.previousSibling); // Splitter
		// 	qnoteCol.parentNode.removeChild(qnoteCol);
		// }

		return this.windows.delete(w);
	}

	removeColumnHandlerFromFolder(aFolderDisplay){
		try {
			aFolderDisplay.view.dbView.removeColumnHandler("qnoteCol");
		} catch (e) {
			console.error(e);
		}
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
		let threadCols = w.document.getElementById("threadCols");
		let qnoteCol = w.document.getElementById("qnoteCol");
		let aFolderDisplay = w.gFolderDisplay;

		if(qnoteCol || !threadCols){
			return;
		}

		let colStates = aFolderDisplay.getColumnStates();
		let newState = Object.assign({}, colStates.qnoteCol);

		let width;
		let { ordinal, visible } = newState;

		// Not sure what and where gets saved. I'm guessing `ordinal/visible` are stored within folder column states and `width` using xulstore?
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

		colStates.qnoteCol = newState;

		aFolderDisplay.setColumnStates(colStates, true);

		return true;
	}
};
