import { NextResponse } from "next/server";
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ergebnisAus, fehlerText, istZeitueberschreitung } from "@/lib/antwort";
import { idOderStandard, passendeId } from "@/lib/zuordnen";
import { MODEL, budget, getAnthropic } from "@/lib/anthropic";
import { CHARACTERS } from "@/lib/characters";
import { LOCATIONS, findeOrt, waehleSchauplaetze } from "@/lib/locations";
import {
  buildGeruestPrompt,
  buildSpurenPrompt,
  buildVerdaechtigePrompt,
  buildWorldPrompt,
} from "@/lib/prompts";
import { ITEMS } from "@/lib/items";
import type { Geruest, SpurenDraft, VerdaechtigeDraft } from "@/lib/schemas";
import {
  CharacterSchema,
  EinstellungenSchema,
  ItemSchema,
  LocationSchema,
  VorgabenSchema,
  makeGeruestSchema,
  makeSpurenSchema,
  makeVerdaechtigeSchema,
} from "@/lib/schemas";
import { seal, unseal } from "@/lib/seal";
import {
  STANDARD_EINSTELLUNGEN,
  type CaseFile,
  type Character,
  type Item,
  type Location,
  type PublicCase,
  type SuspectBrief,
  type Vorgaben,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Höchstens so viele Charaktere bzw. Orte - schützt vor riesigen Prompts. */
const MAX_CHARAKTERE = 24;
const MAX_ORTE = 120;
const MAX_ITEMS = 60;

/** So viele Gegenstände stehen einem einzelnen Fall zur Auswahl. */
const ITEMS_PRO_FALL = 8;

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

/** Gegenstände aus der Datenbank, sonst die Liste aus lib/items.ts. */
function itemsAus(roh: unknown): Item[] {
  const geprueft = ItemSchema.array().max(MAX_ITEMS).safeParse(roh);
  if (!geprueft.success || geprueft.data.length === 0) return ITEMS;
  return geprueft.data as Item[];
}

/**
 * Zieht die Gegenstände für einen Fall.
 *
 * Bekommt das Modell jedes Mal den ganzen Katalog, greift es immer wieder zu
 * denselben Klassikern (Schal, Fotografie ...). Deshalb bekommt jeder Fall
 * eine frisch gemischte, kleine Auswahl - gewünschte Gegenstände sind darin
 * gesetzt, der Rest wird ausgelost.
 */
function wuerfleItems(pool: Item[], pflicht: string[]): Item[] {
  const gesetzt = pool.filter((i) => pflicht.includes(i.id));
  const rest = pool.filter((i) => !pflicht.includes(i.id));
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const auswahl = [...gesetzt, ...rest].slice(0, Math.max(ITEMS_PRO_FALL, gesetzt.length));
  // Mindestens vier - sonst wiederholen sich die Spuren innerhalb eines Falls.
  return auswahl.length >= 4 ? auswahl : pool;
}

/**
 * Ein Fall entsteht in drei Aufrufen statt in einem.
 *
 * Ein einziger Aufruf für den kompletten Fall lief regelmäßig in das
 * Zeitlimit der Plattform (60 s). Jetzt macht der Browser drei Anfragen
 * hintereinander, von denen jede für sich schnell ist:
 *
 *   1. "geruest"      - Titel, Tathergang, Motiv, Tatort
 *   2. "verdaechtige" - Alibi, Geheimnis, Aufenthaltsort je Tier
 *   3. "spuren"       - die Gegenstände an den Orten, danach ist der Fall fertig
 *
 * Zwischen den Schritten wandert der halbfertige Fall verschlüsselt durch den
 * Browser: Der Spieler bekommt das Siegel, kann es aber nicht lesen - Täter,
 * Motiv und Alibis bleiben geheim.
 */
type Schritt = "geruest" | "verdaechtige" | "spuren";

/** Der halbfertige Fall im Siegel - Verdächtige und Spuren fehlen anfangs. */
type Entwurf = CaseFile & { vorgaben: Vorgaben | null };

const modellOptionen = (
  system: string,
  frage: string,
  format: ReturnType<typeof zodOutputFormat>,
  maxTokens: number,
  effort: "low" | "medium",
) =>
  ({
    model: MODEL,
    max_tokens: maxTokens,
    system: [
      { type: "text" as const, text: system, cache_control: { type: "ephemeral" as const } },
    ],
    thinking: { type: "adaptive" as const },
    output_config: { effort, format },
    messages: [{ role: "user" as const, content: frage }],
  }) as MessageCreateParamsNonStreaming;

/** Weltwissen zu einem Entwurf - in allen drei Schritten identisch. */
const weltVon = (entwurf: Entwurf) =>
  buildWorldPrompt(
    entwurf.besetzung,
    entwurf.orte,
    entwurf.stadt,
    entwurf.ton,
    entwurf.items,
    entwurf.reifegrad,
    entwurf.absurditaet,
  );

/** Was der Browser über einen fertigen Fall erfahren darf. */
function oeffentlichVon(fall: CaseFile): PublicCase {
  return {
    id: fall.id,
    besetzung: fall.besetzung,
    stadt: fall.stadt,
    orte: fall.orte,
    titel: fall.titel,
    tatbeschreibung: fall.tatbeschreibung,
    introText: fall.introText,
    schlagworte: fall.schlagworte,
    tatort: fall.tatort,
    aufenthalt: Object.fromEntries(
      fall.verdaechtige.map((v) => [v.charakterId, v.aufenthaltsort]),
    ),
    erstelltAm: fall.erstelltAm,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const schritt: Schritt = ["verdaechtige", "spuren"].includes(body?.schritt)
      ? body.schritt
      : "geruest";

    if (schritt === "geruest") return await geruestSchritt(body);

    // Die Folgeschritte bauen auf dem versiegelten Entwurf auf.
    let entwurf: Entwurf;
    try {
      entwurf = unseal<Entwurf>(String(body?.siegel ?? ""));
    } catch {
      return NextResponse.json(
        { fehler: "Der halbfertige Fall ist abgelaufen. Bitte noch einmal von vorn anfangen." },
        { status: 400 },
      );
    }

    return schritt === "verdaechtige"
      ? await verdaechtigeSchritt(entwurf)
      : await spurenSchritt(entwurf);
  } catch (error) {
    return NextResponse.json(
      { fehler: fehlerText(error, "api/case") },
      { status: istZeitueberschreitung(error) ? 504 : 500 },
    );
  }
}

/* --- Schritt 1: das Gerüst ----------------------------------------- */

async function geruestSchritt(body: Record<string, unknown>) {
  const besetzung = besetzungAus(body?.charaktere);
  const einstellungen =
    EinstellungenSchema.safeParse(body?.einstellungen).data ?? STANDARD_EINSTELLUNGEN;
  const vorgaben: Vorgaben | null = VorgabenSchema.safeParse(body?.vorgaben).data ?? null;

  // Vorgabe "welche Tiere" einschränken - der Detektiv bleibt immer dabei.
  const gefiltert =
    vorgaben && vorgaben.charaktere.length >= 2
      ? besetzung.filter((c) => c.istDetektiv || vorgaben.charaktere.includes(c.id))
      : besetzung;
  const spielendeBesetzung =
    gefiltert.filter((c) => !c.istDetektiv).length >= 2 ? gefiltert : besetzung;

  const verdaechtige = spielendeBesetzung.filter((c) => !c.istDetektiv);
  const gewuenschterTaeter = verdaechtige.find((c) => c.id === vorgaben?.taeterId);
  const taeter =
    gewuenschterTaeter ?? verdaechtige[Math.floor(Math.random() * verdaechtige.length)];

  const fallItems = wuerfleItems(itemsAus(body?.items), vorgaben?.items ?? []);

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

  const roh: Entwurf = {
    id: crypto.randomUUID(),
    besetzung: spielendeBesetzung,
    items: fallItems,
    ton: einstellungen.ton,
    reifegrad: vorgaben?.reifegrad ?? "kindgerecht",
    absurditaet: vorgaben?.absurditaet ?? "verspielt",
    stadt: schauplatz.stadt.name,
    orte: schauplatz.orte,
    titel: "",
    tatbeschreibung: "",
    introText: "",
    schlagworte: [],
    tatort: schauplatz.orte[0].id,
    taeterId: taeter.id,
    motiv: "",
    tathergang: "",
    verdaechtige: [],
    spuren: [],
    erstelltAm: Date.now(),
    vorgaben,
  };

  const response = await getAnthropic().messages.create(
    modellOptionen(
      weltVon(roh),
      buildGeruestPrompt(spielendeBesetzung, roh.stadt, taeter.id, vorgaben),
      zodOutputFormat(makeGeruestSchema(spielendeBesetzung, schauplatz.orte)),
      4096,
      "medium",
    ),
    budget(45),
  );

  const antwort = ergebnisAus<Geruest>(response, "api/case:geruest");
  if ("fehler" in antwort) {
    return NextResponse.json({ fehler: antwort.fehler }, { status: antwort.status });
  }

  const draft = antwort.daten;
  const ortIds = schauplatz.orte.map((o) => o.id);
  const worte = (draft.schlagworte ?? []).map((w) => w.trim()).filter(Boolean).slice(0, 6);

  const entwurf: Entwurf = {
    ...roh,
    titel: draft.titel,
    tatbeschreibung: draft.tatbeschreibung,
    introText: draft.introText,
    tatort: idOderStandard(draft.tatort, ortIds, ortIds[0]),
    motiv: draft.motiv,
    tathergang: draft.tathergang,
    // Notfalls Schlagworte selbst bilden - das Intro braucht immer welche.
    schlagworte:
      worte.length >= 3
        ? worte
        : [
            roh.stadt,
            findeOrt(schauplatz.orte, draft.tatort)?.name ?? schauplatz.orte[0].name,
            `${verdaechtige.length} Verdächtige`,
            "Eine Spur zu viel",
          ],
  };

  return NextResponse.json({
    schritt: "geruest",
    weiter: "verdaechtige",
    titel: entwurf.titel,
    siegel: seal(entwurf),
  });
}

/* --- Schritt 2: die Verdächtigen ----------------------------------- */

async function verdaechtigeSchritt(entwurf: Entwurf) {
  const response = await getAnthropic().messages.create(
    modellOptionen(
      weltVon(entwurf),
      buildVerdaechtigePrompt(
        entwurf.besetzung,
        entwurf.taeterId,
        entwurf.titel,
        entwurf.tathergang,
        entwurf.vorgaben,
      ),
      zodOutputFormat(makeVerdaechtigeSchema(entwurf.besetzung, entwurf.orte)),
      4096,
      "low",
    ),
    budget(45),
  );

  const antwort = ergebnisAus<VerdaechtigeDraft>(response, "api/case:verdaechtige");
  if ("fehler" in antwort) {
    return NextResponse.json({ fehler: antwort.fehler }, { status: antwort.status });
  }

  const ortIds = entwurf.orte.map((o) => o.id);
  const charakterIds = entwurf.besetzung.map((c) => c.id);

  // Die Ids des Modells auf die tatsächlich gültigen abbilden - ein
  // danebenliegender Name soll nicht den ganzen Fall unbrauchbar machen.
  const eintraege: SuspectBrief[] = (antwort.daten.verdaechtige ?? [])
    .map((v) => ({
      ...v,
      charakterId: passendeId(v.charakterId, charakterIds),
      aufenthaltsort: idOderStandard(v.aufenthaltsort, ortIds, ortIds[0]),
    }))
    .filter((v): v is SuspectBrief => Boolean(v.charakterId));

  // Wer im Entwurf fehlt, bekommt einen Standardeintrag - sonst stünde ein
  // Verdächtiger im Spiel, über den niemand etwas weiß.
  const fehlende: SuspectBrief[] = entwurf.besetzung
    .filter((c) => !c.istDetektiv && !eintraege.some((v) => v.charakterId === c.id))
    .map((c, i) => ({
      charakterId: c.id,
      aufenthaltsort: ortIds[(i + 1) % ortIds.length],
      alibi: "War angeblich allein unterwegs.",
      geheimnis: "Verheimlicht eine Kleinigkeit, die nichts mit der Tat zu tun hat.",
      alibiIstGelogen: false,
    }));

  const naechster: Entwurf = { ...entwurf, verdaechtige: [...eintraege, ...fehlende] };

  return NextResponse.json({
    schritt: "verdaechtige",
    weiter: "spuren",
    siegel: seal(naechster),
  });
}

/* --- Schritt 3: die Spuren ----------------------------------------- */

async function spurenSchritt(entwurf: Entwurf) {
  const response = await getAnthropic().messages.create(
    modellOptionen(
      weltVon(entwurf),
      buildSpurenPrompt(
        entwurf.besetzung,
        entwurf.taeterId,
        entwurf.titel,
        entwurf.tathergang,
        entwurf.verdaechtige,
        entwurf.vorgaben,
        entwurf.items,
      ),
      zodOutputFormat(makeSpurenSchema(entwurf.besetzung, entwurf.orte, entwurf.items)),
      4096,
      "low",
    ),
    budget(45),
  );

  const antwort = ergebnisAus<SpurenDraft>(response, "api/case:spuren");
  if ("fehler" in antwort) {
    return NextResponse.json({ fehler: antwort.fehler }, { status: antwort.status });
  }

  const ortIds = entwurf.orte.map((o) => o.id);
  const charakterIds = entwurf.besetzung.map((c) => c.id);
  const itemIds = entwurf.items.map((i) => i.id);

  const spuren = (antwort.daten.spuren ?? [])
    .map((s) => ({
      ...s,
      itemId: passendeId(s.itemId, itemIds),
      ortId: idOderStandard(s.ortId, ortIds, ortIds[0]),
      zeigtAufCharakterId: idOderStandard(
        s.zeigtAufCharakterId,
        charakterIds,
        entwurf.taeterId,
      ),
    }))
    .filter((s): s is typeof s & { itemId: string } => Boolean(s.itemId));

  const fall: CaseFile = { ...entwurf, spuren };

  // Der vollständige Fall verlässt den Server nur verschlüsselt.
  return NextResponse.json({
    schritt: "spuren",
    fall: oeffentlichVon(fall),
    siegel: seal(fall),
  });
}
