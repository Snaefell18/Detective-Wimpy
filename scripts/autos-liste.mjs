/**
 * Erstellt den Katalog aller Autos in /public/3d_autos.
 *
 * Nebenbei wird gemessen, wie das Modell in seiner Datei liegt: Gefahren wird
 * in Richtung +z, und die meisten Exporte legen den Wagen quer. Wer das nicht
 * misst, muss jedes neue Auto von Hand geraderücken - so steht es schon
 * richtig da, sobald die Datei im Ordner liegt.
 */
import { readdir, writeFile } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';

const io = new NodeIO();

/** Liegt der Wagen quer (lange Achse x) statt in Fahrtrichtung (z)? */
async function liegtQuer(pfad) {
  try {
    const doc = await io.read(pfad);
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (!pos) continue;
        const mn = pos.getMin([]);
        const mx = pos.getMax([]);
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], mn[i]);
          max[i] = Math.max(max[i], mx[i]);
        }
      }
    }
    const breite = max[0] - min[0];
    const laenge = max[2] - min[2];
    return Number.isFinite(breite) && Number.isFinite(laenge) ? breite > laenge * 1.1 : false;
  } catch {
    // Komprimierte oder ungewöhnliche Dateien: lieber ungedreht lassen, das
    // stellt man im Admin-Menü mit einem Griff gerade.
    return false;
  }
}

const modelle = [];
for (const ordner of ['3d_autos', '3d-autos']) {
  for (const name of (await readdir(`public/${ordner}`).catch(() => [])).sort()) {
    if (!/\.glb$/i.test(name)) continue;
    modelle.push({
      id: `${ordner}/${name}`,
      name: name.replace(/\.glb$/i, ''),
      datei: `/${ordner}/${name}`,
      quer: await liegtQuer(`public/${ordner}/${name}`),
    });
  }
}
await writeFile('lib/autos.generated.ts', `// Automatisch aus den 3D-Auto-Ordnern erzeugt.\nexport const AUTO_MODELLE = ${JSON.stringify(modelle, null, 2)};\n`);
console.log(`autos.generated.ts: ${modelle.length} Automodell(e), davon ${modelle.filter((m) => m.quer).length} quer liegend`);
