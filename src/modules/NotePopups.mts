import { dateFormatWithPrefs, IPreferences, PopupAnchor } from './common.mjs';
import { INoteData } from './Note.mjs';
import { QEventDispatcher } from './QEventDispatcher.mjs';

export interface INotePopup {
	keyId: string;
	windowId: number;
	flags: number | undefined;
	pop(): Promise<void>
	close(): Promise<void>
	update(state: IPopupState): Promise<IPopupState>
	resetPosition(): Promise<void>
}

export interface IPopupState {
	focused?: boolean
	top?: number
	left?: number
	offsetTop?: number
	offsetLeft?: number
	width?: number
	height?: number
	anchor?: PopupAnchor
	anchorPlacement?: string
	title?: string
	text?: string
	placeholder?: string
	focusOnDisplay?: boolean
	enableSpellChecker?: boolean
}

export abstract class DefaultNotePopup extends QEventDispatcher<{
	close: (reason: string, state: IPopupState) => void
}> implements INotePopup {
	keyId: string
	windowId: number
	flags: number | undefined;

	constructor(keyId: string, windowId: number) {
		super()
		this.keyId = keyId
		this.windowId = windowId
	}

	abstract pop(): Promise<void>
	abstract close(): Promise<void>
	abstract update(state: IPopupState): Promise<IPopupState>
	abstract resetPosition(): Promise<void>
}

// Wrapper around qpopup API, runs in background context
export class QNotePopup extends DefaultNotePopup {
	private id: number;

	// Use create() to instantiate object because we need id from qpopup.api which is async
	private constructor(keyId: string, id: number, windowId: number) {
		super(keyId, windowId);
		this.id = id

		browser.qpopup.onClose.addListener((id: number, reason: string, state: IPopupState) => {
			if(id == this.id){
				this.fireListeners("close", reason, state);
			}
		});

		// Not used currently. Keep this code around for now
		// browser.qpopup.onFocus.addListener((id: number) => {
		// 	console.log("browser.qpopup.onFocus", id);
		// 	if(id == this.id){
		// 		self.isFocused = true;
		// 	}
		// });

		// browser.qpopup.onBlur.addListener((id: number) => {
		// 	console.log("browser.qpopup.onBlur", id);
		// 	if(id == this.id){
		// 		self.isFocused = false;
		// 	}
		// });
	}

	static init(debugOn: boolean){
		browser.qpopup.setDebug(debugOn);
	}

	static async create(keyId: string, windowId: number, initialState: IPopupState): Promise<QNotePopup> {
		return browser.qpopup.create(windowId, initialState).then(id => {
			console.log(`created qpopup ${id}`);

			return new QNotePopup(keyId, id, windowId);
		});
	}

	async pop() {
		return browser.qpopup.pop(this.id);
	}

	async close() {
		return browser.qpopup.close(this.id, "close");
	}

	async update(state: IPopupState) {
		return browser.qpopup.update(this.id, state);
	}

	async resetPosition() {
		return browser.qpopup.resetPosition(this.id);
	}

	static note2state(noteData: INoteData, prefs: IPreferences): IPopupState {
		const opt: IPopupState =  {
			// focused: undefined,
			top: noteData?.top,
			left: noteData?.left,
			width: noteData?.width || prefs.width,
			height: noteData?.height || prefs.height,
			// offsetTop: undefined,
			// offsetLeft: undefined,
			anchor: prefs.anchor,
			anchorPlacement: prefs.anchorPlacement,
			title: "QNote",
			text: noteData?.text,
			// placeholder: undefined,
			focusOnDisplay: prefs.focusOnDisplay,
			enableSpellChecker: prefs.enableSpellChecker,
		}

		if(prefs.alwaysDefaultPlacement){
			opt.width = prefs.width;
			opt.height = prefs.height;
			opt.left = undefined;
			opt.top = undefined;
		}

		if(noteData?.ts) {
			opt.title = "QNote: " + dateFormatWithPrefs(prefs, noteData?.ts);
		}

		return opt;
	}

	static state2note(state: IPopupState): INoteData {
		return {
			text: state.text,
			left: state.left,
			top: state.top,
			width: state.width,
			height: state.height,
		}
	}
}
