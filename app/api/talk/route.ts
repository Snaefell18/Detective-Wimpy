import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MODEL_GESPRAECH, getAnthropic } from "@/lib/anthropic";
import { buildTalkPrompt, buildWorldPrompt } from "@/lib/prompts";
import { TalkSchema } from "@/lib/schemas";
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

    const response = await getAnthropic().messages.parse({
      model: MODEL_GESPRAECH,
      max_tokens: 4000,
      system: [
        {
          type: "text",
          text: buildWorldPrompt(fall.besetzung, fall.orte, fall.stadt, fall.ton),
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

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json(
        { fehler: "Darauf möchte dieser Charakter gerade nicht antworten." },
        { status: 502 },
      );
    }

    const parsed = response.parsed_output;
    const ergebnis: TalkResult = {
      antwort: parsed.antwort,
      stimmung: parsed.stimmung,
      neueNotiz: parsed.neueNotiz,
      gefundeneSpurItemId: parsed.gefundeneSpurItemId,
      // Grenzen erzwingen, damit ein Ausrutscher des Modells die Anzeige nicht sprengt.
      verdachtsaenderung: Math.max(-20, Math.min(20, Math.round(parsed.verdachtsaenderung))),
      luegt: parsed.luegt,
    };

    return NextResponse.json(ergebnis);
  } catch (error) {
    console.error("[api/talk]", error);
    return NextResponse.json(
      { fehler: error instanceof Error ? error.message : "Unbekannter Fehler" },
      { status: 500 },
    );
  }
}
