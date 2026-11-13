'use strict';
/* Awesome Aquarium – Zuchtbetrieb, Teil 2 (Runde 6):
     • Zuchtplaner: beide Eltern selbst wählen, vorher die genaue Prognose sehen (AA.breedForecast)
     • Zuchtstation: Becken mit Aufgabe – Brutbecken (Eier ×2) und Aufzuchtbecken (Jungfische +50 %); gerechnet wird in AA.advance (js/state.js)
     • Personal mit Tageslohn: Pfleger, Verkäufer, Zuchtmeister
     • Lieferverträge: jede Woche eine feste Menge zum festen Preis, sonst Strafe
     • Meeresbecken, Kaviar (Stör, Beluga), Lachs (Meerlachs, laicht nur im Süßwasser, 3 Eier)
   Alle Zahlen in js/data.js (AA.ROLES, AA.STAFF, AA.CONTRACTS, AA.OCEAN, AA.CAVIAR, AA.SALMON), Regeln: docs/MECHANIK.md. */
(function (AA) {
  const DAY = 86400, KEYS = ['c', 's', 'v'];
  function S() { return AA.state; }
  function int(x) { return Math.max(0, Math.round(+x || 0)); }

  /* ---------- Spielstand ergänzen (neu oder von vor Runde 6) ---------- */
  AA.farmFix = function (o) {
    const st = o.staff && typeof o.staff === 'object' ? o.staff : {}; o.staff = {};
    for (const k in AA.STAFF) o.staff[k] = !!st[k];
    o.staffDay = typeof o.staffDay === 'number' ? o.staffDay : Math.floor((o.clock || 0) / DAY);
    const c = o.contracts && typeof o.contracts === 'object' ? o.contracts : {};
    const okC = function (x) { return x && AA.FISH_BY[x.sp] && x.n > 0 && x.pay > 0 && x.weeks > 0; };
    o.contracts = { day: typeof c.day === 'number' ? c.day : -1, offers: (Array.isArray(c.offers) ? c.offers : []).filter(okC), act: (Array.isArray(c.act) ? c.act : []).filter(okC) };
    let ocean = false, deep = false;
    o.tanks.forEach(function (t) {
      if (t.role && !AA.ROLES[t.role]) delete t.role;
      if (t.ocean && t.water === 'salt' && !ocean) { ocean = true; t.ocean = true; t.size = AA.SIZES.length - 1; delete t.role; delete t.deep; } else delete t.ocean;
      if (t.deep && t.water === 'salt' && !deep && !t.ocean) { deep = true; t.deep = true; t.size = AA.SIZES.length - 1; delete t.role; } else delete t.deep;      // Tiefsee-Becken (Runde 9): höchstens eins
      t.fish.forEach(function (f) {
        if (f.sp !== 'salmon') { delete f.sea; delete f.msea; }
        if (!AA.FISH_BY[f.sp].caviar) delete f.cav;
      });
    });
    ['caviar', 'caviarCoins', 'contractsDone', 'contractsMissed', 'contractFish', 'wages', 'planned'].forEach(function (k) { o.stats[k] = int(o.stats[k]); });
    return o;
  };

  /* ---------- Wert und Größe: Meerlachs ---------- */
  AA.farmMult = function (f) { return f.msea ? AA.SALMON.mult : 1; };
  const size0 = AA.sizeMult;
  AA.sizeMult = function (f) { return size0(f) * (f.msea ? AA.SALMON.size : 1); };
  const title0 = AA.fishTitle;
  AA.fishTitle = function (f) { return f.msea ? 'Meerlachs' + (f.v && AA.VAR_BY[f.v] ? ' (' + AA.VAR_BY[f.v].name + ')' : '') : title0(f); };

  /* ---------- Lachs: laicht nur im Süßwasser, dafür gleich mehrere Eier und mit längerer Pause ---------- */
  const mate0 = AA.mateStatus;
  AA.mateStatus = function (sp, t) {
    const st = mate0(sp, t); t = t || AA.tank();
    if (sp === 'salmon' && t.water !== 'fresh' && (st.ok || st.why === 'coins' || st.why === 'full' || st.why === 'dirty' || st.why === 'hungry')) { st.ok = false; st.why = 'spawn'; }
    return st;
  };
  AA.on('eggLaid', function (egg, a, b, t) {
    const s = S();
    if (!s || !a || !b || egg.sp !== 'salmon' || egg.extra || !t) return;
    for (let i = 1; i < AA.SALMON.eggs && AA.count(t) < AA.cap(t); i++) {
      const e = { id: AA.uid(), sp: 'salmon', x: AA.clamp(egg.x + AA.rand(-90, 90), 120, AA.W - 120), z: AA.rand(0.3, 0.8), hatch: egg.hatch, total: egg.total, g: AA.inheritGenes(a, b), bred: 1, extra: 1 };
      const v = AA.rollVariant(a, b, t); if (v) e.v = v;
      t.eggs.push(e); s.stats.eggs++;
    }
  });

  /* ---------- Kaviar ---------- */
  AA.caviarStatus = function (f) {
    const def = AA.FISH_BY[f.sp], C = def && def.caviar && AA.CAVIAR[def.caviar];
    if (!C) return null;
    const out = { C: C, coins: Math.round(C.base * AA.fishClass(f).mult * Math.sqrt(AA.varMult(f.v))), wait: Math.max(0, (f.cav || 0) - S().clock) };
    out.why = f.sex !== 'f' ? 'male' : (!f.adult ? 'young' : (f.sick ? 'sick' : (out.wait > 0 ? 'wait' : (f.hunger < 0.5 ? 'hungry' : ''))));
    out.ok = !out.why;
    return out;
  };
  AA.harvestCaviar = function (f) {
    const s = S(), st = AA.caviarStatus(f);
    if (!st || !st.ok) return st;
    f.cav = s.clock + st.C.cd * DAY;
    AA.addCoins(st.coins);
    s.stats.caviar++; s.stats.caviarCoins += st.coins;
    AA.emit('caviar', f, st.coins);
    return st;
  };
  AA.caviarReady = function () { let n = 0; S().tanks.forEach(function (t) { t.fish.forEach(function (f) { const c = AA.caviarStatus(f); if (c && c.ok) n++; }); }); return n; };

  /* ---------- Zuchtstation: Aufgabe eines Beckens ---------- */
  AA.roleStatus = function (role, t) {
    const s = S(), R = AA.ROLES[role]; t = t || AA.tank();
    if (!R) return 'unknown';
    if (t.role === role) return 'owned';
    if (AA.wide(t)) return 'ocean';
    if (s.level < R.lvl) return 'level';
    if (s.coins < R.price) return 'coins';
    return 'ok';
  };
  AA.setRole = function (role) {
    const t = AA.tank(), st = AA.roleStatus(role, t);
    if (st !== 'ok') return st;
    AA.addCoins(-AA.ROLES[role].price);
    t.role = role;
    AA.emit('hud'); AA.emit('roleSet', t, role);
    return true;
  };
  AA.clearRole = function () { const t = AA.tank(); if (!t.role) return false; delete t.role; AA.emit('hud'); return true; };

  /* ---------- Meeresbecken ---------- */
  AA.hasOcean = function () { return S().tanks.some(function (t) { return t.ocean; }); };
  AA.oceanStatus = function () { const s = S(); return AA.hasOcean() ? 'owned' : (s.level < AA.OCEAN.lvl ? 'level' : (s.coins < AA.OCEAN.price ? 'coins' : 'ok')); };
  AA.buyOcean = function () {
    const s = S(), st = AA.oceanStatus();
    if (st !== 'ok') return st;
    AA.addCoins(-AA.OCEAN.price);
    const t = AA.newTank(s.tanks.length, 'salt');
    t.ocean = true; t.size = AA.SIZES.length - 1; t.name = AA.OCEAN.name;
    s.tanks.push(t); s.active = s.tanks.length - 1;
    AA.emit('tankChanged');
    return true;
  };
  AA.renameTank = function (t, name) { name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 22); if (!name) return false; t.name = name; AA.emit('hud'); return true; };

  /* ---------- Zuchtplaner: Prognose für ein Paar ---------- */
  function geneDist(pa, pb) {                           // Verteilung eines Gen-Werts beim Kind (dieselbe Regel wie AA.inheritGenes)
    const R = AA.GENE_RULE, m = (pa + pb) / 2, d = [0, 0, 0, 0, 0, 0];
    [Math.floor(m), Math.ceil(m)].forEach(function (x0) {
      [[-1, R.down], [1, R.up], [0, 1 - R.down - R.up]].forEach(function (st) {
        [[1, R.jump], [0, 1 - R.jump]].forEach(function (j) { d[AA.clamp(x0 + st[0] + j[0], 1, 5)] += 0.5 * st[1] * j[1]; });
      });
    });
    return d;
  }
  AA.breedForecast = function (a, b) {
    const C = AA.VAR, sp = a.sp, out = { cls: {}, genes: {}, vars: [], cost: AA.FISH_BY[sp].mate, egg: AA.mateChanceFor ? AA.mateChanceFor(AA.tank(), sp) : AA.BAL.mateChance, eggs: sp === 'salmon' ? AA.SALMON.eggs : 1 };
    let sum = [1];                                      // Verteilung der Gen-Summe
    KEYS.forEach(function (k) {
      const d = geneDist(a.g ? a.g[k] : 2, b.g ? b.g[k] : 2), nx = [];
      let mean = 0; for (let v = 1; v <= 5; v++) mean += v * d[v];
      out.genes[k] = { mean: mean, max: d[5] > 0 ? 5 : (d[4] > 0 ? 4 : (d[3] > 0 ? 3 : (d[2] > 0 ? 2 : 1))) };
      for (let i = 0; i < sum.length; i++) for (let v = 1; v <= 5; v++) nx[i + v] = (nx[i + v] || 0) + sum[i] * d[v];
      sum = nx;
    });
    AA.CLASSES.forEach(function (c) { out.cls[c.id] = 0; });
    for (let n = 0; n < sum.length; n++) { if (!sum[n]) continue; let c = AA.CLASSES[0]; AA.CLASSES.forEach(function (x) { if (n >= x.min) c = x; }); out.cls[c.id] += sum[n]; }
    const p = {}, add = function (v, x) { if (x > 0) p[v] = (p[v] || 0) + x; };
    let rest = 1;
    const va = a.v && AA.VAR_BY[a.v] ? a.v : null, vb = b.v && AA.VAR_BY[b.v] ? b.v : null;
    if (va && vb && va === vb) { add(va, C.inherit2); rest = 1 - C.inherit2; }
    else if (va && vb) { const q = 0.5 * C.inherit1 + 0.5 * (1 - C.inherit1) * C.inherit1; add(va, q); add(vb, q); rest = (1 - C.inherit1) * (1 - C.inherit1); }
    else if (va || vb) { add(va || vb, C.inherit1); rest = 1 - C.inherit1; }
    if (sp === 'carp') { const R = AA.CARP.roll; let tot = 0; for (const k in R) tot += R[k]; for (const k in R) if (k) add(k, rest * R[k] / tot); }
    else { const ch = AA.variantChance(), vs = AA.variantsOf(sp); let w = 0; vs.forEach(function (v) { w += v.w; }); vs.forEach(function (v) { add(v.id, rest * ch * v.w / w); }); }
    let any = 0; for (const k in p) any += p[k];
    out.vars = Object.keys(p).map(function (k) { return { v: k, p: p[k] }; }).sort(function (x, y) { return y.p - x.p; });
    out.plain = Math.max(0, 1 - any);
    return out;
  };
  /* das beste Paar eines Beckens für eine Art: höchste Gen-Summe, bei Gleichstand gleiche Farbvariante */
  AA.bestPair = function (sp, t) {
    const st = AA.mateStatus(sp, t); let best = null;
    st.males.forEach(function (a) { st.females.forEach(function (b) {
      const sc = AA.geneSum(a) + AA.geneSum(b) + (a.v && a.v === b.v ? 1.5 : (a.v || b.v ? 0.5 : 0));
      if (!best || sc > best.sc) best = { a: a, b: b, sc: sc };
    }); });
    return best;
  };

  /* ---------- Personal ---------- */
  AA.wagesPerDay = function () { const s = S(); let n = 0; for (const k in AA.STAFF) if (s.staff[k]) n += AA.STAFF[k].wage; return n; };
  AA.hire = function (id) {
    const s = S(), P = AA.STAFF[id];
    if (!P) return 'unknown';
    if (s.staff[id]) return 'owned';
    if (AA.repLevel().i < P.rep) return 'rep';
    if (s.coins < P.wage) return 'coins';
    AA.addCoins(-P.wage); s.stats.wages += P.wage;       // der erste Tageslohn gleich
    s.staff[id] = true;
    AA.emit('hud'); AA.emit('staff', id, true);
    return true;
  };
  AA.fire = function (id) { const s = S(); if (!s.staff[id]) return false; s.staff[id] = false; AA.emit('hud'); AA.emit('staff', id, false); return true; };
  /* Tageswechsel: Löhne für jeden vergangenen Tag, neue Vertrags-Angebote */
  AA.farmDay = function () {
    const s = S(), d = AA.day(), days = AA.clamp(d - s.staffDay, 0, 60);
    s.staffDay = d;
    for (let i = 0; i < days; i++) for (const k in AA.STAFF) {
      if (!s.staff[k]) continue;
      const w = AA.STAFF[k].wage;
      if (s.coins >= w) { AA.addCoins(-w); s.stats.wages += w; }
      else { s.staff[k] = false; (AA.farmNews = AA.farmNews || []).push('😤 ' + AA.STAFF[k].name + ' hat gekündigt – der Lohn (' + w + ' Münzen pro Tag) war nicht drin.'); AA.emit('staffQuit', k); }
    }
    rollOffers();
  };

  /* ---------- Lieferverträge ---------- */
  function rollOffers() {
    const s = S(), K = AA.CONTRACTS, c = s.contracts, d = AA.day();
    if (c.day === d) return;
    c.day = d; c.offers = [];
    if (s.level < K.lvl) return;
    const rl = AA.repLevel().i, names = AA.CUSTOMERS[0].names.concat(AA.CUSTOMERS[1].names);
    let pool = AA.FISH.filter(function (f) { return !f.hybrid && s.book && s.book[f.id] && f.lvl <= s.level; });
    if (pool.length < K.offers + c.act.length) {      // kennst du erst wenige Arten, kommen Arten dazu, die du schon kaufen könntest (die teuersten zuerst)
      const more = AA.FISH.filter(function (f) { return !f.hybrid && f.lvl <= s.level && pool.indexOf(f) < 0; }).sort(function (x, y) { return y.lvl - x.lvl; });
      pool = pool.concat(more.slice(0, K.offers + c.act.length - pool.length));
    }
    const busy = {}; c.act.forEach(function (x) { busy[x.sp] = 1; });
    pool = pool.filter(function (f) { return !busy[f.id]; });
    for (let i = 0; i < K.offers && pool.length; i++) {
      const def = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      const n = Math.max(1, Math.round(AA.rand(K.n[0], K.n[1]) * Math.min(1, 24 / def.hours)));      // langsam wachsende Arten: kleinere Mengen
      c.offers.push({ id: AA.uid(), name: names[Math.floor(Math.random() * names.length)], sp: def.id, n: n, weeks: Math.round(AA.rand(K.weeks[0], K.weeks[1])),
        pay: Math.max(5, Math.round(def.sell * AA.rand(K.pay[0], K.pay[1]) * (1 + AA.ORDERS.repBonus * rl))) });
    }
    AA.emit('contractOffers');
  }
  AA.contractSign = function (id) {
    const s = S(), c = s.contracts, i = c.offers.findIndex(function (x) { return x.id === id; });
    if (i < 0) return 'unknown';
    if (c.act.length >= AA.CONTRACTS.max) return 'max';
    const o = c.offers.splice(i, 1)[0];
    o.week = 0; o.got = 0; o.miss = 0; o.due = s.clock + AA.CONTRACTS.week * DAY;
    c.act.push(o);
    AA.emit('hud'); AA.emit('contractSigned', o);
    return o;
  };
  AA.contractFits = function (c, f) { return f.sp === c.sp && f.adult && !f.sick; };
  AA.contractCandidates = function (c) {               // wie bei Kundenaufträgen: die mit den schwächsten Genen zuerst, Farbvarianten zuletzt
    const out = [];
    S().tanks.forEach(function (t, ti) { t.fish.forEach(function (f) {
      if (!AA.contractFits(c, f) || AA.matingOf(t, f.id)) return;
      out.push({ f: f, t: ti, rank: (f.v ? 100 : 0) + (f.msea ? 50 : 0) + AA.geneSum(f) + f.tricks.length * 3 });
    }); });
    return out.sort(function (a, b) { return a.rank - b.rank; });
  };
  AA.contractDeliver = function (id, f) {
    const s = S(), c = s.contracts.act.find(function (x) { return x.id === id; });
    if (!c) return 'unknown';
    if (c.got >= c.n) return 'done';
    if (!f) { const k = AA.contractCandidates(c)[0]; if (!k) return 'nofish'; f = k.f; }
    if (!AA.contractFits(c, f)) return 'nofit';
    const t = s.tanks.find(function (x) { return x.fish.indexOf(f) >= 0; }); if (!t) return 'unknown';
    AA.unmate(t, f);
    t.fish.splice(t.fish.indexOf(f), 1);
    AA.addCoins(c.pay);
    s.stats.sold++; s.stats.soldCoins += c.pay; s.stats.soldAdult++; s.stats.delivered = (s.stats.delivered || 0) + 1; s.stats.contractFish++;
    AA.bizSold(f, c.pay, true);
    c.got++;
    const res = { contract: c, pay: c.pay, fish: f, tank: t, weekDone: c.got >= c.n };
    AA.emit('fishRemoved', f, t === AA.tank() ? 'deliver' : 'move', c.pay);
    AA.emit('contractDelivered', res);
    AA.checkMedals(); AA.emit('hud');
    return res;
  };
  AA.contractsOpen = function () { let n = 0; S().contracts.act.forEach(function (c) { if (c.got < c.n && AA.contractCandidates(c).length) n++; }); return n; };

  /* ---------- läuft in jedem Bild und nach dem Nachholen ---------- */
  let nextWork = 0;
  AA.farmTick = function (sum) {
    const s = S(); if (!s || !s.contracts) return;
    const K = AA.CONTRACTS, c = s.contracts;
    for (let i = c.act.length - 1; i >= 0; i--) {       // Wochenabschluss der Verträge
      const x = c.act[i];
      let guard = 0;
      while (s.clock >= x.due && guard++ < 60) {
        const missing = x.n - x.got;
        if (missing > 0) {
          const fine = Math.min(s.coins, Math.round(missing * x.pay * K.penalty));
          if (fine) AA.addCoins(-fine);
          AA.addRep(-K.failRep); x.miss++; s.stats.contractsMissed++;
          const msg = '📜 Vertrag ' + x.name + ': ' + missing + ' von ' + x.n + ' ' + AA.FISH_BY[x.sp].name + ' fehlten – Strafe ' + AA.fmt(fine) + ' Münzen, −' + K.failRep + ' Ruf.';
          if (sum || AA.quiet) (AA.farmNews = AA.farmNews || []).push(msg); else AA.emit('contractMiss', x, missing, fine);
        } else AA.addRep(K.weekRep);
        x.week++; x.got = 0; x.due += K.week * DAY;
        if (x.week >= x.weeks) {
          c.act.splice(i, 1);
          if (!x.miss) { const bonus = Math.round(x.pay * x.n * x.weeks * 0.1); AA.addRep(K.doneRep); AA.addCoins(bonus); s.stats.contractsDone++;
            const msg = '🏆 Vertrag mit ' + x.name + ' erfüllt: +' + AA.fmt(bonus) + ' Münzen Bonus, +' + K.doneRep + ' Ruf.';
            if (sum || AA.quiet) (AA.farmNews = AA.farmNews || []).push(msg); else AA.emit('contractDone', x, bonus); }
          break;
        }
      }
    }
    if (c.day !== AA.day()) rollOffers();
    if (!sum && s.clock < nextWork && nextWork - s.clock < 600) return;      // Personal arbeitet alle paar Sekunden, nicht in jedem Bild
    nextWork = s.clock + 4 * AA.speed();
    if (s.staff.seller) {                               // Verkäufer: Zoohandlungs-Aufträge
      for (let i = 0; i < s.orders.length; i++) {
        const o = s.orders[i]; if (o.c !== 'shop') continue;
        const cand = AA.orderCandidates(o).filter(function (k) { const f = k.f; return !f.v && !f.msea && !f.tricks.length && AA.classRank(AA.fishClass(f).id) < 2; });
        if (cand.length) { const r = AA.deliver(o.id, cand[0].f); if (r && r.pay) { AA.emit('staffWork', 'seller', r); break; } }
      }
    }
    if (s.staff.master) {                               // Zuchtmeister: je Becken das beste Paar einer Art, die heute noch darf
      for (let i = 0; i < s.tanks.length; i++) {
        const t = s.tanks[i]; if (AA.count(t) + AA.matings(t).length >= AA.cap(t) - 1) continue;      // einen Platz lässt er dir frei
        const seen = {};
        for (let k = 0; k < t.fish.length; k++) {
          const sp = t.fish[k].sp; if (seen[sp]) continue; seen[sp] = 1;
          const st = AA.mateStatus(sp, t); if (!st.ok || s.coins < st.cost * 3) continue;   // nur, wenn die Kasse es locker hergibt
          const bp = AA.bestPair(sp, t); if (!bp) continue;
          const r = AA.startMate(sp, null, bp.a, bp.b, t);
          if (r.ok) { AA.emit('staffWork', 'master', { a: bp.a, b: bp.b, tank: t }); break; }
        }
      }
    }
  };
})(window.AA);
