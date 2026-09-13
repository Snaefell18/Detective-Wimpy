import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MODEL_GESPRAECH, budget, getAnthropic, schnellOptionen } from "@/lib/anthropic";
import { ergebnisAus, fehlerText, istZeitueberschreitung, sauberText } from "@/lib/antwort";
import type { BeweismittelKern } from "@/lib/beweismittel";
import type { Bogen } from "@/lib/sagaBogen";
import { VersammlungSchema, type VersammlungDraft } from "@/lib/sagaSchemas";
import { CharacterSchema, einzelnGeprueft } from "@/lib/schemas";
import { seal, unseal } from "@/lib/seal";
import type { Character } from "@/lib/types";
import {
  VERSAMMLUNG_BEWEIS_SCHWELLE,
  VERSAMMLUNG_MIN_ENDE,
  VERSAMMLUNG_ZWANGSENDE,
  versammlungsFortschritt,
  type VersammlungBeitrag,
  type VersammlungBeweis,
} from "@/lib/versammlung";
import { buildVersammlungPrompt } from "@/lib/versammlungPrompt";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  bogenSiegel?: string;
  versammlungId?: string;
  charaktere?: unknown[];
  verlauf?: VersammlungBeitrag[];
  nachricht?: string;
  fortschritt?: number;
  runde?: number;
  start?: boolean;
  beenden?: boolean;
  beweisGefunden?: boolean;
};

const zahl = (wert: unknown, ersatz = 0) => {
  const n = Number(wert);
  return Number.isFinite(n) ? Math.round(n) : ersatz;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    let bogen: Bogen;
    try {
      bogen = unseal<Bogen>(String(body.bogenSiegel ?? ""));
    } catch {
      return NextResponse.json(
        { fehler: "Diese Versammlung ist abgelaufen. Bitte die Saga neu laden." },
        { status: 400 },
      );
    }

    const vorgabe = (bogen.vorgaben.versammlungen ?? []).find(
      (v) => v.id === String(body.versammlungId ?? ""),
    );
    if (!vorgabe) {
      return NextResponse.json({ fehler: "Diese Versammlung gehört nicht zur Saga." }, { status: 400 });
    }

    const start = body.start === true;
    const sofortBeenden = body.beenden === true;
    const nachricht = String(body.nachricht ?? "").trim();
    if (!start && !sofortBeenden && !nachricht) {
      return NextResponse.json({ fehler: "Leere Nachricht." }, { status: 400 });
    }

    /*
     * Zusätzliche Tiere können außerhalb der normalen Fallbesetzung liegen.
     * Ihre öffentlichen Profile kommen deshalb aus den Stammdaten des
     * Browsers, werden aber vollständig geprüft. Die versiegelte Vorgabe
     * entscheidet allein, welche Ids tatsächlich in den Rat dürfen.
     */
    const { gut: eigene } = einzelnGeprueft<Character>(CharacterSchema, body.charaktere);
    const zusammen = [...bogen.besetzung, ...eigene].filter(
      (c, i, alle) => alle.findIndex((x) => x.id === c.id) === i,
    );
    const erlaubteIds = new Set([
      ...vorgabe.teilnehmerIds,
      ...vorgabe.beobachterIds,
      vorgabe.vorsitzId,
    ]);
    const tiere = zusammen.filter((c) => erlaubteIds.has(c.id));
    const detektiv = zusammen.find((c) => c.istDetektiv);

    if (!tiere.some((c) => c.id === vorgabe.vorsitzId)) {
      return NextResponse.json(
        { fehler: "Das Tier im Vorsitz ist gerade nicht erreichbar." },
        { status: 400 },
      );
    }

    const fortschritt = Math.max(0, Math.min(100, zahl(body.fortschritt)));
    const runde = Math.max(0, Math.min(50, zahl(body.runde)));
    const response = await getAnthropic().messages.create(
      {
        model: MODEL_GESPRAECH,
        max_tokens: 8000,
        ...schnellOptionen(MODEL_GESPRAECH, zodOutputFormat(VersammlungSchema)),
        messages: [
          {
            role: "user",
            content: buildVersammlungPrompt({
              bogen,
              vorgabe,
              tiere,
              detektiv,
              verlauf: Array.isArray(body.verlauf) ? body.verlauf.slice(-28) : [],
              nachricht: nachricht.slice(0, 600),
              fortschritt,
              runde,
              start,
              sofortBeenden,
            }),
          },
        ],
      },
      budget(28, 1),
    );

    const modell = ergebnisAus<VersammlungDraft>(response, "api/versammlung");
    if ("fehler" in modell) {
      return NextResponse.json({ fehler: modell.fehler }, { status: modell.status });
    }

    const bekannteSprecher = new Set(tiere.map((c) => c.id));
    let beitraege = modell.daten.beitraege
      .filter((b) => bekannteSprecher.has(b.sprecherId))
      .slice(0, 6)
      .map((b) => ({ sprecherId: b.sprecherId, text: sauberText(b.text).slice(0, 900) }))
      .filter((b) => b.text);

    const vorsitz = tiere.find((c) => c.id === vorgabe.vorsitzId)!;
    if (beitraege.length === 0) {
      beitraege = [
        {
          sprecherId: vorsitz.id,
          text: sofortBeenden
            ? "Der Tisch hat genug gehört. Wir schließen, bevor die Stühle anfangen, uns zu befragen."
            : "Der Rat ist eröffnet. Sagt, was ihr wisst — und lasst die Möbel ausreden.",
        },
      ];
    }

    const plus = versammlungsFortschritt(modell.daten.fortschrittPlus, start);
    const danach = Math.min(100, fortschritt + plus);
    const findetBeweis =
      !body.beweisGefunden && danach >= VERSAMMLUNG_BEWEIS_SCHWELLE;
    let beweis: VersammlungBeweis | null = null;
    if (findetBeweis) {
      const kandidat = modell.daten.beweis;
      const itemId = `rat-${bogen.id}-${vorgabe.id}`.slice(0, 120);
      const name = sauberText(kandidat.name).slice(0, 100) || "Der unmögliche Protokollfetzen";
      const beobachtung =
        sauberText(kandidat.beobachtung).slice(0, 900) ||
        "Zwischen den Wortmeldungen taucht ein Detail auf, das vorher niemand bemerkt hat.";
      const herkunft = `${vorgabe.name} · nach Kapitel ${vorgabe.nachKapitel}`;
      const kern: BeweismittelKern = {
        id: itemId,
        name,
        beobachtung,
        bedeutung:
          sauberText(kandidat.bedeutung).slice(0, 1400) ||
          `Dieses Stück verbindet den Widerspruch aus der Versammlung mit ${bogen.drahtzieherName} und dem Plan hinter der Saga.`,
        zeigtAufCharakterId: bogen.drahtzieherId,
        fuehrtInDieIrre: false,
        fernwirkung: true,
        herkunft,
      };
      beweis = {
        itemId,
        name,
        bild: null,
        beobachtung,
        vermutung: sauberText(kandidat.vermutung).slice(0, 400) || null,
        herkunft,
        siegel: seal(kern),
      };
    }

    const automatisch =
      runde >= VERSAMMLUNG_ZWANGSENDE ||
      (runde >= VERSAMMLUNG_MIN_ENDE && modell.daten.beenden && (body.beweisGefunden || Boolean(beweis)));
    const beendet = sofortBeenden || automatisch;

    // Ein automatischer Schluss gehört dem Vorsitz. Falls das Modell zuletzt
    // jemand anderen sprechen ließ, bekommt der Vorsitz das letzte Wort.
    if (beendet && beitraege.at(-1)?.sprecherId !== vorsitz.id) {
      beitraege.push({
        sprecherId: vorsitz.id,
        text: "Genug. Der Rat schließt — nehmt eure Fragen mit, bevor sie hier Wurzeln schlagen.",
      });
    }

    return NextResponse.json({
      beitraege,
      fortschrittPlus: plus,
      beweis,
      beendet,
    });
  } catch (error) {
    return NextResponse.json(
      { fehler: fehlerText(error, "api/versammlung") },
      { status: istZeitueberschreitung(error) ? 504 : 500 },
    );
  }
}
