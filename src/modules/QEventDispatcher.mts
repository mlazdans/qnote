type FunctionWithArgs = (...args: any) => any;

export class QEventDispatcher<A, K extends string & keyof A = string & keyof A, L extends FunctionWithArgs & A[K] = FunctionWithArgs & A[K]> {
	private listenerMap: Map<K, Set<L>>;

	constructor() {
		this.listenerMap = new Map();
	}

	addListener(key: K, listener: L) {
		if (!this.listenerMap.has(key)) {
			this.listenerMap.set(key, new Set());
		}
		this.listenerMap.get(key)?.add(listener);
	}

	removeListener(key: K, listener: L) {
		this.listenerMap.get(key)?.delete(listener);
	}

	removeAllListenersUnder(key: K) {
		const listeners = this.listenerMap.get(key);
		listeners?.forEach((listener) => listeners.delete(listener));
	}

	removeAllListeners(key?: K) {
		if (key !== undefined) {
			this.removeAllListenersUnder(key);
		} else {
			for (const key of this.listenerMap.keys()) {
				this.removeAllListenersUnder(key);
			}
		}
	}

	hasListener(key: K, listener: L): boolean {
		return this.listenerMap.get(key)?.has(listener) ? true : false;
	}

	async fireListeners(key: K, ...args: Parameters<L>): Promise<void> {
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
