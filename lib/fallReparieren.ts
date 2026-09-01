import type { CaseClue, Character, SuspectBrief } from "./types";

/**
 * Macht einen frisch erzeugten Fall garantiert lösbar.
 *
 * Das Modell hält sich fast immer an die Vorgaben - aber eben nur fast, und
 * ein einziger Ausrutscher kann einen Fall unlösbar machen: zwei Spuren auf
 * demselben Gegenstand (die zweite findet man nie), eine irreführende Spur,
 * die auf den Täter zeigt (wer richtig kombiniert, wird bestraft), oder gar
 * keine Spur, die auf den Täter zeigt.
 *
 * Deshalb läuft diese Prüfung nach dem Spuren-Schritt über den Fall. Sie
 * braucht kein Modell und kostet keine Zeit.
 *
 * WICHTIG - warum hier gestrichen und nicht umgebogen wird:
 * Der Text einer Spur beschreibt eine bestimmte Person ("heller Schal, wie
 * ihn Nala trägt"). Zeigt man dieselbe Spur einfach auf jemand anderen,
 * passen Text und Daten nicht mehr zusammen, und der Spieler kombiniert
 * korrekt zum falschen Ergebnis. Eine Spur zu streichen ist dagegen immer
 * unbedenklich: Was nicht im Fall liegt, führt auch niemanden in die Irre.
 * Umgebogen wird nur, wo der Text die neue Zuordnung selbst hergibt.
 */

/** Was garantiert wird, wenn `repariereFall` ohne Fehler zurückkommt. */
export type Reparatur = {
  spuren: CaseClue[];
  verdaechtige: SuspectBrief[];
  /** Was geändert wurde - fürs Log, nicht für den Spieler. */
  aenderungen: string[];
  /**
   * Gesetzt, wenn der Fall nicht zu retten war. Dann darf er nicht
   * ausgeliefert werden - lieber ein neuer Versuch als ein unlösbarer Fall.
   */
  fehler: string | null;
};

/** Weniger wäre zwar lösbar, aber kein Fall - dann lieber neu erzeugen. */
const MINDEST_SPUREN = 3;

/** Wie viele Spuren auf wen zeigen. */
const zaehle = (spuren: CaseClue[]) => {
  const zaehler = new Map<string, number>();
  for (const s of spuren) {
    zaehler.set(s.zeigtAufCharakterId, (zaehler.get(s.zeigtAufCharakterId) ?? 0) + 1);
  }
  return zaehler;
};

/** Der stärkste Verdacht neben dem Täter - auf den läuft der Spieler sonst zu. */
function groessterRivale(spuren: CaseClue[], taeterId: string) {
  let id: string | null = null;
  let anzahl = 0;
  for (const [wer, wieviele] of zaehle(spuren)) {
    if (wer === taeterId) continue;
    if (wieviele > anzahl) {
      id = wer;
      anzahl = wieviele;
    }
  }
  return { id, anzahl };
}

export function repariereFall(args: {
  spuren: CaseClue[];
  verdaechtige: SuspectBrief[];
  besetzung: Character[];
  taeterId: string;
  ortIds: string[];
  itemIds: string[];
}): Reparatur {
  const { besetzung, taeterId, ortIds, itemIds } = args;
  const aenderungen: string[] = [];

  const verdaechtigenIds = besetzung.filter((c) => !c.istDetektiv).map((c) => c.id);
  const taeterName = besetzung.find((c) => c.id === taeterId)?.name ?? taeterId;
  const namen = new Map(besetzung.map((c) => [c.id, c.name]));

  /* --- 1. Verdächtigen-Einträge: einer je Tier, der Täter lügt ------- */

  const gesehen = new Set<string>();
  const verdaechtige: SuspectBrief[] = [];
  for (const v of args.verdaechtige) {
    if (!verdaechtigenIds.includes(v.charakterId)) {
      aenderungen.push(`Eintrag für „${v.charakterId}“ gestrichen - kein Verdächtiger.`);
      continue;
    }
    if (gesehen.has(v.charakterId)) {
      aenderungen.push(`Doppelter Eintrag für „${v.charakterId}“ gestrichen.`);
      continue;
    }
    gesehen.add(v.charakterId);
    verdaechtige.push(
      v.charakterId === taeterId && !v.alibiIstGelogen
        ? { ...v, alibiIstGelogen: true }
        : v,
    );
  }
  if (args.verdaechtige.some((v) => v.charakterId === taeterId && !v.alibiIstGelogen)) {
    aenderungen.push(`${taeterName} ist der Täter - sein Alibi gilt jetzt als gelogen.`);
  }

  /* --- 2. Spuren: nur gültige, jeder Gegenstand höchstens einmal ----- */

  let spuren: CaseClue[] = [];
  const benutzteItems = new Set<string>();

  for (const s of args.spuren) {
    if (!itemIds.includes(s.itemId)) {
      aenderungen.push(`Spur „${s.itemId}“ gestrichen - gehört nicht zu diesem Fall.`);
      continue;
    }
    if (benutzteItems.has(s.itemId)) {
      // Die Such-Route findet je Gegenstand nur eine Spur - die zweite wäre
      // für immer unauffindbar.
      aenderungen.push(`Zweite Spur auf „${s.itemId}“ gestrichen - sie wäre nie auffindbar.`);
      continue;
    }
    if (!ortIds.includes(s.ortId)) {
      aenderungen.push(`Spur „${s.itemId}“ gestrichen - liegt an keinem Ort des Falls.`);
      continue;
    }
    if (!verdaechtigenIds.includes(s.zeigtAufCharakterId)) {
      // Zeigt auf den Detektiv oder auf niemanden - dazu passt kein Text.
      aenderungen.push(
        `Spur „${s.itemId}“ gestrichen - sie zeigt auf niemanden, den man beschuldigen kann.`,
      );
      continue;
    }
    benutzteItems.add(s.itemId);
    spuren.push(s);
  }

  /* --- 3. Widerspruch: irreführend, zeigt aber auf den Täter --------- */

  spuren = spuren.map((s) => {
    if (s.fuehrtInDieIrre && s.zeigtAufCharakterId === taeterId) {
      aenderungen.push(
        `Spur „${s.itemId}“ zeigt auf den Täter und galt trotzdem als falsche Fährte - jetzt echt.`,
      );
      return { ...s, fuehrtInDieIrre: false };
    }
    return s;
  });

  if (spuren.length === 0) {
    return {
      spuren,
      verdaechtige,
      aenderungen,
      fehler: "Der Fall hat keine brauchbare Spur.",
    };
  }

  /* --- 4. Mindestens eine Spur muss auf den Täter zeigen ------------- */

  // Umbiegen wäre hier verlockend, hilft aber nichts: Der Täter hätte danach
  // genau eine Spur, und für den strikten Vorsprung aus Schritt 5 müssten
  // alle anderen bei null liegen - dann bliebe ein Fall mit einer einzigen
  // Spur. Zeigt nichts auf den Täter, ist der Entwurf verdorben.
  if (!spuren.some((s) => s.zeigtAufCharakterId === taeterId)) {
    return {
      spuren,
      verdaechtige,
      aenderungen,
      fehler: `Keine einzige Spur zeigt auf ${taeterName} - so ist der Fall nicht lösbar.`,
    };
  }

  /* --- 5. Der Täter muss den stärksten Verdacht auf sich ziehen ------ */

  // Der Spieler sieht nicht, welche Spur in die Irre führt. Zählt er einfach
  // alle, muss der Täter oben stehen - sonst ist der Fall auf Indizien
  // allein nicht zu entscheiden.
  let schutz = spuren.length + 1;
  while (schutz-- > 0) {
    const taeterSpuren = zaehle(spuren).get(taeterId) ?? 0;
    const rivale = groessterRivale(spuren, taeterId);
    if (!rivale.id || rivale.anzahl < taeterSpuren) break;

    // Zuerst die falschen Fährten des Rivalen - dafür sind sie da, und
    // ohne sie bleibt der Fall vollständig.
    const index =
      spuren.findIndex((s) => s.zeigtAufCharakterId === rivale.id && s.fuehrtInDieIrre) >= 0
        ? spuren.findIndex((s) => s.zeigtAufCharakterId === rivale.id && s.fuehrtInDieIrre)
        : spuren.findIndex((s) => s.zeigtAufCharakterId === rivale.id);

    if (index < 0) break;
    aenderungen.push(
      `Spur „${spuren[index].itemId}“ gestrichen - sonst stünde ${
        namen.get(rivale.id) ?? rivale.id
      } genauso stark unter Verdacht wie der Täter.`,
    );
    spuren = spuren.filter((_, i) => i !== index);
  }

  const taeterSpuren = zaehle(spuren).get(taeterId) ?? 0;
  const rivale = groessterRivale(spuren, taeterId);
  if (taeterSpuren === 0 || (rivale.id !== null && rivale.anzahl >= taeterSpuren)) {
    return {
      spuren,
      verdaechtige,
      aenderungen,
      fehler: `${taeterName} steht nicht eindeutig im Zentrum der Spuren.`,
    };
  }

  // Ein Fall, von dem nach der Kur fast nichts übrig ist, wäre zwar lösbar,
  // aber kein Vergnügen. Dann lieber neu erzeugen als dünn ausliefern.
  if (spuren.length < MINDEST_SPUREN) {
    return {
      spuren,
      verdaechtige,
      aenderungen,
      fehler: `Nach der Prüfung blieben nur ${spuren.length} brauchbare Spuren übrig.`,
    };
  }

  return { spuren, verdaechtige, aenderungen, fehler: null };
}

/**
 * Dieselben Regeln als reine Prüfung - für Fälle, die von Hand bearbeitet
 * wurden. Gibt zurück, was einen Fall unlösbar macht.
 */
export function pruefeLoesbarkeit(args: {
  spuren: CaseClue[];
  besetzung: Character[];
  taeterId: string;
}): string[] {
  const { spuren, besetzung, taeterId } = args;
  const probleme: string[] = [];
  const name = (id: string) => besetzung.find((c) => c.id === id)?.name ?? id;

  const doppelt = spuren
    .map((s) => s.itemId)
    .filter((id, i, alle) => alle.indexOf(id) !== i);
  for (const id of new Set(doppelt)) {
    probleme.push(`„${id}“ liegt zweimal als Spur - die zweite findet man nie.`);
  }

  for (const s of spuren) {
    if (s.fuehrtInDieIrre && s.zeigtAufCharakterId === taeterId) {
      probleme.push(
        `„${s.itemId}“ zeigt auf den Täter, gilt aber als falsche Fährte - das bestraft richtiges Kombinieren.`,
      );
    }
  }

  const taeterSpuren = zaehle(spuren).get(taeterId) ?? 0;
  if (taeterSpuren === 0) {
    probleme.push(`Keine Spur zeigt auf ${name(taeterId)} - der Fall ist nicht lösbar.`);
  } else {
    const rivale = groessterRivale(spuren, taeterId);
    if (rivale.id && rivale.anzahl >= taeterSpuren) {
      probleme.push(
        `Auf ${name(rivale.id)} zeigen genauso viele Spuren wie auf ${name(
          taeterId,
        )} - auf Indizien allein ist der Fall nicht zu entscheiden.`,
      );
    }
  }

  return probleme;
}
