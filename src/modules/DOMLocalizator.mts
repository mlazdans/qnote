import {
	isButtonElement,
	isHTMLElement,
	isInputElement,
	isSelectElement,
	isTextAreaElement,
	isTypeCheckbox,
	isTypeRadio,
} from "./common.mjs";

export class DOMLocalizator {
	_: typeof browser.i18n.getMessage;
	constructor(localizator: typeof browser.i18n.getMessage) {
		this._ = localizator;
	}

	setTexts(document: Document) {
		for (const node of document.querySelectorAll("[data-i18n]")) {
			if (!(isHTMLElement(node) && node.dataset.i18n)) {
				continue;
			}

			// Optional parameters that can be injected into localization string, for example:
			//     "implemented.formatting.rules": {
			//         "message": "(implemented: $1)"
			//     }
			//     <span data-i18n="implemented.formatting.rules" data-i18n.param1="dDjlNwzWFmMntLYyaAgGhHisve"></span>
			const params = new Map<string, string>;

			for(const k in node.dataset){
				k.match(/^i18n\.param(\d+)$/)?.slice(1).map(v => params.set(v, node.dataset[k] || ""));
			}

			const substitutions: Array<string> = [];

			[...params.keys()].sort().map(v => substitutions.push(params.get(v) || ""));

			const text = this._(node.dataset.i18n, substitutions);

			if (isButtonElement(node)) {
				node.textContent = text;
			} else {
				node.prepend(document.createTextNode(text));
			}
		}

		for (const node of document.querySelectorAll("[data-i18ntitle]")) {
			if (isHTMLElement(node) && node.dataset.i18ntitle) {
				node.title = this._(node.dataset.i18ntitle);
			}
		}
	}

	setValues(document: Document, values: any) {
		for (const node of document.querySelectorAll("[data-preference]")) {
			if (isHTMLElement(node) && node.dataset.preference){
				node.setAttribute("name", node.dataset.preference);
				this.setNodeValue(node, values[node.dataset.preference]);
			}
		}
	}

	setNodeValue(node: Element, value: any): void {
		if (isSelectElement(node)) {
			for (let option of node.querySelectorAll("option")) {
				if (option.value == value) {
					option.selected = true;
					return;
				}
			}
		} else if (isInputElement(node)) {
			if (isTypeCheckbox(node)) {
				node.checked = value;
			} else if (isTypeRadio(node)) {
				node.checked = value === node.value;
			} else {
				node.value = value;
			}
		} else if (isTextAreaElement(node) || isButtonElement(node)) {
			node.value = value;
		} else {
			console.error(`[qnote:DOMLocalizator] unsupported input element type: ${node.nodeName}`);
		}
	}
}
