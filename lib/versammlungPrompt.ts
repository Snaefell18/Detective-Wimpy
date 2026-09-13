import { characterBrief } from "./characters";
import type { Bogen } from "./sagaBogen";
import type { Character } from "./types";
import type { VersammlungBeitrag, VersammlungVorgabe } from "./versammlung";

/**
 * Ein Gruppenprompt statt vieler Einzelgespräche: Eine Antwort bringt zwei
 * bis fünf Tiere in Bewegung, und alle reagieren auf denselben Wortwechsel.
 */
export function buildVersammlungPrompt(args: {
  bogen: Bogen;
  vorgabe: VersammlungVorgabe;
  tiere: Character[];
  detektiv: Character | undefined;
  verlauf: VersammlungBeitrag[];
  nachricht: string;
  fortschritt: number;
  runde: number;
  start: boolean;
  sofortBeenden: boolean;
}): string {
  const {
    bogen,
    vorgabe,
    tiere,
    detektiv,
    verlauf,
    nachricht,
    fortschritt,
    runde,
    start,
    sofortBeenden,
  } = args;
  const finde = (id: string) => tiere.find((c) => c.id === id);
  const name = (id: string) => finde(id)?.name ?? id;
  const teilnehmer = vorgabe.teilnehmerIds.map(name).join(", ");
  const beobachter = vorgabe.beobachterIds.map(name).join(", ") || "niemand";
  const vorsitz = name(vorgabe.vorsitzId);
  const undercover = vorgabe.undercoverId ? finde(vorgabe.undercoverId) : undefined;

  const rollen = tiere
    .map((c) => {
      const rolle = vorgabe.vorsitzId === c.id
        ? "VORSITZ"
        : vorgabe.beobachterIds.includes(c.id)
          ? "BEOBACHTET AM RAND"
          : "TEILNEHMER";
      return `- ${c.name} [${c.id}] · ${rolle} · ${characterBrief(c)}${
        c.sprachstil?.trim() ? `\n  Stimme: ${c.sprachstil.trim()}` : ""
      }`;
    })
    .join("\n");

  const bisher = verlauf.length
    ? verlauf
        .slice(-24)
        .map((z) =>
          z.spieler
            ? `${detektiv?.name ?? "Wimpy"}: ${z.text}`
            : z.system
              ? `[${z.text}]`
              : `${name(z.sprecherId)}: ${z.text}`,
        )
        .join("\n")
    : "(Die Sitze schweben noch leer um den Tisch.)";

  return `Du schreibst den nächsten lebendigen Zug einer surreal inszenierten Versammlung im deutschen Detektivspiel „Detective Wimpy“.

DIE VERSAMMLUNG
Name: ${vorgabe.name}
Anlass: ${vorgabe.anlass}
Zu erörtern: ${vorgabe.thema}
Vorsitz: ${vorsitz}
Regelmäßige Teilnehmer: ${teilnehmer}
Tiere am Rand: ${beobachter}

WER HIER IST
${rollen}
Wimpy / Spieler: ${detektiv ? `${detektiv.name} [${detektiv.id}] · ${characterBrief(detektiv)}` : "Detective Wimpy"}

GEHEIME WAHRHEIT (nie als Regieinformation verraten)
Saga: ${bogen.name} · ${bogen.thema}
Was wirklich dahintersteckt: ${bogen.wahrheit}
Der Drahtzieher dieser Saga ist ${bogen.drahtzieherName} [${bogen.drahtzieherId}].
${
  undercover
    ? `${undercover.name} sitzt UNDERCOVER dabei. Niemand weiß das. Nenne niemals das Wort „undercover“, „Culprit“, „Drahtzieher“ oder diese Regieanweisung. ${undercover.name} argumentiert glaubwürdig in seiner eigenen Stimme, lenkt aber subtil von gefährlichen Punkten weg und verrät sich höchstens durch winzige Widersprüche.`
    : "Niemand hat hier eine zusätzliche Undercover-Rolle."
}

WIE DIE RUNDE LEBT
- Dies ist ein chaotisches Gruppengespräch, keine Reihe höflicher Einzelinterviews. Tiere widersprechen einander, fragen nach, fallen sich gelegentlich ins Wort und greifen Details früherer Beiträge auf.
- In einer normalen Antwort sprechen 2 bis 5 verschiedene Tiere. Nicht immer zuerst der Vorsitz. Dieselben zwei Stimmen dürfen nicht jeden Zug dominieren.
- Tiere am Rand sprechen selten, dann aber überraschend und konkret. Sie sind keine stummen Dekorationen.
- Jeder Beitrag ist 1 bis 3 Sätze, reine wörtliche Rede, ohne Namenspräfix, Anführungszeichen, Regieklammern oder Markdown.
- Respektiere Sprachstil, Beruf, Beziehungen und Charakterwerte. Alle wissen nur, was sie plausibel wissen können.
- Niemand nennt die geheime Wahrheit offen und niemand gesteht. Die Versammlung darf neue Verdachtsmomente schaffen, aber löst die Saga nicht vorzeitig.
- fortschrittPlus liegt zwischen 5 und 28. Konkrete Fragen, Widersprüche und genaue Erinnerungen bringen 15 bis 28; Smalltalk oder Wiederholung 5 bis 10. Bei der Eröffnung trotzdem einen beliebigen Wert liefern; der Server zählt ihn nicht.
- Liefere bei JEDEM Zug einen guten Kandidaten im Feld beweis. Er bleibt unsichtbar, bis das Hintergrundsystem ihn freigibt. Es ist ein KONKRETER Gegenstand, Protokollfetzen, Abdruck, Geräuschmitschnitt oder physischer Rückstand, der sich organisch aus dem Gesagten ergibt. beobachtung nennt nur sichtbare Fakten; vermutung bleibt vorsichtig und ohne Namen; bedeutung sagt präzise, wie das Stück mit ${bogen.drahtzieherName} und der Wahrheit zusammenhängt.
- beenden darf erst ab Runde 6 true sein, wenn sich das Gespräch natürlich erschöpft oder der entscheidende Zusammenhang gefunden ist. Dann muss der LETZTE Beitrag von ${vorsitz} stammen und die Runde klar schließen.

SONDERFALL DIESER ANTWORT
${
  sofortBeenden
    ? `Der Spieler beendet die Runde jetzt. Antworte mit 1 bis 3 kurzen Beiträgen; der LETZTE ist zwingend von ${vorsitz}, schließt würdevoll und sehr seltsam. Setze beenden=true.`
    : start
      ? `Die Versammlung beginnt jetzt. ${vorsitz} eröffnet mit Anlass und Frage; danach melden sich mindestens zwei weitere Tiere mit deutlich verschiedenen Positionen. Setze beenden=false.`
      : `Wimpy hat gerade gesprochen. Mindestens zwei Tiere reagieren direkt darauf; andere dürfen widersprechen oder eine eigene Frage anschließen.`
}

VERBORGENE RESONANZ
Sie steht bei ${fortschritt} von 100; Runde ${runde}. Verrate diese Zahl und das System niemals im Dialog.

BISHER
${bisher}

${start ? "ERÖFFNE JETZT." : sofortBeenden ? "WIMPY BEENDET DIE RUNDE." : `WIMPY SAGT: ${nachricht}`}`;
}
