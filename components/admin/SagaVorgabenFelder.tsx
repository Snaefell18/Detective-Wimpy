"use client";

import { alsStaedte } from "@/lib/csv";
import { auftrittVon, type SagaVorgaben } from "@/lib/sagaTypen";
import { useStammdaten } from "@/lib/stammdaten";
import { TonFeld } from "./TonFeld";

/**
 * Alle Vorgaben einer Saga an einem Ort.
 *
 * Dieselben Felder braucht man an zwei Stellen: beim Anlegen einer einzelnen
 * Saga und beim Erzeugen einer Saga für eine Arc-Station. Zwei Kopien wären
 * zwei Baustellen - deshalb liegen sie hier.
 *
 * `vomArc` markiert die Felder, die eine übergeordnete Reihe schon gesetzt
 * hat. Sie bleiben bearbeitbar (wer es besser weiß, darf), zeigen aber an,
 * woher ihr Wert kommt.
 */
const SCHWIERIGKEITEN: { id: SagaVorgaben["schwierigkeit"]; label: string }[] = [
  { id: "leicht", label: "Leicht" },
  { id: "mittel", label: "Mittel" },
  { id: "knifflig", label: "Knifflig" },
];

const REIFEGRADE: { id: SagaVorgaben["reifegrad"]; label: string; hinweis: string }[] = [
  { id: "kindgerecht", label: "Kindgerecht", hinweis: "Streiche, Diebstähle" },
  { id: "jugendlich", label: "Jugendlich", hinweis: "Drohungen, Rauferei" },
  { id: "erwachsen", label: "Erwachsen", hinweis: "Gewalt, Tote nur Menschen" },
];

const ABSURDITAETEN: { id: SagaVorgaben["absurditaet"]; label: string; hinweis: string }[] = [
  { id: "bodenstaendig", label: "Bodenständig", hinweis: "könnte so passiert sein" },
  { id: "verspielt", label: "Verspielt", hinweis: "schrullig, leicht überzogen" },
  { id: "absurd", label: "Absurd", hinweis: "Logik wie im Traum" },
];

const TOENE: { id: SagaVorgaben["ton"]; label: string }[] = [
  { id: "kindgerecht", label: "Warmherzig" },
  { id: "spannend", label: "Spannend" },
  { id: "albern", label: "Albern" },
];

export function SagaVorgabenFelder({
  vorgaben,
  onAendern,
  vomArc,
}: {
  vorgaben: SagaVorgaben;
  onAendern: (teil: Partial<SagaVorgaben>) => void;
  /** Hinweis je Feld, das der Arc vorgibt - z.B. { thema: "Kommt aus dem Arc" }. */
  vomArc?: Partial<Record<keyof SagaVorgaben, string>>;
}) {
  const stammdaten = useStammdaten();
  const staedte = alsStaedte(stammdaten.orte);
  const verdaechtige = stammdaten.charaktere.filter((c) => !c.istDetektiv);
  // Nur wer in dieser Saga vorkommt - leere Auswahl heißt: alle.
  const mitspieler =
    vorgaben.charaktere.length >= 2
      ? verdaechtige.filter((c) => vorgaben.charaktere.includes(c.id))
      : verdaechtige;
  const kapitelNummern = Array.from({ length: vorgaben.kapitelAnzahl }, (_, i) => i);
  /** Wer nicht von Anfang an dabei ist - nur die bekommen einen Auftritt. */
  const spaeteMitspieler = mitspieler.filter(
    (c) =>
      auftrittVon({
        charakterId: c.id,
        vorgaben,
        drahtzieherId: vorgaben.drahtzieherId,
      }) > 1,
  );

  const setzen = (teil: Partial<SagaVorgaben>) => onAendern(teil);

  const umschalten = (feld: "charaktere" | "items", id: string) =>
    onAendern({
      [feld]: vorgaben[feld].includes(id)
        ? vorgaben[feld].filter((x) => x !== id)
        : [...vorgaben[feld], id],
    });

  /** Täter für Kapitel i (0-basiert) - leerer Wert heißt: freie Wahl. */
  const kapitelTaeterSetzen = (i: number, id: string) => {
    const liste = [...(vorgaben.kapitelTaeter ?? [])];
    liste[i] = id;
    onAendern({ kapitelTaeter: liste });
  };

  const wunschSetzen = (i: number, text: string) => {
    const wuensche = [...vorgaben.kapitelWuensche];
    wuensche[i] = text;
    onAendern({ kapitelWuensche: wuensche });
  };

  /** Stadt je Kapitel; der letzte Eintrag gehört zum Finale. */
  const stadtSetzen = (i: number, stadt: string) => {
    const liste = [...vorgaben.kapitelStaedte];
    liste[i] = stadt;
    onAendern({ kapitelStaedte: liste });
  };

  /** Steht dieses Feld schon durch den Arc fest? */
  const arcHinweis = (feld: keyof SagaVorgaben) =>
    vomArc?.[feld] ? <span className="leise klein"> · {vomArc[feld]}</span> : null;

  return (
    <>
      <label className="feld">
        <span className="leise">Name (leer = das Modell erfindet einen)</span>
        <input
          value={vorgaben.name}
          onChange={(e) => setzen({ name: e.target.value })}
          placeholder="z.B. Die Spur der sieben Glocken"
          maxLength={120}
        />
      </label>

      <label className="feld">
        <span className="leise">
          Überthema · was sich langsam enthüllt{arcHinweis("thema")}
        </span>
        <textarea
          rows={3}
          value={vorgaben.thema}
          onChange={(e) => setzen({ thema: e.target.value })}
          placeholder="z.B. Jemand sammelt heimlich die Glocken aller Stadttiere ein"
          maxLength={2000}
        />
      </label>

      <h3 className="unter-abschnitt">Kapitel</h3>
      <div className="wahl-reihe">
        {[2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            className="wahl-chip"
            data-aktiv={vorgaben.kapitelAnzahl === n}
            onClick={() => setzen({ kapitelAnzahl: n })}
          >
            <strong>{n}</strong>
            <span className="leise">+ Finale</span>
          </button>
        ))}
      </div>

      {[...kapitelNummern, vorgaben.kapitelAnzahl].map((i) => {
        const istFinale = i === vorgaben.kapitelAnzahl;
        return (
          <div className="kapitel-block" key={i}>
            <h4 className="unter-abschnitt">
              {istFinale ? "Finale" : `Kapitel ${i + 1}`}
            </h4>

            {!istFinale && (
              <label className="feld">
                <span className="leise">Wunsch (frei lassen = freie Hand)</span>
                <input
                  value={vorgaben.kapitelWuensche[i] ?? ""}
                  onChange={(e) => wunschSetzen(i, e.target.value)}
                  placeholder="z.B. Spielt auf dem Nachtmarkt, ein Fahrrad verschwindet"
                  maxLength={400}
                />
              </label>
            )}

            {!istFinale && (
              <>
                <span className="leise klein">Täter dieses Kapitels</span>
                <div className="marken-reihe">
                  <button
                    className="marke-knopf"
                    data-aktiv={!(vorgaben.kapitelTaeter?.[i] ?? "")}
                    onClick={() => kapitelTaeterSetzen(i, "")}
                  >
                    Zufällig
                  </button>
                  {mitspieler
                    // Der Drahtzieher ist erst im Finale schuldig, und wer im
                    // Kapitel noch gar nicht auftritt, kann es nicht gewesen sein.
                    .filter((c) => c.id !== vorgaben.drahtzieherId)
                    .filter(
                      (c) =>
                        auftrittVon({
                          charakterId: c.id,
                          vorgaben,
                          drahtzieherId: vorgaben.drahtzieherId,
                        }) <=
                        i + 1,
                    )
                    .map((c) => (
                      <button
                        key={c.id}
                        className="marke-knopf"
                        data-aktiv={vorgaben.kapitelTaeter?.[i] === c.id}
                        onClick={() => kapitelTaeterSetzen(i, c.id)}
                      >
                        {c.name}
                      </button>
                    ))}
                </div>
              </>
            )}

            {istFinale && (
              <p className="leise klein">
                Im Finale ist der Drahtzieher der Täter - das steht oben.
              </p>
            )}

            <span className="leise klein">Stadt</span>
            <div className="marken-reihe">
              <button
                className="marke-knopf"
                data-aktiv={!vorgaben.kapitelStaedte[i]}
                onClick={() => stadtSetzen(i, "")}
              >
                Wie eingestellt
              </button>
              <button
                className="marke-knopf"
                data-aktiv={vorgaben.kapitelStaedte[i] === "zufall"}
                onClick={() => stadtSetzen(i, "zufall")}
              >
                Zufall
              </button>
              {staedte.map((stadt) => (
                <button
                  key={stadt.id}
                  className="marke-knopf"
                  data-aktiv={vorgaben.kapitelStaedte[i] === stadt.id}
                  onClick={() => stadtSetzen(i, stadt.id)}
                >
                  {stadt.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <h3 className="unter-abschnitt">
        Stadt <span className="leise">· gilt, wo oben „Wie eingestellt“ steht</span>
      </h3>
      <div className="wahl-reihe umbrechend">
        <button
          className="wahl-chip"
          data-aktiv={vorgaben.staedteWechseln}
          onClick={() => setzen({ staedteWechseln: true })}
        >
          <strong>Wechselnd</strong>
          <span className="leise">jedes Mal woanders</span>
        </button>
        {staedte.map((stadt) => (
          <button
            key={stadt.id}
            className="wahl-chip"
            data-aktiv={!vorgaben.staedteWechseln && vorgaben.stadt === stadt.id}
            onClick={() => setzen({ staedteWechseln: false, stadt: stadt.id })}
          >
            <strong>{stadt.name}</strong>
            <span className="leise">{stadt.orte.length} Orte</span>
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">
        Tiere <span className="leise">· keins gewählt = alle</span>
        {arcHinweis("charaktere")}
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
        Dinge <span className="leise">· müssen vorkommen</span>
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

      <h3 className="unter-abschnitt">
        Drahtzieher <span className="leise">· wer hinter allem steckt</span>
        {arcHinweis("drahtzieherId")}
      </h3>
      <div className="marken-reihe">
        <button
          className="marke-knopf"
          data-aktiv={vorgaben.drahtzieherId === ""}
          onClick={() => setzen({ drahtzieherId: "" })}
        >
          Zufällig
        </button>
        {verdaechtige.map((c) => (
          <button
            key={c.id}
            className="marke-knopf"
            data-aktiv={vorgaben.drahtzieherId === c.id}
            onClick={() => setzen({ drahtzieherId: c.id })}
          >
            {c.name}
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">
        Twist <span className="leise">· der Drahtzieher bleibt bis zum Finale unsichtbar</span>
        {arcHinweis("twist")}
      </h3>
      <div className="wahl-reihe">
        <button
          className="wahl-chip"
          data-aktiv={!vorgaben.twist}
          onClick={() => setzen({ twist: false })}
        >
          <strong>Normal</strong>
          <span className="leise">Er läuft in den Kapiteln beiläufig mit</span>
        </button>
        <button
          className="wahl-chip"
          data-aktiv={vorgaben.twist}
          onClick={() => setzen({ twist: true })}
        >
          <strong>Twist</strong>
          <span className="leise">Man begegnet ihm erst im Finale</span>
        </button>
      </div>
      <p className="leise klein">
        Mit Twist kommt der Drahtzieher in keinem Kapitel vor - man sieht ihn
        nicht und kann ihn nicht befragen. Die Hinweise auf ihn gibt es
        trotzdem von Anfang an, nur über Eigenschaften statt über seinen
        Namen: eine Handschrift, ein Geruch, ein Siegel. Der Erzählertext vor
        dem Finale inszeniert dann seinen Auftritt.
      </p>

      <h3 className="unter-abschnitt">
        Auftritte <span className="leise">· wer wann dazustößt</span>
      </h3>
      <p className="leise klein">
        Standard ist „Von Anfang an“. Wer später einsteigt, taucht in dem
        Kapitel zum ersten Mal auf und bleibt dann bis zum Ende dabei; der
        Erzählertext davor erklärt seine Ankunft. „Erst im Finale“ heißt: In
        keinem Kapitel zu sehen. Das darf auch der Drahtzieher sein - mit der
        Twist-Wahl oben steht er ohnehin schon auf „Erst im Finale“.
      </p>
      {mitspieler.map((c) => {
        const finale = vorgaben.kapitelAnzahl + 1;
        const gesperrt = vorgaben.twist && c.id === vorgaben.drahtzieherId;
        const jetzt = gesperrt ? finale : (vorgaben.neuzugaenge?.[c.id] ?? 1);
        return (
          <div key={c.id} className="auftritt-zeile">
            <span className="leise klein">
              {c.name}
              {c.id === vorgaben.drahtzieherId ? " · Drahtzieher" : ""}
            </span>
            <div className="marken-reihe">
              {Array.from({ length: finale }, (_, i) => i + 1).map((ab) => (
                <button
                  key={ab}
                  className="marke-knopf"
                  disabled={gesperrt}
                  data-aktiv={jetzt === ab}
                  onClick={() =>
                    setzen({
                      neuzugaenge: { ...(vorgaben.neuzugaenge ?? {}), [c.id]: ab },
                    })
                  }
                >
                  {ab === 1 ? "Von Anfang an" : ab === finale ? "Erst im Finale" : `Ab Kapitel ${ab}`}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <h3 className="unter-abschnitt">Publikum</h3>
      <div className="wahl-reihe">
        {REIFEGRADE.map((r) => (
          <button
            key={r.id}
            className="wahl-chip"
            data-aktiv={vorgaben.reifegrad === r.id}
            onClick={() => setzen({ reifegrad: r.id })}
          >
            <strong>{r.label}</strong>
            <span className="leise">{r.hinweis}</span>
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">Absurdität</h3>
      <div className="wahl-reihe">
        {ABSURDITAETEN.map((a) => (
          <button
            key={a.id}
            className="wahl-chip"
            data-aktiv={vorgaben.absurditaet === a.id}
            onClick={() => setzen({ absurditaet: a.id })}
          >
            <strong>{a.label}</strong>
            <span className="leise">{a.hinweis}</span>
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">Erzählton</h3>
      <div className="wahl-reihe">
        {TOENE.map((t) => (
          <button
            key={t.id}
            className="wahl-chip"
            data-aktiv={vorgaben.ton === t.id}
            onClick={() => setzen({ ton: t.id })}
          >
            <strong>{t.label}</strong>
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
            onClick={() => setzen({ schwierigkeit: s.id })}
          >
            <strong>{s.label}</strong>
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">Schauplätze je Fall</h3>
      <div className="wahl-reihe">
        {[3, 4, 5, 6].map((n) => (
          <button
            key={n}
            className="wahl-chip"
            data-aktiv={vorgaben.ortsAnzahl === n}
            onClick={() => setzen({ ortsAnzahl: n })}
          >
            <strong>{n}</strong>
          </button>
        ))}
      </div>

      <h3 className="unter-abschnitt">
        Auftritt eines neuen Tiers{" "}
        <span className="leise">· der Ton, wenn jemand dazustößt</span>
      </h3>
      <p className="leise klein">
        Gilt für diese ganze Saga. Ohne Auswahl gilt, was im Admin-Menü unter
        „Spiel“ steht - und wenn dort auch nichts steht, newplayer.mp3. Solange der Ton läuft, bleibt die Figur im Dunkeln -
        enthüllt wird sie erst am Ende, und zwar über die ganze Länge des
        Stücks.
      </p>
      <TonFeld
        wert={vorgaben.neuzugangTon}
        onAendern={(neuzugangTon) => setzen({ neuzugangTon })}
      />

      <h4 className="unter-abschnitt">
        Eigener Ton je Tier{" "}
        <span className="leise">· für alle, die später dazustoßen</span>
      </h4>
      {spaeteMitspieler.length === 0 ? (
        <p className="leise klein">
          Zurzeit steigt niemand später ein. Wer soll das sein? Oben unter
          „Auftritte“ ein Kapitel wählen - dann steht das Tier hier.
        </p>
      ) : (
        <>
          <p className="leise klein">
            Ohne eigene Wahl klingt es wie oben. Für den Drahtzieher lohnt sich
            ein anderes Stück - sein Auftritt ist der letzte der Saga.
          </p>
          {spaeteMitspieler.map((c) => (
            <div key={c.id} className="erzaehler-feld">
              <h4 className="unter-abschnitt">
                {c.name}
                <span className="leise">
                  {" "}
                  ·{" "}
                  {auftrittVon({
                    charakterId: c.id,
                    vorgaben,
                    drahtzieherId: vorgaben.drahtzieherId,
                  }) > vorgaben.kapitelAnzahl
                    ? "erst im Finale"
                    : `ab Kapitel ${auftrittVon({
                        charakterId: c.id,
                        vorgaben,
                        drahtzieherId: vorgaben.drahtzieherId,
                      })}`}
                </span>
              </h4>
              <TonFeld
                wert={vorgaben.neuzugangToene?.[c.id] ?? ""}
                satzVorschlag={`${c.name} betritt das Feld!`}
                onAendern={(wert) =>
                  setzen({
                    neuzugangToene: { ...(vorgaben.neuzugangToene ?? {}), [c.id]: wert },
                  })
                }
              />
            </div>
          ))}
        </>
      )}

      <h3 className="unter-abschnitt">Beschuldigungen je Fall</h3>
      <div className="wahl-reihe">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            className="wahl-chip"
            data-aktiv={vorgaben.beschuldigungen === n}
            onClick={() => setzen({ beschuldigungen: n })}
          >
            <strong>{n}</strong>
          </button>
        ))}
      </div>
    </>
  );
}
