// Access control for other add-ons using QNote's external API (runtime.onMessageExternal).
// Stored separately from regular prefs because it is a map, not a scalar.
// NOTE: key must start with "pref." - with "ext" storage option, every other key is treated as a note.

const STORAGE_KEY = "pref.externalAccess";

// extension id -> true (allowed) | false (denied by user) | null (requested, user not asked/answered yet)
export type ExternalAccessState = boolean | null;
export type ExternalAccessMap = Record<string, ExternalAccessState>;
export type ExternalAccessStatus = "unknown" | "pending" | "granted" | "denied";

// Requests from other add-ons, after parseExternalRequest()
export interface ExternalStatusRequest {
	command: "getStatus" | "requestAccess";
}

export interface ExternalNotesRequest {
	command: "getNotes";
	headerMessageIds: string[];
}

export type ExternalRequest = ExternalStatusRequest | ExternalNotesRequest;

export const EXTERNAL_MAX_BATCH = 1000;

export class ExternalRequestError extends Error {
	constructor(public code: "invalid-request" | "unknown-command") {
		super(code);
	}
}

// Validates untrusted message from other add-on, throws ExternalRequestError if ill-formed
export function parseExternalRequest(msg: unknown): ExternalRequest {
	if(!msg || typeof msg !== "object" || !("command" in msg)){
		throw new ExternalRequestError("invalid-request");
	}

	switch(msg.command){
		case "getStatus":
		case "requestAccess":
			return { command: msg.command };
		case "getNotes": {
			const ids = "headerMessageIds" in msg ? msg.headerMessageIds : undefined;
			if(!Array.isArray(ids) || ids.length > EXTERNAL_MAX_BATCH || !ids.every(id => typeof id === "string" && id)){
				throw new ExternalRequestError("invalid-request");
			}
			return { command: "getNotes", headerMessageIds: ids };
		}
		default:
			throw new ExternalRequestError("unknown-command");
	}
}

export async function getExternalAccessStatus(extensionId: string): Promise<ExternalAccessStatus> {
	const state = (await getExternalAccess())[extensionId];

	if(state === true){
		return "granted";
	}
	if(state === false){
		return "denied";
	}
	if(state === null){
		return "pending";
	}
	return "unknown";
}

export async function getExternalAccess(): Promise<ExternalAccessMap> {
	const v = await browser.storage.local.get(STORAGE_KEY);
	const map = v[STORAGE_KEY];
	return (map && typeof map === "object") ? { ...map } : {};
}

async function saveExternalAccess(map: ExternalAccessMap) {
	return browser.storage.local.set({ [STORAGE_KEY]: map });
}

export async function setExternalAccess(extensionId: string, state: ExternalAccessState) {
	const map = await getExternalAccess();
	map[extensionId] = state;
	return saveExternalAccess(map);
}

export async function removeExternalAccess(extensionId: string) {
	const map = await getExternalAccess();
	delete map[extensionId];
	return saveExternalAccess(map);
}

export function onExternalAccessChanged(callback: (map: ExternalAccessMap) => void) {
	browser.storage.onChanged.addListener((changes, areaName) => {
		if(areaName === "local" && changes[STORAGE_KEY]){
			callback(changes[STORAGE_KEY].newValue ?? {});
		}
	});
}
