import { DOMLocalizator } from "../modules/DOMLocalizator.mjs";
import { IPopupOptions } from "../modules/NotePopups.mjs";
import { getElementByIdOrDie, querySelectorOrDie } from "../modules/common.mjs";

let QDEB = true;

QDEB&&console.debug("qpopup(content) new QPopup: ");

// NOTE: keep this code around for now
// let queuedUpdates: IPopupOptions = {};
// let updateActivityTs = Date.now();
// let timerId: number | undefined;

// async function qpopupUpdate(): Promise<void> {
// 	const diffTs = Date.now() - updateActivityTs;

// 	console.log("updateActivityTs", diffTs);

// 	if(diffTs > 500){
// 		console.log("finally sending updates!");
// 		await browser.qpopup.update(id, queuedUpdates);
// 		timerId = undefined;
// 	} else {
// 		timerId = setTimeout(qpopupUpdate, 200);
// 	}
// }

// function qpopupUpdateLazy(updates?: IPopupOptions): void {
// 	updateActivityTs = Date.now();
// 	Object.assign(queuedUpdates, updates);

// 	if(!timerId){
// 		timerId = setTimeout(qpopupUpdate, 500);
// 	}
// }

const urlParams = new URLSearchParams(window.location.search);
const idParam = urlParams.get("id");
// const width = parseInt(urlParams.get("width") ?? "320");
// const height = parseInt(urlParams.get("height") ?? "200");
// const placeholder = urlParams.get("placeholder") ?? ""; // TODO: for multi note

if(!idParam){
	throw new Error("Missing query parameter: id");
}

const id = parseInt(idParam);

if (isNaN(id)) {
	throw new Error(`Incorrect value for query parameter id: ${id}`);
}

const Opts: IPopupOptions = { };
const i18n = new DOMLocalizator(browser.i18n.getMessage);

const YTextE      = getElementByIdOrDie('note-text') as HTMLTextAreaElement;
const popupEl     = querySelectorOrDie('.qpopup') as HTMLTextAreaElement;
const titleEl     = querySelectorOrDie(".qpopup-title") as HTMLElement;
const titleTextEl = querySelectorOrDie(".qpopup-title-text") as HTMLElement;
const resizeEl    = querySelectorOrDie(".qpopup-controls-resize") as HTMLElement;
const closeEl     = querySelectorOrDie(".qpopup-title-closebutton") as HTMLElement;
const delEl       = querySelectorOrDie("#note-delete") as HTMLElement;

function updateElements(state: IPopupOptions){
	YTextE.setAttribute("spellcheck", state.enableSpellChecker ? "true" : "false");
	if(state.text)YTextE.value = state.text;
	if(state.title)titleTextEl.textContent = state.title;
	if(state.width && state.height)resizeNote(state.width, state.height);
	if(state.placeholder)YTextE.setAttribute("placeholder", state.placeholder);
}

function setFocus(f: CallableFunction){
	if(Opts.focusOnDisplay){
		var isFocused = (document.activeElement === YTextE);
		if(!isFocused){
			f();
		}
	}
}

function resizeNote(w: number, h: number){
	const rectLimit = {
		minWidth: 200,
		minHeight: 125,
		maxWidth: 800,
		maxHeight: 500
	};

	let width, height;

	width = w > rectLimit.maxWidth ? rectLimit.maxWidth : w;
	width = w < rectLimit.minWidth ? rectLimit.minWidth : w;

	height = h > rectLimit.maxHeight ? rectLimit.maxHeight : h;
	height = h < rectLimit.minHeight ? rectLimit.minHeight : h;

	if(popupEl){
		browser.qpopup.update(id, { width, height });
		popupEl.style.width = w + 'px';
		popupEl.style.height = h + 'px';
	} else {
		console.error("popupEl is gone");
	}
}

function popup(){
	i18n.setTexts(document);

	setFocus(() => window.focus());

	closeEl.addEventListener("click", () => browser.qpopup.close(id, "close"));
	delEl.addEventListener("click", () => browser.qpopup.close(id, "delete"));
	window.addEventListener("focus", () => setFocus(() => YTextE.focus()));
	YTextE.addEventListener("keyup", () => browser.qpopup.update(id, { text: YTextE.value }));

	const tDrag = (mouse: MouseEvent) => {
		if(mouse.target === null){
			console.error("mouse.target is null");
			return;
		}

		const el = mouse.target as HTMLElement;

		el.style.cursor = 'move';

		const mover = (e: MouseEvent) => {
			const offsetTop = e.clientY - mouse.clientY;
			const offsetLeft = e.clientX - mouse.clientX;

			browser.qpopup.update(id, { offsetTop, offsetLeft });
		};

		const handleDragEnd = () => {
			window.removeEventListener("mousemove", mover);
			window.removeEventListener("mouseup", handleDragEnd);
			popupEl.style.opacity = '1';
			el.style.cursor = '';
		}

		window.addEventListener("mouseup", handleDragEnd);
		window.addEventListener("mousemove", mover);

		popupEl.style.opacity = '0.4';
	};

	const tResize = (mouse: MouseEvent) => {
		const startX = mouse.clientX;
		const startY = mouse.clientY;
		const startW = popupEl.offsetWidth;
		const startH = popupEl.offsetHeight;

		const resizer = (e: MouseEvent) => {
			const w = startW + e.clientX - startX;
			const h = startH + e.clientY - startY;
			resizeNote(w, h);
		};

		const handleDragEnd = () => {
			window.removeEventListener("mousemove", resizer);
			window.removeEventListener("mouseup", handleDragEnd);
			popupEl.style.opacity = '1';
		}

		window.addEventListener("mouseup", handleDragEnd);
		window.addEventListener("mousemove", resizer);

		popupEl.style.opacity = '0.4';
	};

	const mDown = new WeakMap();

	mDown.set(titleEl, tDrag);
	mDown.set(titleTextEl, tDrag);
	mDown.set(resizeEl, tResize);

	const handleDragStart = (e: MouseEvent) => {
		if(e.target && mDown.has(e.target)){
			mDown.get(e.target)(e);
		}
	}

	window.addEventListener('mousedown', handleDragStart, false);
}

document.addEventListener("keyup", (e) => {
	if(e.key == "Escape"){
		browser.qpopup.close(id, "escape");
	}
});

window.addEventListener("DOMContentLoaded", () => {
	browser.qpopup.get(id).then(state => {
		Object.assign(Opts, state);
		updateElements(Opts);
		popup();
	});
});
