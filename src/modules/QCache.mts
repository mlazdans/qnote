import { NoteData } from "./Note.mjs";

type KeyId = NoteData["keyId"];
type Listener = (id: KeyId, data: NoteData) => void;
type Provider = (id: KeyId) => Promise<NoteData>;

export class QCache {
	private cache: Map<KeyId, NoteData> = new Map();
	private provider: Provider | undefined;

	constructor(provider?: Provider){
		this.cache = new Map();
		this.provider = provider;
	}

	set(keyId: KeyId, data: NoteData){
		this.cache.set(keyId, data);
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

		if(this.provider){
			this.provider(id).then((data: NoteData) => {
				this.set(id, data);
				if(listener){
					listener(id, data);
				}
			});
		} else {
			console.warn("Called get() but provider not set");
		}

		return undefined;
	}

	setProvider(provider: Provider){
		this.provider = provider;
	}
}
