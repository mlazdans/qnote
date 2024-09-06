type FunctionWithArgs = (...args: any) => any;

export class QEventDispatcher<A, K extends keyof A = keyof A, L extends FunctionWithArgs & A[K] = FunctionWithArgs & A[K]> {
	private listenerMap: Map<K, Set<L>>;

	constructor(key: K, ...moreKeys: K[]) {
		this.listenerMap = new Map([[key, new Set()]]);
		for (const key of moreKeys) {
			this.listenerMap.set(key, new Set());
		}
	}

	addListener(key: K, listener: L) {
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
