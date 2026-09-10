/**
 * Wenn sich der Täter einer gewöhnlichen Runde entpuppt.
 *
 * Das Heikle daran ist nicht die Verwandlung, sondern alles davor: Bis zur
 * richtigen Beschuldigung darf nichts darauf hindeuten - nicht im Browser,
 * nicht in der Besetzung, nicht in den Texten. Und wer keine Dämonenformen
 * angelegt hat, soll davon gar nichts merken.
 */
import { waehleDaemonform } from "../lib/daemonEnthuellung.ts";
import { besessenheitsRegeln } from "../lib/gestaltStimme.ts";
import { buildAccusePrompt } from "../lib/prompts.ts";
import { AccuseSchema, EinstellungenSchema } from "../lib/schemas.ts";
import { besetzungFuerSaga, STANDARD_SAGA_VORGABEN } from "../lib/sagaTypen.ts";
import {
  DAEMON_HAEUFIGKEITEN,
  STANDARD_EINSTELLUNGEN,
  daemonWahrscheinlichkeit,
} from "../lib/types.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const tier = (id, name, extra = {}) => ({
  id, nummer: 1, name, tierart: "Tier", alter: 5,
  stats: { charisma: 5, freundlichkeit: 5, fitness: 5, zauberkraft: 5,
    schelmischkeit: 5, kriminalitaetslevel: 5, intelligenz: 5 },
  beschreibung: "kurz", bild: "", istDetektiv: false, ...extra,
});

const wimpy = tier("wimpy", "Wimpy", { istDetektiv: true });
const nala = tier("nala", "Nala");
const hut = tier("hut", "Herr Hut");
const schatten = tier("schatten", "Der Schatten", { istDaemon: true });
const kaelte = tier("kaelte", "Die Kälte", { istDaemon: true });
const alle = [wimpy, nala, hut, schatten, kaelte];

console.log("\n1. Die Häufigkeiten");
{
  pruefe("„aus“ ist null", daemonWahrscheinlichkeit("aus") === 0);
  pruefe("ohne Angabe auch", daemonWahrscheinlichkeit(undefined) === 0);
  pruefe("„immer“ ist eins", daemonWahrscheinlichkeit("immer") === 1);
  pruefe(
    "dazwischen liegt es dazwischen",
    daemonWahrscheinlichkeit("selten") > 0 &&
      daemonWahrscheinlichkeit("selten") < daemonWahrscheinlichkeit("manchmal"),
  );
  pruefe("vier Stufen zur Wahl", DAEMON_HAEUFIGKEITEN.length === 4);
  pruefe("die Voreinstellung ist aus", STANDARD_EINSTELLUNGEN.daemonEnthuellung === "aus");
}

console.log("\n2. Der Wurf");
{
  const immer = () => 0;
  const nie = () => 0.999;

  pruefe("bei „aus“ passiert nichts", waehleDaemonform(alle, "aus", "nala", immer) === null);
  pruefe(
    "ohne Täter passiert nichts",
    waehleDaemonform(alle, "immer", "", immer) === null,
  );
  pruefe(
    "bei „immer“ kommt eine Gestalt",
    waehleDaemonform(alle, "immer", "nala", immer)?.istDaemon === true,
  );
  pruefe(
    "der Wurf entscheidet",
    waehleDaemonform(alle, "selten", "nala", nie) === null,
  );
  pruefe(
    "ohne Dämonenformen passiert nichts",
    waehleDaemonform([wimpy, nala, hut], "immer", "nala", immer) === null,
  );
  pruefe(
    "der Detektiv wird nie zur Gestalt",
    waehleDaemonform([wimpy, nala, tier("x", "X", { istDaemon: true, istDetektiv: true })], "immer", "nala", immer) === null,
  );
  pruefe(
    "der Täter selbst auch nicht",
    waehleDaemonform([wimpy, nala, schatten], "immer", "schatten", immer) === null,
  );

  // Über viele Würfe kommen alle Formen dran.
  const gezogen = new Set();
  for (let i = 0; i < 40; i++) {
    const wahl = waehleDaemonform(alle, "immer", "nala", Math.random);
    if (wahl) gezogen.add(wahl.id);
  }
  pruefe("beide Formen kommen vor", gezogen.size === 2, [...gezogen].join(","));
}

console.log("\n3. Dämonenformen laufen nicht in der Stadt herum");
{
  const saga = besetzungFuerSaga(alle, {
    ...STANDARD_SAGA_VORGABEN,
    charaktere: [],
    drahtzieherId: "",
  });
  pruefe("aus einer Saga-Besetzung fallen sie heraus", !saga.some((c) => c.istDaemon));
  pruefe("die anderen bleiben", saga.length === 3);

  // Ausdrücklich gemeint heißt: bleibt drin.
  const mitBesessenheit = besetzungFuerSaga(alle, {
    ...STANDARD_SAGA_VORGABEN,
    charaktere: [],
    drahtzieherId: "schatten",
    besessenheit: { wirtId: "hut", daemonId: "schatten", ton: "" },
  });
  pruefe(
    "die gewählte Gestalt bleibt",
    mitBesessenheit.some((c) => c.id === "schatten"),
  );
  pruefe(
    "die andere trotzdem nicht",
    !mitBesessenheit.some((c) => c.id === "kaelte"),
  );

  const gewaehlt = besetzungFuerSaga(alle, {
    ...STANDARD_SAGA_VORGABEN,
    charaktere: ["nala", "hut", "kaelte"],
    drahtzieherId: "",
  });
  pruefe(
    "wer ausdrücklich gewählt ist, spielt mit",
    gewaehlt.some((c) => c.id === "kaelte"),
  );
}

console.log("\n4. Die Zeichen vorher - genau eines, und niemand erklärt es");
{
  const r = besessenheitsRegeln("Nala", "Der Schatten", "beschuldigung");
  pruefe("streng geheim", r.includes("streng geheim"));
  pruefe("der Wirt weiß nichts", r.includes("weiß es aber nicht"));
  pruefe("bis zur Beschuldigung", r.includes("vor der Beschuldigung nirgends vor"));
  pruefe("genau ein Zeichen", r.includes("genau EIN kleines Zeichen"));
  pruefe("und nicht mehr", r.includes("Zwei wären ein Muster"));
  pruefe("niemand nennt es beim Namen", r.includes("niemand nennt Dämon"));
  pruefe("es löst den Fall nicht", r.includes("Es darf den Fall nicht lösen"));

  const saga = besessenheitsRegeln("Nala", "Der Schatten");
  pruefe("in einer Saga geht es bis zum Finale", saga.includes("vor dem Finale nirgends vor"));
}

console.log("\n5. Die Auflösung kennt die Verwandlung");
{
  const fall = {
    id: "f", besetzung: [wimpy, nala, hut],
    items: [{ id: "lupe", name: "Lupe", beschreibung: "", bild: "" }],
    ton: "kindgerecht", reifegrad: "kindgerecht", absurditaet: "verspielt",
    stadt: "Venedig",
    orte: [{ id: "o1", stadt: "Venedig", stadtId: "v", name: "Hafen", atmosphaere: "", beschreibung: "", bild: "" }],
    introText: "", schlagworte: [], titel: "T", tatbeschreibung: "t", tatort: "o1",
    taeterId: "nala", motiv: "m", tathergang: "h",
    verdaechtige: [
      { charakterId: "nala", aufenthaltsort: "o1", alibi: "a", geheimnis: "g", alibiIstGelogen: true },
    ],
    spuren: [], erstelltAm: 1,
    besessenheit: { wirtId: "nala", daemon: schatten },
  };

  const richtig = buildAccusePrompt({
    fall, charakterId: "nala", begruendung: "", gefundeneSpuren: [],
  });
  pruefe("die Verwandlung steht drin", richtig.includes("DIE VERWANDLUNG"));
  pruefe("mit beiden Namen", richtig.includes("In Nala steckte die ganze Zeit Der Schatten"));
  pruefe("die Reaktion ist noch seine", richtig.includes("die letzten Worte von Nala, noch als er selbst"));
  pruefe("die Gestalt spricht danach", richtig.includes("die ersten Worte von Der Schatten"));
  pruefe("kein Gebrüll", richtig.includes("Kein Gebrüll, kein Blut"));
  pruefe("die Auflösung erklärt beides", richtig.includes("erklärt am Ende beides"));
  pruefe("und sagt, was aus ihm wird", richtig.includes("Er kommt zu sich"));

  // Falsch beschuldigt: Die Gestalt bleibt, wo sie ist.
  const falsch = buildAccusePrompt({
    fall, charakterId: "hut", begruendung: "", gefundeneSpuren: [],
  });
  pruefe("bei falscher Beschuldigung nichts davon", !falsch.includes("DIE VERWANDLUNG"));
  pruefe("und der Spruch bleibt leer", falsch.includes("verwandlungSpruch bleibt leer"));

  // Ohne Besessenheit ebenso.
  const ohne = buildAccusePrompt({
    fall: { ...fall, besessenheit: undefined }, charakterId: "nala",
    begruendung: "", gefundeneSpuren: [],
  });
  pruefe("ohne Gestalt nichts davon", !ohne.includes("DIE VERWANDLUNG"));
}

console.log("\n6. Die Schemata lassen alles durch");
{
  pruefe(
    "die Antwort darf einen Spruch haben",
    AccuseSchema.safeParse({ richtig: true, aufloesung: "a", reaktion: "r", verwandlungSpruch: "s" }).success,
  );
  pruefe(
    "und ohne ihn auch",
    AccuseSchema.safeParse({ richtig: true, aufloesung: "a", reaktion: "r" }).success,
  );

  const e = EinstellungenSchema.safeParse({
    ...STANDARD_EINSTELLUNGEN,
    daemonEnthuellung: "manchmal",
  });
  pruefe("die Einstellung kommt durch", e.success && e.data.daemonEnthuellung === "manchmal");

  const alt = EinstellungenSchema.safeParse({
    ...STANDARD_EINSTELLUNGEN,
    daemonEnthuellung: undefined,
  });
  pruefe("ältere Einstellungen bleiben gültig", alt.success);
  pruefe("und sind aus", alt.success && alt.data.daemonEnthuellung === "aus");

  const unsinn = EinstellungenSchema.safeParse({
    ...STANDARD_EINSTELLUNGEN,
    daemonEnthuellung: "dauernd",
  });
  pruefe("Unsinn fällt auf „aus“ zurück", unsinn.success && unsinn.data.daemonEnthuellung === "aus");
}

console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.` : "\nAlles gut.");
process.exit(fehlgeschlagen ? 1 : 0);
