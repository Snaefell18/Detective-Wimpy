import type { Beweismittel } from "./beweismittel";

/**
 * Eine Versammlung zwischen zwei Kapiteln einer Arc-Saga.
 *
 * Die Rollen sind bewusst getrennt: Teilnehmer beraten regelmäßig,
 * Beobachter sitzen am Rand und dürfen sich nur gelegentlich einmischen.
 * `undercoverId` ist eine geheime Regieanweisung an den Server und wird in
 * der Spieloberfläche niemals markiert.
 */
export type VersammlungVorgabe = {
  id: string;
  /** Nach welchem Kapitel sie stattfindet (1-basiert). */
  nachKapitel: number;
  name: string;
  anlass: string;
  thema: string;
  vorsitzId: string;
  teilnehmerIds: string[];
  beobachterIds: string[];
  /** Optional: sitzt unerkannt in der Runde oder am Rand. */
  undercoverId: string;
};

export type VersammlungBeitrag = {
  sprecherId: string;
  text: string;
  /** Nur für den eigenen Beitrag des Spielers. */
  spieler?: boolean;
  /** Eine Regiezeile ohne Sprecherportrait. */
  system?: boolean;
};

/** Das zusätzliche Beweisstück, wie es vom Server in die Szene kommt. */
export type VersammlungBeweis = {
  itemId: string;
  name: string;
  bild: string | null;
  beobachtung: string;
  vermutung: string | null;
  herkunft: string;
  siegel: string;
};

export type VersammlungAntwort = {
  beitraege: VersammlungBeitrag[];
  fortschrittPlus: number;
  beweis: VersammlungBeweis | null;
  beendet: boolean;
};

/** Die Versammlung direkt nach einem Kapitel, sofern dort eine liegt. */
export function versammlungNach(
  vorgaben: { versammlungen?: VersammlungVorgabe[] } | undefined,
  kapitel: number,
): VersammlungVorgabe | null {
  if (!Number.isFinite(kapitel) || kapitel < 1) return null;
  return (
    vorgaben?.versammlungen?.find(
      (v) => v && Math.round(Number(v.nachKapitel)) === Math.round(kapitel),
    ) ?? null
  );
}

/**
 * Modellwerte bleiben Spielwerte: Ein Zug kann die verborgene Resonanz
 * spürbar bewegen, aber nie allein den Fund erzwingen.
 */
export function versammlungsFortschritt(roh: unknown, start = false): number {
  if (start) return 0;
  const zahl = Number(roh);
  if (!Number.isFinite(zahl)) return 8;
  return Math.max(5, Math.min(28, Math.round(zahl)));
}

export const VERSAMMLUNG_BEWEIS_SCHWELLE = 100;
export const VERSAMMLUNG_MIN_ENDE = 6;
export const VERSAMMLUNG_ZWANGSENDE = 12;

/**
 * Die offene Saga braucht Namen, Rollen und Zeitpunkt für ihre Oberfläche,
 * aber niemals die geheime Undercover-Regie. Die bleibt nur im versiegelten
 * Bogen und wird ausschließlich von der API gelesen.
 */
export const oeffentlicheVersammlungen = (
  versammlungen: VersammlungVorgabe[] | undefined,
): VersammlungVorgabe[] =>
  (versammlungen ?? []).map((v) => ({ ...v, undercoverId: "" }));

/** Für Tests und Komponenten: aus dem Serverfund wird ein Taschenstück. */
export function versammlungsMittel(
  fund: VersammlungBeweis,
  seit = Date.now(),
): Beweismittel {
  return {
    id: fund.itemId,
    name: fund.name,
    bild: fund.bild ?? "",
    beobachtung: fund.beobachtung,
    herkunft: fund.herkunft,
    siegel: fund.siegel,
    seit,
  };
}
