"use client";

import { useEffect, useState } from "react";
import { bildQuelle, useAdmin } from "@/lib/adminStore";

/**
 * Bild mit Platzhalter. Ein im Admin-Menü hinterlegtes Bild gewinnt, sonst wird
 * die Datei aus /public geladen. Fehlt beides, erscheint ein Platzhalter -
 * das Spiel funktioniert also auch ganz ohne Grafiken.
 */
export function Bild({
  src,
  alt,
  platzhalter,
  rund,
}: {
  src?: string | null;
  alt: string;
  platzhalter?: string;
  /** Porträts werden mittig oben beschnitten, Szenen mittig. */
  rund?: boolean;
}) {
  const { daten } = useAdmin();
  const [fehlt, setFehlt] = useState(false);
  const quelle = bildQuelle(daten, src);

  // Wechselt die Quelle (z.B. weil im Admin ein Bild hinterlegt wurde),
  // bekommt sie einen neuen Versuch - sonst bliebe der Platzhalter stehen.
  useEffect(() => setFehlt(false), [quelle]);

  if (!quelle || fehlt) {
    return <div className="bild-platzhalter">{platzhalter ?? alt}</div>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="bild"
      src={quelle}
      alt={alt}
      onError={() => setFehlt(true)}
      draggable={false}
      style={rund ? undefined : { objectPosition: "center top" }}
    />
  );
}

/** Großflächiges Hintergrundbild einer Szene (Ort oder Charakter). */
export function Szene({
  src,
  alt,
  platzhalter,
  variante = "ort",
}: {
  src?: string | null;
  alt: string;
  platzhalter?: string;
  variante?: "ort" | "portraet";
}) {
  const { daten } = useAdmin();
  const [fehlt, setFehlt] = useState(false);
  const quelle = bildQuelle(daten, src);

  useEffect(() => setFehlt(false), [quelle]);

  return (
    <div className={`szene szene-${variante}`} aria-hidden>
      {quelle && !fehlt ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={quelle} alt="" onError={() => setFehlt(true)} draggable={false} />
      ) : (
        <div className="szene-platzhalter">{platzhalter ?? alt}</div>
      )}
      <div className="szene-verlauf" />
    </div>
  );
}
