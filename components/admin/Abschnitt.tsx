"use client";

import type { ReactNode } from "react";

/**
 * Ein einklappbarer Abschnitt im Admin-Menü.
 *
 * Das Saga-Formular ist lang - es muss lang sein, denn es entscheidet über
 * eine ganze Reihe von Fällen. Hintereinanderweg gestellt wird daraus
 * allerdings eine Bahn, auf der man den Finalkampf nur findet, wenn man
 * ahnt, dass er hinter den Auftritten kommt. Deshalb steht jede Gruppe in
 * einem Abschnitt, den man zuklappen kann, und in der Kopfzeile steht, was
 * darin eingestellt ist: „3 Kapitel + Finale", „Gericht & Flucht · Arena
 * 9×9". So sieht man den Stand, ohne aufzuklappen.
 *
 * Bewusst `<details>` statt eines eigenen Zustands: Der Browser kann das
 * längst, samt Tastatur und Vorlesen, und die Felder darin bleiben im
 * Dokument stehen. Ein zugeklappter Abschnitt vergisst also nichts - weder
 * halb getippten Text noch eine offene Vorschau.
 */
export function Abschnitt({
  titel,
  zusammenfassung,
  offen = false,
  hinweis,
  children,
}: {
  titel: string;
  /** Die Zeile neben dem Titel: was gerade eingestellt ist. */
  zusammenfassung?: string;
  /** Der erste Abschnitt steht offen; alles andere klappt man selbst auf. */
  offen?: boolean;
  /** Ein Ausrufezeichen, wenn hier noch etwas fehlt. */
  hinweis?: string;
  children: ReactNode;
}) {
  return (
    <details className="falt-abschnitt" open={offen}>
      <summary>
        <span className="falt-titel">{titel}</span>
        {zusammenfassung && <span className="falt-stand">{zusammenfassung}</span>}
        {hinweis && <span className="falt-hinweis">{hinweis}</span>}
      </summary>
      <div className="falt-inhalt">{children}</div>
    </details>
  );
}
