"use client";

import { useState } from "react";

/**
 * Das Video vor einem Erzählerteil.
 *
 * Videos werden nicht hochgeladen, sondern liegen im Projekt unter
 * /public/video - eine Datei dort abgelegt, den Pfad hier eingetragen,
 * fertig. Leer heißt: kein Video. Das ist der Normalfall.
 *
 * Zur Kontrolle lässt sich die Datei hier ansehen; im Spiel läuft sie
 * bildschirmfüllend.
 */
export function VideoFeld({
  wert,
  onAendern,
  beschriftung = "Video davor (leer = kein Video)",
}: {
  wert: string;
  onAendern: (wert: string) => void;
  beschriftung?: string;
}) {
  const [vorschau, setVorschau] = useState(false);
  const pfad = wert.trim();

  return (
    <div className="video-feld">
      <label className="feld">
        <span className="leise">{beschriftung}</span>
        <input
          value={wert}
          onChange={(e) => onAendern(e.target.value)}
          placeholder="/video/kapitel-1.mp4"
          maxLength={200}
        />
      </label>

      {pfad && (
        <>
          <div className="knopf-reihe">
            <button className="knopf klein" onClick={() => setVorschau((an) => !an)}>
              {vorschau ? "Vorschau zu" : "▶ Vorschau"}
            </button>
            <button
              className="knopf klein"
              onClick={() => {
                setVorschau(false);
                onAendern("");
              }}
            >
              Video entfernen
            </button>
          </div>
          {vorschau && (
            <video className="video-vorschau" src={pfad} controls playsInline preload="metadata" />
          )}
        </>
      )}
    </div>
  );
}
