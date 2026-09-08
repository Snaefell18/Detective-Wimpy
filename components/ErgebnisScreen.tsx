"use client";

import { useEffect, useState } from "react";
import { Szene } from "./Bild";
import { laeuft, spiele, stoppe } from "@/lib/introAudio";
import type { Character } from "@/lib/types";
import type { Ergebnis } from "@/lib/useGame";

export function ErgebnisScreen({
  ergebnis,
  besetzung,
  onNeuerFall,
  onHauptmenue,
  onWeiter,
  weiterText,
  laedt,
}: {
  ergebnis: Ergebnis;
  besetzung: Character[];
  onNeuerFall: () => void;
  /** In einer Saga: weiter zum nächsten Kapitel statt zu einem neuen Fall. */
  onWeiter?: () => void;
  weiterText?: string;
  /** Zurück zum Startbildschirm, ohne gleich einen neuen Fall zu starten. */
  onHauptmenue: () => void;
  laedt: boolean;
}) {
  const taeter = besetzung.find((c) => c.id === ergebnis.taeterId);
  const beschuldigt = besetzung.find((c) => c.id === ergebnis.beschuldigtId);

  // Blockiert der Browser den Ton trotz Freigabe, kommt hier ein Knopf.
  const [tonBlockiert, setTonBlockiert] = useState(false);

  // Gelöster Fall: Siegermusik. Sie hört auf, wenn der Bildschirm verschwindet.
  useEffect(() => {
    let sichtbar = true;
    if (ergebnis.richtig) {
      void spiele("jubel").then((geklappt) => {
        if (sichtbar) setTonBlockiert(!geklappt);
      });
    }
    return () => {
      sichtbar = false;
      stoppe();
    };
  }, [ergebnis.richtig]);

  return (
    <div className="ergebnis">
      <Szene
        src={taeter?.bild}
        alt={taeter?.name ?? ""}
        platzhalter={taeter?.name}
        variante="portraet"
      />

      <div className="scroll">
        <div className="inhalt ergebnis-inhalt einblenden">
          <h1 className="ergebnis-titel" data-richtig={ergebnis.richtig}>
            {ergebnis.richtig ? "Fall gelöst!" : "Daneben!"}
          </h1>

          <p className="ergebnis-name">
            Der Täter war <strong>{taeter?.name}</strong> ({taeter?.tierart})
          </p>

          {tonBlockiert && !laeuft("jubel") && (
            <button
              className="knopf dezent schmal"
              onClick={() => void spiele("jubel").then((ok) => setTonBlockiert(!ok))}
            >
              Musik anmachen
            </button>
          )}

          <h2 className="abschnitt">Die Auflösung</h2>
          <p className="fliesstext">{ergebnis.aufloesung}</p>

          <h2 className="abschnitt">{beschuldigt?.name} sagt</h2>
          <p className="fliesstext zitat">„{ergebnis.reaktion}“</p>

          {onWeiter ? (
            <button className="knopf aktion" onClick={onWeiter}>
              {weiterText ?? "Weiter ›"}
            </button>
          ) : (
            <button className="knopf aktion" onClick={onNeuerFall} disabled={laedt}>
              {laedt ? "Neuer Fall wird ausgeheckt …" : "Nächster Fall"}
            </button>
          )}

          <button
            className="knopf dezent"
            style={{ marginTop: 10 }}
            onClick={onHauptmenue}
            disabled={laedt}
          >
            Zum Hauptmenü
          </button>
        </div>
      </div>
    </div>
  );
}
