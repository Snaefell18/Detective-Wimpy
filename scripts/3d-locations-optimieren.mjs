/**
 * Erzeugt für jede große Location `name.glb` eine spielbare `name-web.glb`.
 * Bereits frische Web-Dateien werden ausgelassen, damit der Build schnell
 * bleibt. Die Rohdateien sind gitignoriert; in Git gehört nur `-web.glb`.
 *
 * Aufruf:      npm run locations3d:optimieren
 * Prüfung:     npm run locations3d:optimieren -- --pruefen
 * Kleiner:     npm run locations3d:optimieren -- --klein
 * Nachrechnen: npm run locations3d:abspecken
 *
 * Worum es hier geht: Ein Meshy-Scan bringt gern ein paar Millionen Dreiecke
 * mit. Einmal in der Mitte einer Straße sieht das niemand - aber in einer
 * selbst gelegten Stadt steht derselbe Baustein zehnmal, und dann rechnet ein
 * Handy an einem einzigen Bild so lange, bis Safari den Tab schließt. Genau
 * das ist passiert.
 *
 * Deshalb gilt ein Budget: rund 220.000 Dreiecke je Baustein. Das ist immer
 * noch ein Vielfaches dessen, was ein Spielhaus üblicherweise hat, und man
 * sieht dem Ergebnis nichts an - die Details stecken in der Textur, nicht in
 * der Geometrie. Wer über dem Budget liegt, wird so weit vereinfacht, dass er
 * hineinpasst; wer darunter liegt, bleibt, wie er ist.
 *
 * `--klein` ist für Dateien, die auch danach noch zu groß sind: halb so große
 * Texturen und ein halbiertes Budget. Das kostet sichtbar Details, bringt aber
 * oft den Sprung unter die 25 MB, die die GitHub-Weboberfläche je Datei
 * annimmt. Am Ende steht die erreichte Größe im Protokoll.
 *
 * `--nachrechnen` nimmt nicht die Rohdateien, sondern die vorhandenen
 * `-web.glb` als Quelle. Damit lassen sich Bausteine abspecken, deren
 * Rohfassung gar nicht mehr vorliegt - die liegt ja nur auf dem Rechner, auf
 * dem sie erzeugt wurde.
 */
import { readdir, rename, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

const ORDNER = join(process.cwd(), "public", "3d_locations");
const pruefen = process.argv.includes("--pruefen");
const klein = process.argv.includes("--klein");
const nachrechnen = process.argv.includes("--nachrechnen");

/** So viele Dreiecke darf ein Baustein haben, bevor er vereinfacht wird. */
const DREIECKS_BUDGET = klein ? 110_000 : 220_000;
/**
 * Und so groß darf die Datei sein, bevor auch ohne zu viele Dreiecke noch
 * einmal gerechnet wird. Was über diese Grenze geht, sind fast immer
 * ungepackte Texturen - und entpackt belegen die auf dem Handy ein
 * Vielfaches dessen, was die Geometrie kostet.
 */
const GROESSEN_BUDGET = (klein ? 3 : 6) * 1024 * 1024;
/**
 * Ab wann überhaupt vereinfacht wird.
 *
 * Nicht schon knapp über dem Budget: Manche Scans lassen sich gar nicht bis
 * dorthin zusammenfassen, und die würden bei jedem Durchlauf ein Stück mehr
 * Form verlieren, ohne je anzukommen. Erst weit darüber lohnt es sich - und
 * das Ziel bleibt trotzdem das Budget.
 */
const VEREINFACHUNGS_SCHWELLE = DREIECKS_BUDGET * 2.5;
const TEXTUR_GROESSE = klein ? "512" : "1024";

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const zahl = (wert) => wert.toLocaleString("de-DE");
const bin = join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "gltf-transform.cmd" : "gltf-transform");

const laufen = (argumente, still = false) =>
  new Promise((resolve, reject) => {
    const prozess = spawn(bin, argumente, { stdio: still ? ["ignore", "pipe", "ignore"] : "inherit" });
    let ausgabe = "";
    prozess.stdout?.on("data", (stueck) => { ausgabe += stueck; });
    prozess.on("error", reject);
    prozess.on("exit", (code) => (code === 0 ? resolve(ausgabe) : reject(new Error(`gltf-transform ${argumente[0]} fehlgeschlagen`))));
  });

/** Wie viele Dreiecke stecken in der Datei? */
async function dreiecke(datei) {
  const ausgabe = await laufen(["inspect", datei, "--format", "csv"], true).catch(() => "");
  // In der CSV-Tabelle MESHES ist glPrimitives die fünfte Spalte.
  const zeilen = ausgabe.replace(/\x1B\[[0-9;]*m/g, "").split("\n");
  const kopf = zeilen.findIndex((zeile) => zeile.startsWith("#,name,mode,meshPrimitives"));
  if (kopf < 0) return 0;
  let summe = 0;
  for (const zeile of zeilen.slice(kopf + 1)) {
    const felder = zeile.split(",");
    if (felder.length < 6 || !/^\d+$/.test(felder[0])) break;
    summe += Number(felder[4]) || 0;
  }
  return summe;
}

const optimieren = (quelle, ziel, verhaeltnis, fehler) =>
  laufen(["optimize", quelle, ziel,
    "--compress", "meshopt", "--meshopt-level", "high",
    "--texture-compress", "webp", "--texture-size", TEXTUR_GROESSE,
    "--simplify-ratio", String(verhaeltnis), "--simplify-error", String(fehler)]);

/*
 * Wie weit meshoptimizer von der Form abweichen darf. Der erste Wert hält die
 * Silhouette sehr genau - manche Scans lassen sich damit aber gar nicht
 * zusammenfassen und bleiben weit über dem Budget. Dann wird die Toleranz
 * größer, bis es passt. Jedes Mal nur so weit wie nötig.
 */
const TOLERANZEN = klein ? [0.004, 0.02, 0.06] : [0.002, 0.01, 0.04];

const namen = (await readdir(ORDNER).catch(() => []))
  .filter((name) => name.toLowerCase().endsWith(".glb"))
  .filter((name) => (nachrechnen ? /-web\.glb$/i.test(name) : !/-web\.glb$/i.test(name)));

let erstellt = 0;
for (const name of namen) {
  const quelle = join(ORDNER, name);
  const ziel = nachrechnen ? quelle : join(ORDNER, name.replace(/\.glb$/i, "-web.glb"));
  const roh = await stat(quelle);
  if (!nachrechnen) {
    const web = await stat(ziel).catch(() => null);
    // Mit --klein wird auch neu gerechnet, was schon eine frische Webfassung hat.
    if (web && web.mtimeMs >= roh.mtimeMs && !klein) continue;
  }
  const vorher = await dreiecke(quelle);
  if (nachrechnen && vorher > 0 && vorher <= VEREINFACHUNGS_SCHWELLE && roh.size <= GROESSEN_BUDGET) {
    console.log(`${name}: ${zahl(vorher)} Dreiecke, ${mb(roh.size)} - passt schon.`);
    continue;
  }
  if (pruefen) {
    console.log(`würde optimieren: ${name} (${zahl(vorher)} Dreiecke)`);
    continue;
  }
  /*
   * Erst rechnen, dann vereinfachen: Das Verhältnis ergibt sich aus dem
   * Budget und dem, was tatsächlich drinsteckt. Ein bisschen Luft dazu, weil
   * meshoptimizer den Zielwert nie genau trifft.
   */
  const verhaeltnis = vorher > VEREINFACHUNGS_SCHWELLE
    ? Math.max(0.01, Math.round((DREIECKS_BUDGET / vorher) * 0.95 * 1000) / 1000)
    : 1;
  /*
   * Beim Nachrechnen ist Quelle gleich Ziel, es braucht also einen
   * Zwischenschritt. Der muss auf .glb enden: Ohne diese Endung schreibt
   * gltf-transform kein gepacktes GLB, sondern glTF mit losen .bin- und
   * .webp-Dateien daneben - und die überschreiben sich beim nächsten
   * Baustein gegenseitig.
   */
  const arbeitsdatei = nachrechnen ? join(ORDNER, "zwischenschritt-abspecken.glb") : ziel;
  let nachher = 0;
  try {
    for (const toleranz of TOLERANZEN) {
      await optimieren(quelle, arbeitsdatei, verhaeltnis, toleranz);
      nachher = await dreiecke(arbeitsdatei);
      // Ein Drittel über dem Budget ist noch in Ordnung; das Doppelte nicht.
      // Ohne Vereinfachung hilft mehr Toleranz ohnehin nicht weiter.
      if (verhaeltnis >= 1 || nachher <= DREIECKS_BUDGET * 1.35) break;
      if (toleranz === TOLERANZEN[TOLERANZEN.length - 1]) break;
      console.log(`  ${name}: ${zahl(nachher)} Dreiecke - noch einmal mit mehr Toleranz.`);
    }
    const gerechnet = await stat(arbeitsdatei);
    /*
     * Und wenn dabei nichts herauskommt, bleibt alles, wie es war. Sonst
     * würde jeder Durchlauf dieselben Texturen erneut durch WebP schicken
     * und jedes Mal ein wenig Bildqualität kosten, ohne etwas zu sparen.
     */
    if (nachrechnen && gerechnet.size > roh.size * 0.95) {
      console.log(`${name}: ${zahl(vorher)} Dreiecke, ${mb(roh.size)} - kleiner geht es nicht.`);
      continue;
    }
    if (nachrechnen) await rename(arbeitsdatei, ziel);
  } finally {
    if (nachrechnen) await rm(arbeitsdatei, { force: true });
  }
  erstellt++;
  const fertig = await stat(ziel).catch(() => null);
  if (fertig) {
    const passt = fertig.size <= 25 * 1024 * 1024;
    console.log(
      `${name}: ${mb(roh.size)} -> ${mb(fertig.size)} · ${zahl(vorher)} -> ${zahl(nachher)} Dreiecke` +
        (passt
          ? " (passt durch die GitHub-Weboberfläche)"
          : " - über 25 MB: entweder mit --klein noch einmal, oder per git push statt über den Browser"),
    );
  }
}
console.log(erstellt ? `${erstellt} 3D-Location(s) optimiert.` : "Alle 3D-Webversionen sind aktuell.");
