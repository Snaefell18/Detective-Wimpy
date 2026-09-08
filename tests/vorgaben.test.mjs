/**
 * Die Vorgaben einer Saga auf dem Weg zum Server.
 *
 * Der Anlass: Wer im Formular nur für Kapitel 3 etwas einträgt, hinterlässt
 * davor Löcher. Über JSON werden daraus null-Einträge - und daran scheiterte
 * die Prüfung der GANZEN Vorgaben. Der Server fiel dann still auf seine
 * Standardwerte zurück (drei Kapitel), während der Browser fünf erwartete;
 * beim vierten brach das Erzeugen ab.
 */
import { SagaVorgabenSchema } from "../lib/schemas.ts";
import { STANDARD_SAGA_VORGABEN } from "../lib/sagaTypen.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

/** So kommen die Vorgaben wirklich an: einmal durch JSON. */
const uebertragen = (vorgaben) => JSON.parse(JSON.stringify(vorgaben));

console.log("\n1. Die Standardvorgaben gehen durch");
{
  const geprueft = SagaVorgabenSchema.safeParse(uebertragen(STANDARD_SAGA_VORGABEN));
  pruefe("angenommen", geprueft.success, geprueft.error?.issues[0]?.message);
}

console.log("\n2. Löcher in den Listen je Kapitel");
{
  const mitLoch = { ...STANDARD_SAGA_VORGABEN, kapitelAnzahl: 5 };
  mitLoch.kapitelVideos = [];
  mitLoch.kapitelVideos[2] = "/video/drei.mp4";
  mitLoch.kapitelWetter = [];
  mitLoch.kapitelWetter[3] = "gewitter";
  mitLoch.kapitelStaedte = [];
  mitLoch.kapitelStaedte[1] = "venedig";
  mitLoch.kapitelWuensche = [];
  mitLoch.kapitelWuensche[4] = "Auf dem Dach";

  const geprueft = SagaVorgabenSchema.safeParse(uebertragen(mitLoch));
  pruefe("werden angenommen", geprueft.success, geprueft.error?.issues[0]?.message);
  if (geprueft.success) {
    const d = geprueft.data;
    pruefe("die Kapitelanzahl bleibt", d.kapitelAnzahl === 5);
    pruefe("das Video steht an seiner Stelle", d.kapitelVideos[2] === "/video/drei.mp4");
    pruefe("die Löcher davor sind leer", d.kapitelVideos[0] === "" && d.kapitelVideos[1] === "");
    pruefe("das Wetter bleibt erhalten", d.kapitelWetter[3] === "gewitter");
    pruefe("die Stadt auch", d.kapitelStaedte[1] === "venedig");
    pruefe("und der Wunsch", d.kapitelWuensche[4] === "Auf dem Dach");
  }
}

console.log("\n3. Echter Unsinn wird weiterhin abgelehnt");
{
  const kaputt = uebertragen({ ...STANDARD_SAGA_VORGABEN, kapitelAnzahl: 99 });
  pruefe("zu viele Kapitel", SagaVorgabenSchema.safeParse(kaputt).success === false);
  const falscheLage = uebertragen({
    ...STANDARD_SAGA_VORGABEN,
    kapitelWetter: ["sonnenfinsternis"],
  });
  pruefe("unbekanntes Wetter", SagaVorgabenSchema.safeParse(falscheLage).success === false);
}

console.log(fehlgeschlagen === 0 ? "\nAlles gut.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
