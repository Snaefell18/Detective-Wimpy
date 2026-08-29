"use client";

/**
 * Verkleinert ein ausgewähltes Bild und macht eine Data-URL daraus.
 *
 * Die Bilder landen im localStorage des Geräts (dort ist bei ~5 MB Schluss),
 * deshalb wird auf eine vernünftige Kantenlänge heruntergerechnet. Für den
 * dauerhaften Weg gehören die Dateien in den Ordner public/.
 */
export async function alsDataUrl(datei: File, maxKante = 640): Promise<string> {
  if (!datei.type.startsWith("image/")) {
    throw new Error("Das ist keine Bilddatei.");
  }

  const bitmap = await createImageBitmap(datei);
  const faktor = Math.min(1, maxKante / Math.max(bitmap.width, bitmap.height));
  const breite = Math.round(bitmap.width * faktor);
  const hoehe = Math.round(bitmap.height * faktor);

  const canvas = document.createElement("canvas");
  canvas.width = breite;
  canvas.height = hoehe;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Das Bild konnte nicht verarbeitet werden.");
  ctx.drawImage(bitmap, 0, 0, breite, hoehe);
  bitmap.close();

  // PNG behält die Transparenz freigestellter Tiere, JPEG spart bei Fotos Platz.
  const transparenz = datei.type === "image/png" || datei.type === "image/webp";
  return canvas.toDataURL(transparenz ? "image/png" : "image/jpeg", 0.85);
}

export const groesse = (dataUrl: string): string => {
  const bytes = Math.round((dataUrl.length * 3) / 4);
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} kB`;
};
