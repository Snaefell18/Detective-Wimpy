/**
 * Die Graspiste: ein Trampelpfad, kein gestreifter Teppich.
 *
 * Sie hatte zwei helle Spurrillen - als Feldweg gedacht, im Bild aber zwei
 * harte Striche, die die Piste zerschnitten. Hier steht deshalb unter
 * Aufsicht, dass die Fläche quer gleichmäßig bleibt: Kein Streifen darf sich
 * an einer festen Stelle über die ganze Länge durchziehen. Dazu die beiden
 * Masken, die daran hängen - der ausgefranste Rand und die Wiese.
 *
 * Gerechnet wird ohne Bildschirm: Die Texturen sind reine Zahlenfelder.
 */
import { naturStrassenTextur, wegKanteTextur, wiesenTextur } from "../components/stadtBau.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

/** Die mittlere Helligkeit je Spalte - darin zeigt sich jeder Längsstreifen. */
const spalten = (bild) => {
  const { data, width, height } = bild;
  const werte = [];
  for (let x = 0; x < width; x++) {
    let summe = 0;
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      summe += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    werte.push(summe / height);
  }
  return werte;
};

console.log("\n1. Kein Streifen auf der Graspiste");
{
  const gras = naturStrassenTextur("gras").image;
  const werte = spalten(gras);
  const spanne = Math.max(...werte) - Math.min(...werte);
  /*
   * Acht Stufen auf 255 sind das Rauschen einer Wiese; die alten Spurrillen
   * lagen um ein Vielfaches darüber. Wer hier scheitert, hat der Piste
   * wieder eine Zeichnung gegeben.
   */
  pruefe("quer bleibt es gleichmäßig", spanne < 8, `Spanne ${spanne.toFixed(1)}`);
  pruefe("und es ist überhaupt Gras", werte[0] > 80 && werte[0] < 190, werte[0].toFixed(0));

  // Die Sandpiste behält ihre Spuren - dort waren sie nie das Problem.
  const sand = spalten(naturStrassenTextur("sand").image);
  const sandSpanne = Math.max(...sand) - Math.min(...sand);
  pruefe("Sand hat weiter seine Spuren", sandSpanne > 8, `Spanne ${sandSpanne.toFixed(1)}`);
}

console.log("\n2. Der ausgefranste Rand");
{
  const kante = wegKanteTextur().image;
  const { data, width, height } = kante;
  const bei = (u, v) => data[((Math.round(v * (height - 1)) * width) + Math.round(u * (width - 1))) * 4];
  pruefe("in der Mitte deckt der Weg", bei(0.5, 0.3) === 255);
  pruefe("am linken Rand ist er weg", bei(0, 0.3) === 0);
  pruefe("am rechten auch", bei(1, 0.3) === 0);
  // Der Saum wackelt: An zwei Stellen der Länge liegt die Grenze nicht gleich.
  const grenzen = [];
  for (const v of [0.1, 0.35, 0.6, 0.85]) {
    let x = 0;
    while (x < width && bei(x / (width - 1), v) < 128) x++;
    grenzen.push(x);
  }
  pruefe("und er ist nicht mit dem Lineal gezogen", new Set(grenzen).size > 1, grenzen.join(","));
}

console.log("\n3. Die Wiese ist ein Muster, keine Farbe");
{
  const wiese = wiesenTextur().image;
  const { data } = wiese;
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const wert = data[i + 1];
    if (wert < min) min = wert;
    if (wert > max) max = wert;
  }
  pruefe("sie hat helle und dunkle Stellen", max - min > 40, `${min} bis ${max}`);
  pruefe("bleibt aber hell genug zum Einfärben", min > 120, `dunkelster Punkt ${min}`);
}

console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.` : "\nAlles gut.");
process.exit(fehlgeschlagen ? 1 : 0);
