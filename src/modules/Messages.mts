import { IPreferences } from "./common.mjs";
import { INoteData } from "./Note.mjs";

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
		return Object.assign({}, data);
	}

	// Send to tab and optionally receive reply
	send(tabId: number, data?: M) {
		return browser.tabs.sendMessage(tabId, { ...data, command: this.command });
	}

	// Send to connected port
	post(port: browser.runtime.Port, data?: M): void {
		port.postMessage({ ...data, command: this.command });
	}

	// Just send and optionally receive reply
	sendMessage(data?: M) {
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
export abstract class NoteDataRequestData {
	abstract keyId: string
}
export class NoteDataRequest extends DefaultMessage<NoteDataRequestData> {
	command = "NoteDataRequest"
}

// NoteDataReply
abstract class NoteDataReplyData {
	abstract keyId: string
	abstract note: INoteData | null
}
export class NoteDataReply extends DefaultMessage<NoteDataReplyData> {
	command = "NoteDataReply"
}
