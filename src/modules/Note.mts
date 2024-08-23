import { QEventDispatcher } from './QEventDispatcher.mjs';

export interface NoteData {
	keyId: string; // message-id header or another unique id
	exists: boolean;
	text: string | undefined;
	left: number | undefined;
	top: number | undefined;
	width: number | undefined;
	height: number | undefined;
	ts: number | undefined;
	tsFormatted: string | undefined;
	// constructor(keyId: string): NoteData;
}

export interface Note {
	data: NoteData;
	load(): Promise<boolean>;
	// get(): NoteData;
	set(data: NoteData): NoteData;
	save(): Promise<boolean>;
}

type NoteSaver = () => Promise<boolean>;
type NoteDeleter = () => Promise<boolean>;

// export type Note = (QNote | QNoteFolder) & QEventDispatcher;

export abstract class DefaultNote extends QEventDispatcher implements Note {
	data: NoteData;

	constructor(keyId: string) {
		super(["aftersave", "afterdelete", "afterupdate"]);
		this.data = {
			keyId: keyId,
			exists: false,
			text: "",
			left: undefined,
			top: undefined,
			width: undefined,
			height: undefined,
			ts: undefined,
			tsFormatted: undefined,
		};
	}

	// async load(loader: Function): Promise<NoteData> {
	// 	return loader().then((data: NoteData) => {
	// 		this.set(data);
	// 		this.data.exists = !!data;

	// 		return this.get();
	// 	});
	// }

	// get(): NoteData {
	// 	return this.data;
	// }

	set(data: NoteData): NoteData {
		return this.data = data;
	}

	abstract load(): Promise<boolean>
	abstract save(): Promise<boolean>
	abstract delete(): Promise<boolean>

	protected async saver(saver: NoteSaver): Promise<boolean> {
		return saver().then(saved => {
			if(saved){
				this.data.exists = true;
				this.fireListeners("aftersave", this);
				this.fireListeners("afterupdate", this, "save");
			}
			return saved;
		});
	}

	protected async deleter(deleter: NoteDeleter): Promise<boolean> {
		return deleter().then(deleted => {
			if(deleted){
				this.data.exists = false;
				this.fireListeners("afterdelete", this);
				this.fireListeners("afterupdate", this, "delete");
			}
			return deleted;
		});
	}
}
