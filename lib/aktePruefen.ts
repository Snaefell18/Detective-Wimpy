import type { CaseFile } from "./types";

/**
 * Prüft, ob ein von Hand bearbeiteter Fall noch spielbar ist.
 *
 * Im Admin-Menü darf alles geändert werden - aber nicht so, dass der Fall
 * hinterher nicht mehr funktioniert. Diese Prüfung läuft auf dem Server,
 * bevor ein Fall neu versiegelt wird, und liefert alle Probleme auf einmal
 * zurück statt beim ersten abzubrechen.
 */
export function pruefeFall(fall: CaseFile): string[] {
  const fehler: string[] = [];

  const ortIds = new Set((fall.orte ?? []).map((o) => o.id));
  const charakterIds = new Set((fall.besetzung ?? []).map((c) => c.id));
  const itemIds = new Set((fall.items ?? []).map((i) => i.id));
  const verdaechtige = (fall.besetzung ?? []).filter((c) => !c.istDetektiv);

  if (!fall.titel?.trim()) fehler.push("Der Fall braucht einen Titel.");
  if (!fall.tatbeschreibung?.trim())
    fehler.push("Ohne Tatbeschreibung weiß der Spieler nicht, worum es geht.");

  if ((fall.besetzung ?? []).filter((c) => c.istDetektiv).length !== 1)
    fehler.push("Es muss genau einen Detektiv in der Besetzung geben.");
  if (verdaechtige.length < 2)
    fehler.push("Der Fall braucht mindestens zwei Verdächtige.");

  if (ortIds.size < 2) fehler.push("Der Fall braucht mindestens zwei Schauplätze.");
  if (!ortIds.has(fall.tatort)) fehler.push("Der Tatort gehört nicht zu den Schauplätzen.");

  if (!charakterIds.has(fall.taeterId)) {
    fehler.push("Der Täter gehört nicht zur Besetzung.");
  } else if (!verdaechtige.some((c) => c.id === fall.taeterId)) {
    fehler.push("Der Detektiv kann nicht der Täter sein.");
  }

  // Jeder Verdächtige braucht einen Eintrag - sonst steht im Spiel jemand
  // herum, über den niemand etwas weiß.
  for (const c of verdaechtige) {
    const eintrag = (fall.verdaechtige ?? []).find((v) => v.charakterId === c.id);
    if (!eintrag) {
      fehler.push(`${c.name} hat keinen Eintrag (Alibi, Geheimnis, Aufenthaltsort).`);
      continue;
    }
    if (!ortIds.has(eintrag.aufenthaltsort))
      fehler.push(`${c.name} hält sich an einem Ort auf, den es im Fall nicht gibt.`);
    if (!eintrag.alibi?.trim()) fehler.push(`${c.name} hat kein Alibi.`);
  }

  for (const v of fall.verdaechtige ?? []) {
    if (!charakterIds.has(v.charakterId))
      fehler.push(`Eintrag für ein Tier, das nicht zur Besetzung gehört (${v.charakterId}).`);
  }

  const spuren = fall.spuren ?? [];
  if (spuren.length < 1) fehler.push("Der Fall braucht mindestens eine Spur.");
  if (!spuren.some((s) => s.zeigtAufCharakterId === fall.taeterId && !s.fuehrtInDieIrre))
    fehler.push("Mindestens eine echte Spur muss auf den Täter zeigen - sonst ist der Fall nicht lösbar.");

  const gesehen = new Set<string>();
  for (const s of spuren) {
    if (!itemIds.has(s.itemId))
      fehler.push(`Die Spur „${s.itemId}“ ist kein Gegenstand dieses Falls.`);
    if (gesehen.has(s.itemId))
      fehler.push(`Der Gegenstand „${s.itemId}“ liegt mehrfach als Spur herum.`);
    gesehen.add(s.itemId);
    if (!ortIds.has(s.ortId))
      fehler.push(`Die Spur „${s.itemId}“ liegt an einem Ort, den es im Fall nicht gibt.`);
    if (!charakterIds.has(s.zeigtAufCharakterId))
      fehler.push(`Die Spur „${s.itemId}“ zeigt auf ein Tier, das nicht dabei ist.`);
    if (!s.bedeutung?.trim())
      fehler.push(`Die Spur „${s.itemId}“ sagt nichts aus - ohne Bedeutung nützt sie nichts.`);
  }

  return fehler;
}

/**
 * Weiche Hinweise: Dinge, die den Fall nicht kaputt machen, aber das Spiel
 * schlechter. Sie blockieren das Speichern absichtlich nicht - ältere Fälle
 * bringen sie fast alle mit, und die sind weiter einwandfrei spielbar.
 */
export function hinweiseZumFall(fall: CaseFile): string[] {
  const hinweise: string[] = [];

  for (const s of fall.spuren ?? []) {
    if (!s.beobachtung?.trim()) {
      hinweise.push(
        `„${s.itemId}“ hat keine Beobachtung - beim Fund erscheint dann die Bedeutung und verrät die Lösung.`,
      );
    }
  }

  return hinweise;
}
