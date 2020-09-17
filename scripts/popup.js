var ext = chrome.extension.getBackgroundPage();
var CurrentNote = ext.CurrentNote;

var YTextE = document.getElementById('qnote-text');
YTextE.focus();
YTextE.value = CurrentNote.text;

document.title = 'QNote';

if(CurrentNote.ts){
	document.title += ': ' + (new Date(CurrentNote.ts)).toLocaleString();
}

const popupClose = () => {
	CurrentNote.x = window.screenX;
	CurrentNote.y = window.screenY;
	CurrentNote.height = window.outerHeight;
	CurrentNote.width = window.outerWidth;
	CurrentNote.text = YTextE.value;
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
