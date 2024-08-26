export type QEventListener = string;

export interface IQEventDispatcher {
	listeners: Map<QEventListener, Set<Function>>;
	addListener(name: string, listener: Function): void;
	removeListener(name: string, listener: Function): void;
	hasListener(name: string, listener: Function): boolean;
	fireListeners(name: string, ...args: any): Promise<void>;
}

export class QEventDispatcher implements IQEventDispatcher
{
	listeners: Map<QEventListener, Set<Function>>;
	constructor(def: Array<string>) {
		this.listeners = new Map;
		for(let name of def){
			if(!this.listeners.has(name)){
				this.listeners.set(name, new Set());
			}
		}
	}
	addListener(name: QEventListener, listener: Function){
		console.log("super.addListener(name, listener)", name);
		this.listeners.get(name)?.add(listener);
	}
	removeListener(name: QEventListener, listener: Function){
		this.listeners.get(name)?.delete(listener);
	}
	removeAllListenersUnder(name: QEventListener){
		const nameListeners = this.listeners.get(name);
		if(nameListeners){
			nameListeners.forEach(listener => nameListeners.delete(listener));
		} else {
			console.error(`No listeners to remove: ${name}`);
		}
	}
	removeAllListeners(name?: QEventListener){
		if(name){
			this.removeAllListenersUnder(name);
		} else {
			for(let name of this.listeners.keys()){
				this.removeAllListenersUnder(name);
			}
		}

	}
	hasListener(name: QEventListener, listener: Function): boolean {
		const l = this.listeners.get(name);
		return l && l.has(listener) ? true : false;
	}
	async fireListeners(name: QEventListener, ...args: any): Promise<void> {
		return new Promise(resolve => {
			const l = this.listeners.get(name);
			if(l){
				for (let listener of l) {
					listener(...args);
				}
				resolve();
			}
		});
	}
}
