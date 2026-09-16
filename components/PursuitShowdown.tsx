"use client";

import { useState } from "react";
import { ANIMATIONS_MODELLE } from "@/lib/animations.generated";
import { STANDARD_KAMPF, arenaPlan, kampfSpielbar, type KampfVorgabe } from "@/lib/endkampf";
import { gebaeudeArten } from "@/lib/stadtplan";
import { useStammdaten } from "@/lib/stammdaten";
import { KampfFeld } from "./admin/KampfFeld";
import { Showdown } from "./Showdown";

/**
 * Modus V im 3D-Labor: den Showdown ausprobieren.
 *
 * Gedacht für die Frage, die man sonst erst im fertigen Arc stellen kann: Ist
 * die Arena zu eng? Sieht der Gegner in dieser Größe albern aus? Hält das
 * Handy die Nacht mit Schnee aus? Hier steht dafür genau derselbe Editor wie
 * im Admin-Menü (components/admin/KampfFeld.tsx) - alle Einstellungen, auch
 * die Verfolgungsjagd davor -, nur hängt nichts davon an einer Saga oder
 * einem Arc. Was hier eingestellt wird, gilt für diesen einen Kampf.
 */
export function PursuitShowdown({
  onZurueck,
  onSchliessen,
}: {
  onZurueck: () => void;
  onSchliessen: () => void;
}) {
  const stammdaten = useStammdaten();
  /*
   * Fertig zum Losspielen: eine Arena steht schon, damit man nicht erst malen
   * muss, um etwas zu sehen. Als Gegner das größte Modell, das es gibt.
   */
  const [kampf, setKampf] = useState<KampfVorgabe>(() => {
    const plan = arenaPlan(9, 9);
    return {
      ...STANDARD_KAMPF,
      plan,
      locations: gebaeudeArten(plan),
      gegnerModell:
        ANIMATIONS_MODELLE.find((modell) => modell.id === "yeti")?.id ??
        ANIMATIONS_MODELLE.find((modell) => modell.id !== "wimpy")?.id ??
        "",
    };
  });
  const [spielerModell, setSpielerModell] = useState("wimpy");
  const [gegnerId, setGegnerId] = useState("");
  const [spielt, setSpielt] = useState(false);

  const gegner = stammdaten.charaktere.find((c) => c.id === gegnerId);

  if (spielt) {
    return (
      <div className="pursuit-spiel kampf-labor">
        <Showdown
          vorschau
          kampf={kampf}
          gegnerId={gegnerId}
          name={gegner?.name || "Der Herausforderer"}
          titel="3D-Labor · Showdown"
          spielerModellId={spielerModell}
          onFertig={() => setSpielt(false)}
        />
        <button
          className="jagd-vorschau-schliessen"
          onClick={() => setSpielt(false)}
          aria-label="Zurück zu den Einstellungen"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="jagd pursuit-auswahl pursuit-spiel">
      <button className="jagd-vorschau-schliessen" onClick={onSchliessen} aria-label="Pursuit schließen">×</button>
      <section className="pursuit-panel probe-panel">
        <button className="pursuit-zurueck" onClick={onZurueck}>‹ Modi</button>
        <span className="jagd-kicker">MODUS V · VOR DEM ERNSTFALL</span>
        <h1>SHOWDOWN</h1>
        <p>
          Wimpy gegen einen Gegner deiner Wahl - in einer Arena, die du hier
          baust. Dieselben Einstellungen wie im Finale eines Arcs oder einer
          Saga, nur hängt hier nichts daran: Probier alles aus, und wenn es
          passt, stell es dort genauso ein.
        </p>

        {/* Wer im Labor kämpft, ist frei wählbar: entweder ein Tier aus den
            Stammdaten (dann gilt sein Modell) oder einfach ein Modell. */}
        <h3>Gegner <span className="leise">· wer da drüben steht</span></h3>
        <label className="feld">
          <span className="leise klein">Tier aus den Stammdaten · leer = einfach ein Modell</span>
          <select value={gegnerId} onChange={(e) => setGegnerId(e.target.value)}>
            <option value="">Kein Tier - nur das Modell unten</option>
            {stammdaten.charaktere
              .filter((c) => !c.istDetektiv)
              .map((charakter) => (
                <option key={charakter.id} value={charakter.id}>
                  {charakter.name}
                </option>
              ))}
          </select>
        </label>

        <KampfFeld
          kampf={kampf}
          onAendern={setKampf}
          gegnerId={gegnerId}
          gegnerWort="Der Herausforderer"
          titel="3D-Labor"
          spielerModellId={spielerModell}
          onSpielerModell={setSpielerModell}
        />

        {/* Derselbe Kampf noch einmal unten: Nach dem langen Formular sucht
            niemand den Knopf in der Mitte wieder. */}
        <button
          className="knopf aktion pursuit-los"
          disabled={!kampfSpielbar(kampf)}
          onClick={() => setSpielt(true)}
        >
          SHOWDOWN STARTEN ›
        </button>
      </section>
    </div>
  );
}
