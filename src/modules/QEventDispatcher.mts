export interface IQEventDispatcher<T> {
	addListener(key: T, listener: Function): void;
	removeListener(key: T, listener: Function): void;
	hasListener(key: T, listener: Function): boolean;
	fireListeners(key: T, ...args: any): Promise<void>;
}

export class QEventDispatcher<T extends string> implements IQEventDispatcher<T> {
	private listenerMap: Map<T, Set<Function>>;

	constructor(key: T, ...moreKeys: T[]) {
		this.listenerMap = new Map([[key, new Set()]]);
		for (const key of moreKeys) {
			this.listenerMap.set(key, new Set());
		}
	}

	addListener(key: T, listener: Function) {
		if (!this.listenerMap.has(key)) {
			this.listenerMap.set(key, new Set());
		}

		this.listenerMap.get(key)?.add(listener);
	}

	removeListener(key: T, listener: Function) {
		this.listenerMap.get(key)?.delete(listener);
	}

	removeAllListenersUnder(key: T) {
		const listeners = this.listenerMap.get(key);
		listeners?.forEach((listener) => listeners.delete(listener));
	}

	removeAllListeners(key?: T) {
		if (key !== undefined) {
			this.removeAllListenersUnder(key);
		} else {
			for (const key of this.listenerMap.keys()) {
				this.removeAllListenersUnder(key);
			}
		}
	}

	hasListener(key: T, listener: Function): boolean {
		return this.listenerMap.get(key)?.has(listener) ? true : false;
	}

	async fireListeners(key: T, ...args: any): Promise<void> {
		return new Promise((resolve) => {
			const listeners = this.listenerMap.get(key);
			if (listeners) {
				for (const listener of listeners) {
					listener(...args);
				}
				resolve();
			}
		});
	}
}
