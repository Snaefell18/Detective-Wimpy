"use client";

import { useState } from "react";
import { BildFeld } from "./BildFeld";
import { speichereListe } from "@/lib/db";
import { erfindeStadt } from "@/lib/erfinden";
import { stammdatenAktualisieren } from "@/lib/stammdaten";
import { vervollstaendigen } from "@/lib/stammdatenIds";
import type { Location } from "@/lib/types";

/**
 * Eine ganze Stadt auf einmal: Name eingeben, erfinden lassen, ansehen.
 *
 * Fünf Schauplätze in einem Aufruf - einzeln wäre es fünfmal so teuer und
 * hätte fünfmal dieselbe Bäckerei ergeben, weil kein Vorschlag von den
 * anderen wüsste. Gespeichert wird erst am Schluss und nur, was man behalten
 * will: Jeder Ort lässt sich vorher ändern, bebildern oder wegwerfen.
 */
type Entwurf = {
  /** Nur für die Liste - die echte Id entsteht beim Speichern aus dem Namen. */
  nummer: number;
  name: string;
  atmosphaere: string;
  beschreibung: string;
  bild: string;
  /** Abgewählt heißt: wird nicht gespeichert. */
  dabei: boolean;
};

export function StadtErfinden({
  /** Städte, die es schon gibt - damit nichts doppelt kommt. */
  vorhandeneStaedte,
  onFertig,
  onAbbrechen,
  onMeldung,
  onFehler,
}: {
  vorhandeneStaedte: string[];
  onFertig: () => void;
  onAbbrechen: () => void;
  onMeldung: (text: string) => void;
  onFehler: (text: string | null) => void;
}) {
  const [wunschStadt, setWunschStadt] = useState("");
  const [wunsch, setWunsch] = useState("");
  const [anzahl, setAnzahl] = useState(5);
  const [laeuft, setLaeuft] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [stadt, setStadt] = useState("");
  const [entwuerfe, setEntwuerfe] = useState<Entwurf[] | null>(null);
  const [offen, setOffen] = useState<number | null>(null);

  const erfinden = async () => {
    setLaeuft(true);
    onFehler(null);
    try {
      const vorschlag = await erfindeStadt({
        stadt: wunschStadt.trim(),
        anzahl,
        vorhanden: vorhandeneStaedte,
        wunsch: wunsch.trim(),
      });
      setStadt(vorschlag.stadt);
      setEntwuerfe(
        vorschlag.orte.map((o, i) => ({
          nummer: i,
          name: o.name,
          atmosphaere: o.atmosphaere,
          beschreibung: o.beschreibung,
          bild: "",
          dabei: true,
        })),
      );
      setOffen(null);
    } catch (fehler) {
      onFehler(fehler instanceof Error ? fehler.message : "Das hat nicht geklappt.");
    } finally {
      setLaeuft(false);
    }
  };

  const aendern = (nummer: number, teil: Partial<Entwurf>) =>
    setEntwuerfe((alt) =>
      (alt ?? []).map((e) => (e.nummer === nummer ? { ...e, ...teil } : e)),
    );

  const gewaehlt = (entwuerfe ?? []).filter((e) => e.dabei && e.name.trim());

  const speichern = async () => {
    if (!gewaehlt.length || !stadt.trim()) return;
    setSpeichert(true);
    onFehler(null);
    try {
      /*
       * Die Ids entstehen mit derselben Funktion wie im Formular - alles
       * andere wäre eine zweite Wahrheit und irgendwann ein doppelter Ort.
       */
      const orte = gewaehlt.map(
        (e) =>
          vervollstaendigen("orte", {
            id: "",
            stadt: stadt.trim(),
            stadtId: "",
            name: e.name.trim(),
            atmosphaere: e.atmosphaere.trim(),
            beschreibung: e.beschreibung.trim(),
            bild: e.bild,
          } as Location) as Location,
      );

      await speichereListe("orte", orte);
      await stammdatenAktualisieren();
      onMeldung(
        `${orte.length} Schauplätze in ${stadt.trim()} gespeichert.`,
      );
      onFertig();
    } catch (fehler) {
      onFehler(
        fehler instanceof Error ? `Speichern fehlgeschlagen: ${fehler.message}` : "Speichern fehlgeschlagen.",
      );
    } finally {
      setSpeichert(false);
    }
  };

  return (
    <div className="kapitel-block">
      <h3 className="unter-abschnitt">
        Stadt erfinden{" "}
        <span className="leise">
          · ein Aufruf, {entwuerfe ? entwuerfe.length : anzahl} Schauplätze
        </span>
      </h3>

      {!entwuerfe && (
        <>
          <p className="leise klein">
            Ein Name genügt - alles Weitere denkt sich das Modell aus. Wer keinen
            eingibt, bekommt auch den Namen vorgeschlagen. Gespeichert wird erst,
            wenn dir gefällt, was dasteht.
          </p>

          <label className="feld">
            <span className="leise">Stadt · leer heißt: denk dir eine aus</span>
            <input
              value={wunschStadt}
              onChange={(e) => setWunschStadt(e.target.value)}
              placeholder="z.B. Kopenhagen, Muschelbach, Ravensfjord"
              maxLength={60}
            />
          </label>

          <label className="feld">
            <span className="leise">Wunsch · optional</span>
            <input
              value={wunsch}
              onChange={(e) => setWunsch(e.target.value)}
              placeholder="z.B. eine Hafenstadt im Winter, alles ein bisschen verschlafen"
              maxLength={400}
            />
          </label>

          <span className="leise klein">Wie viele Schauplätze</span>
          <div className="marken-reihe">
            {[3, 4, 5, 6, 7, 8].map((n) => (
              <button
                key={n}
                className="marke-knopf"
                data-aktiv={anzahl === n}
                onClick={() => setAnzahl(n)}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="knopf-reihe">
            <button className="knopf aktion" disabled={laeuft} onClick={() => void erfinden()}>
              {laeuft ? "Die Stadt entsteht …" : "✨ Stadt erfinden"}
            </button>
            <button className="knopf" disabled={laeuft} onClick={onAbbrechen}>
              Abbrechen
            </button>
          </div>
        </>
      )}

      {entwuerfe && (
        <>
          <label className="feld">
            <span className="leise">Stadt</span>
            <input value={stadt} onChange={(e) => setStadt(e.target.value)} maxLength={60} />
          </label>

          <p className="leise klein">
            Tippe auf einen Schauplatz, um ihn zu ändern oder ein Bild dazu zu
            erzeugen. Was du abwählst, wird nicht gespeichert.
          </p>

          {entwuerfe.map((entwurf) => (
            <div className="kapitel-block" key={entwurf.nummer}>
              <button
                className="saga-kopf"
                onClick={() => setOffen(offen === entwurf.nummer ? null : entwurf.nummer)}
              >
                <div>
                  <strong>{entwurf.name || "Ohne Namen"}</strong>
                  <span className="leise klein">
                    {entwurf.atmosphaere}
                    {entwurf.bild ? " · Bild hinterlegt" : ""}
                    {entwurf.dabei ? "" : " · wird nicht gespeichert"}
                  </span>
                </div>
                <span className="leise">{offen === entwurf.nummer ? "▾" : "▸"}</span>
              </button>

              {offen === entwurf.nummer && (
                <>
                  <label className="schalter">
                    <input
                      type="checkbox"
                      checked={entwurf.dabei}
                      onChange={(e) => aendern(entwurf.nummer, { dabei: e.target.checked })}
                    />
                    <span>Diesen Schauplatz speichern</span>
                  </label>

                  <label className="feld">
                    <span className="leise">Name</span>
                    <input
                      value={entwurf.name}
                      onChange={(e) => aendern(entwurf.nummer, { name: e.target.value })}
                      maxLength={80}
                    />
                  </label>

                  <label className="feld">
                    <span className="leise">Atmosphäre · ein paar Wörter</span>
                    <input
                      value={entwurf.atmosphaere}
                      onChange={(e) => aendern(entwurf.nummer, { atmosphaere: e.target.value })}
                      maxLength={300}
                    />
                  </label>

                  <label className="feld">
                    <span className="leise">Beschreibung</span>
                    <textarea
                      rows={2}
                      value={entwurf.beschreibung}
                      onChange={(e) => aendern(entwurf.nummer, { beschreibung: e.target.value })}
                      maxLength={500}
                    />
                  </label>

                  <BildFeld
                    wert={entwurf.bild}
                    vorschlag="/orte/stadt-ort.png"
                    onAendern={(bild) => aendern(entwurf.nummer, { bild })}
                    art="orte"
                    eintrag={{
                      name: entwurf.name,
                      stadt,
                      atmosphaere: entwurf.atmosphaere,
                      beschreibung: entwurf.beschreibung,
                    }}
                  />
                </>
              )}
            </div>
          ))}

          <div className="knopf-reihe">
            <button
              className="knopf aktion"
              disabled={speichert || !gewaehlt.length || !stadt.trim()}
              onClick={() => void speichern()}
            >
              {speichert
                ? "Wird gespeichert …"
                : `${gewaehlt.length} Schauplätze speichern`}
            </button>
            <button className="knopf" disabled={speichert || laeuft} onClick={() => void erfinden()}>
              {laeuft ? "…" : "Noch einmal erfinden"}
            </button>
            <button className="knopf" disabled={speichert} onClick={onAbbrechen}>
              Verwerfen
            </button>
          </div>
        </>
      )}
    </div>
  );
}
