import { getElementByIdOrDie } from "../modules/common.mjs";

window.addEventListener("DOMContentLoaded", async () => {
	const preferencesA        = getElementByIdOrDie("preferences") as HTMLLinkElement;
	preferencesA.addEventListener("click", () =>{
		browser.runtime.openOptionsPage();
	});
});
