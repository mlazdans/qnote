// Access control for other add-ons using QNote's external API (runtime.onMessageExternal).
// Stored separately from regular prefs because it is a map, not a scalar.
// NOTE: key must start with "pref." - with "ext" storage option, every other key is treated as a note.

const STORAGE_KEY = "pref.externalAccess";

// extension id -> true (allowed) | false (denied by user) | null (requested, user not asked/answered yet)
export type ExternalAccessState = boolean | null;
export type ExternalAccessMap = Record<string, ExternalAccessState>;

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
