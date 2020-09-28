var ext = chrome.extension.getBackgroundPage();
var note = ext.CurrentNote.note;

var YTextE = document.getElementById('qnote-text');
var popup = document.getElementById('popup');
var title = document.getElementById('title');

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

title.firstChild.textContent = 'QNote: ';
if(note.ts){
	title.firstChild.textContent += (new Date(note.ts)).toLocaleString();
}

YTextE.addEventListener("keyup", (e)=>{
	note.text = YTextE.value;
});
