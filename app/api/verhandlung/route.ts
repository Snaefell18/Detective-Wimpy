import { NextResponse } from "next/server";
import { fehlerText } from "@/lib/antwort";
import type { Bogen } from "@/lib/sagaBogen";
import { haftTage } from "@/lib/schrankhaft";
import { unseal } from "@/lib/seal";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Der Gerichtssaal einer Saga.
 *
 * Hier wird nichts erfunden - alle Texte stehen schon im versiegelten Bogen,
 * seit die Saga entstanden ist. Diese Route ist nur das Schloss davor: Sie
 * öffnet das Siegel, das nur der Server lesen kann, und gibt genau das eine
 * Stück heraus, das Wimpy gerade vorgelegt hat.
 *
 * Deshalb geht sie auch ohne Modellaufruf - der Saal antwortet sofort, und
 * wer die Datenbank durchsieht, findet dort keine Lösung.
 *
 *   "vorlegen" - ein Beweisstück auf den Tisch: trägt es, und was sagt der Saal?
 *   "urteil"   - Öhos Schlusswort, je nachdem, ob die Beweisführung stand.
 */
type Body = {
  bogenSiegel?: string;
  schritt?: "vorlegen" | "urteil";
  beweisId?: string;
  geschafft?: boolean;
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

    const wahrheit = bogen.finale?.wahrheit;
    if (!wahrheit?.beweise?.length) {
      return NextResponse.json(
        { fehler: "Zu dieser Saga gehört keine Verhandlung." },
        { status: 400 },
      );
    }

    if (body.schritt === "urteil") {
      return NextResponse.json({
        text: body.geschafft ? wahrheit.urteilSchuldig : wahrheit.urteilFrei,
        // Wie viele Tage im Schrank - 0 heißt: niemand muss hinein.
        tage: haftTage(
          body.geschafft ? wahrheit.tageSchuldig : wahrheit.tageFrei,
          0,
        ),
      });
    }

    const stueck = wahrheit.beweise.find((b) => b.id === body.beweisId);
    if (!stueck) {
      return NextResponse.json({ fehler: "Unbekanntes Beweisstück." }, { status: 400 });
    }

    return NextResponse.json({ traegt: stueck.traegt === true, reaktion: stueck.reaktion });
  } catch (error) {
    return NextResponse.json(
      { fehler: fehlerText(error, "api/verhandlung") },
      { status: 500 },
    );
  }
}
