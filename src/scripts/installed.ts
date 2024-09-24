window.addEventListener("DOMContentLoaded", async () => {
	const preferencesA = document.getElementById("preferences") as HTMLLinkElement | null;
	if(preferencesA) {
		preferencesA.addEventListener("click", () =>{
			browser.runtime.openOptionsPage();
		});
	}
});
