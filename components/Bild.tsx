"use client";

import NextImage from "next/image";
import { useEffect, useState } from "react";
import { bildQuelle, useAdmin } from "@/lib/adminStore";

/** Im Admin hinterlegte Bilder sind Data-URLs - die kann Next nicht optimieren. */
const istDataUrl = (quelle: string) => quelle.startsWith("data:");

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
  groesse = "(max-width: 520px) 50vw, 260px",
}: {
  src?: string | null;
  alt: string;
  platzhalter?: string;
  /** Porträts werden mittig oben beschnitten, Szenen mittig. */
  rund?: boolean;
  groesse?: string;
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
    <NextImage
      className="bild"
      src={quelle}
      alt={alt}
      fill
      sizes={groesse}
      unoptimized={istDataUrl(quelle)}
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
  onLeer,
}: {
  src?: string | null;
  alt: string;
  platzhalter?: string;
  variante?: "ort" | "portraet" | "titel";
  /** Meldet, ob gerade nur der Platzhalter zu sehen ist. */
  onLeer?: (leer: boolean) => void;
}) {
  const { daten } = useAdmin();
  const [fehlt, setFehlt] = useState(false);
  const quelle = bildQuelle(daten, src);

  useEffect(() => setFehlt(false), [quelle]);

  const leer = !quelle || fehlt;
  useEffect(() => onLeer?.(leer), [leer, onLeer]);

  return (
    <div className={`szene szene-${variante}`} aria-hidden>
      {!leer ? (
        <NextImage
          src={quelle}
          alt=""
          fill
          // Vollbild - und die Szene ist immer als Erstes zu sehen.
          sizes="100vw"
          priority
          unoptimized={istDataUrl(quelle)}
          onError={() => setFehlt(true)}
          draggable={false}
        />
      ) : (
        <div className="szene-platzhalter">{platzhalter ?? alt}</div>
      )}
      <div className="szene-verlauf" />
    </div>
  );
}
