/**
 * Erzeugt für jede große Location `name.glb` eine spielbare `name-web.glb`.
 * Bereits frische Web-Dateien werden ausgelassen, damit der Build schnell
 * bleibt. Die Rohdateien sind gitignoriert; in Git gehört nur `-web.glb`.
 *
 * Aufruf:  npm run locations3d:optimieren
 * Prüfung: npm run locations3d:optimieren -- --pruefen
 * Kleiner: npm run locations3d:optimieren -- --klein
 *
 * `--klein` ist für Dateien, die auch nach dem ersten Durchlauf zu groß sind:
 * halb so große Texturen, stärker vereinfachte Geometrie. Das kostet sichtbar
 * Details, bringt aber oft den Sprung unter die 25 MB, die die GitHub-Weboberfläche
 * je Datei annimmt. Am Ende steht die erreichte Größe im Protokoll.
 */
import { readdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

const ORDNER = join(process.cwd(), "public", "3d_locations");
const pruefen = process.argv.includes("--pruefen");
const klein = process.argv.includes("--klein");
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const bin = join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "gltf-transform.cmd" : "gltf-transform");
const namen = (await readdir(ORDNER).catch(() => []))
  .filter((name) => name.toLowerCase().endsWith(".glb") && !/-web\.glb$/i.test(name));

let erstellt = 0;
for (const name of namen) {
  const quelle = join(ORDNER, name);
  const ziel = join(ORDNER, name.replace(/\.glb$/i, "-web.glb"));
  const [roh, web] = await Promise.all([stat(quelle), stat(ziel).catch(() => null)]);
  // Mit --klein wird auch neu gerechnet, was schon eine frische Webfassung hat.
  if (web && web.mtimeMs >= roh.mtimeMs && !klein) continue;
  if (pruefen) {
    console.log(`würde optimieren: ${name}`);
    continue;
  }
  await new Promise((resolve, reject) => {
    const prozess = spawn(bin, ["optimize", quelle, ziel,
      "--compress", "meshopt", "--meshopt-level", "high",
      "--texture-compress", "webp", "--texture-size", klein ? "512" : "1024",
      "--simplify-ratio", klein ? "0.5" : "0.7", "--simplify-error", klein ? "0.002" : "0.001"], { stdio: "inherit" });
    prozess.on("error", reject);
    prozess.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${name} konnte nicht optimiert werden.`)));
  });
  erstellt++;
  const fertig = await stat(ziel).catch(() => null);
  if (fertig) {
    const passt = fertig.size <= 25 * 1024 * 1024;
    console.log(
      `${name}: ${mb(roh.size)} -> ${mb(fertig.size)}` +
        (passt
          ? " (passt durch die GitHub-Weboberfläche)"
          : " - über 25 MB: entweder mit --klein noch einmal, oder per git push statt über den Browser"),
    );
  }
}
console.log(erstellt ? `${erstellt} 3D-Location(s) optimiert.` : "Alle 3D-Webversionen sind aktuell.");
