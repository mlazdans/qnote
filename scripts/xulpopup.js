var ext = chrome.extension.getBackgroundPage();
var note = ext.CurrentNote.note;
var YTextE = document.getElementById('note-text');
var popupEl = document.querySelector('.qpopup');
var titleEl = document.querySelector(".qpopup-title");
var titleTextEl = document.querySelector(".qpopup-title-text");
var resizeEl = document.querySelector(".qpopup-controls-resize");
var closeEl = document.querySelector(".qpopup-title-closebutton");
var delEl = document.querySelector("#note-delete");

// console.log("note", note);
// document.addEventListener("keydown", e => {
// 	console.log("keydown");
// });

// document.addEventListener("keyup", e => {
// 	// console.log("keyup", isFocused);
// 	if(ext.Prefs.focusOnDisplay){
// 		var isFocused = (document.activeElement === YTextE);
// 		if(!isFocused){
// 			YTextE.focus();
// 		}
// 	}
// });

function sfocus(f){
	if(ext.Prefs.focusOnDisplay){
		var isFocused = (document.activeElement === YTextE);
		if(!isFocused){
			f();
		}
	}
}

window.addEventListener("focus", () => {
	sfocus(() => YTextE.focus());
});

window.addEventListener("DOMContentLoaded", () => {
	sfocus(() => window.focus());
});

YTextE.value = note.text;

let title = 'QNote';
if(note.ts){
	title += ': ' + ext.qDateFormat(note.ts);
}
titleTextEl.textContent = title;

YTextE.addEventListener("keyup", e => {
	note.text = YTextE.value;
});

let tDrag = mouse => {
	let el = mouse.target;
	let startX = mouse.screenX;
	let startY = mouse.screenY;

	el.style.cursor = 'move';

	let mover = e => {
		let x = e.screenX - startX;
		let y = e.screenY - startY;

		ext.browser.qpopup.update(ext.CurrentNote.popupId, {
			offsetTop: y,
			offsetLeft: x
		}).then(pi => {
			note.top = pi.top;
			note.left = pi.left;
		});
	};

	let handleDragEnd = e => {
		window.removeEventListener("mousemove", mover);
		window.removeEventListener("mouseup", handleDragEnd);
		popupEl.style.opacity = '1';
		el.style.cursor = '';
	}

	window.addEventListener("mouseup", handleDragEnd);
	window.addEventListener("mousemove", mover);

	popupEl.style.opacity = '0.4';
};

function resizeNote(w, h){
	let rectLimit = {
		minWidth: 200,
		minHeight: 125,
		maxWidth: 800,
		maxHeight: 500
	};

	w = w > rectLimit.maxWidth ? rectLimit.maxWidth : w;
	w = w < rectLimit.minWidth ? rectLimit.minWidth : w;

	h = h > rectLimit.maxHeight ? rectLimit.maxHeight : h;
	h = h < rectLimit.minHeight ? rectLimit.minHeight : h;

	popupEl.style.width = w + 'px';
	popupEl.style.height = h + 'px';

	note.width = w;
	note.height = h;
}

let tResize =  e => {
	// let popup = self.popupEl;
	let startX = e.screenX;
	let startY = e.screenY;
	let startW = popupEl.offsetWidth;
	let startH = popupEl.offsetHeight;


	let resizer = e => {
		let w = startW + e.screenX - startX;
		let h = startH + e.screenY - startY;
		resizeNote(w, h);
	};

	let handleDragEnd = e => {
		window.removeEventListener("mousemove", resizer);
		window.removeEventListener("mouseup", handleDragEnd);
		popupEl.style.opacity = '1';
	}

	window.addEventListener("mouseup", handleDragEnd);
	window.addEventListener("mousemove", resizer);

	popupEl.style.opacity = '0.4';
};


popupEl.style.width = note.width + 'px';
popupEl.style.height = note.height + 'px';

let mDown = new WeakMap();

mDown.set(titleEl, tDrag);
mDown.set(titleTextEl, tDrag);
mDown.set(resizeEl, tResize);

let handleDragStart = e => {
	if(mDown.has(e.target)){
		mDown.get(e.target)(e);
	}
}

window.addEventListener('mousedown', handleDragStart, false);

ext.browser.qpopup.update(ext.CurrentNote.popupId, {
	top: note.top,
	left: note.left,
	// width: note.width || ext.Prefs.width,
	// height: note.height || ext.Prefs.height
});

resizeNote(note.width || ext.Prefs.width, note.height || ext.Prefs.height);

closeEl.addEventListener("click", e => {
	ext.CurrentNote.silentlyPersistAndClose();
	// ext.browser.qpopup.remove(ext.CurrentNote.popupId);
});

delEl.addEventListener("click", e => {
	ext.CurrentNote.silentlyDeleteAndClose();
	// ext.CurrentNote.close();
	// ext.browser.qpopup.remove(ext.CurrentNote.popupId);
});
