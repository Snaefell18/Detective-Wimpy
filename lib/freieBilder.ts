/**
 * Bilder, die im Projekt liegen, aber zu nichts gehören.
 *
 * In /public sammeln sich mit der Zeit Dateien an, die jemand hochgeladen und
 * dann vergessen hat. Hier stehen die Regeln, um sie zu finden - als reine
 * Funktionen, damit sie prüfbar bleiben: Was im Admin-Menü daraus wird, ist
 * eine Frage der Anzeige, nicht der Logik.
 */
import { ALLE_BILDER, BILD_DATEIEN } from "./bilder.generated";

/**
 * Auf denselben Nenner bringen: Groß- und Kleinschreibung, ein fehlender
 * Schrägstrich am Anfang oder ein angehängtes ?v=2 dürfen nicht dazu führen,
 * dass ein belegtes Bild als frei gilt.
 */
export const bildSchluessel = (pfad: string): string => {
  const sauber = (pfad ?? "").trim().split(/[?#]/)[0].toLowerCase();
  if (!sauber) return "";
  return sauber.startsWith("/") ? sauber : `/${sauber}`;
};

/**
 * Alle Bilder, die von keinem der übergebenen Einträge benutzt werden.
 *
 * `belegt` sind die Pfade, die schon irgendwo hängen - Tiere, Orte, Dinge,
 * Ladenzubehör. Die Reihenfolge bleibt die der Liste aus dem Projekt.
 */
export function freieBilder(belegt: (string | undefined)[], alle: string[] = ALLE_BILDER): string[] {
  const genommen = new Set(belegt.map((p) => bildSchluessel(p ?? "")).filter(Boolean));
  return alle.filter((pfad) => !genommen.has(bildSchluessel(pfad)));
}

/** In welchem Ordner ein Bild liegt - "charaktere", "orte", "items" … */
export const ordnerVon = (pfad: string): string => {
  const teile = bildSchluessel(pfad).split("/").filter(Boolean);
  return teile.length > 1 ? teile[0] : "sonstige";
};

/** Zu welcher Stammdaten-Art ein Ordner am ehesten passt. */
export const ORDNER_ZU_ART: Record<string, "charaktere" | "orte" | "items" | undefined> = {
  charaktere: "charaktere",
  orte: "orte",
  items: "items",
};

/**
 * Ein brauchbarer Name aus dem Dateinamen: "alter_hafen_2.png" wird zu
 * "Alter Hafen 2". Nur ein Vorschlag - im Formular lässt sich alles ändern.
 */
export function nameAusPfad(pfad: string): string {
  const datei = bildSchluessel(pfad).split("/").pop() ?? "";
  const ohneEndung = datei.replace(/\.[a-z0-9]+$/i, "");
  return ohneEndung
    .replace(/[-_.]+/g, " ")
    .replace(/([a-zäöüß])(\d)/gi, "$1 $2")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((wort) => wort.charAt(0).toUpperCase() + wort.slice(1))
    .join(" ");
}

/** Wie viele Bilder in jedem Ordner überhaupt liegen - für die Übersicht. */
export const bilderJeOrdner = (): { ordner: string; anzahl: number }[] =>
  Object.entries(BILD_DATEIEN).map(([ordner, liste]) => ({ ordner, anzahl: liste.length }));
