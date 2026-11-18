// Packages dist/release into dist/qnote-<version>.xpi. Run via `npm run xpi` (builds first).
import fs from "node:fs";
import AdmZip from "adm-zip";

const DIR = "dist/release";
const { version } = JSON.parse(fs.readFileSync(`${DIR}/manifest.json`, "utf8"));

// Cache busting: "?version=version" -> "?version=<version>"
for (const f of fs.readdirSync(DIR, { recursive: true }).filter(f => /\.(m?js|html|css|json)$/.test(f))) {
	const p = `${DIR}/${f}`;
	fs.writeFileSync(p, fs.readFileSync(p, "utf8").replaceAll("?version=version", `?version=${version}`));
}

const zip = new AdmZip();
zip.addLocalFolder(DIR);
zip.writeZip(`dist/qnote-${version}.xpi`);
