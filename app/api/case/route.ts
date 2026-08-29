import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ergebnisAus, fehlerText } from "@/lib/antwort";
import { idOderStandard, passendeId } from "@/lib/zuordnen";
import { MODEL, getAnthropic } from "@/lib/anthropic";
import { CHARACTERS } from "@/lib/characters";
import { LOCATIONS, waehleSchauplaetze } from "@/lib/locations";
import { buildCasePrompt, buildWorldPrompt } from "@/lib/prompts";
import { ITEMS } from "@/lib/items";
import {
  CharacterSchema,
  EinstellungenSchema,
  LocationSchema,
  VorgabenSchema,
  makeCaseDraftSchema,
} from "@/lib/schemas";
import { seal } from "@/lib/seal";
import {
  STANDARD_EINSTELLUNGEN,
  type CaseFile,
  type Character,
  type Location,
  type PublicCase,
  type Vorgaben,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Höchstens so viele Charaktere bzw. Orte - schützt vor riesigen Prompts. */
const MAX_CHARAKTERE = 24;
const MAX_ORTE = 120;

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

/** Orte aus dem Admin-Menü, sonst die Liste aus data/locations.csv. */
function orteAus(roh: unknown): Location[] {
  const geprueft = LocationSchema.array().max(MAX_ORTE).safeParse(roh);
  if (!geprueft.success || geprueft.data.length === 0) return LOCATIONS;
  return geprueft.data as Location[];
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const besetzung = besetzungAus(body?.charaktere);
    const einstellungen =
      EinstellungenSchema.safeParse(body?.einstellungen).data ??
      STANDARD_EINSTELLUNGEN;

    const vorgaben: Vorgaben | null =
      VorgabenSchema.safeParse(body?.vorgaben).data ?? null;

    // Vorgabe "welche Tiere" einschränken - der Detektiv bleibt immer dabei.
    const gefiltert =
      vorgaben && vorgaben.charaktere.length >= 2
        ? besetzung.filter(
            (c) => c.istDetektiv || vorgaben.charaktere.includes(c.id),
          )
        : besetzung;
    const spielendeBesetzung =
      gefiltert.filter((c) => !c.istDetektiv).length >= 2 ? gefiltert : besetzung;

    const verdaechtige = spielendeBesetzung.filter((c) => !c.istDetektiv);
    const gewuenschterTaeter = verdaechtige.find(
      (c) => c.id === vorgaben?.taeterId,
    );
    const taeter =
      gewuenschterTaeter ??
      verdaechtige[Math.floor(Math.random() * verdaechtige.length)];

    // Stadt und Schauplätze für diesen Fall festlegen.
    const alleOrte = orteAus(body?.orte);
    const gewuenschteStadt =
      vorgaben && vorgaben.stadt !== "zufall" ? vorgaben.stadt : einstellungen.stadt;
    const schauplatz = waehleSchauplaetze(
      alleOrte,
      einstellungen.ortsAnzahl,
      gewuenschteStadt === "zufall" ? undefined : gewuenschteStadt,
    );
    if (!schauplatz) {
      return NextResponse.json(
        {
          fehler: `Keine Stadt hat ${einstellungen.ortsAnzahl} Schauplätze. Bitte im Admin-Menü die Ortsliste oder die Anzahl anpassen.`,
        },
        { status: 400 },
      );
    }

    const response = await getAnthropic().messages.parse({
      model: MODEL,
      max_tokens: 8192,
      system: [
        {
          type: "text",
          text: buildWorldPrompt(
            spielendeBesetzung,
            schauplatz.orte,
            schauplatz.stadt.name,
            einstellungen.ton,
          ),
          cache_control: { type: "ephemeral" },
        },
      ],
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: zodOutputFormat(
          makeCaseDraftSchema(spielendeBesetzung, schauplatz.orte),
        ),
      },
      messages: [
        {
          role: "user",
          content: buildCasePrompt(
            spielendeBesetzung,
            schauplatz.stadt.name,
            taeter.id,
            vorgaben,
            ITEMS,
          ),
        },
      ],
    });

    const modellAntwort = ergebnisAus<typeof response.parsed_output>(
      response,
      "api/case",
    );
    if ("fehler" in modellAntwort) {
      return NextResponse.json(
        { fehler: modellAntwort.fehler },
        { status: modellAntwort.status },
      );
    }

    const draft = modellAntwort.daten!;

    // Die Ids des Modells auf die tatsächlich gültigen abbilden - ein
    // danebenliegender Name soll nicht den ganzen Fall unbrauchbar machen.
    const ortIds = schauplatz.orte.map((o) => o.id);
    const charakterIds = spielendeBesetzung.map((c) => c.id);
    const itemIds = ITEMS.map((i) => i.id);

    const eintraege = draft.verdaechtige
      .map((v) => ({
        ...v,
        charakterId: passendeId(v.charakterId, charakterIds),
        aufenthaltsort: idOderStandard(v.aufenthaltsort, ortIds, ortIds[0]),
      }))
      .filter((v): v is typeof v & { charakterId: string } => Boolean(v.charakterId));

    // Wer im Entwurf fehlt, bekommt einen Standardeintrag - sonst stünde ein
    // Verdächtiger im Spiel, über den niemand etwas weiß.
    const fehlende = verdaechtige
      .filter((c) => !eintraege.some((v) => v.charakterId === c.id))
      .map((c, i) => ({
        charakterId: c.id,
        aufenthaltsort: ortIds[(i + 1) % ortIds.length],
        alibi: "War angeblich allein unterwegs.",
        geheimnis: "Verheimlicht eine Kleinigkeit, die nichts mit der Tat zu tun hat.",
        alibiIstGelogen: false,
      }));

    const spuren = draft.spuren
      .map((s) => ({
        ...s,
        itemId: passendeId(s.itemId, itemIds),
        ortId: idOderStandard(s.ortId, ortIds, ortIds[0]),
        zeigtAufCharakterId: idOderStandard(s.zeigtAufCharakterId, charakterIds, taeter.id),
      }))
      .filter((s): s is typeof s & { itemId: string } => Boolean(s.itemId));

    const fall: CaseFile = {
      id: crypto.randomUUID(),
      besetzung: spielendeBesetzung,
      ton: einstellungen.ton,
      stadt: schauplatz.stadt.name,
      orte: schauplatz.orte,
      titel: draft.titel,
      tatbeschreibung: draft.tatbeschreibung,
      introText: draft.introText,
      tatort: idOderStandard(draft.tatort, ortIds, ortIds[0]),
      taeterId: taeter.id,
      motiv: draft.motiv,
      tathergang: draft.tathergang,
      verdaechtige: [...eintraege, ...fehlende],
      spuren,
      erstelltAm: Date.now(),
    };

    const oeffentlich: PublicCase = {
      id: fall.id,
      besetzung: spielendeBesetzung,
      stadt: fall.stadt,
      orte: fall.orte,
      titel: fall.titel,
      tatbeschreibung: fall.tatbeschreibung,
      introText: fall.introText,
      tatort: fall.tatort,
      aufenthalt: Object.fromEntries(
        fall.verdaechtige.map((v) => [v.charakterId, v.aufenthaltsort]),
      ),
      erstelltAm: fall.erstelltAm,
    };

    // Der vollständige Fall verlässt den Server nur verschlüsselt.
    return NextResponse.json({ fall: oeffentlich, siegel: seal(fall) });
  } catch (error) {
    return NextResponse.json({ fehler: fehlerText(error, "api/case") }, { status: 500 });
  }
}
