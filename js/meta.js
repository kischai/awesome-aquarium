'use strict';
/* Awesome Aquarium – Sammeln und Aufträge (Runde 4):
     • Farbvarianten: beim Züchten wird gewürfelt, ob aus dem Ei eine Mutation schlüpft (AA.rollVariant)
     • Sammelbuch: jede Art und jede Variante, die du je hattest; die erste Entdeckung bringt eine Belohnung zum Abholen
     • Tagesaufträge: drei pro Spieltag; alle drei erledigt = Perle + Stempel auf der Wochenkarte
     • Wochenkarte: gilt 7 Spieltage ab dem Tag, an dem sie beginnt; 3 / 5 / 7 Stempel bringen Perlen und Glitzer-Eier (darin steckt sicher eine Variante)
   Alle Zahlen dazu stehen in js/data.js (AA.VARIANTS, AA.VAR, AA.QUESTS, AA.WEEK). Regeln und Herkunft: docs/MECHANIK.md. */
(function (AA) {
  const DAY = 86400;
  function S() { return AA.state; }

  /* ---------- Spielstand ergänzen: neuer Stand (fresh) oder einer von vor Runde 4 ---------- */
  AA.metaFix = function (o, fresh) {
    const st = o.stats;
    ['soldAdult', 'photos', 'quests', 'questDays', 'variants', 'glitterUsed'].forEach(function (k) { st[k] = Math.max(0, Math.round(+st[k] || 0)); });
    if (!o.book || typeof o.book !== 'object') {
      o.book = {};
      if (!fresh) {                                    // alles, was du schon einmal hattest, steht als „entdeckt“ im Buch – die Belohnungen warten dort
        const see = function (sp) { if (AA.FISH_BY[sp] && !o.book[sp]) o.book[sp] = { n: 1, v: {} }; };
        Object.keys(st.spBought || {}).forEach(see); Object.keys(st.spRaised || {}).forEach(see); Object.keys(st.spMated || {}).forEach(see);
        o.tanks.forEach(function (t) { t.fish.forEach(function (f) { see(f.sp); }); t.eggs.forEach(function (e) { see(e.sp); }); });
      }
    }
    for (const sp in o.book) {
      const b = o.book[sp];
      if (!AA.FISH_BY[sp] || !b || typeof b !== 'object') { delete o.book[sp]; continue; }
      b.n = b.n === 2 ? 2 : 1; b.v = b.v && typeof b.v === 'object' ? b.v : {};
      for (const k in b.v) { if (!AA.VAR_BY[k] || !AA.varFits(sp, k)) delete b.v[k]; else b.v[k] = b.v[k] === 2 ? 2 : 1; }
    }
    o.tanks.forEach(function (t) {                    // Varianten an Fischen und Eiern: nur bekannte, und sie stehen auch im Buch
      const chk = function (x) {
        if (x.v === undefined) return;
        if (!AA.VAR_BY[x.v] || !AA.varFits(x.sp, x.v)) { delete x.v; return; }
        const b = o.book[x.sp] || (o.book[x.sp] = { n: 1, v: {} });
        if (x.id && x.age !== undefined && !b.v[x.v]) b.v[x.v] = 1;         // nur geschlüpfte Fische zählen als entdeckt, Eier noch nicht
      };
      t.fish.forEach(chk); t.eggs.forEach(chk);
    });
    let nv = 0; for (const sp in o.book) nv += Object.keys(o.book[sp].v).length;
    st.variants = nv;
    o.varDry = Math.max(0, o.varDry | 0);
    o.glitter = Math.max(0, o.glitter | 0); o.glitterBig = Math.max(0, o.glitterBig | 0);
    if (!o.week || typeof o.week !== 'object' || !Array.isArray(o.week.days) || typeof o.week.start !== 'number') o.week = { start: -1, days: [], got: [] };
    if (!Array.isArray(o.week.got)) o.week.got = [];
    if (o.quests && (!Array.isArray(o.quests.list) || o.quests.list.some(function (q) { return !q || !AA.QUEST_BY[q.q]; }))) o.quests = null;
    return o;
  };

  /* ---------- Farbvarianten ---------- */
  /* gewichtet auswürfeln; minTier = Mindest-Seltenheit, skip = Varianten, die möglichst nicht kommen sollen (schon im Buch) */
  AA.pickVariant = function (minTier, skip, sp) {
    let pool = AA.variantsOf(sp).filter(function (v) { return v.tier >= (minTier || 1); });
    if (!pool.length) pool = AA.variantsOf(sp).slice();
    const rest = pool.filter(function (v) { return !skip || !skip[v.id]; });
    if (rest.length) pool = rest;
    let sum = 0; pool.forEach(function (v) { sum += v.w; });
    let r = Math.random() * sum;
    for (let i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) return pool[i].id; }
    return pool[pool.length - 1].id;
  };
  /* Chance auf eine spontane Mutation beim nächsten Ei (steigt mit jedem Ei ohne – Pech-Schutz) */
  AA.variantChance = function () { const C = AA.VAR; return Math.min(Math.max(C.pityMax, C.chance), C.chance + C.pity * (S().varDry || 0)); };
  /* Wird für jedes neue Ei gerufen (a, b = Eltern). Gibt die Kennung der Variante zurück oder nichts. */
  AA.rollVariant = function (a, b, t) {              // t = Becken, in dem das Ei liegt (Biotop-Glück)
    const s = S(), C = AA.VAR, pv = [];
    if (a && a.v && AA.VAR_BY[a.v]) pv.push(a.v);
    if (b && b.v && AA.VAR_BY[b.v]) pv.push(b.v);
    if (pv.length === 2 && pv[0] === pv[1]) { if (Math.random() < C.inherit2) return pv[0]; }     // beide Eltern gleich: meistens vererbt
    else {
      if (pv.length === 2 && Math.random() < 0.5) pv.reverse();
      for (let i = 0; i < pv.length; i++) if (Math.random() < C.inherit1) return pv[i];
    }
    if (a && a.sp === 'carp') {                       // Karpfen: jedes Ei würfelt seine Zuchtform (AA.CARP.roll)
      const R = AA.CARP.roll; let sum = 0; for (const k in R) sum += R[k];
      let r = Math.random() * sum; for (const k in R) { r -= R[k]; if (r <= 0) return k || undefined; }
      return undefined;
    }
    if (Math.random() < AA.variantChance(t)) { s.varDry = 0; return AA.pickVariant(1, null, a && a.sp); }           // spontane Mutation
    s.varDry = (s.varDry || 0) + 1;
    return undefined;
  };
  AA.fishTitle = function (f) { return AA.speciesName(f.sp, f.v); };

  /* ---------- Sammelbuch: s.book[art] = { n: 1|2, v: { variante: 1|2 } } – 1 = entdeckt (Belohnung wartet), 2 = abgeholt ---------- */
  AA.bookSee = function (sp, v) {
    const s = S();
    if (!AA.FISH_BY[sp]) return false;
    const b = s.book[sp] || (s.book[sp] = { n: 0, v: {} });
    let fresh = false;
    if (!b.n) { b.n = 1; fresh = true; }
    if (v && AA.VAR_BY[v] && !b.v[v]) { b.v[v] = 1; s.stats.variants++; fresh = true; }
    if (fresh) { AA.emit('bookNew', sp, v); AA.checkMedals(); }
    return fresh;
  };
  AA.bookReward = function (sp, v) {
    const d = AA.FISH_BY[sp];
    if (v) { const V = AA.VAR_BY[v]; return { xp: V.xp, pearls: V.pearls, coins: 0 }; }
    return { xp: 20 + 6 * d.lvl, pearls: 0, coins: Math.max(5, Math.round(d.price / 2)) };
  };
  AA.bookHas = function (sp, v) { const b = S().book[sp]; return b ? (v ? b.v[v] || 0 : b.n) : 0; };
  AA.bookCounts = function () {
    const bk = S().book, out = { species: 0, speciesMax: AA.FISH.length, vars: 0, varsMax: AA.FISH.length * AA.VARIANTS.length, open: 0, full: 0 };
    for (const sp in bk) {
      const b = bk[sp]; out.species++; if (b.n === 1) out.open++;
      let n = 0; for (const k in b.v) { n++; if (b.v[k] === 1) out.open++; }
      out.vars += n; if (n === AA.VARIANTS.length) out.full++;
    }
    return out;
  };
  function give(r) { if (r.coins) AA.addCoins(r.coins, false); if (r.pearls) AA.addPearls(r.pearls); if (r.xp) AA.addXP(r.xp); }   // false: Belohnungen zählen nicht als „verdient“ (Auftrag „Verdiene Münzen“)
  AA.bookClaim = function (sp, v) {
    const b = S().book[sp];
    if (!b) return null;
    if (v) { if (b.v[v] !== 1) return null; b.v[v] = 2; } else { if (b.n !== 1) return null; b.n = 2; }
    const r = AA.bookReward(sp, v);
    give(r);
    return r;
  };
  AA.bookClaimAll = function () {
    const bk = S().book, tot = { xp: 0, pearls: 0, coins: 0, n: 0 };
    for (const sp in bk) {
      const b = bk[sp], todo = [];
      if (b.n === 1) todo.push(undefined);
      for (const k in b.v) if (b.v[k] === 1) todo.push(k);
      todo.forEach(function (v) { const r = AA.bookReward(sp, v); if (v) b.v[v] = 2; else b.n = 2; tot.xp += r.xp; tot.pearls += r.pearls; tot.coins += r.coins; tot.n++; });
    }
    if (tot.n) give(tot);
    return tot;
  };

  /* ---------- Tagesaufträge ---------- */
  function lvlTier() { const l = S().level; return l < 8 ? 0 : (l < 20 ? 1 : 2); }
  function round5(v) { return Math.max(5, Math.round(v / 5) * 5); }
  function makeQuest(def) {
    const s = S(), t = lvlTier(), need = typeof def.n === 'function' ? def.n(s) : (Array.isArray(def.n) ? def.n[t] : def.n);
    return { q: def.id, need: need, base: s.stats[def.stat] || 0, coins: round5((14 + 5 * s.level) * def.w), xp: round5((24 + 8 * s.level) * def.w), got: false };
  }
  /* sorgt dafür, dass es für den heutigen Spieltag Aufträge gibt; läuft beim Tageswechsel und beim Laden */
  AA.questRoll = function (force) {
    const s = S(), d = AA.day();
    if (s.week.start < 0 || d >= s.week.start + 7 || d < s.week.start) {   // neue Wochenkarte: sie beginnt an dem Tag, an dem du (wieder) spielst, und gilt 7 Spieltage
      const late = [];                                 // Erreichtes von der alten Karte wird noch gutgeschrieben
      if (s.week.start >= 0) AA.WEEK.forEach(function (w) { if (s.week.days.length >= w.at && s.week.got.indexOf(w.at) < 0) { grantWeek(w); late.push(w.name); } });
      const had = s.week.start >= 0;
      s.week = { start: d, days: [], got: [] };
      if (had) AA.emit('weekNew', late);
    }
    if (!force && s.quests && s.quests.day === d) return false;
    let list;
    if (!s.stats.bought) list = ['buy1', 'feed1', 'gift'].map(function (id) { return makeQuest(AA.QUEST_BY[id]); });   // allererster Tag: sanfter Einstieg
    else {
      const pool = AA.QUESTS.filter(function (q) { return !q.starter && (!q.ok || q.ok(s)); }), used = {};
      list = [];
      for (let k = 0; k < 3 && pool.length; k++) {
        let cand = pool.filter(function (q) { return !used[q.grp]; });
        if (!cand.length) cand = pool.filter(function (q) { return !list.some(function (x) { return x.q === q.id; }); });
        if (!cand.length) break;
        let sum = 0; cand.forEach(function (q) { sum += q.p || 1; });
        let r = Math.random() * sum, pick = cand[cand.length - 1];
        for (let i = 0; i < cand.length; i++) { r -= cand[i].p || 1; if (r <= 0) { pick = cand[i]; break; } }
        used[pick.grp] = 1; list.push(makeQuest(pick)); pool.splice(pool.indexOf(pick), 1);
      }
    }
    s.quests = { day: d, list: list, bonus: false };
    AA.emit('questsNew');
    return true;
  };
  AA.questList = function () {
    const s = S();
    if (!s.quests) return [];
    return s.quests.list.map(function (q, i) {
      const def = AA.QUEST_BY[q.q], cur = AA.clamp((s.stats[def.stat] || 0) - q.base, 0, q.need);
      return { i: i, def: def, cur: cur, need: q.need, done: cur >= q.need, got: !!q.got, coins: q.coins, xp: q.xp, text: def.txt(q.need), raw: q };
    });
  };
  AA.questClaim = function (i) {
    const s = S(), L = AA.questList(), q = L[i];
    if (!q || !q.done || q.got) return null;
    q.raw.got = true; s.stats.quests++;
    AA.addCoins(q.coins, false); AA.addXP(q.xp);
    const res = { coins: q.coins, xp: q.xp, bonus: false };
    if (!s.quests.bonus && s.quests.list.every(function (x) { return x.got; })) {      // alle drei: Perle + Stempel
      s.quests.bonus = true; s.stats.questDays++;
      AA.addPearls(AA.QUEST_BONUS.pearls);
      if (s.week.days.indexOf(s.quests.day) < 0) s.week.days.push(s.quests.day);
      res.bonus = true; res.pearls = AA.QUEST_BONUS.pearls; res.stamps = s.week.days.length;
    }
    AA.checkMedals(); AA.emit('hud');
    return res;
  };
  /* ---------- Wochenkarte ---------- */
  function grantWeek(w) {
    const s = S();
    if (w.pearls) AA.addPearls(w.pearls);
    if (w.glitter) s.glitter += w.glitter;
    if (w.glitterBig) s.glitterBig += w.glitterBig;
    s.week.got.push(w.at);
  }
  AA.weekInfo = function () {
    const s = S(), d = AA.day(), n = s.week.days.length, idx = AA.clamp(d - s.week.start, 0, 6);
    return { start: s.week.start, dayIdx: idx, stamps: n, days: s.week.days.map(function (x) { return x - s.week.start; }), today: s.week.days.indexOf(d) >= 0,
      left: (6 - idx) * DAY + AA.dayLeft(),
      rewards: AA.WEEK.map(function (w) { return { at: w.at, def: w, got: s.week.got.indexOf(w.at) >= 0, ready: n >= w.at && s.week.got.indexOf(w.at) < 0 }; }) };
  };
  AA.weekClaim = function (at) {
    const s = S(), w = AA.WEEK.find(function (x) { return x.at === at; });
    if (!w || s.week.days.length < at || s.week.got.indexOf(at) >= 0) return null;
    grantWeek(w); AA.emit('hud');
    return w;
  };
  /* wie viel wartet aufs Abholen? (für die Marke am Knopf) */
  AA.questOpen = function () {
    let n = 0;
    AA.questList().forEach(function (q) { if (q.done && !q.got) n++; });
    AA.weekInfo().rewards.forEach(function (r) { if (r.ready) n++; });
    return n + S().glitter + S().glitterBig;
  };

  /* ---------- Glitzer-Ei: garantiert eine Variante – bevorzugt eine, die bei dieser Art im Buch noch fehlt ---------- */
  AA.glitterSpecies = function (t) {                   // Arten, die du schon entdeckt hast und die ins Wasser dieses Beckens passen
    t = t || AA.tank();
    return AA.FISH.filter(function (f) { return !f.hybrid && AA.bookHas(f.id) && AA.livesIn(f, t); });
  };
  AA.useGlitter = function (sp, big) {
    const s = S(), t = AA.tank(), def = AA.FISH_BY[sp];
    if (!def || !AA.bookHas(sp)) return 'unknown';
    if ((big ? s.glitterBig : s.glitter) <= 0) return 'none';
    if (!AA.livesIn(def, t)) return 'water';
    if (AA.count(t) >= AA.cap(t)) return 'full';
    const have = (s.book[sp] || { v: {} }).v, v = AA.pickVariant(big ? 2 : 1, have, sp);
    const egg = { id: AA.uid(), sp: sp, x: 640 + AA.rand(-140, 140), z: AA.rand(0.3, 0.8), hatch: def.hatch, total: def.hatch, v: v, gl: 1, g: AA.shopGenes(1) };
    t.eggs.push(egg);
    if (big) s.glitterBig--; else s.glitter--;
    s.stats.glitterUsed++;
    AA.emit('eggLaid', egg, null, null, t);
    return egg;
  };
  AA.photoTaken = function () { S().stats.photos++; };

  /* Cheats zum Ausprobieren (Konsole) */
  AA.cheat.variant = function (v) { const f = AA.view && AA.view.sel && AA.view.sel.d; if (f) { if (v && AA.VAR_BY[v]) { f.v = v; AA.bookSee(f.sp, v); } else delete f.v; } return f && f.v; };
  AA.cheat.glitter = function (n, big) { if (big) S().glitterBig += n || 1; else S().glitter += n || 1; AA.emit('hud'); return [S().glitter, S().glitterBig]; };
  AA.cheat.quests = function () { S().quests.list.forEach(function (q) { q.base = -1e9; }); AA.emit('hud'); };
  AA.cheat.lucky = function (p) { AA.VAR.chance = p === undefined ? 1 : p; return AA.VAR.chance; };
})(window.AA);
