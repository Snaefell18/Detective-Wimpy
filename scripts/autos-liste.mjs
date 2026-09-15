import { readdir, writeFile } from 'node:fs/promises';
const modelle = [];
for (const ordner of ['3d_autos', '3d-autos']) {
  for (const name of (await readdir(`public/${ordner}`).catch(() => [])).sort()) {
    if (!/\.glb$/i.test(name)) continue;
    modelle.push({ id: `${ordner}/${name}`, name: name.replace(/\.glb$/i, ''), datei: `/${ordner}/${name}` });
  }
}
await writeFile('lib/autos.generated.ts', `// Automatisch aus den 3D-Auto-Ordnern erzeugt.\nexport const AUTO_MODELLE = ${JSON.stringify(modelle, null, 2)};\n`);
