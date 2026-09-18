"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ANIMATIONS_MODELLE } from "@/lib/animations.generated";
import { kampfSpielbar, kampfSpruch, type KampfVorgabe } from "@/lib/endkampf";
import { modellFuerTier, spielerModell } from "@/lib/tiermodelle";
import type { Character } from "@/lib/types";
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
 * Der Showdown, wo immer er stattfindet.
 *
 * Drei Stellen im Spiel enden inzwischen im Kampf: das Finale eines Arcs
 * (gegen den Culprit), das Finale einer Saga (gegen den Drahtzieher) und das
 * 3D-Labor (gegen irgendein Modell). Der Ablauf ist überall derselbe - erst
 * die Verfolgungsjagd, sofern eine eingerichtet ist und der Spieler sie nicht
 * überspringt, dann der Kampf -, und deshalb steht er hier einmal.
 *
 * Gewinnen muss man nicht: Wer nach mehreren Anläufen aufgibt, kommt trotzdem
 * weiter. Ein Kind soll seine Saga nicht an einem Kampf verlieren.
 */
export function Showdown({
  kampf,
  gegnerId,
  gegnerTier,
  name,
  titel,
  autoId,
  besitz = {},
  spielerModellId,
  vorschau = false,
  onFertig,
}: {
  /** Die Arena samt allem. Null oder unspielbar heißt: sofort weiter. */
  kampf: KampfVorgabe | null | undefined;
  /**
   * Charakter-Id des Gegners.
   *
   * Leer im Labor: Dort gibt es kein Tier, sondern nur ein Modell - und dann
   * gilt schlicht, was in der Vorgabe steht.
   */
  gegnerId?: string;
  /**
   * Das Tier selbst, wenn der Aufrufer es schon hat.
   *
   * In einer Saga steht die ganze Besetzung im Spielstand - also auch dann,
   * wenn die Datenbank gerade schweigt. Damit hängt der Showdown an nichts
   * mehr: Name und Modell stehen fest, bevor irgendetwas geladen wird.
   */
  gegnerTier?: Character;
  /** Wie er heißt, solange (oder falls) er nicht in den Stammdaten steht. */
  name?: string;
  titel: string;
  /** Womit Wimpy zuletzt gefahren ist - der Wagen für die Jagd davor. */
  autoId?: string;
  besitz?: Record<string, number>;
  /** Nur im Labor: Wimpy einmal mit einem anderen Modell ausprobieren. */
  spielerModellId?: string;
  /** In der Probe schließt der Knopf nur das Fenster. */
  vorschau?: boolean;
  onFertig: () => void;
}) {
  const stammdaten = useStammdaten();
  const spielbar = kampfSpielbar(kampf) ? kampf : null;
  const jagd = spielbar?.jagd ?? null;
  const [phase, setPhase] = useState<"jagd" | "kampf">(jagd ? "jagd" : "kampf");

  const gegner =
    (gegnerId ? stammdaten.charaktere.find((c) => c.id === gegnerId) : undefined) ?? gegnerTier;
  const detektiv = stammdaten.charaktere.find((c) => c.istDetektiv);
  const held =
    ANIMATIONS_MODELLE.find((modell) => modell.id === spielerModellId) ?? spielerModell(detektiv);
  /*
   * Ein Gegner steht immer da.
   *
   * Steht sein Tier fest, gilt dessen Modell. Sonst das ausdrücklich gewählte
   * - und wenn auch das fehlt (im Labor, oder weil jemand mitten im Finale
   * neu geladen hat), irgendeines, das nicht Wimpy ist. Eine Arena mit nur
   * einer Figur wäre das Schlimmste, was hier passieren kann.
   */
  const boese = gegner
    ? modellFuerTier(gegner, 0, spielbar?.gegnerModell || undefined)
    : (ANIMATIONS_MODELLE.find((modell) => modell.id === spielbar?.gegnerModell) ??
      ANIMATIONS_MODELLE.find((modell) => modell.id !== "wimpy") ??
      ANIMATIONS_MODELLE[0]);
  // Steht das Tier noch nicht in den Stammdaten, heißt er, wie ihn die Texte
  // genannt haben - besser als eine leere Überschrift.
  const anzeigeName = gegner?.name || name?.trim() || "der Culprit";

  /*
   * Die Arena holen, während die Jagd läuft.
   *
   * Beim Kampf selbst darf nichts mehr durch die Leitung müssen: Dann steht
   * der Startknopf da, und dahinter soll es sofort losgehen.
   */
  useEffect(() => {
    if (!spielbar) return;
    void vorladen(kampfDateien(spielbar.plan, held, boese));
    // Absichtlich nur einmal: Die Dateien ändern sich im Finale nicht mehr.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Ohne spielbare Arena gibt es nichts zu kämpfen.
   *
   * Dann geht es weiter wie ohne Showdown - in den Abschlusstext des Arcs
   * oder in den Epilog der Saga. Gemeldet wird das im Effekt, nicht mitten im
   * Zeichnen; niemand soll vor einer leeren Szene stehen.
   */
  /**
   * Wie lange auf die Stammdaten gewartet wird, bevor es auch ohne losgeht.
   * Sechs Sekunden sind mehr, als eine Antwort je braucht - und weniger, als
   * jemand vor einem hängenden Bildschirm sitzen sollte.
   */
  const [zuLange, setZuLange] = useState(false);
  useEffect(() => {
    if (stammdaten.geladen) return;
    const uhr = window.setTimeout(() => setZuLange(true), 6000);
    return () => window.clearTimeout(uhr);
  }, [stammdaten.geladen]);

  const fertig = useRef(onFertig);
  fertig.current = onFertig;
  useEffect(() => {
    if (!spielbar) fertig.current();
  }, [spielbar]);
  if (!spielbar) return null;

  /*
   * Wer der Gegner ist, steht in der Datenbank. Solange sie noch antwortet,
   * wäre jedes Modell geraten - und geraten steht am Ende das falsche Tier in
   * der Arena. Im Labor gibt es kein Tier, dort geht es sofort los.
   *
   * Aber nur für ein paar Sekunden: Eine Datenbank, die gar nicht antwortet,
   * darf das Finale nicht anhalten. Dann wird eben mit dem Modell gekämpft,
   * das in der Arena eingestellt ist - lieber ein geratenes Tier als ein
   * Bildschirm, auf dem für immer „wird vorbereitet" steht.
   */
  if (gegnerId && !gegner && !stammdaten.geladen && !zuLange) {
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
          vorschau={vorschau}
          // Wer am Ende der Jagd aussteigt, ist der, der gleich in der Arena
          // steht - also gilt dort dasselbe Modell wie hier.
          fluechtigModell={boese?.id}
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
      plan={spielbar.plan!}
      strassentyp={spielbar.strassentyp}
      tageszeit={spielbar.tageszeit}
      wetter={spielbar.wetter}
      stufe={spielbar.stufe}
      musik={spielbar.musik}
      gegnerName={anzeigeName}
      gegnerSpruch={kampfSpruch(spielbar, anzeigeName)}
      spielerModell={held}
      gegnerModell={boese}
      gegnerGroesse={spielbar.gegnerGroesse}
      titel={titel}
      vorschau={vorschau}
      onGewonnen={onFertig}
      onAufgeben={onFertig}
    />
  );
}
