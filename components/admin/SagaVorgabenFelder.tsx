"use client";

import { alsStaedte } from "@/lib/csv";
import { useLaden } from "@/lib/useLaden";
import { SongWahl } from "./SongFeld";
import { yen } from "@/lib/zubehoer";
import {
  AUFTRITTS_ARTEN,
  artFuerAuftritt,
  auftrittVon,
  besessen,
  type SagaVorgaben,
} from "@/lib/sagaTypen";
import { useStammdaten } from "@/lib/stammdaten";
import { WETTERLAGEN, type Wetterlage } from "@/lib/types";
import { FINALE_ARTEN, type FinaleArt } from "@/lib/sagaFinale";
import { TonFeld } from "./TonFeld";
import { VideoFeld } from "./VideoFeld";

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

  const setzeBesessenheit = (teil: Partial<SagaVorgaben["besessenheit"]>) =>
    onAendern({
      besessenheit: {
        ...(vorgaben.besessenheit ?? { wirtId: "", daemonId: "", ton: "" }),
        ...teil,
      },
    });

  const detektivId = stammdaten.charaktere.find((c) => c.istDetektiv)?.id ?? "";
  const art: FinaleArt = vorgaben.finaleArt ?? "klassisch";

  /**
   * Die Art des Finales umstellen.
   *
   * "Wimpy selbst" ist zugleich eine Besessenheit - der Wirt ist der Detektiv.
   * Deshalb wird sie hier gleich mit eingerichtet und beim Wechsel auf eine
   * andere Art wieder abgeräumt; sonst bliebe eine halbe Besessenheit stehen,
   * von der niemand mehr weiß, woher sie kommt.
   */
  const finaleArtSetzen = (neu: FinaleArt) => {
    const ton = vorgaben.besessenheit?.ton ?? "";
    if (neu === "wimpy") {
      onAendern({
        finaleArt: neu,
        besessenheit: {
          wirtId: detektivId,
          daemonId: vorgaben.besessenheit?.daemonId ?? "",
          ton,
        },
      });
      return;
    }
    if (vorgaben.besessenheit?.wirtId === detektivId) {
      onAendern({ finaleArt: neu, besessenheit: { wirtId: "", daemonId: "", ton } });
      return;
    }
    onAendern({ finaleArt: neu });
  };

  const namenVon = (id: string) =>
    stammdaten.charaktere.find((c) => c.id === id)?.name ?? id;

  const umschalten = (feld: "charaktere" | "items", id: string) =>
    onAendern({
      [feld]: vorgaben[feld].includes(id)
        ? vorgaben[feld].filter((x) => x !== id)
        : [...vorgaben[feld], id],
    });

  // Der Laden - für die Geschenke nach einem Kapitel. Ohne Verbindung bleibt
  // es beim Grundregal: Die Auswahl ist dann kürzer, aber nie leer, und
  // "kein Geschenk" steht ohnehin immer zur Wahl.
  const laden = useLaden();

  /**
   * Ein Eintrag in einer Liste je Kapitel - ohne Löcher davor.
   *
   * `liste[3] = x` auf einer kurzen Liste hinterlässt sonst leere Plätze, und
   * die werden auf dem Weg zum Server zu `null`. Daran scheiterte die Prüfung
   * der ganzen Vorgaben.
   */
  const anStelle = <T,>(liste: T[] | undefined, i: number, wert: T, leer: T): T[] => {
    const kopie = [...(liste ?? [])];
    while (kopie.length <= i) kopie.push(leer);
    kopie[i] = wert;
    return kopie;
  };

  /** Täter für Kapitel i (0-basiert) - leerer Wert heißt: freie Wahl. */
  const kapitelTaeterSetzen = (i: number, id: string) =>
    onAendern({ kapitelTaeter: anStelle(vorgaben.kapitelTaeter, i, id, "") });

  const wunschSetzen = (i: number, text: string) =>
    onAendern({ kapitelWuensche: anStelle(vorgaben.kapitelWuensche, i, text, "") });

  /** Stadt je Kapitel; der letzte Eintrag gehört zum Finale. */
  const stadtSetzen = (i: number, stadt: string) =>
    onAendern({ kapitelStaedte: anStelle(vorgaben.kapitelStaedte, i, stadt, "") });

  /** Video vor einem Kapitel; der letzte Eintrag gehört zum Finale. */
  const videoSetzen = (i: number, pfad: string) =>
    onAendern({ kapitelVideos: anStelle(vorgaben.kapitelVideos, i, pfad, "") });

  /** Hintergrundmusik je Kapitel; der letzte Eintrag gehört zum Finale. */
  const musikSetzen = (i: number, pfad: string) =>
    onAendern({ kapitelMusik: anStelle(vorgaben.kapitelMusik, i, pfad, "") });

  /** Geschenk nach einem Kapitel; der letzte Eintrag gehört zum Finale. */
  const geschenkSetzen = (i: number, id: string) =>
    onAendern({ kapitelGeschenke: anStelle(vorgaben.kapitelGeschenke, i, id, "") });

  /** Wetter je Kapitel; der letzte Eintrag gehört zum Finale. */
  const wetterSetzen = (i: number, lage: Wetterlage | "") =>
    onAendern({
      kapitelWetter: anStelle<Wetterlage | "">(vorgaben.kapitelWetter, i, lage, ""),
    });

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

            <VideoFeld
              wert={vorgaben.kapitelVideos?.[i] ?? ""}
              onAendern={(pfad) => videoSetzen(i, pfad)}
              beschriftung={
                istFinale
                  ? "Video vor dem Finale (leer = kein Video)"
                  : "Video vor dem Kapitel (leer = kein Video)"
              }
            />

            {/* Die Hintergrundmusik dieses Kapitels. Nichts gewählt heißt:
                die aus dem Admin-Menü - und wenn dort auch nichts steht,
                eben keine. */}
            <SongWahl
              wert={vorgaben.kapitelMusik?.[i] ?? ""}
              onAendern={(pfad) => musikSetzen(i, pfad)}
              beschriftung={
                istFinale
                  ? "Hintergrundmusik im Finale"
                  : "Hintergrundmusik in diesem Kapitel"
              }
              leerText="Wie im Admin-Menü eingestellt"
            />

            {/* Ein Geschenk nach dem Kapitel - freiwillig, und jede Lücke
                ist erlaubt: Es lässt sich auch nur für ein einziges Kapitel
                eintragen. Steht der Gegenstand später nicht mehr im Laden,
                bleibt die Übergabe einfach aus. */}
            <label className="feld">
              <span className="leise">
                {istFinale
                  ? "Geschenk nach dem Finale"
                  : "Geschenk nach diesem Kapitel"}{" "}
                · nur wenn gelöst
              </span>
              <select
                value={vorgaben.kapitelGeschenke?.[i] ?? ""}
                onChange={(e) => geschenkSetzen(i, e.target.value)}
              >
                <option value="">Kein Geschenk</option>
                {laden.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} · sonst {yen(z.preis)}
                  </option>
                ))}
                {/* Ein Gegenstand, den es nicht mehr gibt, würde die Auswahl
                    sonst still auf "Kein Geschenk" stellen. */}
                {(vorgaben.kapitelGeschenke?.[i] ?? "") !== "" &&
                  !laden.some((z) => z.id === vorgaben.kapitelGeschenke[i]) && (
                    <option value={vorgaben.kapitelGeschenke[i]}>
                      {vorgaben.kapitelGeschenke[i]} · nicht mehr im Laden
                    </option>
                  )}
              </select>
            </label>

            <span className="leise klein">Wetter</span>
            <div className="marken-reihe">
              <button
                className="marke-knopf"
                data-aktiv={!vorgaben.kapitelWetter?.[i]}
                onClick={() => wetterSetzen(i, "")}
              >
                Wie eingestellt
              </button>
              <button
                className="marke-knopf"
                data-aktiv={vorgaben.kapitelWetter?.[i] === "aus"}
                onClick={() => wetterSetzen(i, "aus")}
              >
                Klar
              </button>
              <button
                className="marke-knopf"
                data-aktiv={vorgaben.kapitelWetter?.[i] === "zufall"}
                onClick={() => wetterSetzen(i, "zufall")}
              >
                Zufall
              </button>
              {WETTERLAGEN.map((lage) => (
                <button
                  key={lage.id}
                  className="marke-knopf"
                  data-aktiv={vorgaben.kapitelWetter?.[i] === lage.id}
                  onClick={() => wetterSetzen(i, lage.id)}
                  title={lage.hinweis}
                >
                  {lage.label}
                </button>
              ))}
            </div>

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
        Kapitel zum ersten Mal auf; der Erzählertext davor erklärt seine
        Ankunft. „Erst im Finale“ heißt: In keinem Kapitel zu sehen. Das darf
        auch der Drahtzieher sein - mit der Twist-Wahl oben steht er ohnehin
        schon auf „Erst im Finale“.
        <br />
        In der Zeile darunter lässt sich jedes einzelne Kapitel abwählen: Dann
        ist das Tier zwischendurch weg und taucht später wieder auf. Bliebe ein
        Kapitel dadurch ohne genug Verdächtige, rückt jemand nach - ein
        spielbarer Fall geht vor.
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

            {/* Wer da ist, muss nicht bleiben: Hier lässt sich jedes Kapitel
                einzeln abwählen - verreist, untergetaucht, wieder da. */}
            <div className="marken-reihe">
              <span className="leise klein">Pausiert in</span>
              {Array.from({ length: finale }, (_, i) => i + 1)
                .filter((nr) => nr >= jetzt)
                .map((nr) => {
                  const pause = (vorgaben.abwesenheiten?.[c.id] ?? []).includes(nr);
                  return (
                    <button
                      key={nr}
                      className="marke-knopf"
                      data-aktiv={pause}
                      onClick={() => {
                        const bisher = vorgaben.abwesenheiten?.[c.id] ?? [];
                        setzen({
                          abwesenheiten: {
                            ...(vorgaben.abwesenheiten ?? {}),
                            [c.id]: pause
                              ? bisher.filter((x) => x !== nr)
                              : [...bisher, nr].sort((a, b) => a - b),
                          },
                        });
                      }}
                    >
                      {nr > vorgaben.kapitelAnzahl ? "Finale" : nr}
                    </button>
                  );
                })}
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
        Finale <span className="leise">· worauf die ganze Saga zuläuft</span>
      </h3>
      <p className="leise klein">
        Das steht vor der Erzeugung fest und färbt alles: Schon das Überthema,
        jedes Kapitel und jeder einzelne Fall werden anders gebaut. Nachträglich
        umstellen lässt es sich nicht - die Texte wären dann für ein anderes
        Ende geschrieben.
      </p>
      <div className="wahl-reihe umbrechend">
        {FINALE_ARTEN.map((eintrag) => (
          <button
            key={eintrag.id}
            className="wahl-chip"
            data-aktiv={art === eintrag.id}
            onClick={() => finaleArtSetzen(eintrag.id)}
          >
            <strong>{eintrag.label}</strong>
            <span className="leise">{eintrag.hinweis}</span>
          </button>
        ))}
      </div>
      <p className="hinweis">{FINALE_ARTEN.find((e) => e.id === art)?.lang}</p>

      {art === "wimpy" && (
        <>
          <span className="leise klein">Was in Wimpy steckte</span>
          <div className="marken-reihe">
            {verdaechtige.map((c) => (
              <button
                key={c.id}
                className="marke-knopf"
                data-aktiv={vorgaben.besessenheit?.daemonId === c.id}
                onClick={() => setzeBesessenheit({ wirtId: detektivId, daemonId: c.id })}
              >
                {c.name}
              </button>
            ))}
          </div>
          {vorgaben.besessenheit?.daemonId ? (
            <>
              <p className="hinweis">
                {namenVon(vorgaben.besessenheit.daemonId)} steckte die ganze Saga
                über in Wimpy. Vor der Verhandlung bricht es aus ihm heraus - und
                im Saal sitzt Wimpy selbst auf der Anklagebank.
              </p>
              <span className="leise klein">Ton zur Verwandlung</span>
              <TonFeld
                wert={vorgaben.besessenheit.ton}
                satzVorschlag="Es war die ganze Zeit hier!"
                onAendern={(ton) => setzeBesessenheit({ ton })}
              />
            </>
          ) : (
            <p className="leise klein">
              Noch die Gestalt wählen, die in ihm steckte - ohne sie fehlt der
              Verhandlung ihr Grund.
            </p>
          )}
        </>
      )}

      {art !== "klassisch" && (
        <>
          <span className="leise klein">Song zum Einzug des Gerichts</span>
          <p className="leise klein">
            Vor der Verhandlung kündigt sich das Gericht an: Es klopft, die
            Türen fliegen auf, und Öhö flattert herein, um Recht zu sprechen.
            Die Ankündigung läuft genau so lange wie das gewählte Stück.
          </p>
          <TonFeld
            wert={vorgaben.gerichtTon ?? ""}
            satzVorschlag="Das Gericht! Erhebt euch!"
            standardTon=""
            leerHinweis="Nichts gewählt · kurze Ankündigung ohne Musik"
            onAendern={(gerichtTon) => setzen({ gerichtTon })}
          />
        </>
      )}

      {art !== "wimpy" && (
      <>
      <h3 className="unter-abschnitt">
        Besessenheit{" "}
        <span className="leise">· ein Tier war die ganze Zeit ein Dämon</span>
      </h3>
      {art === "gericht-daemon" && (
        <p className="hinweis">
          Für dieses Finale gehört die Besessenheit dazu: Das Tier, das du hier
          wählst, sitzt später auf der Anklagebank - und zeigt erst dann, wer
          wirklich in ihm steckt.
        </p>
      )}
      <p className="leise klein">
        Wähle das Tier, das besessen war, und die Gestalt, die in ihm steckt.
        Die Dämonenform legst du wie jedes andere Tier unter „Tiere“ an - mit
        Bild und allem. In den Kapiteln begegnet man nur dem Wirt; direkt vor
        dem Finale bricht der Dämon aus ihm heraus, der Wirt verschwindet, und
        der Dämon ist der Schuldige der ganzen Saga.
      </p>

      <span className="leise klein">Besessen war</span>
      <div className="marken-reihe">
        <button
          className="marke-knopf"
          data-aktiv={!vorgaben.besessenheit?.wirtId}
          onClick={() => setzeBesessenheit({ wirtId: "" })}
        >
          Niemand
        </button>
        {verdaechtige
          .filter((c) => c.id !== vorgaben.besessenheit?.daemonId)
          .map((c) => (
            <button
              key={c.id}
              className="marke-knopf"
              data-aktiv={vorgaben.besessenheit?.wirtId === c.id}
              onClick={() => setzeBesessenheit({ wirtId: c.id })}
            >
              {c.name}
            </button>
          ))}
      </div>

      {vorgaben.besessenheit?.wirtId && (
        <>
          <span className="leise klein">Seine Dämonenform</span>
          <div className="marken-reihe">
            {verdaechtige
              .filter((c) => c.id !== vorgaben.besessenheit?.wirtId)
              .map((c) => (
                <button
                  key={c.id}
                  className="marke-knopf"
                  data-aktiv={vorgaben.besessenheit?.daemonId === c.id}
                  onClick={() => setzeBesessenheit({ daemonId: c.id })}
                >
                  {c.name}
                </button>
              ))}
          </div>

          {besessen(vorgaben) ? (
            <>
              <p className="hinweis">
                {namenVon(vorgaben.besessenheit.daemonId)} steckt in{" "}
                {namenVon(vorgaben.besessenheit.wirtId)} und ist der Drahtzieher
                dieser Saga - die Wahl oben wird dafür übergangen.
              </p>
              <span className="leise klein">Ton zur Verwandlung</span>
              <TonFeld
                wert={vorgaben.besessenheit.ton}
                satzVorschlag="Es war die ganze Zeit hier!"
                onAendern={(ton) => setzeBesessenheit({ ton })}
              />
            </>
          ) : (
            <p className="leise klein">
              Jetzt noch die Dämonenform wählen - ohne sie passiert nichts.
            </p>
          )}
        </>
      )}

      </>
      )}

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
        Auftritt je Tier{" "}
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
              <span className="leise klein">Auftritt</span>
              <div className="wahl-reihe">
                {AUFTRITTS_ARTEN.map((a) => (
                  <button
                    key={a.id}
                    className="wahl-chip"
                    data-aktiv={artFuerAuftritt(c.id, vorgaben) === a.id}
                    onClick={() =>
                      setzen({
                        neuzugangArten: {
                          ...(vorgaben.neuzugangArten ?? {}),
                          [c.id]: a.id,
                        },
                      })
                    }
                  >
                    <strong>{a.label}</strong>
                    <span className="leise klein">{a.hinweis}</span>
                  </button>
                ))}
              </div>

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
