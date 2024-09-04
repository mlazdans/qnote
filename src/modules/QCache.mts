import { NoteData } from "./Note.mjs";

type Listener = (id: string, data: NoteData) => void;
type Provider = (id: string) => Promise<NoteData>;

export class QCache {
	private cache: Map<string, NoteData> = new Map();
	private blocker: Set<string>;
	private provider: Provider | undefined;

	constructor(provider?: Provider){
		this.cache = new Map();
		this.blocker = new Set();
		this.provider = provider;
	}

	set(id: string, data: NoteData){
		this.cache.set(id, data);
	}

	delete(id: string){
		this.cache.delete(id);
	}

	clear(){
		this.cache = new Map();
	}

	// We will sync return if cache found or async and call provider
	get(id: string, listener?: Listener): NoteData | undefined {
		if(this.cache.has(id)){
			return this.cache.get(id);
		}

		// Block concurrent calls on same note as we will update column once it has been loded from local cache, local storage or file
		// TODO: think of better approach
		if(this.provider){
			if(!this.blocker.has(id)){
				this.blocker.add(id);
				this.provider(id).then((data: NoteData) => {
					this.set(id, data);
					if(listener){
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
