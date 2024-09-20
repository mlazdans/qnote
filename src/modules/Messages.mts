import { IPopupCloseReason } from "../modules-exp/api.mjs";
import { IPreferences } from "./common.mjs";
import { INoteData } from "./Note.mjs";
import { IPopupState } from "./NotePopups.mjs";

abstract class DefaultMessage<M extends object = {}> {
	abstract command: string;

	parse(data: any): M | undefined {
		if (!data || !("command" in data) || data.command !== this.command) {
			return;
		}

		for (const k of Object.getOwnPropertyNames(this)) {
			if (!(k in data)) {
				return;
			}
		}

		return data;
	}

	from(data: M): M {
		return Object.assign({}, { command: this.command, ...data});
	}

	// Send to tab and optionally receive reply
	async send(tabId: number, data?: M) {
		return browser.tabs.sendMessage(tabId, { ...data, command: this.command });
	}

	// Send to connected port
	post(port: browser.runtime.Port, data?: M): void {
		port.postMessage({ ...data, command: this.command });
	}

	// Just send and optionally receive reply
	async sendMessage(data?: M) {
		return browser.runtime.sendMessage({ ...data, command: this.command });
	}
}

// PrefsUpdated
export class PrefsUpdated extends DefaultMessage {
	command = "PrefsUpdated";
}

// AttachToMessage
export class AttachToMessage extends DefaultMessage {
	command = "AttachToMessage";
}

// AttachToMessageReply
export abstract class AttachToMessageReplyData {
	abstract prefs: IPreferences;
	abstract note: INoteData;
	abstract html: string;
	abstract keyId: string;
}
export class AttachToMessageReply extends DefaultMessage<AttachToMessageReplyData> {
	command = "AttachToMessageReply";
}

// RestoreFocus
export class RestoreFocus extends DefaultMessage {
	command = "RestoreFocus";
}

// NoteDataRequest
export abstract class KeyIdData {
	abstract keyId: string
}
export class PopupDataRequest extends DefaultMessage<KeyIdData> {
	command = "PopupDataRequest"
}

// NoteDataReply
abstract class PopupDataReplyData {
	abstract keyId: string
	abstract state: IPopupState
}
export class PopupDataReply extends DefaultMessage<PopupDataReplyData> {
	command = "PopupDataReply"
}

// SyncNote
abstract class SyncNoteData {
	abstract keyId: string
	abstract reason: IPopupCloseReason
	abstract noteData: INoteData
}
export class SyncNote extends DefaultMessage<SyncNoteData> {
	command = "SyncNote"
}

// PopNote
export class PopNote extends DefaultMessage<KeyIdData> {
	command = "PopNote"
}
