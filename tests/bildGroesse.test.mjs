/**
 * Die Größengrenze für gespeicherte Bilder.
 *
 * Der Anlass: Gekürzt wurde auf 700 kB Bilddaten, geprüft wird in den
 * Firestore-Regeln aber die base64-Zeichenkette - und die ist ein Drittel
 * länger. Das Ergebnis war "Missing or insufficient permissions", also eine
 * Meldung über Rechte, obwohl es um die Länge ging.
 */
import { MAX_BILD_ZEICHEN, bytesVon } from "../lib/bildUpload.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

/** Was in firestore.rules steht - hier von Hand nachgezogen. */
const REGEL_GRENZE = 900_000;

console.log("\n1. Die Grenze passt zur Regel");
pruefe("kürzer als die Regel erlaubt", MAX_BILD_ZEICHEN < REGEL_GRENZE);
pruefe(
  "mit Luft für die übrigen Felder",
  REGEL_GRENZE - MAX_BILD_ZEICHEN >= 50_000,
  `${REGEL_GRENZE - MAX_BILD_ZEICHEN} Zeichen Luft`,
);
pruefe(
  "und das ganze Dokument bleibt unter 1 MiB",
  MAX_BILD_ZEICHEN + 2_000 < 1_048_576,
);

console.log("\n2. Zeichen sind nicht Bytes");
{
  // So sah der Fehler aus: 700 kB Bilddaten werden zu über 900.000 Zeichen.
  const zeichenFuer = (bytes) => Math.ceil((bytes * 4) / 3);
  pruefe(
    "700 kB hätten die Regel gerissen",
    zeichenFuer(700_000) > REGEL_GRENZE,
    `${zeichenFuer(700_000)} Zeichen`,
  );
  pruefe(
    "die neue Grenze hält",
    zeichenFuer(bytesVon("data:image/png;base64," + "A".repeat(MAX_BILD_ZEICHEN))) <=
      REGEL_GRENZE,
  );
  pruefe(
    "bytesVon rechnet die Nutzlast, nicht den Kopf",
    bytesVon("data:image/png;base64,AAAA") === 3,
  );
  pruefe("und kommt mit Unsinn klar", bytesVon("") === 0);
}

console.log(fehlgeschlagen === 0 ? "\nAlles gut.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
