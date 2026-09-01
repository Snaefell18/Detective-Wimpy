/**
 * Prüft die Tonspur im laufenden Spiel: An jeder Stelle genau das Stück, das
 * dorthin gehört - und nirgends ein kurzes Anspielen nebenbei.
 *
 * Playwright ist bewusst keine Abhängigkeit des Projekts - der Test wäre
 * sonst bei jedem Deploy mit installiert. Einmalig einrichten:
 *
 *   npm i -D playwright && npx playwright install chromium
 *
 * Dann den Server starten (npm run dev -- -p 3100) und
 *
 *   npm run test:ton
 *
 * Ein anderer Port geht über WIMPY_URL, ein fertiger Browser über
 * PLAYWRIGHT_CHROMIUM.
 */
let chromium, devices;
try {
  ({ chromium, devices } = await import("playwright"));
} catch {
  console.log(
    "Playwright fehlt. Einmalig:\n" +
      "  npm i -D playwright && npx playwright install chromium",
  );
  process.exit(0);
}

const ADRESSE = process.env.WIMPY_URL ?? "http://localhost:3100";

const stats = {
  charisma: 6, freundlichkeit: 7, fitness: 4, zauberkraft: 2,
  schelmischkeit: 8, kriminalitaetslevel: 3, intelligenz: 7,
};
const tier = (id, name, art) => ({
  id, nummer: 1, name, tierart: art, alter: 5, stats,
  beschreibung: "x", bild: `/charaktere/${id}.png`, istDetektiv: false,
});
const besetzung = [
  { ...tier("wimpy", "Wimpy", "Bushbaby"), istDetektiv: true },
  tier("mikkeli", "Mikkeli", "Husky"),
  tier("nala", "Nala", "Katze"),
];
const orte = [
  { id: "o1", stadt: "Shinjuku", stadtId: "shinjuku", name: "11-Eleven", atmosphaere: "Neon", beschreibung: "x", bild: "/orte/shinjuku-11-eleven.png" },
  { id: "o2", stadt: "Shinjuku", stadtId: "shinjuku", name: "Yokocho", atmosphaere: "Rauch", beschreibung: "x", bild: "/orte/shinjuku-omoide-yokocho.png" },
];
const fall = {
  id: "kap1", besetzung, stadt: "Shinjuku", orte, introText: "Ein Fall.",
  schlagworte: ["Nebel", "Maske", "Diebstahl"], titel: "Die Mumie",
  tatbeschreibung: "Eine Kiste ist weg.", tatort: "o1",
  aufenthalt: { mikkeli: "o1", nala: "o2" }, erstelltAm: Date.now(),
};
const laufenderStand = {
  fall, siegel: "x", ortId: "o1", gefundeneSpuren: [], notizen: [],
  besuchteOrte: ["o1"], verlauf: {}, verdacht: { mikkeli: 70, nala: 20 },
  beschuldigungenUebrig: 2, status: "laeuft", ergebnis: null,
};
const sagaStand = (phase) => ({
  saga: {
    id: "s1", name: "Saga", thema: "t", klappentext: "k", vorgaben: {},
    schlagworte: ["Nebel"], auftakt: { text: "a", audio: "" },
    kapitel: [
      { nummer: 1, name: "K1", teaser: "t", erzaehler: { text: "e", audio: "" }, fall, siegel: "x" },
      { nummer: 2, name: "K2", teaser: "t", erzaehler: { text: "e", audio: "" }, fall, siegel: "x" },
    ],
    finale: { erzaehler: { text: "f", audio: "" }, frage: "Wer?", epilog: { text: "ep", audio: "" }, fall, siegel: "x" },
    bogenSiegel: "x", erstelltAm: Date.now(),
  },
  lauf: { sagaId: "s1", kapitel: 0, phase, fallId: "kap1", geloest: [] },
});

let fehlgeschlagen = 0;
const pruefe = (name, bedingung, zusatz = "") => {
  console.log(`  ${bedingung ? "ok  " : "FEHL"}  ${name}${zusatz ? `   (${zusatz})` : ""}`);
  if (!bedingung) fehlgeschlagen++;
};

const browser = await chromium.launch({
  // Ohne Angabe nimmt Playwright den selbst installierten Browser.
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
  args: ["--autoplay-policy=no-user-gesture-required"],
});

/** Öffnet eine Seite und schneidet mit, was hörbar läuft. */
async function buehne({ spiel, saga, treffer, verzoegerung = 0 }) {
  const ctx = await browser.newContext({ ...devices["iPhone 15 Pro"] });
  const page = await ctx.newPage();
  await page.route("**/firestore.googleapis.com/**", (r) => r.abort());
  await page.route("**/api/accuse", async (r) => {
    if (verzoegerung) await new Promise((x) => setTimeout(x, verzoegerung));
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        richtig: treffer, taeterId: "mikkeli",
        beschuldigtId: treffer ? "mikkeli" : "nala",
        aufloesung: "Mikkeli war es.", reaktion: "Na gut.",
      }),
    });
  });
  await page.addInitScript(([sp, sg]) => {
    localStorage.setItem("wimpy-design", "noir");
    localStorage.setItem("detective-wimpy:admin:v1", JSON.stringify({ bilder: {}, einstellungen: { intro: false } }));
    if (sp) localStorage.setItem("detective-wimpy:v1", sp);
    if (sg) localStorage.setItem("detective-wimpy:saga:v1", sg);
  }, [spiel ? JSON.stringify(spiel) : null, saga ? JSON.stringify(saga) : null]);
  await page.goto(ADRESSE);
  await page.waitForTimeout(2200);

  const mitschnitt = () =>
    page.evaluate(() => {
      window.__lauf = [];
      window.__uhr = setInterval(() => {
        window.__lauf.push({
          t: Math.round(performance.now()),
          laufend: [...document.querySelectorAll("audio")]
            .filter((a) => !a.paused && a.currentTime > 0 && a.volume > 0 && !a.muted)
            .map((a) => a.dataset.stueck),
          screen: document.body.innerText.slice(0, 24).replace(/\n/g, " "),
        });
      }, 100);
    });
  const ende = () => page.evaluate(() => { clearInterval(window.__uhr); return window.__lauf; });

  return { page, ctx, mitschnitt, ende };
}

/** Klickt sich zur Beschuldigung durch. */
async function beschuldige(page, wen) {
  await page.locator('button[aria-label="Tiere"]').click({ force: true });
  await page.waitForTimeout(400);
  await page.locator(".knopf.aktion").first().click({ force: true });
  await page.waitForTimeout(400);
  await page.locator(".wahl-kachel", { hasText: wen }).first().click({ force: true });
  await page.waitForTimeout(200);
  await page.locator(".knopf.rot").click({ force: true });
}

console.log("\n1. Startsequenz: Prolog, dann Titelsong, dann Ruhe");
{
  const ctx = await browser.newContext({ ...devices["iPhone 15 Pro"] });
  const page = await ctx.newPage();
  await page.route("**/firestore.googleapis.com/**", (r) => r.abort());
  let n = 0;
  await page.route("**/api/case", async (r) => {
    n++;
    await new Promise((x) => setTimeout(x, 300));
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(n < 3 ? { siegel: "x" } : { fall, siegel: "x" }),
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem("wimpy-design", "noir");
    localStorage.setItem("detective-wimpy:admin:v1", JSON.stringify({ bilder: {}, einstellungen: { intro: true } }));
  });
  await page.goto(ADRESSE);
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    window.__lauf = [];
    window.__uhr = setInterval(() => {
      window.__lauf.push({
        laufend: [...document.querySelectorAll("audio")]
          .filter((a) => !a.paused && a.currentTime > 0 && a.volume > 0 && !a.muted)
          .map((a) => a.dataset.stueck),
      });
    }, 100);
  });
  await page.locator(".start-himmel .knopf", { hasText: "Neuer Fall" }).first().click({ force: true });
  await page.waitForTimeout(3500);
  await page.locator(".prolog-skip").click({ force: true }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.locator(".intro-skip").click({ force: true }).catch(() => {});
  await page.waitForTimeout(2200);
  const verlauf = await page.evaluate(() => { clearInterval(window.__uhr); return window.__lauf; });
  // Führende Stille zählt nicht - der Mitschnitt beginnt vor dem Klick.
  const folge = [...new Set(verlauf.map((p) => p.laufend.join(",")))].filter(Boolean);

  pruefe("nie zwei Stücke gleichzeitig", verlauf.every((p) => p.laufend.length <= 1));
  pruefe("erst der Prolog", folge[0] === "prolog", folge.join(" -> "));
  pruefe("dann der Titelsong", folge.includes("intro"));
  pruefe("im Spiel ist Ruhe", verlauf.at(-1).laufend.length === 0);
  pruefe("die Siegermusik läuft nie", !verlauf.some((p) => p.laufend.includes("jubel")));
  await ctx.close();
}

console.log("\n2. Beschuldigung richtig: still bis zur Auflösung, dann Siegermusik");
{
  const { page, ctx, mitschnitt, ende } = await buehne({ spiel: laufenderStand, treffer: true, verzoegerung: 3000 });
  await mitschnitt();
  await beschuldige(page, "Mikkeli");
  await page.waitForTimeout(5200);
  const verlauf = await ende();
  const vorAufloesung = verlauf.filter((p) => !p.screen.includes("GELÖST"));
  const nachAufloesung = verlauf.filter((p) => p.screen.includes("GELÖST"));

  pruefe("kein Ton, solange die Auflösung fehlt",
    vorAufloesung.every((p) => p.laufend.length === 0),
    `${vorAufloesung.filter((p) => p.laufend.length).length} Momente mit Ton`);
  pruefe("die Auflösung bringt die Siegermusik",
    nachAufloesung.some((p) => p.laufend.includes("jubel")));
  pruefe("und nur sie", verlauf.every((p) => p.laufend.every((s) => s === "jubel")));
  await ctx.close();
}

console.log("\n3. Beschuldigung daneben: nirgends Siegermusik");
{
  const { page, ctx, mitschnitt, ende } = await buehne({
    spiel: { ...laufenderStand, beschuldigungenUebrig: 1 }, treffer: false, verzoegerung: 1200,
  });
  await mitschnitt();
  await beschuldige(page, "Nala");
  await page.waitForTimeout(4000);
  const verlauf = await ende();
  pruefe("durchgehend still", verlauf.every((p) => p.laufend.length === 0),
    [...new Set(verlauf.flatMap((p) => p.laufend))].join(",") || "still");
  await ctx.close();
}

console.log("\n4. Saga-Vorspann: der Titelsong");
{
  const { ctx, mitschnitt, ende, page } = await buehne({ saga: sagaStand("vorspann") });
  await mitschnitt();
  await page.waitForTimeout(1500);
  const verlauf = await ende();
  pruefe("der Titelsong läuft", verlauf.some((p) => p.laufend.includes("intro")));
  pruefe("nichts anderes", verlauf.every((p) => p.laufend.every((s) => s === "intro")));
  await ctx.close();
}

console.log("\n5. Saga-Finale gewonnen: Siegermusik im Epilog");
{
  const { page, ctx, mitschnitt, ende } = await buehne({
    saga: sagaStand("finale"), spiel: laufenderStand, treffer: true, verzoegerung: 600,
  });
  await beschuldige(page, "Mikkeli");
  await page.waitForTimeout(2600);
  await mitschnitt();
  await page.locator(".knopf.aktion").first().click({ force: true });
  await page.waitForTimeout(2200);
  const verlauf = await ende();
  pruefe("im Epilog jubelt es", verlauf.some((p) => p.laufend.includes("jubel")));
  await ctx.close();
}

console.log("\n6. Saga-Finale verloren: der Epilog bleibt still");
{
  const { page, ctx, mitschnitt, ende } = await buehne({
    saga: sagaStand("finale"), spiel: { ...laufenderStand, beschuldigungenUebrig: 1 },
    treffer: false, verzoegerung: 600,
  });
  await beschuldige(page, "Nala");
  await page.waitForTimeout(2600);
  await mitschnitt();
  await page.locator(".knopf.aktion").first().click({ force: true });
  await page.waitForTimeout(2200);
  const verlauf = await ende();
  pruefe("keine Siegermusik nach einer Niederlage",
    verlauf.every((p) => !p.laufend.includes("jubel")));
  await ctx.close();
}

await browser.close();
console.log(`\n${fehlgeschlagen === 0 ? "Alles sauber." : `${fehlgeschlagen} Prüfungen fehlgeschlagen.`}`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
