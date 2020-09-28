var ext = chrome.extension.getBackgroundPage();
var CurrentNote = ext.CurrentNote;
var note = ext.CurrentNote.note;

var YTextE = document.getElementById('qnote-text');
var popup = document.getElementById('popup');
var title = document.getElementById('title');
var contents = document.getElementById('contents');
var controls = document.getElementById('controls');

function resizePopup(w, h){
	popup.style.width = w + 'px';
	popup.style.height = h + 'px';
}

window.addEventListener('DOMContentLoaded', () => {
	var w = note.width || 0;
	var h = note.height || 0;

	w = w > 800 ? 800 : w;
	w = w < 160 ? 160 : w;

	h = h > 600 ? 600 : h;
	h = h < 120 ? 120 : h;

	resizePopup(w, h);
});

YTextE.focus();
YTextE.value = note.text;

if(note.ts){
	title.firstChild.textContent += 'QNote: ' + (new Date(note.ts)).toLocaleString();
	//console.log();
}

YTextE.addEventListener("keyup", (e)=>{
	note.text = YTextE.value;
});

// window.addEventListener("keyup", (e)=>{
// 	console.log("keyupa");
// 	if(e.key === 'Escape'){
// 		CurrentNote.needSave = false;
// 	}
// });

//var lastW, lastW, lastX, lastY;
// const popupClose = () => {
// 	note.x = lastX;
// 	note.y = lastY;
// 	note.width = lastW;
// 	note.height = lastH;
// 	note.text = YTextE.value;
// 	console.log("popupClose", popup, note);
// 	//CurrentNote.close();
// }

// window.addEventListener('keyup', (event) => {
// 	if(event.key == 'Escape'){
// 		console.log('esc');
// 		//popupClose();
// 		//CurrentNote.needSave = false;
// 		//ext.browser.windows.remove(CurrentNote.windowId);
// 	}
// });

// window.addEventListener('pagehide', (e) => {
// 	//console.log('pagehide!', e);
// 	//popupClose();
// });

// function outputsize(e) {
// 	lastW = popup.offsetWidth;
// 	lastH = popup.offsetHeight;
// 	lastX = window.screenX;
// 	lastY = window.screenY;
// 	console.log(lastX, lastY, lastW, lastH);
// }

// window.addEventListener('DOMContentLoaded', () => {
// 	//console.log("load", document.readyState);
// 	new ResizeObserver(outputsize).observe(popup);
// });
