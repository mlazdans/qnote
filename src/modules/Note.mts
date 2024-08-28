import { QEventDispatcher } from './QEventDispatcher.mjs';

export class NoteData {
	keyId: string; // message-id header or another unique id
	exists: boolean = false;
	text: string | null = "";
	left: number | null = null;
	top: number | null = null;
	width: number | null = null;
	height: number | null = null;
	ts: number | null = null;
	tsFormatted: string | null = null;
	constructor(keyId: string) {
		this.keyId = keyId;
	};
}

export interface INote {
	data: NoteData;
	load(): Promise<NoteData>;
	get(): NoteData;
	set(data: NoteData): NoteData;
	save(): Promise<boolean>;
}

// type NoteSaver = () => Promise<boolean>;
// type NoteDeleter = () => Promise<boolean>;

// const l = ["aftersave", "afterdelete" , "afterupdate"];
// type NoteListener = typeof l[number];

// export type Note = (QNote | QNoteFolder) & QEventDispatcher;

export abstract class DefaultNote implements INote {
	keyId: string;
	data: NoteData;

	constructor(keyId: string) {
		this.keyId = keyId;
		// super(["aftersave", "afterdelete", "afterupdate"]);
		this.data = new NoteData(keyId);
	}

	// addListener(name: NoteListener, listener: Function): void {
	// 	super.addListener(name, listener);
	// }

	// async load(loader: Function): Promise<NoteData> {
	// 	return loader().then((data: NoteData) => {
	// 		this.set(data);
	// 		this.data.exists = !!data;

	// 		return this.get();
	// 	});
	// }

	get(): NoteData {
		return this.data;
	}

	set(data: NoteData): NoteData {
		return this.data = data;
	}

	abstract load(): Promise<NoteData>
	abstract save(): Promise<boolean>
	abstract delete(): Promise<boolean>

	// protected async saver(saver: NoteSaver): Promise<boolean> {
	// 	return saver().then(saved => {
	// 		if(saved){
	// 			this.data.exists = true;
	// 			this.fireListeners("aftersave", this);
	// 			this.fireListeners("afterupdate", this, "save");
	// 		}
	// 		return saved;
	// 	});
	// }

	// protected async deleter(deleter: NoteDeleter): Promise<boolean> {
	// 	return deleter().then(deleted => {
	// 		if(deleted){
	// 			this.data.exists = false;
	// 			this.fireListeners("afterdelete", this);
	// 			this.fireListeners("afterupdate", this, "delete");
	// 		}
	// 		return deleted;
	// 	});
	// }
}
