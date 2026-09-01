"use client";

import { useCallback, useState } from "react";
import { BeschuldigenOverlay } from "@/components/BeschuldigenOverlay";
import { ChatOverlay } from "@/components/ChatOverlay";
import { ErgebnisScreen } from "@/components/ErgebnisScreen";
import { IntroSequenz } from "@/components/IntroSequenz";
import { InventarScreen } from "@/components/InventarScreen";
import { KampagnenListe } from "@/components/KampagnenListe";
import { ErzaehlerScreen } from "@/components/ErzaehlerScreen";
import { SagaVorspann } from "@/components/SagaVorspann";
import { Prolog } from "@/components/Prolog";
import { SagenListe } from "@/components/SagenListe";
import { Nav, type Tab } from "@/components/Nav";
import { NotizbuchScreen } from "@/components/NotizbuchScreen";
import { OrtScreen } from "@/components/OrtScreen";
import { StartScreen } from "@/components/StartScreen";
import { VerdaechtigeScreen } from "@/components/VerdaechtigeScreen";
import { useAdmin } from "@/lib/adminStore";
import { spieleSofort, tonFreigeben } from "@/lib/introAudio";
import type { Saga } from "@/lib/sagaTypen";
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
  const saga = useSagaLauf();

  const { stand, geladen, laedt, schritt, fehler, setFehler } = spiel;

  // Stabile Rückmeldungen: sonst starten Prolog und Intro bei jedem Render neu.
  const prologFertig = useCallback(() => setPhase("intro"), []);
  const introFertig = useCallback(() => setPhase("aus"), []);
  const sagaSetzePhase = saga.setzePhase;
  const sagaAuftakt = useCallback(() => sagaSetzePhase("auftakt"), [sagaSetzePhase]);

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

  /** Den Fall des aktuellen Kapitels (oder das Finale) beginnen. */
  const sagaFallStarten = (finale: boolean) => {
    void tonFreigeben();
    if (!saga.stand) return;
    const quelle = finale
      ? saga.stand.saga.finale
      : saga.stand.saga.kapitel[saga.stand.lauf.kapitel];
    if (!quelle?.fall || !quelle.siegel) {
      saga.setzePhase(finale ? "epilog" : "erzaehler");
      return;
    }
    spiel.fertigenFallStarten(
      quelle.fall,
      quelle.siegel,
      saga.stand.saga.vorgaben.beschuldigungen,
    );
    saga.setzePhase(finale ? "finale" : "fall", quelle.fall.id);
  };

  if (!geladen || !saga.geladen) {
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

  // Läuft gerade ein Fall, der nichts mit der Saga zu tun hat? Dann hat er
  // Vorrang - die Saga wartet, bis man sie über "Sagas" wieder aufnimmt.
  const fremderFallLaeuft = Boolean(
    stand.fall && stand.status !== "kein-fall" && !sagaFallLaeuft,
  );

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
            weiterText="Zum Hauptmenü ›"
            musik={lauf.finaleGeschafft ? "jubel" : undefined}
            onWeiter={() => {
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
        <div className="kopf-knoepfe">
          <button
            className="rund-knopf"
            onClick={spiel.pausieren}
            aria-label="Pausieren"
            title="Pausieren"
          >
            ⏸
          </button>
          <button
            className="rund-knopf"
            onClick={() => {
              if (window.confirm("Aktuellen Fall wirklich beenden?")) spiel.aufgeben();
            }}
            aria-label="Fall beenden"
            title="Fall beenden"
          >
            ✕
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
            if (ergebnis) setBeschuldigenOffen(false);
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
