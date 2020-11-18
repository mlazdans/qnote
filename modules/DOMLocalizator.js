var EXPORTED_SYMBOLS = ["DOMLocalizator"];

class DOMLocalizator {
	constructor(localizator){
		this._ = localizator;
	}

	setTexts(document){
		for (const node of document.querySelectorAll('[data-i18n]')) {
			try {
				let text = this._(node.dataset.i18n);
				if(this.isButton(node)){
					node.value = text;
				} else {
					node.appendChild(document.createTextNode(text));
				}
			} catch (e) {
				console.warn(e);
			}
		}

		for (const node of document.querySelectorAll('[data-i18ntitle]')) {
			try {
				node.title = this._(node.dataset.i18ntitle);
			} catch (e) {
				console.warn(e);
			}
		}
	}

	setData(document, data){
		for (const node of document.querySelectorAll('[data-preference]')) {
			this.setNode(node, data);
		}
	}

	setNode(node, data){
		let value = data[node.dataset.preference];

		switch(node.nodeName) {
			case "SELECT":
				for(let option of node.querySelectorAll("option")){
					if(option.value == value){
						option.selected = true;
						break;
					}
				}
				break;
			case "INPUT":
				if(this.isCheckbox(node)){
					node.checked = value;
				} else if(this.isRadio(node)){
					node.checked = (value === node.value);
				} else {
					node.value = value;
				}
				break;
			default:
				console.error("Unknown node type " + node.nodeName);
				console.error(node);
		}
	}

	isButton(node){
		return node.nodeName == "INPUT" && node.type.toLocaleUpperCase() === "BUTTON";
	}

	isCheckbox(node){
		return node.nodeName == "INPUT" && node.type.toLocaleUpperCase() === "CHECKBOX";
	}

	isRadio(node){
		return node.nodeName == "INPUT" && node.type.toLocaleUpperCase() === "RADIO";
	}
};
