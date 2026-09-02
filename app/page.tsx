"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArcsListe } from "@/components/ArcsListe";
import { ArcUebersicht } from "@/components/ArcUebersicht";
import { ArcVorspann, themeVon } from "@/components/ArcVorspann";
import { BeschuldigenOverlay } from "@/components/BeschuldigenOverlay";
import { ChatOverlay } from "@/components/ChatOverlay";
import { ErgebnisScreen } from "@/components/ErgebnisScreen";
import { IntroSequenz } from "@/components/IntroSequenz";
import { InventarScreen } from "@/components/InventarScreen";
import { KampagnenListe } from "@/components/KampagnenListe";
import { ErzaehlerScreen, roemisch } from "@/components/ErzaehlerScreen";
import { SagaVorspann } from "@/components/SagaVorspann";
import { Prolog } from "@/components/Prolog";
import { SagenListe } from "@/components/SagenListe";
import { Nav, type Tab } from "@/components/Nav";
import { NeuerSpieler } from "@/components/NeuerSpieler";
import { ReaktionScreen } from "@/components/ReaktionScreen";
import { VerdachtsMeldung, type Verdachtsmeldung } from "@/components/VerdachtsMeldung";
import { NotizbuchScreen } from "@/components/NotizbuchScreen";
import { OrtScreen } from "@/components/OrtScreen";
import { StartScreen } from "@/components/StartScreen";
import { VerdaechtigeScreen } from "@/components/VerdaechtigeScreen";
import { useAdmin } from "@/lib/adminStore";
import type { Arc } from "@/lib/arcTypen";
import { ladeSagas } from "@/lib/db";
import { spieleSofort, tonFreigeben } from "@/lib/introAudio";
import { neueGesichter, type Saga } from "@/lib/sagaTypen";
import type { Character } from "@/lib/types";
import { useArcLauf } from "@/lib/useArcLauf";
import { useGame } from "@/lib/useGame";
import { useSagaLauf } from "@/lib/useSagaLauf";

export default function Home() {
  const spiel = useGame();
  const { daten: admin } = useAdmin();
  const [tab, setTab] = useState<Tab>("ort");
  const [chatMit, setChatMit] = useState<string | null>(null);
  const [beschuldigenOffen, setBeschuldigenOffen] = useState(false);
  const [phase, setPhase] = useState<"aus" | "prolog" | "intro">("aus");
  const [kampagnenOffen, setKampagnenOffen] = useState(false);
  const [sagenOffen, setSagenOffen] = useState(false);
  const [arcsOffen, setArcsOffen] = useState(false);
  const [arcMeldung, setArcMeldung] = useState<string | null>(null);
  /**
   * Der Arc liegt beiseite, ohne beendet zu sein: Der Fortschritt bleibt
   * gespeichert, das Hauptmenü ist wieder erreichbar. Über "Arcs" geht es
   * weiter.
   */
  const [arcRuht, setArcRuht] = useState(false);
  /** Wer gleich zum ersten Mal mitspielt - wird vor dem Kapitel angekündigt. */
  const [neuling, setNeuling] = useState<{ tiere: Character[]; finale: boolean } | null>(null);
  /** Die Reaktion des Beschuldigten - steht zwischen Beschuldigung und Urteil. */
  const [reaktion, setReaktion] = useState<{ charakterId: string; text: string } | null>(null);
  const [verdachtsMeldung, setVerdachtsMeldung] = useState<Verdachtsmeldung | null>(null);
  const saga = useSagaLauf();
  const arc = useArcLauf();

  const { stand, geladen, laedt, schritt, fehler, setFehler } = spiel;

  /**
   * Bewegt sich ein Verdacht, fährt rechts kurz eine Meldung herein. Verglichen
   * wird mit dem letzten Stand; beim ersten Fall gibt es nichts zu vergleichen.
   */
  const verdachtVorher = useRef<Record<string, number> | null>(null);
  useEffect(() => {
    const jetzt = stand.verdacht;
    const vorher = verdachtVorher.current;
    verdachtVorher.current = jetzt;
    if (!vorher || !stand.fall) return;

    for (const [id, wert] of Object.entries(jetzt)) {
      const alt = vorher[id];
      if (alt === undefined || alt === wert) continue;
      const charakter = stand.fall.besetzung.find((c) => c.id === id);
      if (!charakter) continue;
      setVerdachtsMeldung({
        id: Date.now(),
        charakter,
        richtung: wert > alt ? "hoch" : "runter",
        wert,
      });
      // Nur die stärkste Bewegung zeigen - zwei Meldungen übereinander wären
      // Krach statt Information.
      break;
    }
  }, [stand.verdacht, stand.fall]);

  // Stabile Rückmeldungen: sonst starten Prolog und Intro bei jedem Render neu.
  const prologFertig = useCallback(() => setPhase("intro"), []);
  const introFertig = useCallback(() => setPhase("aus"), []);
  const sagaSetzePhase = saga.setzePhase;
  const sagaAuftakt = useCallback(() => sagaSetzePhase("auftakt"), [sagaSetzePhase]);
  const arcSetzePhase = arc.setzePhase;
  const arcUebersicht = useCallback(() => arcSetzePhase("uebersicht"), [arcSetzePhase]);

  /**
   * Der gesprochene Prolog startet sofort im Klick - iOS erlaubt das Abspielen
   * nur direkt aus einer Nutzergeste heraus, ein await davor verwirkt sie.
   * Der Fall wird parallel erzeugt; ist er beim Ende des Prologs noch nicht da,
   * wartet die Intro-Phase kurz mit "Die Akte wird geöffnet …".
   */
  const fallStarten = async () => {
    // Die Freigabe gehört in jeden Klick, der ein Spiel beginnt - auch ohne
    // Intro, sonst bleibt die Siegermusik am Ende stumm.
    void tonFreigeben();
    if (admin.einstellungen.intro) {
      spieleSofort("prolog");
      setPhase("prolog");
    }
    const geklappt = await spiel.neuerFall();
    if (!geklappt) setPhase("aus");
  };

  /** Vorbereiteter Fall aus der Datenbank - startet ohne Modellaufruf. */
  const kampagneStarten = (kampagne: Parameters<typeof spiel.kampagneStarten>[0]) => {
    void tonFreigeben();
    if (admin.einstellungen.intro) spieleSofort("prolog");
    spiel.kampagneStarten(kampagne);
    setKampagnenOffen(false);
    if (admin.einstellungen.intro) setPhase("prolog");
  };

  /* --- Sagas: Erzählerteile und Kapitel ------------------------------ */

  /** Läuft gerade der Fall, der zur Saga gehört? */
  const sagaFallLaeuft = Boolean(
    saga.stand && stand.fall && stand.fall.id === saga.stand.lauf.fallId,
  );

  const sagaStarten = (gewaehlt: Saga, vonVorn: boolean) => {
    void tonFreigeben();
    setSagenOffen(false);

    const weiter = !vonVorn && saga.stand?.saga.id === gewaehlt.id;
    if (!weiter) {
      saga.starten(gewaehlt, true);
      return;
    }

    saga.starten(gewaehlt, false);
    const phase = saga.stand!.lauf.phase;

    if (phase === "fall" || phase === "finale") {
      if (sagaFallLaeuft) {
        // Der Fall liegt nur pausiert herum - einfach weiterspielen.
        if (stand.status === "pausiert") spiel.fortsetzen();
      } else {
        // Das Kapitel wurde abgebrochen: noch einmal vom Erzählerteil an.
        saga.setzePhase(phase === "finale" ? "finale-erzaehler" : "erzaehler", null);
      }
    }
  };

  /**
   * Den Fall des aktuellen Kapitels (oder das Finale) beginnen.
   *
   * Stößt hier jemand zum ersten Mal dazu, kommt erst die Ansage - danach
   * ruft sie diese Funktion noch einmal auf, dann mit `angekuendigt`.
   */
  const sagaFallStarten = (finale: boolean, angekuendigt = false) => {
    void tonFreigeben();
    if (!saga.stand) return;
    const quelle = finale
      ? saga.stand.saga.finale
      : saga.stand.saga.kapitel[saga.stand.lauf.kapitel];
    if (!quelle?.fall || !quelle.siegel) {
      saga.setzePhase(finale ? "epilog" : "erzaehler");
      return;
    }

    if (!angekuendigt) {
      const neue = neueGesichter(saga.stand.saga, finale ? -1 : saga.stand.lauf.kapitel);
      if (neue.length > 0) {
        setNeuling({ tiere: neue, finale });
        return;
      }
    }
    spiel.fertigenFallStarten(
      quelle.fall,
      quelle.siegel,
      saga.stand.saga.vorgaben.beschuldigungen,
    );
    saga.setzePhase(finale ? "finale" : "fall", quelle.fall.id);
  };

  /* --- Arcs: mehrere Sagen unter einem Bogen -------------------------- */

  /** Gehört die laufende Saga zur aktuellen Station des Arcs? */
  const sagaGehoertZumArc = Boolean(
    arc.stand && saga.stand && arc.stand.lauf.sagaId === saga.stand.saga.id,
  );

  const arcStarten = (gewaehlt: Arc, vonVorn: boolean) => {
    void tonFreigeben();
    setArcsOffen(false);
    setArcMeldung(null);
    setArcRuht(false);

    const weiter = !vonVorn && arc.stand?.arc.id === gewaehlt.id;
    if (!weiter) {
      // Der Titelsong startet direkt im Klick - iOS lässt Ton nur so zu.
      spieleSofort(themeVon(gewaehlt));
      arc.starten(gewaehlt, true);
      return;
    }

    // Weiterspielen führt immer in die Übersicht - von dort sieht man, was
    // ansteht, und nimmt auch eine pausierte Saga wieder auf.
    arc.starten(gewaehlt, false);
  };

  /**
   * Liegt ein Fall dieses Arcs pausiert herum? Dann heißt der Knopf in der
   * Übersicht "Weiterspielen" statt "Saga beginnen".
   */
  const arcPausiert =
    arc.stand && saga.stand && stand.status === "pausiert" && sagaFallLaeuft
      ? (arc.stand.arc.teile.find((t) => t.sagaId === saga.stand?.saga.id)?.nummer ?? null)
      : null;

  /**
   * Eine Station beginnen: erst der Erzählertext, dann ihre Saga.
   *
   * Wer sie schon angefangen und pausiert hat, landet direkt wieder im Fall -
   * der Erzähler war ja schon dran.
   */
  const arcTeilStarten = (index: number) => {
    void tonFreigeben();
    if (!arc.stand) return;
    const teil = arc.stand.arc.teile[index];
    if (!teil?.sagaId) {
      setArcMeldung("Dieser Teil wird noch vorbereitet.");
      return;
    }
    setArcMeldung(null);

    if (arcPausiert === teil.nummer && saga.stand) {
      arc.setzePhase("saga", saga.stand.saga.id);
      spiel.fortsetzen();
      return;
    }
    arc.waehleTeil(index);
  };

  /** Die Saga der aktuellen Station holen und starten. */
  const arcSagaStarten = async () => {
    void tonFreigeben();
    if (!arc.stand) return;
    const teil = arc.stand.arc.teile[arc.stand.lauf.teil];
    if (!teil?.sagaId) {
      setArcMeldung("Dieser Teil wird noch vorbereitet.");
      return;
    }
    setArcMeldung(null);
    try {
      const { daten } = await ladeSagas();
      const gefunden = daten.find((s) => s.id === teil.sagaId);
      if (!gefunden) {
        setArcMeldung("Die Saga zu diesem Teil ist gerade nicht abrufbar.");
        return;
      }
      // Eine angefangene Saga läuft weiter, wo sie stand.
      saga.starten(gefunden, saga.stand?.saga.id !== gefunden.id);
      arc.setzePhase("saga", gefunden.id);
    } catch {
      setArcMeldung("Die Saga zu diesem Teil konnte nicht geladen werden.");
    }
  };

  /** Eine Saga des Arcs ist durch - weiter zur nächsten Station. */
  const arcWeiter = () => {
    void tonFreigeben();
    saga.beenden();
    spiel.aufgeben();
    arc.teilGeschafft();
  };

  if (!geladen || !saga.geladen || !arc.geladen) {
    return <main className="app" />;
  }

  // Erst der gesprochene Prolog, dann das Intro mit dem Titelsong.
  if (phase === "prolog") {
    return (
      <main className="app">
        <Prolog onFertig={prologFertig} />
      </main>
    );
  }

  if (phase === "intro") {
    return (
      <main className="app">
        {stand.fall ? (
          <IntroSequenz fall={stand.fall} onFertig={introFertig} />
        ) : (
          // Der Prolog war schneller als die Fallerzeugung.
          <div className="prolog">
            <div className="prolog-vignette" />
            <p className="prolog-zeile" data-letzte="true">
              Die Akte wird geöffnet …
            </p>
          </div>
        )}
      </main>
    );
  }

  // "Ein neuer Spieler betritt das Feld!" - direkt vor dem Kapitel.
  if (neuling && phase === "aus") {
    return (
      <main className="app">
        <NeuerSpieler
          tiere={neuling.tiere}
          ton={admin.einstellungen.neuzugangTon}
          onFertig={() => {
            const finale = neuling.finale;
            setNeuling(null);
            sagaFallStarten(finale, true);
          }}
        />
      </main>
    );
  }

  // Läuft gerade ein Fall, der nichts mit der Saga zu tun hat? Dann hat er
  // Vorrang - die Saga wartet, bis man sie über "Sagas" wieder aufnimmt.
  const fremderFallLaeuft = Boolean(
    stand.fall && stand.status !== "kein-fall" && !sagaFallLaeuft,
  );

  // Bildschirme des Arcs. Läuft gerade eine seiner Sagen, hat die Vorrang -
  // dann steht die Phase auf "saga" und der Block darunter übernimmt.
  if (
    arc.stand &&
    !arcRuht &&
    arc.stand.lauf.phase !== "saga" &&
    phase === "aus" &&
    !fremderFallLaeuft
  ) {
    const { arc: arcDaten, lauf } = arc.stand;
    const teil = arcDaten.teile[lauf.teil];

    if (lauf.phase === "vorspann") {
      return (
        <main className="app">
          <ArcVorspann arc={arcDaten} onFertig={arcUebersicht} />
        </main>
      );
    }

    if (lauf.phase === "uebersicht") {
      return (
        <main className="app">
          <ArcUebersicht
            arc={arcDaten}
            lauf={lauf}
            pausiert={arcPausiert}
            onStarten={arcTeilStarten}
            onFinale={() => arc.setzePhase("finale")}
            // Der Arc bleibt liegen - über "Arcs" geht es später weiter.
            onSchliessen={() => setArcRuht(true)}
          />
          {arcMeldung && <p className="fehler schwebend">{arcMeldung}</p>}
        </main>
      );
    }

    if (lauf.phase === "finale") {
      return (
        <main className="app">
          <ErzaehlerScreen
            teil={arcDaten.finale.erzaehler}
            titel={`${arcDaten.name} - Finale`}
            weiterText="Zum Hauptmenü ›"
            musik="jubel"
            onWeiter={arc.beenden}
          />
        </main>
      );
    }

    // Der Erzählertext vor einer Station.
    return (
      <main className="app">
        <ErzaehlerScreen
          teil={teil?.erzaehler ?? { text: "", audio: "" }}
          titel={`${arcDaten.name} · ${teil?.name ?? "Weiter"}`}
          karte={{
            marke: `Teil ${roemisch(teil?.nummer ?? lauf.teil + 1)}`,
            name: teil?.name ?? arcDaten.name,
          }}
          weiterText={teil?.sagaId ? "Saga beginnen ›" : "Zurück zur Übersicht ›"}
          onWeiter={() => {
            if (teil?.sagaId) void arcSagaStarten();
            else arc.setzePhase("uebersicht");
          }}
        />
        {arcMeldung && <p className="fehler schwebend">{arcMeldung}</p>}
      </main>
    );
  }

  // Erzählerteile einer Saga.
  if (saga.stand && phase === "aus" && !fremderFallLaeuft) {
    const { saga: sagaDaten, lauf } = saga.stand;

    if (lauf.phase === "vorspann") {
      return (
        <main className="app">
          <SagaVorspann saga={sagaDaten} onFertig={sagaAuftakt} />
        </main>
      );
    }

    if (lauf.phase === "auftakt") {
      return (
        <main className="app">
          <ErzaehlerScreen
            teil={sagaDaten.auftakt}
            titel={sagaDaten.name}
            onWeiter={() => saga.setzePhase("erzaehler")}
          />
        </main>
      );
    }

    if (lauf.phase === "erzaehler") {
      const kapitel = sagaDaten.kapitel[lauf.kapitel];
      return (
        <main className="app">
          <ErzaehlerScreen
            teil={kapitel.erzaehler}
            titel={`Kapitel ${kapitel.nummer}: ${kapitel.name}`}
            karte={{
              marke: `Kapitel ${roemisch(kapitel.nummer)}`,
              name: kapitel.name,
              bild: kapitel.fall?.orte[0]?.bild,
            }}
            weiterText="Fall übernehmen ›"
            onWeiter={() => sagaFallStarten(false)}
          />
        </main>
      );
    }

    if (lauf.phase === "finale-erzaehler") {
      return (
        <main className="app">
          <ErzaehlerScreen
            teil={sagaDaten.finale.erzaehler}
            titel={sagaDaten.finale.frage}
            karte={{
              marke: "Finale",
              name: sagaDaten.name,
              bild: sagaDaten.finale.fall?.orte[0]?.bild,
            }}
            weiterText="Ins Finale ›"
            onWeiter={() => sagaFallStarten(true)}
          />
        </main>
      );
    }

    if (lauf.phase === "epilog") {
      return (
        <main className="app">
          <ErzaehlerScreen
            teil={sagaDaten.finale.epilog}
            titel={`${sagaDaten.name} - Ende`}
            musik={lauf.finaleGeschafft ? "jubel" : undefined}
            weiterText={sagaGehoertZumArc ? "Weiter im Arc ›" : "Zum Hauptmenü ›"}
            onWeiter={() => {
              if (sagaGehoertZumArc) {
                arcWeiter();
                return;
              }
              saga.beenden();
              spiel.aufgeben();
            }}
          />
        </main>
      );
    }
  }

  // 1. Kein Fall oder pausiert - Startbildschirm.
  if (!stand.fall || stand.status === "kein-fall" || stand.status === "pausiert") {
    return (
      <main className="app">
        <StartScreen
          onStart={() => void fallStarten()}
          onKampagnen={() => setKampagnenOffen(true)}
          onSagas={() => setSagenOffen(true)}
          onArcs={() => setArcsOffen(true)}
          onFortsetzen={stand.status === "pausiert" ? spiel.fortsetzen : undefined}
          laufenderFall={stand.status === "pausiert" ? stand.fall?.titel : undefined}
          laedt={laedt === "fall"}
          schritt={schritt}
          fehler={fehler}
        />

        {kampagnenOffen && (
          <KampagnenListe
            onStarten={kampagneStarten}
            onSchliessen={() => setKampagnenOffen(false)}
          />
        )}

        {arcsOffen && (
          <ArcsListe
            onStarten={arcStarten}
            onSchliessen={() => setArcsOffen(false)}
            laufend={
              arc.stand ? { arcId: arc.stand.arc.id, teil: arc.stand.lauf.teil } : null
            }
          />
        )}

        {sagenOffen && (
          <SagenListe
            onStarten={sagaStarten}
            onSchliessen={() => setSagenOffen(false)}
            laufend={
              saga.stand
                ? { sagaId: saga.stand.saga.id, kapitel: saga.stand.lauf.kapitel }
                : null
            }
          />
        )}
      </main>
    );
  }

  // Zwischen Beschuldigung und Urteil: die Reaktion des Beschuldigten.
  if (reaktion && stand.fall) {
    return (
      <main className="app">
        <ReaktionScreen
          charakter={stand.fall.besetzung.find((c) => c.id === reaktion.charakterId)}
          text={reaktion.text}
          onFertig={() => setReaktion(null)}
        />
      </main>
    );
  }

  // 2. Fall vorbei - Auflösung.
  if (stand.status === "beendet" && stand.ergebnis) {
    return (
      <main className="app">
        <ErgebnisScreen
          ergebnis={stand.ergebnis}
          besetzung={stand.fall.besetzung}
          onNeuerFall={() => void fallStarten()}
          onHauptmenue={() => {
            // Die Saga bleibt liegen - über "Sagas" geht es später weiter.
            spiel.aufgeben();
          }}
          onWeiter={
            sagaFallLaeuft
              ? () => {
                  // Gleich läuft der nächste Erzählerteil - Freigabe erneuern.
                  void tonFreigeben();
                  if (saga.stand?.lauf.phase === "finale") {
                    // Der Epilog kommt auch nach einer verlorenen Finalrunde -
                    // die Siegermusik gehört dann aber nicht dazu.
                    saga.setzePhase("epilog", null, stand.ergebnis?.richtig === true);
                  } else saga.kapitelGeschafft();
                  spiel.aufgeben();
                }
              : undefined
          }
          weiterText={
            saga.stand?.lauf.phase === "finale" ? "Epilog ›" : "Nächstes Kapitel ›"
          }
          laedt={laedt === "fall"}
        />
      </main>
    );
  }

  // 3. Laufendes Spiel.
  const chatCharakter = chatMit
    ? stand.fall.besetzung.find((c) => c.id === chatMit)
    : undefined;

  return (
    <main className="app">
      <header className={tab === "ort" ? "kopf schwebend" : "kopf"}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{stand.fall.titel}</h1>
          <p className="unterzeile">
            {stand.fall.stadt} · {stand.gefundeneSpuren.length} Spuren
          </p>
        </div>
        {/* Im Klassisch trägt das Symbol den Knopf, im Noir das Wort - beide
            stehen im Markup, das Design blendet aus, was es nicht braucht. */}
        <div className="kopf-knoepfe">
          <button
            className="rund-knopf"
            onClick={spiel.pausieren}
            aria-label="Pausieren"
            title="Pausieren"
          >
            <span className="symbol">⏸</span>
            <span className="knopf-wort">Pause</span>
          </button>
          <button
            className="rund-knopf"
            onClick={() => {
              if (window.confirm("Aktuellen Fall wirklich beenden?")) spiel.aufgeben();
            }}
            aria-label="Fall beenden"
            title="Fall beenden"
          >
            <span className="symbol">✕</span>
            <span className="knopf-wort">Ende</span>
          </button>
        </div>
      </header>

      <div className={tab === "ort" ? "buehne" : "scroll"}>
        {tab === "ort" && (
          <OrtScreen
            fall={stand.fall}
            ortId={stand.ortId}
            onOrtWechsel={spiel.gehZuOrt}
            onCharakter={(id) => {
              setFehler(null);
              setChatMit(id);
            }}
            onUmsehen={spiel.umsehen}
            suchtGerade={laedt === "suche"}
          />
        )}

        {tab === "verdaechtige" && (
          <VerdaechtigeScreen
            fall={stand.fall}
            verdacht={stand.verdacht}
            verlauf={stand.verlauf}
            notizen={stand.notizen}
            onCharakter={(id) => {
              setFehler(null);
              setChatMit(id);
            }}
            onBeschuldigen={() => {
              setFehler(null);
              setBeschuldigenOffen(true);
            }}
            beschuldigungenUebrig={stand.beschuldigungenUebrig}
          />
        )}

        {tab === "inventar" && (
          <InventarScreen
            gefundeneSpuren={stand.gefundeneSpuren}
            notizen={stand.notizen}
          />
        )}

        {tab === "notizbuch" && (
          <NotizbuchScreen notizen={stand.notizen} besetzung={stand.fall.besetzung} />
        )}
      </div>

      {fehler && tab !== "ort" && !chatMit && <p className="fehler schwebend">{fehler}</p>}

      {verdachtsMeldung && (
        <VerdachtsMeldung
          meldung={verdachtsMeldung}
          onFertig={() => setVerdachtsMeldung(null)}
        />
      )}

      <Nav aktiv={tab} onWechsel={setTab} spurenAnzahl={stand.gefundeneSpuren.length} />

      {chatMit && chatCharakter && (
        <ChatOverlay
          charakter={chatCharakter}
          detektiv={stand.fall.besetzung.find((c) => c.istDetektiv)}
          verlauf={stand.verlauf[chatMit] ?? []}
          onSenden={(modus, text) => spiel.sprich(chatMit, modus, text)}
          onSchliessen={() => {
            setFehler(null);
            setChatMit(null);
          }}
          laedt={laedt === "gespraech"}
          fehler={fehler}
        />
      )}

      {beschuldigenOffen && (
        <BeschuldigenOverlay
          besetzung={stand.fall.besetzung}
          verdacht={stand.verdacht}
          versucheUebrig={stand.beschuldigungenUebrig}
          onBestaetigen={async (id, begruendung) => {
            const ergebnis = await spiel.beschuldige(id, begruendung);
            if (!ergebnis) return;
            setBeschuldigenOffen(false);
            // Erst das Gesicht und der Satz - das Urteil kommt danach.
            if (ergebnis.reaktion) setReaktion({ charakterId: id, text: ergebnis.reaktion });
          }}
          onSchliessen={() => {
            setFehler(null);
            setBeschuldigenOffen(false);
          }}
          laedt={laedt === "urteil"}
          fehler={fehler}
        />
      )}
    </main>
  );
}
