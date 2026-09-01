"use client";

import { useEffect, useState } from "react";
import { alsStaedte } from "@/lib/csv";
import { DESIGNS, leseDesign, setzeDesign, type Design } from "@/lib/design";
import { useAdmin } from "@/lib/adminStore";
import { useStammdaten } from "@/lib/stammdaten";
import { SPEICHER_KEY } from "@/lib/useGame";
import { STANDARD_EINSTELLUNGEN, type Einstellungen } from "@/lib/types";
import type { BereichProps } from "./typen";

const TOENE: { id: Einstellungen["ton"]; label: string; hinweis: string }[] = [
  { id: "kindgerecht", label: "Kindgerecht", hinweis: "warm und witzig" },
  { id: "spannend", label: "Spannend", hinweis: "dicht wie ein Abendkrimi" },
  { id: "albern", label: "Albern", hinweis: "überdreht mit Wortwitz" },
];

export function SpielBereich({ onMeldung }: BereichProps) {
  const { daten, aendern } = useAdmin();
  // Das Design steht am <html>-Element; hier wird nur die Anzeige nachgeführt.
  const [design, setDesign] = useState<Design | null>(null);
  useEffect(() => setDesign(leseDesign()), []);
  const stammdaten = useStammdaten();
  const staedte = alsStaedte(stammdaten.orte);
  const e = daten.einstellungen;

  return (
    <>
      <h2 className="abschnitt">Design</h2>
      <p className="leise">
        Noir ist das neue Aussehen: fast schwarz, das Szenenbild großflächig
        dahinter, Messing als einziger Akzent. Klassisch ist das bisherige
        Aussehen - es bleibt vollständig erhalten und ist mit einem Klick zurück.
      </p>
      <div className="wahl-reihe">
        {DESIGNS.map((d) => (
          <button
            key={d.id}
            className="wahl-chip"
            data-aktiv={design === d.id}
            onClick={() => {
              setzeDesign(d.id);
              setDesign(d.id);
              onMeldung(`Design „${d.label}“ ist aktiv.`);
            }}
          >
            <strong>{d.label}</strong>
            <span className="leise">{d.hinweis}</span>
          </button>
        ))}
      </div>

      <h2 className="abschnitt">Erzählton</h2>
      <div className="wahl-reihe">
        {TOENE.map((ton) => (
          <button
            key={ton.id}
            className="wahl-chip"
            data-aktiv={e.ton === ton.id}
            onClick={() => aendern({ einstellungen: { ...e, ton: ton.id } })}
          >
            <strong>{ton.label}</strong>
            <span className="leise">{ton.hinweis}</span>
          </button>
        ))}
      </div>

      <h2 className="abschnitt">Stadt</h2>
      <div className="wahl-reihe umbrechend">
        <button
          className="wahl-chip"
          data-aktiv={e.stadt === "zufall"}
          onClick={() => aendern({ einstellungen: { ...e, stadt: "zufall" } })}
        >
          <strong>Zufall</strong>
          <span className="leise">jedes Mal neu</span>
        </button>
        {staedte.map((stadt) => (
          <button
            key={stadt.id}
            className="wahl-chip"
            data-aktiv={e.stadt === stadt.id}
            onClick={() => aendern({ einstellungen: { ...e, stadt: stadt.id } })}
          >
            <strong>{stadt.name}</strong>
            <span className="leise">{stadt.orte.length} Orte</span>
          </button>
        ))}
      </div>

      <h2 className="abschnitt">Schauplätze pro Fall</h2>
      <Schieber
        wert={e.ortsAnzahl}
        min={3}
        max={8}
        einheit="Orte"
        onAendern={(ortsAnzahl) => aendern({ einstellungen: { ...e, ortsAnzahl } })}
      />

      <h2 className="abschnitt">Intro</h2>
      <button
        className="knopf"
        onClick={() => aendern({ einstellungen: { ...e, intro: !e.intro } })}
      >
        Prolog und Titelmusik: {e.intro ? "an" : "aus"}
      </button>
      <p className="leise">
        Vor jeder Runde spricht der Prolog, danach läuft der Titelsong, während
        Fall, Verdächtige und Schauplätze vorgestellt werden.
      </p>

      <h2 className="abschnitt">Beschuldigungen pro Fall</h2>
      <Schieber
        wert={e.beschuldigungen}
        min={1}
        max={5}
        einheit="Versuche"
        onAendern={(beschuldigungen) =>
          aendern({ einstellungen: { ...e, beschuldigungen } })
        }
      />

      <h2 className="abschnitt">Startverdacht</h2>
      <Schieber
        wert={e.startverdacht}
        min={0}
        max={80}
        schritt={5}
        einheit="%"
        onAendern={(startverdacht) =>
          aendern({ einstellungen: { ...e, startverdacht } })
        }
      />

      <h2 className="abschnitt">Zurücksetzen</h2>
      <button
        className="knopf"
        onClick={() => {
          aendern({ einstellungen: STANDARD_EINSTELLUNGEN });
          onMeldung("Einstellungen auf Standard zurückgesetzt.");
        }}
      >
        Einstellungen zurücksetzen
      </button>
      <button
        className="knopf"
        style={{ marginTop: 10 }}
        onClick={() => {
          if (!window.confirm("Laufenden Fall und alle Notizen löschen?")) return;
          window.localStorage.removeItem(SPEICHER_KEY);
          onMeldung("Spielstand gelöscht.");
        }}
      >
        Spielstand löschen
      </button>

      <p className="leise" style={{ marginTop: 18 }}>
        Im Spiel: {stammdaten.charaktere.length} Tiere, {staedte.length} Städte mit{" "}
        {stammdaten.orte.length} Orten, {stammdaten.items.length} Dinge.{" "}
        {Object.keys(daten.bilder).length} eigene Bilder auf diesem Gerät.
      </p>
    </>
  );
}

function Schieber({
  wert,
  min,
  max,
  schritt = 1,
  einheit,
  onAendern,
}: {
  wert: number;
  min: number;
  max: number;
  schritt?: number;
  einheit: string;
  onAendern: (wert: number) => void;
}) {
  return (
    <div className="schieber">
      <input
        type="range"
        min={min}
        max={max}
        step={schritt}
        value={wert}
        onChange={(e) => onAendern(Number(e.target.value))}
      />
      <span className="schieber-wert">
        {wert} {einheit}
      </span>
    </div>
  );
}
