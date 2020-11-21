var EXPORTED_SYMBOLS = ["QEventDispatcher"];

class QEventDispatcher {
	constructor(listenerDef){
		this.listeners = {};
		for(let name of listenerDef){
			this.defineListener(name);
		}
	}

	defineListener(name){
		if(this.listeners[name] === undefined){
			this.listeners[name] = new Set();
		}
	}

	addListener(name, listener){
		this.listeners[name].add(listener);
	}

	removeListener(name, listener){
		this.listeners[name].delete(listener);
	}

	listenerExists(name, listener){
		return this.listeners[name].has(listener);
	}

	async fireListeners(name, ...args){
		return new Promise(resolve => {
			for (let listener of this.listeners[name]) {
				listener(...args);
			}
			resolve();
		});
	}
}
