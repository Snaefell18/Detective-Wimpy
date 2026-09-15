/**
 * Das Fahrgefühl in der Stadt.
 *
 * Geprüft wird, was man beim Spielen spürt: dass der Wagen anzieht statt zu
 * springen, dass er ein Höchsttempo hat, dass er ausrollt, bremst, rückwärts
 * fährt, in der Kurve rutscht - und dass der teurere Wagen wirklich der
 * schnellere ist.
 */
import {
  SCHRITT_TEMPO,
  STILLSTAND,
  angeeckt,
  angezeigtesTempo,
  fahrSchritt,
  fahrwerte,
  winkelDifferenz,
} from "../lib/autofahrt.ts";
import { STANDARD_AUTOS } from "../lib/autos.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const [ferrari, lambo] = STANDARD_AUTOS;
const werte = fahrwerte(ferrari);

/** Eine Weile fahren und mitschreiben, was dabei herauskommt. */
const fahren = (eingabe, sekunden, start = STILLSTAND, w = werte) => {
  let zustand = start;
  let weg = 0;
  for (let t = 0; t < sekunden; t += 0.02) {
    const schritt = fahrSchritt(zustand, eingabe, 0.02, w);
    zustand = schritt.zustand;
    weg += Math.hypot(schritt.bewegung.x, schritt.bewegung.z);
  }
  return { zustand, weg };
};

console.log("\n1. Anfahren, Höchsttempo, Ausrollen");
{
  const vollgas = { x: 0, z: 1 };
  const nachEinerZehntel = fahren(vollgas, 0.1).zustand.tempo;
  pruefe("aus dem Stand springt nichts", nachEinerZehntel < werte.hoechst * 0.2, `${nachEinerZehntel.toFixed(1)} m/s`);

  const nachEiner = fahren(vollgas, 1).zustand.tempo;
  const nachDrei = fahren(vollgas, 3).zustand.tempo;
  pruefe("nach einer Sekunde ist er in Fahrt", nachEiner > nachEinerZehntel * 3);
  pruefe("und wird weiter schneller", nachDrei > nachEiner);
  pruefe("nach drei Sekunden ist fast alles da", nachDrei > werte.hoechst * 0.75, `${nachDrei.toFixed(1)} von ${werte.hoechst.toFixed(1)}`);

  const lange = fahren(vollgas, 20).zustand.tempo;
  pruefe("das Höchsttempo hält", lange <= werte.hoechst + 0.001, `${lange.toFixed(1)}`);
  pruefe("und es ist deutlich schneller als zu Fuß", werte.hoechst > SCHRITT_TEMPO * 2.5,
    `${(werte.hoechst / SCHRITT_TEMPO).toFixed(1)}-fach`);

  // Loslassen: ausrollen statt anhalten.
  const beimLoslassen = fahren(vollgas, 4).zustand;
  const rollend = fahren({ x: 0, z: 0 }, 0.5, beimLoslassen).zustand.tempo;
  pruefe("ohne Gas rollt er weiter", rollend > 1, `${rollend.toFixed(1)} m/s`);
  pruefe("aber langsamer als beim Loslassen", rollend < beimLoslassen.tempo);
  pruefe("irgendwann steht er", fahren({ x: 0, z: 0 }, 30, fahren(vollgas, 4).zustand).zustand.tempo === 0);
}

console.log("\n2. Bremsen und rückwärts");
{
  const inFahrt = fahren({ x: 0, z: 1 }, 4).zustand;
  const gebremst = fahren({ x: 0, z: -1 }, 0.4, inFahrt).zustand.tempo;
  pruefe("der Stick nach hinten bremst", gebremst < inFahrt.tempo * 0.6, `${gebremst.toFixed(1)} m/s`);
  pruefe("und zwar schneller als Ausrollen", gebremst < fahren({ x: 0, z: 0 }, 0.4, inFahrt).zustand.tempo);

  const rueck = fahren({ x: 0, z: -1 }, 3, inFahrt).zustand.tempo;
  pruefe("danach geht es rückwärts", rueck < 0, `${rueck.toFixed(1)} m/s`);
  pruefe("aber gemächlich", Math.abs(rueck) < werte.hoechst * 0.5);
}

console.log("\n3. Lenken und driften");
{
  const inFahrt = fahren({ x: 0, z: 1 }, 3).zustand;
  const kurve = fahren({ x: 1, z: 0.2 }, 0.6, inFahrt).zustand;
  pruefe("er dreht sich zum Stick", Math.abs(winkelDifferenz(inFahrt.winkel, kurve.winkel)) > 0.3);
  pruefe("und rutscht dabei zur Seite", Math.abs(kurve.drift) > 0.05, `${kurve.drift.toFixed(2)}`);

  const handbremse = fahren({ x: 1, z: 0.2, handbremse: true }, 0.6, inFahrt).zustand;
  pruefe("mit Handbremse bricht er stärker aus", Math.abs(handbremse.drift) > Math.abs(kurve.drift));
  pruefe("und dreht enger ein", Math.abs(winkelDifferenz(inFahrt.winkel, handbremse.winkel)) >
    Math.abs(winkelDifferenz(inFahrt.winkel, kurve.winkel)));

  // Der Drift baut sich wieder ab, sonst führe der Wagen für immer schräg.
  const danach = fahren({ x: 0, z: 1 }, 2, kurve).zustand;
  pruefe("danach fängt er sich", Math.abs(danach.drift) < Math.abs(kurve.drift) * 0.3);

  // Im Stand dreht er sich nicht von selbst.
  const stehend = fahren({ x: 1, z: 0 }, 0.05).zustand;
  pruefe("aus dem Stand dreht er nicht auf der Stelle", Math.abs(stehend.winkel) < 0.05);
}

console.log("\n4. Der teurere Wagen ist auch der schnellere");
{
  const schnell = fahrwerte(lambo);
  pruefe("höheres Höchsttempo", schnell.hoechst > werte.hoechst, `${schnell.hoechst.toFixed(1)} zu ${werte.hoechst.toFixed(1)}`);
  pruefe("kräftigerer Schub", schnell.schub > werte.schub);
  pruefe("dafür träger in der Lenkung", schnell.lenkung < werte.lenkung);
  const weitFerrari = fahren({ x: 0, z: 1 }, 6).weg;
  const weitLambo = fahren({ x: 0, z: 1 }, 6, STILLSTAND, schnell).weg;
  pruefe("in sechs Sekunden kommt er weiter", weitLambo > weitFerrari,
    `${weitLambo.toFixed(0)} m zu ${weitFerrari.toFixed(0)} m`);
}

console.log("\n5. Wand und Tacho");
{
  const inFahrt = fahren({ x: 0, z: 1 }, 4).zustand;
  const dagegen = angeeckt(inFahrt);
  pruefe("an der Wand verliert er Schwung", dagegen.tempo < inFahrt.tempo * 0.6);
  pruefe("bleibt aber nicht stehen", dagegen.tempo > 0);

  pruefe("der Tacho zeigt bei Vollgas fast das Katalogtempo",
    angezeigtesTempo(fahren({ x: 0, z: 1 }, 20).zustand, werte, ferrari) >= ferrari.speed - 1,
    `${angezeigtesTempo(fahren({ x: 0, z: 1 }, 20).zustand, werte, ferrari)} km/h`);
  pruefe("und im Stand null", angezeigtesTempo(STILLSTAND, werte, ferrari) === 0);
}

console.log(fehlgeschlagen === 0 ? "\nAlles sauber.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
