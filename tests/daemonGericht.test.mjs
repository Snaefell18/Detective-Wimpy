/**
 * Der ganze Weg von „Gericht & Dämon".
 *
 * Der Ablauf, den es abzusichern gilt: Man klagt das Tier in seiner normalen
 * Form an, erst danach bricht die Gestalt aus ihm heraus und sitzt an seiner
 * Stelle auf der Bank. Geht dabei irgendetwas schief, ist eine bezahlte Saga
 * unspielbar - deshalb wird hier jede Station einzeln geprüft.
 */
import {
  FINALE_ARTEN,
  angeklagterAus,
  mitAnklage,
  mitVerhandlung,
  richterAus,
} from "../lib/sagaFinale.ts";
import { pruefeVorgaben } from "../lib/sagaPruefung.ts";
import { STANDARD_SAGA_VORGABEN, auftrittVon, besessen } from "../lib/sagaTypen.ts";
import { SagaVorgabenSchema } from "../lib/schemas.ts";
import { ohneNamen } from "../lib/namenSchutz.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const tier = (id, name, extra = {}) => ({
  id, nummer: 1, name, tierart: "Tier", alter: 5, stats: {},
  beschreibung: "", bild: "", istDetektiv: false, ...extra,
});

const wimpy = tier("wimpy", "Wimpy", { istDetektiv: true });
const charaktere = [
  wimpy,
  tier("oeho", "Öhö", { alter: 70 }),
  tier("nala", "Nala"),
  tier("hut", "Herr Hut"),
  tier("schatten", "Der Schatten"),
];
const orte = ["venedig", "kopenhagen"].flatMap((stadt) =>
  Array.from({ length: 5 }, (_, i) => ({
    id: `${stadt}-${i}`, stadt, stadtId: stadt, name: `Ort ${i}`,
    atmosphaere: "", beschreibung: "", bild: "",
  })),
);

/** So sieht die Saga aus, die gebaut werden soll: Hut ist besessen. */
const vorgaben = {
  ...STANDARD_SAGA_VORGABEN,
  kapitelAnzahl: 3,
  charaktere: ["wimpy", "oeho", "nala", "hut", "schatten"],
  finaleArt: "gericht-daemon",
  besessenheit: { wirtId: "hut", daemonId: "schatten", ton: "/audio/hutsong.mp3" },
  twist: false,
};

console.log("\n1. Die Vorgaben kommen überhaupt durch");
{
  const g = SagaVorgabenSchema.safeParse(JSON.parse(JSON.stringify(vorgaben)));
  pruefe("das Schema nimmt sie an", g.success, g.error?.issues[0]?.message);
  pruefe("die Finale-Art bleibt", g.data?.finaleArt === "gericht-daemon");
  pruefe("die Besessenheit bleibt", g.data?.besessenheit.daemonId === "schatten");
  pruefe("und der Ton zur Verwandlung", g.data?.besessenheit.ton === "/audio/hutsong.mp3");
  pruefe("die Art steht auch im Admin-Menü zur Wahl",
    FINALE_ARTEN.some((a) => a.id === "gericht-daemon"));
}

console.log("\n2. Die Vorabprüfung lässt sie durch");
pruefe("keine Beanstandung", pruefeVorgaben({ vorgaben, charaktere, orte }).length === 0,
  pruefeVorgaben({ vorgaben, charaktere, orte })[0]);

console.log("\n3. Was ohne Besessenheit oder mit Twist passiert");
{
  const ohne = pruefeVorgaben({
    vorgaben: { ...vorgaben, besessenheit: { wirtId: "", daemonId: "", ton: "" } },
    charaktere, orte,
  });
  pruefe("ohne Besessenheit wird gebremst", ohne.length === 1, ohne[0]);
  const mitTwist = pruefeVorgaben({ vorgaben: { ...vorgaben, twist: true }, charaktere, orte });
  pruefe("Twist und Gericht vertragen sich nicht", mitTwist.some((p) => /Twist/.test(p)));
}

console.log("\n4. Wer angeklagt wird - und wer nicht");
{
  const besetzung = charaktere;
  const angeklagt = angeklagterAus({
    art: "gericht-daemon", besetzung, drahtzieherId: "schatten", wirtId: "hut",
  });
  pruefe("angeklagt wird der Wirt, nicht die Gestalt", angeklagt === "hut");
  pruefe("es wird überhaupt angeklagt", mitAnklage("gericht-daemon"));
  pruefe("und es gibt eine Verhandlung", mitVerhandlung("gericht-daemon"));

  const richter = richterAus(besetzung, angeklagt);
  pruefe("Öhö führt den Vorsitz", richter?.id === "oeho", richter?.name);
  pruefe("der Angeklagte ist nicht der Richter", richter?.id !== angeklagt);
}

console.log("\n5. Die Anklagbaren - hier entscheidet sich, ob es spielbar ist");
{
  // Dieselbe Regel wie in app/api/saga/route.ts (anklagbar).
  const anklagbar = (besetzung, richterId, angeklagterId, daemonId) => {
    const ids = besetzung
      .filter((c) => !c.istDetektiv && c.id !== richterId &&
        (c.id === angeklagterId || c.id !== daemonId))
      .map((c) => c.id);
    return ids.includes(angeklagterId) ? ids : [angeklagterId, ...ids];
  };

  const liste = anklagbar(charaktere, "oeho", "hut", "schatten");
  pruefe("der Wirt steht zur Wahl", liste.includes("hut"));
  pruefe("die Dämonengestalt nicht", !liste.includes("schatten"));
  pruefe("der Richter nicht", !liste.includes("oeho"));
  pruefe("der Detektiv nicht", !liste.includes("wimpy"));
  pruefe("ein unbeteiligtes Tier schon", liste.includes("nala"));

  // Der harte Fall: Selbst wenn der Wirt sonst herausfiele, muss er drin sein.
  const notfall = anklagbar(charaktere, "oeho", "schatten", "schatten");
  pruefe("der Richtige ist immer dabei", notfall.includes("schatten"));
}

console.log("\n6. Die Gestalt bleibt bis zum Finale unsichtbar");
{
  const auftritt = auftrittVon({
    charakterId: "schatten", vorgaben, drahtzieherId: "schatten",
  });
  pruefe("sie tritt erst im Finale auf", auftritt === vorgaben.kapitelAnzahl + 1, `${auftritt}`);
  const wirtAuftritt = auftrittVon({
    charakterId: "hut", vorgaben, drahtzieherId: "schatten",
  });
  pruefe("der Wirt ist von Anfang an dabei", wirtAuftritt === 1);
  pruefe("die Besessenheit wird erkannt", besessen(vorgaben)?.daemonId === "schatten");
}

console.log("\n7. Sie kann kein Kapiteltäter sein");
{
  const probleme = pruefeVorgaben({
    vorgaben: { ...vorgaben, kapitelTaeter: ["schatten", "", ""] },
    charaktere, orte,
  });
  pruefe("das fällt vorher auf", probleme.length === 1, probleme[0]);
}

console.log("\n8. Der Arc setzt den Twist - das Gericht verträgt ihn nicht");
{
  /*
   * So kommt eine letzte Arc-Station aus vorgabenFuerTeil: mit Twist. Wählt
   * man dort ein Gerichtsfinale, schaltet das Formular den Twist ab (siehe
   * finaleArtSetzen). Hier wird beides nachgestellt.
   */
  const ausDemArc = { ...vorgaben, drahtzieherId: "hut", twist: true };
  const mitTwist = pruefeVorgaben({ vorgaben: ausDemArc, charaktere, orte });
  pruefe("mit Twist wird gebremst", mitTwist.length === 1 && /Twist/.test(mitTwist[0]));

  // Und was das Formular daraus macht:
  const abgeschaltet = { ...ausDemArc, twist: false };
  const danach = pruefeVorgaben({ vorgaben: abgeschaltet, charaktere, orte });
  pruefe("ohne Twist ist alles in Ordnung", danach.length === 0, danach[0]);

  // Auch mit dem Wirt als Drahtzieher bleibt der Richtige anklagbar.
  const angeklagt = angeklagterAus({
    art: "gericht-daemon", besetzung: charaktere, drahtzieherId: "hut", wirtId: "hut",
  });
  pruefe("angeklagt wird weiterhin der Wirt", angeklagt === "hut");
}

console.log("\n9. Der Text vor dem Saal verrät den Angeklagten nicht");
{
  /*
   * Vor der Anklage darf nirgends stehen, wen man anzuklagen hat - sonst ist
   * das Finale entwertet, bevor es beginnt. Der Server streicht Sätze mit
   * dem Namen; hier wird genau diese Regel nachgestellt.
   */
  const ohneVerrat = (text, namen) => ohneNamen(text, namen);
  const heikel = ["Herr Hut", "Der Schatten"];

  const verraten = "Der Saal füllt sich. Herr Hut sitzt schon da. Es riecht nach Regen.";
  const sauber = ohneVerrat(verraten, heikel);
  pruefe("der Satz mit dem Namen fällt weg", !sauber.includes("Herr Hut"), sauber);
  pruefe("der Rest bleibt stehen", sauber.includes("Es riecht nach Regen."), sauber);
  pruefe("auch die Gestalt bleibt geheim",
    !ohneVerrat("Der Schatten wartet.", heikel).includes("Schatten"));
  pruefe("ohne Namen bleibt alles",
    ohneVerrat("Der Saal füllt sich.", heikel) === "Der Saal füllt sich.");
}

console.log(fehlgeschlagen === 0 ? "\nAlles gut.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
