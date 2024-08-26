import { DOMLocalizator } from "../modules/DOMLocalizator.mjs";
import { PushNoteMessage, QPopupDOMContentLoadedMessage } from "../modules/Messages.mjs";
import { NoteData } from "../modules/Note.mjs";
import { Preferences } from "../modules/Preferences.mjs";

var QDEB = true;
const urlParams = new URLSearchParams(window.location.search);
const idParam = urlParams.get("id");
const width = parseInt(urlParams.get("width") ?? "320");
const height = parseInt(urlParams.get("height") ?? "200");
// TODO: for multi note
// const placeholder = urlParams.get("placeholder") ?? "";

if(!idParam){
	throw new Error("Missing query parameter: id");
}

const id: number = parseInt(idParam);
if (isNaN(id)) {
	throw new Error(`Incorrect query parameter: id ${id}`);
}

QDEB&&console.debug("qpopup(content) new QPopup", id, width, height);

const i18n = new DOMLocalizator(browser.i18n.getMessage);
const YTextE = document.getElementById('note-text') as HTMLTextAreaElement;
const popupEl = document.querySelector('.qpopup') as HTMLTextAreaElement;
const titleEl = document.querySelector(".qpopup-title") as HTMLElement;
const titleTextEl = document.querySelector(".qpopup-title-text") as HTMLElement;
const resizeEl = document.querySelector(".qpopup-controls-resize") as HTMLElement;
const closeEl = document.querySelector(".qpopup-title-closebutton") as HTMLElement;
const delEl = document.querySelector("#note-delete") as HTMLElement;

if(!titleTextEl) throw new Error("titleTextEl not found");
if(!YTextE) throw new Error("YTextE not found");
if(!popupEl) throw new Error("popupEl not found");
if(!titleEl) throw new Error("titleEl not found");
if(!resizeEl) throw new Error("resizeEl not found");
if(!closeEl) throw new Error("closeEl not found");
if(!delEl) throw new Error("delEl not found");

var Note: NoteData;
var Prefs: Preferences;
// var Opts: QPopupOptions;

// function updateOpts(o: QPopupOptions){
// 	if(Opts.placeholder)YTextE.setAttribute("placeholder", Opts.placeholder);
// }

// if(placeholder)YTextE.setAttribute("placeholder", placeholder);

function updatePrefs(p: Preferences){
	Prefs = p;
	YTextE.setAttribute("spellcheck", Prefs.enableSpellChecker ? "true" : "false");
	if(Prefs.alwaysDefaultPlacement){
		resizeNote(Prefs.width, Prefs.height);
	}

}

function updateNote(n: NoteData){
	Note = n;
	YTextE.value = Note.text ?? "";

	let title = 'QNote';
	if(Note.tsFormatted){
		title += ': ' + Note.tsFormatted;
	}
	titleTextEl.textContent = title;


	if(Note.width){
		popupEl.style.width = Note.width + 'px';
	}

	if(Note.height){
		popupEl.style.height = Note.height + 'px';
	}

	if(Note.width && Note.height){
		resizeNote(Note.width, Note.height);
	}
}

function sfocus(f: Function){
	if(Prefs?.focusOnDisplay){
		var isFocused = (document.activeElement === YTextE);
		if(!isFocused){
			f();
		}
	}
}

window.addEventListener("focus", () => {
	sfocus(() => YTextE.focus());
});

window.addEventListener("DOMContentLoaded", () => {
	i18n.setTexts(document);

	resizeNote(width, height);

	sfocus(() => window.focus());

	let xulPort = browser.runtime.connect({
		name: "qpopup"
	});

	xulPort.onMessage.addListener(data => {
		let reply;
		if(reply = (new PushNoteMessage).parse(data)){
			updateNote(reply.note);
			updatePrefs(reply.prefs);
		} else {
			console.error("Unknown message: ", data);
		}
	});

	(new QPopupDOMContentLoadedMessage).post(xulPort, { id });
});

YTextE.addEventListener("keyup", e => {
	if(Note) {
		Note.text = YTextE.value;
	}
});

let tDrag = (mouse: MouseEvent) => {
	if(mouse.target === null){
		console.error("mouse.target is null");
		return;
	}

	let el = mouse.target as HTMLElement;
	// let startX = 0, startY = 0;

	el.style.cursor = 'move';

	// Some strange behaviour starting with 91
	// if(vers91<0){
	// 	startX = note.left;
	// 	startY = note.top;
	// }

	let mover = (e: MouseEvent) => {
		// let opts = structuredClone(Opts);

		// if(vers91<0){
		// 	opt = {
		// 		top: e.clientY - mouse.clientY + startY,
		// 		left: e.clientX - mouse.clientX + startX
		// 	};
		// } else {
		// 	opt = {
		// 		offsetTop: e.clientY - mouse.clientY,
		// 		offsetLeft: e.clientX - mouse.clientX
		// 	};
		// }

		const updateOpts: QPopupOptions = {
			id: id,
			offsetTop: e.clientY - mouse.clientY,
			offsetLeft: e.clientX - mouse.clientX,
		}

		browser.qpopup.update(updateOpts).then(pi => {
			if(Note && pi.top)Note.top = pi.top;
			if(Note && pi.left)Note.left = pi.left;
		});
	};

	let handleDragEnd = () => {
		window.removeEventListener("mousemove", mover);
		window.removeEventListener("mouseup", handleDragEnd);
		popupEl.style.opacity = '1';
		el.style.cursor = '';
	}

	window.addEventListener("mouseup", handleDragEnd);
	window.addEventListener("mousemove", mover);

	popupEl.style.opacity = '0.4';
};

function resizeNote(w: number, h: number){
	let rectLimit = {
		minWidth: 200,
		minHeight: 125,
		maxWidth: 800,
		maxHeight: 500
	};

	w = w > rectLimit.maxWidth ? rectLimit.maxWidth : w;
	w = w < rectLimit.minWidth ? rectLimit.minWidth : w;

	h = h > rectLimit.maxHeight ? rectLimit.maxHeight : h;
	h = h < rectLimit.minHeight ? rectLimit.minHeight : h;

	if(popupEl){
		popupEl.style.width = w + 'px';
		popupEl.style.height = h + 'px';
	} else {
		console.error("popupEl is gone");
	}

	if(Note){
		Note.width = w;
		Note.height = h;
	}
}

let tResize = (mouse: MouseEvent) => {
	let startX = mouse.clientX;
	let startY = mouse.clientY;
	let startW = popupEl.offsetWidth;
	let startH = popupEl.offsetHeight;

	let resizer = (e: MouseEvent) => {
		let w = startW + e.clientX - startX;
		let h = startH + e.clientY - startY;
		resizeNote(w, h);
	};

	let handleDragEnd = () => {
		window.removeEventListener("mousemove", resizer);
		window.removeEventListener("mouseup", handleDragEnd);
		popupEl.style.opacity = '1';
	}

	window.addEventListener("mouseup", handleDragEnd);
	window.addEventListener("mousemove", resizer);

	popupEl.style.opacity = '0.4';
};

let mDown = new WeakMap();

mDown.set(titleEl, tDrag);
mDown.set(titleTextEl, tDrag);
mDown.set(resizeEl, tResize);

const handleDragStart = (e: MouseEvent) => {
	if(e.target && mDown.has(e.target)){
		mDown.get(e.target)(e);
	}
}

window.addEventListener('mousedown', handleDragStart, false);

closeEl.addEventListener("click", e => {
	// ext.CurrentNote.silentlyPersistAndClose();
	browser.qpopup.remove(id);
});

delEl.addEventListener("click", e => {
	// ext.CurrentNote.silentlyDeleteAndClose();
	// ext.CurrentNote.close();
	browser.qpopup.remove(id);
});
