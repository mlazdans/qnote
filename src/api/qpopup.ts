import { IBox } from "../modules/common.mjs";
import { IPopupState } from "../modules/NotePopups.mjs";

type AddScreenXY =  { screenX: number, screenY: number};
type AnchorElement = (HTMLDivElement | HTMLBodyElement) & AddScreenXY;
type AchorProps = {
	aEl: AnchorElement,
	anchorPlacement: string,
	posAdjX: number,
	posAdjY: number,
	anchorAdjX: number;
	anchorAdjY: number;
}

export interface PanelStyle {
	opacity?: string;
}

var ExtensionParent: any;
if(globalThis.ExtensionParent) {
	ExtensionParent = globalThis.ExtensionParent;
} else if(ChromeUtils.import) {
	ExtensionParent = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm").ExtensionParent;
} else {
	ExtensionParent = ChromeUtils.importESModule("resource://gre/modules/ExtensionParent.sys.mjs").ExtensionParent;
}

var { BasePopup } = ChromeUtils.importESModule("resource:///modules/ExtensionPopups.sys.mjs");
// var { BasePopup } = ChromeUtils.importESModule("resource://qnote/modules-exp/QPopups.sys.mjs?version=version"); // Keep in repo for hacking/testing
var { QEventDispatcher } = ChromeUtils.importESModule("resource://qnote/modules/QEventDispatcher.mjs?version=version");
var { Box, coalesce } = ChromeUtils.importESModule("resource://qnote/modules/common.mjs?version=version");

var QDEB = true;
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");
var debugHandle = "[qnote:qpopup]";

class QPopupEventDispatcher extends QEventDispatcher<{
	onclose: (id: number, reason: string, state: IPopupState) => void;
	onfocus: (id: number) => void;
	onblur: (id: number) => void;
}> {}

const PopupEventDispatcher = new QPopupEventDispatcher();

var popupManager = {
	counter: 0,
	popups: new Map<number, QPopup>(),
	add(popup: QPopup): void {
		QDEB && console.debug(`${debugHandle} popupManager: adding new popup with id:`, popup.id);
		if (this.has(popup.id)) {
			throw new Error(`${debugHandle} id already exists: ${popup.id}`);
		} else {
			this.popups.set(popup.id, popup);
		}
	},
	remove(id: number): boolean {
		return this.popups.delete(id);
	},
	get(id: number): QPopup {
		if (this.popups.has(id)) {
			return this.popups.get(id)!;
		} else {
			throw new Error(`${debugHandle} id not found: ${id}`);
		}
	},
	has(id: number): boolean {
		return this.popups.has(id);
	},
};

var qpopup = class extends ExtensionCommon.ExtensionAPI {
	onShutdown(isAppShutdown: any) {
		QDEB&&console.log(`${debugHandle} shutdown`);

		for(const id of popupManager.popups.keys()){
			popupManager.get(id).destroy("close");
		}
	}

	getAPI(context: any) {
		function id2RealWindow(windowId: number): MozWindow {
			try {
				return extension.windowManager.get(windowId).window;
			} catch {
				throw new Error(`${debugHandle} windowManager failed`);
			}
		}

		// ext no context?
		return {
			qpopup: {
				onClose: new ExtensionCommon.EventManager({
					context,
					register: (fire: ExtensionParentFire) => {
						const l = (id: number, reason: string, state: IPopupState) => {
							fire.async(id, reason, state);
						};

						PopupEventDispatcher.addListener("onclose", l);

						return () => {
							PopupEventDispatcher.removeListener("onclose", l);
						};
					},
				}).api(),
				onFocus: new ExtensionCommon.EventManager({
					context,
					register: (fire: ExtensionParentFire) => {
						const l = (id: number) => {
							fire.async(id);
						};

						PopupEventDispatcher.addListener("onfocus", l);

						return () => {
							PopupEventDispatcher.removeListener("onfocus", l);
						};
					},
				}).api(),
				onBlur: new ExtensionCommon.EventManager({
					context,
					register: (fire: ExtensionParentFire) => {
						const l = (id: number) => {
							fire.async(id);
						};

						PopupEventDispatcher.addListener("onblur", l);

						return () => {
							PopupEventDispatcher.removeListener("onblur", l);
						};
					},
				}).api(),
				async takeScreenshot(id: number): Promise<boolean> {
					const p = popupManager.get(id);

					const canvas = p.window.document.createElement('canvas');
					const ctx = canvas.getContext('2d');
					if(!ctx){
						QDEB&&console.error(`${debugHandle} could not create canvas context`);
						return false;
					}

					try {
						const bmp = await p.browser.drawSnapshot(0, 0, 0, 0, 1.0, "#fff", true);
						canvas.width = bmp.width;
						canvas.height = bmp.height;
						ctx.drawImage(bmp, 0, 0);

						canvas.toBlob(async (blob) => {
							if(blob){
								const transferable = Cc["@mozilla.org/widget/transferable;1"].createInstance(Ci.nsITransferable);
								const imageTools = Cc["@mozilla.org/image/tools;1"].getService(Ci.imgITools);

								const blobData = await blob.arrayBuffer();
								const imgDecoded = imageTools.decodeImageFromArrayBuffer(blobData, "image/png");

								transferable.init(null);
								transferable.addDataFlavor("application/x-moz-nativeimage");
								transferable.setTransferData("application/x-moz-nativeimage", imgDecoded);
								Services.clipboard.setData(transferable, null, Ci.nsIClipboard.kGlobalClipboard);
							} else {
								QDEB&&console.error(`${debugHandle} decoding image failed`);
							}
						}, "image/png", 0.9);
					} catch (e) {
						QDEB&&console.error(`${debugHandle} taking screenshot failed`, e);
						return false;
					}

					return true;
				},
				async close(id: number, reason: string) {
					QDEB && console.debug(`${debugHandle} close(), id:`, id, ', reason:', reason);
					popupManager.get(id).destroy(reason);
				},
				async get(id: number) {
					return popupManager.get(id).state;
				},
				async update(id: number, newState: IPopupState) {
					const popup = popupManager.get(id)
					popup.update(newState);
					return popup.state;
				},
				async pop(id: number) {
					return popupManager.get(id).pop();
				},
				async resetPosition(id: number){
					return popupManager.get(id).resetPosition();
				},
				async create(windowId: number, state: IPopupState) {
					if(state.enableDebug != undefined)QDEB = state.enableDebug;
					QDEB && console.debug(`${debugHandle} create()`);

					const popup = new QPopup(id2RealWindow(windowId), extension, state);

					return popup.id;
				},
				async setPanelStyle(id: number, style: PanelStyle) {
					Object.assign(popupManager.get(id).panel.style, style);
				}
			},
		};
	}
};

class QPopup extends BasePopup {
	id: number;
	state: IPopupState;

	private mainPopupSet;

	constructor(window: MozWindow, extension: any, state: IPopupState) {
		const document = window.document;

		const mainPopupSet = document.getElementById("mainPopupSet");

		if (!mainPopupSet) {
			throw new Error(`${debugHandle} mainPopupSet not found`);
		}

		const id = ++popupManager.counter;

		const panel = document.createXULElement("panel");
		panel.setAttribute("id", "qnote-window-panel-" + id);
		panel.setAttribute("noautohide", "true");
		panel.setAttribute("noautofocus", state.focusOnDisplay ? "false" : "true");
		panel.setAttribute("class", "mail-extension-panel panel-no-padding browser-extension-panel");
		panel.setAttribute("type", "arrow");
		panel.setAttribute("role", "group");
		panel.setAttribute("tabspecific", "true");
		panel.setAttribute("neverhidden", "true"); // Bizarrely this was needed for scrollbars to work
		// panel.setAttribute("level", "top"); // With level=top popups pop over each other on focus. But they do not disapper when switching to another window
		panel.setAttribute("remote", "true");
		// panel.setAttribute("animate", "false"); // Do not set to anything. It will mess up event.screenX/Y :o
		// panel.setAttribute("constrainpopups", "false");
		// panel.setAttribute("disableglobalhistory", "true");
		// panel.setAttribute("flip", "none");
		// panel.setAttribute("fade", "slow"); // close after slow=4000ms

		// if (!this.isRemoteBrowser) {
		// 	this._remoteWebNavigation = null;
		// 	this.addEventListener("pagehide", this.onPageHide, true);
		// }

		// window.addEventListener("click", () => {
		// 	console.error("click from api");
		// });

		// window.addEventListener("WebExtPopupResized", () => {
		// 	console.error("WebExtPopup:Resized from api");
		// });

		// window.addEventListener("WebExtPopupLoaded", () => {
		// 	console.error("WebExtPopup:Loaded from api");
		// });

		mainPopupSet.appendChild(panel);

		const url = "html/qpopup.html?id=" + id;

		const popupURL = extension.getURL(url);
		const browserStyle = false;
		const fixedWidth = true;
		const blockParser = false;

		super(extension, panel, popupURL, browserStyle, fixedWidth, blockParser);

		this.id = id;
		this.state = state;
		this.mainPopupSet = mainPopupSet;

		const self = this;

		// Event flow: browser -> stack -> panel
		this.browser.addEventListener("keydown", (e: KeyboardEvent) => {
			if(e.code == "Escape"){
				e.preventDefault();
			}

			// if(e.altKey && e.code == "KeyQ"){
			// 	e.preventDefault();
			// 	popupManager.get(id).destroy("close");
			// }
		});

		this.browser.addEventListener("focus", () => {
			self.state.focused = true;
			PopupEventDispatcher.fireListeners("onfocus", self.id);
		});

		this.browser.addEventListener("blur", () => {
			self.state.focused = false;
			PopupEventDispatcher.fireListeners("onblur", self.id);
		});

		this.browser.style.width = `${state.width}px`;
		this.browser.style.height = `${state.height}px`;

		// Used in ExtensionPopups.sys.mjs, initialized in async attach(viewNode). Spits some errors in console.
		// For now just set some bogus values to silence errors
		this.viewHeight = 6666666;
		this.extraHeight = {
			"top": 0,
			"bottom": 0,
		};

		popupManager.add(this);
	}

	destroy(reason?: string) {
		QDEB&&console.debug(`${debugHandle} destroy() id:`, this.id, ', reason:', reason);
		if(popupManager.has(this.id)){
			this.mainPopupSet.removeChild(this.panel);
			popupManager.remove(this.id);
			PopupEventDispatcher.fireListeners("onclose", this.id, reason ?? "", this.state);
		}
		super.destroy();
	}

	// Is called from parent, w/o params - do not remove
	closePopup() {
	}

	moveTo(x: number, y: number) {
		this.panel.moveTo(x, y);
	}

	pop() {
		QDEB&&console.group(`${debugHandle} pop()`);
		QDEB&&console.debug(this.state);
		QDEB&&console.groupEnd();

		const { left, top, width, height } = this.state;

		return new Promise((resolve) => {
			if (width != null && height != null) {
				this.browser.style.width = `${width}px`;
				this.browser.style.height = `${height}px`;
			}

			// If left/top not set yet. New note or after note reset
			if (left == null && top == null) {
				const aProps = this.getAnchorProps();

				if (aProps) {
					const { aEl, anchorPlacement, posAdjX, posAdjY, anchorAdjX, anchorAdjY } = aProps;

					this.panel.openPopup(aEl, anchorPlacement, posAdjX, posAdjY);
					this.state.top = this.panel.screenY + (height || 0) * anchorAdjY;
					this.state.left = this.panel.screenX + (width || 0) * anchorAdjX;
				} else {
					// This should never happend, only if aEl not found or anchorPlacement not set for some reason
					console.warn(`${debugHandle} anchor element not found or anchorPlacement not set`);
					this.panel.openPopup(null, this.state.anchorPlacement || "after_start");
				}
			} else {
				this.panel.openPopup(null, "after_start");
				this.panel.moveTo(left, top);
			}

			resolve(true);
		});
	}

	resetPosition(){
		this.state.left = undefined;
		this.state.top = undefined;
		const aProps = this.getAnchorProps();

		if(aProps){
			const { aEl, anchorPlacement, posAdjX, posAdjY, anchorAdjX, anchorAdjY } = aProps;
			const { width, height } = this.state;

			this.panel.moveToAnchor(aEl, anchorPlacement, posAdjX, posAdjY);
			this.state.top = this.panel.screenY + (height || 0) * anchorAdjY;
			this.state.left = this.panel.screenX + (width || 0) * anchorAdjX;
		} else {
			this.panel.moveToAnchor(null, "after_start");
		}
	}

	/**
	 * New anchors on top of existing ones (src/scripts/options.ts):
	 *  before_start, before_end, after_start, after_end,
	 *  start_before, start_after, end_before, end_after,
	 *  overlap, after_pointer
	 *
	 *                   +--------------+        +------------+
	 *                   | before_start |        | before_end |
	 *    +--------------+--------------+--------+------------+------------+
	 *    | start_before |   overlap    |                     | end_before |
	 *    +--------------+--------------+                     +------------+
	 *                   |                                    |
	 *                   |             CONTAINER              |
	 *                   |                                    |
	 *     +-------------+                                    +-----------+
	 *     | start_after |                                    | end_after |
	 *     +-------------+-------------+----------+-----------+-----------+
	 *                   | after_start |          | after_end |
	 *                   +-------------+          +-----------+
	 *
	 *    after_pointer seems very similar to overlap
	 */
	private getAnchorProps(): AchorProps | null {
		const window = this.window;
		const browser = window.document.querySelector("browser[src='about:3pane']") as XULFrameElement | null;
		const threadPane = browser?.contentDocument?.getElementById('threadPane') as HTMLDivElement & AddScreenXY | null;
		const messagePane = browser?.contentDocument?.getElementById('messagePane') as HTMLDivElement & AddScreenXY | null;

		const { left, top, width, height, anchor, anchorPlacement } = this.state;

		if (left == null && top == null) {
			let aEl: AnchorElement | null;
			if((anchor == "threadpane") && threadPane){
				aEl = threadPane;
			} else if((anchor == "message") && messagePane){
				aEl = messagePane;
			} else {
				aEl = window.document.querySelector("body") as HTMLBodyElement & AddScreenXY | null;
			}

			if (aEl && anchorPlacement) {
				let posAdjX = 0;
				let posAdjY = 0;
				let anchorAdjY = 0;
				let anchorAdjX = 0;

				if(anchorPlacement != "center"){
				}

				if (anchorPlacement == "center") {
					const wBox: IBox = {
						top: aEl.screenY,
						left: aEl.screenX,
						width: aEl.clientWidth,
						height: aEl.clientHeight,
					};
					const currBox: IBox = {
						left: 0, // left and top is null
						top: 0,
						width: width || 0,
						height: height || 0,
					};
					const adjBox = Box.center(currBox, wBox, false);
					posAdjX = adjBox.left;
					posAdjY = adjBox.top;
				} else {
					const [ anchorCorner, popupCorner ] = anchorPlacement.split(" ");

					if(popupCorner.startsWith("bottom")){
						anchorAdjY = -1;
					}

					if(popupCorner.endsWith("right")){
						anchorAdjX = -1;
					}

					if (width && (anchorCorner == "topcenter" || anchorCorner == "bottomcenter")) {
						posAdjX = (width / 4) * -1;
					}

					if (height && (anchorCorner == "rightcenter" || anchorCorner == "leftcenter")) {
						posAdjY = (height / 4) * -1;
					}
				}

				return { aEl, anchorPlacement, posAdjX, posAdjY, anchorAdjX, anchorAdjY }
			} else {
				return null;
			}
		} else {
			return null
		}
	}

	update(newState: IPopupState): void {
		const oldState = Object.assign({}, this.state);

		// state properties come in null-ed
		let { top, left, offsetTop, offsetLeft, width, height } = newState;

		if(offsetTop !== null)newState.top = coalesce(oldState.top, 0) + coalesce(offsetTop, 0) as number;
		if(offsetLeft !== null)newState.left = coalesce(oldState.left, 0) + coalesce(offsetLeft, 0) as number;

		this.window.requestAnimationFrame(() => {
			if (offsetTop !== null || offsetLeft !== null || top !== null || left !== null) {
				this.moveTo(coalesce(newState.left, 0), coalesce(newState.top, 0));
			}

			if (width !== null || height !== null) {
				this.browser.style.width = `${width}px`;
				this.browser.style.height = `${height}px`;
			}
		});

		if(newState.focused){
			this.browser.focus();
		}

		// if(title){
		// 	this.title = title;
		// }

		const assignState: IPopupState = {};
		Object.entries(newState).map(([k, v]) => {
			if(v !== null)assignState[k as keyof IPopupState] = v;
		});

		Object.assign(this.state, assignState);
	}
}
