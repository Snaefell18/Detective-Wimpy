"use client";

import { useState } from "react";
import { Bild, Szene } from "./Bild";
import { postJson } from "@/lib/api";
import { spiele } from "@/lib/introAudio";
import {
  LEERER_VERHANDLUNGS_STAND,
  saalTexte,
  verhandlungsErgebnis,
  type Beweisstueck,
  type Verhandlung,
} from "@/lib/sagaFinale";
import type { Character } from "@/lib/types";

/**
 * Das Finale als Gerichtsverhandlung.
 *
 * Kein Fall mehr, kein Umsehen, kein Befragen: Wimpy hat alles, was er hat.
 * Er legt Stück für Stück vor, der Saal reagiert - und wer daneben greift,
 * verliert Boden. Drei tragende Stücke, dann spricht der Vorsitz das Urteil;
 * nach zu vielen Fehlgriffen platzt die Sache.
 *
 * Was trägt, weiß nur der Server: Jedes Vorlegen fragt bei /api/verhandlung
 * nach, die Antwort steht seit der Erzeugung im Siegel. Im Browser liegt
 * nichts, woraus sich die Lösung ablesen ließe.
 */
type Antwort = { traegt: boolean; reaktion: string };

export function Gerichtssaal({
  verhandlung,
  bogenSiegel,
  besetzung,
  frage,
  onFertig,
}: {
  verhandlung: Verhandlung;
  bogenSiegel: string;
  /** Alle Tiere der Saga - für Bilder und Namen. */
  besetzung: Character[];
  /** Steht groß über dem Saal. */
  frage: string;
  /** Die Verhandlung ist durch - mit oder ohne Schuldspruch. */
  onFertig: (geschafft: boolean) => void;
}) {
  const [stand, setStand] = useState(LEERER_VERHANDLUNGS_STAND);
  const [offen, setOffen] = useState<Beweisstueck | null>(null);
  const [antwort, setAntwort] = useState<(Antwort & { stueck: Beweisstueck }) | null>(null);
  const [urteil, setUrteil] = useState<{ text: string; geschafft: boolean } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const worte = saalTexte(verhandlung.art);
  const finde = (id: string) => besetzung.find((c) => c.id === id);
  const angeklagter = finde(verhandlung.angeklagterId);
  const richter = finde(verhandlung.richterId);

  /** Ein Stück auf den Tisch legen - der Server sagt, was es wert ist. */
  const vorlegen = async (stueck: Beweisstueck) => {
    if (laeuft) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const ergebnis = await postJson<Antwort>(
        "/api/verhandlung",
        { bogenSiegel, schritt: "vorlegen", beweisId: stueck.id },
        30,
      );
      const naechster = {
        gelegt: [...stand.gelegt, stueck.id],
        getroffen: stand.getroffen + (ergebnis.traegt ? 1 : 0),
        daneben: stand.daneben + (ergebnis.traegt ? 0 : 1),
      };
      setStand(naechster);
      setOffen(null);
      setAntwort({ ...ergebnis, stueck });

      const wie = verhandlungsErgebnis(naechster, verhandlung);
      if (wie !== "laeuft") await urteilHolen(wie === "gewonnen");
    } catch (grund) {
      setFehler(grund instanceof Error ? grund.message : "Das ging schief.");
    } finally {
      setLaeuft(false);
    }
  };

  /** Öhos Schlusswort - es steht seit der Erzeugung fest. */
  const urteilHolen = async (geschafft: boolean) => {
    try {
      const { text } = await postJson<{ text: string }>(
        "/api/verhandlung",
        { bogenSiegel, schritt: "urteil", geschafft },
        30,
      );
      setUrteil({ text, geschafft });
    } catch {
      // Ohne Netz endet die Verhandlung trotzdem - nur eben wortkarg.
      setUrteil({
        text: geschafft
          ? "Der Saal erhebt sich. Das Urteil steht."
          : "Der Vorsitz schließt die Akte. Mehr war heute nicht zu holen.",
        geschafft,
      });
    }
  };

  /* --- Das Urteil ---------------------------------------------------- */

  if (urteil) {
    return (
      <div className="saal urteil" data-geschafft={urteil.geschafft}>
        <Szene
          src={richter?.bild}
          alt={richter?.name ?? ""}
          platzhalter={richter?.name}
          variante="portraet"
        />
        <div className="saal-urteil-inhalt">
          <span className="intro-oberzeile">{richter?.name ?? "Der Vorsitz"} spricht</span>
          <h1 className="intro-logo slam">
            {urteil.geschafft ? worte.gewonnen : worte.verloren}
          </h1>
          <p className="saal-spruch">{urteil.text}</p>
          <button
            className="knopf gross pochen"
            onClick={() => {
              if (urteil.geschafft) void spiele("jubel");
              onFertig(urteil.geschafft);
            }}
          >
            Weiter ›
          </button>
        </div>
      </div>
    );
  }

  /* --- Was der Saal auf ein vorgelegtes Stück sagt -------------------- */

  if (antwort) {
    const gesicht = verhandlung.art === "ohne-taeter" ? richter : angeklagter;
    return (
      <div className="saal reaktion" data-traegt={antwort.traegt}>
        <Szene
          src={gesicht?.bild}
          alt={gesicht?.name ?? ""}
          platzhalter={gesicht?.name}
          variante="portraet"
        />
        <div className="reaktion-inhalt" data-zeigen="true">
          <span className="intro-oberzeile">{antwort.stueck.name}</span>
          <h1 className="intro-stadt slam">
            {antwort.traegt ? "Das sitzt." : "Das trägt nicht."}
          </h1>
          <p className="reaktion-satz">{antwort.reaktion}</p>
          <button className="knopf gross pochen" onClick={() => setAntwort(null)}>
            Weiter ›
          </button>
        </div>
      </div>
    );
  }

  /* --- Der Saal ------------------------------------------------------- */

  const offeneStuecke = verhandlung.beweise.filter((b) => !stand.gelegt.includes(b.id));

  return (
    <div className="saal">
      <header className="saal-kopf">
        <div className="saal-bank">
          <div className="saal-portraet gross">
            <Bild
              src={angeklagter?.bild}
              alt={angeklagter?.name ?? ""}
              platzhalter={angeklagter?.name}
              rund
              sofort
            />
          </div>
          <div>
            <span className="leise klein">Auf der Anklagebank</span>
            <h2>{angeklagter?.name ?? "—"}</h2>
          </div>
        </div>
        <div className="saal-vorsitz">
          <div className="saal-portraet">
            <Bild
              src={richter?.bild}
              alt={richter?.name ?? ""}
              platzhalter={richter?.name}
              rund
              sofort
            />
          </div>
          <span className="leise klein">Vorsitz · {richter?.name ?? "—"}</span>
        </div>
      </header>

      <h1 className="saal-frage">{frage}</h1>
      {verhandlung.anklage && <p className="saal-anklage">„{verhandlung.anklage}“</p>}

      <div className="saal-waage">
        <span>
          Tragend: <strong>{stand.getroffen}</strong> / {verhandlung.noetig}
        </span>
        <span className="saal-fehlgriffe">
          {Array.from({ length: verhandlung.fehlgriffe + 1 }, (_, i) => (
            <i key={i} data-weg={i < stand.daneben} />
          ))}
        </span>
      </div>

      <h3 className="unter-abschnitt">{worte.regal}</h3>
      <div className="saal-beweise">
        {offeneStuecke.map((stueck) => (
          <button
            key={stueck.id}
            className="saal-beweis"
            data-offen={offen?.id === stueck.id}
            onClick={() => setOffen(offen?.id === stueck.id ? null : stueck)}
          >
            <strong>{stueck.name}</strong>
            {stueck.herkunft && <span className="leise klein">{stueck.herkunft}</span>}
            {offen?.id === stueck.id && (
              <>
                <p className="saal-beweis-text">{stueck.text}</p>
                <span
                  className="knopf klein"
                  onClick={(ereignis) => {
                    ereignis.stopPropagation();
                    void vorlegen(stueck);
                  }}
                >
                  {laeuft ? "…" : `${worte.vorlegen} ›`}
                </span>
              </>
            )}
          </button>
        ))}
        {offeneStuecke.length === 0 && (
          <>
            <p className="leise">Mehr hast du nicht. Der Vorsitz wartet nicht ewig.</p>
            <button className="knopf" onClick={() => void urteilHolen(false)}>
              Schlusswort anhören ›
            </button>
          </>
        )}
      </div>

      {fehler && <p className="fehler">{fehler}</p>}
    </div>
  );
}
