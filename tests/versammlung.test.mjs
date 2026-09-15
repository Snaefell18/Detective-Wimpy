/**
 * Der Rat zwischen Kapiteln: alte Sagas bleiben gültig, die richtige Lücke
 * wird gefunden und Modellzahlen können den verborgenen Beweis nicht in
 * einem einzigen absurden Sprung freigeben.
 */
import { SagaVorgabenSchema } from "../lib/schemas.ts";
import { STANDARD_SAGA_VORGABEN } from "../lib/sagaTypen.ts";
import {
  VERSAMMLUNG_BEWEIS_SCHWELLE,
  VERSAMMLUNG_PLUS_MAX,
  VERSAMMLUNG_PLUS_MIN,
  VERSAMMLUNG_ZWANGSENDE,
  versammlungNach,
  oeffentlicheVersammlungen,
  versammlungsFortschritt,
  versammlungsMittel,
} from "../lib/versammlung.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const rat = {
  id: "rat-1",
  nachKapitel: 1,
  name: "Rat der krummen Löffel",
  anlass: "Die Uhren laufen rückwärts.",
  thema: "Wer hat sie verstellt?",
  vorsitzId: "nala",
  teilnehmerIds: ["nala", "fanny", "bock"],
  beobachterIds: ["boss"],
  undercoverId: "boss",
};

console.log("\n1. Die Versammlung liegt in genau einer Lücke");
{
  const vorgaben = { ...STANDARD_SAGA_VORGABEN, versammlungen: [rat] };
  pruefe("nach Kapitel 1 gefunden", versammlungNach(vorgaben, 1)?.id === "rat-1");
  pruefe("nach Kapitel 2 ist nichts", versammlungNach(vorgaben, 2) === null);
  pruefe("ohne neue Felder ist nichts", versammlungNach(undefined, 1) === null);
}

console.log("\n2. Die Vorgaben gehen sicher zum Server");
{
  const neu = SagaVorgabenSchema.safeParse({ ...STANDARD_SAGA_VORGABEN, versammlungen: [rat] });
  pruefe("vollständiger Rat wird angenommen", neu.success, neu.error?.issues[0]?.message);
  pruefe("Undercover-Rolle bleibt erhalten", neu.data?.versammlungen[0].undercoverId === "boss");
  const offen = oeffentlicheVersammlungen([rat]);
  pruefe("in der offenen Saga ist Undercover unsichtbar", offen[0].undercoverId === "");
  pruefe("im Original für den versiegelten Bogen bleibt es stehen", rat.undercoverId === "boss");

  const { versammlungen: _weg, ...alt } = STANDARD_SAGA_VORGABEN;
  const alteSaga = SagaVorgabenSchema.safeParse(alt);
  pruefe("alte Saga ohne Feld bleibt gültig", alteSaga.success);
  pruefe("sie bekommt eine leere Liste", alteSaga.data?.versammlungen.length === 0);

  const kaputt = SagaVorgabenSchema.safeParse({
    ...STANDARD_SAGA_VORGABEN,
    versammlungen: [{ ...rat, teilnehmerIds: ["nala"] }],
  });
  pruefe("ein Einpersonenrat wird abgelehnt", !kaputt.success);
}

console.log("\n3. Die verborgene Resonanz ist begrenzt");
{
  pruefe("Eröffnung zählt nicht", versammlungsFortschritt(999, true) === 0);
  pruefe("riesige Modellzahl wird gekappt", versammlungsFortschritt(999) === VERSAMMLUNG_PLUS_MAX);
  pruefe("negative Modellzahl bringt wenigstens etwas", versammlungsFortschritt(-50) === VERSAMMLUNG_PLUS_MIN);
  pruefe("kaputter Wert fällt sicher zurück", versammlungsFortschritt("Quallen") === 12);
  pruefe(
    "Schwelle braucht mehrere Züge",
    Math.ceil(VERSAMMLUNG_BEWEIS_SCHWELLE / VERSAMMLUNG_PLUS_MAX) >= 3,
  );

  /*
   * Und sie ist auch dann erreicht, wenn jeder einzelne Zug nur das Minimum
   * trägt: Eine Versammlung, aus der man nach zwölf Runden ohne das
   * Beweisstück herausgeht, wäre nur verlorene Zeit.
   */
  let fortschritt = 0;
  let runden = 0;
  while (fortschritt < VERSAMMLUNG_BEWEIS_SCHWELLE && runden < VERSAMMLUNG_ZWANGSENDE) {
    fortschritt = Math.min(100, fortschritt + versammlungsFortschritt(0));
    runden++;
  }
  pruefe(
    "selbst schwächste Züge finden das Stück vor dem Zwangsende",
    fortschritt >= VERSAMMLUNG_BEWEIS_SCHWELLE,
    `${runden} von ${VERSAMMLUNG_ZWANGSENDE} Runden`,
  );

  let gute = 0;
  let zuege = 0;
  while (gute < VERSAMMLUNG_BEWEIS_SCHWELLE) {
    gute = Math.min(100, gute + versammlungsFortschritt(VERSAMMLUNG_PLUS_MAX));
    zuege++;
  }
  pruefe("mit guten Fragen geht es zügig", zuege <= 3, `${zuege} Züge`);
  pruefe("aber nie in einem einzigen Zug", VERSAMMLUNG_PLUS_MAX < VERSAMMLUNG_BEWEIS_SCHWELLE);
}

console.log("\n4. Der Fund passt in die Beweismitteltasche");
{
  const mittel = versammlungsMittel(
    {
      itemId: "rat-beweis",
      name: "Faltiges Protokoll",
      bild: null,
      beobachtung: "Die Tinte ist noch warm.",
      vermutung: "Das wurde eben ergänzt.",
      herkunft: "Ratssaal",
      siegel: "geheim",
    },
    123,
  );
  pruefe("Id und Siegel bleiben", mittel.id === "rat-beweis" && mittel.siegel === "geheim");
  pruefe("fehlendes Bild wird leer", mittel.bild === "");
  pruefe("Zeit bleibt bestimmbar", mittel.seit === 123);
}

console.log(fehlgeschlagen === 0 ? "\nAlles sauber.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
