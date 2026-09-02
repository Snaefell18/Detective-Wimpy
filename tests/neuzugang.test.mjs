/**
 * "Ein neuer Spieler betritt das Feld!" - angekündigt wird nur, wer im Fall
 * dieses Kapitels steht und im vorherigen nicht.
 */
import { neueGesichter } from "../lib/sagaTypen.ts";

const c = (id, istDetektiv = false) => ({ id, name: id, istDetektiv });
const wimpy = c("wimpy", true);
const fall = (...ids) => ({ besetzung: [wimpy, ...ids.map((id) => c(id))] });

const saga = (kapitelBesetzungen, finaleBesetzung) => ({
  kapitel: kapitelBesetzungen.map((f, i) => ({ nummer: i + 1, fall: f })),
  finale: { fall: finaleBesetzung },
});

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};
const ids = (liste) => liste.map((x) => x.id).join(",");

console.log("\n1. Der normale Fall");
{
  const s = saga(
    [fall("nala", "mikkeli"), fall("nala", "mikkeli", "fanny"), fall("nala", "mikkeli", "fanny")],
    fall("nala", "mikkeli", "fanny", "boss"),
  );
  pruefe("im ersten Kapitel ist niemand neu", neueGesichter(s, 0).length === 0);
  pruefe("im zweiten kommt Fanny dazu", ids(neueGesichter(s, 1)) === "fanny");
  pruefe("im dritten niemand mehr", neueGesichter(s, 2).length === 0);
  pruefe("im Finale betritt der Drahtzieher die Bühne", ids(neueGesichter(s, -1)) === "boss");
}

console.log("\n2. Mehrere auf einmal");
{
  const s = saga([fall("nala", "mikkeli"), fall("nala", "mikkeli", "fanny", "chat")], null);
  pruefe("beide werden angekündigt", ids(neueGesichter(s, 1)) === "fanny,chat");
}

console.log("\n3. Der Detektiv zählt nie");
{
  const s = saga([fall("nala", "mikkeli"), fall("nala", "mikkeli")], null);
  pruefe("Wimpy ist kein Neuzugang", neueGesichter(s, 1).length === 0);
}

console.log("\n4. Wer wegfällt, ist kein Neuzugang");
{
  const s = saga([fall("nala", "mikkeli", "fanny"), fall("nala", "mikkeli")], null);
  pruefe("niemand wird angekündigt", neueGesichter(s, 1).length === 0);
}

console.log("\n5. Fehlende Fälle: lieber nichts sagen");
{
  const ohne = saga([fall("nala"), { besetzung: [] }], null);
  pruefe("leerer Fall: keine Ansage", neueGesichter(ohne, 1).length === 0);
  const ohneVorher = saga([null, fall("nala", "fanny")], null);
  pruefe("kein vorheriger Fall: keine Ansage", neueGesichter(ohneVorher, 1).length === 0);
  const ohneFinale = saga([fall("nala")], null);
  pruefe("kein Finalfall: keine Ansage", neueGesichter(ohneFinale, -1).length === 0);
  pruefe("Kapitel außerhalb: keine Ansage", neueGesichter(ohneFinale, 9).length === 0);
}

console.log(
  fehlgeschlagen === 0 ? "\nAlles sauber." : `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.`,
);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
