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

/**
 * Hat dieses Kapitel etwas hinterlassen, das über sich hinausweist?
 *
 * Die Beweismitteltasche lebt davon: Was am Ende vor Gericht zählt, wurde
 * unterwegs eingesammelt. Ein Kapitel, das nur sich selbst löst, schickt
 * Wimpy mit leeren Händen in den Saal.
 *
 * Gefunden wird in zwei Stufen. Hat das Modell selbst etwas als Fernwirkung
 * ausgezeichnet, ist alles gut. Hat es das vergessen, aber eine ehrliche Spur
 * auf den Drahtzieher gelegt, gilt sie als solche - das ist dieselbe Sache,
 * nur ohne Häkchen. Erst wenn beides fehlt, meldet sich `fehlt`.
 */
export function fernwirkungPruefen(
  spuren: CaseClue[],
  /** Der Kopf hinter der Saga - leer, wo es ihn nicht gibt ("Kein Täter"). */
  drahtzieherId: string,
): { spuren: CaseClue[]; fehlt: boolean; aenderung: string | null } {
  if (spuren.some((s) => s.fernwirkung)) {
    return { spuren, fehlt: false, aenderung: null };
  }

  const ersatz = drahtzieherId
    ? spuren.find((s) => s.zeigtAufCharakterId === drahtzieherId && !s.fuehrtInDieIrre)
    : undefined;

  if (!ersatz) return { spuren, fehlt: true, aenderung: null };

  return {
    spuren: spuren.map((s) => (s === ersatz ? { ...s, fernwirkung: true } : s)),
    fehlt: false,
    aenderung: `„${ersatz.itemId}“ zeigt auf den Drahtzieher und gilt jetzt als Stück mit Fernwirkung.`,
  };
}

/* --- Wie viele Spuren ein Fall haben soll --------------------------- */

/**
 * Die Spanne, in der ein Fall gut spielbar ist.
 *
 * Zu wenige, und man findet nach dem zweiten Ort nichts mehr; zu viele, und
 * das Umsehen zieht sich, während die Beweismitteltasche mit sechs Plätzen
 * ohnehin nicht alles fassen kann. Ein Kapitel einer Saga darf etwas mehr
 * haben - dort kommen die Stücke mit Fernwirkung dazu, die den Fall selbst
 * nicht lösen.
 */
export type SpurenZiel = { min: number; max: number };

export const ZIEL_EINZELFALL: SpurenZiel = { min: 4, max: 6 };
export const ZIEL_KAPITEL: SpurenZiel = { min: 5, max: 7 };

/**
 * Überzählige Spuren streichen.
 *
 * Gestrichen wird von hinten und in dieser Reihenfolge: erst falsche
 * Fährten (eine bleibt immer stehen), dann Beiwerk, das auf niemanden
 * Wichtigen zeigt, und zuletzt eine Spur auf den Täter - aber nie unter
 * zwei. Stücke mit Fernwirkung bleiben unangetastet: Sie sind der Grund,
 * warum es das Kapitel gibt.
 */
export function spurenKappen(
  spuren: CaseClue[],
  max: number,
  taeterId: string,
): { spuren: CaseClue[]; aenderungen: string[] } {
  const aenderungen: string[] = [];
  let rest = [...spuren];

  const streichbar = (): number => {
    const irre = rest.filter((s) => s.fuehrtInDieIrre && !s.fernwirkung);
    if (irre.length > 1) return rest.lastIndexOf(irre[irre.length - 1]);

    const beiwerk = rest.filter(
      (s) => !s.fernwirkung && !s.fuehrtInDieIrre && s.zeigtAufCharakterId !== taeterId,
    );
    if (beiwerk.length > 0) return rest.lastIndexOf(beiwerk[beiwerk.length - 1]);

    const aufTaeter = rest.filter((s) => !s.fernwirkung && s.zeigtAufCharakterId === taeterId);
    if (aufTaeter.length > 2) return rest.lastIndexOf(aufTaeter[aufTaeter.length - 1]);

    return -1;
  };

  while (rest.length > max) {
    const index = streichbar();
    if (index < 0) break;
    aenderungen.push(`Spur „${rest[index].itemId}“ gestrichen - der Fall hatte zu viele.`);
    rest = rest.filter((_, i) => i !== index);
  }

  return { spuren: rest, aenderungen };
}

/**
 * Liegen die Spuren brauchbar über die Orte verteilt?
 *
 * Wer an einem Schauplatz steht und sich umsieht, soll dort auch etwas
 * finden können. Liegt alles an einem Ort, laufen die anderen leer - und
 * umgekehrt findet man am selben Ort fünfmal hintereinander etwas, was das
 * Umsehen zur Fließbandarbeit macht.
 *
 * Zurechtgebogen wird hier nichts: Der Text einer Spur beschreibt oft genau
 * den Ort, an dem sie liegt ("auf dem Notenpult"). Umgelegt passte er nicht
 * mehr. Gemeldet wird es trotzdem - dann lohnt sich ein zweiter Anlauf.
 */
export function verteilungMangel(spuren: CaseClue[], ortIds: string[]): string | null {
  if (spuren.length < 2 || ortIds.length < 2) return null;

  const proOrt = new Map<string, number>();
  for (const s of spuren) proOrt.set(s.ortId, (proOrt.get(s.ortId) ?? 0) + 1);

  const belegt = [...proOrt.keys()].filter((id) => ortIds.includes(id)).length;
  const noetig = Math.min(ortIds.length, 3);
  if (belegt < noetig) {
    return `Die Spuren liegen an nur ${belegt} von ${ortIds.length} Orten - an den anderen findet man nie etwas.`;
  }

  /*
   * Zwei an einem Ort sind in Ordnung, drei sind ein Haufen - erst bei
   * wirklich vielen Spuren darf ein Ort auch drei tragen. Genau das steht
   * auch in der Bestellung ("höchstens zwei").
   */
  const groesster = Math.max(...proOrt.values());
  const erlaubt = Math.max(2, Math.ceil(spuren.length / 3));
  if (groesster > erlaubt) {
    return `An einem Ort liegen ${groesster} von ${spuren.length} Spuren - das ist zu viel auf einem Haufen.`;
  }

  return null;
}
