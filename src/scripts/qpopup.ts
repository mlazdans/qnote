import { DOMLocalizator } from "../modules/DOMLocalizator.mjs";
import { RestoreFocus } from "../modules/Messages.mjs";
import { IPopupState } from "../modules/NotePopups.mjs";
import { querySelectorOrDie } from "../modules/common.mjs";

console.debug("qpopup(content) new QPopup: ");

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
	throw new Error(`Incorrect query parameter value for id: ${id}`);
}

// Disabled for now. Need more testing on retina displays.
// let pixelRatio = window.devicePixelRatio || window.screen.availWidth / document.documentElement.clientWidth;
let pixelRatio = 1;
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
	// if(state.width && state.height)resizeNote(state.width, state.height);
	if(state.width && state.height){
		popupEl.style.width = `100%`;
		popupEl.style.height = `100%`;
	}
	if(state.placeholder)YTextE.setAttribute("placeholder", state.placeholder);
}

function limitPanelSize(w: number, h: number){
	const rectLimit = {
		minWidth: 200,
		minHeight: 125,
		maxWidth: 800,
		maxHeight: 500
	};

	let width, height;

	width = Math.max(Math.min(w, rectLimit.maxWidth), rectLimit.minWidth);
	height = Math.max(Math.min(h, rectLimit.maxHeight), rectLimit.minHeight);

	return { width, height }
}

function scale(w: number, h: number, pixelRatio: number){
	const width = Math.floor(w * pixelRatio);
	const height = Math.floor(h * pixelRatio);

	return { width, height };
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

	let amDragging = false;
	const tDrag = (mouse: PointerEvent) => {
		mouse.preventDefault();

		let { screenX, screenY } = mouse;

		const el = mouse.target as HTMLElement;
		el.style.cursor = 'move';

		const mover = (e: PointerEvent) => {
			e.preventDefault();

			if(amDragging)return;

			const offsetTop = Math.floor((e.screenY - screenY) * pixelRatio);
			const offsetLeft = Math.floor((e.screenX - screenX) * pixelRatio);

			({ screenX, screenY } = e);

			if(offsetTop || offsetLeft){
				amDragging = true;
				browser.qpopup.update(id, { offsetLeft, offsetTop }).finally(() => amDragging = false);
			}
		};

		const handleDragEnd = (e: PointerEvent) => {
			e.preventDefault();
			window.removeEventListener("pointermove", mover);
			window.removeEventListener("pointerup", handleDragEnd);
			(e.target as Element).releasePointerCapture(e.pointerId);
			browser.qpopup.setPanelStyle(id, { opacity: "1" });
			el.style.cursor = '';
		}

		window.addEventListener("pointerup", handleDragEnd);
		window.addEventListener("pointermove", mover);

		browser.qpopup.setPanelStyle(id, { opacity: "0.6" });
	};

	let amResizing = false;
	const tResize = (mouse: PointerEvent) => {
		mouse.preventDefault();
		const startX = mouse.screenX;
		const startY = mouse.screenY;
		const startW = popupEl.offsetWidth;
		const startH = popupEl.offsetHeight;

		function handleDragEnd(e: PointerEvent) {
			e.preventDefault();
			window.removeEventListener("pointermove", resizer);
			window.removeEventListener("pointerup", handleDragEnd);
			(e.target as Element).releasePointerCapture(e.pointerId);
			browser.qpopup.setPanelStyle(id, { opacity: "1" });
		}

		let oldW = -1, oldH = -1;

		function resizer(e: PointerEvent) {
			e.preventDefault();

			if(amResizing)return;

			if(!e.buttons){
				handleDragEnd(e);
				return;
			}

			const limiter = limitPanelSize(startW + e.screenX - startX, startH + e.screenY - startY);

			if(limiter.width != oldW || limiter.height != oldH){
				amResizing = true;

				browser.qpopup.update(id, scale(limiter.width, limiter.height, pixelRatio)).finally(() => {
					oldW = limiter.width;
					oldH = limiter.height;
					amResizing = false;
				});
			}
		};

		window.addEventListener("pointerup", handleDragEnd);
		window.addEventListener("pointermove", resizer);

		browser.qpopup.setPanelStyle(id, { opacity: "0.5" });
	};

	const mDown = new WeakMap();

	mDown.set(titleTextEl, tDrag);
	mDown.set(resizeEl, tResize);

	const handleDragStart = (e: PointerEvent) => {
		if(e.target && mDown.has(e.target)){
			e.preventDefault();
			(e.target as Element).setPointerCapture(e.pointerId);
			mDown.get(e.target)(e);
		}
	}

	window.addEventListener('pointerdown', handleDragStart);
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

// window.addEventListener("resize", () => {
// 	let newPixelRatio = window.devicePixelRatio || window.screen.availWidth / document.documentElement.clientWidth;
// 	if(pixelRatio != newPixelRatio){
// 		pixelRatio = newPixelRatio;
// 	}
// });
