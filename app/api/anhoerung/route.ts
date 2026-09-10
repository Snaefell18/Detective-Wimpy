import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MODEL_GESPRAECH, budget, getAnthropic, schnellOptionen } from "@/lib/anthropic";
import { ergebnisAus, fehlerText, istZeitueberschreitung, sauberText } from "@/lib/antwort";
import { geklammert, type AnhoerungZug } from "@/lib/anhoerung";
import { buildAnhoerungPrompt, type SaalMittel } from "@/lib/anhoerungPrompt";
import type { BeweismittelKern } from "@/lib/beweismittel";
import { TASCHE_MAX } from "@/lib/beweismittel";
import type { Bogen } from "@/lib/sagaBogen";
import { richterAus, type FinaleArt } from "@/lib/sagaFinale";
import { AnhoerungSchema } from "@/lib/sagaSchemas";
import { unseal } from "@/lib/seal";
import type * as z from "zod/v4";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Ein Zug in der Anhörung - der Gerichtssaal als Gespräch zu dritt.
 *
 * Der Spieler sagt etwas und legt vielleicht ein Beweismittel dazu; zurück
 * kommen zwei Stimmen (der Angeklagte und Öhö) und drei Zahlen, die den Saal
 * bewegen. Die Zahlen des Modells werden hier eingeklammert, bevor sie
 * hinausgehen: Ein Ausrutscher darf keine Verhandlung in einem Zug
 * entscheiden.
 *
 * Was ein Beweismittel wirklich beweist, steht in seinem Siegel. Es wird nur
 * hier geöffnet - der Browser trägt es blind mit sich herum.
 */
type Body = {
  bogenSiegel?: string;
  /** Die Siegel aller Stücke in der Beweismitteltasche. */
  mittelSiegel?: string[];
  /** Was schon auf dem Tisch liegt. */
  vorgelegt?: string[];
  /** Das Stück, das Wimpy in diesem Zug vorlegt. */
  legtVor?: string;
  nachricht?: string;
  verlauf?: AnhoerungZug[];
  ueberzeugung?: number;
  geduld?: number;
  /** Wer gerade auf der Bank sitzt - nach einer Verwandlung ist das die Gestalt. */
  bankId?: string;
  richterId?: string;
};

const zahl = (wert: unknown, ersatz: number) => {
  const n = Number(wert);
  return Number.isFinite(n) ? n : ersatz;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;

    let bogen: Bogen;
    try {
      bogen = unseal<Bogen>(String(body.bogenSiegel ?? ""));
    } catch {
      return NextResponse.json(
        { fehler: "Diese Saga ist abgelaufen. Bitte neu laden." },
        { status: 400 },
      );
    }

    const nachricht = String(body.nachricht ?? "").trim();
    if (!nachricht) {
      return NextResponse.json({ fehler: "Leere Nachricht." }, { status: 400 });
    }

    /*
     * Die Beweismittel. Ein kaputtes oder fremdes Siegel wird still
     * übersprungen - der Saal soll nicht platzen, weil ein Stück aus einem
     * älteren Fall nicht mehr zu öffnen ist.
     */
    const vorgelegt = new Set((body.vorgelegt ?? []).map(String));
    const mittel: SaalMittel[] = [];
    for (const siegel of (body.mittelSiegel ?? []).slice(0, TASCHE_MAX)) {
      try {
        const kern = unseal<BeweismittelKern>(String(siegel));
        if (!kern?.id) continue;
        mittel.push({
          kern,
          gelegt: vorgelegt.has(kern.id),
          jetzt: Boolean(body.legtVor) && kern.id === body.legtVor,
        });
      } catch {
        // Nicht lesbar - dann kennt der Saal dieses Stück eben nicht.
      }
    }

    // Legt Wimpy etwas vor, das der Server nicht kennt, ist es auch kein Beweis.
    const legtVor = mittel.find((m) => m.jetzt);
    const artRoh = bogen.vorgaben?.finaleArt;
    const art: FinaleArt = artRoh ?? "gericht";

    const finde = (id: string | undefined) =>
      id ? bogen.besetzung.find((c) => c.id === id) : undefined;
    const angeklagter =
      finde(body.bankId) ?? finde(bogen.finale?.wahrheit?.angeklagterId) ?? undefined;
    const richter =
      finde(body.richterId) ??
      richterAus(bogen.besetzung, angeklagter?.id ?? "") ??
      undefined;
    const detektiv = bogen.besetzung.find((c) => c.istDetektiv);

    /*
     * Sitzt da noch das Tier - oder schon die Gestalt?
     *
     * Nach der Verwandlung wechselt der Angeklagte, und mit ihm die Stimme:
     * Was aus einem Wirt gebrochen ist, redet nicht wie der Nachbar von
     * gegenüber. Verglichen wird mit dem Siegel, nicht mit dem, was der
     * Browser behauptet.
     */
    const besessenheit =
      bogen.finale?.wahrheit?.verwandlung ??
      (bogen.vorgaben?.besessenheit?.daemonId
        ? {
            wirtId: bogen.vorgaben.besessenheit.wirtId,
            daemonId: bogen.vorgaben.besessenheit.daemonId,
          }
        : undefined);
    const alsGestalt =
      besessenheit?.daemonId && angeklagter?.id === besessenheit.daemonId
        ? {
            wirtName:
              bogen.besetzung.find((c) => c.id === besessenheit.wirtId)?.name ?? "",
          }
        : null;

    const response = await getAnthropic().messages.create(
      {
        model: MODEL_GESPRAECH,
        max_tokens: 8000,
        ...schnellOptionen(MODEL_GESPRAECH, zodOutputFormat(AnhoerungSchema)),
        messages: [
          {
            role: "user",
            content: buildAnhoerungPrompt({
              bogen,
              art,
              angeklagter,
              richter: richter ?? undefined,
              detektiv,
              alsGestalt,
              mittel,
              verlauf: (body.verlauf ?? []).slice(-12),
              nachricht: nachricht.slice(0, 500),
              ueberzeugung: Math.max(0, Math.round(zahl(body.ueberzeugung, 0))),
              geduld: Math.max(0, Math.round(zahl(body.geduld, 0))),
            }),
          },
        ],
      },
      budget(24, 1),
    );

    const modellAntwort = ergebnisAus<z.infer<typeof AnhoerungSchema>>(
      response,
      "api/anhoerung",
    );
    if ("fehler" in modellAntwort) {
      return NextResponse.json(
        { fehler: modellAntwort.fehler },
        { status: modellAntwort.status },
      );
    }

    const roh = modellAntwort.daten;
    const antwort = geklammert(
      {
        angeklagter: sauberText(roh.angeklagter),
        richter: sauberText(roh.richter),
        ueberzeugungPlus: roh.ueberzeugungPlus,
        geduldMinus: roh.geduldMinus,
        gestaendnis: roh.gestaendnis,
      },
      Boolean(legtVor),
    );

    return NextResponse.json(antwort);
  } catch (error) {
    return NextResponse.json(
      { fehler: fehlerText(error, "api/anhoerung") },
      { status: istZeitueberschreitung(error) ? 504 : 500 },
    );
  }
}
