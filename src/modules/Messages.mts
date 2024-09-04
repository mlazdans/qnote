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
