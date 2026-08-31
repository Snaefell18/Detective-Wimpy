import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ergebnisAus, fehlerText, istZeitueberschreitung, sauberText } from "@/lib/antwort";
import { passendeId, stimmungAus } from "@/lib/zuordnen";
import { MODEL_GESPRAECH, budget, getAnthropic, schnellOptionen } from "@/lib/anthropic";
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
      // Reicht für Antwort und Notiz - bei denkenden Modellen zählt das
      // Nachdenken mit, deshalb nicht zu knapp.
      max_tokens: 8000,
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
      ...schnellOptionen(MODEL_GESPRAECH, zodOutputFormat(TalkSchema)),
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
    }, budget(24, 1));

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
      // Formatreste wie "json" oder Tags gehören nicht in den Mund eines Tieres.
      antwort: sauberText(parsed.antwort),
      stimmung: stimmungAus(parsed.stimmung),
      neueNotiz: sauberText(parsed.neueNotiz) || null,
      gefundeneSpurItemId: passendeId(parsed.gefundeneSpurItemId, spurenHier),
      // Grenzen erzwingen, damit ein Ausrutscher des Modells die Anzeige nicht sprengt.
      verdachtsaenderung: Math.max(-20, Math.min(20, Math.round(parsed.verdachtsaenderung))),
      luegt: parsed.luegt,
    };

    return NextResponse.json(ergebnis);
  } catch (error) {
    const text = fehlerText(error, "api/talk");
    // Lehnt ein Modell die Parameter ab, ist das mit einer Zeile behoben -
    // also auch so sagen statt die Rohmeldung durchzureichen.
    if (/output_config|thinking|effort|structured/i.test(text)) {
      return NextResponse.json(
        {
          fehler: `Das Gesprächsmodell „${MODEL_GESPRAECH}“ kommt mit den Einstellungen nicht zurecht (${text.slice(0, 160)}). Bitte ANTHROPIC_MODEL_TALK auf claude-sonnet-5 stellen.`,
        },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { fehler: text },
      { status: istZeitueberschreitung(error) ? 504 : 500 },
    );
  }
}
