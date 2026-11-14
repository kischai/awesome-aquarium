'use strict';
/* Awesome Aquarium – Runde 8: Leben im Becken (Regeln).
     • Hybride: zwei verwandte Arten kreuzen (AA.HYBRIDS, AA.CROSS) – Hybride sind unfruchtbar und nur so zu bekommen
     • Sammelbuch-Sets: alle Varianten einer Art = +10 % Wert; Titel für komplette Gruppen (AA.TITLES)
     • Schwärme: ab 6 Tieren schneller wachsen, unter 3 unglücklich (AA.SCHOOL)
     • Putzkolonne: Jobs der Krabbler, Bonus für gemischte Teams, faulendes Futter (AA.JOBS, AA.CREW)
     • Spezialfutter: Farb-, Turbo-, Medizin- und Lebendfutter (AA.FOOD2), „Alle füttern“, Becken-Vorlagen
     • Clownfisch + Anemone: höhere Balz-Chance, Eier neben der Anemone
   Verhalten und Bilder: js/fish.js, js/tankview.js; Oberfläche: js/lifeui.js; Regeln in Worten: docs/MECHANIK.md § 6e. */
(function (AA) {
  const DAY = 86400;
  function S() { return AA.state; }

  AA.lifeFix = function (o) {
    const f2 = o.food2 && typeof o.food2 === 'object' ? o.food2 : {};
    o.food2 = {}; for (const k in AA.FOOD2) o.food2[k] = Math.max(0, f2[k] | 0);
    o.titles = o.titles && typeof o.titles === 'object' ? o.titles : {};
    if (o.title && !o.titles[o.title]) delete o.title;
    o.templates = (Array.isArray(o.templates) ? o.templates : []).filter(function (x) { return x && x.name && Array.isArray(x.deco); }).slice(0, 12);
    ['cleaned', 'crosses', 'hybrids', 'specialFed', 'rotted', 'fedAll'].forEach(function (k) { o.stats[k] = Math.max(0, o.stats[k] | 0); });
    o.tanks.forEach(function (t) { t.fish.forEach(function (f) {
      if (+f.colorT > (o.clock || 0)) f.colorN = Math.max(f.colorN | 0, AA.FOOD2.color.eggs);      // Runde 15: Farbfutter wirkt jetzt für Eier, nicht für eine Zeit
      delete f.colorT; if (!(f.colorN > 0)) delete f.colorN; else f.colorN = Math.min(f.colorN | 0, AA.FOOD2.color.eggs);
      if (!(f.turboT > 0)) delete f.turboT;
    }); });
    return o;
  };

  /* ================= Hybride ================= */
  AA.HYB_BY = {}; AA.HYBRIDS.forEach(function (h) { AA.HYB_BY[h.id] = h; });
  AA.isHybrid = function (sp) { return !!(AA.FISH_BY[sp] && AA.FISH_BY[sp].hybrid); };
  AA.crossesFor = function (sp) { return AA.HYBRIDS.filter(function (h) { return h.a === sp || h.b === sp; }); };
  const mate0 = AA.mateStatus;
  AA.mateStatus = function (sp, t) {                 // Hybride sind unfruchtbar
    const st = mate0(sp, t);
    if (AA.isHybrid(sp)) { st.ok = false; st.why = 'sterile'; }
    return st;
  };
  /* Kann in diesem Becken gekreuzt werden? Ein Elternteil von Art a, der andere von Art b (egal welches Geschlecht wohin). */
  AA.crossStatus = function (hid, t) {
    const s = S(), h = AA.HYB_BY[hid], def = AA.FISH_BY[hid]; t = t || AA.tank();
    const A = AA.FISH_BY[h.a], Bp = AA.FISH_BY[h.b], cost = Math.round((A.mate + Bp.mate) * AA.CROSS.cost);
    const P = AA.pairPool(t, function (g) { return g.sp === h.a || g.sp === h.b; });      // Runde 11: Pause je Fisch, mehrere Paare gleichzeitig
    let anyA = false, anyB = false;
    t.fish.forEach(function (g) { if (g.adult && g.sp === h.a) anyA = true; if (g.adult && g.sp === h.b) anyB = true; });
    const pairOk = P.males.some(function (m) { return P.females.some(function (f) { return f.sp !== m.sp; }); });
    let cd = 0; if (!pairOk) { if (!P.males.length && P.wait.m < Infinity) cd = Math.max(cd, P.wait.m); if (!P.females.length && P.wait.f < Infinity) cd = Math.max(cd, P.wait.f); }
    const out = { h: h, def: def, ok: false, cost: cost, cd: cd, males: P.males, females: P.females };
    const ws = [P.why.m, P.why.f];
    if (s.level < def.lvl) out.why = 'level';
    else if (!anyA || !anyB) out.why = 'parents';
    else if (!pairOk) out.why = ws.indexOf('hungry') >= 0 ? 'hungry' : (cd > 0 ? 'cd' : (ws.indexOf('busy') >= 0 ? 'busy' : 'pair'));
    else if (t.dirt > AA.BAL.mateDirtMax) out.why = 'dirty';
    else if (!AA.mateRoom(t)) out.why = 'full';
    else if (s.coins < cost) out.why = 'coins';
    else out.ok = true;
    return out;
  };
  AA.crossOptions = function (t) {                   // alle Kreuzungen, für die beide Eltern-Arten im Becken leben
    t = t || AA.tank();
    return AA.HYBRIDS.filter(function (h) { return t.fish.some(function (f) { return f.sp === h.a; }) && t.fish.some(function (f) { return f.sp === h.b; }); })
      .map(function (h) { return AA.crossStatus(h.id, t); });
  };
  AA.startCross = function (hid, pa, pb, tk) {
    const t = tk || AA.tank(), st = AA.crossStatus(hid, t);
    if (!st.ok) return st;
    if (!pa || !pb || st.males.indexOf(pa) < 0 || st.females.indexOf(pb) < 0 || pa.sp === pb.sp) { st.ok = false; st.why = 'pair'; return st; }
    AA.addCoins(-st.cost);
    AA.matings(t).push({ a: pa.id, b: pb.id, sp: hid, t: AA.BAL.mateDance, cross: 1 });      // Runde 11: jede Kreuzung bringt ein Ei
    S().stats.crosses++;
    st.a = pa; st.b = pb;
    AA.emit('mateStart', pa, pb, t);
    return st;
  };
  /* Farbvariante eines Hybrid-Eis: vererbt nur, wenn beide Eltern dieselbe (beim Hybrid mögliche) Variante tragen – sonst spontane Mutation */
  AA.crossVariant = function (a, b, t, hid) {
    const C = AA.VAR;
    if (a.v && a.v === b.v && AA.varFits(hid, a.v) && Math.random() < C.inherit2) return a.v;
    if (Math.random() < AA.variantChance(t)) return AA.pickVariant(1, null, hid);
    return undefined;
  };
  AA.crossForecast = function (a, b, hid) {
    const F = AA.breedForecast(a, b);
    F.egg = 1; F.eggs = 1; F.cost = AA.crossStatus(hid).cost;
    const p = {}; let rest = 1;
    if (a.v && a.v === b.v && AA.varFits(hid, a.v)) { p[a.v] = AA.VAR.inherit2; rest = 1 - AA.VAR.inherit2; }
    const ch = AA.variantChance(AA.tank()), vs = AA.variantsOf(hid); let w = 0; vs.forEach(function (v) { w += v.w; });
    vs.forEach(function (v) { p[v.id] = (p[v.id] || 0) + rest * ch * v.w / w; });
    let any = 0; for (const k in p) any += p[k];
    F.vars = Object.keys(p).map(function (k) { return { v: k, p: p[k] }; }).sort(function (x, y) { return y.p - x.p; }); F.plain = Math.max(0, 1 - any);
    return F;
  };
  AA.on('hatched', function (baby) { if (AA.isHybrid(baby.sp)) S().stats.hybrids++; });

  /* ================= Clownfisch und Anemone ================= */
  AA.hostCount = function (t) { let n = 0; t.deco.forEach(function (o) { if (AA.DECO_BY[o.type].host) n++; }); return n; };
  AA.mateChanceFor = function () { return 1; };      // Runde 11: jede Balz bringt ein Ei (die Anemone verkürzt beim Clownfisch stattdessen die Pause)
  /* Eier legt der Clownfisch direkt neben seine Anemone */
  AA.eggSpot = function (t, sp, egg) {
    if (sp !== 'clown') return;
    const hs = t.deco.filter(function (o) { return AA.DECO_BY[o.type].host; });
    if (!hs.length) return;
    const o = AA.pick(hs); egg.x = AA.clamp(o.x + AA.rand(-70, 70), 80, AA.W - 80); egg.z = AA.clamp(o.z + AA.rand(0.02, 0.1), 0.05, 1);
  };

  /* ================= Sammelbuch-Sets und Titel ================= */
  AA.setComplete = function (sp) {
    const b = S().book[sp]; if (!b || !b.n) return false;
    return AA.variantsOf(sp).every(function (v) { return b.v[v.id]; });
  };
  AA.setMult = function (sp) { return AA.setComplete(sp) ? AA.SETBONUS : 1; };
  const farm0 = AA.farmMult;
  AA.farmMult = function (f) { return farm0(f) * AA.setMult(f.sp); };
  AA.setsDone = function () { let n = 0; AA.FISH.forEach(function (f) { if (AA.setComplete(f.id)) n++; }); return n; };
  AA.titleProgress = function (T) {
    if (T.sets) return { have: Math.min(T.sets, AA.setsDone()), total: T.sets };
    const list = T.list(); let have = 0;
    list.forEach(function (sp) { if (AA.bookHas(sp)) have++; });
    return { have: have, total: list.length };
  };
  AA.checkTitles = function () {
    const s = S(), got = [];
    AA.TITLES.forEach(function (T) {
      if (s.titles[T.id]) return;
      const p = AA.titleProgress(T);
      if (p.total && p.have >= p.total) { s.titles[T.id] = 1; if (!s.title) s.title = T.id; AA.addPearls(T.pearls); got.push(T); }
    });
    got.forEach(function (T) { AA.emit('title', T); });
    return got;
  };
  AA.titleOf = function () { const s = S(); return s.title && AA.TITLES.find(function (T) { return T.id === s.title; }) || null; };
  AA.on('bookNew', function (sp, v) {
    setTimeout(function () { if (AA.state) AA.checkTitles(); }, 0);
    if (v && AA.setComplete(sp)) AA.emit('setDone', sp);
  });

  /* ================= Schwärme ================= */
  AA.schoolCounts = function (t) { const c = {}; t.fish.forEach(function (f) { if (AA.FISH_BY[f.sp].school) c[f.sp] = (c[f.sp] || 0) + 1; }); return c; };
  AA.schoolState = function (f, t) {
    if (!AA.FISH_BY[f.sp].school) return null;
    t = t || AA.tankOf(f) || AA.tank();
    const n = AA.schoolCounts(t)[f.sp] || 0;
    return { n: n, school: n >= AA.SCHOOL.min, lonely: n < AA.SCHOOL.lonely };
  };
  /* Wachstum je Fisch (wird in AA.advance pro Becken einmal vorbereitet): Schwarm, Einsamkeit, Turbofutter */
  AA.growPrep = function (t) {
    const c = AA.schoolCounts(t), doc = t.deco.some(function (o) { return AA.DECO_BY[o.type].job === 'doctor'; }) || t.fish.some(function (f) { return AA.FISH_BY[f.sp].cleaner && !f.sick; });      // Putzergarnele oder Putzerfisch
    return { c: c, doctor: doc, clock: S().clock };
  };
  AA.growMult = function (gp, f) {
    let k = 1;
    if (AA.FISH_BY[f.sp].school) { const n = gp.c[f.sp] || 0; k = n >= AA.SCHOOL.min ? AA.SCHOOL.grow : (n < AA.SCHOOL.lonely ? AA.SCHOOL.lonelyGrow : 1); }
    if (f.turboT > gp.clock) k *= AA.FOOD2.turbo.grow;
    return k;
  };

  /* ================= Putzkolonne ================= */
  AA.crewInfo = function (t) {
    const jobs = { algae: 0, glass: 0, food: 0, doctor: 0 }; let base = 0;
    t.deco.forEach(function (o) { const d = AA.DECO_BY[o.type]; if (!d.crawl) return; if (d.job) jobs[d.job]++; base += (d.clean || 0) * (AA.CREW.k || 1); });
    const kinds = (jobs.algae ? 1 : 0) + (jobs.glass ? 1 : 0) + (jobs.food ? 1 : 0);
    const bonus = kinds >= 3 ? AA.CREW.three : (kinds >= 2 ? AA.CREW.two : 0), cap = kinds >= 3 ? AA.CREW.maxFull : AA.CREW.max;
    return { jobs: jobs, kinds: kinds, base: base, bonus: bonus, cap: cap, power: Math.min(cap, base > 0 || bonus > 0 ? base + bonus : 0) };
  };
  AA.cleanPower = function (t) { return AA.crewInfo(t).power; };
  /* liegen gebliebenes Futter fault – ohne Resteverwerter wird das Becken schmutziger */
  AA.rotFood = function (t, n) { if (!n) return; t.dirt = Math.min(1, t.dirt + n * AA.CREW.rot); S().stats.rotted += n; };
  /* Putzerstation: ein Fisch wurde geputzt */
  AA.cleaned = function (f, by) {                    // by = wer geputzt hat (Name eines Putzerfischs); fehlt bei der Garnele
    const s = S(); s.stats.cleaned++;
    let healed = false;
    if (f.sick) { f.sick = false; f.starve = 0; f.hunger = Math.max(f.hunger, 0.5); healed = true; }
    f.cleanT = s.clock;
    AA.emit('cleaned', f, healed, by);
    return healed;
  };

  /* ================= Spezialfutter ================= */
  AA.foodLeft = function (kind) { return kind && kind !== 'normal' ? S().food2[kind] | 0 : S().food; };
  /* eine Prise Spezialfutter verbrauchen (die Flocken streut die Ansicht) */
  AA.shake2 = function (t, kind) {
    const s = S();
    if (!t.fish.length) return 'nofish';
    if ((s.food2[kind] | 0) <= 0) return 'nofood';
    if (kind === 'med' && !t.fish.some(function (f) { return f.sick; })) return 'nosick';
    if (kind === 'live' && !t.fish.some(function (f) { return AA.FISH_BY[f.sp].pred; })) return 'nopred';
    s.food2[kind]--; s.stats.shakes++; s.stats.specialFed++;
    if (kind === 'live') {                             // Futterfische im Wasser: Räuber lassen von deinen Fischen ab und jagen eine Weile nur das Futter
      t.liveT = Date.now() + 25000;
      if (t.hunt) { const h = t.hunt, p = t.fish.find(function (f) { return f.id === h.a; }), q = t.fish.find(function (f) { return f.id === h.b; }); delete t.hunt; if (p && q) AA.emit('huntOff', p, q, t); }
    }
    AA.emit('hud');
    return true;
  };
  /* ein Fisch hat Spezialfutter erwischt */
  AA.foodEffect = function (f, kind) {
    const s = S(), F = AA.FOOD2[kind];
    if (!F) return null;
    if (kind === 'color') { f.colorN = F.eggs; return 'color'; }
    if (kind === 'turbo') { if (!f.adult) { f.turboT = s.clock + F.dur; return 'turbo'; } return null; }
    if (kind === 'med') { if (f.sick) { f.sick = false; f.starve = 0; f.hunger = Math.max(f.hunger, 0.6); return 'healed'; } return null; }
    if (kind === 'live') { f.hunger = Math.min(1, f.hunger + F.fill); f.starve = 0; return 'live'; }
    return null;
  };
  /* Farbfutter: Eier von Eltern mit Farbfutter im Bauch haben doppeltes Glück */
  let luckBoost = 1;
  const chance0 = AA.variantChance;
  AA.variantChance = function (t) { return Math.min(0.75, chance0(t) * luckBoost); };
  const roll0 = AA.rollVariant;
  AA.rollVariant = function (a, b, t) {
    const now = S().clock;
    const boosted = [a, b].filter(function (x) { return x && x.colorN > 0; });
    luckBoost = boosted.length ? AA.FOOD2.color.luck : 1;
    try { return roll0(a, b, t); } finally {
      luckBoost = 1;
      boosted.forEach(function (x) { x.colorN--; if (x.colorN <= 0) delete x.colorN; });      // ein Ei mit Glück verbraucht
    }
  };
  const buy0 = AA.buyFood;
  AA.buyFood = function (id) {
    const def = AA.FOOD_BY[id];
    if (!def || !def.kind) return buy0(id);
    const s = S();
    if (s.level < def.lvl) return 'level';
    if (s.coins < def.price) return 'coins';
    AA.addCoins(-def.price, false);
    s.food2[def.kind] = (s.food2[def.kind] | 0) + def.n;
    AA.emit('hud');
    return true;
  };

  /* ================= Alle füttern ================= */
  /* Jedes Becken bekommt so viele Prisen, dass alle Fische (fast) satt sind – die hungrigsten zuerst, solange der Vorrat reicht. */
  AA.feedAllPlan = function () {
    const s = S(), per = AA.BAL.flakes * AA.BAL.biteFill;      // eine Prise = so viel Sättigung (verteilt auf alle)
    let need = 0; const tanks = [];
    s.tanks.forEach(function (t) {
      let gap = 0; t.fish.forEach(function (f) { if (f.hunger < 0.9) gap += 1 - f.hunger; });
      if (gap > 0) { const n = Math.ceil(gap / per); tanks.push({ t: t, n: n }); need += n; }
    });
    return { need: need, have: s.food, tanks: tanks };
  };
  AA.feedAll = function () {
    const s = S(), P = AA.feedAllPlan(), per = AA.BAL.flakes * AA.BAL.biteFill;
    if (!P.tanks.length) return 'sated';
    if (s.food <= 0) return 'nofood';
    let used = 0, fed = 0, nt = 0, healed = 0;
    P.tanks.forEach(function (x) {
      const n = Math.min(x.n, s.food - used); if (n <= 0) return;
      used += n; nt++;
      let budget = n * per;
      const list = x.t.fish.slice().sort(function (a, b) { return a.hunger - b.hunger; });
      for (let i = 0; i < list.length && budget > 0.0001; i++) {
        const f = list[i], want = Math.min(1 - f.hunger, budget);
        if (want <= 0) continue;
        f.hunger += want; budget -= want; f.starve = 0; fed++;
        if (f.sick && f.hunger >= 0.5) { f.sick = false; healed++; }
        s.stats.bites++;
      }
    });
    s.food -= used; s.stats.shakes += used; s.stats.fedAll++;
    AA.addXP(Math.min(60, fed));
    AA.emit('hud'); AA.emit('fedAll', { used: used, tanks: nt, fish: fed, healed: healed, short: used < P.need });
    return { used: used, tanks: nt, fish: fed, healed: healed, short: used < P.need, need: P.need };
  };

  /* ================= Becken-Vorlagen ================= */
  AA.saveTemplate = function (name) {
    const s = S(), t = AA.tank();
    name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 24) || t.name;
    const list = t.deco.filter(function (o) { const d = AA.DECO_BY[o.type]; return !d.fixed && !d.daily; });
    const tpl = { id: AA.uid(), name: name, water: t.water, wall: t.wall, floor: t.floor, shape: t.shape || 'flat',
      deco: list.map(function (o) {
        const x = { type: o.type, x: Math.round(o.x), z: +o.z.toFixed(3) }; if (o.s) x.s = o.s; if (o.flip) x.flip = 1;
        if (o.on) { const bi = list.findIndex(function (b) { return b.id === o.on; }); if (bi >= 0) { x.on = bi; x.oi = o.oi | 0; x.ou = o.ou || 0; } }   // steht auf einem anderen Stück der Vorlage
        return x; }) };
    const i = s.templates.findIndex(function (x) { return x.name === name; });
    if (i >= 0) s.templates[i] = tpl; else { if (s.templates.length >= 12) return 'max'; s.templates.push(tpl); }
    return tpl;
  };
  AA.deleteTemplate = function (id) { const s = S(), i = s.templates.findIndex(function (x) { return x.id === id; }); if (i < 0) return false; s.templates.splice(i, 1); return true; };
  /* Was kostet die Vorlage im aktuellen Becken? Vorhandene Stücke werden wiederverwendet, fehlende gekauft. */
  AA.templatePlan = function (id, t) {
    const s = S(), tpl = s.templates.find(function (x) { return x.id === id; }); t = t || AA.tank();
    if (!tpl) return null;
    const have = {}; t.deco.forEach(function (o) { have[o.type] = (have[o.type] || 0) + 1; });
    const use = {}, buy = [], skip = []; let coins = 0, pearls = 0;
    tpl.deco.forEach(function (x) {
      const d = AA.DECO_BY[x.type];
      if (!d) { skip.push({ x: x, why: 'gone' }); return; }
      if ((use[x.type] || 0) < (have[x.type] || 0)) { use[x.type] = (use[x.type] || 0) + 1; return; }
      if (s.level < d.lvl) { skip.push({ x: x, why: 'level', d: d }); return; }
      if (d.crawl && !AA.decoFits(d, t)) { skip.push({ x: x, why: 'water', d: d }); return; }
      if (d.unique) { skip.push({ x: x, why: 'unique', d: d }); return; }
      buy.push({ x: x, d: d }); coins += d.price || 0;
    });
    const wall = AA.WALL_BY[tpl.wall], wallBuy = wall && s.walls.indexOf(tpl.wall) < 0 ? wall.pearls || 0 : 0;
    const floor = AA.FLOOR_BY[tpl.floor], floorOk = floor && s.level >= floor.lvl;
    pearls += wallBuy;
    const extra = t.deco.filter(function (o) { return !AA.DECO_BY[o.type].fixed && !AA.DECO_BY[o.type].daily; }).length - tpl.deco.length + buy.length;
    return { tpl: tpl, buy: buy, skip: skip, coins: coins, pearls: pearls, wallBuy: wallBuy, floorOk: floorOk, water: tpl.water === t.water, keep: Math.max(0, -extra) };
  };
  AA.applyTemplate = function (id) {
    const s = S(), t = AA.tank(), P = AA.templatePlan(id, t);
    if (!P) return 'unknown';
    if (s.coins < P.coins) return 'coins';
    if (P.pearls && s.pearls < P.pearls) return 'pearls';
    const tpl = P.tpl;
    // Kulisse, Boden, Form
    if (AA.WALL_BY[tpl.wall]) { if (P.wallBuy) { AA.addPearls(-P.wallBuy); s.walls.push(tpl.wall); } t.wall = tpl.wall; }
    if (P.floorOk) t.floor = tpl.floor;
    if (tpl.shape && tpl.shape !== 'flat') t.shape = tpl.shape; else delete t.shape;
    // Deko: vorhandene Stücke an die Plätze der Vorlage, fehlende kaufen
    const pool = {}; t.deco.forEach(function (o) { if (!AA.DECO_BY[o.type].fixed && !AA.DECO_BY[o.type].daily) (pool[o.type] = pool[o.type] || []).push(o); });
    let bought = 0; const placed = [];
    tpl.deco.forEach(function (x, i) {
      const d = AA.DECO_BY[x.type]; if (!d) return;
      let o = pool[x.type] && pool[x.type].shift();
      if (!o) {
        if (!P.buy.some(function (b) { return b.x === x; })) return;
        if (!AA.decoRoom(t, d) || s.coins < (d.price || 0)) return;
        AA.addCoins(-(d.price || 0), false); s.stats.decoBought++; s.stats.spentDeco += d.price || 0;
        o = { id: AA.uid(), type: x.type, x: x.x, z: x.z }; t.deco.push(o); bought++;
      }
      AA.unstackFrom(t, o);
      o.x = x.x; o.z = x.z; delete o.on; delete o.oi; delete o.ou;
      if (x.s) o.s = x.s; else delete o.s;
      if (x.flip) o.flip = true; else delete o.flip;
      placed[i] = o;
    });
    tpl.deco.forEach(function (x, i) {                 // Gestapeltes wieder auf seine Stellfläche setzen
      const o = placed[i], base = x.on !== undefined ? placed[x.on] : null;
      if (o && base && AA.DECO_BY[base.type].tops) { o.on = base.id; o.oi = x.oi | 0; o.ou = x.ou || 0; }
    });
    s.stats.templates = (s.stats.templates | 0) + 1;
    AA.checkMedals();
    AA.emit('sceneChanged'); AA.emit('tankChanged'); AA.emit('hud');
    return { bought: bought, skipped: P.skip.length };
  };
})(window.AA);
