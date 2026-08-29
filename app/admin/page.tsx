"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Bild } from "@/components/Bild";
import { aktuelleCharaktere, useAdmin } from "@/lib/adminStore";
import { alsDataUrl, groesse } from "@/lib/bildUpload";
import { CHARACTERS } from "@/lib/characters";
import { parseCharacterCsv, pruefeBesetzung } from "@/lib/csv";
import { ITEMS } from "@/lib/items";
import { LOCATIONS } from "@/lib/locations";
import { STANDARD_EINSTELLUNGEN, type Einstellungen } from "@/lib/types";

type Bereich = "charaktere" | "bilder" | "einstellungen";

const TOENE: { id: Einstellungen["ton"]; label: string; hinweis: string }[] = [
  { id: "kindgerecht", label: "Kindgerecht", hinweis: "warm und witzig" },
  { id: "spannend", label: "Spannend", hinweis: "dicht wie ein Abendkrimi" },
  { id: "albern", label: "Albern", hinweis: "überdreht mit Wortwitz" },
];

export default function AdminSeite() {
  const { daten, aendern } = useAdmin();
  const [bereich, setBereich] = useState<Bereich>("charaktere");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const charaktere = aktuelleCharaktere(daten);

  const melden = (text: string) => {
    setFehler(null);
    setMeldung(text);
    window.setTimeout(() => setMeldung(null), 4000);
  };

  return (
    <main className="app admin">
      <header className="kopf">
        <Link href="/" className="zurueck" aria-label="Zurück zum Spiel">
          ‹
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>Admin</h1>
          <p className="unterzeile">Charaktere, Bilder und Einstellungen</p>
        </div>
      </header>

      <div className="reiter">
        {(["charaktere", "bilder", "einstellungen"] as Bereich[]).map((id) => (
          <button
            key={id}
            data-aktiv={bereich === id}
            onClick={() => setBereich(id)}
          >
            {id === "charaktere" ? "Charaktere" : id === "bilder" ? "Bilder" : "Spiel"}
          </button>
        ))}
      </div>

      <div className="scroll">
        <div className="inhalt">
          {meldung && <p className="hinweis erfolg">{meldung}</p>}
          {fehler && <p className="fehler">{fehler}</p>}

          {bereich === "charaktere" && (
            <CharaktereBereich
              onMeldung={melden}
              onFehler={setFehler}
            />
          )}

          {bereich === "bilder" && <BilderBereich onMeldung={melden} onFehler={setFehler} />}

          {bereich === "einstellungen" && (
            <>
              <h2 className="abschnitt">Erzählton</h2>
              <div className="wahl-reihe">
                {TOENE.map((ton) => (
                  <button
                    key={ton.id}
                    className="wahl-chip"
                    data-aktiv={daten.einstellungen.ton === ton.id}
                    onClick={() =>
                      aendern({
                        einstellungen: { ...daten.einstellungen, ton: ton.id },
                      })
                    }
                  >
                    <strong>{ton.label}</strong>
                    <span className="leise">{ton.hinweis}</span>
                  </button>
                ))}
              </div>

              <h2 className="abschnitt">Beschuldigungen pro Fall</h2>
              <Schieber
                wert={daten.einstellungen.beschuldigungen}
                min={1}
                max={5}
                einheit="Versuche"
                onAendern={(wert) =>
                  aendern({
                    einstellungen: { ...daten.einstellungen, beschuldigungen: wert },
                  })
                }
              />

              <h2 className="abschnitt">Startverdacht</h2>
              <Schieber
                wert={daten.einstellungen.startverdacht}
                min={0}
                max={80}
                schritt={5}
                einheit="%"
                onAendern={(wert) =>
                  aendern({
                    einstellungen: { ...daten.einstellungen, startverdacht: wert },
                  })
                }
              />
              <p className="leise">
                Mit welchem Verdachtswert jeder Verdächtige in den Fall startet.
              </p>

              <h2 className="abschnitt">Zurücksetzen</h2>
              <button
                className="knopf"
                onClick={() => {
                  aendern({ einstellungen: STANDARD_EINSTELLUNGEN });
                  melden("Einstellungen auf Standard zurückgesetzt.");
                }}
              >
                Einstellungen zurücksetzen
              </button>
              <button
                className="knopf"
                style={{ marginTop: 10 }}
                onClick={() => {
                  if (!window.confirm("Laufenden Fall und alle Notizen löschen?")) return;
                  window.localStorage.removeItem("detective-wimpy:v1");
                  melden("Spielstand gelöscht.");
                }}
              >
                Spielstand löschen
              </button>

              <p className="leise" style={{ marginTop: 18 }}>
                Aktuell im Spiel: {charaktere.length} Charaktere,{" "}
                {LOCATIONS.length} Orte, {ITEMS.length} Gegenstände,{" "}
                {Object.keys(daten.bilder).length} eigene Bilder auf diesem Gerät.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

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

function CharaktereBereich({
  onMeldung,
  onFehler,
}: {
  onMeldung: (text: string) => void;
  onFehler: (text: string | null) => void;
}) {
  const { daten, aendern } = useAdmin();
  const dateiRef = useRef<HTMLInputElement>(null);
  const charaktere = aktuelleCharaktere(daten);
  const eigene = daten.charaktere !== null;

  const einlesen = async (datei: File) => {
    onFehler(null);
    try {
      const geparst = parseCharacterCsv(await datei.text());
      const problem = pruefeBesetzung(geparst);
      if (problem) {
        onFehler(problem);
        return;
      }
      const ergebnis = aendern({ charaktere: geparst });
      if (ergebnis.fehler) onFehler(ergebnis.fehler);
      else onMeldung(`${geparst.length} Charaktere eingelesen.`);
    } catch {
      onFehler("Die Datei konnte nicht gelesen werden.");
    }
  };

  return (
    <>
      <p className="leise">
        Die Tabelle aus Excel als CSV speichern (Semikolon-getrennt) und hier
        einlesen. Sie gilt sofort für den nächsten Fall - nur auf diesem Gerät.
      </p>

      <input
        ref={dateiRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        hidden
        onChange={(e) => {
          const datei = e.target.files?.[0];
          if (datei) void einlesen(datei);
          e.target.value = "";
        }}
      />

      <button className="knopf aktion" onClick={() => dateiRef.current?.click()}>
        CSV einlesen
      </button>

      {eigene && (
        <button
          className="knopf"
          style={{ marginTop: 10 }}
          onClick={() => {
            aendern({ charaktere: null });
            onMeldung(`Zurück zu den ${CHARACTERS.length} Charakteren aus dem Projekt.`);
          }}
        >
          Eigene Liste verwerfen
        </button>
      )}

      <h2 className="abschnitt">
        Besetzung ({charaktere.length}){eigene ? " · eigene Liste" : " · aus dem Projekt"}
      </h2>

      <ul className="liste">
        {charaktere.map((c) => (
          <li key={c.id}>
            <div className="listen-bild">
              <Bild src={c.bild} alt={c.name} platzhalter={c.name} />
            </div>
            <div className="listen-text">
              <strong>
                {c.name}{" "}
                {c.istDetektiv && <span className="marke">Detektiv</span>}
              </strong>
              <span className="leise">
                {c.tierart}, {c.alter} J. · Kriminalität {c.stats.kriminalitaetslevel}/10
              </span>
              <span className="leise pfad">{c.bild}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function BilderBereich({
  onMeldung,
  onFehler,
}: {
  onMeldung: (text: string) => void;
  onFehler: (text: string | null) => void;
}) {
  const { daten, aendern } = useAdmin();
  const [aktiverPfad, setAktiverPfad] = useState<string | null>(null);
  const dateiRef = useRef<HTMLInputElement>(null);

  const eintraege = useMemo(
    () => [
      {
        titel: "Charaktere",
        ordner: "public/charaktere",
        posten: aktuelleCharaktere(daten).map((c) => ({
          pfad: c.bild,
          name: c.name,
        })),
      },
      {
        titel: "Orte",
        ordner: "public/orte",
        posten: LOCATIONS.map((o) => ({ pfad: o.bild, name: o.name })),
      },
      {
        titel: "Gegenstände",
        ordner: "public/items",
        posten: ITEMS.map((i) => ({ pfad: i.bild, name: i.name })),
      },
    ],
    [daten],
  );

  const hochladen = async (datei: File) => {
    if (!aktiverPfad) return;
    onFehler(null);
    try {
      const dataUrl = await alsDataUrl(datei);
      const ergebnis = aendern({
        bilder: { ...daten.bilder, [aktiverPfad]: dataUrl },
      });
      if (ergebnis.fehler) onFehler(ergebnis.fehler);
      else onMeldung(`Bild hinterlegt (${groesse(dataUrl)}).`);
    } catch (error) {
      onFehler(error instanceof Error ? error.message : "Bild konnte nicht geladen werden.");
    } finally {
      setAktiverPfad(null);
    }
  };

  const entfernen = (pfad: string) => {
    const bilder = { ...daten.bilder };
    delete bilder[pfad];
    aendern({ bilder });
    onMeldung("Bild entfernt.");
  };

  return (
    <>
      <p className="leise">
        Dauerhaft gehören die Bilder ins Projekt: Datei mit dem angegebenen Namen
        in den passenden Ordner legen und einchecken. Zum schnellen Ausprobieren
        kannst du hier ein Bild direkt vom Gerät hinterlegen - es wird verkleinert
        und bleibt nur in diesem Browser.
      </p>

      <input
        ref={dateiRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const datei = e.target.files?.[0];
          if (datei) void hochladen(datei);
          e.target.value = "";
        }}
      />

      {eintraege.map((gruppe) => (
        <div key={gruppe.titel}>
          <h2 className="abschnitt">
            {gruppe.titel} <span className="leise">· {gruppe.ordner}</span>
          </h2>

          <ul className="liste">
            {gruppe.posten.map((posten) => {
              const eigenes = Boolean(daten.bilder[posten.pfad]);
              return (
                <li key={posten.pfad}>
                  <div className="listen-bild">
                    <Bild src={posten.pfad} alt={posten.name} platzhalter={posten.name} />
                  </div>
                  <div className="listen-text">
                    <strong>{posten.name}</strong>
                    <span className="leise pfad">
                      {posten.pfad.split("/").pop()}
                      {eigenes ? " · eigenes Bild" : ""}
                    </span>
                  </div>
                  <div className="listen-aktionen">
                    <button
                      className="knopf klein"
                      onClick={() => {
                        setAktiverPfad(posten.pfad);
                        dateiRef.current?.click();
                      }}
                    >
                      {eigenes ? "Ersetzen" : "Wählen"}
                    </button>
                    {eigenes && (
                      <button
                        className="knopf klein"
                        onClick={() => entfernen(posten.pfad)}
                      >
                        Entfernen
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}
