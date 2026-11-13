'use strict';
/* Awesome Aquarium – Runde 10: Familie (Regeln, ohne Grafik).
     • Tägliches Ritual 📅: Login-Kalender mit 7-Tage-Serie. Es zählen echte Kalendertage (Datum auf diesem Gerät), nicht die Spiel-Uhr –
       wer einen Tag auslässt, fängt wieder bei Tag 1 an. Tag 7: ein seltener Fisch (Farbvariante ab Seltenheit 2) als Baby.
       Ist nirgends Platz, gibt es stattdessen ein großes Glitzer-Ei (garantiert seltene Farbe, schlüpft, wann du willst).
     • Rangliste 🏆: Level, Arten im Sammelbuch, Schönheits-Note (beste Becken-Note, js/decor.js). Daten: du, die Familie aus der Wolke
       (my_friends liefert level, species, beauty) und – solange eingeschaltet – der Testfreund.
     • Testfreund „Testi“ 🧪: wohnt nur auf diesem Gerät. Sein Aquarium wird aus einem festen Startwert gebaut (sieht jedes Mal gleich aus)
       und lässt sich wie das eines echten Freundes besuchen; er wächst langsam mit (jeden Tag ein bisschen höheres Level).
   Oberfläche: js/familyui.js · Regeln in Worten: docs/MECHANIK.md § 6h */
(function (AA) {
  function S() { return AA.state; }

  /* ---------- Tägliches Ritual ---------- */
  AA.LOGIN = [
    { k: 'coins', n: 1, ico: '🪙', name: 'Münzen' },
    { k: 'food', n: 30, ico: '🥫', name: '30 Prisen Futter' },
    { k: 'pearls', n: 1, ico: '⚪', name: '1 Perle' },
    { k: 'coins', n: 2, ico: '💰', name: 'Doppelte Münzen' },
    { k: 'color', n: 3, ico: '🌈', name: '3× Farbfutter' },
    { k: 'pearls', n: 2, ico: '⚪', name: '2 Perlen' },
    { k: 'fish', n: 1, ico: '✨', name: 'Seltener Fisch' }
  ];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dstr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  AA.today = function () { return dstr(new Date(AA.nowMs ? AA.nowMs() : Date.now())); };
  function yday() { const d = new Date(AA.nowMs ? AA.nowMs() : Date.now()); d.setDate(d.getDate() - 1); return dstr(d); }
  AA.loginCoins = function () { return Math.max(50, Math.round((30 + 12 * S().level) / 10) * 10); };
  AA.familyFix = function (s) {
    const L = s.login && typeof s.login === 'object' ? s.login : {};
    s.login = { last: typeof L.last === 'string' && /^\d{4}-\d\d-\d\d$/.test(L.last) ? L.last : '', day: AA.clamp(L.day | 0, 0, 7),
      streak: Math.max(0, L.streak | 0), best: Math.max(0, L.best | 0), total: Math.max(0, L.total | 0) };
    if (s.settings && s.settings.testFriend === undefined) s.settings.testFriend = true;
  };
  /* Wie steht es heute? done = schon abgeholt; day = der Tag (1–7), der heute dran ist bzw. war; broken = gestern verpasst */
  AA.loginInfo = function () {
    const L = S().login, today = AA.today();
    if (L.last && L.last >= today) return { done: true, day: L.day || 1, streak: L.streak, best: L.best, total: L.total };
    const cont = L.last === yday();
    return { done: false, day: cont ? (L.day % 7) + 1 : 1, streak: cont ? L.streak : 0, best: L.best, total: L.total, broken: !!L.last && !cont && L.day > 0 && L.day < 7 };
  };
  AA.loginReward = function (day) {
    const R = AA.LOGIN[day - 1];
    if (R.k === 'coins') return { k: 'coins', n: AA.loginCoins() * R.n };
    return { k: R.k, n: R.n };
  };
  function rareFish() {
    const s = S(), order = [s.active];
    s.tanks.forEach(function (t, i) { if (i !== s.active) order.push(i); });
    for (let k = 0; k < order.length; k++) {
      const t = s.tanks[order[k]];
      if (AA.count(t) >= AA.cap(t)) continue;
      const pool = AA.FISH.filter(function (d) { return !d.hybrid && d.id !== 'carp' && d.lvl <= Math.max(3, s.level) && AA.livesIn(d, t); });
      if (!pool.length) continue;
      const want = pool.filter(function (d) { const b = s.book[d.id]; return !b || AA.variantsOf(d.id).some(function (v) { return v.tier >= 2 && !(b.v && b.v[v.id]); }); });
      const P = want.length ? want : pool, d = P[Math.floor(Math.random() * P.length)];
      const have = (s.book[d.id] || { v: {} }).v, v = AA.pickVariant(2, have, d.id);
      const f = AA.makeFish(d.id);
      f.v = v; f.hunger = 0.8;
      t.fish.push(f);
      AA.bookSee(d.id, v);
      AA.emit('fishAdded', f, 'gift');
      return { fish: f, tank: order[k] };
    }
    s.glitterBig = (s.glitterBig | 0) + 1;              // nirgends Platz: ein großes Glitzer-Ei (garantiert selten)
    AA.emit('hud');
    return { glitter: true };
  }
  AA.loginClaim = function () {
    const s = S(), inf = AA.loginInfo();
    if (inf.done || AA.visit) return null;
    const r = AA.loginReward(inf.day), res = { day: inf.day, k: r.k, n: r.n };
    if (r.k === 'coins') AA.addCoins(r.n, false);
    else if (r.k === 'food') AA.addFood(r.n);
    else if (r.k === 'pearls') AA.addPearls(r.n);
    else if (r.k === 'color') { s.food2.color = (s.food2.color | 0) + r.n; AA.emit('hud'); }
    else if (r.k === 'fish') { const q = rareFish(); res.fish = q.fish; res.tank = q.tank; res.glitter = q.glitter; }
    const L = s.login;
    L.streak = inf.streak + 1; L.best = Math.max(L.best, L.streak); L.day = inf.day; L.last = AA.today(); L.total++;
    AA.emit('login', res);
    AA.checkMedals();
    return res;
  };

  /* ---------- Testfreund ---------- */
  AA.TEST = { user: 'test', name: 'Testi', avatar: 'axolotl', since: Date.UTC(2026, 10, 12), seed: 4711 };
  AA.testOn = function () { return !!(S() && S().settings && S().settings.testFriend !== false); };
  function testLevel() { const days = Math.max(0, Math.floor((Date.now() - AA.TEST.since) / 86400000)); return Math.min(AA.MAX_LEVEL || 60, 14 + Math.floor(days * 0.5)); }
  /* Sein Aquarium: zwei Becken (Riff und Amazonas), Deko aus allen Runden, ein paar Farbvarianten – alles aus einem festen Startwert */
  AA.testState = function () {
    const lvl = testLevel(), rnd = AA.rng(AA.TEST.seed + lvl), now = Date.now();
    const pick = function (a) { return a[Math.floor(rnd() * a.length)]; };
    const okDeco = function (id) { const d = AA.DECO_BY[id]; return d && !d.crawl && d.lvl <= lvl; };
    const deco = function (t, list) {
      list.forEach(function (q) { if (!okDeco(q[0])) return; const o = { id: 'td' + t.deco.length + t.water, type: q[0], x: q[1], z: q[2], flip: !!q[3] }; if (q[4]) o.c = q[4]; if (q[5]) o.r = q[5]; if (q[6]) o.s = q[6]; t.deco.push(o); });
    };
    const fish = function (t, n) {
      const pool = AA.FISH.filter(function (d) { return !d.hybrid && d.lvl <= lvl && AA.livesIn(d, t) && !d.ocean && !d.big && !d.pred; });
      for (let i = 0; i < n && pool.length; i++) {
        const d = pick(pool), f = { id: 'tf' + t.water + i, sp: d.id, name: pick(AA.NAMES), sex: rnd() < 0.5 ? 'm' : 'f', age: d.grow * (0.5 + rnd()), adult: rnd() < 0.7, hunger: 0.8, starve: 0, sick: false, tricks: [], trainPh: -1, born: 0 };
        if (f.age >= d.grow) f.adult = true;
        if (rnd() < 0.25) f.v = pick(['gold', 'albino', 'amethyst', 'night', 'rainbow'].filter(function (v) { return AA.VAR_BY[v]; }));
        t.fish.push(f);
      }
    };
    const a = { id: 'test-a', name: 'Testis Riff', size: 2, floor: AA.FLOOR_BY.coralsand ? 'coralsand' : 'sand', wall: AA.WALL_BY.reef2 ? 'reef2' : 'reef', water: 'salt', deco: [], fish: [], eggs: [], dirt: 0.06, feeder: 0, matings: [], seed: 7 };
    deco(a, [['chest', 1050, 0.55], ['liverock', 250, 0.3], ['arch', 470, 0.45], ['anemone_pink', 640, 0.72], ['coral_purple', 330, 0.82, true], ['coral_plate', 820, 0.4], ['braincoral', 930, 0.78],
      ['torchcoral', 160, 0.7], ['seafan', 720, 0.2], ['rock_grey', 560, 0.25, false, 'slate'], ['staghorn', 1150, 0.3], ['zoanthus', 400, 0.9], ['pebbles3', 980, 0.92, false, 'sand'], ['seaweed_pink', 90, 0.4]]);
    fish(a, 11);
    const b = { id: 'test-b', name: 'Testis Amazonas', size: 1, floor: AA.FLOOR_BY.riosand ? 'riosand' : 'amazonsoil', wall: AA.WALL_BY.jungle ? 'jungle' : 'amazon', water: 'fresh', deco: [], fish: [], eggs: [], dirt: 0.1, feeder: 0, matings: [], seed: 9 };
    deco(b, [['driftwood', 360, 0.35], ['spiderwood', 860, 0.3], ['amazonsword', 200, 0.6], ['vallisneria', 1100, 0.25], ['javafern', 640, 0.7], ['anubias', 980, 0.8], ['mossball', 520, 0.95], ['seiryu', 740, 0.4, false, '', -15], ['cabomba', 90, 0.3]]);
    fish(b, 9);
    const book = {};
    AA.FISH.filter(function (d) { return !d.hybrid && d.lvl <= lvl; }).forEach(function (d, i) { if (i % 4 !== 3) book[d.id] = { n: 2, v: {} }; });
    [a, b].forEach(function (t) { t.fish.forEach(function (f) { const e = book[f.sp] || (book[f.sp] = { n: 2, v: {} }); if (f.v) e.v[f.v] = 2; }); });
    const xp = (AA.LEVELS[lvl - 1] || 0) + 40;
    return { v: AA.SAVE_V, coins: 4200 + lvl * 150, pearls: 12, food: 140, xp: xp, level: lvl, clock: 12 * 3600, tanks: [a, b], active: 0, walls: ['aqua', a.wall, b.wall], clam: false, mateCd: {},
      daily: { day: 0, chest: true, hunts: 2, gift: true }, medals: {}, settings: { sound: true, speed: 1, night: false }, book: book, lastSeen: now, created: now - 86400000 * 9, intro: true };
  };
  let testCache = null;
  /* Werte für Rangliste und Freundes-Leiste – aus seinem echten Aquarium berechnet, damit beides zusammenpasst */
  AA.testStats = function () {
    const lvl = testLevel();
    if (testCache && testCache.level === lvl) return testCache;
    const st = AA.testState();
    let fish = 0; st.tanks.forEach(function (t) { fish += t.fish.length; });
    const s0 = AA.state;
    let beauty = 0;
    try { st.tanks.forEach(function (t) { beauty = Math.max(beauty, AA.beauty(t).score); }); } catch (e) { beauty = 60; }
    AA.state = s0;
    testCache = { level: lvl, species: Object.keys(st.book).length, beauty: beauty, fish: fish };
    return testCache;
  };
  /* Besuch bei Testi: wie bei echten Freunden (js/cloud.js – Sitzungs-Speicher „aa-visit“, dann neu laden) */
  AA.visitTest = function () {
    const st = AA.testState(), ts = AA.testStats();
    const pack = JSON.stringify({ user: AA.TEST.user, name: AA.TEST.name, avatar: AA.TEST.avatar, at: new Date().toISOString(), level: ts.level, fish: ts.fish, raw: JSON.stringify(st), test: true });
    if (!AA.visit) AA.save();
    try { sessionStorage.setItem('aa-visit', pack); } catch (e) { return false; }
    AA.frozen = true;
    if (AA.cloud) AA.cloud.reloading = true;
    AA.emit('cloudReload');
    setTimeout(function () { location.reload(); }, 60);
    return true;
  };

  /* ---------- Rangliste ---------- */
  AA.myRankStats = function () {
    const s = S();
    return { level: s.level, species: AA.bookCounts().species, beauty: AA.beautyBest(s).score };
  };
})(window.AA);
