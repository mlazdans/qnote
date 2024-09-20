// TODO: why this file is called 2x?
import { AttachToMessageReplyData } from "../modules/Messages.mjs";

function attachToMessage(reply: AttachToMessageReplyData | undefined) {
	// Cleanup already attached note
	document.querySelectorAll(".qnote-insidenote").forEach(e => e.remove());

	if(!reply){
		return;
	}

	if (reply.prefs.messageAttachTop) {
		document.body.insertAdjacentHTML("afterbegin", '<div class="qnote-insidenote qnote-insidenote-top">' + reply.html + "</div>");
	}

	if (reply.prefs.messageAttachBottom) {
		document.body.insertAdjacentHTML("beforeend", '<div class="qnote-insidenote qnote-insidenote-bottom">' + reply.html + "</div>");
	}

	document.querySelectorAll(".qnote-text-span").forEach(el => {
		if (reply.prefs.treatTextAsHtml) {
			el.innerHTML = reply.note.text || "";
		} else {
			el.textContent = reply.note.text || "";
		}
	});

	document.querySelectorAll(".qnote-insidenote").forEach(el => {
		if(el instanceof HTMLDivElement){
			el.addEventListener("dblclick", e => {
				window.getSelection()?.removeAllRanges();
				browser.runtime.sendMessage({ command: "PopNote", keyId: reply.keyId }); // Can't use classes from Message because of imports >:/
			});
		}
	});
}

browser.runtime.sendMessage({ command: "AttachToMessage" }).then(attachToMessage);
