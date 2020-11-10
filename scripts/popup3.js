var ext = chrome.extension.getBackgroundPage();
var _ = browser.i18n.getMessage;
var note = ext.CurrentNote.note;

var YTextE = document.getElementById('qnote-text');
var popup = document.getElementById('popup');
var title = document.getElementById('title');

for (const node of document.querySelectorAll('div.close')) {
	node.title = _('close.and.save');
}

for (const node of document.querySelectorAll('div.delete')) {
	node.title = _('delete');
}

if(ext.Prefs.focusOnDisplay || !note || !note.text){
	YTextE.focus();
}

YTextE.value = note.text;

title.firstChild.textContent = 'QNote: ';
if(note.ts){
	title.firstChild.textContent += (new Date(note.ts)).toLocaleString();
}

// function resizePopup(w, h){
// 	popup.style.width = w + 'px';
// 	popup.style.height = h + 'px';
// }

// window.addEventListener('DOMContentLoaded', () => {
// 	// TODO: move to separate function
// 	var w = note.width || 0;
// 	var h = note.height || 0;

// 	w = w > 800 ? 800 : w;
// 	w = w < 160 ? 160 : w;

// 	h = h > 600 ? 600 : h;
// 	h = h < 120 ? 120 : h;

// 	resizePopup(w, h);
// });

YTextE.addEventListener("keyup", (e)=>{
	note.text = YTextE.value;
});
