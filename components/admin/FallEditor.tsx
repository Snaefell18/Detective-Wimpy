"use client";

import { useMemo, useState } from "react";
import { pruefeFall } from "@/lib/aktePruefen";
import type { CaseClue, CaseFile, SuspectBrief } from "@/lib/types";

/**
 * Alles an einem Fall von Hand ändern - auch das, was im Spiel geheim ist.
 *
 * Ob der Fall spielbar bleibt, rechnet der Browser selbst aus - die Prüfung
 * (lib/aktePruefen.ts) ist reine Logik, kein Modell und kein Server. Sie läuft
 * bei jeder Änderung mit und steht unten als Liste. Erst zum Speichern geht der
 * Fall einmal an den eigenen Server, weil nur der ihn wieder versiegeln kann.
 */
export function FallEditor({
  fall,
  onSpeichern,
  onAbbrechen,
  laeuft,
}: {
  fall: CaseFile;
  onSpeichern: (fall: CaseFile) => void;
  onAbbrechen: () => void;
  laeuft: boolean;
}) {
  const [entwurf, setEntwurf] = useState<CaseFile>(fall);
  const aendern = (teil: Partial<CaseFile>) => setEntwurf((alt) => ({ ...alt, ...teil }));

  // Läuft im Browser mit, bei jeder Änderung.
  const probleme = useMemo(() => pruefeFall(entwurf), [entwurf]);

  const verdaechtige = entwurf.besetzung.filter((c) => !c.istDetektiv);
  const name = (id: string) => entwurf.besetzung.find((c) => c.id === id)?.name ?? id;
  const ortName = (id: string) => entwurf.orte.find((o) => o.id === id)?.name ?? id;

  const briefAendern = (charakterId: string, teil: Partial<SuspectBrief>) =>
    setEntwurf((alt) => ({
      ...alt,
      verdaechtige: alt.verdaechtige.map((v) =>
        v.charakterId === charakterId ? { ...v, ...teil } : v,
      ),
    }));

  const spurAendern = (i: number, teil: Partial<CaseClue>) =>
    setEntwurf((alt) => ({
      ...alt,
      spuren: alt.spuren.map((s, j) => (j === i ? { ...s, ...teil } : s)),
    }));

  const spurLoeschen = (i: number) =>
    setEntwurf((alt) => ({ ...alt, spuren: alt.spuren.filter((_, j) => j !== i) }));

  const spurAnlegen = () => {
    const frei = entwurf.items.find((i) => !entwurf.spuren.some((s) => s.itemId === i.id));
    if (!frei) return;
    setEntwurf((alt) => ({
      ...alt,
      spuren: [
        ...alt.spuren,
        {
          itemId: frei.id,
          ortId: alt.orte[0].id,
          bedeutung: "",
          zeigtAufCharakterId: alt.taeterId,
          fuehrtInDieIrre: false,
        },
      ],
    }));
  };

  /** Fehlt zu einem Verdächtigen ein Eintrag, wird er hier ergänzt. */
  const eintragAnlegen = (charakterId: string) =>
    setEntwurf((alt) => ({
      ...alt,
      verdaechtige: [
        ...alt.verdaechtige,
        {
          charakterId,
          aufenthaltsort: alt.orte[0].id,
          alibi: "",
          geheimnis: "",
          alibiIstGelogen: false,
        },
      ],
    }));

  return (
    <div className="akte">
      <h3 className="unter-abschnitt">Was der Spieler sieht</h3>

      <label className="feld">
        <span className="leise">Titel</span>
        <input
          value={entwurf.titel}
          onChange={(e) => aendern({ titel: e.target.value })}
          maxLength={160}
        />
      </label>

      <label className="feld">
        <span className="leise">Tatbeschreibung · steht am Anfang im Notizbuch</span>
        <textarea
          rows={4}
          value={entwurf.tatbeschreibung}
          onChange={(e) => aendern({ tatbeschreibung: e.target.value })}
          maxLength={4000}
        />
      </label>

      <label className="feld">
        <span className="leise">Intro-Text · die Zeilen vor dem Titelsong</span>
        <textarea
          rows={4}
          value={entwurf.introText}
          onChange={(e) => aendern({ introText: e.target.value })}
          maxLength={2000}
        />
      </label>

      <label className="feld">
        <span className="leise">Schlagworte · blitzen im Intro auf, mit Komma trennen</span>
        <input
          value={entwurf.schlagworte.join(", ")}
          onChange={(e) =>
            aendern({
              schlagworte: e.target.value
                .split(",")
                .map((w) => w.trim())
                .filter(Boolean)
                .slice(0, 8),
            })
          }
        />
      </label>

      <span className="leise klein">Tatort</span>
      <div className="marken-reihe">
        {entwurf.orte.map((o) => (
          <button
            key={o.id}
            className="marke-knopf"
            data-aktiv={entwurf.tatort === o.id}
            onClick={() => aendern({ tatort: o.id })}
          >
            {o.name}
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">
        Die Lösung <span className="leise">· sieht der Spieler nie</span>
      </h3>

      <span className="leise klein">Täter</span>
      <div className="marken-reihe">
        {verdaechtige.map((c) => (
          <button
            key={c.id}
            className="marke-knopf"
            data-aktiv={entwurf.taeterId === c.id}
            onClick={() => aendern({ taeterId: c.id })}
          >
            {c.name}
          </button>
        ))}
      </div>

      <label className="feld">
        <span className="leise">Motiv</span>
        <textarea
          rows={2}
          value={entwurf.motiv}
          onChange={(e) => aendern({ motiv: e.target.value })}
          maxLength={2000}
        />
      </label>

      <label className="feld">
        <span className="leise">Tathergang · was wirklich geschah</span>
        <textarea
          rows={4}
          value={entwurf.tathergang}
          onChange={(e) => aendern({ tathergang: e.target.value })}
          maxLength={4000}
        />
      </label>

      <h3 className="unter-abschnitt">Die Verdächtigen</h3>
      {verdaechtige.map((c) => {
        const brief = entwurf.verdaechtige.find((v) => v.charakterId === c.id);
        if (!brief) {
          return (
            <div className="kapitel-block" key={c.id}>
              <h4 className="unter-abschnitt">{c.name}</h4>
              <p className="leise klein">Für dieses Tier fehlt ein Eintrag.</p>
              <button className="knopf klein" onClick={() => eintragAnlegen(c.id)}>
                Eintrag anlegen
              </button>
            </div>
          );
        }
        return (
          <div className="kapitel-block" key={c.id}>
            <h4 className="unter-abschnitt">
              {c.name}
              {entwurf.taeterId === c.id && <span className="leise"> · der Täter</span>}
            </h4>

            <span className="leise klein">Ist anzutreffen bei</span>
            <div className="marken-reihe">
              {entwurf.orte.map((o) => (
                <button
                  key={o.id}
                  className="marke-knopf"
                  data-aktiv={brief.aufenthaltsort === o.id}
                  onClick={() => briefAendern(c.id, { aufenthaltsort: o.id })}
                >
                  {o.name}
                </button>
              ))}
            </div>

            <label className="feld">
              <span className="leise">Alibi</span>
              <textarea
                rows={2}
                value={brief.alibi}
                onChange={(e) => briefAendern(c.id, { alibi: e.target.value })}
                maxLength={1000}
              />
            </label>

            <label className="feld">
              <span className="leise">Geheimnis</span>
              <textarea
                rows={2}
                value={brief.geheimnis}
                onChange={(e) => briefAendern(c.id, { geheimnis: e.target.value })}
                maxLength={1000}
              />
            </label>

            <label className="schalter">
              <input
                type="checkbox"
                checked={brief.alibiIstGelogen}
                onChange={(e) => briefAendern(c.id, { alibiIstGelogen: e.target.checked })}
              />
              <span>Das Alibi ist gelogen</span>
            </label>
          </div>
        );
      })}

      <h3 className="unter-abschnitt">
        Sprachstil <span className="leise">· gilt nur in diesem Fall</span>
      </h3>
      <p className="leise klein">
        Was hier steht, befolgt das Tier im Gespräch wörtlich. Leer heißt: der
        Stil aus den Stammdaten gilt.
      </p>
      {entwurf.besetzung.map((c, i) => (
        <label className="feld" key={c.id}>
          <span className="leise">
            {c.name}
            {c.istDetektiv ? " (Wimpy)" : ""}
          </span>
          <textarea
            rows={2}
            value={c.sprachstil ?? ""}
            onChange={(e) =>
              aendern({
                besetzung: entwurf.besetzung.map((x, j) =>
                  j === i ? { ...x, sprachstil: e.target.value } : x,
                ),
              })
            }
            placeholder="z.B. Redet sehr langsam und wiederholt Wimpys letzte Worte."
            maxLength={800}
          />
        </label>
      ))}

      <h3 className="unter-abschnitt">
        Spuren <span className="leise">· {entwurf.spuren.length} Stück</span>
      </h3>
      {entwurf.spuren.map((spur, i) => (
        <div className="kapitel-block" key={`${spur.itemId}-${i}`}>
          <h4 className="unter-abschnitt">
            {entwurf.items.find((it) => it.id === spur.itemId)?.name ?? spur.itemId}
            <span className="leise"> · liegt bei {ortName(spur.ortId)}</span>
          </h4>

          <span className="leise klein">Gegenstand</span>
          <div className="marken-reihe">
            {entwurf.items.map((it) => (
              <button
                key={it.id}
                className="marke-knopf"
                data-aktiv={spur.itemId === it.id}
                onClick={() => spurAendern(i, { itemId: it.id })}
              >
                {it.name}
              </button>
            ))}
          </div>

          <span className="leise klein">Liegt an diesem Ort</span>
          <div className="marken-reihe">
            {entwurf.orte.map((o) => (
              <button
                key={o.id}
                className="marke-knopf"
                data-aktiv={spur.ortId === o.id}
                onClick={() => spurAendern(i, { ortId: o.id })}
              >
                {o.name}
              </button>
            ))}
          </div>

          <label className="feld">
            <span className="leise">Bedeutung · was der Fund verrät</span>
            <textarea
              rows={2}
              value={spur.bedeutung}
              onChange={(e) => spurAendern(i, { bedeutung: e.target.value })}
              maxLength={1000}
            />
          </label>

          <span className="leise klein">Zeigt auf</span>
          <div className="marken-reihe">
            {verdaechtige.map((c) => (
              <button
                key={c.id}
                className="marke-knopf"
                data-aktiv={spur.zeigtAufCharakterId === c.id}
                onClick={() => spurAendern(i, { zeigtAufCharakterId: c.id })}
              >
                {c.name}
              </button>
            ))}
          </div>

          <label className="schalter">
            <input
              type="checkbox"
              checked={spur.fuehrtInDieIrre}
              onChange={(e) => spurAendern(i, { fuehrtInDieIrre: e.target.checked })}
            />
            <span>Führt in die Irre</span>
          </label>

          <button className="knopf klein" onClick={() => spurLoeschen(i)}>
            Spur entfernen
          </button>
        </div>
      ))}

      <button
        className="knopf klein"
        onClick={spurAnlegen}
        disabled={entwurf.spuren.length >= entwurf.items.length}
      >
        + Spur hinzufügen
      </button>

      {probleme.length > 0 ? (
        <div className="akte-probleme">
          <strong>So ist der Fall nicht spielbar:</strong>
          <ul>
            {probleme.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="leise klein" style={{ marginTop: 12 }}>
          Spielbar: {name(entwurf.taeterId)} ist überführbar, alle Verdächtigen haben
          einen Eintrag, alle Spuren liegen an gültigen Orten.
        </p>
      )}

      <div className="knopf-reihe" style={{ marginTop: 12 }}>
        <button
          className="knopf aktion"
          onClick={() => onSpeichern(entwurf)}
          disabled={laeuft || probleme.length > 0}
        >
          {laeuft ? "Wird versiegelt …" : "Akte speichern"}
        </button>
        <button className="knopf" onClick={onAbbrechen} disabled={laeuft}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
