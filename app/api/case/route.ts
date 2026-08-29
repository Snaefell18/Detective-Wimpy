import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MODEL, getAnthropic } from "@/lib/anthropic";
import { CHARACTERS } from "@/lib/characters";
import { buildCasePrompt, buildWorldPrompt } from "@/lib/prompts";
import {
  CharacterSchema,
  EinstellungenSchema,
  makeCaseDraftSchema,
} from "@/lib/schemas";
import { seal } from "@/lib/seal";
import {
  STANDARD_EINSTELLUNGEN,
  type CaseFile,
  type Character,
  type PublicCase,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Höchstens so viele Charaktere - schützt vor riesigen Prompts. */
const MAX_CHARAKTERE = 24;

/**
 * Nimmt die Besetzung aus dem Admin-Menü entgegen, sofern sie brauchbar ist.
 * Sonst gilt die im Repository hinterlegte Liste aus data/characters.csv.
 */
function besetzungAus(roh: unknown): Character[] {
  const geprueft = CharacterSchema.array()
    .max(MAX_CHARAKTERE)
    .safeParse(roh);
  if (!geprueft.success) return CHARACTERS;

  const besetzung = geprueft.data as Character[];
  const detektive = besetzung.filter((c) => c.istDetektiv);
  const verdaechtige = besetzung.filter((c) => !c.istDetektiv);
  // Ohne genau einen Detektiv und mindestens zwei Verdächtige ist kein Fall spielbar.
  if (detektive.length !== 1 || verdaechtige.length < 2) return CHARACTERS;

  return besetzung;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const besetzung = besetzungAus(body?.charaktere);
    const einstellungen =
      EinstellungenSchema.safeParse(body?.einstellungen).data ??
      STANDARD_EINSTELLUNGEN;

    const verdaechtige = besetzung.filter((c) => !c.istDetektiv);
    const taeter = verdaechtige[Math.floor(Math.random() * verdaechtige.length)];

    const response = await getAnthropic().messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: [
        {
          type: "text",
          text: buildWorldPrompt(besetzung, einstellungen.ton),
          cache_control: { type: "ephemeral" },
        },
      ],
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: zodOutputFormat(makeCaseDraftSchema(besetzung)),
      },
      messages: [
        { role: "user", content: buildCasePrompt(besetzung, taeter.id) },
      ],
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
      besetzung,
      ton: einstellungen.ton,
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
      besetzung,
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
