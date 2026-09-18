/**
 * Der Showdown: Wimpy gegen den Culprit.
 *
 * Geprüft wird die Rechnung, nicht das Bild - genau deshalb liegt sie in
 * lib/kampf.ts und nicht in der Szene. Vier Dinge müssen stimmen, sonst ist
 * der Kampf entweder unfair oder langweilig:
 *
 *   1. Nichts trifft ohne Ansage: Der Gegner holt sichtbar aus, und erst am
 *      Ende der Ausholzeit tut es weh.
 *   2. Ausweichen wird belohnt: Rolle und Schutzzeit machen unverwundbar,
 *      und wer sauber spielt, teilt mehr aus.
 *   3. Der Kampf endet - und zwar in beide Richtungen.
 *   4. Die Arena aus dem Editor überlebt den Weg durch die Datenbank.
 */
import {
  BETAEUBT_ZEIT,
  GEGNER_SCHLAG_TREFFER,
  KAMPF_STUFEN,
  ROLLE_DAUER,
  SCHLAG_REICHWEITE,
  SCHUSS_PAUSE,
  SCHUTZ_ZEIT,
  ZAUBER_REICHWEITE,
  angriffSchaden,
  angriffWaehlen,
  ausholFortschritt,
  darfRollen,
  darfSchiessen,
  darfSchlagen,
  gegnerDenken,
  gegnerTempo,
  gegnerTreffen,
  kampfClips,
  neuerKampf,
  rolleGesetzt,
  salvenBreite,
  schlagGesetzt,
  schussGesetzt,
  uhrWeiter,
  werteFuer,
  wimpyTreffen,
  wucht,
} from "../lib/kampf.ts";
import {
  GROESSE_GRENZEN,
  MINDEST_FELDER,
  STANDARD_KAMPF,
  arenaPlan,
  kampfLesen,
  kampfSpielbar,
  kampfSpruch,
  kampfZeile,
  neueKampfJagd,
  sagaKampf,
} from "../lib/endkampf.ts";
import { arcKampf, leererArc } from "../lib/arcTypen.ts";
import { FINALE_ARTEN, mitAnklage, mitVerhandlung } from "../lib/sagaFinale.ts";
import { STANDARD_SAGA_VORGABEN } from "../lib/sagaTypen.ts";
import { SagaVorgabenSchema } from "../lib/schemas.ts";
import { ANIMATIONS_MODELLE } from "../lib/animations.generated.ts";
import { STRASSE, beispielPlan, feldSetzen, leererPlan, strassenFelder } from "../lib/stadtplan.ts";

let fehlgeschlagen = 0;
const pruefe = (name, ok, zusatz = "") => {
  console.log(`  ${ok ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!ok) fehlgeschlagen++;
};

/** Ein Kampf auf mittlerer Stufe - der gedachte Normalfall. */
const frisch = (stufe = "mittel") => neuerKampf(werteFuer(stufe));

/** Die Uhr so weit vorstellen, bis etwas passiert - in Schritten wie im Spiel. */
const laufen = (stand, sekunden, dt = 1 / 60) => {
  let jetzt = stand;
  for (let i = 0; i < Math.round(sekunden / dt); i++) jetzt = uhrWeiter(jetzt, dt);
  return jetzt;
};

console.log("\n1. Die Stufen: sanft ist wirklich sanfter");
{
  pruefe("es gibt drei", KAMPF_STUFEN.length === 3);
  const sanft = werteFuer("sanft");
  const hart = werteFuer("hart");
  pruefe("der harte Gegner hält mehr aus", hart.gegnerLeben > sanft.gegnerLeben);
  pruefe("und schlägt härter zu", hart.gegnerSchlag > sanft.gegnerSchlag);
  pruefe("dafür hat man sanft mehr Zeit zum Ausweichen", sanft.ausholen > hart.ausholen);
  pruefe("Wimpy ist immer schneller als der Gegner", sanft.wimpyTempo > hart.gegnerTempo);
  pruefe("eine unbekannte Stufe fällt auf Mittel zurück", werteFuer(undefined).gegnerLeben === werteFuer("mittel").gegnerLeben);
}

console.log("\n2. Nichts trifft ohne Ansage");
{
  let stand = frisch();
  // Die Anfangspause läuft ab, der Gegner steht in Schlagweite.
  stand = laufen(stand, 2);
  const entschluss = gegnerDenken(stand, { abstand: 2.5, zufall: () => 0.9 });
  pruefe("er holt aus, statt sofort zu treffen", entschluss.stand.gegner.zustand === "ausholen");
  pruefe("und dabei fliegt noch nichts", entschluss.ausloesen === null);
  pruefe("ausgeholt wird auf einen Schlag", entschluss.stand.gegner.angriff === "schlag");
  pruefe("der Fortschritt fängt bei null an", ausholFortschritt(entschluss.stand) < 0.05);

  // Mitten im Ausholen: immer noch nichts.
  const halb = laufen(entschluss.stand, werteFuer("mittel").ausholen / 2);
  pruefe("auf halbem Weg passiert nichts", gegnerDenken(halb, { abstand: 2.5 }).ausloesen === null);
  pruefe("die Warnung ist aber sichtbar fortgeschritten", ausholFortschritt(halb) > 0.4 && ausholFortschritt(halb) < 0.6);

  // Und am Ende schlägt es ein.
  const fertig = laufen(halb, werteFuer("mittel").ausholen);
  const schlag = gegnerDenken(fertig, { abstand: 2.5 });
  pruefe("erst am Ende der Ausholzeit trifft es", schlag.ausloesen === "schlag");
  pruefe("danach steht er einen Moment offen", schlag.stand.gegner.zustand === "nachhall");
  pruefe("und wartet vor dem nächsten Angriff", schlag.stand.gegner.pause > 0);
  pruefe("wer ausholt, bleibt stehen", gegnerTempo(entschluss.stand) === 0);
  pruefe("wer jagt, läuft", gegnerTempo(stand) > 0);
}

console.log("\n3. Was er sich aussucht");
{
  pruefe("dicht davor wird geschlagen", angriffWaehlen(1, 2, () => 0.5) === "schlag");
  pruefe("in der ersten Phase nie gestampft", angriffWaehlen(1, 2, () => 0.01) === "schlag");
  pruefe("wütend kommt auch die Welle", angriffWaehlen(2, 2, () => 0.01) === "stampf");
  pruefe("auf mittlerer Entfernung wird gezaubert", angriffWaehlen(1, ZAUBER_REICHWEITE - 1, () => 0.5) === "zauber");
  pruefe("ganz weit weg läuft er erst einmal", angriffWaehlen(1, ZAUBER_REICHWEITE + 5, () => 0.5) === null);
  pruefe("die Schlaggrenze liegt unter der Zaubergrenze", GEGNER_SCHLAG_TREFFER < ZAUBER_REICHWEITE);

  const stand = frisch();
  pruefe("eine Salve ist anfangs eine Kugel", salvenBreite(stand) === 1);
  const wuetend = { ...stand, gegner: { ...stand.gegner, phase: 2 } };
  pruefe("und wütend sind es drei", salvenBreite(wuetend) === 3);
  pruefe("wütend läuft er schneller", gegnerTempo(wuetend) > gegnerTempo(stand));
  pruefe("ein Stampfer tut mehr weh als eine Kugel",
    angriffSchaden(stand, "stampf") > angriffSchaden(stand, "zauber"));
}

console.log("\n4. Ausweichen wird belohnt");
{
  let stand = frisch();
  pruefe("rollen darf man sofort", darfRollen(stand));
  stand = rolleGesetzt(stand);
  pruefe("in der Rolle ist man unverwundbar", stand.wimpy.schutz >= ROLLE_DAUER);
  const daneben = wimpyTreffen(stand, 30);
  pruefe("ein Treffer in der Rolle geht ins Leere", !daneben.getroffen && daneben.stand.wimpy.leben === stand.wimpy.leben);
  pruefe("und zweimal hintereinander rollt niemand", !darfRollen(stand));

  // Nach der Rolle ist der Schutz weg, der Treffer sitzt.
  const spaeter = laufen(stand, ROLLE_DAUER + 0.1);
  const sitzt = wimpyTreffen(spaeter, 12);
  pruefe("danach trifft es", sitzt.getroffen && sitzt.stand.wimpy.leben === stand.wimpy.maxLeben - 12);
  pruefe("und man blinkt kurz", sitzt.stand.wimpy.schutz === SCHUTZ_ZEIT);
  pruefe("ein zweiter Treffer im Blinken zählt nicht", !wimpyTreffen(sitzt.stand, 12).getroffen);
}

console.log("\n5. Die Kombo: sauber spielen lohnt sich");
{
  let stand = frisch();
  pruefe("ohne Kombo volle, aber einfache Wucht", wucht(stand) === 1);
  for (let i = 0; i < 12; i++) stand = gegnerTreffen(stand, "schuss").stand;
  pruefe("zwölf Treffer am Stück zählen", stand.wimpy.kombo === 12);
  pruefe("und teilen mehr aus", wucht(stand) > 1.2);
  pruefe("mehr als anderthalbfach wird es nie", wucht({ ...stand, wimpy: { ...stand.wimpy, kombo: 999 } }) === 1.5);
  const getroffen = wimpyTreffen(stand, 10).stand;
  pruefe("ein Treffer setzt die Kombo zurück", getroffen.wimpy.kombo === 0);
  pruefe("die beste bleibt aber stehen", getroffen.wimpy.besteKombo === 12);
}

console.log("\n6. Der Wutausbruch auf halbem Weg");
{
  let stand = frisch("sanft");
  let wechsel = false;
  // So lange draufhalten, bis die Hälfte weg ist.
  for (let i = 0; i < 40 && !wechsel; i++) {
    const treffer = gegnerTreffen(stand, "schlag");
    stand = treffer.stand;
    wechsel = treffer.phaseWechsel;
  }
  pruefe("bei der Hälfte kippt er in die zweite Phase", wechsel && stand.gegner.phase === 2);
  pruefe("und taumelt erst einmal", stand.gegner.zustand === "betaeubt" && stand.gegner.rest === BETAEUBT_ZEIT);
  pruefe("ein Taumelnder holt nicht aus", gegnerDenken(stand, { abstand: 2 }).ausloesen === null);
  const doppelt = gegnerTreffen(stand, "schuss").schaden;
  const einfach = gegnerTreffen({ ...stand, gegner: { ...stand.gegner, zustand: "jagen" } }, "schuss").schaden;
  // Auf ganze Zahlen gerundet wird einmal vor und einmal nach der Verdopplung -
  // um ein Pünktchen darf das auseinandergehen.
  pruefe("im Taumeln steckt er doppelt ein", Math.abs(doppelt - einfach * 2) <= 1, `${doppelt} statt ${einfach}`);
  pruefe("ein zweiter Wutausbruch kommt nicht", !gegnerTreffen(stand, "schlag").phaseWechsel);
}

console.log("\n7. Der Kampf endet - in beide Richtungen");
{
  let stand = frisch("sanft");
  let runden = 0;
  while (stand.ergebnis === "laeuft" && runden < 200) {
    stand = gegnerTreffen(stand, "schlag").stand;
    runden++;
  }
  pruefe("genug Schläge gewinnen ihn", stand.ergebnis === "gewonnen", `${runden} Schläge`);
  pruefe("das dauert eine Weile", runden > 5);
  pruefe("ein gewonnener Kampf nimmt keinen Schaden mehr", gegnerTreffen(stand, "schuss").schaden === 0);

  let verloren = frisch("hart");
  runden = 0;
  while (verloren.ergebnis === "laeuft" && runden < 200) {
    verloren = wimpyTreffen(laufen(verloren, SCHUTZ_ZEIT + 0.05), verloren.werte.gegnerSchlag).stand;
    runden++;
  }
  pruefe("genug Treffer verlieren ihn", verloren.ergebnis === "verloren", `${runden} Treffer`);
  pruefe("aber auf der harten Stufe hält man mehr als fünf aus", runden > 5);
}

console.log("\n8. Die Knöpfe: Pausen und Reichweiten");
{
  let stand = frisch();
  pruefe("zaubern geht sofort", darfSchiessen(stand));
  stand = schussGesetzt(stand);
  pruefe("danach kurz nicht mehr", !darfSchiessen(stand));
  pruefe("aber wirklich nur kurz", darfSchiessen(laufen(stand, SCHUSS_PAUSE + 0.02)));

  const nah = frisch();
  pruefe("aus der Ferne wird nicht geschlagen", !darfSchlagen(nah, SCHLAG_REICHWEITE + 1));
  pruefe("direkt davor schon", darfSchlagen(nah, SCHLAG_REICHWEITE - 0.5));
  const geschlagen = schlagGesetzt(nah);
  pruefe("nach dem Schlag ist der Nahkampf zu", !darfSchlagen(geschlagen, 1));
  pruefe("und der Zauber auch kurz gesperrt", !darfSchiessen(geschlagen));
  pruefe("ein Schlag tut mehr weh als eine Kugel", nah.werte.schlag > nah.werte.schuss);
  pruefe("in der Rolle kämpft man nicht", !darfSchiessen(rolleGesetzt(nah)));
}

console.log("\n9. Welche Animation wozu passt");
{
  const wimpy = ANIMATIONS_MODELLE.find((m) => m.id === "wimpy");
  const clips = kampfClips(wimpy?.animationen ?? []);
  pruefe("Wimpy wirft mit dem Baseballwurf", clips.wurf === "baseball_pitching", String(clips.wurf));
  pruefe("er läuft mit einem Laufclip", /run/i.test(clips.lauf ?? ""), String(clips.lauf));
  pruefe("er steht mit einem Idle", /idle|rest/i.test(clips.ruhe ?? ""), String(clips.ruhe));
  pruefe("und tanzt nach dem Sieg", /danc|shake|funny/i.test(clips.jubel ?? ""), String(clips.jubel));

  const yeti = kampfClips(ANIMATIONS_MODELLE.find((m) => m.id === "yeti")?.animationen ?? []);
  pruefe("der Yeti stampft auf", yeti.schlag === "Angry_Ground_Stomp", String(yeti.schlag));

  const karg = kampfClips(["Armature|Unreal Take|baselayer"]);
  pruefe("ein Modell mit nur einem Clip friert nicht ein",
    karg.lauf === "Armature|Unreal Take|baselayer" && karg.schlag === karg.lauf && karg.jubel === karg.lauf);
  const leer = kampfClips([]);
  pruefe("und ganz ohne Clips gibt es keinen Absturz", leer.lauf === null && leer.wurf === null);

  /*
   * Und die Niederlage.
   *
   * Sie ist die einzige Kategorie ohne Ersatz: Lieber gar kein Clip - dann
   * kippt die Figur still um - als ein Tanz, während jemand zu Boden geht.
   */
  const boeser = kampfClips(["Walking", "Punch_Combo_1", "Knock_Down", "Idle_3", "Cardio_Dance"]);
  pruefe("wer am Boden liegt, wird umgehauen", boeser.besiegt === "Knock_Down", String(boeser.besiegt));
  pruefe("und das ist nicht sein Schlag", boeser.schlag !== boeser.besiegt, String(boeser.schlag));
  pruefe("und nicht sein Jubel", boeser.jubel !== boeser.besiegt, String(boeser.jubel));

  pruefe(
    "auch Luftschnappen zählt",
    kampfClips(["Walking", "Catching_Breath", "Idle_3"]).besiegt === "Catching_Breath",
  );
  pruefe(
    "ein Angriff mit „Down“ im Namen nicht",
    kampfClips(["Walking", "Male_Head_Down_Charge", "Idle_3"]).besiegt === null,
  );
  pruefe("ohne passenden Clip bleibt es leer", karg.besiegt === null, String(karg.besiegt));
  pruefe("und ganz ohne Clips auch", leer.besiegt === null);
}

console.log("\n10. Die Arena");
{
  const plan = arenaPlan(9, 9);
  pruefe("die Mitte ist frei begehbar", strassenFelder(plan).length === 49, `${strassenFelder(plan).length} Felder`);
  pruefe("und der Rand zugebaut", plan.felder[0] !== STRASSE && plan.felder[0] !== "");
  pruefe("sie ist damit spielbar", kampfSpielbar({ ...STANDARD_KAMPF, plan }));
  pruefe("höchstens zwei Bauarten - das Handy dankt",
    new Set(plan.felder.filter((f) => f && f !== STRASSE)).size <= 2);

  pruefe("ohne Plan wird nicht gekämpft", !kampfSpielbar(STANDARD_KAMPF));
  pruefe("und auf einer Briefmarke auch nicht",
    !kampfSpielbar({ ...STANDARD_KAMPF, plan: feldSetzen(feldSetzen(leererPlan(3, 3), 1, 1, STRASSE), 1, 2, STRASSE) }));
  const gerade = beispielPlan(7, 7);
  pruefe("eine Kreuzung reicht dagegen",
    kampfSpielbar({ ...STANDARD_KAMPF, plan: gerade }) && strassenFelder(gerade).length >= MINDEST_FELDER);
  pruefe("die Zeile sagt, was dasteht", kampfZeile({ ...STANDARD_KAMPF, plan }).includes("9×9"));
  pruefe("ohne Arena sagt sie das auch", kampfZeile(STANDARD_KAMPF).includes("Noch keine Arena"));
}

console.log("\n11. Der Weg durch die Datenbank");
{
  const gespeichert = {
    plan: arenaPlan(9, 9),
    strassentyp: "schnee",
    tageszeit: "nacht",
    wetter: "schneesturm",
    gegnerModell: "yeti",
    gegnerGroesse: 1.8,
    stufe: "hart",
    musik: "teufel",
    spruch: "Das war erst der Anfang.",
    jagd: neueKampfJagd("hut", "Der Schattenkanzler"),
  };
  const gelesen = kampfLesen(JSON.parse(JSON.stringify(gespeichert)));
  pruefe("alles kommt heil zurück",
    gelesen?.stufe === "hart" && gelesen.gegnerModell === "yeti" && gelesen.wetter === "schneesturm");
  pruefe("die Arena auch", kampfSpielbar(gelesen));
  pruefe("die Bausteinliste kommt aus dem Plan", (gelesen?.locations.length ?? 0) > 0);
  pruefe("die Jagd bleibt am Finale hängen", gelesen?.jagd?.nachKapitel === 0 && gelesen.jagd.fliehenderId === "hut");
  pruefe("die Strecke der Jagd kommt mit",
    kampfLesen({
      ...gespeichert,
      jagd: { ...gespeichert.jagd, strassentyp: "asphalt", tageszeit: "tag", wetter: "regen" },
    })?.jagd?.wetter === "regen");
  pruefe("und eine alte Jagd fährt weiter durch den Schnee",
    gelesen?.jagd?.strassentyp === "schnee" && gelesen.jagd.tageszeit === "nacht");
  pruefe("auch im Sandsturm wird gekämpft",
    kampfLesen({ ...gespeichert, wetter: "sandsturm", strassentyp: "sand" })?.wetter === "sandsturm");

  const mist = kampfLesen({ plan: { breite: "viel", felder: 3 }, stufe: "unmöglich", gegnerGroesse: 99 });
  pruefe("Unsinn wird zu einer leeren, unspielbaren Vorgabe", mist !== null && !kampfSpielbar(mist));
  pruefe("und die Stufe fällt zurück", mist?.stufe === "mittel");
  pruefe("die Größe bleibt im Rahmen", mist?.gegnerGroesse === GROESSE_GRENZEN.max);
  pruefe("gar nichts bleibt gar nichts", kampfLesen(null) === null && kampfLesen("hm") === null);
  pruefe("eine Jagd ohne Fliehenden ist keine", kampfLesen({ jagd: { name: "leer" } })?.jagd === null);
}

console.log("\n12. Der Arc fällt nie in ein leeres Finale");
{
  const arc = leererArc();
  pruefe("ohne Kampf-Art kein Kampf", arcKampf({ ...arc, finale: { ...arc.finale, art: "text" } }) === null);
  /*
   * Aber mit Kampf-Art und ohne gebaute Arena fällt das Finale nicht aus:
   * Dann steht der Standardkampfplatz da. Ein Arc, der auf den Showdown
   * zuläuft, soll nicht still in seinen Abschlusstext springen.
   */
  pruefe("mit Art, aber ohne Arena springt der Standardplatz ein",
    kampfSpielbar(arcKampf({ ...arc, finale: { ...arc.finale, art: "kampf" } })));
  const fertig = {
    ...arc,
    finale: { ...arc.finale, art: "kampf", kampf: { ...STANDARD_KAMPF, plan: arenaPlan(9, 9) } },
  };
  pruefe("mit Arena schon", arcKampf(fertig)?.plan !== undefined);
  pruefe("ein leeres Statement bekommt einen Satz",
    kampfSpruch(STANDARD_KAMPF, "Hut").includes("Hut"));
  pruefe("ein eigenes bleibt, wie es ist",
    kampfSpruch({ ...STANDARD_KAMPF, spruch: "Nie!" }, "Hut") === "Nie!");
}

console.log("\n13. Auch eine Saga darf im Kampf enden");
{
  const arena = { ...STANDARD_KAMPF, plan: arenaPlan(9, 9) };
  pruefe("die Art steht zur Wahl", FINALE_ARTEN.some((a) => a.id === "kampf"));
  pruefe("sie führt nicht in den Saal", !mitVerhandlung("kampf") && !mitAnklage("kampf"));
  pruefe("ohne die Art kein Kampf", sagaKampf({ finaleArt: "klassisch", kampf: arena }) === null);
  pruefe("mit beidem schon", sagaKampf({ finaleArt: "kampf", kampf: arena }) === arena);
  /*
   * Und ohne gebaute Arena fällt das Finale nicht aus, sondern bekommt den
   * Standardkampfplatz: Wer "Showdown" wählt, hat sich für ein Ende mit
   * Kampf entschieden - ein ungedrückter Knopf im Editor darf es ihm nicht
   * nehmen.
   */
  pruefe("mit Art, aber ohne Arena springt der Standardplatz ein",
    kampfSpielbar(sagaKampf({ finaleArt: "kampf" })));
  pruefe("und behält, was sonst eingestellt war", (() => {
    const ersatz = sagaKampf({ finaleArt: "kampf", kampf: { ...STANDARD_KAMPF, plan: null, stufe: "hart", musik: "/audio/x.mp3" } });
    return ersatz?.stufe === "hart" && ersatz?.musik === "/audio/x.mp3";
  })());
  pruefe("eine abgewählte Jagd bleibt abgewählt",
    sagaKampf({ finaleArt: "kampf", kampf: { ...STANDARD_KAMPF, plan: null, jagd: null } })?.jagd === null);
  pruefe("und alte Sagas ohne alles stören nicht", sagaKampf(undefined) === null);

  // Die Vorgaben gehen als Ganzes durchs Schema, bevor sie gespeichert werden.
  // Was dort nicht steht, fällt heraus - die Arena darf das nicht passieren.
  const geprueft = SagaVorgabenSchema.safeParse({
    ...STANDARD_SAGA_VORGABEN,
    finaleArt: "kampf",
    kampf: { ...arena, jagd: neueKampfJagd("hut", "Die Glocken") },
  });
  pruefe("das Schema nimmt die Arena an", geprueft.success, geprueft.error?.issues?.[0]?.message);
  pruefe("und gibt sie unverändert zurück",
    sagaKampf(geprueft.data)?.plan?.breite === 9 && geprueft.data?.kampf?.stufe === "mittel");
  pruefe("samt der Jagd davor", geprueft.data?.kampf?.jagd?.fliehenderId === "hut");
  // Eine kaputte Arena nimmt niemandem das Finale: Das Schema wirft den Plan
  // weg, und an seine Stelle tritt der Standardkampfplatz.
  pruefe("eine kaputte Arena nimmt es an und ersetzt den Plan", (() => {
    const kaputt = {
      ...STANDARD_SAGA_VORGABEN,
      finaleArt: "kampf",
      kampf: { ...arena, plan: { breite: 99, tiefe: 2, felder: [] } },
    };
    if (!SagaVorgabenSchema.safeParse(kaputt).success) return false;
    const gelesen = sagaKampf(SagaVorgabenSchema.parse(kaputt));
    return kampfSpielbar(gelesen) && gelesen.plan?.breite === 9;
  })());
  pruefe("eine Saga ohne Kampf bleibt, wie sie war",
    SagaVorgabenSchema.parse(STANDARD_SAGA_VORGABEN).kampf === undefined);
}

console.log("\n14. Gericht & Flucht: erst der Saal, dann die Arena");
{
  const arena = { ...STANDARD_KAMPF, plan: arenaPlan(9, 9) };
  pruefe("die Art steht zur Wahl", FINALE_ARTEN.some((a) => a.id === "gericht-kampf"));
  pruefe("sie führt in den Saal", mitVerhandlung("gericht-kampf") && mitAnklage("gericht-kampf"));
  pruefe("und danach in die Arena",
    sagaKampf({ finaleArt: "gericht-kampf", kampf: arena }) === arena);
  pruefe("das Gerichtsfinale allein kämpft nicht",
    sagaKampf({ finaleArt: "gericht", kampf: arena }) === null);
  /*
   * Der Fehler, der ein ganzes Ende gekostet hat: Im Saal stand "Ihm nach",
   * und danach kam sofort der Epilog - weil keine Arena gebaut war. Jetzt
   * kommt das Ende, das die Art verspricht: Urteil, Jagd, Kampf.
   */
  {
    const ersatz = sagaKampf({ finaleArt: "gericht-kampf", drahtzieherId: "hut", name: "Die Glocken" });
    pruefe("ohne eingerichtete Arena springt der Standardplatz ein", kampfSpielbar(ersatz));
    pruefe("und die Jagd gehört bei dieser Art dazu", Boolean(ersatz?.jagd));
    pruefe("im Fluchtwagen sitzt der Drahtzieher", ersatz?.jagd?.fliehenderId === "hut");
  }

  const geprueft = SagaVorgabenSchema.safeParse({
    ...STANDARD_SAGA_VORGABEN,
    finaleArt: "gericht-kampf",
    kampf: { ...arena, jagd: neueKampfJagd("hut", "Die Glocken") },
  });
  pruefe("das Schema nimmt die Art an", geprueft.success, geprueft.error?.issues?.[0]?.message);
  pruefe("samt Arena und Jagd",
    sagaKampf(geprueft.data)?.plan?.breite === 9 && geprueft.data?.kampf?.jagd?.fliehenderId === "hut");
}

console.log(fehlgeschlagen === 0 ? "\nAlles sauber.\n" : `\n${fehlgeschlagen} Fehler.\n`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
