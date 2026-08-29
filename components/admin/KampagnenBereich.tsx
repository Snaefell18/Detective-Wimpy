"use client";

import { useEffect, useState } from "react";
import { Bild } from "@/components/Bild";
import { useAdmin } from "@/lib/adminStore";
import { alsStaedte } from "@/lib/csv";
import { ladeKampagnen, loescheKampagne, speichereKampagne } from "@/lib/db";
import { useStammdaten } from "@/lib/stammdaten";
import {
  STANDARD_VORGABEN,
  type Kampagne,
  type PublicCase,
  type Vorgaben,
} from "@/lib/types";
import type { BereichProps } from "./typen";

const SCHWIERIGKEITEN: { id: Vorgaben["schwierigkeit"]; label: string }[] = [
  { id: "leicht", label: "Leicht" },
  { id: "mittel", label: "Mittel" },
  { id: "knifflig", label: "Knifflig" },
];

/**
 * Fälle vorbereiten: Sie werden einmal erzeugt und in der Datenbank abgelegt.
 * Danach starten sie sofort - ohne weiteren Modellaufruf.
 */
export function KampagnenBereich({ onMeldung, onFehler }: BereichProps) {
  const stammdaten = useStammdaten();
  const { daten: admin } = useAdmin();
  const [kampagnen, setKampagnen] = useState<Kampagne[] | null>(null);
  const [vorgaben, setVorgaben] = useState<Vorgaben>(STANDARD_VORGABEN);
  const [name, setName] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  const staedte = alsStaedte(stammdaten.orte);
  const verdaechtige = stammdaten.charaktere.filter((c) => !c.istDetektiv);

  const laden = () =>
    ladeKampagnen()
      .then(({ daten, ausCache }) => {
        setKampagnen(daten);
        if (ausCache && daten.length === 0) {
          onFehler("Keine Verbindung zur Datenbank - gespeicherte Kampagnen fehlen hier.");
        }
      })
      .catch(() => {
        setKampagnen([]);
        onFehler("Die Kampagnen konnten nicht geladen werden.");
      });

  useEffect(() => {
    void laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const umschalten = (feld: "charaktere" | "items", id: string) =>
    setVorgaben((alt) => ({
      ...alt,
      [feld]: alt[feld].includes(id)
        ? alt[feld].filter((x) => x !== id)
        : [...alt[feld], id],
    }));

  const erzeugen = async () => {
    setLaeuft(true);
    onFehler(null);
    try {
      const antwort = await fetch("/api/case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          charaktere: stammdaten.charaktere,
          orte: stammdaten.orte,
          einstellungen: admin.einstellungen,
          vorgaben,
        }),
      });
      const daten = (await antwort.json()) as
        | { fall: PublicCase; siegel: string }
        | { fehler: string };

      if (!antwort.ok || "fehler" in daten) {
        onFehler("fehler" in daten ? daten.fehler : "Der Fall konnte nicht erzeugt werden.");
        return;
      }

      const kampagne: Kampagne = {
        id: daten.fall.id,
        name: name.trim() || daten.fall.titel,
        fall: daten.fall,
        siegel: daten.siegel,
        vorgaben,
        erstelltAm: Date.now(),
      };

      await speichereKampagne(kampagne);
      setName("");
      await laden();
      onMeldung(`„${kampagne.name}“ gespeichert - startet ab jetzt sofort.`);
    } catch (fehler) {
      onFehler(
        fehler instanceof Error ? fehler.message : "Der Fall konnte nicht erzeugt werden.",
      );
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <>
      <p className="leise">
        Ein vorbereiteter Fall wird einmal erzeugt und in der Datenbank
        gespeichert. Im Spiel steht er unter „Kampagnen“ und startet ohne
        Wartezeit - das spart bei jedem weiteren Spielen den Modellaufruf.
      </p>

      <h2 className="abschnitt">Neuen Fall vorbereiten</h2>

      <label className="feld">
        <span className="leise">Name der Kampagne (leer = Titel des Falls)</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Die Sache mit der Gondel"
          maxLength={80}
        />
      </label>

      <label className="feld">
        <span className="leise">Thema / Wünsche</span>
        <textarea
          rows={3}
          value={vorgaben.thema}
          onChange={(e) => setVorgaben({ ...vorgaben, thema: e.target.value })}
          placeholder="z.B. Ein Streich beim Karneval, bei dem eine Maske verschwindet"
          maxLength={400}
        />
      </label>

      <h3 className="unter-abschnitt">Stadt</h3>
      <div className="wahl-reihe umbrechend">
        <button
          className="wahl-chip"
          data-aktiv={vorgaben.stadt === "zufall"}
          onClick={() => setVorgaben({ ...vorgaben, stadt: "zufall" })}
        >
          <strong>Zufall</strong>
        </button>
        {staedte.map((stadt) => (
          <button
            key={stadt.id}
            className="wahl-chip"
            data-aktiv={vorgaben.stadt === stadt.id}
            onClick={() => setVorgaben({ ...vorgaben, stadt: stadt.id })}
          >
            <strong>{stadt.name}</strong>
            <span className="leise">{stadt.orte.length} Orte</span>
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">
        Tiere <span className="leise">· keins gewählt = alle</span>
      </h3>
      <div className="marken-reihe">
        {verdaechtige.map((c) => (
          <button
            key={c.id}
            className="marke-knopf"
            data-aktiv={vorgaben.charaktere.includes(c.id)}
            onClick={() => umschalten("charaktere", c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">
        Dinge <span className="leise">· müssen als Spur vorkommen</span>
      </h3>
      <div className="marken-reihe">
        {stammdaten.items.map((i) => (
          <button
            key={i.id}
            className="marke-knopf"
            data-aktiv={vorgaben.items.includes(i.id)}
            onClick={() => umschalten("items", i.id)}
          >
            {i.name}
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">Täter</h3>
      <div className="marken-reihe">
        <button
          className="marke-knopf"
          data-aktiv={vorgaben.taeterId === ""}
          onClick={() => setVorgaben({ ...vorgaben, taeterId: "" })}
        >
          Zufällig
        </button>
        {verdaechtige.map((c) => (
          <button
            key={c.id}
            className="marke-knopf"
            data-aktiv={vorgaben.taeterId === c.id}
            onClick={() => setVorgaben({ ...vorgaben, taeterId: c.id })}
          >
            {c.name}
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">Schwierigkeit</h3>
      <div className="wahl-reihe">
        {SCHWIERIGKEITEN.map((s) => (
          <button
            key={s.id}
            className="wahl-chip"
            data-aktiv={vorgaben.schwierigkeit === s.id}
            onClick={() => setVorgaben({ ...vorgaben, schwierigkeit: s.id })}
          >
            <strong>{s.label}</strong>
          </button>
        ))}
      </div>

      <button
        className="knopf aktion"
        style={{ marginTop: 16 }}
        onClick={() => void erzeugen()}
        disabled={laeuft}
      >
        {laeuft ? "Der Fall wird ausgeheckt …" : "Fall erzeugen und speichern"}
      </button>

      <h2 className="abschnitt">
        Gespeicherte Kampagnen ({kampagnen?.length ?? 0})
      </h2>

      {kampagnen === null && <p className="leise">Wird geladen …</p>}

      <ul className="liste">
        {kampagnen?.map((k) => (
          <li key={k.id}>
            <div className="listen-bild">
              <Bild
                src={k.fall.orte[0]?.bild}
                alt={k.fall.stadt}
                platzhalter={k.fall.stadt}
              />
            </div>
            <div className="listen-text">
              <strong>{k.name}</strong>
              <span className="leise">
                {k.fall.stadt} · {k.fall.besetzung.length - 1} Verdächtige
              </span>
              <span className="leise klein">{k.fall.titel}</span>
            </div>
            <div className="listen-aktionen">
              <button
                className="knopf klein"
                onClick={async () => {
                  if (!window.confirm(`„${k.name}“ löschen?`)) return;
                  try {
                    await loescheKampagne(k.id);
                    await laden();
                    onMeldung("Kampagne gelöscht.");
                  } catch {
                    onFehler("Löschen fehlgeschlagen.");
                  }
                }}
              >
                Löschen
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
