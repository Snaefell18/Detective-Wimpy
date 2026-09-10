import { NextResponse } from "next/server";
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ergebnisAus, fehlerText, istZeitueberschreitung } from "@/lib/antwort";
import { idOderStandard, passendeId } from "@/lib/zuordnen";
import { MODEL, budget, getAnthropic } from "@/lib/anthropic";
import { CHARACTERS } from "@/lib/characters";
import {
  ZIEL_EINZELFALL,
  ZIEL_KAPITEL,
  fernwirkungPruefen,
  repariereFall,
  spurenKappen,
  verteilungMangel,
  type SpurenZiel,
} from "@/lib/fallReparieren";
import { LOCATIONS, findeOrt, waehleSchauplaetze } from "@/lib/locations";
import {
  buildGeruestPrompt,
  buildSpurenPrompt,
  type FernwirkungsVorgabe,
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
  einzelnGeprueft,
  makeGeruestSchema,
  makeSpurenSchema,
  makeVerdaechtigeSchema,
} from "@/lib/schemas";
import type { Bogen } from "@/lib/sagaBogen";
import { mitVerhandlung } from "@/lib/sagaFinale";
import { buildSagaBriefing } from "@/lib/sagaPrompts";
import {
  besessen,
  besetzungFuerKapitel,
  daemonFuerKapitel,
  falscheFaehrteVon,
  mittaeterFuerKapitel,
} from "@/lib/sagaTypen";
import { waehleDaemonform, waehleMittaeter } from "@/lib/daemonEnthuellung";
import { besessenheitsRegeln } from "@/lib/gestaltStimme";
import { seal, unseal } from "@/lib/seal";
import {
  STANDARD_EINSTELLUNGEN,
  type CaseClue,
  type CaseFile,
  type Character,
  type Einstellungen,
  type Item,
  type Location,
  type PublicCase,
  type SuspectBrief,
  type Vorgaben,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Höchstens so viele Charaktere bzw. Orte - schützt vor riesigen Prompts. */
/**
 * Wie viele Tiere höchstens in EINEN Fall kommen. Die Liste aus der
 * Datenbank darf länger sein - aus ihr wird gewählt.
 */
const MAX_CHARAKTERE = 24;
const MAX_ORTE = 120;
const MAX_ITEMS = 60;

/** So viele Gegenstände stehen einem einzelnen Fall zur Auswahl. */
const ITEMS_PRO_FALL = 8;

/**
 * Nimmt die Besetzung aus dem Admin-Menü entgegen, sofern sie brauchbar ist.
 * Sonst gilt die im Repository hinterlegte Liste aus data/characters.csv.
 */
/**
 * Die Besetzung aus dem Browser.
 *
 * Geprüft wird Stück für Stück: Ein einziges Tier mit einer zu langen
 * Beschreibung darf nicht die ganze Liste zu Fall bringen - sonst spielte
 * man plötzlich mit den sechs Tieren aus dem Projekt statt mit den eigenen,
 * ohne dass irgendwo stünde, warum.
 */
function besetzungAus(roh: unknown): Character[] {
  const { gut, verworfen } = einzelnGeprueft<Character>(CharacterSchema, roh);
  if (verworfen.length) {
    console.warn("[api/case] verworfene Tiere:", verworfen.join("; "));
  }
  if (!gut.length) return CHARACTERS;

  /*
   * Dämonenformen laufen nicht in der Stadt herum.
   *
   * Sie sind die Gestalt, die in jemandem steckt - als Nachbarin mit Alibi
   * wären sie ein Fremdkörper und würden nebenbei verraten, dass es so etwas
   * überhaupt gibt. Eingesetzt werden sie nur dort, wo sie gemeint sind.
   */
  const besetzung = gut.filter((c) => !c.istDaemon).slice(0, MAX_CHARAKTERE);
  const detektive = besetzung.filter((c) => c.istDetektiv);
  const verdaechtige = besetzung.filter((c) => !c.istDetektiv);
  // Ohne genau einen Detektiv und mindestens zwei Verdächtige ist kein Fall spielbar.
  if (detektive.length !== 1 || verdaechtige.length < 2) return CHARACTERS;

  return besetzung;
}

/**
 * Orte aus dem Admin-Menü, sonst die Liste aus data/locations.csv.
 * Auch hier Stück für Stück - ein zu langer Text bringt nicht alles zu Fall.
 */
function orteAus(roh: unknown): Location[] {
  const { gut, verworfen } = einzelnGeprueft<Location>(LocationSchema, roh);
  if (verworfen.length) console.warn("[api/case] verworfene Orte:", verworfen.join("; "));
  return gut.length ? gut.slice(0, MAX_ORTE) : LOCATIONS;
}

/** Gegenstände aus der Datenbank, sonst die Liste aus lib/items.ts. */
function itemsAus(roh: unknown): Item[] {
  const { gut, verworfen } = einzelnGeprueft<Item>(ItemSchema, roh);
  if (verworfen.length) console.warn("[api/case] verworfene Dinge:", verworfen.join("; "));
  return gut.length ? gut.slice(0, MAX_ITEMS) : ITEMS;
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
type Entwurf = CaseFile & {
  vorgaben: Vorgaben | null;
  /**
   * Nur bei Sagas gesetzt: Was das Modell über den großen Bogen wissen muss.
   * Steht ausschließlich hier im Siegel, damit der Browser nichts davon sieht.
   */
  sagaBriefing?: string;
  /**
   * Ebenfalls nur bei Sagas: Was dieses Kapitel über sich hinaus hinterlassen
   * muss, damit im Finale überhaupt etwas vorzulegen ist.
   */
  sagaSpur?: FernwirkungsVorgabe | null;
};

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

const mitBriefing = (prompt: string, briefing?: string) =>
  briefing ? `${briefing}\n\n---\n\n${prompt}` : prompt;

/**
 * Gehört dieser Fall zu einer Saga? Dann kommen Vorgaben, Täter und Briefing
 * aus dem versiegelten Bogen statt aus dem Körper der Anfrage - so kann der
 * Browser weder den Drahtzieher noch die Enthüllungen mitlesen.
 */
function sagaTeil(body: Record<string, unknown>): {
  bogen: Bogen;
  kapitel: number;
} | null {
  const siegel = typeof body?.sagaSiegel === "string" ? body.sagaSiegel : "";
  if (!siegel) return null;
  const bogen = unseal<Bogen>(siegel);
  // 0 steht für das Finale.
  const kapitel = Number(body?.kapitel ?? 0);
  return { bogen, kapitel: Number.isFinite(kapitel) ? kapitel : 0 };
}

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

/** Wirt und Dämonengestalt mit Namen - undefined, wenn es keine gibt. */
function besessenheitVon(bogen: Bogen): { wirt: string; daemon: string } | undefined {
  const b = besessen(bogen.vorgaben);
  if (!b) return undefined;
  const name = (id: string) => bogen.besetzung.find((c) => c.id === id)?.name;
  const wirt = name(b.wirtId);
  const daemon = name(b.daemonId);
  return wirt && daemon ? { wirt, daemon } : undefined;
}

/** Baut aus dem Bogen den Text, den die Fallerzeugung braucht. */
/**
 * Was dieses Kapitel für später hinterlassen muss.
 *
 * Der Name des Drahtziehers steht nur da, wo er ohnehin kein Geheimnis ist.
 * Bei "Kein Täter" und "Wimpy selbst" wäre er die Lösung - dort zeigen die
 * Stücke auf die Sache dahinter statt auf jemanden.
 *
 * Das Finale selbst (kapitelNr 0) braucht nichts davon: Danach kommt nichts
 * mehr, in das etwas hineinreichen könnte.
 */
/**
 * Die Gestalt in dieser Besetzung - oder nichts.
 *
 * Sie kommt nur im Finale vor: Bis dahin läuft der Wirt herum, und was in
 * ihm steckt, kennt niemand. Steht er nicht mehr in der Besetzung und die
 * Gestalt dafür schon, ist die Verwandlung gelaufen.
 */
/**
 * Die Gestalt, die im Täter steckt - oder nichts.
 *
 * Gebraucht werden zwei Dinge: eine Einstellung, die es zulässt, und
 * mindestens eine Dämonenform unter den Tieren. Fehlt eins davon, passiert
 * schlicht nichts - kein Fehler, kein Hinweis, der Fall läuft wie immer.
 */
/**
 * Die Gestalt, die für dieses Kapitel vorgesehen ist.
 *
 * Anders als im gewöhnlichen Fall wird hier nicht gewürfelt: Wer beim
 * Erstellen der Saga eine Dämonenform in ein Kapitel geschrieben hat, will
 * genau die - und zwar dort und nirgends sonst. Das Finale bleibt außen vor,
 * dort hat die Saga ihre eigene Besessenheit.
 */
function gewaehlteBesessenheit(
  bogen: Bogen,
  kapitel: number,
  rohCharaktere: unknown,
  taeterId: string,
): { wirtId: string; daemon: Character } | undefined {
  const id = daemonFuerKapitel(bogen.vorgaben, kapitel);
  if (!id || id === taeterId) return undefined;

  const { gut } = einzelnGeprueft<Character>(CharacterSchema, rohCharaktere);
  const daemon = gut.find((c) => c.id === id && !c.istDetektiv);
  return daemon ? { wirtId: taeterId, daemon } : undefined;
}

function wuerfleBesessenheit(
  wie: Einstellungen["daemonEnthuellung"],
  rohCharaktere: unknown,
  taeterId: string,
): { wirtId: string; daemon: Character } | undefined {
  // Die Dämonenformen stehen im Rohmaterial aus dem Menü, nicht in der
  // Besetzung des Falls - dort sind sie ja gerade herausgefiltert.
  const { gut } = einzelnGeprueft<Character>(CharacterSchema, rohCharaktere);
  const daemon = waehleDaemonform(gut, wie, taeterId);
  return daemon ? { wirtId: taeterId, daemon } : undefined;
}

function gestaltIn(
  bogen: Bogen | undefined,
  besetzung: { id: string }[],
): { id: string; wirtName: string } | undefined {
  const b = bogen ? besessen(bogen.vorgaben) : null;
  if (!b?.daemonId || !bogen) return undefined;
  if (!besetzung.some((c) => c.id === b.daemonId)) return undefined;
  if (besetzung.some((c) => c.id === b.wirtId)) return undefined;
  return {
    id: b.daemonId,
    wirtName: bogen.besetzung.find((c) => c.id === b.wirtId)?.name ?? "",
  };
}

function faehrteVon(bogen: Bogen): { name: string; was: string } | undefined {
  const faehrte = falscheFaehrteVon(bogen.vorgaben, bogen.besetzung);
  return faehrte ? { name: faehrte.charakter.name, was: faehrte.was } : undefined;
}

function fernwirkungVon(bogen: Bogen, kapitelNr: number): FernwirkungsVorgabe | null {
  if (kapitelNr === 0) return null;
  const art = bogen.vorgaben.finaleArt ?? "klassisch";
  /*
   * Wo der Schuldige das Geheimnis der Saga ist, fällt weder Name noch Id:
   * Ohne Namen bestellt der Prompt Stücke, die auf die Sache dahinter
   * zeigen - und ohne Id hakt die Prüfung hinterher nichts falsch ab. Bei
   * "Kein Täter" wäre das sonst ausgerechnet eine Spur gegen den
   * Unschuldigen.
   */
  const geheim = art === "ohne-taeter" || art === "wimpy";
  return {
    drahtzieherName: geheim ? "" : bogen.drahtzieherName,
    drahtzieherId: geheim ? "" : bogen.drahtzieherId,
    enthuellung: bogen.kapitel.find((k) => k.nummer === kapitelNr)?.enthuellung ?? "",
    vorGericht: mitVerhandlung(art),
    falscheFaehrteName: faehrteVon(bogen)?.name ?? "",
  };
}

function briefingVon(bogen: Bogen, kapitelNr: number): string {
  const istFinale = kapitelNr === 0;
  const kapitel = bogen.kapitel.find((k) => k.nummer === kapitelNr);
  const vorher = bogen.kapitel
    .filter((k) => (istFinale ? true : k.nummer < kapitelNr))
    .map((k) => k.enthuellung)
    .filter(Boolean);

  return buildSagaBriefing({
    thema: bogen.thema,
    wahrheit: bogen.wahrheit,
    drahtzieherName: bogen.drahtzieherName,
    kapitelNummer: kapitelNr,
    kapitelAnzahl: bogen.kapitel.length,
    auftrag: istFinale ? bogen.finale.auftrag : (kapitel?.auftrag ?? ""),
    twist: bogen.vorgaben.twist === true,
    besessenheit: besessenheitVon(bogen),
    enthuellung: kapitel?.enthuellung ?? "",
    vorherigeEnthuellungen: vorher,
    istFinale,
    falscheFaehrte: faehrteVon(bogen),
  });
}

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
  const saga = sagaTeil(body);

  const besetzung = saga
    ? besetzungFuerKapitel({
        besetzung: saga.bogen.besetzung,
        drahtzieherId: saga.bogen.drahtzieherId,
        kapitel: saga.kapitel,
        vorgaben: saga.bogen.vorgaben,
      })
    : besetzungAus(body?.charaktere);
  const einstellungen = saga
    ? {
        ...STANDARD_EINSTELLUNGEN,
        ton: saga.bogen.vorgaben.ton,
        ortsAnzahl: saga.bogen.vorgaben.ortsAnzahl,
        beschuldigungen: saga.bogen.vorgaben.beschuldigungen,
        stadt: saga.bogen.vorgaben.stadt,
      }
    : (EinstellungenSchema.safeParse(body?.einstellungen).data ?? STANDARD_EINSTELLUNGEN);

  // Bei einer Saga bestimmt der Bogen die Vorgaben, nicht der Browser.
  const vorgaben: Vorgaben | null = saga
    ? {
        thema: "",
        stadt: saga.bogen.vorgaben.stadt,
        charaktere: [],
        items: saga.bogen.vorgaben.items,
        taeterId: "",
        schwierigkeit: saga.bogen.vorgaben.schwierigkeit,
        reifegrad: saga.bogen.vorgaben.reifegrad,
        absurditaet: saga.bogen.vorgaben.absurditaet,
      }
    : (VorgabenSchema.safeParse(body?.vorgaben).data ?? null);

  // Vorgabe "welche Tiere" einschränken - der Detektiv bleibt immer dabei.
  const gefiltert =
    !saga && vorgaben && vorgaben.charaktere.length >= 2
      ? besetzung.filter((c) => c.istDetektiv || vorgaben.charaktere.includes(c.id))
      : besetzung;
  const spielendeBesetzung =
    gefiltert.filter((c) => !c.istDetektiv).length >= 2 ? gefiltert : besetzung;

  const verdaechtige = spielendeBesetzung.filter((c) => !c.istDetektiv);
  const sagaTaeterId = saga
    ? saga.kapitel === 0
      ? saga.bogen.drahtzieherId
      : saga.bogen.kapitel.find((k) => k.nummer === saga.kapitel)?.taeterId
    : undefined;
  const gewuenschterTaeter = verdaechtige.find(
    (c) => c.id === (sagaTaeterId ?? vorgaben?.taeterId),
  );
  const taeter =
    gewuenschterTaeter ?? verdaechtige[Math.floor(Math.random() * verdaechtige.length)];

  /*
   * Hat noch jemand mitgemacht?
   *
   * In einer Saga steht es in den Vorgaben - dort ist es eine Entscheidung,
   * kein Zufall. In einem gewöhnlichen Fall wird gewürfelt, so oft wie
   * eingestellt. Der Zweite ist genauso schuldig wie der Erste.
   */
  const sagaMittaeterId = saga
    ? mittaeterFuerKapitel(saga.bogen.vorgaben, saga.kapitel)
    : "";
  const mittaeter =
    (sagaMittaeterId
      ? verdaechtige.find((c) => c.id === sagaMittaeterId && c.id !== taeter.id)
      : undefined) ??
    (saga
      ? null
      : waehleMittaeter(verdaechtige, einstellungen.mittaeter, taeter.id));

  /*
   * Entpuppt sich der Täter am Ende als etwas ganz anderes?
   *
   * Gewürfelt wird hier, auf dem Server, und das Ergebnis wandert ins Siegel
   * - im Browser darf davon nichts stehen. In einer Saga passiert das nie:
   * Dort steht die Besessenheit im Bogen und gehört zum großen Bogen, nicht
   * zu einer einzelnen Runde.
   */
  const besessenheit = saga
    ? gewaehlteBesessenheit(saga.bogen, saga.kapitel, body?.charaktere, taeter.id)
    : wuerfleBesessenheit(einstellungen.daemonEnthuellung, body?.charaktere, taeter.id);
  if (besessenheit) {
    console.warn(
      `[api/case] Verwandlung vorbereitet: ${taeter.name} -> ${besessenheit.daemon.name}`,
    );
  }

  const fallItems = wuerfleItems(itemsAus(body?.items), vorgaben?.items ?? []);

  const alleOrte = orteAus(body?.orte);
  // Bei einer Saga steht die Stadt je Kapitel im Bogen.
  const sagaStadt = saga
    ? saga.kapitel === 0
      ? saga.bogen.finale.stadt
      : saga.bogen.kapitel.find((k) => k.nummer === saga.kapitel)?.stadt
    : undefined;
  const gewuenschteStadt =
    sagaStadt ??
    (vorgaben && vorgaben.stadt !== "zufall" ? vorgaben.stadt : einstellungen.stadt);
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
    mittaeterId: mittaeter?.id,
    motiv: "",
    tathergang: "",
    verdaechtige: [],
    spuren: [],
    /*
     * Steht in diesem Fall die Gestalt statt ihres Wirts? Dann soll sie auch
     * so reden - im Finalfall spricht der Spieler ja mit ihr, nicht mit dem
     * Tier, das sie getragen hat.
     */
    gestalt: gestaltIn(saga?.bogen, spielendeBesetzung),
    besessenheit,
    erstelltAm: Date.now(),
    vorgaben,
    /*
     * Was das Modell über den großen Bogen wissen muss - oder, in einem
     * gewöhnlichen Fall, über die Gestalt im Täter. Beides gehört ins
     * Siegel und niemals in den Browser.
     */
    sagaBriefing: saga
      ? briefingVon(saga.bogen, saga.kapitel)
      : besessenheit
        ? besessenheitsRegeln(taeter.name, besessenheit.daemon.name, "beschuldigung")
        : undefined,
    sagaSpur: saga ? fernwirkungVon(saga.bogen, saga.kapitel) : undefined,
  };

  const response = await getAnthropic().messages.create(
    modellOptionen(
      weltVon(roh),
      mitBriefing(
        buildGeruestPrompt(
          spielendeBesetzung,
          roh.stadt,
          taeter.id,
          vorgaben,
          mittaeter?.id ?? "",
        ),
        roh.sagaBriefing,
      ),
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
      mitBriefing(
        buildVerdaechtigePrompt(
          entwurf.besetzung,
          entwurf.taeterId,
          entwurf.titel,
          entwurf.tathergang,
          entwurf.vorgaben,
          entwurf.mittaeterId ?? "",
        ),
        entwurf.sagaBriefing,
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

/** Ein Anlauf für die Spuren - beim zweiten Mal mit geschärfter Ansage. */
async function spurenHolen(entwurf: Entwurf, ziel: SpurenZiel, nachfassen: boolean) {
  return getAnthropic().messages.create(
    modellOptionen(
      weltVon(entwurf),
      mitBriefing(
        buildSpurenPrompt(
          entwurf.besetzung,
          entwurf.taeterId,
          entwurf.titel,
          entwurf.tathergang,
          entwurf.verdaechtige,
          entwurf.vorgaben,
          entwurf.items,
          entwurf.sagaSpur,
          nachfassen,
          ziel,
          entwurf.mittaeterId ?? "",
        ),
        entwurf.sagaBriefing,
      ),
      zodOutputFormat(
        makeSpurenSchema(entwurf.besetzung, entwurf.orte, entwurf.items, ziel),
      ),
      4096,
      "low",
    ),
    budget(45),
  );
}

async function spurenSchritt(entwurf: Entwurf) {
  const ortIds = entwurf.orte.map((o) => o.id);
  const charakterIds = entwurf.besetzung.map((c) => c.id);
  const itemIds = entwurf.items.map((i) => i.id);

  /*
   * Wie viele Spuren dieser Fall haben soll.
   *
   * Ein Kapitel einer Saga darf etwas mehr, weil dort die Stücke mit
   * Fernwirkung dazukommen - die lösen den Fall ja nicht.
   */
  const ziel: SpurenZiel = entwurf.sagaSpur ? ZIEL_KAPITEL : ZIEL_EINZELFALL;

  const aufbereiten = (roh: SpurenDraft): CaseClue[] =>
    (roh.spuren ?? [])
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

  /**
   * Einen Entwurf durchsehen: reparieren, kappen, zählen, verteilen.
   *
   * Gibt zurück, was daraus geworden ist - und was daran noch fehlt. Nur
   * wenn hier etwas fehlt, lohnt sich ein zweiter Anlauf.
   */
  const bewerten = (roh: SpurenDraft) => {
    let spuren = aufbereiten(roh);
    const maengel: string[] = [];
    const notizen: string[] = [];

    // Zuerst das Stück, das über den Fall hinausweist - ohne es steht Wimpy
    // im Finale mit leeren Händen im Saal.
    if (entwurf.sagaSpur) {
      const kur = fernwirkungPruefen(spuren, entwurf.sagaSpur.drahtzieherId);
      spuren = kur.spuren;
      if (kur.aenderung) notizen.push(kur.aenderung);
      if (kur.fehlt) maengel.push("keine Spur mit Fernwirkung");
    }

    // Dann die Lösbarkeit: doppelte Gegenstände, Widersprüche, ein Täter,
    // der nicht im Zentrum steht.
    const kur = repariereFall({
      spuren,
      verdaechtige: entwurf.verdaechtige,
      besetzung: entwurf.besetzung,
      taeterId: entwurf.taeterId,
      mittaeterId: entwurf.mittaeterId,
      ortIds,
      itemIds,
    });
    notizen.push(...kur.aenderungen);
    if (kur.fehler) maengel.push(kur.fehler);

    // Und zuletzt die Menge: Überzähliges fliegt raus, Fehlendes wird
    // gemeldet.
    const gekappt = spurenKappen(kur.spuren, ziel.max, entwurf.taeterId);
    notizen.push(...gekappt.aenderungen);
    if (!kur.fehler && gekappt.spuren.length < ziel.min) {
      maengel.push(`nur ${gekappt.spuren.length} Spuren statt ${ziel.min}`);
    }
    const verteilung = verteilungMangel(gekappt.spuren, ortIds);
    if (verteilung) maengel.push(verteilung);

    return {
      spuren: gekappt.spuren,
      verdaechtige: kur.verdaechtige,
      fehler: kur.fehler,
      maengel,
      notizen,
    };
  };

  const erste = ergebnisAus<SpurenDraft>(
    await spurenHolen(entwurf, ziel, false),
    "api/case:spuren",
  );
  if ("fehler" in erste) {
    return NextResponse.json({ fehler: erste.fehler }, { status: erste.status });
  }

  let ergebnis = bewerten(erste.daten);

  /*
   * Der zweite Anlauf.
   *
   * Er kostet einen Aufruf und wird nur genommen, wenn wirklich etwas fehlt:
   * zu wenige Spuren, alles an einem Ort, nichts für das Finale. Genau
   * einmal - danach wird genommen, was besser ist. Das ist billiger als ein
   * verworfener Fall, der den Spieler drei Aufrufe kostet.
   */
  if (ergebnis.fehler || ergebnis.maengel.length) {
    console.warn(
      "[api/case:spuren] Zweiter Anlauf wegen:",
      [ergebnis.fehler, ...ergebnis.maengel].filter(Boolean).join(" · "),
    );
    const zweite = ergebnisAus<SpurenDraft>(
      await spurenHolen(entwurf, ziel, true),
      "api/case:spuren",
    );
    if (!("fehler" in zweite)) {
      const neu = bewerten(zweite.daten);
      // Besser ist: erst gar kein Fehler, dann weniger Mängel.
      const besser =
        (ergebnis.fehler && !neu.fehler) ||
        (Boolean(ergebnis.fehler) === Boolean(neu.fehler) &&
          neu.maengel.length < ergebnis.maengel.length);
      if (besser) ergebnis = neu;
    }
  }

  if (ergebnis.notizen.length) {
    console.warn("[api/case:spuren] Fall nachgebessert:", ergebnis.notizen.join(" "));
  }
  if (ergebnis.maengel.length) {
    console.warn("[api/case:spuren] Bleibt bestehen:", ergebnis.maengel.join(" · "));
  }
  if (ergebnis.fehler) {
    console.error("[api/case:spuren] Fall unlösbar:", ergebnis.fehler);
    return NextResponse.json(
      {
        fehler:
          "Dieser Fall wäre nicht lösbar gewesen und wurde verworfen. Bitte starte ihn noch einmal.",
      },
      { status: 502 },
    );
  }

  const kur = { spuren: ergebnis.spuren, verdaechtige: ergebnis.verdaechtige };

  // Vorgaben und Saga-Briefing braucht nur die Erzeugung. Sie fliegen hier
  // raus, damit das Siegel klein bleibt - der Browser schickt es bei jeder
  // Frage an ein Tier wieder mit.
  const { vorgaben: _v, sagaBriefing: _b, ...rest } = entwurf;
  const fall: CaseFile = {
    ...rest,
    verdaechtige: kur.verdaechtige,
    spuren: kur.spuren,
  };

  // Der vollständige Fall verlässt den Server nur verschlüsselt.
  return NextResponse.json({
    schritt: "spuren",
    fall: oeffentlichVon(fall),
    siegel: seal(fall),
  });
}
