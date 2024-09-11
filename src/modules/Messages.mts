import { IPreferences } from "./common.mjs";
import { INoteData } from "./Note.mjs";

interface IMessage<M> {
	command: string;
	parse(data: any): M | boolean;
	post(port: browser.runtime.Port, data?: M): void;
	send(tabId: number, data: M): Promise<any>
	sendMessage(data?: M): Promise<any>
}

abstract class DefaultMessage<M extends object | undefined = undefined> implements IMessage<M> {
	abstract command: string;
	data: M | undefined;

	constructor(data?: M) {
		this.data = data;
	}

	parse(data: any): M | boolean {
		if (!data || !("command" in data) || data.command !== this.command) {
			return false;
		}

		if(this.data !== undefined){
			const retData = {} as M;
			for (const k in this.data) {
				if (!(k in data)) {
					return false;
				} else {
					retData![k] = data[k]; // Safe to assume retData is initially {}. Types could be off though
				}
			}
			return retData;
		} else {
			return true;
		}
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
export interface AttachToMessageReplyData {
	prefs: IPreferences;
	note: INoteData;
	html: string;
}
export class AttachToMessageReply extends DefaultMessage<AttachToMessageReplyData> {
	command = "AttachToMessageReply";
}

// RestoreFocus
export class RestoreFocus extends DefaultMessage {
	command = "RestoreFocus";
}

// Message: PopupDataRequest
// interface PopupDataRequestData extends IMessageData {
// 	handle: number
// }

// interface PopupDataReplyData {
// 	handle: number,
// 	opts: IPopupOptions
// }

// export class PopupDataRequest extends DefaultMessage<PopupDataRequestData> {
// 	command = "PopupDataRequest";
// 	parse(data: any): PopupDataRequestData | undefined {
// 		if(!super.parse(data) || !("handle" in data)){
// 			return undefined;
// 		}

// 		return {
// 			handle: parseInt(data.handle),
// 		};
// 	}
// }

// export class PopupDataReply extends DefaultMessage<PopupDataReplyData> {
// 	command = "PopupDataReply";
// 	parse(data: any): PopupDataReplyData | undefined {
// 		if(!super.parse(data) || !("opts" in data) || !("handle" in data)){
// 			return undefined;
// 		}

// 		return data
// 	}
// }

// interface PreferencesRequestData extends IMessageData {
// }

// export interface PreferencesReplyData extends IMessageData {
// 	XNoteStoragePath: string,
// 	prefs: IPreferences
// }

// export class PreferencesRequest extends DefaultMessage<PreferencesRequestData> {
// 	command = "PreferencesRequest";
// }

// export class PreferencesReply extends DefaultMessage<PreferencesReplyData> {
// 	command = "PreferencesReply";
// 	parse(data: any): PreferencesReplyData | undefined {
// 		if(!super.parse(data) || !("prefs" in data) || !("XNoteStoragePath" in data)){
// 			return undefined;
// 		}

// 		return data
// 	}
// }

// interface PushNoteData extends MessageData {
// 	note: NoteData
// 	prefs: Preferences
// }

// export class PushNoteMessage extends DefaultMessage {
// 	command = "pushNote";
// 	parse(data: any): PushNoteData | undefined {
// 		if(!super.parse(data) || !("note" in data) || !("prefs" in data)){
// 			return undefined;
// 		}

// 		return {
// 			note: data.note,
// 			prefs: data.prefs,
// 		};
// 	}
// }
