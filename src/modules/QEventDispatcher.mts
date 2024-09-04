export type QEventListener = string;

export interface IQEventDispatcher {
	addListener(name: string, listener: Function): void;
	removeListener(name: string, listener: Function): void;
	hasListener(name: string, listener: Function): boolean;
	fireListeners(name: string, ...args: any): Promise<void>;
}

export class QEventDispatcher implements IQEventDispatcher {
	listenerMap: Map<QEventListener, Set<Function>>;
	constructor() {
		this.listenerMap = new Map();
	}

	addListener(key: QEventListener, listener: Function) {
		if (!this.listenerMap.has(key)) {
			this.listenerMap.set(key, new Set());
		}

		this.listenerMap.get(key)?.add(listener);
	}

	removeListener(key: QEventListener, listener: Function) {
		this.listenerMap.get(key)?.delete(listener);
	}

	removeAllListenersUnder(key: QEventListener) {
		const listeners = this.listenerMap.get(key);
		listeners?.forEach((listener) => listeners.delete(listener));
	}

	removeAllListeners(name?: QEventListener) {
		if (name !== undefined) {
			this.removeAllListenersUnder(name);
		} else {
			for (const name of this.listenerMap.keys()) {
				this.removeAllListenersUnder(name);
			}
		}
	}

	hasListener(name: QEventListener, listener: Function): boolean {
		return this.listenerMap.get(name)?.has(listener) ? true : false;
	}

	async fireListeners(name: QEventListener, ...args: any): Promise<void> {
		return new Promise((resolve) => {
			const listeners = this.listenerMap.get(name);
			if (listeners) {
				for (const listener of listeners) {
					listener(...args);
				}
				resolve();
			}
		});
	}
}
