"use client";

import { useState } from "react";

/**
 * Bild mit Platzhalter: Solange in /public/charaktere, /public/orte bzw.
 * /public/items noch kein passendes PNG liegt, zeigt die App einen sauberen
 * Platzhalter statt eines kaputten Bildes.
 */
export function Bild({
  src,
  alt,
  platzhalter,
}: {
  src?: string | null;
  alt: string;
  platzhalter?: string;
}) {
  const [fehlt, setFehlt] = useState(false);

  if (!src || fehlt) {
    return <div className="bild-platzhalter">{platzhalter ?? alt}</div>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="bild"
      src={src}
      alt={alt}
      onError={() => setFehlt(true)}
      draggable={false}
    />
  );
}
