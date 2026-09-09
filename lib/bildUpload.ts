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

/**
 * Eine fertige data:-URL noch einmal verkleinern.
 *
 * Ein frisch erzeugtes Bild kommt in voller Auflösung und ist damit größer,
 * als ein Firestore-Dokument sein darf (1 MB). Deshalb wird so lange
 * verkleinert, bis es sicher passt - lieber ein etwas kleineres Bild als
 * eines, das sich nicht speichern lässt.
 *
 * `transparenz` entscheidet über PNG (freigestellte Tiere und Gegenstände)
 * oder JPEG (Schauplätze, die ohnehin das ganze Bild füllen).
 */
export async function verkleinereDataUrl(
  dataUrl: string,
  { transparenz, maxBytes = 700_000, kanten = [1280, 1024, 832, 640, 512] }: {
    transparenz: boolean;
    maxBytes?: number;
    kanten?: number[];
  },
): Promise<string> {
  const blob = await fetch(dataUrl).then((r) => r.blob());
  const bitmap = await createImageBitmap(blob);

  try {
    let letzte = dataUrl;
    for (const kante of kanten) {
      const faktor = Math.min(1, kante / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * faktor));
      canvas.height = Math.max(1, Math.round(bitmap.height * faktor));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Das Bild konnte nicht verarbeitet werden.");
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      letzte = canvas.toDataURL(transparenz ? "image/png" : "image/jpeg", 0.85);
      if (bytesVon(letzte) <= maxBytes) return letzte;
    }
    return letzte;
  } finally {
    bitmap.close();
  }
}

/** Wie viele Bytes hinter einer data:-URL stecken. */
export const bytesVon = (dataUrl: string): number =>
  Math.round(((dataUrl.split(",")[1] ?? "").length * 3) / 4);

export const groesse = (dataUrl: string): string => {
  const bytes = bytesVon(dataUrl);
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} kB`;
};
