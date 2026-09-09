"use client";

import { useEffect, useState } from "react";
import { Bild } from "./Bild";
import { ladeZubehoer } from "@/lib/db";
import {
  VERITASERUM,
  wirkungVon,
  yen,
  type Zubehoer,
} from "@/lib/zubehoer";

/**
 * Der Detektiv-Laden.
 *
 * Was hier steht, kommt aus der Datenbank und lässt sich im Admin-Menü
 * anlegen. Das Veritaserum ist immer dabei - so ist der Laden nie leer, auch
 * bevor jemand etwas angelegt hat; sobald es unter demselben Namen in der
 * Datenbank steht, gewinnt der Eintrag von dort.
 *
 * Gekauft wird von dem, was Wimpy verdient hat. Was er kauft, liegt auf dem
 * Gerät und wandert ins Inventar - im Gespräch ist es einen Fingertipp weit
 * entfernt.
 */
export function ShopScreen({
  yenImBeutel,
  vorrat,
  onKaufen,
  onSchliessen,
}: {
  yenImBeutel: number;
  vorrat: Record<string, number>;
  /** Gibt zurück, ob der Kauf geklappt hat. */
  onKaufen: (stueck: Zubehoer) => boolean;
  onSchliessen: () => void;
}) {
  const [regal, setRegal] = useState<Zubehoer[] | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  useEffect(() => {
    let sichtbar = true;

    // Ohne Verbindung antwortet die Datenbank erst nach vielen Sekunden -
    // solange soll niemand vor einem leeren Regal stehen. Nach kurzer Zeit
    // steht deshalb wenigstens das Serum da; kommt die Antwort später doch
    // noch, ersetzt sie es.
    const notregal = window.setTimeout(() => {
      if (sichtbar) setRegal((alt) => alt ?? [VERITASERUM]);
    }, 4000);

    void ladeZubehoer()
      .then(({ daten }) => {
        if (!sichtbar) return;
        const eigene = daten.filter((s) => !s.versteckt);
        window.clearTimeout(notregal);
        const mitSerum = eigene.some((s) => s.id === VERITASERUM.id)
          ? eigene
          : [VERITASERUM, ...eigene];
        setRegal(mitSerum.sort((a, b) => a.preis - b.preis));
      })
      .catch(() => {
        // Ohne Verbindung steht wenigstens das Serum im Regal.
        if (sichtbar) setRegal([VERITASERUM]);
      });
    return () => {
      sichtbar = false;
      window.clearTimeout(notregal);
    };
  }, []);

  const kaufen = (stueck: Zubehoer) => {
    if (onKaufen(stueck)) {
      setMeldung(`${stueck.name} gekauft. Es liegt jetzt in deiner Tasche.`);
    } else {
      setMeldung(`Dafür fehlen ${yen(stueck.preis - yenImBeutel)}.`);
    }
  };

  return (
    <div className="overlay einblenden">
      <header className="kopf">
        <button className="zurueck" onClick={onSchliessen} aria-label="Zurück">
          ‹
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>Detektiv-Zubehör</h1>
          <p className="unterzeile">Im Beutel: {yen(yenImBeutel)}</p>
        </div>
      </header>

      <div className="scroll">
        <div className="inhalt">
          {meldung && <p className="hinweis erfolg">{meldung}</p>}

          {regal === null && <p className="leise">Der Laden schließt gerade auf …</p>}

          {regal?.length === 0 && (
            <p className="leise">Heute ist nichts im Regal. Schau später wieder vorbei.</p>
          )}

          {regal?.map((stueck) => {
            const habe = vorrat[stueck.id] ?? 0;
            const reicht = yenImBeutel >= stueck.preis;
            const wirkung = wirkungVon(stueck.wirkung);
            return (
              <div key={stueck.id} className="laden-stueck">
                <div className="laden-bild">
                  <Bild src={stueck.bild} alt={stueck.name} platzhalter={stueck.name} />
                </div>
                <div className="laden-text">
                  <div className="laden-kopf">
                    <strong>{stueck.name}</strong>
                    <span className="laden-preis">{yen(stueck.preis)}</span>
                  </div>
                  <p className="fliesstext">{stueck.beschreibung}</p>
                  {wirkung && (
                    <p className="leise klein laden-wirkung">
                      {wirkung.label} · {wirkung.hinweis}
                    </p>
                  )}
                  <div className="knopf-reihe">
                    <button
                      className="knopf aktion klein"
                      disabled={!reicht}
                      onClick={() => kaufen(stueck)}
                    >
                      {reicht ? "Kaufen" : "Zu teuer"}
                    </button>
                    {habe > 0 && <span className="laden-habe">{habe}× in der Tasche</span>}
                  </div>
                </div>
              </div>
            );
          })}

          <p className="leise klein">
            Verdient wird im Dienst: 100 ¥ für jeden gelösten Fall, 500 ¥ für eine
            ganze Saga.
          </p>
        </div>
      </div>
    </div>
  );
}
