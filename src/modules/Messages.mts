import { IQPopupOptionsPartial } from "./NotePopups.mjs";

// Declarations
interface IMessageData {
}

interface IMessage<T extends IMessageData> {
	command: string
	parse(data: any): T | undefined
	post(port: browser.runtime.Port, data?: T): void
	send(tabId: number, data: T): void
}

abstract class DefaultMessage<T extends IMessageData> implements IMessage<T> {
	abstract command: string;
	parse(data: any): T | undefined {
		if(!("command" in data) || (data.command !== this.command)){
			return undefined;
		}
		return {} as T;
	}
	send(tabId: number, data?: T): Promise<any> {
		return browser.tabs.sendMessage(tabId, { ...data, command: this.command });
	}
	post(port: browser.runtime.Port, data?: T): void {
		port.postMessage({ ...data, command: this.command });
	}
}

// Message: PopupDataRequest
interface QPopupDataRequestData extends IMessageData {
	id: number
}

interface QPopupDataReplyData {
	id: number,
	opts: IQPopupOptionsPartial
}

export class QPopupDataRequest extends DefaultMessage<QPopupDataRequestData> {
	command = "QPopupDataRequest";
	parse(data: any): QPopupDataRequestData | undefined {
		if(!super.parse(data) || !("id" in data)){
			return undefined;
		}

		return {
			id: parseInt(data.id),
		};
	}
}

export class QPopupDataReply extends DefaultMessage<QPopupDataReplyData> {
	command = "QPopupDataReply";
	parse(data: any): QPopupDataReplyData | undefined {
		if(!super.parse(data) || !("opts" in data) || !("id" in data)){
			return undefined;
		}

		return data
	}
}

// Message: prefsUpdated
interface PrefsUpdatedData extends IMessageData {}

export class PrefsUpdated extends DefaultMessage<PrefsUpdatedData> {
	command = "PrefsUpdated";
}

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
