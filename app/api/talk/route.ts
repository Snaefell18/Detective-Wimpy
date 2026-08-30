import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ergebnisAus, fehlerText } from "@/lib/antwort";
import { passendeId, stimmungAus } from "@/lib/zuordnen";
import { MODEL_GESPRAECH, getAnthropic } from "@/lib/anthropic";
import { buildTalkPrompt, buildWorldPrompt } from "@/lib/prompts";
import { TalkSchema } from "@/lib/schemas";
import type * as z from "zod/v4";
import { unseal } from "@/lib/seal";
import type { CaseFile, ChatTurn, TalkMode, TalkResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  siegel: string;
  charakterId: string;
  ortId: string;
  modus: TalkMode;
  nachricht: string;
  verlauf: ChatTurn[];
  gefundeneSpuren: string[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;

    let fall: CaseFile;
    try {
      fall = unseal<CaseFile>(body.siegel);
    } catch {
      return NextResponse.json(
        { fehler: "Der Fall ist abgelaufen. Bitte starte einen neuen Fall." },
        { status: 400 },
      );
    }

    if (!fall.besetzung.some((c) => c.id === body.charakterId)) {
      return NextResponse.json({ fehler: "Unbekannter Charakter." }, { status: 400 });
    }
    if (!body.nachricht?.trim()) {
      return NextResponse.json({ fehler: "Leere Nachricht." }, { status: 400 });
    }

    const response = await getAnthropic().messages.create({
      model: MODEL_GESPRAECH,
      // Großzügig, weil adaptives Denken mitzählt - sonst bricht die Antwort
      // mitten im JSON ab.
      max_tokens: 12000,
      system: [
        {
          type: "text",
          text: buildWorldPrompt(
            fall.besetzung,
            fall.orte,
            fall.stadt,
            fall.ton,
            fall.items,
            fall.reifegrad,
            fall.absurditaet,
          ),
          cache_control: { type: "ephemeral" },
        },
      ],
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: zodOutputFormat(TalkSchema) },
      messages: [
        {
          role: "user",
          content: buildTalkPrompt({
            fall,
            charakterId: body.charakterId,
            ortId: body.ortId,
            modus: body.modus,
            nachricht: body.nachricht.slice(0, 500),
            verlauf: body.verlauf ?? [],
            gefundeneSpuren: body.gefundeneSpuren ?? [],
          }),
        },
      ],
    });

    const modellAntwort = ergebnisAus<z.infer<typeof TalkSchema>>(response, "api/talk");
    if ("fehler" in modellAntwort) {
      return NextResponse.json(
        { fehler: modellAntwort.fehler },
        { status: modellAntwort.status },
      );
    }

    const parsed = modellAntwort.daten;

    // Nur Spuren gelten, die es an diesem Ort wirklich zu finden gibt.
    const spurenHier = fall.spuren
      .filter((s) => s.ortId === body.ortId)
      .map((s) => s.itemId);

    const ergebnis: TalkResult = {
      antwort: parsed.antwort,
      stimmung: stimmungAus(parsed.stimmung),
      neueNotiz: parsed.neueNotiz,
      gefundeneSpurItemId: passendeId(parsed.gefundeneSpurItemId, spurenHier),
      // Grenzen erzwingen, damit ein Ausrutscher des Modells die Anzeige nicht sprengt.
      verdachtsaenderung: Math.max(-20, Math.min(20, Math.round(parsed.verdachtsaenderung))),
      luegt: parsed.luegt,
    };

    return NextResponse.json(ergebnis);
  } catch (error) {
    return NextResponse.json({ fehler: fehlerText(error, "api/talk") }, { status: 500 });
  }
}
