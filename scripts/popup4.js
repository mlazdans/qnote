var ext = chrome.extension.getBackgroundPage();
var note = ext.CurrentNote.note;
var YTextE = document.getElementById('note-text');

// Redirect focus
document.addEventListener("focus", e => {
	YTextE.focus();
});

if(note){
	YTextE.value = note.text;

	let title = 'QNote: ';
	if(note.ts){
		title += (new Date(note.ts)).toLocaleString();
	}

	document.title = title;

	YTextE.addEventListener("keyup", e => {
		note.text = YTextE.value;
	});
}
