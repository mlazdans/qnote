// TODO: double click: pop message
import { AttachToMessageReplyData } from "../modules/Messages.mjs";

function attachToMessage(reply: AttachToMessageReplyData | false) {
	if (!reply) {
		return;
	}

	if (reply.prefs.messageAttachTop) {
		document.body.insertAdjacentHTML("afterbegin", '<div class="qnote-insidenote qnote-insidenote-top">' + reply.html + "</div>");
	}

	if (reply.prefs.messageAttachBottom) {
		document.body.insertAdjacentHTML("beforeend", '<div class="qnote-insidenote qnote-insidenote-bottom">' + reply.html + "</div>");
	}

	const el = document.querySelector(".qnote-text-span");
	if (el) {
		if (reply.prefs.treatTextAsHtml) {
			el.innerHTML = reply.note.text || "";
		} else {
			el.textContent = reply.note.text || "";
		}
	}
}

browser.runtime
	.sendMessage({
		command: "AttachToMessage",
	})
	.then((reply: AttachToMessageReplyData) => attachToMessage(reply));
