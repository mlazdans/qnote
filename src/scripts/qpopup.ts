import { DOMLocalizator } from "../modules/DOMLocalizator.mjs";
import { RestoreFocus } from "../modules/Messages.mjs";
import { IPopupState } from "../modules/NotePopups.mjs";
import { querySelectorOrDie } from "../modules/common.mjs";

let QDEB = true;

QDEB&&console.debug("qpopup(content) new QPopup: ");

// NOTE: keep this code around for now
// let queuedUpdates: IPopupState = {};
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

// function qpopupUpdateLazy(updates?: IPopupState): void {
// 	updateActivityTs = Date.now();
// 	Object.assign(queuedUpdates, updates);

// 	if(!timerId){
// 		timerId = setTimeout(qpopupUpdate, 500);
// 	}
// }

const urlParams = new URLSearchParams(window.location.search);
const idParam = urlParams.get("id");

if(!idParam){
	throw new Error("Missing query parameter: id");
}

const id = parseInt(idParam);

if (isNaN(id)) {
	throw new Error(`Incorrect value for query parameter id: ${id}`);
}

const State: IPopupState = { };
const i18n = new DOMLocalizator(browser.i18n.getMessage);

const popupEl      = querySelectorOrDie('.qpopup') as HTMLDivElement;
const titleTextEl  = querySelectorOrDie(".qpopup-title-text") as HTMLElement;
const closeEl      = querySelectorOrDie(".qpopup-button-close") as HTMLElement;
const YTextE       = querySelectorOrDie('.qpopup-textinput') as HTMLTextAreaElement;
const resizeEl     = querySelectorOrDie(".qpopup-controls-resize") as HTMLElement;
const delEl        = querySelectorOrDie(".qpopup-button-delete") as HTMLElement;
const screenshotEl = querySelectorOrDie(".qpopup-button-screenshot") as HTMLElement;
const resetEl      = querySelectorOrDie(".qpopup-button-reset") as HTMLElement;
const saveEl       = querySelectorOrDie(".qpopup-button-save") as HTMLElement;

function updateElements(state: IPopupState){
	YTextE.setAttribute("spellcheck", state.enableSpellChecker ? "true" : "false");
	if(state.text)YTextE.value = state.text;
	if(state.title)titleTextEl.textContent = state.title;
	if(state.width && state.height)resizeNote(state.width, state.height);
	if(state.placeholder)YTextE.setAttribute("placeholder", state.placeholder);
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
		QDEB&&console.warn("popupEl is gone");
	}
}

function popup(){
	i18n.setTexts(document);

	closeEl.addEventListener     ("click", () => browser.qpopup.close(id, "close"));
	saveEl.addEventListener      ("click", () => browser.qpopup.close(id, "close"));
	delEl.addEventListener       ("click", () => {
		if(!State.confirmDelete || confirm(i18n._("delete.note"))){
			browser.qpopup.close(id, "delete");
		}
	});
	screenshotEl.addEventListener("click", () => {
		browser.qpopup.takeScreenshot(id).then(result => {
			if(result){
				screenshotEl.animate({
					backgroundSize: ["80%", "100%"],
					easing: ["ease-in"],
				}, 1000).addEventListener("finish", () => {
					screenshotEl.classList.add('qpopup-button-screenshot-taken');
					setTimeout(() => {
						screenshotEl.animate({
							backgroundSize: ["100%", "80%"],
							easing: ["ease-out"],
						}, 1000).addEventListener("finish", () => {
							screenshotEl.classList.remove('qpopup-button-screenshot-taken');
						});
					}, 2000);
				});
			}
		});
	});
	resetEl.addEventListener     ("click", () => browser.qpopup.resetPosition(id));
	YTextE.addEventListener      ("keyup", () => browser.qpopup.update(id, { text: YTextE.value }));

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
			browser.qpopup.setPanelStyle(id, { opacity: "1" });
			el.style.cursor = '';
		}

		window.addEventListener("mouseup", handleDragEnd);
		window.addEventListener("mousemove", mover);

		browser.qpopup.setPanelStyle(id, { opacity: "0.6" });
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
			browser.qpopup.setPanelStyle(id, { opacity: "1" });
		}

		window.addEventListener("mouseup", handleDragEnd);
		window.addEventListener("mousemove", resizer);

		browser.qpopup.setPanelStyle(id, { opacity: "0.5" });
	};

	const mDown = new WeakMap();

	mDown.set(titleTextEl, tDrag);
	mDown.set(resizeEl, tResize);

	const handleDragStart = (e: MouseEvent) => {
		if(e.target && mDown.has(e.target)){
			mDown.get(e.target)(e);
		}
	}

	window.addEventListener('mousedown', handleDragStart, false);
	window.addEventListener("focus", () => YTextE.focus());

	if(!State.focusOnDisplay){
		setTimeout(() => (new RestoreFocus).sendMessage(), 100); // NOTE: arbitrary 100ms. Probably should attach to some event or smth
	} else {
		YTextE.focus();
	}
}

document.addEventListener("keyup", (e) => {
	if(e.key == "Escape"){
		browser.qpopup.close(id, "escape");
	}
});

window.addEventListener("DOMContentLoaded", () => {
	browser.qpopup.get(id).then(state => {
		Object.assign(State, state);
		updateElements(State);
		popup();
	});
});
