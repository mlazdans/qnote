import { NoteData } from "./Note.mjs";

type KeyId = NoteData["keyId"];
type Listener = (id: KeyId, data: NoteData) => void;
type Provider = (id: KeyId) => Promise<NoteData>;

export class QCache {
	private cache: Map<KeyId, NoteData> = new Map();
	private blocker: Set<KeyId>;
	private provider: Provider | undefined;

	constructor(provider?: Provider){
		this.cache = new Map();
		this.blocker = new Set();
		this.provider = provider;
	}

	set(data: NoteData){
		this.cache.set(data.keyId, data);
	}

	delete(id: KeyId){
		this.cache.delete(id);
	}

	clear(){
		this.cache = new Map();
	}

	// We will sync return if cache found or async and call provider
	get(id: KeyId, listener: Listener): NoteData | undefined {
		if(this.cache.has(id)){
			return this.cache.get(id);
		}

		// Block concurrent calls on same note as we will update column once it has been loded from local cache, local storage or file
		// TODO: think of better approach
		if(this.provider){
			if(!this.blocker.has(id)){
				this.blocker.add(id);
				this.provider(id).then((data: NoteData) => {
					this.set(data);
					if(listener){
						console.log("call listener", id, data);
						listener(id, data);
					}
				}).finally(() => this.blocker.delete(id));
			}
		} else {
			console.warn("Called get() but provider not set");
		}

		return undefined;
	}

	setProvider(provider: Provider){
		this.provider = provider;
	}
}
