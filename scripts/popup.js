var ext = chrome.extension.getBackgroundPage();
var CurrentNote = ext.CurrentNote;
var note = ext.CurrentNote.note;

var YTextE = document.getElementById('qnote-text');

if(ext.Prefs.focusOnDisplay || !note || !note.text){
	YTextE.focus();
}

YTextE.value = note.text;

document.title = 'QNote';
if(note.ts){
	document.title += ': ' + (new Date(note.ts)).toLocaleString();
}

const popupClose = () => {
	note.x = window.screenX;
	note.y = window.screenY;
	note.height = window.outerHeight;
	note.width = window.outerWidth;
	note.text = YTextE.value;
}

document.addEventListener('keyup', (event) => {
	if(event.key == 'Escape'){
		popupClose();
		CurrentNote.needSave = false;
		ext.browser.windows.remove(CurrentNote.windowId);
	}
});

window.addEventListener('pagehide', () => {
	popupClose();
});
