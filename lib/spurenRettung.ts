import { ITEMS } from "./items";
import type { SpurenZiel } from "./fallReparieren";
import type { FernwirkungsVorgabe } from "./prompts";
import type { CaseClue, Character, Item, Location } from "./types";

type SichereSpur = CaseClue & {
  beobachtung: string;
  vermutung: string;
  fernwirkung: boolean;
};

/**
 * Kostenlose Notspur, falls die Modellantwort ausbleibt oder unlösbar ist.
 *
 * Gerüst, Täter, Alibis und Hergang stehen zu diesem Zeitpunkt bereits fest.
 * Statt denselben großen Modellaufruf mehrfach zu bezahlen, legt der Server
 * daraus eine kleine, konservative Beweiskette. Sie ist absichtlich leichter
 * als eine gute Modellantwort, aber vollständig spielbar und eindeutig.
 */
export function sichereSpuren(args: {
  items: Item[];
  orte: Location[];
  besetzung: Character[];
  taeterId: string;
  mittaeterId?: string;
  ziel: SpurenZiel;
  sagaSpur?: FernwirkungsVorgabe | null;
}): { items: Item[]; spuren: SichereSpur[] } | null {
  const verdaechtige = args.besetzung.filter((c) => !c.istDetektiv);
  const taeter = verdaechtige.find((c) => c.id === args.taeterId);
  if (!taeter || args.orte.length === 0) return null;

  const mittaeter = verdaechtige.find(
    (c) => c.id === args.mittaeterId && c.id !== taeter.id,
  );
  const schuldige = [taeter, ...(mittaeter ? [mittaeter] : [])];
  const unschuldige = verdaechtige.filter(
    (c) => !schuldige.some((t) => t.id === c.id),
  );

  // Eigene Gegenstände bleiben vorn. Fehlen genügend, ergänzen die bekannten
  // Projektstücke den Fall; sie reisen im fertigen Siegel mit und sind damit
  // auch über /api/search tatsächlich auffindbar.
  const gesehen = new Set<string>();
  const pool = [...args.items, ...ITEMS].filter((item) => {
    if (!item?.id || gesehen.has(item.id)) return false;
    gesehen.add(item.id);
    return true;
  });
  const anzahl = Math.min(args.ziel.max, Math.max(args.ziel.min, args.sagaSpur ? 5 : 4));
  if (pool.length < anzahl) return null;
  const items = pool.slice(0, Math.max(args.items.length, anzahl));
  const kuerzel = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((wort) => wort[0]?.toUpperCase())
      .join("") || "?";

  const spuren: SichereSpur[] = Array.from({ length: anzahl }, (_, index) => {
    const item = items[index];
    const ort = args.orte[index % Math.min(3, args.orte.length)];
    const istFern = Boolean(args.sagaSpur) && index === 2;
    const istFaehrte = !istFern && index === anzahl - 2 && unschuldige.length > 0;
    const zielTier = istFaehrte
      ? unschuldige[0]
      : schuldige[index % schuldige.length];

    if (istFern) {
      const zeichen = args.sagaSpur?.enthuellung?.trim() || "dieselbe Markierung wie im großen Plan";
      return {
        itemId: item.id,
        ortId: ort.id,
        beobachtung: `Auf ${item.name} stehen ein wiederkehrendes Zeichen, eine Uhrzeit und die Initialen „${kuerzel(zielTier.name)}“.`,
        vermutung: "Das sieht älter aus als der heutige Fall.",
        bedeutung: args.sagaSpur?.drahtzieherName
          ? `${zeichen} Das Stück verbindet die Spur mit ${args.sagaSpur.drahtzieherName}.`
          : `${zeichen} Das Stück gehört zur Wahrheit hinter der gesamten Saga.`,
        zeigtAufCharakterId: zielTier.id,
        fuehrtInDieIrre: false,
        fernwirkung: true,
      };
    }

    if (istFaehrte) {
      return {
        itemId: item.id,
        ortId: ort.id,
        beobachtung: `An ${item.name} hängt ein loser Faden; daneben ist der Buchstabe „${kuerzel(zielTier.name)[0]}“ eingeritzt.`,
        vermutung: "Der Buchstabe könnte wichtig sein – oder absichtlich dort stehen.",
        bedeutung: `${zielTier.name} war früher hier, hatte mit der Tat aber nichts zu tun.`,
        zeigtAufCharakterId: zielTier.id,
        fuehrtInDieIrre: true,
        fernwirkung: false,
      };
    }

    // Der Fundtext nennt niemanden beim Namen - das gehört in die Bedeutung,
    // die der Spieler erst im Notizbuch liest. Sonst stünde die Lösung schon
    // in dem Moment da, in dem man das Stück aufhebt.
    const detail = index % 2 === 0
      ? `die eingeritzten Initialen „${kuerzel(zielTier.name)}“`
      : "eine Quittung, deren Name unter einem Daumenabdruck verschmiert ist";
    return {
      itemId: item.id,
      ortId: ort.id,
      beobachtung: `Auf der Innenseite von ${item.name} findet Wimpy ${detail}; der Rand ist noch frisch beschädigt.`,
      vermutung: "Jemand hat das offenbar in großer Eile zurückgelassen.",
      bedeutung: `${item.name} verbindet ${zielTier.name} direkt mit dem Tatort und widerspricht dem Alibi.`,
      zeigtAufCharakterId: zielTier.id,
      fuehrtInDieIrre: false,
      fernwirkung: false,
    };
  });

  return { items, spuren };
}
