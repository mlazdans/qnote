import { NoteData } from "./Note.mjs";
import { Preferences } from "./Preferences.mjs";

interface MessageData {
}

interface Message {
	command: string
	parse(data: any): MessageData | undefined
	post(port: browser.runtime.Port, data: MessageData): void
	send(tabId: number, data: MessageData): void
}

abstract class DefaultMessage implements Message {
	abstract command: string;
	parse(data: any): MessageData | undefined {
		if(!("command" in data) || (data.command !== this.command)){
			return undefined;
		}
		return {};
	}
	send(tabId: number, data: MessageData): Promise<any> {
		return browser.tabs.sendMessage(tabId, { ...data, command: this.command });
	}
	post(port: browser.runtime.Port, data: MessageData): void {
		port.postMessage({ ...data, command: this.command });
	}
}

// Send
interface QPopupDOMContentLoadedData extends MessageData {
	id: number
}

export class QPopupDOMContentLoadedMessage extends DefaultMessage {
	command = "QPopupDOMContentLoaded";
	parse(data: any): QPopupDOMContentLoadedData | undefined {
		if(!super.parse(data) || !("id" in data)){
			return undefined;
		}

		return {
			id: parseInt(data.id),
		};
	}
}

// Post
interface PushNoteData extends MessageData {
	note: NoteData
	prefs: Preferences
}

export class PushNoteMessage extends DefaultMessage {
	command = "pushNote";
	parse(data: any): PushNoteData | undefined {
		if(!super.parse(data) || !("note" in data) || !("prefs" in data)){
			return undefined;
		}

		return {
			note: data.note,
			prefs: data.prefs,
		};
	}
}
