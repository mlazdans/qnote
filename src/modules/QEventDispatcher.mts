export interface QEventDispatcher {
	listeners: Map<string, Set<Function>>;
	addListener(name: string, listener: Function): void;
	removeListener(name: string, listener: Function): void;
	hasListener(name: string, listener: Function): boolean;
	fireListeners(name: string, ...args: any): Promise<void>;
}

export class QEventDispatcher implements QEventDispatcher
{
	constructor(def: Array<string>) {
		this.listeners = new Map;
		for(let name of def){
			if(!this.listeners.has(name)){
				this.listeners.set(name, new Set());
			}
		}
	}
	addListener(name: string, listener: Function){
		this.listeners.get(name)?.add(listener);
	}
	removeListener(name: string, listener: Function){
		this.listeners.get(name)?.delete(listener);
	}
	hasListener(name: string, listener: Function): boolean {
		const l = this.listeners.get(name);
		return l && l.has(listener) ? true : false;
	}
	async fireListeners(name: string, ...args: any){
		return new Promise(resolve => {
			const l = this.listeners.get(name);
			if(l){
				for (let listener of l) {
					listener(...args);
				}
				resolve(null);
			}
		});
	}
}
