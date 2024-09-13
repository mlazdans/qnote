// TODO: why this is called 2x?
import { AttachToMessageReplyData } from "../modules/Messages.mjs";

function attachToMessage(reply: AttachToMessageReplyData | undefined) {
	// Cleanup
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

	// NOTE: disabled for now because this entire script is injected 2x
	// document.querySelectorAll(".qnote-insidenote").forEach(el => {
	// 	if(el instanceof HTMLDivElement){
	// 		el.addEventListener("dblclick", e => {
	// 			window.getSelection()?.removeAllRanges();
	// 			console.log("POP!", reply.keyId);
	// 		});
	// 	}
	// });
}

browser.runtime
	.sendMessage({
		command: "AttachToMessage",
	})
	.then((reply: AttachToMessageReplyData) => attachToMessage(reply));
