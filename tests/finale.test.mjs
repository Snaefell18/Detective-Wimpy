/**
 * Die alternativen Finales: Wer sitzt auf der Anklagebank, wer führt den
 * Vorsitz, wann ist eine Verhandlung gewonnen - und vor allem: Das klassische
 * Finale bleibt davon unberührt.
 */
import {
  FINALE_ARTEN,
  LEERER_VERHANDLUNGS_STAND,
  angeklagterAus,
  mitVerhandlung,
  noetigeBeweise,
  richterAus,
  saalTexte,
  verhandlungsErgebnis,
} from "../lib/sagaFinale.ts";
import { STANDARD_SAGA_VORGABEN, neuImSaal, sagaBesetzung } from "../lib/sagaTypen.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const c = (id, extra = {}) => ({
  id,
  name: id,
  istDetektiv: false,
  alter: 5,
  bild: "",
  ...extra,
});
const wimpy = c("wimpy", { istDetektiv: true });
const oeho = c("oeho", { name: "Öho", alter: 70 });
const besetzung = [wimpy, oeho, c("nala"), c("mikkeli", { alter: 90 })];

console.log("\n1. Klassisch bleibt klassisch");
pruefe("Standardvorgaben laufen in den Finalfall", STANDARD_SAGA_VORGABEN.finaleArt === "klassisch");
pruefe("und brauchen keine Verhandlung", mitVerhandlung("klassisch") === false);
pruefe("alte Sagas ohne Feld ebenso", mitVerhandlung(undefined) === false);
pruefe("es gibt vier Arten", FINALE_ARTEN.length === 4);
for (const art of ["gericht", "ohne-taeter", "wimpy"]) {
  pruefe(`„${art}“ führt in den Saal`, mitVerhandlung(art) === true);
}

console.log("\n2. Wer wo sitzt");
pruefe(
  "beim Gerichtsfinale der Drahtzieher",
  angeklagterAus({ art: "gericht", besetzung, drahtzieherId: "nala" }) === "nala",
);
pruefe(
  "bei „kein Täter“ der zu Unrecht Verdächtigte",
  angeklagterAus({ art: "ohne-taeter", besetzung, drahtzieherId: "nala" }) === "nala",
);
pruefe(
  "bei „Wimpy selbst“ der Detektiv",
  angeklagterAus({ art: "wimpy", besetzung, drahtzieherId: "nala" }) === "wimpy",
);
pruefe("Öho führt den Vorsitz", richterAus(besetzung, "nala")?.id === "oeho");
pruefe(
  "sitzt Öho selbst auf der Bank, übernimmt das älteste Tier",
  richterAus(besetzung, "oeho")?.id === "mikkeli",
);
pruefe("der Detektiv richtet nie", richterAus([wimpy, c("nala")], "nala") === null);

console.log("\n3. Der Ausgang der Verhandlung");
{
  const v = { noetig: 3, fehlgriffe: 2 };
  pruefe("frisch läuft sie", verhandlungsErgebnis(LEERER_VERHANDLUNGS_STAND, v) === "laeuft");
  pruefe(
    "zwei Treffer reichen nicht",
    verhandlungsErgebnis({ gelegt: [], getroffen: 2, daneben: 0 }, v) === "laeuft",
  );
  pruefe(
    "drei Treffer gewinnen",
    verhandlungsErgebnis({ gelegt: [], getroffen: 3, daneben: 2 }, v) === "gewonnen",
  );
  pruefe(
    "zwei Fehlgriffe sind noch erlaubt",
    verhandlungsErgebnis({ gelegt: [], getroffen: 1, daneben: 2 }, v) === "laeuft",
  );
  pruefe(
    "der dritte platzt",
    verhandlungsErgebnis({ gelegt: [], getroffen: 1, daneben: 3 }, v) === "verloren",
  );
  pruefe("nötig sind höchstens drei", noetigeBeweise(4) === 3);
  pruefe("aber nie mehr, als tragen", noetigeBeweise(2) === 2);
  pruefe("und nie null", noetigeBeweise(0) === 1);
}

console.log("\n4. Wer im Saal angekündigt wird");
{
  const fall = (...ids) => ({ besetzung: ids.map((id) => c(id)) });
  const saga = {
    kapitel: [{ fall: fall("wimpy", "nala") }, { fall: fall("wimpy", "nala") }],
    finale: {
      fall: null,
      verhandlung: {
        art: "gericht",
        angeklagterId: "boss",
        richterId: "oeho",
        beweise: [{ id: "b1" }],
        personen: [c("boss"), oeho],
      },
    },
  };
  pruefe("der Saal kennt auch Tiere ohne Kapitel", sagaBesetzung(saga).some((x) => x.id === "boss"));
  pruefe("wer nie da war, wird angekündigt", neuImSaal(saga, "boss").length === 1);
  pruefe("wer schon da war, nicht", neuImSaal(saga, "nala").length === 0);
  pruefe("der Detektiv nie", neuImSaal(saga, "wimpy").length === 0);
}

console.log("\n5. Die Worte des Saals");
pruefe("„kein Täter“ endet mit Freispruch", saalTexte("ohne-taeter").gewonnen === "Freispruch");
pruefe("sonst mit Schuldspruch", saalTexte("gericht").gewonnen === "Schuldig");
pruefe("gegen sich selbst legt man anders vor", saalTexte("wimpy").vorlegen !== saalTexte("gericht").vorlegen);

console.log(fehlgeschlagen === 0 ? "\nAlles gut.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
