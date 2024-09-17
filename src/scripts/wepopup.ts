// var ext = chrome.extension.getBackgroundPage();
// var CurrentNote = ext.CurrentNote;
// var note = ext.CurrentNote.note;

import { getElementByIdOrDie } from "../modules/common.mjs";
import { NoteDataRequest } from "../modules/Messages.mjs";

const urlParams = new URLSearchParams(window.location.search);
const keyId = urlParams.get("keyId");

if(!keyId){
	throw new Error("Missing query parameter: keyId");
}


const data = await (new NoteDataRequest()).sendMessage({ keyId });

console.log("Received data:", data);

// var YTextE = getElementByIdOrDie('qnote-text');

// function sfocus(f){
// 	if(ext.Prefs.focusOnDisplay){
// 		var isFocused = (document.activeElement === YTextE);
// 		if(!isFocused){
// 			f();
// 		}
// 	}
// }

// window.addEventListener("focus", () => {
// 	sfocus(() => YTextE.focus());
// });

// window.addEventListener("DOMContentLoaded", () => {
// 	sfocus(() => window.focus());
// 	YTextE.setAttribute("spellcheck", ext.Prefs.enableSpellChecker);
// });

// YTextE.value = note.text;

// if(note.title !== undefined){
// 	document.title = note.title;
// } else {
// 	document.title = 'QNote';
// 	if(note.ts){
// 		document.title += ': ' + ext.qDateFormat(note.ts);
// 	}
// }

// if(note.placeholder){
// 	YTextE.setAttribute("placeholder", note.placeholder);
// }

// const popupClose = () => {
// 	browser.windows.get(CurrentNote.windowId).then(Window => {
// 		note.left = window.screenX - Window.left;
// 		note.top = window.screenY - Window.top;
// 		note.height = window.outerHeight;
// 		note.width = window.outerWidth;
// 		note.text = YTextE.value;
// 	});
// }

// // We need additional Escape handler here, becauce main window is blured and it's handler won't work here
// document.addEventListener('keydown', e => {
// 	if(e.key == 'Escape'){
// 		CurrentNote.close();
// 		// CurrentNote.needSaveOnClose = false;
// 		// CurrentNote.silentlyPersistAndClose();
// 	}
// });

// YTextE.addEventListener("keyup", e => {
// 	popupClose();
// });

// window.addEventListener("resize", e => {
// 	popupClose();
// });

// // window.addEventListener('pagehide', e => {
// // 	popupClose();
// // 	// CurrentNote.silentlyPersistAndClose();
// // });
