import type { Character, Item, Location } from "./types";

/**
 * Wie aus einem Namen eine Id und ein Bildpfad werden.
 *
 * Das steht hier und nicht im Formular, weil inzwischen zwei Bildschirme
 * Stammdaten anlegen: das Formular für einen einzelnen Eintrag und der
 * Stadt-Bildschirm für fünf Orte auf einmal. Zwei Rechenwege für dieselbe Id
 * wären ein sicherer Weg zu doppelten Einträgen.
 */
export type StammArt = "charaktere" | "orte" | "items";

/** Aus "Öhös Kanzlei" wird "oehoes-kanzlei" - daraus entstehen die Ids. */
export const slug = (wert: string) =>
  wert
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Ergänzt Id, Bildpfad und abgeleitete Felder. */
export function vervollstaendigen(
  art: StammArt,
  entwurf: Character | Location | Item,
): Character | Location | Item {
  if (art === "orte") {
    const ort = entwurf as Location;
    const stadtId = slug(ort.stadt);
    const id = ort.id || `${stadtId}-${slug(ort.name)}`;
    return {
      ...ort,
      id,
      stadtId,
      bild: ort.bild || `/orte/${id}.png`,
      beschreibung:
        ort.beschreibung ||
        (ort.atmosphaere ? `${ort.name} - ${ort.atmosphaere}.` : ort.name),
    };
  }

  const id = entwurf.id || slug(entwurf.name);
  const ordner = art === "charaktere" ? "charaktere" : "items";
  return { ...entwurf, id, bild: entwurf.bild || `/${ordner}/${id}.png` };
}
