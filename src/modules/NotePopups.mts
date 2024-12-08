import { IPopupCloseReason } from '../modules-exp/api.mjs';
import { dateFormatWithPrefs, IPreferences, PopupAnchor } from './common.mjs';
import { INote, INoteData } from './Note.mjs';
import { QEventDispatcher } from './QEventDispatcher.mjs';

export interface INotePopup extends QEventDispatcher<{
	onnote: (keyId: string, reason: IPopupCloseReason, noteData: INoteData) => void
}> {
	keyId: string;
	note: INote;
	pop(): Promise<void>
	close(): Promise<void>
	update(state: IPopupState): Promise<IPopupState>
	resetPosition(): Promise<void>
	focus(): Promise<void>
	getState(): IPopupState
}

export interface IPopupState {
	focused?           : boolean
	top?               : number
	left?              : number
	offsetTop?         : number
	offsetLeft?        : number
	width?             : number
	height?            : number
	anchor?            : PopupAnchor
	anchorPlacement?   : string
	title?             : string
	text?              : string
	placeholder?       : string
	focusOnDisplay?    : boolean
	enableSpellChecker?: boolean
	confirmDelete?     : boolean
	enableDebug?       : boolean
}

export function note2state(noteData: INoteData | null, prefs: IPreferences): IPopupState {
	const state: IPopupState =  {
		// focused        : undefined,
		top               : noteData?.top,
		left              : noteData?.left,
		width             : noteData?.width || prefs.width,
		height            : noteData?.height || prefs.height,
		// offsetTop      : undefined,
		// offsetLeft     : undefined,
		anchor            : prefs.anchor,
		anchorPlacement   : prefs.anchorPlacement,
		title             : "QNote",
		text              : noteData?.text,
		// placeholder    : undefined,
		focusOnDisplay    : prefs.focusOnDisplay,
		enableSpellChecker: prefs.enableSpellChecker,
		confirmDelete     : prefs.confirmDelete,
		enableDebug       : prefs.enableDebug,
	}

	if(prefs.alwaysDefaultPlacement){
		state.width  = prefs.width;
		state.height = prefs.height;
		state.left   = undefined;
		state.top    = undefined;
	}

	if(noteData?.ts) {
		state.title = "QNote: " + dateFormatWithPrefs(prefs, noteData?.ts);
	}

	if(!noteData){
		state.placeholder = browser.i18n.getMessage("create.new.note");
	}

	return state;
}

export function state2note(state: IPopupState): INoteData {
	return {
		text  : state.text,
		left  : state.left,
		top   : state.top,
		width : state.width,
		height: state.height,
	}
}

export abstract class DefaultNotePopup extends QEventDispatcher<{
	onnote: (keyId: string, reason: IPopupCloseReason, noteData: INoteData) => void
}> implements INotePopup {
	keyId: string
	note: INote;

	protected state: IPopupState;

	constructor(keyId: string, note: INote, state: IPopupState) {
		super()
		this.keyId = keyId
		this.note = note;
		this.state = state;
	}

	getState(){
		return this.state;
	}

	abstract pop(): Promise<void>
	abstract close(): Promise<void>
	abstract update(state: IPopupState): Promise<IPopupState>
	abstract resetPosition(): Promise<void>
	abstract focus(): Promise<void>
}

// Wrapper around qpopup API, runs in background context
export class QNotePopup extends DefaultNotePopup {
	private id: number;

	// Use create() to instantiate object because we need id from qpopup.api which is async
	private constructor(keyId: string, note: INote, state: IPopupState, id: number) {
		super(keyId, note, state);
		this.id = id

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

	getId(){
		return this.id
	}

	static async create(keyId: string, note: INote, windowId: number, state: IPopupState): Promise<QNotePopup> {
		return browser.qpopup.create(windowId, state).then(id => {
			return new QNotePopup(keyId, note, state, id);
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

	async focus(): Promise<void> {
		browser.qpopup.update(this.id, { focused: true });
	}
}

export class WebExtensionPopup extends DefaultNotePopup {
	private id: number | undefined;

	constructor(keyId: string, note: INote, state: IPopupState) {
		super(keyId, note, state);
	}

	getId(){
		return this.id
	}

	async pop() {
		const initialState: browser.windows._CreateCreateData = {
			url                : "html/wepopup.html?keyId=" + encodeURIComponent(this.keyId),
			type               : "popup",
			width              : this.state.width,
			height             : this.state.height,
			left               : this.state.left,
			top                : this.state.top,
			allowScriptsToClose: true,
			titlePreface       : this.state.title ? this.state.title + " - " : "",
		}

		browser.windows.create(initialState).then(async windowInfo => {
			this.id = windowInfo.id;
		});
	}

	async resetPosition() {
		if(this.id)browser.windows.update(this.id, {
			left: undefined,
			top: undefined,
		});
	}

	async close() {
		if(this.id)browser.windows.remove(this.id);
	}

	async update(state: IPopupState){
		console.error("[qnote] TODO: WebExtensionPopup.update()")
		return state;
	}

	async focus(): Promise<void> {
		if(this.id) {
			browser.windows.update(this.id, { focused:true });
		}
	}
}
