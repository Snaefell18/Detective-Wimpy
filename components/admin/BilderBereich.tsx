"use client";

import { useMemo, useRef, useState } from "react";
import { Bild } from "@/components/Bild";
import { useAdmin } from "@/lib/adminStore";
import { alsDataUrl, groesse } from "@/lib/bildUpload";
import { alsStaedte } from "@/lib/csv";
import { useStammdaten } from "@/lib/stammdaten";
import type { BereichProps } from "./typen";

/**
 * Bilder. Der dauerhafte Weg führt über den Ordner public/ im Projekt; hier
 * lassen sich Bilder zum Ausprobieren direkt vom Gerät hinterlegen. Sie landen
 * im Browser-Speicher, nicht in der Datenbank (dort dürfen Dokumente nur 1 MB
 * groß sein, und ausgeliefert werden Bilder ohnehin aus public/).
 */
export function BilderBereich({ onMeldung, onFehler }: BereichProps) {
  const { daten, aendern } = useAdmin();
  const stammdaten = useStammdaten();
  const [aktiverPfad, setAktiverPfad] = useState<string | null>(null);
  const dateiRef = useRef<HTMLInputElement>(null);

  const gruppen = useMemo(
    () => [
      {
        titel: "Startbildschirm",
        ordner: "public",
        posten: [{ pfad: "/start.png", name: "Titelbild" }],
      },
      {
        titel: "Tiere",
        ordner: "public/charaktere",
        posten: stammdaten.charaktere.map((c) => ({ pfad: c.bild, name: c.name })),
      },
      ...alsStaedte(stammdaten.orte).map((stadt) => ({
        titel: `Orte · ${stadt.name}`,
        ordner: "public/orte",
        posten: stadt.orte.map((o) => ({ pfad: o.bild, name: o.name })),
      })),
      {
        titel: "Dinge",
        ordner: "public/items",
        posten: stammdaten.items.map((i) => ({ pfad: i.bild, name: i.name })),
      },
    ],
    [stammdaten],
  );

  const hochladen = async (datei: File) => {
    if (!aktiverPfad) return;
    onFehler(null);
    try {
      const dataUrl = await alsDataUrl(datei);
      const ergebnis = aendern({ bilder: { ...daten.bilder, [aktiverPfad]: dataUrl } });
      if (ergebnis.fehler) onFehler(ergebnis.fehler);
      else onMeldung(`Bild hinterlegt (${groesse(dataUrl)}).`);
    } catch (fehler) {
      onFehler(
        fehler instanceof Error ? fehler.message : "Bild konnte nicht geladen werden.",
      );
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
        kannst du hier eines vom Gerät wählen - es wird verkleinert und bleibt
        nur in diesem Browser.
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

      {gruppen.map((gruppe) => (
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
                      <button className="knopf klein" onClick={() => entfernen(posten.pfad)}>
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
