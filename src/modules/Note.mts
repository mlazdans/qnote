import { QEventDispatcher } from './QEventDispatcher.mjs';

export interface NoteData {
	keyId: string; // message-id header or another unique id
	exists: boolean;
	text: string | null;
	left: number | null;
	top: number | null;
	width: number | null;
	height: number | null;
	ts: number | null;
	// constructor(keyId: string): NoteData;
}

export interface INote {
	data: NoteData;
	load(): Promise<boolean>;
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
	data: NoteData;

	constructor(keyId: string) {
		// super(["aftersave", "afterdelete", "afterupdate"]);
		this.data = {
			keyId: keyId,
			exists: false,
			text: "",
			left: null,
			top: null,
			width: null,
			height: null,
			ts: null,
		};
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

	abstract load(): Promise<boolean>
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
