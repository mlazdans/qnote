import { isInputElement, isSelectElement, isTextAreaElement, isTypeCheckbox, isTypeRadio } from "./common.mjs";

export class DOMLocalizator {
	_: typeof browser.i18n.getMessage
	constructor(localizator: typeof browser.i18n.getMessage){
		this._ = localizator;
	}

	setTexts(document: Document){
		for (const node of document.querySelectorAll('[data-i18n]')) {
			if (!(node instanceof HTMLElement && node.dataset.i18n)) {
				continue;
			}

			// let args = [];
			// let params = new Map<string, string>;
			if(node.dataset.i18n == "implemented.formatting.rules"){
				console.error("TODO: implemented.formatting.rules");
				// for(const p in node.dataset){
				// 	let m = p.match(/^param(\d+)$/);
				// 	if(m !== null && typeof m[1] == "string"){
				// 		params.set(m[1], node.dataset[p] || "");
				// 	}
				// }

				// let keys = Object.keys(params);
				// keys.sort();

				// for(let k of keys){
				// 	args.push(params.get(k));
				// }
			}

			// let text = this._(node.dataset.i18n, args);
			const text = this._(node.dataset.i18n);
			// if(this.isButton(node)){
			if(node instanceof HTMLButtonElement) {
				node.value = text;
			} else {
				node.prepend(document.createTextNode(text));
			}
		}

		for (const node of document.querySelectorAll('[data-i18ntitle]')) {
			if (node instanceof HTMLElement && 'title' in node && node.dataset.i18ntitle) {
				node.title = this._(node.dataset.i18ntitle);
			}
		}
	}

	setData(document: Document, data: any){
		for (const node of document.querySelectorAll('[data-preference]')) {
			this.setNode(node, data);
		}
	}

	setNode(node: Element, data: any): void {
		if(!(isSelectElement(node) || isInputElement(node) || isTextAreaElement(node))){
			return;
		}

		if(node.dataset.preference === undefined) {
			return;
		}

		const nodeName = node.nodeName;
		const value = data[node.dataset.preference];

		if(isSelectElement(node)){
			for(let option of node.querySelectorAll("option")){
				if(option.value == value){
					option.selected = true;
					return;
				}
			}
		} else if(isInputElement(node)){
			if(isTypeCheckbox(node)){
				node.checked = value;
			} else if(isTypeRadio(node)){
				node.checked = (value === node.value);
			} else {
				node.value = value;
			}
		} else if(isTextAreaElement(node)){
			node.value = value;
		} else {
			console.warn(`Unsupported input element type: ${nodeName}`);
		}
	}
};
