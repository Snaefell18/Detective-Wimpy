"use client";

import { useState } from "react";
import { Bild, Szene } from "./Bild";
import { FundMoment } from "./FundMoment";
import { Wetter, lageFuer } from "./Wetter";
import { useAdmin } from "@/lib/adminStore";
import { findeOrt } from "@/lib/locations";
import type { Character, PublicCase } from "@/lib/types";
import type { Fund } from "@/lib/useGame";

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
  onUmsehen: () => Promise<Fund | null>;
  suchtGerade: boolean;
}) {
  const [fundText, setFundText] = useState<string | null>(null);
  /** Der kurze Moment über dem Ort, wenn wirklich etwas gefunden wurde. */
  const [moment, setMoment] = useState<Fund | null>(null);
  const { daten: admin } = useAdmin();
  const ort = findeOrt(fall.orte, ortId);
  const verdaechtige: Character[] = fall.besetzung.filter((c) => !c.istDetektiv);
  const anwesend = verdaechtige.filter((c) => fall.aufenthalt[c.id] === ortId);

  const umsehen = async () => {
    setFundText(null);
    const fund = await onUmsehen();
    if (!fund) return;
    // Ein Fund bekommt seinen Moment; wer nichts findet, liest nur die Zeile.
    if (fund.spur) setMoment(fund);
    else setFundText(fund.text);
  };

  return (
    <div className="ort-ansicht">
      {/* Der Ort füllt den ganzen Bildschirm, alles andere schwebt darüber. */}
      <Szene src={ort?.bild} alt={ort?.name ?? ortId} platzhalter="" />
      <Wetter lage={lageFuer(admin.einstellungen.wetter, fall.id)} />

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
                <span className="zeilen-meta">{c.tierart} · anwesend</span>
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

        <button className="knopf dezent umsehen" onClick={umsehen} disabled={suchtGerade}>
          <span className="symbol">🔍</span>
          <span className="zeilen-text">{suchtGerade ? "Wimpy sucht …" : "Umsehen"}</span>
          <span className="zeilen-meta">Spur möglich</span>
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

      {moment && (
        <FundMoment
          fund={moment}
          onFertig={() => {
            setFundText(moment.text);
            setMoment(null);
          }}
        />
      )}
    </div>
  );
}
