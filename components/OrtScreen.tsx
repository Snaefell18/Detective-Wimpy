"use client";

import { useState } from "react";
import { Bild, Szene } from "./Bild";
import { findeOrt } from "@/lib/locations";
import type { Character, PublicCase } from "@/lib/types";

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
  const ort = findeOrt(fall.orte, ortId);
  const verdaechtige: Character[] = fall.besetzung.filter((c) => !c.istDetektiv);
  const anwesend = verdaechtige.filter((c) => fall.aufenthalt[c.id] === ortId);

  const umsehen = async () => {
    setFundText(null);
    const text = await onUmsehen();
    if (text) setFundText(text);
  };

  return (
    <div className="ort-ansicht">
      {/* Der Ort füllt den ganzen Bildschirm, alles andere schwebt darüber. */}
      <Szene src={ort?.bild} alt={ort?.name ?? ortId} platzhalter="" />

      <div className="ort-buehne">
        <div className="ort-titel">
          <span className="stadt-marke">{fall.stadt}</span>
          <h2>{ort?.name}</h2>
          <p>{ort?.atmosphaere}</p>
        </div>

        {anwesend.length > 0 && (
          <div className="figuren">
            {anwesend.map((c) => (
              <button key={c.id} className="figur" onClick={() => onCharakter(c.id)}>
                <div className="figur-bild">
                  <Bild src={c.bild} alt={c.name} platzhalter={c.name} />
                </div>
                <span className="figur-name">{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ort-fuss">
        {fundText && (
          <div className="fund einblenden" onClick={() => setFundText(null)}>
            {fundText}
          </div>
        )}

        {anwesend.length === 0 && !fundText && (
          <p className="ort-leer">Keine Menschenseele. Beziehungsweise Tierseele.</p>
        )}

        <button className="knopf aktion" onClick={umsehen} disabled={suchtGerade}>
          {suchtGerade ? "Wimpy sucht …" : "🔍 Umsehen"}
        </button>

        <div className="orte-leiste">
          {fall.orte.map((o) => {
            const dort = verdaechtige.filter((c) => fall.aufenthalt[c.id] === o.id).length;
            return (
              <button
                key={o.id}
                className="ort-chip"
                data-aktiv={o.id === ortId}
                onClick={() => onOrtWechsel(o.id)}
              >
                <div className="ort-chip-bild">
                  <Bild src={o.bild} alt={o.name} platzhalter="" rund />
                </div>
                <span>{o.name}</span>
                {dort > 0 && <span className="punkt">{dort}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
