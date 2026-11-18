// Copies static assets to dist/release.
//   node build.mjs          - wipe dist, copy assets (npm run build also runs tsc afterwards)
//   node build.mjs --watch  - copy assets on every change + run `tsc -w`
import fs from "node:fs";
import { spawn } from "node:child_process";

const ASSETS = ["_locales", "html", "images", "schemas", "manifest.json", "background.html"];
const copy = () => ASSETS.forEach(a => fs.cpSync(`src/${a}`, `dist/release/${a}`, { recursive: true }));

if (process.argv.includes("--watch")) {
	copy();
	let timer;
	fs.watch("src", { recursive: true }, (_, file) => {
		if (ASSETS.some(a => file?.startsWith(a))) {
			clearTimeout(timer);
			timer = setTimeout(copy, 100);
		}
	});
	spawn("tsc", ["-w", "--preserveWatchOutput"], { stdio: "inherit", shell: true });
} else {
	fs.rmSync("dist", { recursive: true, force: true });
	copy();
}
