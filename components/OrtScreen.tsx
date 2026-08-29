"use client";

import { useState } from "react";
import { Bild } from "./Bild";
import { SUSPECTS } from "@/lib/characters";
import { LOCATIONS, getLocation } from "@/lib/locations";
import type { PublicCase } from "@/lib/types";

export function OrtScreen({
  fall,
  ortId,
  onOrtWechsel,
  onCharakter,
  onUmsehen,
  suchtGerade,
}: {
  fall: PublicCase;
  ortId: string;
  onOrtWechsel: (id: string) => void;
  onCharakter: (id: string) => void;
  onUmsehen: () => Promise<string | null>;
  suchtGerade: boolean;
}) {
  const [fundText, setFundText] = useState<string | null>(null);
  const ort = getLocation(ortId);

  const anwesend = SUSPECTS.filter((c) => fall.aufenthalt[c.id] === ortId);

  const umsehen = async () => {
    setFundText(null);
    const text = await onUmsehen();
    if (text) setFundText(text);
  };

  return (
    <div className="inhalt einblenden">
      <div className="ort-bild">
        <Bild src={ort?.bild} alt={ort?.name ?? ortId} platzhalter={ort?.name} />
        <div className="ort-bild-text">
          <h2>{ort?.name}</h2>
          <p>{ort?.beschreibung}</p>
        </div>
      </div>

      <button className="knopf aktion" onClick={umsehen} disabled={suchtGerade}>
        {suchtGerade ? "Wimpy sucht …" : "🔍 Umsehen"}
      </button>

      {fundText && (
        <div className="karte fund einblenden">
          <p style={{ margin: 0 }}>{fundText}</p>
        </div>
      )}

      <h3 className="abschnitt">Hier anzutreffen</h3>
      {anwesend.length === 0 ? (
        <p className="leise">Keine Menschenseele. Beziehungsweise Tierseele.</p>
      ) : (
        <div className="charakter-reihe">
          {anwesend.map((c) => (
            <button key={c.id} className="charakter-kachel" onClick={() => onCharakter(c.id)}>
              <div className="charakter-bild">
                <Bild src={c.bild} alt={c.name} platzhalter={c.name} />
              </div>
              <span className="charakter-name">{c.name}</span>
              <span className="leise" style={{ fontSize: 12 }}>
                {c.tierart}
              </span>
            </button>
          ))}
        </div>
      )}

      <h3 className="abschnitt">Wohin als Nächstes?</h3>
      <div className="ort-liste">
        {LOCATIONS.map((o) => {
          const dort = SUSPECTS.filter((c) => fall.aufenthalt[c.id] === o.id).length;
          return (
            <button
              key={o.id}
              className="ort-kachel"
              data-aktiv={o.id === ortId}
              onClick={() => onOrtWechsel(o.id)}
            >
              <div className="ort-kachel-bild">
                <Bild src={o.bild} alt={o.name} platzhalter={o.name} />
              </div>
              <div className="ort-kachel-text">
                <strong>{o.name}</strong>
                <span className="leise">
                  {dort > 0 ? `${dort} anwesend` : "niemand da"}
                  {o.id === fall.tatort ? " · Tatort" : ""}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
