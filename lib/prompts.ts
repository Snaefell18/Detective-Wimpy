import { characterBrief } from "./characters";
import { ITEMS } from "./items";
import { LOCATIONS, getLocation } from "./locations";
import type { CaseFile, Character, ChatTurn, Einstellungen, TalkMode } from "./types";

const TON_TEXT: Record<Einstellungen["ton"], string> = {
  kindgerecht:
    "Der Ton ist warmherzig, witzig und spannend, wie ein gutes Kinderhörspiel.",
  spannend:
    "Der Ton ist dicht und atmosphärisch, wie ein Krimi am Abend - immer noch kindgerecht, aber mit Nervenkitzel.",
  albern:
    "Der Ton ist albern und überdreht, mit Wortwitz und kleinen Slapstick-Momenten.",
};

const detektiv = (besetzung: Character[]) =>
  besetzung.find((c) => c.istDetektiv) ?? besetzung[0];

/** Weltwissen für einen Fall - hängt an der Besetzung und dem Erzählton. */
export function buildWorldPrompt(
  besetzung: Character[],
  ton: Einstellungen["ton"] = "kindgerecht",
): string {
  const held = detektiv(besetzung);

  return `Du bist die Erzähl-Engine des Detektivspiels "Detective Wimpy".

WELT
Eine kleine Tierstadt. Der Spieler ist ${held.name}, ein ${held.tierart}: ${held.beschreibung}
Es geht nie um Blut, Tod oder echte Gewalt - Fälle sind Diebstähle, Streiche, Sabotage, verschwundene Dinge und Geheimnisse.
${TON_TEXT[ton]} Alles auf Deutsch, in kurzen, lebendigen Sätzen.

CHARAKTERE
${besetzung.map((c) => `- [${c.id}] ${characterBrief(c)}`).join("\n")}

ORTE
${LOCATIONS.map((o) => `- [${o.id}] ${o.name}: ${o.beschreibung}`).join("\n")}

GEGENSTÄNDE
${ITEMS.map((i) => `- [${i.id}] ${i.name}: ${i.beschreibung}`).join("\n")}

REGELN
- Benutze ausschließlich die oben genannten Ids für Charaktere, Orte und Gegenstände.
- Die Werte eines Charakters bestimmen sein Verhalten: hohe Schelmischkeit heißt Späße und Ablenkung, hohes Kriminalitätslevel heißt Nähe zu krummen Dingern, hohe Intelligenz heißt gute Ausreden, hohe Freundlichkeit heißt offene Antworten, niedriges Charisma heißt hölzerne Sätze.
- Kein Charakter ist "böse". Auch der Täter hat ein nachvollziehbares Motiv.`;
}

/** Prompt zum Erzeugen eines neuen Falls. Der Täter steht bereits fest. */
export function buildCasePrompt(besetzung: Character[], taeterId: string): string {
  const taeter = besetzung.find((c) => c.id === taeterId);
  if (!taeter) throw new Error(`Unbekannter Charakter: ${taeterId}`);

  const verdaechtige = besetzung.filter((c) => !c.istDetektiv);

  return `Erfinde einen neuen Fall für Detective Wimpy.

DER TÄTER STEHT BEREITS FEST: ${taeter.name} [${taeter.id}].
Baue den ganzen Fall so, dass er zu diesem Charakter und seinen Werten passt - Motiv, Vorgehen und die Spuren.

Anforderungen:
- Ein Tatort aus der Ortsliste.
- Für jeden dieser Verdächtigen genau einen Eintrag: ${verdaechtige.map((c) => `${c.name} [${c.id}]`).join(", ")}.
- Jeder Verdächtige hat ein Alibi, ein kleines Geheimnis (auch die Unschuldigen!) und einen Aufenthaltsort aus der Ortsliste.
- Das Alibi des Täters ist gelogen. Ein bis zwei Unschuldige dürfen ebenfalls flunkern, weil sie ihr Geheimnis schützen.
- 4 bis 6 Spuren: je ein Gegenstand aus der Gegenstandsliste an einem Ort. Mindestens zwei Spuren zeigen auf den Täter, mindestens eine führt in die Irre.
- Der Fall muss lösbar sein: aus den Spuren zusammen ergibt sich der Täter eindeutig.
- Kindgerecht: kein Blut, keine Gewalt, kein Tod.`;
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
  const ort = getLocation(ortId);

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

DER FALL (nur dein Wissen, niemals wörtlich ausplaudern)
Titel: ${fall.titel}
Tat: ${fall.tatbeschreibung}
Tatort: ${getLocation(fall.tatort)?.name ?? fall.tatort}
${
  istTaeter
    ? `DU BIST DER TÄTER. Motiv: ${fall.motiv}. Hergang: ${fall.tathergang}. Du gibst es niemals von selbst zu und lenkst geschickt ab - aber du verhedderst dich in Details, wenn Wimpy dich mit passenden Spuren konfrontiert.`
    : `Du bist unschuldig, weißt aber nicht, wer es war. Du hast einen vagen Verdacht und schützt vor allem dein eigenes Geheimnis.`
}
Dein Alibi: ${brief?.alibi ?? "keins"}${brief?.alibiIstGelogen ? " (gelogen!)" : ""}
Dein Geheimnis: ${brief?.geheimnis ?? "keins"}

SITUATION
Ihr steht am Ort: ${ort?.name ?? ortId}. ${ort?.beschreibung ?? ""}
Wimpy hat bisher diese Spuren gefunden: ${
    gefundeneSpuren.length ? gefundeneSpuren.join(", ") : "noch keine"
  }.
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

Antworte als ${charakter.name} in 1-4 Sätzen wörtlicher Rede, ohne Namensprefix, ohne Anführungszeichen.`;
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
Gefundene Spuren: ${gefundeneSpuren.length ? gefundeneSpuren.join(", ") : "keine"}
Wimpys Begründung: ${begruendung || "(keine)"}

Schreibe:
- aufloesung: Wie Wimpy den Fall auflöst - was wirklich passiert ist, in 3-5 Sätzen, spannend erzählt. Bei einer falschen Beschuldigung erklärst du, wie der echte Täter davonkommt bzw. entlarvt wird.
- reaktion: Was der Beschuldigte in diesem Moment sagt, 1-2 Sätze wörtliche Rede, passend zu seinem Charakter.
Setze richtig auf ${richtig}.`;
}
