var EXPORTED_SYMBOLS = ["DOMLocalizator"];

class DOMLocalizator {
	constructor(localizator){
		this._ = localizator;
	}

	setTexts(document){
		for (const node of document.querySelectorAll('[data-i18n]')) {
			try {
				let args = [];
				let params = [];
				if(node.dataset.i18n == "implemented.formatting.rules"){
					for(let p in node.dataset){
						let m;
						if(m = p.match(/^param(\d+)$/)){
							params[m[1]] = node.dataset[p];
						}
					}

					let keys = Object.keys(params);
					keys.sort();

					for(let k of keys){
						args.push(params[k]);
					}
				}

				let text = this._(node.dataset.i18n, args);
				if(this.isButton(node)){
					node.value = text;
				} else {
					node.prepend(document.createTextNode(text));
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
