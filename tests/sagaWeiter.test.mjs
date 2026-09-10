/**
 * Weitermachen statt von vorn: die Erzeugung mit Netz.
 *
 * Hier läuft eine ganze Saga durch - mit einem erfundenen Server, der zählt,
 * was bestellt wird, und an einer verabredeten Stelle abbricht. Danach wird
 * derselbe Auftrag noch einmal gestartet. Geprüft wird das, worauf es beim
 * Geld ankommt: Was einmal bezahlt war, darf nie ein zweites Mal bestellt
 * werden - und am Ende muss dieselbe Saga herauskommen wie ohne Abbruch.
 */
import { erzeugeSaga } from "../lib/sagaErzeugen.ts";
import { ladeEntwurf, verwirfEntwurf } from "../lib/sagaEntwurf.ts";
import { STANDARD_SAGA_VORGABEN } from "../lib/sagaTypen.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

const speicher = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (speicher.has(k) ? speicher.get(k) : null),
    setItem: (k, v) => speicher.set(k, String(v)),
    removeItem: (k) => speicher.delete(k),
  },
};

const tier = (id, name, extra = {}) => ({
  id, nummer: 1, name, tierart: "Tier", alter: 5,
  stats: {}, beschreibung: "", bild: "", istDetektiv: false, ...extra,
});

const eingaben = {
  charaktere: [tier("wimpy", "Wimpy", { istDetektiv: true }), tier("hut", "Hut"), tier("nala", "Nala")],
  orte: [{ id: "o1", stadt: "V", stadtId: "v", name: "O1", atmosphaere: "", beschreibung: "", bild: "" }],
  items: [{ id: "lupe", name: "Lupe", beschreibung: "", bild: "" }],
  vorgaben: { ...STANDARD_SAGA_VORGABEN, name: "Glocken", kapitelAnzahl: 2, finaleArt: "klassisch" },
};

/** Der erfundene Server. `stolpertBei` bricht genau einmal an dieser Stelle ab. */
function serverAufsetzen(stolpertBei) {
  const rufe = [];
  globalThis.fetch = async (pfad, init) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const marke =
      pfad === "/api/saga"
        ? `saga:${body.schritt ?? "kern"}${body.nummer ? `:${body.nummer}` : ""}`
        : `case:${body.schritt}:${body.siegel ?? body.kapitel}`;
    rufe.push(marke);

    if (stolpertBei && marke === stolpertBei) {
      throw new Error(`Abbruch bei ${marke}`);
    }

    const antwort = (daten) =>
      new Response(JSON.stringify(daten), { headers: { "Content-Type": "application/json" } });

    if (pfad === "/api/saga") {
      if (!body.schritt) {
        return antwort({
          bogenSiegel: "bogen-kern", id: "saga-1", name: "Die Glocken", thema: "T",
          klappentext: "K", auftaktText: "A", schlagworte: ["x"], kapitelAnzahl: 2,
        });
      }
      if (body.schritt === "kapitel") {
        return antwort({
          bogenSiegel: `bogen-k${body.nummer}`,
          kapitel: { nummer: body.nummer, name: `Kapitel ${body.nummer}`, teaser: "t", erzaehlerText: "e" },
        });
      }
      if (body.schritt === "finale") {
        return antwort({
          bogenSiegel: "bogen-finale",
          finale: { frage: "Wer war es?", erzaehlerText: "E", epilogText: "P" },
        });
      }
    }

    if (pfad === "/api/case") {
      if (body.schritt === "geruest") return antwort({ siegel: `g:${body.kapitel}` });
      if (body.schritt === "verdaechtige") return antwort({ siegel: `v:${body.siegel}` });
      return antwort({ fall: { id: `fall:${body.siegel}`, titel: "T" }, siegel: `f:${body.siegel}` });
    }
    throw new Error(`Unerwarteter Aufruf: ${pfad}`);
  };
  return rufe;
}

/** Wie oft eine Sorte Aufruf vorkam. */
const zaehle = (rufe, teil) => rufe.filter((r) => r.startsWith(teil)).length;

console.log("\n1. Ohne Abbruch läuft alles genau einmal");
speicher.clear();
let ohneAbbruch;
{
  const rufe = serverAufsetzen(null);
  ohneAbbruch = await erzeugeSaga(eingaben, () => {}, ladeEntwurf());
  pruefe("der Kern einmal", zaehle(rufe, "saga:kern") === 1);
  pruefe("beide Kapitel einmal", zaehle(rufe, "saga:kapitel") === 2);
  pruefe("das Finale einmal", zaehle(rufe, "saga:finale") === 1);
  pruefe("drei Fälle (zwei Kapitel und das Finale)", zaehle(rufe, "case:geruest") === 3);
  pruefe("die Saga ist vollständig", ohneAbbruch.kapitel.length === 2 && Boolean(ohneAbbruch.finale.fall));
  pruefe("der Finalfall ist gebaut", ohneAbbruch.finale.siegel !== null);
}

console.log("\n2. Abbruch im letzten Fall - der zweite Anlauf holt nur den Rest");
{
  speicher.clear();
  verwirfEntwurf();

  // Erster Anlauf: Es hängt beim Gerüst des Finalfalls (kapitel 0).
  const ersteRufe = serverAufsetzen("case:geruest:0");
  let gescheitert = false;
  try {
    await erzeugeSaga(eingaben, () => {}, ladeEntwurf());
  } catch {
    gescheitert = true;
  }
  pruefe("der erste Anlauf bricht ab", gescheitert);
  pruefe("aber das Meiste war schon bestellt", zaehle(ersteRufe, "saga:") >= 4);

  const stand = ladeEntwurf();
  pruefe("ein Zwischenstand liegt da", Boolean(stand));
  pruefe("mit dem Kern", Boolean(stand?.kern));
  pruefe("mit beiden Kapiteln", stand?.kapitel.length === 2);
  pruefe("mit dem Finale", Boolean(stand?.finale));
  pruefe("und den beiden fertigen Fällen", Object.keys(stand?.faelle ?? {}).length === 2);

  // Zweiter Anlauf: derselbe Auftrag, diesmal ohne Stolperstein.
  const zweiteRufe = serverAufsetzen(null);
  const saga = await erzeugeSaga(eingaben, () => {}, ladeEntwurf());

  pruefe("der Kern wird nicht neu bestellt", zaehle(zweiteRufe, "saga:kern") === 0);
  pruefe("die Kapitel auch nicht", zaehle(zweiteRufe, "saga:kapitel") === 0);
  pruefe("das Finale auch nicht", zaehle(zweiteRufe, "saga:finale") === 0);
  pruefe("die fertigen Fälle auch nicht", zaehle(zweiteRufe, "case:geruest") === 1);
  pruefe("nur der Finalfall wird geholt", zweiteRufe.includes("case:geruest:0"));

  pruefe("die Saga ist trotzdem vollständig", saga.kapitel.length === 2);
  pruefe("mit demselben Namen wie ohne Abbruch", saga.name === ohneAbbruch.name);
  pruefe("denselben Kapiteltexten", saga.kapitel[1].name === ohneAbbruch.kapitel[1].name);
  pruefe("demselben Bogen", saga.bogenSiegel === ohneAbbruch.bogenSiegel);
  pruefe("und derselben Finalfrage", saga.finale.frage === ohneAbbruch.finale.frage);
}

console.log("\n3. Ein Stand einer anderen Bestellung wird nicht angefasst");
{
  speicher.clear();
  const ersteRufe = serverAufsetzen("saga:finale");
  try {
    await erzeugeSaga(eingaben, () => {}, ladeEntwurf());
  } catch {
    // erwartet
  }
  pruefe("es liegt ein Stand da", Boolean(ladeEntwurf()));
  pruefe("der erste Anlauf hat Kapitel bestellt", zaehle(ersteRufe, "saga:kapitel") === 2);

  // Andere Vorgaben: Der alte Stand passt nicht mehr und wird übergangen.
  const zweiteRufe = serverAufsetzen(null);
  const andere = {
    ...eingaben,
    vorgaben: { ...eingaben.vorgaben, kapitelAnzahl: 3, name: "Ganz anders" },
  };
  const saga = await erzeugeSaga(andere, () => {}, ladeEntwurf());
  pruefe("der Kern wird neu bestellt", zaehle(zweiteRufe, "saga:kern") === 1);
  pruefe("und die Kapitel auch", zaehle(zweiteRufe, "saga:kapitel") === 3);
  pruefe("die neue Saga steht", saga.kapitel.length === 3);
}

console.log("\n4. Nach dem Abbruch weiß der Stand, wo es hing");
{
  speicher.clear();
  serverAufsetzen("saga:kapitel:2");
  try {
    await erzeugeSaga(eingaben, () => {}, ladeEntwurf());
  } catch {
    // erwartet
  }
  const stand = ladeEntwurf();
  pruefe("der Kern ist gesichert", Boolean(stand?.kern));
  pruefe("das erste Kapitel auch", stand?.kapitel.length === 1);
  pruefe("das zweite noch nicht", stand?.kapitel.length !== 2);
  pruefe("das Siegel steht auf dem letzten Schritt", stand?.siegel === "bogen-k1");
  pruefe("es ist noch kein Fall gebaut", Object.keys(stand?.faelle ?? {}).length === 0);
}

console.log("\n5. Der Gerichtssaal: Saal und Beweisstücke sind zwei Schritte");
{
  speicher.clear();
  const vorGericht = {
    ...eingaben,
    vorgaben: { ...eingaben.vorgaben, finaleArt: "gericht", name: "Vor Gericht" },
  };

  // Der Server liefert das Finale in zwei Teilen - wie der echte.
  const bauServer = (stolpertBei) => {
    const rufe = [];
    globalThis.fetch = async (pfad, init) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const marke =
        pfad === "/api/saga"
          ? `saga:${body.schritt ?? "kern"}${body.nummer ? `:${body.nummer}` : ""}`
          : `case:${body.schritt}:${body.siegel ?? body.kapitel}`;
      rufe.push(marke);
      if (stolpertBei && marke === stolpertBei) throw new Error("Abbruch");

      const antwort = (daten) =>
        new Response(JSON.stringify(daten), { headers: { "Content-Type": "application/json" } });

      if (pfad === "/api/saga") {
        if (!body.schritt) {
          return antwort({
            bogenSiegel: "bogen-kern", id: "saga-2", name: "Vor Gericht", thema: "T",
            klappentext: "K", auftaktText: "A", schlagworte: [], kapitelAnzahl: 2,
          });
        }
        if (body.schritt === "kapitel") {
          return antwort({
            bogenSiegel: `bogen-k${body.nummer}`,
            kapitel: { nummer: body.nummer, name: `Kapitel ${body.nummer}`, teaser: "t", erzaehlerText: "e" },
          });
        }
        if (body.schritt === "finale") {
          return antwort({
            bogenSiegel: "bogen-finale",
            finale: { frage: "Wer?", erzaehlerText: "E", epilogText: "P" },
            verhandlung: { art: "gericht", richterId: "oeho", anklage: "A", beweise: [], noetig: 3, fehlgriffe: 2 },
            weiter: "beweise",
          });
        }
        if (body.schritt === "beweise") {
          return antwort({
            bogenSiegel: "bogen-beweise",
            beweise: [
              { id: "b1", name: "Eins", herkunft: "K1", text: "t" },
              { id: "b2", name: "Zwei", herkunft: "K2", text: "t" },
              { id: "b3", name: "Drei", herkunft: "K2", text: "t" },
            ],
            noetig: 2,
          });
        }
      }
      if (pfad === "/api/case") {
        if (body.schritt === "geruest") return antwort({ siegel: `g:${body.kapitel}` });
        if (body.schritt === "verdaechtige") return antwort({ siegel: `v:${body.siegel}` });
        return antwort({ fall: { id: `fall:${body.siegel}` }, siegel: `f:${body.siegel}` });
      }
      throw new Error("Unerwartet");
    };
    return rufe;
  };

  // Erster Anlauf: Es hängt genau zwischen Saal und Beweisstücken.
  const ersteRufe = bauServer("saga:beweise");
  let gescheitert = false;
  try {
    await erzeugeSaga(vorGericht, () => {}, ladeEntwurf());
  } catch {
    gescheitert = true;
  }
  pruefe("der erste Anlauf bricht ab", gescheitert);
  pruefe("der Saal war schon bestellt", zaehle(ersteRufe, "saga:finale") === 1);

  const stand = ladeEntwurf();
  pruefe("der Saal ist gesichert", Boolean(stand?.verhandlung));
  pruefe("aber noch ohne Beweisstücke", stand?.beweiseFertig === false);

  const zweiteRufe = bauServer(null);
  const saga = await erzeugeSaga(vorGericht, () => {}, ladeEntwurf());
  pruefe("der Saal wird nicht neu bestellt", zaehle(zweiteRufe, "saga:finale") === 0);
  pruefe("nur die Beweisstücke", zaehle(zweiteRufe, "saga:beweise") === 1);
  pruefe("die Verhandlung ist vollständig", saga.finale.verhandlung?.beweise.length === 3);
  pruefe("und es gibt keinen Finalfall", saga.finale.fall === null);
  pruefe("die Kapitelfälle stehen", saga.kapitel.every((k) => Boolean(k.siegel)));
}

console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.` : "\nAlles gut.");
process.exit(fehlgeschlagen ? 1 : 0);
