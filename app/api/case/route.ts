import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MODEL, getAnthropic } from "@/lib/anthropic";
import { SUSPECTS } from "@/lib/characters";
import { WORLD_PROMPT, buildCasePrompt } from "@/lib/prompts";
import { CaseDraftSchema } from "@/lib/schemas";
import { seal } from "@/lib/seal";
import type { CaseFile, PublicCase } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Erzeugt einen neuen Fall. Der Täter wird hier - und nur hier - zufällig
 * gezogen; Claude baut die Geschichte anschließend um ihn herum.
 */
export async function POST() {
  try {
    const taeter = SUSPECTS[Math.floor(Math.random() * SUSPECTS.length)];

    const response = await getAnthropic().messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: [{ type: "text", text: WORLD_PROMPT, cache_control: { type: "ephemeral" } }],
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: zodOutputFormat(CaseDraftSchema),
      },
      messages: [{ role: "user", content: buildCasePrompt(taeter.id) }],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json(
        { fehler: "Der Fall konnte nicht erzeugt werden. Bitte noch einmal versuchen." },
        { status: 502 },
      );
    }

    const draft = response.parsed_output;

    const fall: CaseFile = {
      id: crypto.randomUUID(),
      titel: draft.titel,
      tatbeschreibung: draft.tatbeschreibung,
      tatort: draft.tatort,
      taeterId: taeter.id,
      motiv: draft.motiv,
      tathergang: draft.tathergang,
      verdaechtige: draft.verdaechtige,
      spuren: draft.spuren,
      erstelltAm: Date.now(),
    };

    const oeffentlich: PublicCase = {
      id: fall.id,
      titel: fall.titel,
      tatbeschreibung: fall.tatbeschreibung,
      tatort: fall.tatort,
      aufenthalt: Object.fromEntries(
        fall.verdaechtige.map((v) => [v.charakterId, v.aufenthaltsort]),
      ),
      erstelltAm: fall.erstelltAm,
    };

    // Der vollständige Fall verlässt den Server nur verschlüsselt.
    return NextResponse.json({ fall: oeffentlich, siegel: seal(fall) });
  } catch (error) {
    console.error("[api/case]", error);
    return NextResponse.json(
      { fehler: error instanceof Error ? error.message : "Unbekannter Fehler" },
      { status: 500 },
    );
  }
}
