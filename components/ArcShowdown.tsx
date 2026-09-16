"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { arcKampf, type Arc } from "@/lib/arcTypen";
import { kampfSpruch } from "@/lib/endkampf";
import { modellFuerTier, spielerModell } from "@/lib/tiermodelle";
import { useStammdaten } from "@/lib/stammdaten";
import { kampfDateien, vorladen } from "@/lib/vorladen";

/*
 * Beide Szenen kommen erst, wenn sie gebraucht werden.
 *
 * Three.js ist das größte Paket des Spiels. Wer nur einen Fall lösen will,
 * soll es nicht mitladen müssen - und im Finale hat man ohnehin gerade einen
 * Erzählertext vor sich, während es im Hintergrund hereinkommt.
 */
const Verfolgungsjagd = dynamic(
  () => import("./Verfolgungsjagd").then((modul) => modul.Verfolgungsjagd),
  { ssr: false },
);
const Endkampf = dynamic(() => import("./Endkampf").then((modul) => modul.Endkampf), {
  ssr: false,
});

/**
 * Das Finale eines Arcs, wenn es ein Showdown ist.
 *
 * Der Ablauf ist immer derselbe: erst die Verfolgungsjagd (sofern im
 * Admin-Menü eine eingerichtet ist und der Spieler sie nicht überspringt),
 * dann der Kampf - und danach geht es zurück in den Arc, wo der
 * Abschlusstext steht. Gewinnen muss man nicht: Wer nach mehreren Anläufen
 * aufgibt, kommt trotzdem zum Ende seiner Geschichte. Ein Kind soll seinen
 * Arc nicht an einem Kampf verlieren.
 */
export function ArcShowdown({
  arc,
  autoId,
  besitz = {},
  onFertig,
}: {
  arc: Arc;
  /** Womit Wimpy zuletzt gefahren ist - der Wagen für die Jagd. */
  autoId?: string;
  besitz?: Record<string, number>;
  onFertig: () => void;
}) {
  const stammdaten = useStammdaten();
  const kampf = arcKampf(arc);
  const jagd = kampf?.jagd ?? null;
  const [phase, setPhase] = useState<"jagd" | "kampf">(jagd ? "jagd" : "kampf");

  const culprit = stammdaten.charaktere.find((c) => c.id === arc.culprit.charakterId);
  const detektiv = stammdaten.charaktere.find((c) => c.istDetektiv);
  const held = spielerModell(detektiv);
  const boese = culprit
    ? modellFuerTier(culprit, 0, kampf?.gegnerModell || undefined)
    : undefined;
  // Solange der Culprit noch nicht in den Stammdaten steht, heißt er, wie ihn
  // die Texte des Arcs genannt haben - besser als eine leere Überschrift.
  const name = culprit?.name || arc.culprit.wort.trim() || "der Culprit";

  /*
   * Die Arena holen, während die Jagd läuft.
   *
   * Beim Kampf selbst darf nichts mehr durch die Leitung müssen: Dann steht
   * der Startknopf da, und dahinter soll es sofort losgehen.
   */
  useEffect(() => {
    if (!kampf) return;
    void vorladen(kampfDateien(kampf.plan, held, boese));
    // Absichtlich nur einmal: Die Dateien ändern sich im Finale nicht mehr.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Ohne spielbare Arena gibt es nichts zu kämpfen.
   *
   * Dann endet der Arc wie eh und je mit seinem Abschlusstext. arcKampf()
   * prüft das; hier wird nur durchgereicht, damit niemand vor einer leeren
   * Szene steht - und zwar im Effekt, nicht mitten im Zeichnen.
   */
  const fertig = useRef(onFertig);
  fertig.current = onFertig;
  useEffect(() => {
    if (!kampf) fertig.current();
  }, [kampf]);
  if (!kampf) return null;

  // Wer der Culprit ist, steht in der Datenbank. Solange sie noch antwortet,
  // wäre jedes Modell geraten - und geraten steht am Ende eines Arcs das
  // falsche Tier in der Arena.
  if (!stammdaten.geladen) {
    return (
      <div className="jagd kampf">
        <div className="auto-jagd-laden" role="status">Der Showdown wird vorbereitet …</div>
      </div>
    );
  }

  if (phase === "jagd" && jagd) {
    return (
      <div className="kampf-jagd">
        <Verfolgungsjagd
          vorgabe={jagd}
          autoId={autoId}
          besitz={besitz}
          onFertig={() => setPhase("kampf")}
        />
        {/* Abwählbar bleibt die Jagd auch hier: Wer sie kennt oder wem sie zu
            schnell ist, geht direkt in die Arena. */}
        <button className="kampf-ueberspringen" onClick={() => setPhase("kampf")}>
          Verfolgung überspringen ›
        </button>
      </div>
    );
  }

  return (
    <Endkampf
      plan={kampf.plan!}
      strassentyp={kampf.strassentyp}
      tageszeit={kampf.tageszeit}
      wetter={kampf.wetter}
      stufe={kampf.stufe}
      musik={kampf.musik}
      gegnerName={name}
      gegnerSpruch={kampfSpruch(kampf, name)}
      spielerModell={held}
      gegnerModell={boese}
      gegnerGroesse={kampf.gegnerGroesse}
      titel={arc.name || "Der Showdown"}
      onGewonnen={onFertig}
      onAufgeben={onFertig}
    />
  );
}
