var EXPORTED_SYMBOLS = ["QDispatcher"];

class QDispatcher {
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

	// async execListeners(name, executor, ...args){
	// 	return new Promise(resolve => {
	// 		for (let listener of this.listeners[name]) {
	// 			executor(listener);
	// 		}
	// 		resolve();
	// 	});
	// }

	async fireListeners(name, ...args){
		return new Promise(resolve => {
			for (let listener of this.listeners[name]) {
				listener(...args);
			}
			resolve();
		});
	}
}
