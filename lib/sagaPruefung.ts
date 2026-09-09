import { alsStaedte } from "./csv";
import { angeklagterAus, mitVerhandlung, richterAus } from "./sagaFinale";
import { auftrittVon, besetzungFuerSaga, besessen, type SagaVorgaben } from "./sagaTypen";
import type { Character, Location } from "./types";

/**
 * Was an den Vorgaben nicht aufgeht - geprüft, BEVOR ein einziger Aufruf
 * gestellt wird.
 *
 * Der Grund ist schlicht Geld: Eine Saga besteht aus zwanzig und mehr
 * Modellaufrufen. Fiel eine dieser Bedingungen erst im letzten Schritt auf -
 * etwa, dass für die Verhandlung niemand den Vorsitz führen kann -, war alles
 * davor bezahlt und verloren. Jede Prüfung hier ist reine Rechnerei im
 * Browser und kostet nichts.
 *
 * Dieselbe Funktion läuft im Admin-Menü (dort steht die Liste unter dem Knopf)
 * und noch einmal auf dem Server (dort wird der erste Aufruf verweigert).
 */
export function pruefeVorgaben(args: {
  vorgaben: SagaVorgaben;
  charaktere: Character[];
  orte: Location[];
  /**
   * Was im Laden steht - nur für die Geschenke. Wer die Liste nicht hat (der
   * Server zum Beispiel), lässt sie weg; dann wird das eben nicht geprüft.
   */
  zubehoerIds?: string[];
}): string[] {
  const { vorgaben, charaktere, orte, zubehoerIds } = args;
  const probleme: string[] = [];

  const besetzung = besetzungFuerSaga(charaktere, vorgaben);
  const verdaechtige = besetzung.filter((c) => !c.istDetektiv);
  const name = (id: string) => charaktere.find((c) => c.id === id)?.name ?? id;
  const dabei = (id: string) => besetzung.some((c) => c.id === id);

  if (verdaechtige.length < 3) {
    probleme.push(
      `Eine Saga braucht mindestens drei Verdächtige - ausgewählt sind ${verdaechtige.length}.`,
    );
  }

  if (vorgaben.kapitelAnzahl < 2 || vorgaben.kapitelAnzahl > 8) {
    probleme.push("Die Kapitelzahl muss zwischen 2 und 8 liegen.");
  }

  // Städte: Jeder Fall braucht so viele Schauplätze, wie eingestellt sind.
  const staedte = alsStaedte(orte).filter((s) => s.orte.length >= vorgaben.ortsAnzahl);
  if (staedte.length === 0) {
    probleme.push(
      `Keine Stadt hat ${vorgaben.ortsAnzahl} Schauplätze. Bitte die Ortsliste ergänzen oder die Zahl der Schauplätze senken.`,
    );
  }
  for (const [i, wunsch] of (vorgaben.kapitelStaedte ?? []).entries()) {
    if (wunsch && wunsch !== "zufall" && !staedte.some((s) => s.id === wunsch)) {
      const wo = i >= vorgaben.kapitelAnzahl ? "das Finale" : `Kapitel ${i + 1}`;
      probleme.push(
        `Die Stadt für ${wo} hat weniger als ${vorgaben.ortsAnzahl} Schauplätze.`,
      );
    }
  }

  if (vorgaben.drahtzieherId && !dabei(vorgaben.drahtzieherId)) {
    probleme.push(`${name(vorgaben.drahtzieherId)} ist als Drahtzieher gewählt, spielt aber nicht mit.`);
  }

  // Besessenheit: halb eingerichtet ist schlimmer als gar nicht.
  const b = vorgaben.besessenheit;
  if (b?.wirtId && !b.daemonId) {
    probleme.push("Zur Besessenheit fehlt die Dämonenform.");
  }
  if (b?.daemonId && !b.wirtId) {
    probleme.push("Zur Besessenheit fehlt das Tier, das besessen war.");
  }
  if (b?.wirtId && b.daemonId && b.wirtId === b.daemonId) {
    probleme.push("Wirt und Dämonenform können nicht dasselbe Tier sein.");
  }
  for (const id of [b?.wirtId, b?.daemonId]) {
    if (id && !dabei(id)) probleme.push(`${name(id)} gehört zur Besessenheit, spielt aber nicht mit.`);
  }

  const art = vorgaben.finaleArt ?? "klassisch";

  if (art === "wimpy") {
    const detektiv = besetzung.find((c) => c.istDetektiv);
    if (!detektiv) {
      probleme.push(
        "Für das Finale „Wimpy selbst“ muss der Detektiv in den Stammdaten stehen - dort ist gerade keiner als Detektiv markiert.",
      );
    }
    if (!besessen(vorgaben)?.daemonId) {
      probleme.push(
        "Für das Finale „Wimpy selbst“ fehlt die Gestalt, die in ihm steckte.",
      );
    }
  }

  // "Gericht & Dämon" ist eine Besessenheit mit anderem Auftritt: ohne Wirt
  // und Gestalt gibt es nichts zu enthüllen.
  if (art === "gericht-daemon" && !besessen(vorgaben)) {
    probleme.push(
      "Für das Finale „Gericht & Dämon“ fehlt die Besessenheit: Wähle unten das Tier, das besessen ist, und seine Gestalt.",
    );
  }

  // Der Gerichtssaal braucht beide Bänke besetzt.
  if (mitVerhandlung(art)) {
    const angeklagterId = angeklagterAus({
      art,
      besetzung,
      drahtzieherId: vorgaben.drahtzieherId || verdaechtige[0]?.id || "",
      wirtId: vorgaben.besessenheit?.wirtId,
    });
    if (!richterAus(besetzung, angeklagterId)) {
      probleme.push(
        "Für die Verhandlung fehlt jemand, der den Vorsitz führen kann - dafür braucht es außer dem Angeklagten noch ein weiteres Tier (am besten Öhö).",
      );
    }
  }

  // Columbo und der unsichtbare Drahtzieher schließen einander aus.
  if ((art === "gericht" || art === "gericht-daemon") && vorgaben.twist) {
    probleme.push(
      "„Gerichtssaal“ und „Twist“ vertragen sich nicht: Im Gerichtsfinale tritt der Drahtzieher von Anfang an auf und spielt mit Wimpy, der Twist verlangt genau das Gegenteil.",
    );
  }

  /*
   * Ein von Hand gesetzter Kapiteltäter, der dort gar nicht auftritt.
   *
   * Das ist der heimtückische Fall: Der Server sucht sich dann still einen
   * anderen Täter, die Saga entsteht - nur eben anders als bestellt, und das
   * merkt man erst beim Spielen. Deshalb wird hier alles geprüft, was den
   * Wunsch unerfüllbar macht: Auftritt zu spät, in diesem Kapitel abwesend,
   * oder ohnehin der Drahtzieher.
   */
  for (const [i, id] of (vorgaben.kapitelTaeter ?? []).entries()) {
    if (!id) continue;
    const kapitel = i + 1;
    if (kapitel > vorgaben.kapitelAnzahl) continue;

    if (!dabei(id)) {
      probleme.push(`${name(id)} ist Täter von Kapitel ${kapitel}, spielt aber nicht mit.`);
      continue;
    }
    if (id === vorgaben.drahtzieherId) {
      probleme.push(
        `${name(id)} kann nicht Täter von Kapitel ${kapitel} sein - er ist der Drahtzieher und erst im Finale schuldig.`,
      );
      continue;
    }

    const auftritt = auftrittVon({
      charakterId: id,
      vorgaben,
      drahtzieherId: vorgaben.drahtzieherId,
    });
    if (auftritt > kapitel) {
      probleme.push(
        auftritt > vorgaben.kapitelAnzahl
          ? `${name(id)} ist Täter von Kapitel ${kapitel}, tritt aber erst im Finale auf.`
          : `${name(id)} ist Täter von Kapitel ${kapitel}, steigt aber erst in Kapitel ${auftritt} ein.`,
      );
      continue;
    }

    if ((vorgaben.abwesenheiten?.[id] ?? []).includes(kapitel)) {
      probleme.push(
        `${name(id)} ist Täter von Kapitel ${kapitel} und dort zugleich als abwesend eingetragen.`,
      );
    }
  }

  /*
   * Geschenke: Ein Gegenstand, den es im Laden nicht gibt, wird im Spiel
   * stillschweigend übersprungen - das ist die sichere Seite, aber niemand
   * würde es merken. Deshalb steht es hier, wo die Liste bekannt ist.
   */
  if (zubehoerIds) {
    const vorhanden = new Set(zubehoerIds);
    for (const [i, id] of (vorgaben.kapitelGeschenke ?? []).entries()) {
      if (!id || i > vorgaben.kapitelAnzahl) continue;
      if (!vorhanden.has(id)) {
        const wo = i === vorgaben.kapitelAnzahl ? "nach dem Finale" : `nach Kapitel ${i + 1}`;
        probleme.push(
          `Das Geschenk ${wo} („${id}“) steht nicht mehr im Laden - dann gäbe es dort nichts.`,
        );
      }
    }
  }

  // Wer in jedem Kapitel und im Finale abwesend ist, spielt nie mit - dann
  // gehört er aus der Besetzung, nicht in jede Abwesenheitsliste.
  for (const [id, kapitel] of Object.entries(vorgaben.abwesenheiten ?? {})) {
    if (!dabei(id) || !Array.isArray(kapitel)) continue;
    const alle = new Set(kapitel);
    const immerWeg = Array.from(
      { length: vorgaben.kapitelAnzahl + 1 },
      (_, i) => i + 1,
    ).every((nummer) => alle.has(nummer));
    if (immerWeg) {
      probleme.push(
        `${name(id)} ist in jedem Kapitel und im Finale abwesend - so kommt er in der ganzen Saga nicht vor.`,
      );
    }
  }

  return probleme;
}
