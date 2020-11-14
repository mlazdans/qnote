var EXPORTED_SYMBOLS = ["QCache"];

class QCache {
	constructor(provider){
		this.blocker = new Map();
		this.cache = new Map();
		this.provider = provider;
	}

	set(id, data){
		this.cache.set(id, data);
	}

	delete(id){
		this.cache.delete(id);
	}

	clear(){
		this.cache = new Map();
	}

	// We will sync return if cache found or async and call provider
	get(id, listener){
		if(this.cache.has(id)){
			return this.cache.get(id);
		}

		let blocker = this.blocker;

		// Block concurrent calls on same note as we will update column once it has been loded from local cache, local storage or file
		// Not 100% sure if necessary but calls to column update can be quite many
		if(!blocker.has(id)){
			blocker.set(id, true);
			this.provider(id).then(data => {
				this.set(id, data);
				if(listener){
					listener(id, data);
				}
			}).finally(() => {
				// Unblock concurrent calls
				blocker.delete(id);
			});
		}

		return {};
	}
}
