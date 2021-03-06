var ext = chrome.extension.getBackgroundPage();
var CurrentNote = ext.CurrentNote;
var note = ext.CurrentNote.note;

var YTextE = document.getElementById('qnote-text');

//if(ext.Prefs.focusOnDisplay || !note || !note.text){
	YTextE.focus();
//}

YTextE.value = note.text;

document.title = 'QNote';
if(note.ts){
	document.title += ': ' + ext.qDateFormat(note.ts);
}

//window.mozInnerScreenX

const popupClose = () => {
	browser.windows.get(CurrentNote.windowId).then(Window => {
		note.left = window.screenX - Window.left;
		note.top = window.screenY - Window.top;
		note.height = window.outerHeight;
		note.width = window.outerWidth;
		note.text = YTextE.value;
	});
}

// We need additional Escape handler here, becauce main window is blured and it's handler won't work here
document.addEventListener('keydown', e => {
	if(e.key == 'Escape'){
		CurrentNote.close();
		// CurrentNote.needSaveOnClose = false;
		// CurrentNote.silentlyPersistAndClose();
	}
});

YTextE.addEventListener("keyup", e => {
	popupClose();
});

window.addEventListener("resize", e => {
	popupClose();
});

// window.addEventListener('pagehide', e => {
// 	popupClose();
// 	// CurrentNote.silentlyPersistAndClose();
// });
