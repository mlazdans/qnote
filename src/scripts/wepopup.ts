import { IPopupCloseReason } from "../modules-exp/api.mjs";
import { querySelectorOrDie } from "../modules/common.mjs";
import { DOMLocalizator } from "../modules/DOMLocalizator.mjs";
import { PopupDataReply, PopupDataRequest, RestoreFocus, SyncNote } from "../modules/Messages.mjs";
import { IPopupState, state2note } from "../modules/NotePopups.mjs";

const urlParams = new URLSearchParams(window.location.search);
const keyId = urlParams.get("keyId")!;

if(!keyId){
	throw new Error("Missing query parameter: keyId");
}

const State: IPopupState = {};
const i18n = new DOMLocalizator(browser.i18n.getMessage);

const titleTextEl  = querySelectorOrDie(".qpopup-title-text") as HTMLElement;
const closeEl      = querySelectorOrDie(".qpopup-button-close") as HTMLElement;
const YTextE       = querySelectorOrDie('.qpopup-textinput') as HTMLTextAreaElement;
const delEl        = querySelectorOrDie(".qpopup-button-delete") as HTMLElement;
// TODO: resetEl
const resetEl      = querySelectorOrDie(".qpopup-button-reset") as HTMLElement;
const saveEl       = querySelectorOrDie(".qpopup-button-save") as HTMLElement;

function updateElements(state: IPopupState){
	YTextE.setAttribute("spellcheck", state.enableSpellChecker ? "true" : "false");
	if(state.text)YTextE.value = state.text;
	if(state.title)titleTextEl.textContent = state.title;
	// if(state.width && state.height)resizeNote(state.width, state.height);
	if(state.placeholder)YTextE.setAttribute("placeholder", state.placeholder);
}

function updateNoteData(){
	State.text = YTextE.value;
	State.left = window.screenX;
	State.top = window.screenY;
	State.width = window.outerWidth;
	State.height = window.outerHeight;
}

function popup(){
	i18n.setTexts(document);

	closeEl.addEventListener     ("click", () => customClose("close"));
	saveEl.addEventListener      ("click", () => customClose("close"));
	delEl.addEventListener       ("click", () => {
		if(!State.confirmDelete || confirm(i18n._("delete.note"))){
			customClose("delete");
		}
	});
	// resetEl.addEventListener     ("click", () => browser.qpopup.resetPosition(id));

	window.addEventListener("resize", updateNoteData);
	window.addEventListener("focus", () => YTextE.focus());
	YTextE.addEventListener("keyup", updateNoteData);
	document.addEventListener("keyup", e => {
		if(e.key == "Escape"){
			customClose("escape");
		}

		if(!e.repeat && e.altKey && (e.key == "Q" || e.key == "q")){
			customClose("close");
		}
	});

	if(!State.focusOnDisplay){
		setTimeout(() => (new RestoreFocus).sendMessage(), 100); // NOTE: arbitrary 100ms. Probably should attach to some event or smth
	} else {
		YTextE.focus();
	}
}

function sendNoteData(reason: IPopupCloseReason){
	return (new SyncNote).sendMessage({
		keyId: keyId,
		reason: reason,
		noteData: state2note(State)
	});
}

function customClose(reason: IPopupCloseReason){
	sendNoteData(reason).then(() => window.close());
}

window.addEventListener("DOMContentLoaded", async () => {
	const reply = await (new PopupDataRequest()).sendMessage({ keyId });
	const data = (new PopupDataReply).parse(reply);

	if(data){
		Object.assign(State, data.state);
		updateElements(State);
		popup();
	}
});

document.addEventListener("visibilitychange", () => {
	sendNoteData("sync"); // Sync data and later will save if needed, e.g., window closed by command or forcibly
});
