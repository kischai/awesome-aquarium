'use strict';
/* Awesome Aquarium – Zuchtbetrieb (Runde 5): Gene und Güteklasse, Markt mit Tageskurs, Kundenaufträge mit Ruf, Kassenbuch.
   Zahlen in js/data.js (AA.CLASSES, AA.GENE_*, AA.VAR_VALUE, AA.MARKET, AA.CUSTOMERS, AA.ORDERS, AA.REP_LEVELS), Regeln: docs/MECHANIK.md. */
(function (AA) {
  const DAY = 86400, KEYS = ['c', 's', 'v'];
  function S() { return AA.state; }
  function wpick(w) { let sum = 0; w.forEach(function (x) { sum += x; }); let r = Math.random() * sum; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; } return w.length - 1; }

  /* ---------- Gene ---------- */
  AA.shopGenes = function (bonus) { const g = {}; KEYS.forEach(function (k) { g[k] = AA.clamp(wpick(AA.GENE_SHOP) + 1 + (bonus || 0), 1, 5); }); return g; };
  AA.inheritGenes = function (a, b) {
    const R = AA.GENE_RULE, g = {};
    KEYS.forEach(function (k) {
      const pa = a && a.g ? a.g[k] : 2, pb = b && b.g ? b.g[k] : 2, m = (pa + pb) / 2;
      let x = Math.random() < 0.5 ? Math.floor(m) : Math.ceil(m);
      const r = Math.random();
      if (r < R.down) x--; else if (r < R.down + R.up) x++;
      if (Math.random() < R.jump) x++;
      g[k] = AA.clamp(x, 1, 5);
    });
    return g;
  };
  AA.fixGenes = function (f) {                         // fehlende / kaputte Gene (alte Spielstände): wie aus dem Shop
    if (!f.g || typeof f.g !== 'object') { f.g = AA.shopGenes(); return f; }
    KEYS.forEach(function (k) { const v = Math.round(+f.g[k]); f.g[k] = v >= 1 && v <= 5 ? v : AA.shopGenes()[k]; });
    return f;
  };
  AA.geneSum = function (f) { const g = f.g || { c: 2, s: 2, v: 2 }; return g.c + g.s + g.v; };
  AA.fishClass = function (f) { const n = AA.geneSum(f); let c = AA.CLASSES[0]; AA.CLASSES.forEach(function (x) { if (n >= x.min) c = x; }); return c; };
  AA.classRank = function (id) { for (let i = 0; i < AA.CLASSES.length; i++) if (AA.CLASSES[i].id === id) return i; return 0; };
  AA.varMult = function (v) { return (v && AA.VAR_VALUE[v]) || 1; };
  AA.vitMult = function (f) { return 0.7 + 0.15 * ((f.g && f.g.v) || 2); };          // Vitalität: so viel länger hält ein Fisch Hunger aus, bevor er krank wird (1 → 85 %, 5 → 145 %)
  AA.sizeMult = function (f) { return f.g ? 0.92 + 0.04 * f.g.s : 1; };              // Größe: 1 → 96 %, 5 → 112 %

  /* ---------- Markt ---------- */
  function mkt() { return S().market; }
  AA.marketRoll = function () {
    const s = S(), M = AA.MARKET, d = AA.day();
    if (!s.market) s.market = { day: -1, k: {}, t: {}, sat: {}, p: {} };
    const m = s.market;
    if (m.day === d) return false;
    const days = m.day < 0 ? 1 : Math.max(1, d - m.day);
    m.p = {}; AA.FISH.forEach(function (f) { m.p[f.id] = AA.marketFactor(f.id, true); });
    AA.FISH.forEach(function (f) {
      const old = m.k[f.id] || 1;
      m.k[f.id] = Math.round(AA.clamp(0.5 * old + 0.5 * AA.rand(0.8, 1.2), M.kMin, M.kMax) * 100) / 100;
    });
    // Trend-Arten: bevorzugt welche, die du schon kennst – sonst bringt der Trend nichts
    const lvl = s.level, known = AA.FISH.filter(function (f) { return !f.hybrid && s.book && s.book[f.id] && f.lvl <= lvl; }), open = AA.FISH.filter(function (f) { return !f.hybrid && f.lvl <= lvl + 2; });
    const pool = (known.length >= 3 ? known : open).slice();
    m.t = {};
    for (let i = 0; i < M.trends && pool.length; i++) { const f = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; m.t[f.id] = Math.round(AA.rand(M.tMin, M.tMax) * 100) / 100; }
    m.day = d;
    AA.emit('marketNew');
    return true;
  };
  /* Runde 15: Der Preis-Druck nach Verkäufen halbiert sich alle AA.MARKET.satHalf Spiel-Sekunden (vorher einmal über Nacht) */
  function relax(m) {
    const now = S().clock;
    if (!(m.satT >= 0) || m.satT > now) { m.satT = now; return; }
    const dt = now - m.satT; if (dt < 1) return;
    const k = Math.pow(0.5, dt / AA.MARKET.satHalf);
    for (const sp in m.sat) { m.sat[sp] *= k; if (m.sat[sp] < 0.05) delete m.sat[sp]; }
    m.satT = now;
  }
  /* Faktor auf den Verkaufspreis: Kurs × Trend × Sättigung (noSat: ohne Sättigung) */
  AA.marketFactor = function (sp, noSat) {
    const m = mkt(); if (!m) return 1;
    if (!noSat) relax(m);
    let f = (m.k[sp] || 1) * (m.t[sp] || 1);
    if (!noSat && m.sat[sp]) f *= Math.max(AA.MARKET.satFloor, 1 / (1 + AA.MARKET.satStep * m.sat[sp]));
    return f;
  };
  AA.marketSat = function (sp) { const m = mkt(); if (m) relax(m); return m && m.sat[sp] ? Math.max(AA.MARKET.satFloor, 1 / (1 + AA.MARKET.satStep * m.sat[sp])) : 1; };
  AA.marketChange = function (sp) { const m = mkt(); if (!m || !m.p || !m.p[sp]) return 0; return AA.marketFactor(sp, true) / m.p[sp] - 1; };
  AA.marketTrends = function () { const m = mkt(); return m ? Object.keys(m.t).map(function (sp) { return { sp: sp, mult: m.t[sp] }; }) : []; };
  function saturate(sp) { const m = mkt(); if (m) { relax(m); m.sat[sp] = (m.sat[sp] || 0) + 1; } }

  /* ---------- Kassenbuch: Einnahmen/Ausgaben je Spieltag, Verkäufe je Art (14 Tage) ---------- */
  function day() { const s = S(), d = AA.day(); s.ledger = s.ledger || {}; const L = s.ledger[d] || (s.ledger[d] = { i: 0, o: 0, sales: 0, orders: 0, sp: {} });
    const ks = Object.keys(s.ledger); if (ks.length > 14) ks.map(Number).sort(function (a, b) { return a - b; }).slice(0, ks.length - 14).forEach(function (k) { delete s.ledger[k]; });
    return L; }
  AA.ledgerAdd = function (n) { if (!S() || AA.noLedger || !n) return; const L = day(); if (n > 0) L.i += n; else L.o -= n; };
  AA.ledgerSale = function (sp, coins, order) { const L = day(); L.sales += coins; if (order) L.orders += coins; const x = L.sp[sp] || (L.sp[sp] = [0, 0]); x[0]++; x[1] += coins; };
  AA.ledgerSum = function (days) {
    const s = S(), d = AA.day(), out = { i: 0, o: 0, sales: 0, orders: 0, sp: {} };
    for (let k = d - days + 1; k <= d; k++) { const L = s.ledger && s.ledger[k]; if (!L) continue;
      out.i += L.i; out.o += L.o; out.sales += L.sales; out.orders += L.orders;
      for (const sp in L.sp) { const x = out.sp[sp] || (out.sp[sp] = [0, 0]); x[0] += L.sp[sp][0]; x[1] += L.sp[sp][1]; } }
    out.profit = out.i - out.o; return out;
  };
  AA.stockValue = function () { let v = 0; S().tanks.forEach(function (t) { t.fish.forEach(function (f) { v += AA.fishValue(f); }); }); return v; };
  /* wird von AA.sellFish gerufen: Markt sättigen, Kassenbuch */
  AA.bizSold = function (f, v, order) { saturate(f.sp); AA.ledgerSale(f.sp, v, order); if (AA.fishClass(f).id === 'S') S().stats.sSold = (S().stats.sSold || 0) + 1; };

  /* ---------- Ruf ---------- */
  AA.repLevel = function (rep) {
    rep = rep === undefined ? S().rep : rep; let i = 0;
    AA.REP_LEVELS.forEach(function (x, k) { if (rep >= x.at) i = k; });
    const cur = AA.REP_LEVELS[i], next = AA.REP_LEVELS[i + 1];
    return { i: i, name: cur.name, ico: cur.ico, at: cur.at, next: next || null, frac: next ? (rep - cur.at) / (next.at - cur.at) : 1 };
  };
  AA.addRep = function (n) { return addRep(n); };
  function addRep(n) {
    if (n > 0 && AA.prestigeMult) n = Math.round(n * AA.prestigeMult());      // Prestige-Deko: mehr Ruf je Auftrag (js/wild.js)
    const s = S(), before = AA.repLevel().i;
    s.rep = Math.max(0, s.rep + n);
    const after = AA.repLevel();
    if (after.i > before) AA.emit('repUp', after);
  }

  /* ---------- Kundenaufträge ---------- */
  function speciesPool() {
    const s = S(), lvl = s.level;
    const known = AA.FISH.filter(function (f) { return !f.hybrid && s.book && s.book[f.id] && f.lvl <= lvl; });
    return known.length ? known : AA.FISH.filter(function (f) { return !f.hybrid && f.lvl <= Math.max(1, lvl); });
  }
  function makeOrder() {
    const s = S(), rl = AA.repLevel().i, R = AA.ORDERS;
    const cands = AA.CUSTOMERS.filter(function (c) { return c.need <= rl; });
    const w = cands.map(function (c) { return c.id === 'shop' ? 5 : (c.id === 'hotel' ? 3 : 2); });
    const C = cands[wpick(w)], pool = speciesPool(), used = {};
    s.orders.forEach(function (o) { used[o.sp] = 1; });
    let sps = pool.filter(function (f) { return !used[f.id]; }); if (!sps.length) sps = pool;
    const def = sps[Math.floor(Math.random() * sps.length)];
    const o = { id: AA.uid(), c: C.id, name: C.names[Math.floor(Math.random() * C.names.length)], sp: def.id, n: Math.round(AA.rand(C.n[0], C.n[1])), got: 0,
      cls: C.cls[Math.floor(Math.random() * C.cls.length)], due: s.clock + C.days * DAY };
    if (C.id === 'collector' && Math.random() < 0.5) { o.v = AA.pickVariant(1, null, def.id); o.cls = 'C'; }        // Sammler: entweder eine Farbvariante (jede Klasse) – oder Klasse A/S
    o.pay = Math.max(5, Math.round(def.sell * AA.CLASSES[AA.classRank(o.cls)].mult * AA.varMult(o.v) * C.pay * (1 + R.repBonus * rl)));
    return o;
  }
  AA.ordersTick = function () {                         // läuft in jedem Bild und nach dem Nachholen: Fristen prüfen, freie Plätze füllen
    const s = S(); if (!s || !s.orders) return;
    for (let i = s.orders.length - 1; i >= 0; i--) {
      const o = s.orders[i];
      if (s.clock < o.due) continue;
      s.orders.splice(i, 1);
      addRep(-(o.got ? Math.ceil(AA.ORDERS.failRep / 2) : AA.ORDERS.failRep)); s.stats.ordersFailed = (s.stats.ordersFailed || 0) + 1;
      if (!s.orderNext || s.orderNext < s.clock) s.orderNext = s.clock + AA.ORDERS.refill;
      AA.emit('orderFailed', o);
    }
    while (s.orders.length < AA.ORDERS.max && s.clock >= (s.orderNext || 0)) {
      s.orders.push(makeOrder());
      s.orderNext = s.orders.length < AA.ORDERS.max ? s.clock + AA.ORDERS.refill : 0;
      AA.emit('orderNew');
    }
  };
  AA.orderFits = function (o, f) {
    return f.sp === o.sp && f.adult && !f.sick && AA.classRank(AA.fishClass(f).id) >= AA.classRank(o.cls) && (!o.v || f.v === o.v);
  };
  /* passende Fische für einen Auftrag (alle Becken): billigste zuerst – deine Besten behältst du */
  AA.orderCandidates = function (o) {
    const out = [];
    S().tanks.forEach(function (t, ti) { t.fish.forEach(function (f) {
      if (!AA.orderFits(o, f) || AA.matingOf(t, f.id)) return;
      out.push({ f: f, t: ti, rank: (f.v && !o.v ? 100 : 0) + AA.geneSum(f) });
    }); });
    return out.sort(function (a, b) { return a.rank - b.rank; });
  };
  AA.ordersReady = function () { return (S().orders || []).filter(function (o) { return AA.orderCandidates(o).length > 0; }).length; };
  AA.bestOrderFor = function (f) {                      // für die Fisch-Karte: der Auftrag, der für diesen Fisch am meisten zahlt
    let best = null; (S().orders || []).forEach(function (o) { if (AA.orderFits(o, f) && (!best || o.pay > best.pay)) best = o; }); return best;
  };
  /* einen Fisch an einen Kunden liefern: zahlt den Auftragspreis (nicht den Marktpreis), zählt als Verkauf */
  AA.deliver = function (oid, f) {
    const s = S(), o = s.orders.find(function (x) { return x.id === oid; });
    if (!o) return 'unknown';
    if (!f) { const c = AA.orderCandidates(o)[0]; if (!c) return 'nofish'; f = c.f; }
    if (!AA.orderFits(o, f)) return 'nofit';
    const t = s.tanks.find(function (x) { return x.fish.indexOf(f) >= 0; }); if (!t) return 'unknown';
    AA.unmate(t, f);
    t.fish.splice(t.fish.indexOf(f), 1);
    AA.addCoins(o.pay);
    s.stats.sold++; s.stats.soldCoins += o.pay; s.stats.soldAdult++; s.stats.delivered = (s.stats.delivered || 0) + 1;
    AA.bizSold(f, o.pay, true);
    o.got++;
    const res = { order: o, pay: o.pay, fish: f, tank: t, done: o.got >= o.n, rep: 0 };
    if (res.done) {
      s.orders.splice(s.orders.indexOf(o), 1);
      const C = AA.CUSTOMERS.find(function (c) { return c.id === o.c; });
      res.rep = C.rep; addRep(C.rep); s.stats.ordersDone = (s.stats.ordersDone || 0) + 1;
      if (!s.orderNext || s.orderNext < s.clock) s.orderNext = s.clock + AA.ORDERS.refill;
    }
    AA.emit('fishRemoved', f, t === AA.tank() ? 'deliver' : 'move', o.pay);
    AA.emit('delivered', res);
    AA.checkMedals(); AA.emit('hud');
    return res;
  };
  AA.declineOrder = function (oid) {
    const s = S(), i = s.orders.findIndex(function (x) { return x.id === oid; });
    if (i < 0) return false;
    s.orders.splice(i, 1); addRep(-AA.ORDERS.declineRep);
    if (!s.orderNext || s.orderNext < s.clock) s.orderNext = s.clock + AA.ORDERS.refill;
    AA.emit('hud'); return true;
  };

  /* ---------- Spielstand ergänzen (neu oder von vor Runde 5) ---------- */
  AA.bizFix = function (o) {
    o.tanks.forEach(function (t) { t.fish.forEach(AA.fixGenes); t.eggs.forEach(function (e) { if (e.g) AA.fixGenes(e); }); });
    ['delivered', 'ordersDone', 'ordersFailed', 'sBred', 'sSold'].forEach(function (k) { o.stats[k] = Math.max(0, Math.round(+o.stats[k] || 0)); });
    o.rep = Math.max(0, Math.round(+o.rep || 0));
    if (!Array.isArray(o.orders)) o.orders = [];
    o.orders = o.orders.filter(function (x) { return x && AA.FISH_BY[x.sp] && AA.CUSTOMERS.some(function (c) { return c.id === x.c; }) && x.n > 0 && x.pay > 0 && (!x.v || AA.VAR_BY[x.v]); });
    o.orderNext = +o.orderNext || 0;
    if (!o.market || typeof o.market !== 'object' || !o.market.k) o.market = null;
    if (!o.ledger || typeof o.ledger !== 'object') o.ledger = {};
    return o;
  };
  AA.bizStart = function () {                          // nach dem Laden / bei neuem Spiel: Tageskurs; ein Betrieb ohne Aufträge bekommt gleich alle drei
    const s = S(); AA.marketRoll();
    if (!s.orders.length) { while (s.orders.length < AA.ORDERS.max) s.orders.push(makeOrder()); s.orderNext = 0; }
    AA.ordersTick();
  };

  AA.cheat.rep = function (n) { addRep(n || 50); AA.emit('hud'); return S().rep; };
  AA.cheat.genes = function (c, s2, v) { const f = AA.view && AA.view.sel && AA.view.sel.d; if (f) f.g = { c: c || 5, s: s2 || 5, v: v || 5 }; return f && f.g; };
  AA.cheat.orders = function () { S().orders = []; S().orderNext = 0; AA.ordersTick(); return S().orders; };
})(window.AA);
