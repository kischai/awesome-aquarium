'use strict';
/* Awesome Aquarium – Spielstand, Wirtschaft und Simulation (v2).
   Die Simulation rechnet nur mit Daten (keine Grafik) und läuft deshalb auch für Becken weiter,
   die gerade nicht angezeigt werden – und holt Offline-Zeit nach.
   Zeit: s.clock zählt Spiel-Sekunden – seit Runde 11 immer Echtzeit (1×). Ein „Tag“ sind 24 Stunden; der Tageswechsel fällt
   auf Mitternacht, weil die Uhr beim Spielstart auf die aktuelle Uhrzeit gestellt wird. */
(function (AA) {
  const B = AA.BAL, DAY = 86400;
  const GW = AA.ALG_W = 32, GH = AA.ALG_H = 18, GN = GW * GH;
  AA.SAVE_KEY = 'awesome-aquarium-save-v2';
  AA.SAVE_V = 13;                                    // Stand-Nummer dieses Spiels (o.v im Spielstand); die Wolke nimmt keinen Stand von einem älteren Spiel an
  AA.quiet = false;

  /* ---------- Algen-Muster pro Becken (weiches Rauschen, am Rand stärker) – bestimmt, wo der Schmutz zuerst wächst ---------- */
  const noiseCache = {};
  AA.algNoise = function (t) {
    let n = noiseCache[t.id];
    if (n) return n;
    const r = AA.rng(t.seed || 1);
    let a = new Float32Array(GN);
    for (let i = 0; i < GN; i++) a[i] = r();
    for (let pass = 0; pass < 3; pass++) {
      const b = new Float32Array(GN);
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        let s = 0, c = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < GW && yy < GH) { s += a[yy * GW + xx]; c++; }
        }
        b[y * GW + x] = s / c;
      }
      a = b;
    }
    let mn = 1, mx = 0;
    for (let i = 0; i < GN; i++) { if (a[i] < mn) mn = a[i]; if (a[i] > mx) mx = a[i]; }
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x, v = (a[i] - mn) / (mx - mn || 1);
      const ex = Math.min(x, GW - 1 - x) / (GW / 2), ey = Math.min(y, GH - 1 - y) / (GH / 2);
      const edge = 1 - Math.min(ex, ey);
      a[i] = AA.clamp(v * 0.7 + edge * edge * 0.45, 0, 1);
    }
    noiseCache[t.id] = a;
    return a;
  };

  /* ---------- Becken / neuer Spielstand ---------- */
  AA.newTank = function (i, water, bonus) {
    water = water === 'fresh' ? 'fresh' : 'salt';
    return { id: AA.uid(), name: 'Aquarium ' + (i + 1), size: 0, floor: 'sand', wall: water === 'fresh' ? 'river' : 'aqua', water: water, bonus: !!bonus && water === 'fresh',
      deco: [], fish: [], eggs: [], dirt: 0, feeder: 0, matings: [], seed: Math.floor(Math.random() * 1e9) };
  };
  function defaultStats() {
    return { bought: 0, sold: 0, soldCoins: 0, raised: 0, eggs: 0, hatched: 0, mateFails: 0, shakes: 0, bites: 0, cleans: 0, taps: 0,
      tricks: 0, trained: 0, trainFails: 0, spentFish: 0, spentDeco: 0, decoBought: 0, chests: 0, chestCoins: 0,
      hunts: 0, huntCoins: 0, gifts: 0, earned: 0, spBought: {}, spRaised: {}, spMated: {},
      soldAdult: 0, photos: 0, quests: 0, questDays: 0, variants: 0, glitterUsed: 0 };
  }
  function defaultSettings() { return { sound: true, music: true, night: false }; }
  function clockNow() { const d = new Date(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); }

  AA.newGame = function () {
    const t = AA.newTank(0);
    t.deco.push({ id: AA.uid(), type: 'chest', x: 1046, z: 0.5, flip: false });
    t.deco.push({ id: AA.uid(), type: 'seaweed_brown', x: 214, z: 0.25, flip: false });
    t.deco.push({ id: AA.uid(), type: 'rock_grey', x: 356, z: 0.62, flip: false });
    AA.state = {
      v: AA.SAVE_V, coins: B.startCoins, pearls: 0, food: B.startFood, xp: 0, level: 1, clock: clockNow(),
      tanks: [t], active: 0, walls: ['aqua'], clam: false, mateCd: {},
      daily: { day: 0, chest: false, hunts: 0, gift: false },
      stats: defaultStats(), medals: {}, settings: defaultSettings(),
      lastSeen: Date.now(), created: Date.now(), intro: false,
      r18: 1, x18: 1, r19: 1, r20e: 1, r21a: 1, r21b: 1, g20: 1, favs: []      // Runde 18/19/20: ein neues Spiel hat nichts zu erstatten und braucht keine Neuigkeiten (der Reiter steht im Shop vorn)
    };
    AA.metaFix(AA.state, true);                      // Sammelbuch, Aufträge, Wochenkarte (js/meta.js)
    AA.bizFix(AA.state);                             // Gene, Markt, Kunden, Kassenbuch (js/biz.js)
    AA.farmFix(AA.state);                            // Personal, Verträge, Zuchtstation (js/farm.js)
    AA.ecoFix(AA.state);                             // Boden-Form, Räuber (js/eco.js)
    AA.lifeFix(AA.state);                            // Spezialfutter, Titel, Vorlagen (js/life.js)
    if (AA.wildFix) AA.wildFix(AA.state);            // Runde 9 (js/wild.js)
    if (AA.decorFix) AA.decorFix(AA.state);          // Runde 10 (js/decor.js)
    if (AA.familyFix) AA.familyFix(AA.state);        // Runde 10 (js/family.js)
    if (AA.socialFix) AA.socialFix(AA.state);        // Runde 11 (js/social.js)
    if (AA.themesNew) AA.themesNew(AA.state);        // Runde 19: Themen-Sets (js/themes.js)
    AA.questRoll();
    AA.bizStart();
    return AA.state;
  };

  function fixFish(f) {
    f.age = Math.max(0, +f.age || 0); f.hunger = AA.clamp(+f.hunger || 0, 0, 1); f.starve = Math.max(0, +f.starve || 0);
    f.sick = !!f.sick; f.adult = !!f.adult; f.tricks = Array.isArray(f.tricks) ? f.tricks.filter(function (x) { return AA.TRICK_BY[x]; }) : [];
    if (typeof f.trainPh !== 'number') f.trainPh = -1;
    if (f.sex !== 'm' && f.sex !== 'f') f.sex = Math.random() < 0.5 ? 'm' : 'f';
    if (f.v !== undefined && !AA.VAR_BY[f.v]) delete f.v;        // Farbvariante: nur bekannte
    if (!f.id) f.id = AA.uid();
    if (!f.name) f.name = AA.pick(AA.NAMES);
    return f;
  }
  function fixTank(o, i) {
    o.deco = (o.deco || []).filter(function (d) { return AA.DECO_BY[d.type]; });
    o.deco.forEach(function (d) {                    // Größe: nur gültige Werte innerhalb der Spanne des Stücks behalten
      if (AA.DECO_BY[d.type].text) d.flip = false;    // Runde 20f: Stücke mit Schrift (Schild, Rakija, OceanGape …) nie spiegeln
      if (d.s === undefined) return;
      const r = AA.decoRange(AA.DECO_BY[d.type]), v = +d.s;
      if (!r || !(v > 0) || !isFinite(v) || Math.abs(v - 1) < 0.005) delete d.s; else d.s = AA.clamp(Math.round(v * 100) / 100, r[0], r[1]);
    });
    const byId = {}; o.deco.forEach(function (d) { byId[d.id] = d; });
    o.deco.forEach(function (d) {                    // Stapel: Plattform muss es geben und wirklich eine Oberseite haben, keine Kreise
      if (d.on === undefined) return;
      const P = byId[d.on], pd = P && AA.DECO_BY[P.type], def = AA.DECO_BY[d.type];
      let ok = !!(pd && pd.tops && pd.tops[d.oi | 0] && P !== d && !def.crawl && !def.daily), q = P, n = 0;
      while (ok && q && q.on !== undefined && n++ < 5) { q = byId[q.on]; if (q === d) ok = false; }
      if (ok && n <= 3) { d.oi = d.oi | 0; d.ou = AA.clamp(+d.ou || 0, 0, 1); } else { delete d.on; delete d.oi; delete d.ou; }
    });
    o.fish = (o.fish || []).filter(function (f) { return AA.FISH_BY[f.sp]; }).map(fixFish);
    o.eggs = (o.eggs || []).filter(function (e) { return AA.FISH_BY[e.sp]; });
    o.size = AA.clamp(o.size | 0, 0, AA.SIZES.length - 1);
    o.dirt = AA.clamp(+o.dirt || 0, 0, 1); o.feeder = Math.max(0, +o.feeder || 0);
    if (!o.id) o.id = AA.uid();
    if (!o.seed) o.seed = Math.floor(Math.random() * 1e9);
    if (!o.name) o.name = 'Aquarium ' + (i + 1);
    if (!AA.FLOOR_BY[o.floor]) o.floor = 'sand';
    if (!AA.WALL_BY[o.wall]) o.wall = 'aqua';
    if (o.water !== 'fresh') o.water = 'salt';
    o.bonus = !!o.bonus && o.water === 'fresh';
    const ids = {}; o.fish.forEach(function (f) { ids[f.id] = 1; });      // Runde 11: laufende Balzen als Liste (früher höchstens eine: o.mating)
    const ms = Array.isArray(o.matings) ? o.matings : (o.mating ? [o.mating] : []);
    o.matings = ms.filter(function (m) { return m && ids[m.a] && ids[m.b] && AA.FISH_BY[m.sp]; }).map(function (m) { const x = { a: m.a, b: m.b, sp: m.sp, t: Math.max(0, +m.t || 0) }; if (m.cross) x.cross = 1; return x; });
    delete o.mating;
    o.fish.forEach(function (f) { if (f.mcd !== undefined && !(+f.mcd > 0)) delete f.mcd; });
    return o;
  }
  /* Runde 15 (v < 13): neues Spieltempo. Was gerade läuft, behält seinen Fortschritt in Prozent: ein Baby bei 50 % ist danach bei 50 % der neuen
     Reifezeit, ein Ei bei 30 % bei 30 % der neuen Brutzeit; eine laufende Paarungspause (vorher 24 Std) und eine Kaviar-Pause werden aufs neue
     Maß verkürzt. Farbfutter wirkte vorher eine Zeit lang – wer es noch im Bauch hat, bekommt die neuen 3 Eier mit Glück. */
  function migrateTempo(o) {
    const now = o.clock || 0, OLD_PAUSE = DAY;
    o.tanks.forEach(function (t) {
      t.fish.forEach(function (f) {
        const def = AA.FISH_BY[f.sp]; if (!def) return;
        const oldGrow = (def.hours || 24) * 3600, k = def.grow / oldGrow;
        if (!f.adult) { f.age = Math.max(0, (+f.age || 0) * k); if (f.sea) f.sea = f.sea * k; }
        if (+f.mcd > now) {
          const salmon = f.sp === 'salmon' && AA.SALMON ? AA.SALMON.cd : 1, rest = (+f.mcd - now) * def.pause / OLD_PAUSE;
          f.mcd = now + Math.min(rest, def.pause * salmon);
        }
        if (+f.cav > now) f.cav = now + Math.min(+f.cav - now, def.pause);
        if (+f.colorT > now) f.colorN = AA.FOOD2.color.eggs;
        delete f.colorT;
      });
      t.eggs.forEach(function (e) {
        const def = AA.FISH_BY[e.sp]; if (!def) return;
        const oldTotal = +e.total > 0 ? +e.total : (def.hours || 24) * 1800, h = +e.hatch;
        const left = isFinite(h) && h >= 0 ? AA.clamp(h / oldTotal, 0, 1) : 1;      // ohne Angabe: volle neue Brutzeit
        e.total = def.hatch; e.hatch = def.hatch * left;
      });
    });
  }
  /* Runde 16: Paarungspause höchstens 24 Std (AA.TEMPO.pauseMax). Was noch nach der alten Regel läuft (Quastenflosser bis 108 Std), wird
     gekürzt; Kaviar genauso. Läuft bei jedem Laden und ändert nichts, wenn schon alles passt – deshalb ohne neue Spielstand-Version. */
  function capPauses(o) {
    const now = o.clock || 0, max = AA.TEMPO.pauseMax;
    o.tanks.forEach(function (t) {
      t.fish.forEach(function (f) {
        if (+f.mcd > now + max) f.mcd = now + max;
        const def = AA.FISH_BY[f.sp];
        if (def && +f.cav > now + def.pause) f.cav = now + def.pause;
      });
    });
  }
  /* Spielstände von vor der Wasser-Trennung (v < 3): alle Becken waren Meerwasser. Süßwasser-Tiere, die dort schon leben, ziehen in ein
     geschenktes Süßwasser-Becken um (so groß wie nötig, samt laufendem Futterautomaten). Was nicht mehr hineinpasst, bleibt, wo es ist –
     Bestandsschutz, ohne Nachteil. */
  function migrateWater(o) {
    const isFresh = function (def) { return AA.waterOf(def) === 'fresh'; };
    let need = 0, crawlers = 0;
    o.tanks.forEach(function (t) {
      if (t.water !== 'salt') return;
      t.fish.forEach(function (f) { if (isFresh(AA.FISH_BY[f.sp])) need++; });
      t.eggs.forEach(function (e) { if (isFresh(AA.FISH_BY[e.sp])) need++; });
      t.deco.forEach(function (d) { const def = AA.DECO_BY[d.type]; if (def.crawl && isFresh(def)) crawlers++; });
    });
    if (!need && !crawlers) return null;
    let fresh = o.tanks.find(function (t) { return t.water === 'fresh'; }), gift = false;
    if (!fresh) {
      if (o.tanks.length >= AA.MAX_TANKS + 1) return null;
      fresh = AA.newTank(o.tanks.length, 'fresh', true); gift = true;
      while (fresh.size < AA.SIZES.length - 1 && AA.SIZES[fresh.size].cap < need) fresh.size++;
      o.tanks.push(fresh);
    }
    const res = { fish: 0, crawl: 0, tank: o.tanks.indexOf(fresh), gift: gift, left: 0 };
    o.tanks.forEach(function (t) {
      if (t.water !== 'salt') return;
      for (let i = t.fish.length - 1; i >= 0; i--) {
        const f = t.fish[i];
        if (!isFresh(AA.FISH_BY[f.sp])) continue;
        if (AA.count(fresh) >= AA.cap(fresh)) { res.left++; continue; }
        if (AA.unmate) AA.unmate(t, f);
        t.fish.splice(i, 1); fresh.fish.push(f); res.fish++;
        if (gift && t.feeder > fresh.feeder) fresh.feeder = t.feeder;      // lief im alten Becken ein Futterautomat, zieht er mit um (sonst hungern die Umzügler)
      }
      for (let i = t.eggs.length - 1; i >= 0; i--) {
        const e = t.eggs[i];
        if (!isFresh(AA.FISH_BY[e.sp])) continue;
        if (AA.count(fresh) >= AA.cap(fresh)) { res.left++; continue; }
        t.eggs.splice(i, 1); fresh.eggs.push(e); res.fish++;
      }
      for (let i = t.deco.length - 1; i >= 0; i--) {
        const d = t.deco[i], def = AA.DECO_BY[d.type];
        if (!def.crawl || !isFresh(def) || !AA.decoRoom(fresh, def)) continue;
        t.deco.splice(i, 1); fresh.deco.push(d); res.crawl++;
      }
    });
    return res;
  }
  AA.save = function () {
    try {
      if (AA.visit || AA.frozen) return false;       // zu Besuch bei Freunden bzw. kurz vor dem Neuladen (Stand aus der Wolke): nichts überschreiben
      const s = AA.state; if (!s) return false;
      s.lastSeen = Date.now();
      localStorage.setItem(AA.SAVE_KEY, JSON.stringify(s));
      if (AA.cloud && AA.cloud.saved) AA.cloud.saved();      // die Wolke lädt es bei Gelegenheit hoch (js/cloud.js)
      return true;
    } catch (e) { return false; }
  };
  /* Lässt sich ein vorhandener Spielstand nicht lesen, wird er NICHT überschrieben, sondern unter „…-kaputt“ aufgehoben (AA.loadError
     sagt der Oberfläche Bescheid). Vor dem Umbau auf Runde 4 wandert der alte Stand außerdem einmalig nach „…-vor-runde4“. */
  AA.load = function () {
    let raw = null;
    AA.loadError = null;
    try { raw = localStorage.getItem(AA.SAVE_KEY); } catch (e) { return null; }
    if (!raw) return null;
    return AA.loadRaw(raw);
  };
  /* Einen Spielstand (JSON-Text) zum laufenden Stand machen. guest = der Stand eines Freundes, den man nur ansieht: dann wird im
     Browser-Speicher nichts angefasst (keine Sicherungen, kein „…-kaputt“). */
  /* Runde 18: Steinkopf mit Hut, Brücken und Wege sind aus dem Spiel (AA.DECO_GONE). Zählt, was davon in Becken und Lager liegt, und den Kaufpreis dafür. */
  AA.dropGone = function (o) {
    let coins = 0; const items = {};
    const one = function (d) { const g = d && AA.DECO_GONE[d.type]; if (g) { coins += g[1]; items[g[0]] = (items[g[0]] || 0) + 1; } };
    (o.tanks || []).forEach(function (t) { if (t && Array.isArray(t.deco)) t.deco.forEach(one); });
    if (Array.isArray(o.storage)) o.storage.forEach(one);
    return coins ? { coins: coins, items: items } : null;
  };
  /* 19.11.2026: drei Tiere, drei Krabbler, drei Deko-Stücke sind raus (AA.GONE20). Zählt, was davon in Becken und Lager liegt, und was es zurückgibt. */
  AA.dropGone20 = function (o) {
    const G = AA.GONE20; let coins = 0, pearls = 0; const items = {};
    const add = function (g) { coins += g[1] || 0; pearls += g[2] || 0; items[g[0]] = (items[g[0]] || 0) + 1; };
    (o.tanks || []).forEach(function (t) {
      if (!t) return;
      if (Array.isArray(t.fish)) t.fish.forEach(function (f) { const g = f && G.fish[f.sp]; if (g) add(g); });
      if (Array.isArray(t.deco)) t.deco.forEach(function (d) { const g = d && G.deco[d.type]; if (g) add(g); });
    });
    if (Array.isArray(o.storage)) o.storage.forEach(function (d) { const g = d && G.deco[d.type]; if (g) add(g); });
    return coins || pearls ? { coins: coins, pearls: pearls, items: items } : null;
  };
  /* Runde 18: Mistelzweig-Alge im Becken – { hatch, pause } (Faktoren auf Brutzeit und Paarungspause), sonst null. Im Brutbecken wirkt sie nicht; mehrere zählen wie eine. */
  AA.mistle = function (t) {
    if (!t || t.role === 'brut' || !Array.isArray(t.deco)) return null;
    for (let i = 0; i < t.deco.length; i++) { const d = AA.DECO_BY[t.deco[i].type]; if (d && d.mistle) return d.mistle; }
    return null;
  };
  AA.loadRaw = function (raw, guest) {
    AA.loadingGuest = !!guest;                     // Runde 14: js/social.js verschenkt nichts in den Stand eines Freundes
    try { return loadRaw0(raw, guest); } finally { AA.loadingGuest = false; }
  };
  function loadRaw0(raw, guest) {
    const bak = function (suffix) { if (guest) return; try { if (!localStorage.getItem(AA.SAVE_KEY + suffix)) localStorage.setItem(AA.SAVE_KEY + suffix, raw); } catch (e0) { /* Speicher voll: dann eben ohne Sicherung */ } };
    try {
      const o = JSON.parse(raw);
      if (!o || !Array.isArray(o.tanks) || !o.tanks.length) throw new Error('kein Becken im Spielstand');
      const gone = guest ? null : AA.dropGone(o);      // Runde 18: entfernte Deko zählen, bevor fixTank (Becken) und decorFix (Lager) sie still wegwerfen
      const gone20 = guest || o.g20 ? null : AA.dropGone20(o);      // 19.11.2026: entfernte Tiere, Krabbler und Deko (AA.GONE20) – ebenso vorher zählen
      o.tanks = o.tanks.slice(0, AA.MAX_TANKS + 1 + (AA.OCEAN.max || 1) + (AA.DEEP.max || 1)).map(fixTank);      // 8 Becken + Süßwasser-Sonderangebot + bis zu 3 Meeresbecken + 2 Tiefsee-Becken (Runde 20f)
      if ((o.v | 0) < 3) { o.news = { water: migrateWater(o) }; o.v = 3; }      // Umzug + einmaliger Hinweis auf das, was neu ist (zeigt die Oberfläche)
      const ds = defaultStats(); o.stats = o.stats || {};
      for (const k in ds) if (o.stats[k] === undefined) o.stats[k] = ds[k];
      const dset = defaultSettings(); o.settings = o.settings || {};
      for (const k in dset) if (o.settings[k] === undefined) o.settings[k] = dset[k];
      o.medals = o.medals || {}; o.mateCd = o.mateCd || {};
      o.walls = Array.isArray(o.walls) && o.walls.length ? o.walls : ['aqua'];
      o.tanks.forEach(function (t) { const w = AA.WALL_BY[t.wall]; if (w && w.pearls && o.walls.indexOf(t.wall) < 0) o.walls.push(t.wall); });   // Runde 12: was in einem Becken hängt, gehört dir – überall (Gratis-Farben gelten ohnehin als vorhanden)
      o.active = AA.clamp(o.active | 0, 0, o.tanks.length - 1);
      o.coins = Math.max(0, Math.round(+o.coins || 0)); o.pearls = Math.max(0, Math.round(+o.pearls || 0));
      o.food = Math.max(0, Math.round(+o.food || 0)); o.xp = Math.max(0, Math.round(+o.xp || 0));
      if (gone && !o.r18) { o.r18 = 1; o.coins += gone.coins; o.news = o.news || {}; o.news.gone = gone; }      // Merker r18: ein noch offenes altes Spiel erstattet nicht ein zweites Mal
      if (!guest) o.g20 = 1;                           // 19.11.2026: Merker – die Rückgabe (AA.GONE20) gibt es nur einmal
      if (!Array.isArray(o.favs)) o.favs = [];          // Runde 20g: Favoriten im Shop (art:id) – nur bekannte behalten
      o.favs = o.favs.filter(function (x) { const m = /^(fish|deco|crawl|food):([a-z0-9_]+)$/.exec(String(x)); return !!m && !!(m[1] === 'fish' ? AA.FISH_BY[m[2]] : (m[1] === 'food' ? AA.FOOD_BY && AA.FOOD_BY[m[2]] : AA.DECO_BY[m[2]])); }).slice(0, 200);
      if (typeof o.lastBuy !== 'string' || !/^(fish|deco|crawl|food):[a-z0-9_]+$/.test(o.lastBuy)) delete o.lastBuy;      // Runde 20g: „Nochmal kaufen“
      if (gone20) { o.coins += gone20.coins; o.pearls += gone20.pearls; o.news = o.news || {}; o.news.gone20 = gone20; }
      if (!guest && !o.x18 && AA.season().xmas) { o.x18 = 1; o.news = o.news || {}; o.news.xmas18 = 1; }      // Runde 18: einmal Bescheid sagen, was es zu Weihnachten Neues gibt
      if (!guest && !o.r19) { o.r19 = 1; o.news = o.news || {}; o.news.r19 = 1; }      // Runde 19: einmal Bescheid sagen (Reiter „Specials“)
      if (!guest && !o.r20e) { o.r20e = 1; o.news = o.news || {}; o.news.r20e = 1; }      // Runde 20e/20g: einmal Bescheid sagen (Afrika, Komfort)
      if (!guest && !o.r21a) { o.r21a = 1; o.news = o.news || {}; o.news.r21a = 1; }      // Runde 21a: Farbfutter wirkt jetzt richtig
      if (!guest && !o.r21b) { o.r21b = 1; o.news = o.news || {}; o.news.r21b = 1; }      // Runde 21b: Kulissen sitzen am Boden (Damians Text)
      const was = Math.max(0, Math.round(+o.level || 0));
      o.level = AA.levelFor(o.xp);
      if (!guest && !o.r16) {                          // Runde 16, einmalig: flachere Level-Kurve ab Level 31 – wer dadurch aufsteigt, bekommt je Level eine Perle wie sonst auch.
        o.r16 = 1;                                     // Merker: ein noch offenes altes Spiel (alte Kurve) kann das Level wieder zurückrechnen – dann gibt es die Perlen nicht ein zweites Mal
        if (was >= 31 && o.level > was) { o.pearls += o.level - was; o.news = o.news || {}; o.news.curve = { from: was, to: o.level }; }
      }
      o.clock = Math.max(0, +o.clock || 0);
      o.daily = o.daily || { day: Math.floor(o.clock / DAY), chest: false, hunts: 0, gift: false };
      o.clam = !!o.clam;
      if ((o.v | 0) < 4) {                             // Runde 4: Farbvarianten, Sammelbuch, Aufträge – einmaliger Hinweis; der alte Stand bleibt als Sicherung liegen
        bak('-vor-runde4');
        o.news = o.news || {}; o.news.v4 = true; o.v = 4;
      }
      if ((o.v | 0) < 5) {                             // Runde 5: Zuchtbetrieb – Sicherung des alten Stands, einmaliger Hinweis
        bak('-vor-runde5');
        o.news = o.news || {}; o.news.v5 = true; o.v = 5;
      }
      if ((o.v | 0) < 6) {                             // Runde 6: Zuchtstation, Personal, Verträge, Meeresbecken – Sicherung, einmaliger Hinweis
        bak('-vor-runde6');
        o.news = o.news || {}; o.news.v6 = true; o.v = 6;
      }
      AA.metaFix(o, false);
      AA.bizFix(o);
      AA.farmFix(o);
      if ((o.v | 0) < 7) { bak('-vor-runde7'); o.news = o.news || {}; o.news.v7 = true; o.v = 7; }
      if ((o.v | 0) < 8) { bak('-vor-runde8'); o.news = o.news || {}; o.news.v8 = true; o.v = 8; }
      if ((o.v | 0) < 9) { bak('-vor-runde9'); o.news = o.news || {}; o.news.v9 = true; o.v = 9; }
      if ((o.v | 0) < 10) { bak('-vor-runde10'); o.news = o.news || {}; o.news.v10 = true; o.v = 10; }      // Runde 10: Deko-Lager, Deko-Modus, Familie
      if ((o.v | 0) < 11) {                            // Runde 11: Pause je Fisch statt je Art, Echtzeit, keine Räuber, nur neue Klänge
        bak('-vor-runde11');
        o.news = o.news || {}; o.news.v11 = true; o.v = 11;
        o.mateCd = {};
        delete o.settings.speed; delete o.settings.sfx; delete o.settings.pred;
        o.r11 = { crawl: 1 };                          // js/social.js: zu viele Krabbler wandern ins Lager
      }
      if ((o.v | 0) < 12) { bak('-vor-runde12'); o.news = o.news || {}; o.news.v12 = true; o.v = 12; }      // Runde 12: Beine, Peitschen, Sand-Wellen, Adria, Licht, Pokale, Hilfe & Geschenke
      if ((o.v | 0) < 13) { bak('-vor-runde15'); migrateTempo(o); o.news = o.news || {}; o.news.tempo = true; o.v = 13; }      // Runde 15: neues Spieltempo (AA.TEMPO)
      capPauses(o);                                    // Runde 16: Pausen höchstens 24 Std
      delete o.settings.speed;
      AA.ecoFix(o);
      AA.lifeFix(o);
      if (AA.wildFix) AA.wildFix(o);                   // Runde 9 (js/wild.js)
      if (AA.decorFix) AA.decorFix(o);                 // Runde 10: Lager, Farben, Drehung (js/decor.js)
      if (AA.familyFix) AA.familyFix(o);               // Runde 10: Login-Kalender, Testfreund (js/family.js)
      if (AA.socialFix) AA.socialFix(o);               // Runde 11: Profil, Grenzen, Geschenk (js/social.js)
      AA.state = o;
      if (AA.themesAfterLoad) AA.themesAfterLoad(o, guest);      // Runde 19: Themen-Sets – beim ersten Mal still gutschreiben (js/themes.js)
      for (let i = 0; i < o.tanks.length; i++) finishAll(o.tanks[i], true);   // Balz, die beim Schließen lief
      AA.questRoll();                                  // Aufträge für heute (falls es noch keine gibt)
      AA.bizStart();                                   // Tageskurs, Kunden
      return o;
    } catch (e) {
      if (raw && !guest) {
        AA.loadError = String((e && e.message) || e);
        try { localStorage.setItem(AA.SAVE_KEY + '-kaputt', raw); } catch (e2) { /* Speicher voll */ }
      }
      AA.state = null;
      return null;
    }
  };
  /* ---------- Spielstand als Datei: sichern, prüfen, einspielen ---------- */
  AA.exportSave = function () { AA.save(); try { return localStorage.getItem(AA.SAVE_KEY); } catch (e) { return null; } };
  /* Sieht sich einen Spielstand an, ohne etwas anzufassen: { ok, v, level, fish, tanks, lastSeen } oder { ok: false, why } */
  AA.inspectSave = function (raw) {
    try {
      const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!o || typeof o !== 'object' || !Array.isArray(o.tanks) || !o.tanks.length) return { ok: false, why: 'empty' };
      if ((o.v | 0) > AA.SAVE_V) return { ok: false, why: 'newer' };
      let fish = 0; o.tanks.forEach(function (t) { if (t && Array.isArray(t.fish)) fish += t.fish.length; });
      return { ok: true, v: o.v | 0, level: AA.levelFor(Math.max(0, Math.round(+o.xp || 0))), fish: fish, tanks: o.tanks.length, lastSeen: +o.lastSeen || 0, intro: !!o.intro };
    } catch (e) { return { ok: false, why: 'unreadable' }; }
  };
  /* Spielt einen Spielstand ein (danach die Seite neu laden). Der bisherige Stand bleibt unter „…-vor-<tag>“ liegen. */
  AA.importSave = function (raw, tag) {
    const info = AA.inspectSave(raw);
    if (!info.ok) return info;
    try {
      const cur = localStorage.getItem(AA.SAVE_KEY);
      AA.frozen = true;                              // ab jetzt schreibt das laufende Spiel nicht mehr dazwischen
      if (cur) { try { localStorage.setItem(AA.SAVE_KEY + '-vor-' + (tag || 'import'), cur); } catch (e1) { /* Speicher voll: ohne Sicherung */ } }
      localStorage.setItem(AA.SAVE_KEY, typeof raw === 'string' ? raw : JSON.stringify(raw));
    } catch (e) { AA.frozen = false; return { ok: false, why: 'full' }; }
    return info;
  };
  AA.resetGame = function () { try { localStorage.removeItem(AA.SAVE_KEY); } catch (e) { /* egal */ } AA.newGame(); AA.emit('tankChanged'); AA.emit('hud'); };

  /* ---------- Abfragen ---------- */
  AA.tank = function () { return AA.state.tanks[AA.state.active]; };
  AA.cap = function (t) { return t.ocean ? AA.OCEAN.cap : (t.deep ? AA.DEEP.cap : AA.SIZES[t.size].cap); };
  AA.count = function (t) { return t.fish.length + t.eggs.length; };
  AA.speed = function () { return AA.devSpeed || 1; };      // Runde 11: immer Echtzeit (1×). AA.devSpeed gibt es nur für Tests, nie im Spielstand
  AA.day = function () { return Math.floor(AA.state.clock / DAY); };
  AA.dayLeft = function () { return DAY - (AA.state.clock % DAY); };          // Spiel-Sekunden bis zum Tageswechsel
  AA.phase = function (f) { return f.adult ? 4 : Math.min(3, Math.floor(4 * f.age / AA.FISH_BY[f.sp].grow)); };
  AA.spriteKey = function (f) { return 'fish/' + f.sp + '_' + (AA.phase(f) < 2 ? 'b' : f.sex); };
  AA.growLeft = function (f) { return f.adult ? 0 : Math.max(0, AA.FISH_BY[f.sp].grow - f.age); };
  AA.fedAvg = function (t) { if (!t.fish.length) return 1; let h = 0; for (let i = 0; i < t.fish.length; i++) h += t.fish[i].hunger; return h / t.fish.length; };
  AA.hungryCount = function (t) { let n = 0; for (let i = 0; i < t.fish.length; i++) if (t.fish[i].hunger < B.hungryBelow) n++; return n; };
  /* Verkaufswert: Grundpreis (Baby weniger) × Güteklasse × Farbvariante × Tageskurs (Markt, Trend, Sättigung) – js/biz.js */
  AA.fishValue = function (f) {
    const def = AA.FISH_BY[f.sp];
    let v = def.sell * (f.adult ? 1 : B.babyValue + (1 - B.babyValue) * Math.min(1, f.age / def.grow));
    if (f.sick) v *= B.sickValue;
    v *= AA.fishClass(f).mult * AA.varMult(f.v) * AA.marketFactor(f.sp) * AA.farmMult(f);
    v = Math.round(v) + Math.floor(def.trainBonus * f.tricks.length / AA.TRICKS.length);
    return Math.max(1, v);
  };

  /* ---------- Münzen / Perlen / Futter / XP ---------- */
  AA.addCoins = function (n, earned) {
    const s = AA.state;
    const before = s.coins;
    s.coins = Math.max(0, Math.round(s.coins + n));
    if (n > 0 && earned !== false) s.stats.earned += n;
    if (AA.ledgerAdd) AA.ledgerAdd(s.coins - before);   // Kassenbuch (js/biz.js)
    AA.emit('hud');
  };
  AA.addPearls = function (n) { const s = AA.state; s.pearls = Math.max(0, Math.round(s.pearls + n)); AA.emit('hud'); };
  AA.addFood = function (n) { const s = AA.state; s.food = Math.max(0, Math.round(s.food + n)); AA.emit('hud'); };
  AA.addXP = function (n) {
    const s = AA.state;
    s.xp += Math.round(n);
    const nl = AA.levelFor(s.xp);
    while (s.level < nl) { s.level++; s.pearls++; AA.emit('levelup', s.level); }   // jedes Level bringt eine Perle
    AA.emit('hud');
  };
  AA.xpProgress = function () {
    const s = AA.state, l = s.level;
    if (l >= AA.MAX_LEVEL) return { cur: 0, need: 0, frac: 1, max: true };
    const a = AA.LEVELS[l - 1], b = AA.LEVELS[l];
    return { cur: s.xp - a, need: b - a, frac: (s.xp - a) / (b - a), max: false };
  };
  AA.unlocksAt = function (lvl) {
    const out = [], s = AA.state;
    AA.FISH.forEach(function (f) { if (f.lvl === lvl && !f.hybrid) out.push(f.name); });
    AA.DECO.forEach(function (d) { if (d.lvl === lvl && !d.fixed) out.push(d.name); });
    if (lvl > 1) {
      AA.FLOORS.forEach(function (f) { if (f.lvl === lvl) out.push(f.name); });
      AA.FOOD.forEach(function (f) { if (f.lvl === lvl) out.push(f.name); });
      for (let i = 0; i < AA.MAX_TANKS; i++) for (let z = 0; z < AA.SIZES.length; z++) {
        if (AA.tankReq(i, z).lvl !== lvl) continue;
        const reg = s.tanks.filter(function (t) { return !t.bonus && !AA.wide(t); });      // Runde 20f: Meeres-/Tiefsee-Becken zählen nicht zur Leiter
        if (z === 0) { if (i >= reg.length) out.push(i === reg.length ? 'ein weiteres Aquarium' : 'Aquarium Nr. ' + (i + 1)); }
        else if (i < reg.length && reg[i].size < z) out.push('Ausbau auf ' + AA.SIZES[z].gal + ' Gallonen (' + reg[i].name + ')');
      }
      for (let z = 0; z < AA.SIZES.length; z++) {      // Sonderangebot Süßwasser-Becken
        if (AA.tankReq(0, z, true).lvl !== lvl) continue;
        const bt = s.tanks.find(function (t) { return t.bonus; });
        if (z === 0) { if (!bt) out.push('Süßwasser-Becken 🌿'); }
        else if (bt && bt.size < z) out.push('Ausbau auf ' + AA.SIZES[z].gal + ' Gallonen (' + bt.name + ')');
      }
      if (AA.oceanCount) AA.OCEAN.lvls.forEach(function (l, k) { if (l === lvl && AA.oceanCount() <= k) out.push((k ? (k + 1) + '. ' : '') + 'Meeresbecken 🦈'); });      // Runde 20f
      if (AA.deepCount) AA.DEEP.lvls.forEach(function (l, k) { if (l === lvl && AA.deepCount() <= k) out.push((k ? (k + 1) + '. ' : '') + 'Tiefsee-Becken 🌌'); });
    }
    return out;
  };

  /* ---------- Fische ---------- */
  AA.makeFish = function (sp, name, sex) {
    return { id: AA.uid(), sp: sp, name: name || AA.pick(AA.NAMES), sex: sex || (Math.random() < 0.5 ? 'm' : 'f'),
      age: 0, adult: false, hunger: 0.3, starve: 0, sick: false, tricks: [], trainPh: -1, born: AA.state ? AA.state.clock : 0, g: AA.shopGenes() };
  };
  AA.buyFish = function (sp, name, sex, withPearls) {
    const s = AA.state, t = AA.tank(), def = AA.FISH_BY[sp];
    if (!def) return 'unknown';
    if (def.season && !AA.season()[def.season]) return 'season';      // Runde 18: Weihnachts-Arten nur in der Weihnachtszeit
    if (s.level < def.lvl) return 'level';
    if (!AA.livesIn(def, t)) return AA.whyNot(def, t);      // 'ocean', 'deep', 'nodeep', 'big' oder 'water'
    if (AA.count(t) >= AA.cap(t)) return 'full';
    if (def.pearlOnly && !withPearls) return 'pearls';             // Runde 12: besondere Tiere nur für Perlen
    if (withPearls) {
      if (!def.pearls) return 'unknown';
      if (s.pearls < def.pearls) return 'pearls';
      AA.addPearls(-def.pearls);
    } else {
      const pr = AA.priceOf ? AA.priceOf(def) : def.price;      // Runde 20f: Fisch des Tages −30 %
      if (s.coins < pr) return 'coins';
      AA.addCoins(-pr); s.stats.spentFish += pr;
    }
    const f = AA.makeFish(sp, name, sex);           // kommt als Baby und hat Hunger
    t.fish.push(f); s.stats.bought++; s.stats.spBought[sp] = 1;
    AA.bookSee(sp);
    AA.emit('fishAdded', f, 'buy');
    AA.checkMedals();
    return f;
  };
  AA.sellFish = function (f) {
    const s = AA.state, t = AA.tank(), i = t.fish.indexOf(f);
    if (i < 0 || f.keep) return 0;                     // 🔒 geschützt (js/fishlist.js) – erst freigeben
    unmate(t, f);
    const v = AA.fishValue(f);
    t.fish.splice(i, 1);
    AA.addCoins(v);
    s.stats.sold++; s.stats.soldCoins += v; if (f.adult) s.stats.soldAdult++;
    AA.bizSold(f, v);                                // Markt sättigen, Kassenbuch
    AA.emit('fishRemoved', f, 'sell', v);
    AA.checkMedals();
    return v;
  };
  AA.moveFish = function (f, toIdx) {
    const s = AA.state, t = AA.tank(), to = s.tanks[toIdx], i = t.fish.indexOf(f);
    if (i < 0 || !to || to === t) return 'unknown';
    if (!AA.livesIn(AA.FISH_BY[f.sp], to)) return AA.whyNot(AA.FISH_BY[f.sp], to);
    if (AA.count(to) >= AA.cap(to)) return 'full';
    unmate(t, f);
    t.fish.splice(i, 1); to.fish.push(f);
    AA.emit('fishRemoved', f, 'move', 0);
    return true;
  };

  /* ---------- Paarung (Runde 11): ♂ + ♀ einer Art, sauberes Becken, satt, Platz; kostet den halben Kaufpreis und bringt IMMER ein Ei.
     Die Pause danach gilt je FISCH (f.mcd = Spieluhr, ab der er wieder darf) – nicht je Art oder Becken. Beliebig viele Paare
     dürfen gleichzeitig balzen (t.matings); jede laufende Balz hält einen Platz für ihr Ei frei. ---------- */
  AA.matings = function (t) { if (!Array.isArray(t.matings)) t.matings = []; return t.matings; };
  AA.matingOf = function (t, id) { const m = t.matings; if (!m) return null; for (let i = 0; i < m.length; i++) if (m[i].a === id || m[i].b === id) return m[i]; return null; };
  AA.mateWait = function (f) { return Math.max(0, (+f.mcd || 0) - AA.state.clock); };      // Spiel-Sekunden, bis dieser Fisch wieder darf
  AA.mateRoom = function (t) { return AA.count(t) + (t.matings ? t.matings.length : 0) < AA.cap(t); };
  AA.unmate = function (t, f) { if (t.matings && AA.matingOf(t, f.id)) t.matings = t.matings.filter(function (m) { return m.a !== f.id && m.b !== f.id; }); };
  const unmate = AA.unmate;
  AA.mateCooldown = function (t, sp, cross) {        // Pause nach einer Balz (Spiel-Sekunden); Clownfisch mit Anemone ist schneller wieder bereit
    const def = AA.FISH_BY[sp];                      // Runde 15: 1,5 × Reifezeit der Art (bei einer Kreuzung: des Hybriden) – siehe AA.TEMPO
    let cd = def ? def.pause : DAY;
    if (!cross && sp === 'salmon' && AA.SALMON) cd *= AA.SALMON.cd;      // Lachse laichen seltener (dafür 3 Eier)
    if (sp === 'clown' && AA.hostCount && AA.hostCount(t)) cd *= 0.75;
    const mi = AA.mistle(t);                          // Runde 18: Mistelzweig-Alge – Pause 10 % kürzer (nicht im Brutbecken)
    return Math.min(cd, AA.TEMPO.pauseMax) * (mi ? mi.pause : 1);          // Runde 16: nie länger als 24 Std
  };
  /* Fische einer Art, die jetzt balzen könnten. why (Reihenfolge = was du tun kannst): nomale/nofemale · hungry · cd (cd = Wartezeit) · busy · dirty · full · coins */
  AA.pairPool = function (t, test) {                 // test(g) = gehört der Fisch zur gesuchten Art/Gruppe?
    const out = { males: [], females: [], anyM: false, anyF: false, why: { m: '', f: '' }, wait: { m: Infinity, f: Infinity } };
    for (let i = 0; i < t.fish.length; i++) {
      const g = t.fish[i];
      if (!g.adult || !test(g)) continue;
      const k = g.sex === 'm' ? 'm' : 'f';
      if (k === 'm') out.anyM = true; else out.anyF = true;
      const w = AA.mateWait(g);
      if (AA.matingOf(t, g.id)) { if (!out.why[k]) out.why[k] = 'busy'; continue; }
      if (w > 0) { out.wait[k] = Math.min(out.wait[k], w); if (out.why[k] !== 'hungry') out.why[k] = 'cd'; continue; }
      if (g.sick || g.hunger < B.mateHungerMin) { out.why[k] = 'hungry'; continue; }
      (k === 'm' ? out.males : out.females).push(g);
    }
    return out;
  };
  function sideWhy(P) {                              // warum fehlt ♂ oder ♀? (hungrig vor Pause vor Balz)
    const ws = [];
    if (!P.males.length) ws.push(P.why.m); if (!P.females.length) ws.push(P.why.f);
    const why = ws.indexOf('hungry') >= 0 ? 'hungry' : (ws.indexOf('cd') >= 0 ? 'cd' : (ws.indexOf('busy') >= 0 ? 'busy' : 'nomale'));
    let cd = 0;
    if (!P.males.length && P.wait.m < Infinity) cd = Math.max(cd, P.wait.m);
    if (!P.females.length && P.wait.f < Infinity) cd = Math.max(cd, P.wait.f);
    return { why: why, cd: cd };
  }
  AA.mateStatus = function (sp, t) {
    const s = AA.state, def = AA.FISH_BY[sp];
    t = t || AA.tank();
    const P = AA.pairPool(t, function (g) { return g.sp === sp; });
    const out = { ok: false, cost: def.mate, cd: 0, males: P.males, females: P.females };
    if (!P.anyM) out.why = 'nomale';
    else if (!P.anyF) out.why = 'nofemale';
    else if (!P.males.length || !P.females.length) { const w = sideWhy(P); out.why = w.why; out.cd = w.cd; }
    else if (t.dirt > B.mateDirtMax) out.why = 'dirty';
    else if (!AA.mateRoom(t)) out.why = 'full';
    else if (s.coins < def.mate) out.why = 'coins';
    else out.ok = true;
    return out;
  };
  /* Für die Fisch-Karte: kann DIESER Fisch jetzt balzen? Erst seine eigene Lage (jung, Balz, Pause, Hunger), dann ob es einen Partner gibt. */
  AA.fishMateStatus = function (f, t) {
    t = t || AA.tank();
    if (!f.adult) return { ok: false, why: 'young', cd: 0 };
    if (AA.matingOf(t, f.id)) return { ok: false, why: 'busyme', cd: 0 };
    const w = AA.mateWait(f);
    if (w > 0) return { ok: false, why: 'cdme', cd: w };
    if (f.sick || f.hunger < B.mateHungerMin) return { ok: false, why: 'hungryme', cd: 0 };
    const st = AA.mateStatus(f.sp, t);
    if (st.why === 'sterile' || st.why === 'spawn' || st.why === 'barren') return st;
    const mine = f.sex === 'm' ? st.males : st.females, other = f.sex === 'm' ? st.females : st.males;
    if (mine.indexOf(f) < 0) return st;
    if (!other.length) {                             // kein Partner frei: warum?
      if (st.ok === false && (st.why === 'nomale' || st.why === 'nofemale')) return st;
      const P = AA.pairPool(t, function (g) { return g.sp === f.sp && g.sex !== f.sex; });
      const k = f.sex === 'm' ? 'f' : 'm';
      if (!(f.sex === 'm' ? P.anyF : P.anyM)) return { ok: false, why: f.sex === 'm' ? 'nofemale' : 'nomale', cd: 0, males: st.males, females: st.females, cost: st.cost };
      const why = P.why[k] === 'hungry' ? 'hungry' : (P.why[k] || 'busy');
      return { ok: false, why: why, cd: P.wait[k] < Infinity ? P.wait[k] : 0, males: st.males, females: st.females, cost: st.cost };
    }
    return st;
  };
  /* prefer = der Fisch, an dessen Karte „Paaren“ gedrückt wurde: Ist er paarungsbereit, ist ER ein Elternteil – und sucht sich, wenn es geht,
     einen Partner mit derselben Farbvariante (sonst irgendeine Variante, sonst Zufall). So lässt sich gezielt auf eine Farbe züchten. */
  /* pa + pb gesetzt (Zuchtplaner, Zuchtmeister): genau dieses Paar. tk = Becken (sonst das aktuelle). */
  AA.startMate = function (sp, prefer, pa, pb, tk) {
    const t = tk || AA.tank(), st = AA.mateStatus(sp, t);
    if (!st.ok) return st;
    if (pa && pb && (st.males.indexOf(pa) < 0 || st.females.indexOf(pb) < 0)) { st.ok = false; st.why = 'pair'; return st; }
    AA.addCoins(-st.cost);
    let a = pa || AA.pick(st.males), b = pb || AA.pick(st.females);
    if (pa && pb) prefer = null;
    const mine = prefer && (st.males.indexOf(prefer) >= 0 ? 'm' : (st.females.indexOf(prefer) >= 0 ? 'f' : ''));
    if (mine) {
      const others = mine === 'm' ? st.females : st.males;
      const same = others.filter(function (x) { return prefer.v && x.v === prefer.v; }), anyV = others.filter(function (x) { return x.v; });
      const mate = AA.pick(same.length ? same : (anyV.length ? anyV : others));
      if (mine === 'm') { a = prefer; b = mate; } else { b = prefer; a = mate; }
    }
    AA.matings(t).push({ a: a.id, b: b.id, sp: sp, t: B.mateDance });
    st.a = a; st.b = b;
    AA.emit('mateStart', a, b, t);
    return st;
  };
  function finishMate(t, m, silent) {
    const s = AA.state;
    if (t.matings) { const i = t.matings.indexOf(m); if (i >= 0) t.matings.splice(i, 1); }
    if (!m) return;
    const a = t.fish.find(function (x) { return x.id === m.a; }), b = t.fish.find(function (x) { return x.id === m.b; });
    if (!a || !b) return;
    const def = AA.FISH_BY[m.sp];
    const until = s.clock + AA.mateCooldown(t, m.sp, m.cross);
    a.mcd = until; b.mcd = until;                    // Pause je Fisch: die beiden ruhen sich aus, alle anderen dürfen weiter
    if (AA.count(t) >= AA.cap(t)) { if (!silent) AA.emit('mateNoRoom', a, b, t); return; }       // kann eigentlich nicht passieren (der Platz war reserviert)
    const egg = { id: AA.uid(), sp: m.sp, x: 640 + AA.rand(-120, 120), z: AA.rand(0.3, 0.8), hatch: def.hatch, total: def.hatch };
    if (AA.eggSpot) AA.eggSpot(t, m.sp, egg);          // Clownfisch: neben die Anemone
    const mut = m.cross ? AA.crossVariant(a, b, t, m.sp) : AA.rollVariant(a, b, t);   // Farbvariante? (vererbt oder spontane Mutation – js/meta.js, Hybride: js/life.js)
    if (mut && AA.varFits(m.sp, mut)) { egg.v = mut; if (AA.lastLuck) egg.lucky = 1; }      // Runde 21a: Farbfutter hat geholfen (Schlüpf-Meldung)
    egg.g = AA.inheritGenes(a, b); egg.bred = 1;     // Gene der Eltern (js/biz.js)
    egg.pa = [a.name, b.name]; if (m.cross) egg.hy = [a.sp, b.sp];       // Runde 12: fürs Info-Fenster des Eis
    t.eggs.push(egg);                                // das Ei zählt sofort als Bewohner
    s.stats.eggs++; s.stats.spMated[m.sp] = 1;
    AA.emit('eggMade', egg, a, b, t, m);             // Runde 20e: auch beim Nachrechnen – Maulbrüter, Kuckuckswels (js/africa.js)
    if (!silent) AA.emit('eggLaid', egg, a, b, t);
    AA.checkMedals();
  }
  AA.finishMate = finishMate;
  function finishAll(t, silent) { const ms = (t.matings || []).slice(); for (let i = 0; i < ms.length; i++) finishMate(t, ms[i], silent); }
  AA.finishMates = finishAll;

  /* ---------- Simulation: ein Zeitschritt (Spiel-Sekunden) für ein Becken ---------- */
  AA.advance = function (t, dt, sum) {
    const s = AA.state, n = t.fish.length, fed = t.feeder > 0, keeper = !!(s.staff && s.staff.keeper);
    const growK = (t.role === 'aufzucht' ? AA.ROLES.aufzucht.grow : 1) * AA.bioGrow(t), mi = AA.mistle(t), hatchK = t.role === 'brut' ? AA.ROLES.brut.hatch : (mi ? 1 / mi.hatch : 1);   // Runde 18: Mistelzweig
    if (fed) t.feeder = Math.max(0, t.feeder - dt);
    const gp = AA.growPrep(t);                       // Schwarm, Turbofutter, Putzerstation (js/life.js)
    for (let i = 0; i < t.fish.length; i++) {
      const f = t.fish[i], def = AA.FISH_BY[f.sp];
      f.hunger = Math.max(0, f.hunger - dt / B.hungerSeconds);
      if ((fed || keeper) && f.hunger < B.feederKeep) { f.hunger = B.feederKeep; f.starve = 0; f.sick = false; }
      if (f.hunger <= 0) {
        f.starve += dt;
        if (!f.sick && f.starve >= B.sickSeconds * AA.vitMult(f)) { f.sick = true; if (sum) sum.sick++; AA.emit('sick', f, t); }
      } else f.starve = 0;
      if (f.sick && gp.doctor && f.hunger > 0) {     // Putzerstation im Becken: Kranke werden nach und nach gesund (auch während du weg bist)
        f.doc = (f.doc || 0) + dt; if (f.doc >= 7200) { f.sick = false; f.starve = 0; f.doc = 0; AA.emit('cleaned', f, true); }
      }
      if (f.sick) continue;                          // kranke Fische bleiben in ihrer Wachstumsphase stehen
      const before = f.adult ? 4 : AA.phase(f);
      f.age += f.adult ? dt : dt * growK * AA.growMult(gp, f);
      if (!f.adult) {
        if (f.sp === 'salmon' && t.water === 'salt') f.sea = (f.sea || 0) + dt * growK;      // Lachs: Jugend im Meer zählt mit
        if (f.age >= def.grow) {
          f.adult = true;
          if (f.sp === 'salmon' && (f.sea || 0) >= def.grow * AA.SALMON.sea) f.msea = 1;      // Meerlachs
          s.stats.raised++; s.stats.spRaised[f.sp] = 1;
          if (def.xp && !AA.visit) { AA.addXP(def.xp); s.stats.raisedXp = (s.stats.raisedXp || 0) + def.xp; if (sum) sum.xp = (sum.xp || 0) + def.xp; }      // Runde 15: Erfahrung fürs Großziehen
          if (sum) sum.matured++;
          AA.emit('matured', f, t);
          AA.checkMedals();
        } else if (AA.phase(f) !== before) AA.emit('phase', f, t);
      }
    }
    for (let i = t.eggs.length - 1; i >= 0; i--) {
      const e = t.eggs[i];
      e.hatch -= dt * hatchK * (AA.eggK ? AA.eggK(t, e) : 1);      // Runde 20e: Großfamilie brütet schneller (js/africa.js)
      if (e.hatch <= 0) {
        t.eggs.splice(i, 1);
        const baby = AA.makeFish(e.sp);
        baby.hunger = 0.1;                           // frisch geschlüpft und sehr hungrig
        if (e.v) baby.v = e.v;                       // Farbvariante aus dem Ei
        if (e.g) baby.g = { c: e.g.c, s: e.g.s, v: e.g.v };
        if (e.bred && AA.fishClass(baby).id === 'S') s.stats.sBred++;
        t.fish.push(baby); s.stats.hatched++;
        const fresh = AA.bookSee(e.sp, e.v);         // neu fürs Sammelbuch?
        if (sum) { sum.hatched++; if (e.v) (sum.variants = sum.variants || []).push({ sp: e.sp, v: e.v, name: baby.name, fresh: fresh }); }
        AA.emit('hatched', baby, e, t, fresh);
      }
    }
    if (n) t.dirt = Math.min(1, t.dirt + dt * (0.25 + 0.075 * n) / B.dirtSeconds * (1 - AA.cleanPower(t)) * AA.fishAlgae(t));      // Krabbler bremsen (cleanPower), Graskarpfen und Putzerfische obendrauf (fishAlgae)
    if (keeper && t.dirt > AA.STAFF.keeper.dirt) t.dirt = Math.max(AA.STAFF.keeper.dirt, t.dirt - dt / 1800);       // der Pfleger putzt nach und nach   // mehr Fische = schneller schmutzig; Algenfresser bremsen
  };
  AA.rollDaily = function () {
    const s = AA.state, d = AA.day();
    if (s.daily.day === d) return false;
    s.daily = { day: d, chest: false, hunts: 0, gift: false };
    AA.marketRoll();                                 // neuer Tageskurs (js/biz.js)
    AA.farmDay();                                    // Löhne, Vertrags-Angebote, Zuchtmeister (js/farm.js)
    AA.questRoll();                                  // neue Tagesaufträge, ggf. neue Wochenkarte
    AA.emit('newDay');
    return true;
  };
  /* läuft in jedem Bild: dtGame = Spiel-Sekunden, dtReal = echte Sekunden (für die Balz) */
  AA.tick = function (dtGame, dtReal) {
    const s = AA.state;
    s.clock += dtGame;
    for (let i = 0; i < s.tanks.length; i++) {
      const t = s.tanks[i];
      AA.advance(t, dtGame);
      const ms = t.matings;
      if (ms && ms.length) for (let k = ms.length - 1; k >= 0; k--) { const m = ms[k]; m.t -= dtReal; if (m.t <= 0) finishMate(t, m); }
    }
    AA.rollDaily();
    AA.ordersTick();                                 // Kunden: Fristen, neue Aufträge
    AA.farmTick();                                   // Personal, Verträge (js/farm.js)
  };
  /* Offline-/Hintergrundzeit nachholen */
  AA.catchUp = function (seconds) {
    const sum = { seconds: seconds, matured: 0, hatched: 0, sick: 0, days: 0, xp: 0, bred: 0 };
    if (!(seconds > 0)) return sum;
    seconds = Math.min(seconds, 60 * DAY);
    const s = AA.state, d0 = AA.day();
    const steps = Math.min(6000, Math.max(1, Math.ceil(seconds / 60))), dt = seconds / steps;
    AA.quiet = true;
    try {
      for (let i = 0; i < s.tanks.length; i++) finishAll(s.tanks[i], true);
      let nextMaster = 0;                              // Runde 15: der Zuchtmeister arbeitet auch, während du weg bist (alle 3 Spielminuten = kürzeste Pause)
      for (let k = 0; k < steps; k++) {
        s.clock += dt; for (let i = 0; i < s.tanks.length; i++) AA.advance(s.tanks[i], dt, sum);
        if (AA.masterWork && s.staff && s.staff.master && s.clock >= nextMaster) { nextMaster = s.clock + 180; sum.bred += AA.masterWork(true); }
      }
      sum.days = AA.day() - d0;
      AA.rollDaily();
      const f0 = s.stats.ordersFailed || 0; AA.ordersTick(); sum.ordersFailed = (s.stats.ordersFailed || 0) - f0;
      AA.farmTick(sum);
    } finally { AA.quiet = false; }
    AA.emit('hud');
    return sum;
  };

  /* ---------- Füttern: eine Prise aus dem Vorrat; 1 XP in 70 % der Fälle, dazu 1 XP je Bissen ---------- */
  AA.shake = function (t) {
    const s = AA.state;
    if (!t.fish.length) return 'nofish';
    if (s.food <= 0) return 'nofood';
    if (!AA.hungryCount(t)) return 'sated';
    s.food--; s.stats.shakes++;
    if (Math.random() < B.shakeXpChance) AA.addXP(1); else AA.emit('hud');
    return true;
  };
  AA.bite = function (f) {
    f.hunger = Math.min(1, f.hunger + B.biteFill); f.starve = 0;
    let recovered = false;
    if (f.sick && f.hunger >= 0.5) { f.sick = false; recovered = true; }
    AA.state.stats.bites++;
    AA.addXP(1);
    return recovered;
  };

  /* ---------- Putzen: jeder Bürstenstrich nimmt 10 % Schmutz und gibt 10 XP ---------- */
  AA.scrub = function (t) {
    if (t.dirt <= 0.004) return false;
    t.dirt = Math.max(0, t.dirt - B.cleanStep);
    if (t.dirt < 0.004) t.dirt = 0;
    AA.state.stats.cleans++;
    AA.addXP(B.cleanXp);
    AA.checkMedals();
    return true;
  };

  /* ---------- Schatzkiste (Aquarium 1, einmal pro Tag) – die Blubber-Muschel ersetzt sie ---------- */
  AA.chestInfo = function () {
    const s = AA.state, t0 = s.tanks[0], clean = 1 - t0.dirt;
    let happy = 0.5;
    if (t0.fish.length) { let ok = 0; for (let i = 0; i < t0.fish.length; i++) if (!t0.fish[i].sick && t0.fish[i].hunger > 0.25) ok++; happy = ok / t0.fish.length; }
    const v = (8 + 2 * s.level) * (0.4 + 0.6 * clean) * (0.4 + 0.6 * happy) * (s.clam ? 1.5 : 1);
    return { ready: !s.daily.chest, value: Math.max(3, Math.round(v)), clean: clean, happy: happy, pearls: s.clam ? 1 : 0 };
  };
  AA.collectChest = function () {
    const s = AA.state, info = AA.chestInfo();
    if (!info.ready) return null;
    const v = Math.max(3, Math.round(info.value * AA.rand(0.85, 1.15)));
    s.daily.chest = true;
    AA.addCoins(v);
    if (info.pearls) AA.addPearls(info.pearls);
    s.stats.chests++; s.stats.chestCoins += v;
    return { coins: v, pearls: info.pearls };
  };

  /* ---------- Tagesgeschenk und Schatzsuche ---------- */
  AA.claimGift = function () {
    const s = AA.state;
    if (s.daily.gift) return 0;
    s.daily.gift = true; s.stats.gifts++;
    AA.addFood(B.gift);
    return B.gift;
  };
  AA.huntsLeft = function () { return Math.max(0, B.hunts - AA.state.daily.hunts); };
  AA.beginHunt = function () { const s = AA.state; if (AA.huntsLeft() <= 0) return false; s.daily.hunts++; s.stats.hunts++; AA.emit('hud'); return true; };
  AA.finishHunt = function (coins, prizes) {
    const s = AA.state, placed = [];
    if (coins > 0) { AA.addCoins(coins); AA.addXP(coins); s.stats.huntCoins += coins; }
    (prizes || []).forEach(function (p) {
      if (p.kind === 'coins') { AA.addCoins(p.n); s.stats.huntCoins += p.n; }
      else if (p.kind === 'food') AA.addFood(p.n);
      else if (p.kind === 'pearl') AA.addPearls(p.n);
      else if (p.kind === 'deco') { const o = AA.placeDeco(p.type); if (o) placed.push(o); else AA.addCoins(Math.round(AA.DECO_BY[p.type].price / 2)); }
    });
    AA.checkMedals();
    return placed;
  };

  /* ---------- Training: ein Trick pro Wachstumsphase (Babys sofort), 7 Tricks insgesamt ---------- */
  AA.trainSlot = function (f) { return Math.floor(f.age / AA.FISH_BY[f.sp].phaseLen); };
  AA.trainStatus = function (f) {
    if (AA.FISH_BY[f.sp].still) return { ok: false, why: 'still' };      // Steinfisch: rührt sich kaum – der lernt keine Tricks
    if (f.tricks.length >= AA.TRICKS.length) return { ok: false, why: 'done' };
    if (f.sick) return { ok: false, why: 'sick' };
    if (f.hunger <= 0) return { ok: false, why: 'hungry' };
    const def = AA.FISH_BY[f.sp];
    if (AA.trainSlot(f) <= f.trainPh) return { ok: false, why: 'wait', wait: (f.trainPh + 1) * def.phaseLen - f.age };
    return { ok: true, trick: AA.TRICKS[f.tricks.length] };
  };
  AA.finishTraining = function (f, ok, loot) {
    const s = AA.state;
    f.trainPh = AA.trainSlot(f);                     // die Chance dieser Phase ist verbraucht – auch wenn es nicht geklappt hat
    if (!ok) { s.stats.trainFails++; AA.emit('hud'); return null; }
    const trick = AA.TRICKS[f.tricks.length];
    f.tricks.push(trick.id);
    const base = { coins: AA.randi(1, 8), food: AA.randi(1, 8) };
    const res = { trick: trick, coins: base.coins + ((loot && loot.coins) || 0), food: base.food + ((loot && loot.food) || 0), base: base, loot: loot || { coins: 0, food: 0 } };
    AA.addCoins(res.coins); AA.addFood(res.food);
    s.stats.trained++;
    return res;
  };
  AA.trickDone = function () { AA.state.stats.tricks++; AA.checkMedals(); };

  /* ---------- Deko / Kies / Hintergründe / Becken ---------- */
  function freeSpot(t) {
    let bx = 640, bz = 0.6, bd = -1;
    for (let k = 0; k < 18; k++) {
      const z = AA.rand(0.15, 0.9), lim = AA.xLimits(z), x = AA.rand(lim[0] + 110, lim[1] - 110);
      let dmin = 1e9;
      for (let i = 0; i < t.deco.length; i++) dmin = Math.min(dmin, Math.abs(t.deco[i].x - x) + Math.abs(t.deco[i].z - z) * 400);
      if (dmin > bd) { bd = dmin; bx = x; bz = z; }
    }
    return { x: bx, z: bz };
  }
  /* Deko und Krabbler werden getrennt gezählt (AA.decoMax / AA.crawlMax pro Becken) */
  AA.decoCount = function (t, crawl) {
    let n = 0;
    for (let i = 0; i < t.deco.length; i++) if (!!AA.DECO_BY[t.deco[i].type].crawl === !!crawl) n++;
    return n;
  };
  /* Runde 11: Grenzen je Becken – Krabbler 5 (Meeres- und Tiefsee-Becken 8), Deko wächst mit der Größe (nie unter den alten 30) */
  AA.crawlMax = function (t) { return (t.ocean || t.deep) ? B.maxCrawlBig : Math.max(B.maxCrawl, (B.crawlBySize || [])[t.size | 0] || 0); };
  AA.decoMax = function (t) { return t.ocean ? B.decoOcean : (t.deep ? B.decoDeep : Math.max(B.maxDeco, B.decoBySize[t.size | 0] || B.maxDeco)); };
  AA.decoRoom = function (t, def) { return def.crawl ? AA.decoCount(t, true) < AA.crawlMax(t) : AA.decoCount(t, false) < AA.decoMax(t); };
  /* Algenfresser unter den Krabblern: so stark bremsen sie zusammen das Veralgen (0…B.cleanMax) */
  AA.cleanPower = function (t) {
    let c = 0;
    for (let i = 0; i < t.deco.length; i++) c += AA.DECO_BY[t.deco[i].type].clean || 0;
    return Math.min(B.cleanMax, c);
  };
  /* ---------- Deko-Größe: o.s (1 = Originalgröße, fehlt dann einfach), Grenzen je Stück aus AA.DECO_SIZE / def.size ---------- */
  AA.decoRange = function (def) {                    // [kleinste, größte] oder null = feste Größe
    if (!def || def.size === false || def.crawl || def.daily) return null;
    return def.size || AA.DECO_SIZE[def.cat] || null;
  };
  AA.decoScale = function (o) {
    if (o.s === undefined) return 1;
    const r = AA.decoRange(AA.DECO_BY[o.type]);
    return r ? AA.clamp(+o.s || 1, r[0], r[1]) : 1;
  };
  /* halbe „Standbreite“: so weit darf ein Stück höchstens über den Beckenrand hinausragen (wie beim Verschieben) */
  AA.decoClampX = function (o) {
    const lim = AA.xLimits(o.z), hw = AA.DECO_BY[o.type].w * AA.depthScale(o.z) * AA.decoScale(o) * 0.4;
    o.x = AA.clamp(o.x, lim[0] - 30 + hw, lim[1] + 30 - hw);
  };
  AA.setDecoScale = function (o, s) {
    const r = AA.decoRange(AA.DECO_BY[o.type]);
    if (!r || !(s > 0)) return AA.decoScale(o);
    s = AA.clamp(Math.round(s * 100) / 100, r[0], r[1]);
    if (Math.abs(s - 1) < 0.005) delete o.s; else o.s = s;
    AA.decoClampX(o);                                // größer geworden? Dann notfalls ein Stück vom Rand wegrücken
    return AA.decoScale(o);
  };
  AA.decoFits = function (def, t) { return !def.crawl || AA.livesIn(def, t); };       // nur Krabbler sind ans Wasser gebunden
  AA.placeDeco = function (type, t) {
    t = t || AA.tank();
    if (!AA.DECO_BY[type] || !AA.decoFits(AA.DECO_BY[type], t) || !AA.decoRoom(t, AA.DECO_BY[type])) return null;
    const p = freeSpot(t), o = { id: AA.uid(), type: type, x: p.x, z: p.z, flip: !AA.DECO_BY[type].text && Math.random() < 0.5 };
    t.deco.push(o);
    if (t === AA.tank()) AA.decoClampX(o);           // nicht in die Seitenscheiben (Runde 10)
    AA.emit('decoAdded', o, t);
    return o;
  };
  AA.buyDeco = function (type) {
    const s = AA.state, def = AA.DECO_BY[type];
    let t = AA.tank();
    if (!def || def.fixed || def.trophy) return 'unknown';      // Pokale gibt es nur zu gewinnen (Runde 12)
    if (def.season && !AA.season()[def.season]) return 'season';      // Runde 18: Weihnachts-Deko nur in der Weihnachtszeit
    if (s.level < def.lvl) return 'level';
    if (def.unique && s.clam) return 'owned';
    if (!AA.decoFits(def, t)) return 'water';
    if (!def.unique && !AA.decoRoom(t, def)) return def.crawl ? 'crawlfull' : 'decofull';
    if (def.pearls ? s.pearls < def.pearls : s.coins < def.price) return def.pearls ? 'pearls' : 'coins';      // Runde 18: Mistelzweig kostet Perlen
    if (def.pearls) AA.addPearls(-def.pearls); else AA.addCoins(-def.price, false);
    s.stats.decoBought++; s.stats.spentDeco += def.price;
    let o;
    if (type === 'bubbleclam') {                      // tauscht die Schatzkiste in Aquarium 1 aus
      t = s.tanks[0];
      const old = t.deco.find(function (d) { return d.type === 'chest'; });
      s.clam = true;
      if (old) { old.type = 'bubbleclam'; o = old; AA.emit('decoAdded', o, t); }
      else o = AA.placeDeco(type, t);
    } else o = AA.placeDeco(type, t);
    AA.checkMedals();
    return o || 'decofull';
  };
  AA.unstackFrom = function (t, P) {                 // alles, was direkt auf P steht, landet auf dem Kies (gleiche Stelle)
    t.deco.forEach(function (d) { if (d.on === P.id) { delete d.on; delete d.oi; delete d.ou; } });
  };
  AA.decoSellValue = function (o) { const def = AA.DECO_BY[o.type]; return (!def || def.daily) ? 0 : Math.round(def.price * 0.5); };
  AA.sellDeco = function (o) {
    const t = AA.tank(), i = t.deco.indexOf(o), v = AA.decoSellValue(o);
    if (i < 0 || AA.DECO_BY[o.type].daily) return 0;
    AA.unstackFrom(t, o);
    t.deco.splice(i, 1);
    AA.addCoins(v, false);
    AA.emit('decoRemoved', o);
    return v;
  };
  AA.moveDeco = function (o, toIdx) {
    const s = AA.state, t = AA.tank(), to = s.tanks[toIdx], i = t.deco.indexOf(o);
    if (i < 0 || !to || to === t || AA.DECO_BY[o.type].daily) return 'unknown';
    if (!AA.decoFits(AA.DECO_BY[o.type], to)) return 'water';
    if (!AA.decoRoom(to, AA.DECO_BY[o.type])) return AA.DECO_BY[o.type].crawl ? 'crawlfull' : 'decofull';
    AA.unstackFrom(t, o);
    t.deco.splice(i, 1);
    delete o.on; delete o.oi; delete o.ou;
    const p = freeSpot(to); o.x = p.x; o.z = p.z; AA.decoClampX(o);
    to.deco.push(o);
    AA.emit('decoRemoved', o);
    return true;
  };
  AA.setFloor = function (id) {
    const def = AA.FLOOR_BY[id];
    if (!def) return 'unknown';
    if (AA.state.level < def.lvl) return 'level';
    AA.tank().floor = id;                            // Kies wechseln kostet nichts
    AA.emit('sceneChanged');
    return true;
  };
  AA.setWall = function (id) {
    const s = AA.state, def = AA.WALL_BY[id];
    if (!def) return 'unknown';
    if (def.theme && s.walls.indexOf(id) < 0) return 'locked';      // Runde 19: Gold-Kulisse – nur zu verdienen (js/themes.js)
    if (s.walls.indexOf(id) < 0) {
      if (s.pearls < def.pearls) return 'pearls';
      AA.addPearls(-def.pearls);
      s.walls.push(id);
    }
    AA.tank().wall = id;
    AA.emit('sceneChanged');
    return true;
  };
  AA.upgradeTank = function () {
    const s = AA.state, t = AA.tank();
    if (AA.wide(t) || t.size >= AA.SIZES.length - 1) return 'max';
    const rq = AA.tankReqFor(s.active, t.size + 1);
    if (s.level < rq.lvl) return 'level';
    if (s.coins < rq.price) return 'coins';
    AA.addCoins(-rq.price, false);
    t.size++;
    AA.emit('hud');
    return true;
  };
  /* Becken-Leiter des Vorbilds: das Bonus-Becken (erstes Süßwasser-Becken, Sonderangebot) zählt nicht mit */
  AA.hasBonusTank = function () { return AA.state.tanks.some(function (t) { return t.bonus; }); };
  AA.hasWater = function (w) { return AA.state.tanks.some(function (t) { return t.water === w; }); };
  /* erster freier Name „Aquarium k“ ab k = start (keine zwei Becken gleichen Namens) */
  AA.freeTankName = function (tanks, start) {
    const used = {}; tanks.forEach(function (t) { used[t.name] = 1; });
    let k = Math.max(1, start | 0);
    while (used['Aquarium ' + k]) k++;
    return 'Aquarium ' + k;
  };
  AA.regularTanks = function () { return AA.state.tanks.filter(function (t) { return !t.bonus && !AA.wide(t); }).length; };
  AA.ladderIdx = function (i) { let n = 0; for (let k = 0; k < i; k++) if (!AA.state.tanks[k].bonus && !AA.wide(AA.state.tanks[k])) n++; return n; };
  AA.tankReqFor = function (i, size) { const t = AA.state.tanks[i]; return AA.tankReq(AA.ladderIdx(i), size, !!(t && t.bonus)); };
  AA.newTankReq = function (bonus) { return bonus ? AA.tankReq(0, 0, true) : AA.tankReq(AA.regularTanks(), 0); };
  AA.buyTank = function (water, bonus) {
    const s = AA.state;
    water = water === 'fresh' ? 'fresh' : 'salt';
    if (bonus) { if (water !== 'fresh' || AA.hasBonusTank()) return 'owned'; }
    else if (AA.regularTanks() >= AA.MAX_TANKS) return 'max';
    const rq = AA.newTankReq(!!bonus);
    if (s.level < rq.lvl) return 'level';
    if (s.coins < rq.price) return 'coins';
    AA.addCoins(-rq.price, false);
    const nt = AA.newTank(s.tanks.length, water, !!bonus);
    nt.name = AA.freeTankName(s.tanks, AA.regularTanks() + 1);      // Runde 14: zählt nur normale Becken (vorher hieß das 7. Becken z. B. „Aquarium 10“)
    s.tanks.push(nt);
    s.active = s.tanks.length - 1;
    AA.emit('tankChanged');
    return true;
  };
  AA.switchTank = function (i) {
    const s = AA.state;
    i = (i + s.tanks.length) % s.tanks.length;
    if (i === s.active) return;
    s.active = i;
    AA.emit('tankChanged');
  };
  AA.buyFood = function (id) {
    const s = AA.state, def = AA.FOOD_BY[id];
    if (!def) return 'unknown';
    if (s.level < def.lvl) return 'level';
    if (def.pearls) { if (s.pearls < def.pearls) return 'pearls'; AA.addPearls(-def.pearls); }
    else { if (s.coins < def.price) return 'coins'; AA.addCoins(-def.price, false); }
    if (def.food) AA.addFood(def.food);
    if (def.days) { const t = AA.tank(); t.feeder = (t.feeder || 0) + def.days * DAY; AA.emit('hud'); }
    return true;
  };

  /* ---------- Erfolge ---------- */
  AA.medalState = function (m) {
    const s = AA.state, cur = m.get(s) || 0, got = s.medals[m.id] || 0;
    let reached = 0;
    while (reached < m.goals.length && cur >= m.goals[reached]) reached++;
    return { cur: cur, got: got, reached: reached, claimable: reached > got, goal: got < m.goals.length ? m.goals[got] : null };
  };
  AA.claimable = function () {
    let n = 0;
    for (let i = 0; i < AA.MEDALS.length; i++) if (AA.medalState(AA.MEDALS[i]).claimable) n++;
    return n;
  };
  let lastClaimable = -1;
  AA.checkMedals = function () {
    const n = AA.claimable();
    if (n !== lastClaimable) { const more = n > lastClaimable && lastClaimable >= 0; lastClaimable = n; AA.emit('medals', n, more); }
  };
  AA.claimMedal = function (id) {
    const m = AA.MEDALS.find(function (x) { return x.id === id; });
    if (!m) return null;
    const st = AA.medalState(m);
    if (!st.claimable) return null;
    const tier = AA.MEDAL_TIERS[st.got];
    AA.state.medals[id] = st.got + 1;
    AA.addXP(tier.xp); AA.addPearls(tier.pearls);
    AA.checkMedals();
    return tier;
  };

  /* ---------- kleine Cheats für die Konsole (ist ja dein Spiel) ---------- */
  AA.cheat = {
    coins: function (n) { AA.noLedger = true; AA.addCoins(n || 1000, false); AA.noLedger = false; return AA.state.coins; },
    pearls: function (n) { AA.addPearls(n || 10); return AA.state.pearls; },
    food: function (n) { AA.addFood(n || 50); return AA.state.food; },
    level: function (n) { const s = AA.state; n = AA.clamp(n | 0, 1, AA.MAX_LEVEL); s.xp = AA.LEVELS[n - 1]; s.level = n; AA.emit('hud'); return n; },
    time: function (sec) { return AA.catchUp(sec || 3600); },
    dirty: function (v) { AA.tank().dirt = AA.clamp(v === undefined ? 0.8 : v, 0, 1); AA.emit('hud'); return AA.tank().dirt; },
    hungry: function (v) { AA.tank().fish.forEach(function (f) { f.hunger = v === undefined ? 0.1 : v; }); AA.emit('hud'); },
    grow: function () { AA.tank().fish.forEach(function (f) { const d = AA.FISH_BY[f.sp]; if (!f.adult) { f.age = d.grow; f.adult = true; } }); AA.emit('hud'); },
    newday: function () { const s = AA.state; s.clock += AA.dayLeft() + 1; AA.rollDaily(); AA.emit('hud'); }
  };
})(window.AA);
