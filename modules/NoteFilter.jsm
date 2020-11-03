var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { QuickFilterManager, MessageTextFilter, QuickFilterSearchListener } = ChromeUtils.import("resource:///modules/QuickFilterManager.jsm");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");

var EXPORTED_SYMBOLS = ["NoteFilter"];

var NoteFilter = {};

// NOTE:
// We need to completely restart TB if filter code changes
// Currenlty there are no means to remove filter or there are but I'm not aware, please let me know qnote@dqdp.net

{
let noteGrabber;

NoteFilter.install = options => {
	NoteFilter.options = options;
	noteGrabber = options.noteGrabber;

	var ops = [Ci.nsMsgSearchOp.Contains, Ci.nsMsgSearchOp.DoesntContain, Ci.nsMsgSearchOp.Is, Ci.nsMsgSearchOp.Isnt];

	var w = Services.wm.getMostRecentWindow("mail:3pane");

	// TODO: check if exists
	if(!w.document.getElementById('qfb-qs-qnote-text')){
		let button = w.document.createXULElement('toolbarbutton');
		button.setAttribute('id','qfb-qs-qnote-text');
		button.setAttribute('type','checkbox');
		button.setAttribute('class','toolbarbuton-1');
		button.setAttribute('label', 'QNote');

		let filterBar = w.document.getElementById("quick-filter-bar-filter-text-bar");
		let senderButton = w.document.getElementById("qfb-qs-sender");
		filterBar.insertBefore(button, senderButton);
	}

	let quickfChecked = w.document.getElementById('qfb-qs-qnote-text');

	let buttonHandler = function(aEvent) {
		//console.log("handlerC", quickfChecked.checked);
		let aMuxer = w.QuickFilterBarMuxer;
		// let state = aMuxer.getFilterValueForMutation(MessageTextFilter.name);
		// let filterDef = MessageTextFilter.textFilterDefsByDomId[aEvent.target.id];
		// //console.log("handlerC", aEvent.target, state, filterDef);
		// state.states[filterDef.name] = aEvent.target.checked;
		// console.log("aMuxer.activeFilterer", aMuxer.activeFilterer, state);
		// aMuxer.updateSearch();
		// try {
			//let postValue = quickfChecked.checked ? true : null;
		// 	//console.log(w.QuickFilterBarMuxer.activeFilterer);
		if(quickfChecked.checked){
			aMuxer.activeFilterer.setFilterValue('qnote', true);
		} else {
			aMuxer.activeFilterer.setFilterValue('qnote', null);
		}
		aMuxer.deferredUpdateSearch();
		// } catch (e) {
		// 	console.error(e);
		// }
	};
	quickfChecked.addEventListener("command", buttonHandler);

	var customTerm = {
		id: 'qnote@dqdp.net#qnoteText',
		name: 'QNote',
		needsBody: false,
		getEnabled: function(scope, op) {
			//console.log("getEnabled", scope, op);
			return true;
			//return op === Ci.nsMsgSearchOp.Contains;
		},
		getAvailable: function(scope, op) {
			let ret = ops.includes(op);
			//console.log("getAvailable", scope, op, ret);
			return ret;
			//return op === Ci.nsMsgSearchOp.Contains;
		},
		getAvailableOperators: function(scope, length) {
			//console.log("getAvailableOperators", scope);

			if(length){
				length.value = ops.length;
			}

			return ops;
		},
		match: function(msgHdr, searchValue, searchOp) {
			let note = noteGrabber.getNote(msgHdr.messageId);

			if(!note || !note.exists){
				return false;
			}

			var match = note.text.search(searchValue)>=0;
			//console.log("match", msgHdr.messageId, note, match, searchOp);

			return match;
		}
	};

	if(MailServices.filters.getCustomTerm(customTerm.id)){
		//console.log("customTerm exists");
	} else {
		MailServices.filters.addCustomTerm(customTerm);
	}

	QuickFilterManager.defineFilter({
		name: "qnote",
		domId: "qfb-qs-qnote-text",
		// propagateState: function(aTemplState, aSticky){
		// 	console.log("propagateState", aTemplState, aSticky);
		// },
		onCommand: function(aState, aNode, aEvent, aDocument){
			console.log("onCommand", aState, aNode, aEvent, aDocument);
			//return [aState, false];
		},
		appendTerms: function(aTermCreator, aTerms, aFilterValue) {
			let text = w.document.getElementById('qfb-qs-textbox').value;
			// Let us borrow an existing code just for a while :>
			let phrases = MessageTextFilter._parseSearchString(text);
			let term;
			let firstClause = true;

			for (let kw of phrases) {
				term = aTermCreator.createTerm();

				let value = term.value;
				value.str = kw;

				term.value = value;
				term.attrib = Ci.nsMsgSearchAttrib.Custom;
				term.customId = customTerm.id;
				term.op = Ci.nsMsgSearchOp.Contains;
				term.booleanAnd = !firstClause; // We need OR-ed with other QuickFilters and AND-ed with phrases
				term.beginsGrouping = firstClause;

				aTerms.push(term);

				firstClause = false;
			}
			if (term) {
				term.endsGrouping = true;
			}
		},
		domBindExtra: function(aDocument, aMuxer, aNode){
			console.log("domBindExtra", aDocument, aMuxer, aNode);
		}
	});

	//var terms = MailServices.filters.getCustomTerms();
	//var a = terms.QueryInterface(Ci.nsIMutableArray);
	//console.log("terms", terms, a);
	// while (terms.hasMoreElements()) {
	// 	var f = terms.getNext().QueryInterface(Ci.nsIMsgSearchCustomTerm);
	// 	console.log("term", f);
	// }

	// MessageTextFilter.defineTextFilter({
	// 	name: "qnote",
	// 	domId: "qfb-qs-qnote-text",
	// 	attrib: Ci.nsMsgSearchAttrib.Custom,
	// 	//attrib: Ci.nsMsgSearchAttrib.Subject,
	// 	defaultState: false,
	// 	customId: customTerm.id
	// 	// ,
	// 	// appendTerms: function(aTermCreator, aTerms, aFilterValue) {
	// 	// 	console.log("appendTerms TXT");
	// 	// 	// let text=w.document.getElementById('qfb-qs-textbox').value;
	// 	// 	// // console.log(aTermCreator, aTerms, aFilterValue, text);
	// 	// 	// if (text) {
	// 	// 	// 	searchTerm(text, aTermCreator, aTerms);
	// 	// 	// }
	// 	// },
	// 	// onCommand: function(aState, aNode, aEvent, aDocument){
	// 	// 	console.log("onCommand", aState, aNode, aEvent, aDocument);
	// 	// 	return [aState, false];
	// 	// }
	// });
};

NoteFilter.uninstall = () => {
	// Uninstall quick filter
	var w = Services.wm.getMostRecentWindow("mail:3pane");
	var quickfChecked = w.document.getElementById('qfb-qs-qnote-text');
	if(quickfChecked){
		quickfChecked.parentNode.removeChild(qnoteQF);
	}

	// TODO: need to remove before shutdown
	//var aMuxer = gW.QuickFilterBarMuxer;
	//aMuxer.activeFilterer.setFilterValue('qnote', null);

	QuickFilterManager.filterDefs = QuickFilterManager.filterDefs.filter(e => e.name != 'qnote');
	delete QuickFilterManager.filterDefsByName['qnote'];
}
}
