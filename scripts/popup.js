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
	try {
		CurrentNote.x = window.screenX;
		CurrentNote.y = window.screenY;
		CurrentNote.height = window.outerHeight;
		CurrentNote.width = window.outerWidth;
		CurrentNote.text = YTextE.value;
		ext.closeCurrentNote();
	} catch (e) {
		//console.error("Window is likely dead", e);
	}
}

document.addEventListener('keyup', (event) => {
	if(event.key == 'Escape'){
		if(CurrentNote){
			CurrentNote.needSave = false;
		}
		popupClose();
	}
});

window.addEventListener('pagehide', () => {
	popupClose();
});
