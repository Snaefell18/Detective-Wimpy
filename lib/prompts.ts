import { characterBrief } from "./characters";
import { ITEMS } from "./items";
import type { Item } from "./types";
import { findeOrt } from "./locations";
import type {
  Absurditaet,
  CaseFile,
  Character,
  ChatTurn,
  Einstellungen,
  Location,
  Reifegrad,
  TalkMode,
  Vorgaben,
} from "./types";

const TON_TEXT: Record<Einstellungen["ton"], string> = {
  kindgerecht:
    "Der Ton ist warmherzig, witzig und spannend, wie ein gutes Kinderhörspiel.",
  spannend:
    "Der Ton ist dicht und atmosphärisch, wie ein Krimi am Abend - immer noch kindgerecht, aber mit Nervenkitzel.",
  albern:
    "Der Ton ist albern und überdreht, mit Wortwitz und kleinen Slapstick-Momenten.",
};

/**
 * Wie hart erzählt werden darf. Voreingestellt ist "kindgerecht"; die
 * härteren Stufen werden nur im Admin-Menü für vorbereitete Kampagnen
 * gewählt und gelten dann für den ganzen Fall - auch für die Gespräche.
 */
const REIFE_TEXT: Record<Reifegrad, string> = {
  kindgerecht:
    "Es geht nie um Blut, Tod oder echte Gewalt - Fälle sind Diebstähle, Streiche, Sabotage, verschwundene Dinge und Geheimnisse.",
  jugendlich:
    "Der Fall darf ernst sein: Drohungen, Erpressung, Einbruch, eine Rauferei, eine echte Verletzung. Kein Tod, keine ausgemalte Brutalität - die Spannung kommt aus der Bedrohung, nicht aus dem Schaden.",
  erwachsen:
    "Erzähle wie ein Krimi für Erwachsene: Der Fall darf um Gewalt, Rache, Erpressung und auch um einen Toten gehen, mit echten Abgründen und Figuren, die schuldig werden. Halte es literarisch statt blutig - andeuten und atmosphärisch beschreiben, nicht Verletzungen ausmalen. Keine sexuellen Inhalte, keine Grausamkeit als Selbstzweck, keine Anleitungen zu echten Straftaten.",
};

/**
 * Gilt in jeder Stufe, in der überhaupt jemand sterben darf: Ein Tier stirbt
 * nie. Tote sind immer Außenstehende - Menschen, die nicht zur Welt der Tiere
 * gehören und die der Spieler nie kennengelernt hat.
 */
const TOTE_REGEL =
  "Ganz wichtig: Es stirbt niemals ein Tier. Kein Charakter aus der Besetzung und kein anderes Tier kommt zu Tode, wird tödlich verletzt oder ist zuvor gestorben. Geht es in einem Fall um einen Toten, ist es immer ein außenstehender Mensch - jemand aus der Menschenwelt, der nicht zur Stadt der Tiere gehört und den der Spieler nie kennengelernt hat. Tiere dürfen bedroht, verletzt, erpresst oder entführt werden, aber sie überleben ausnahmslos.";

/** Wie weit sich der Fall von der Wirklichkeit entfernen darf. */
const ABSURD_TEXT: Record<Absurditaet, string> = {
  bodenstaendig:
    "Bleib bodenständig: Alles im Fall könnte so wirklich passiert sein, die Motive sind nachvollziehbar, es gibt nichts Übernatürliches.",
  verspielt:
    "Es darf verspielt zugehen: schrullige Angewohnheiten, kleine Übertreibungen, hier und da ein wunderlicher Zufall.",
  absurd:
    "Es darf völlig absurd werden: aberwitzige Einfälle, unmögliche Zufälle, Logik wie im Traum. Der Fall muss trotzdem lösbar bleiben - die absurden Regeln gelten dann eben durchgehend.",
};

/**
 * Wer diesem Tier nahesteht und wen es nicht ausstehen kann.
 *
 * Die Beziehungen wirken sich im Spiel aus: Beste Freunde werden gedeckt,
 * Erzfeinde bei jeder Gelegenheit angeschwärzt.
 */
export function beziehungsText(
  charakter: Character,
  besetzung: Character[],
): string {
  const b = charakter.beziehungen;
  if (!b) return "";

  const namen = (ids: string[]) =>
    ids
      .map((id) => besetzung.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join(", ");

  const zeilen = [
    b.besteFreunde.length ? `Beste Freunde: ${namen(b.besteFreunde)}` : "",
    b.freunde.length ? `Freunde: ${namen(b.freunde)}` : "",
    b.feinde.length ? `Feinde: ${namen(b.feinde)}` : "",
    b.erzfeinde.length ? `Erzfeinde: ${namen(b.erzfeinde)}` : "",
  ].filter(Boolean);

  return zeilen.join(". ");
}

/** Wie sich Beziehungen im Gespräch niederschlagen. */
const BEZIEHUNGS_REGELN = `- Beste Freunde deckst du: Du gibst ihnen ungefragt ein Alibi, spielst Belastendes klein und wirst ungehalten, wenn Wimpy sie verdächtigt. Lügen für sie tust du ungern und ungeschickt.
- Freunde behandelst du wohlwollend: Du sagst nichts Schlechtes über sie und suchst nach harmlosen Erklärungen.
- Feinde bekommen von dir Spitzen ab: Du erwähnst gern, was sie zuletzt angestellt haben, und lenkst den Verdacht beiläufig in ihre Richtung.
- Erzfeinde beschuldigst du offen und gern - auch ohne Beweis. Du erfindest nichts völlig aus der Luft, aber du legst jede Kleinigkeit gegen sie aus und schwärzt sie an, wo es geht.
- Diese Neigungen sind stärker als dein Wunsch, Wimpy zu helfen - aber sie machen dich nicht zum Lügner in eigener Sache.`;

const detektiv = (besetzung: Character[]) =>
  besetzung.find((c) => c.istDetektiv) ?? besetzung[0];

/** Weltwissen für einen Fall - hängt an der Besetzung und dem Erzählton. */
export function buildWorldPrompt(
  besetzung: Character[],
  orte: Location[],
  stadt: string,
  ton: Einstellungen["ton"] = "kindgerecht",
  /** Die Gegenstände dieses Falls - nicht der ganze Katalog. */
  items: Item[] = ITEMS,
  reifegrad: Reifegrad = "kindgerecht",
  absurditaet: Absurditaet = "verspielt",
): string {
  const held = detektiv(besetzung);

  return `Du bist die Erzähl-Engine des Detektivspiels "Detective Wimpy".

WELT
Der Fall spielt in ${stadt} - einer Stadt, in der Tiere wie Menschen leben. Beziehe dich auf das, was diese Stadt ausmacht.
Der Spieler ist ${held.name}, ein ${held.tierart}: ${held.beschreibung}
${REIFE_TEXT[reifegrad]}
${reifegrad === "kindgerecht" ? "" : TOTE_REGEL}
${ABSURD_TEXT[absurditaet]}
${TON_TEXT[ton]} Alles auf Deutsch, in kurzen, lebendigen Sätzen.

CHARAKTERE
${besetzung
  .map((c) => {
    const bez = beziehungsText(c, besetzung);
    const stil = c.sprachstil?.trim();
    return `- [${c.id}] ${characterBrief(c)}${bez ? ` ${bez}.` : ""}${
      stil ? ` Sprachstil: ${stil}` : ""
    }`;
  })
  .join("\n")}

SCHAUPLÄTZE IN ${stadt.toUpperCase()}
${orte.map((o) => `- [${o.id}] ${o.name} (${o.atmosphaere || "neutral"})`).join("\n")}

GEGENSTÄNDE
${items.map((i) => `- [${i.id}] ${i.name}: ${i.beschreibung}`).join("\n")}

REGELN
- Benutze ausschließlich die oben genannten Ids für Charaktere, Orte und Gegenstände.
- Die Atmosphäre eines Schauplatzes prägt, was dort passiert und wie es sich anfühlt.
- Die Werte eines Charakters bestimmen sein Verhalten: hohe Schelmischkeit heißt Späße und Ablenkung, hohes Kriminalitätslevel heißt Nähe zu krummen Dingern, hohe Intelligenz heißt gute Ausreden, hohe Freundlichkeit heißt offene Antworten, niedriges Charisma heißt hölzerne Sätze.
- Kein Charakter ist "böse". Auch der Täter hat ein nachvollziehbares Motiv.`;
}

/** Prompt zum Erzeugen eines neuen Falls. Der Täter steht bereits fest. */
const SCHWIERIGKEIT_TEXT: Record<Vorgaben["schwierigkeit"], string> = {
  leicht:
    "Leicht: Die Spuren zeigen ziemlich deutlich auf den Täter, höchstens eine führt in die Irre.",
  mittel:
    "Mittel: Zwei Spuren zeigen auf den Täter, eine bis zwei führen in die Irre.",
  knifflig:
    "Knifflig: Die Wahrheit ergibt sich erst aus drei Spuren zusammen, mehrere Verdächtige wirken schuldig, zwei Spuren führen in die Irre.",
};

/** Was für alle drei Bauschritte gleich gilt. */
function regeln(vorgaben?: Vorgaben | null): string {
  const reifegrad = vorgaben?.reifegrad ?? "kindgerecht";
  return `- ${REIFE_TEXT[reifegrad]}${reifegrad !== "kindgerecht" ? `\n- ${TOTE_REGEL}` : ""}
- ${ABSURD_TEXT[vorgaben?.absurditaet ?? "verspielt"]}`;
}

/**
 * Ein Fall entsteht in drei Schritten statt in einem Rutsch.
 *
 * Ein einziger Aufruf für den ganzen Fall lief regelmäßig in das Zeitlimit
 * der Plattform. Drei kleinere Aufrufe sind jeder für sich schnell, und weil
 * das Weltwissen zwischengespeichert wird, kosten Schritt zwei und drei kaum
 * zusätzliche Token.
 *
 * Schritt 1: Das Gerüst - was ist passiert, wo, warum.
 */
export function buildGeruestPrompt(
  besetzung: Character[],
  stadt: string,
  taeterId: string,
  vorgaben?: Vorgaben | null,
): string {
  const taeter = besetzung.find((c) => c.id === taeterId);
  if (!taeter) throw new Error(`Unbekannter Charakter: ${taeterId}`);

  return `Erfinde das Gerüst eines neuen Falls für Detective Wimpy - er spielt in ${stadt}.

DER TÄTER STEHT BEREITS FEST: ${taeter.name} [${taeter.id}].
Baue den Fall so, dass er zu diesem Charakter und seinen Werten passt - Motiv und Vorgehen.

Anforderungen:
- Ein Tatort aus der Schauplatzliste.
- Der Fall muss zu ${stadt} passen: Was dort typisch ist, kommt vor.
- titel: kurz und knackig (höchstens 6 Wörter) - er wird im Intro groß eingeblendet.
- tatbeschreibung: zwei bis vier Sätze, die der Spieler zu Beginn liest. Sie verraten den Täter nicht.
- tathergang: was wirklich geschah, Schritt für Schritt. Das sieht nur der Server.
- motiv: warum ${taeter.name} es getan hat - nachvollziehbar, nicht "böse".
- schlagworte: vier bis sechs Schlagworte aus dem Fall, je ein bis zwei Wörter (z.B. "Goldene Ruderstange", "Nebel um vier", "Ein falscher Knoten"). Sie blitzen im Intro einzeln auf - also griffig, geheimnisvoll und ohne den Täter zu verraten.
- introText: drei bis vier kurze Zeilen im Stil einer Krimi-Ansage, die den Fall anteasern, ohne den Täter zu verraten. Kein "Kapitel", keine Anrede, nur Atmosphäre.
${regeln(vorgaben)}
${
  vorgaben?.thema
    ? `\nVORGABE AUS DEM ADMIN-MENÜ (unbedingt einhalten)\n- Thema: ${vorgaben.thema}`
    : ""
}`.trim();
}

/** Schritt 2: Wo alle waren, was sie behaupten und was sie verschweigen. */
export function buildVerdaechtigePrompt(
  besetzung: Character[],
  taeterId: string,
  titel: string,
  tathergang: string,
  vorgaben?: Vorgaben | null,
): string {
  const taeter = besetzung.find((c) => c.id === taeterId);
  const verdaechtige = besetzung.filter((c) => !c.istDetektiv);

  return `Der Fall steht schon fest. Fülle jetzt die Verdächtigen aus.

FALL: ${titel}
WAS WIRKLICH GESCHAH: ${tathergang}
TÄTER: ${taeter?.name} [${taeterId}]

Anforderungen:
- Für jeden dieser Verdächtigen genau einen Eintrag: ${verdaechtige.map((c) => `${c.name} [${c.id}]`).join(", ")}.
- Jeder hat ein Alibi, ein kleines Geheimnis (auch die Unschuldigen!) und einen Aufenthaltsort aus der Schauplatzliste. Verteile sie auf verschiedene Schauplätze.
- Das Alibi des Täters ist gelogen. Ein bis zwei Unschuldige dürfen ebenfalls flunkern, weil sie ihr Geheimnis schützen.
- Die Geheimnisse der Unschuldigen haben nichts mit der Tat zu tun, machen sie aber verdächtig.
- Alibi und Geheimnis passen zu den Werten des Tieres.
- Beziehungen wirken mit: Wer einen besten Freund unter den Verdächtigen hat, baut ihn ins eigene Alibi ein oder deckt ihn. Wer einen Erzfeind hat, hat auffällig oft eine Geschichte parat, die gegen diesen spricht.
${regeln(vorgaben)}`;
}

/** Schritt 3: Die Gegenstände, die der Spieler an den Orten findet. */
export function buildSpurenPrompt(
  besetzung: Character[],
  taeterId: string,
  titel: string,
  tathergang: string,
  verdaechtige: { charakterId: string; aufenthaltsort: string; alibi: string }[],
  vorgaben?: Vorgaben | null,
  items: { id: string; name: string }[] = ITEMS,
): string {
  const name = (id: string) => besetzung.find((c) => c.id === id)?.name ?? id;

  return `Der Fall und die Verdächtigen stehen fest. Lege jetzt die Spuren aus.

FALL: ${titel}
WAS WIRKLICH GESCHAH: ${tathergang}
TÄTER: ${name(taeterId)} [${taeterId}]

DIE VERDÄCHTIGEN
${verdaechtige.map((v) => `- ${name(v.charakterId)} [${v.charakterId}], jetzt bei [${v.aufenthaltsort}], behauptet: ${v.alibi}`).join("\n")}

Anforderungen:
- 4 bis 6 Spuren: je ein Gegenstand aus der Gegenstandsliste an einem Ort.
- Mindestens zwei Spuren zeigen auf den Täter, mindestens eine führt in die Irre.
- ${SCHWIERIGKEIT_TEXT[vorgaben?.schwierigkeit ?? "mittel"]}
- Jeder Gegenstand kommt höchstens einmal vor, und jede Spur muss etwas Konkretes bedeuten: Wer war wo, wer hat was angefasst, was passt nicht zusammen. Ein Fundstück ohne Aussage gehört nicht in den Fall.

JEDE SPUR HAT DREI TEXTE - HALTE SIE STRIKT AUSEINANDER
- "beobachtung" ist das Einzige, was der Spieler zu lesen bekommt. Ein bis zwei Sätze, rein beschreibend: was man sieht, riecht, hört, ertastet. Alle harten Einzelheiten gehören hinein - Farbe, Fellart, Uhrzeit, Geruch, Material, Größe, wo genau es lag -, denn nur damit kann der Spieler kombinieren. Aber sie zieht selbst keinen Schluss: kein "also", kein "das beweist", und niemals "entlastet X" oder "belastet X".
  Gut: "Auf dem letzten Bild der Kamera steht jemand mit hellem Fell vor der Hintertür. Zeitstempel 22:41."
  Falsch: "Die Kamera zeigt, dass Mikkeli um 22:41 da war - sein Alibi stimmt also nicht."
- "vermutung" ist Wimpys erster Gedanke, höchstens ein kurzer Satz, hörbar als Vermutung. Er nennt keinen Verdächtigen beim Namen, löst nichts auf und darf danebenliegen. Leer lassen, wenn nichts Gutes einfällt.
  Gut: "Helles Fell haben hier einige. Trotzdem, 22:41 ist spät."
- "bedeutung" ist die Auflösung dieser Spur, mit Namen und Schlussfolgerung. Sie bleibt im Verschlossenen und wird dem Spieler nie gezeigt - schreibe hier also ruhig deutlich, was der Fund beweist.
- Prüfe zum Schluss: Wer nur die Beobachtungen aller Spuren liest, muss den Täter erschließen können. Fehlt dafür eine Einzelheit, gehört sie in die Beobachtung - nicht in die Bedeutung.
- Nutze die Gegenstände, die zu diesem Fall passen - gerade die, die selten drankommen. Bevorzuge nicht immer dieselben.
- Der Fall muss lösbar sein: aus den Spuren zusammen ergibt sich der Täter eindeutig.
- Eine irreführende Spur darf ruhig auf einen Erzfeind des Täters zeigen - so wirkt sie wie gelegt.
${
  vorgaben?.items.length
    ? `- Diese Gegenstände müssen vorkommen: ${items
        .filter((i) => vorgaben.items.includes(i.id))
        .map((i) => `${i.name} [${i.id}]`)
        .join(", ")}`
    : ""
}
${regeln(vorgaben)}`.trim();
}

/** Prompt für ein Gespräch mit einem Charakter. */
export function buildTalkPrompt(args: {
  fall: CaseFile;
  charakterId: string;
  ortId: string;
  modus: TalkMode;
  nachricht: string;
  verlauf: ChatTurn[];
  gefundeneSpuren: string[];
}): string {
  const { fall, charakterId, ortId, modus, nachricht, verlauf, gefundeneSpuren } = args;
  const charakter = fall.besetzung.find((c) => c.id === charakterId);
  if (!charakter) throw new Error(`Unbekannter Charakter: ${charakterId}`);

  const brief = fall.verdaechtige.find((v) => v.charakterId === charakterId);
  const istTaeter = fall.taeterId === charakterId;
  const ort = findeOrt(fall.orte, ortId);

  const spurenHier = fall.spuren.filter(
    (s) => s.ortId === ortId && !gefundeneSpuren.includes(s.itemId),
  );

  const modusText: Record<TalkMode, string> = {
    reden:
      "Wimpy plaudert locker. Sei gesprächig, zeige deinen Charakter. Verrate höchstens eine Kleinigkeit nebenbei.",
    befragen:
      "Wimpy befragt dich gezielt zum Fall. Antworte im Rahmen deines Alibis und Geheimnisses. Wenn Wimpy dich mit einer gefundenen Spur konfrontiert, gerate ins Wanken.",
    beschuldigen:
      "Wimpy beschuldigt dich direkt. Reagiere heftig und charaktertypisch - empört, panisch, belustigt oder beleidigt. Gib nichts zu, außer Wimpy hat dich mit passenden Spuren wirklich in die Enge getrieben.",
  };

  return `Du spielst jetzt ${charakter.name} [${charakter.id}] im Gespräch mit Detective Wimpy.

DEIN CHARAKTER
${characterBrief(charakter)}
${
  charakter.beruf?.trim()
    ? `\nDEIN BERUF\n${charakter.beruf.trim()}. Er prägt, worüber du redest, was du gesehen haben willst und wie dein Alibi klingt.\n`
    : ""
}${
  charakter.sprachstil?.trim()
    ? `\nSO REDEST UND BENIMMST DU DICH (wichtiger als alles andere in deiner Antwort)\n${charakter.sprachstil.trim()}\n`
    : ""
}${
  beziehungsText(charakter, fall.besetzung)
    ? `\nDEINE BEZIEHUNGEN\n${beziehungsText(charakter, fall.besetzung)}.\n${BEZIEHUNGS_REGELN}\n`
    : ""
}
DER FALL (nur dein Wissen, niemals wörtlich ausplaudern)
Titel: ${fall.titel}
Tat: ${fall.tatbeschreibung}
Tatort: ${findeOrt(fall.orte, fall.tatort)?.name ?? fall.tatort} in ${fall.stadt}
${
  istTaeter
    ? `DU BIST DER TÄTER. Motiv: ${fall.motiv}. Hergang: ${fall.tathergang}. Du gibst es niemals von selbst zu und lenkst geschickt ab - aber du verhedderst dich in Details, wenn Wimpy dich mit passenden Spuren konfrontiert.`
    : `Du bist unschuldig, weißt aber nicht, wer es war. Du hast einen vagen Verdacht und schützt vor allem dein eigenes Geheimnis.`
}
Dein Alibi: ${brief?.alibi ?? "keins"}${brief?.alibiIstGelogen ? " (gelogen!)" : ""}
Dein Geheimnis: ${brief?.geheimnis ?? "keins"}

SITUATION
Ihr steht am Schauplatz: ${ort?.name ?? ortId} in ${fall.stadt}. Atmosphäre: ${ort?.atmosphaere || "neutral"}.
Wimpy hat bisher diese Spuren gefunden - du weißt, was sie bedeuten, sagst es aber nie von dir aus:
${
    gefundeneSpuren.length
      ? gefundeneSpuren
          .map((id) => {
            const spur = fall.spuren.find((s) => s.itemId === id);
            const name = fall.items?.find((i) => i.id === id)?.name ?? id;
            return `- ${name}: ${spur?.bedeutung ?? "(nichts hinterlegt)"}`;
          })
          .join("\n")
      : "- noch keine"
  }
Hält Wimpy dir eine davon vor, die dich betrifft, komm ins Schleudern: erst ausweichen, dann eine Kleinigkeit zugeben.
Unentdeckte Spuren an diesem Ort: ${
    spurenHier.length ? spurenHier.map((s) => s.itemId).join(", ") : "keine"
  }.
Wenn das Gespräch natürlich dorthin führt, darfst du Wimpy auf genau eine dieser unentdeckten Spuren stoßen lassen (Feld gefundeneSpurItemId).

MODUS: ${modus.toUpperCase()}
${modusText[modus]}

BISHERIGES GESPRÄCH
${
  verlauf.length
    ? verlauf
        .slice(-8)
        .map((t) => `${t.role === "wimpy" ? "Wimpy" : charakter.name}: ${t.text}`)
        .join("\n")
    : "(noch nichts)"
}

WIMPY SAGT: "${nachricht}"

Antworte als ${charakter.name} in 1-4 Sätzen wörtlicher Rede, ohne Namensprefix, ohne Anführungszeichen und ohne interne oder XML-artige Tags.`;
}

/** Prompt für die finale Beschuldigung. */
export function buildAccusePrompt(args: {
  fall: CaseFile;
  charakterId: string;
  begruendung: string;
  gefundeneSpuren: string[];
}): string {
  const { fall, charakterId, begruendung, gefundeneSpuren } = args;
  const beschuldigt = fall.besetzung.find((c) => c.id === charakterId);
  const taeter = fall.besetzung.find((c) => c.id === fall.taeterId);
  const richtig = charakterId === fall.taeterId;

  return `Wimpy stellt seine finale Beschuldigung.

Beschuldigt wird: ${beschuldigt?.name ?? charakterId} [${charakterId}]
Der echte Täter ist: ${taeter?.name ?? fall.taeterId} [${fall.taeterId}]
Die Beschuldigung ist damit ${richtig ? "RICHTIG" : "FALSCH"}.

Fall: ${fall.titel} - ${fall.tatbeschreibung}
Motiv: ${fall.motiv}
Hergang: ${fall.tathergang}
Gefundene Spuren und was sie beweisen:
${
    gefundeneSpuren.length
      ? gefundeneSpuren
          .map((id) => {
            const spur = fall.spuren.find((s) => s.itemId === id);
            const name = fall.items?.find((i) => i.id === id)?.name ?? id;
            return `- ${name}: ${spur?.bedeutung ?? "(nichts hinterlegt)"}`;
          })
          .join("\n")
      : "- keine"
  }
Wimpys Begründung: ${begruendung || "(keine)"}

Schreibe:
- aufloesung: Wie Wimpy den Fall auflöst - was wirklich passiert ist, in 3-5 Sätzen, spannend erzählt. Greife dabei die gefundenen Spuren beim Namen auf und sage endlich, was sie bewiesen haben - darauf hat der Spieler die ganze Zeit hingearbeitet. Bei einer falschen Beschuldigung erklärst du, wie der echte Täter davonkommt bzw. entlarvt wird.
- reaktion: Was der Beschuldigte in diesem Moment sagt, 1-2 Sätze wörtliche Rede, passend zu seinem Charakter.
Setze richtig auf ${richtig}.`;
}
