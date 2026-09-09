/**
 * Die Vorgaben einer Saga auf dem Weg zum Server.
 *
 * Der Anlass: Wer im Formular nur für Kapitel 3 etwas einträgt, hinterlässt
 * davor Löcher. Über JSON werden daraus null-Einträge - und daran scheiterte
 * die Prüfung der GANZEN Vorgaben. Der Server fiel dann still auf seine
 * Standardwerte zurück (drei Kapitel), während der Browser fünf erwartete;
 * beim vierten brach das Erzeugen ab.
 */
import { EinstellungenSchema, SagaVorgabenSchema } from "../lib/schemas.ts";
import { AUFTRITTS_ARTEN, STANDARD_SAGA_VORGABEN } from "../lib/sagaTypen.ts";
import { FINALE_ARTEN } from "../lib/sagaFinale.ts";
import { WETTERLAGEN, STANDARD_EINSTELLUNGEN } from "../lib/types.ts";

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

console.log("\n4. Jede Auswahl aus dem Admin-Menü kommt durch");
{
  /*
   * Der teuerste Fehler, den dieses Projekt kannte: Im Formular stand eine
   * Finale-Art zur Wahl, die das Schema nicht kannte. Die Prüfung schlug fehl,
   * das Erzeugen brach ab - und jeder Versuch kostete Credits. Deshalb wird
   * hier jede einzelne angebotene Möglichkeit durchgereicht.
   */
  for (const art of FINALE_ARTEN) {
    const g = SagaVorgabenSchema.safeParse(
      uebertragen({ ...STANDARD_SAGA_VORGABEN, finaleArt: art.id }),
    );
    pruefe(`Finale „${art.label}“`, g.success && g.data.finaleArt === art.id,
      g.error?.issues[0]?.message);
  }

  for (const art of AUFTRITTS_ARTEN) {
    const g = SagaVorgabenSchema.safeParse(
      uebertragen({ ...STANDARD_SAGA_VORGABEN, neuzugangArten: { irgendwer: art.id } }),
    );
    pruefe(`Auftritt „${art.label}“`, g.success && g.data.neuzugangArten.irgendwer === art.id,
      g.error?.issues[0]?.message);
  }

  for (const lage of [...WETTERLAGEN.map((w) => w.id), "aus", "zufall", ""]) {
    const g = SagaVorgabenSchema.safeParse(
      uebertragen({ ...STANDARD_SAGA_VORGABEN, kapitelWetter: [lage] }),
    );
    pruefe(`Wetter „${lage || "wie im Admin-Menü"}“`, g.success && g.data.kapitelWetter[0] === lage,
      g.error?.issues[0]?.message);
  }

  for (const lage of [...WETTERLAGEN.map((w) => w.id), "aus", "zufall"]) {
    const g = EinstellungenSchema.safeParse({ ...STANDARD_EINSTELLUNGEN, wetter: lage });
    pruefe(`Einstellung Wetter „${lage}“`, g.success && g.data.wetter === lage,
      g.error?.issues[0]?.message);
  }
}

console.log("\n5. Die Einstellungen verlieren nichts");
{
  const g = EinstellungenSchema.safeParse({
    ...STANDARD_EINSTELLUNGEN,
    neuzugangTon: "/audio/hutsong.mp3",
    wetter: "schneesturm",
  });
  pruefe("angenommen", g.success, g.error?.issues[0]?.message);
  pruefe("der Auftrittston bleibt", g.data?.neuzugangTon === "/audio/hutsong.mp3");
  pruefe("das Wetter bleibt", g.data?.wetter === "schneesturm");
  pruefe(
    "kein Feld fehlt",
    g.success &&
      Object.keys(STANDARD_EINSTELLUNGEN).every((feld) => feld in g.data),
    Object.keys(STANDARD_EINSTELLUNGEN)
      .filter((f) => g.success && !(f in g.data))
      .join(", "),
  );
}

console.log(fehlgeschlagen === 0 ? "\nAlles gut.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
