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
	throw new Error(`Incorrect query parameter value for id: ${id}`);
}

const isRemote = true; // panel attribute remote=true?
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
	const tDrag = (mouse: MouseEvent) => {
		let startX = mouse.screenX;
		let startY = mouse.screenY;

		const el = mouse.target as HTMLElement;
		el.style.cursor = 'move';

		const mover = (e: MouseEvent) => {
			if(amDragging){
				console.debug("Already dragging, bail");
				return;
			}

			amDragging = true;
			// requestAnimationFrame(() => {
				const offsetTop = e.screenY - startY;
				const offsetLeft = e.screenX - startX;
				if(isRemote){
					startX = e.screenX;
					startY = e.screenY;
				}
				browser.qpopup.update(id, { offsetLeft, offsetTop }).finally(() => amDragging = false);
			// });
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

	let amResizing = false;
	const tResize = (mouse: PointerEvent) => {
		const startX = mouse.screenX;
		const startY = mouse.screenY;
		const startW = popupEl.offsetWidth;
		const startH = popupEl.offsetHeight;

		function handleDragEnd(e: PointerEvent) {
			// e.preventDefault();
			// e.stopPropagation();
			// window.removeEventListener("mousemove", resizer);
			// window.removeEventListener("mouseup", handleDragEnd);
			window.removeEventListener("pointermove", resizer);
			window.removeEventListener("pointerup", handleDragEnd);
			(e.target as Element).releasePointerCapture(e.pointerId);
			browser.qpopup.setPanelStyle(id, { opacity: "1" });
		}

		let oldW = -1, oldH = -1;

		function resizer(e: PointerEvent) {
			if(!e.buttons){
				handleDragEnd(e);
				return;
			}

			// e.preventDefault();
			// e.stopPropagation();

			const limiter = limitPanelSize(startW + e.screenX - startX, startH + e.screenY - startY);

			if(limiter.width != oldW || limiter.height != oldH){
				if(amResizing){
					console.debug("Already resizing, bail");
					return;
				}

				amResizing = true;

				// requestAnimationFrame(async () => {
					browser.qpopup.update(id, limiter).finally(() => {
						amResizing = false;
						oldW = limiter.width;
						oldH = limiter.height;
						console.log("finally", e.buttons);
					});
					// resizeNote(startW + e.screenX - startX, startH + e.screenY - startY).finally(() => amResizing = false);
				// });
			}
		};

		// window.addEventListener("mouseup", handleDragEnd);
		// window.addEventListener("mousemove", resizer);
		window.addEventListener("pointerup", handleDragEnd);
		window.addEventListener("pointermove", resizer);

		browser.qpopup.setPanelStyle(id, { opacity: "0.5" });
	};

	const mDown = new WeakMap();

	mDown.set(titleTextEl, tDrag);
	mDown.set(resizeEl, tResize);

	const handleDragStart = (e: PointerEvent) => {
		if(e.target && mDown.has(e.target)){
			// e.preventDefault();
			// e.stopPropagation();
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

let oldPixelRatio = window.devicePixelRatio || window.screen.availWidth / document.documentElement.clientWidth;
window.addEventListener("resize", () => {
	const pixelRatio = window.devicePixelRatio || window.screen.availWidth / document.documentElement.clientWidth;
	if(pixelRatio != oldPixelRatio){
		requestAnimationFrame(() => {
			popupEl.style.display = 'none';
			popupEl.style.display = '';
		});
		oldPixelRatio = pixelRatio;
	}
});
