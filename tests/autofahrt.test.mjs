/**
 * Das Fahrgefühl in der Stadt.
 *
 * Gesteuert wird der Wagen wie Wimpy zu Fuß: Der Stick zeigt, wohin es gehen
 * soll, und dorthin geht es. Geprüft wird deshalb beides - dass die Richtung
 * wirklich der Richtung folgt, und dass trotzdem ein Auto daraus wird: Es
 * zieht an, hat ein Höchsttempo, rollt aus, geht in der Kurve von selbst vom
 * Gas und rutscht mit Handbremse quer. Und dass der teurere Wagen wirklich
 * der schnellere ist.
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

// Der erste im Regal ist Wimpys Startwagen, der zweite ein Wagen zum Kaufen.
const [alltag, sportlich] = STANDARD_AUTOS;
const werte = fahrwerte(alltag);

/** Eine Weile fahren und mitschreiben, was dabei herauskommt. */
const fahren = (eingabe, sekunden, start = STILLSTAND, w = werte) => {
  let zustand = start;
  let weg = 0;
  let verschoben = { x: 0, z: 0 };
  for (let t = 0; t < sekunden; t += 0.02) {
    const schritt = fahrSchritt(zustand, eingabe, 0.02, w);
    zustand = schritt.zustand;
    weg += Math.hypot(schritt.bewegung.x, schritt.bewegung.z);
    verschoben = { x: verschoben.x + schritt.bewegung.x, z: verschoben.z + schritt.bewegung.z };
  }
  return { zustand, weg, verschoben };
};

console.log("\n1. Der Stick zeigt, wohin es geht - wie zu Fuß");
{
  // Aus dem Stand in eine beliebige Richtung: Der Wagen nimmt sie sofort an.
  const nachRechts = fahren({ x: 1, z: 0 }, 0.3).zustand;
  pruefe("aus dem Stand heraus folgt der Kurs sofort dem Stick",
    Math.abs(winkelDifferenz(nachRechts.kurs, Math.PI / 2)) < 0.15,
    `${nachRechts.kurs.toFixed(2)} statt ${(Math.PI / 2).toFixed(2)}`);
  pruefe("und die Karosserie schaut dorthin",
    Math.abs(winkelDifferenz(nachRechts.winkel, Math.PI / 2)) < 0.3);

  // Und er fährt auch wirklich dorthin, nicht irgendwohin.
  const weg = fahren({ x: 1, z: 0 }, 3).verschoben;
  pruefe("gefahren wird in die Stickrichtung", weg.x > 0 && Math.abs(weg.z) < Math.abs(weg.x) * 0.15,
    `x ${weg.x.toFixed(1)} / z ${weg.z.toFixed(1)}`);

  // Richtungswechsel im Schritttempo: fast ohne Bogen.
  const langsam = fahren({ x: 0, z: 1 }, 0.35).zustand;
  pruefe("im Schritttempo ist er noch langsam", langsam.tempo < SCHRITT_TEMPO * 1.2, `${langsam.tempo.toFixed(1)} m/s`);
  const gewendet = fahren({ x: -1, z: 0 }, 0.35, langsam).zustand;
  pruefe("und wechselt die Richtung fast sofort",
    Math.abs(winkelDifferenz(gewendet.kurs, -Math.PI / 2)) < 0.2,
    `${gewendet.kurs.toFixed(2)}`);

  // Kein Rückwärtsgang, kein Umschalten: Der Stick nach hinten dreht ihn um.
  const inFahrt = fahren({ x: 0, z: 1 }, 4).zustand;
  const umgedreht = fahren({ x: 0, z: -1 }, 2, inFahrt).zustand;
  pruefe("der Stick nach hinten dreht ihn um, statt rückwärts zu fahren",
    Math.abs(winkelDifferenz(umgedreht.kurs, Math.PI)) < 0.2, `${umgedreht.kurs.toFixed(2)}`);
  pruefe("und das Tempo bleibt dabei positiv", umgedreht.tempo > 0);
  pruefe("die Wende dauert nicht ewig",
    Math.abs(winkelDifferenz(fahren({ x: 0, z: -1 }, 1.2, inFahrt).zustand.kurs, Math.PI)) < 0.6);
}

console.log("\n2. Anfahren, Höchsttempo, Ausrollen");
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

  // Halb gedrückter Stick: halbes Tempo. Auch das ist wie zu Fuß.
  const halb = fahren({ x: 0, z: 0.5 }, 8).zustand.tempo;
  pruefe("halber Stick heißt halbes Tempo", Math.abs(halb - werte.hoechst * 0.5) < 0.6,
    `${halb.toFixed(1)} von ${werte.hoechst.toFixed(1)}`);

  // Loslassen: ausrollen statt anhalten.
  const beimLoslassen = fahren(vollgas, 4).zustand;
  const rollend = fahren({ x: 0, z: 0 }, 0.5, beimLoslassen).zustand.tempo;
  pruefe("ohne Gas rollt er weiter", rollend > 1, `${rollend.toFixed(1)} m/s`);
  pruefe("aber langsamer als beim Loslassen", rollend < beimLoslassen.tempo);
  pruefe("irgendwann steht er", fahren({ x: 0, z: 0 }, 30, beimLoslassen).zustand.tempo === 0);
  pruefe("und beim Ausrollen behält er die Richtung",
    fahren({ x: 0, z: 0 }, 1, beimLoslassen).zustand.kurs === beimLoslassen.kurs);
}

console.log("\n3. Kurven, Bögen und die Handbremse");
{
  const inFahrt = fahren({ x: 0, z: 1 }, 4).zustand;

  // Mit Tempo zieht er einen Bogen, statt abzuknicken - aber er kommt an.
  const quer = fahren({ x: 1, z: 0 }, 0.25, inFahrt).zustand;
  pruefe("mit Tempo braucht die Kurve einen Bogen",
    Math.abs(winkelDifferenz(quer.kurs, Math.PI / 2)) > 0.3, `${quer.kurs.toFixed(2)}`);
  const durch = fahren({ x: 1, z: 0 }, 1.5, inFahrt).zustand;
  pruefe("nach einer Weile liegt er auf dem neuen Kurs",
    Math.abs(winkelDifferenz(durch.kurs, Math.PI / 2)) < 0.15, `${durch.kurs.toFixed(2)}`);

  // Wer quer zieht, geht von selbst vom Gas - dadurch wird die Kurve enger.
  pruefe("in der Kurve nimmt er Tempo heraus", quer.tempo < inFahrt.tempo,
    `${quer.tempo.toFixed(1)} statt ${inFahrt.tempo.toFixed(1)}`);
  pruefe("und danach zieht er wieder an",
    fahren({ x: 1, z: 0 }, 4, inFahrt).zustand.tempo > quer.tempo + 1);

  // Der sichtbare Drift: Die Karosserie hängt dem Kurs hinterher.
  pruefe("in der Kurve steht die Karosserie schräg", Math.abs(quer.drift) > 0.05, `${quer.drift.toFixed(2)}`);

  const handbremse = fahren({ x: 1, z: 0, handbremse: true }, 0.25, inFahrt).zustand;
  pruefe("mit Handbremse steht sie deutlich schräger",
    Math.abs(handbremse.drift) > Math.abs(quer.drift) * 1.5,
    `${handbremse.drift.toFixed(2)} statt ${quer.drift.toFixed(2)}`);
  pruefe("dafür behält sie mehr Tempo", handbremse.tempo > quer.tempo);
  pruefe("und der Wagen schiebt weiter geradeaus",
    Math.abs(winkelDifferenz(inFahrt.kurs, handbremse.kurs)) <
      Math.abs(winkelDifferenz(inFahrt.kurs, quer.kurs)));

  // Der Drift baut sich wieder ab, sonst führe der Wagen für immer schräg.
  const danach = fahren({ x: 1, z: 0 }, 2, handbremse).zustand;
  pruefe("danach fängt er sich", Math.abs(danach.drift) < Math.abs(handbremse.drift) * 0.3,
    `${danach.drift.toFixed(3)}`);
}

console.log("\n4. Der teurere Wagen ist auch der schnellere");
{
  const schnell = fahrwerte(sportlich);
  pruefe("höheres Höchsttempo", schnell.hoechst > werte.hoechst, `${schnell.hoechst.toFixed(1)} zu ${werte.hoechst.toFixed(1)}`);
  pruefe("kräftigerer Schub", schnell.schub > werte.schub);
  pruefe("dafür zieht er weitere Bögen", schnell.kurve < werte.kurve);
  const weitAlltag = fahren({ x: 0, z: 1 }, 6).weg;
  const weitSport = fahren({ x: 0, z: 1 }, 6, STILLSTAND, schnell).weg;
  pruefe("in sechs Sekunden kommt er weiter", weitSport > weitAlltag,
    `${weitSport.toFixed(0)} m zu ${weitAlltag.toFixed(0)} m`);
}

console.log("\n5. Wand und Tacho");
{
  const inFahrt = fahren({ x: 0, z: 1 }, 4).zustand;
  const dagegen = angeeckt(inFahrt);
  pruefe("an der Wand verliert er Schwung", dagegen.tempo < inFahrt.tempo * 0.6);
  pruefe("bleibt aber nicht stehen", dagegen.tempo > 0);
  pruefe("und behält seine Richtung", dagegen.kurs === inFahrt.kurs);

  pruefe("der Tacho zeigt bei Vollgas fast das Katalogtempo",
    angezeigtesTempo(fahren({ x: 0, z: 1 }, 20).zustand, werte, alltag) >= alltag.speed - 1,
    `${angezeigtesTempo(fahren({ x: 0, z: 1 }, 20).zustand, werte, alltag)} km/h`);
  pruefe("und im Stand null", angezeigtesTempo(STILLSTAND, werte, alltag) === 0);
}

console.log(fehlgeschlagen === 0 ? "\nAlles sauber.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
