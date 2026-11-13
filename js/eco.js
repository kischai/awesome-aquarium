'use strict';
/* Awesome Aquarium – Runde 7: Biotope, (Räuber: seit Runde 11 friedlich), Boden-Formen, Becken-Übersicht (Daten), Bericht „Während du weg warst“ (Daten).
   Zahlen: js/data.js (AA.BIO, AA.BIOTOPES, AA.PRED, AA.SHAPES), Oberfläche: js/ecoui.js, Regeln in Worten: docs/MECHANIK.md § 6d. */
(function (AA) {
  function S() { return AA.state; }
  const sets = {};
  AA.BIOTOPES.forEach(function (b) { const m = { walls: {}, floors: {}, deco: {}, fish: {} }; for (const k in m) b[k].forEach(function (x) { m[k][x] = 1; }); sets[b.id] = m; });
  (AA.HYBRIDS || []).forEach(function (h) { for (const id in sets) if (sets[id].fish[h.a] && sets[id].fish[h.b]) sets[id].fish[h.id] = 1; });   // ein Hybrid zählt zum Biotop, wenn beide Eltern dazugehören (in den Listen und Titeln steht er nicht)

  AA.ecoFix = function (o) {
    o.tanks.forEach(function (t) { if (!AA.SHAPE_BY[t.shape] || t.shape === 'flat') delete t.shape; delete t.hunt; t.fish.forEach(function (f) { delete f.pw; }); });
    delete o.settings.pred;                          // Runde 11: Räuber fressen keine Fische mehr – der Schalter ist weg
    o.stats.eaten = Math.max(0, o.stats.eaten | 0);
    return o;
  };
  AA.tankOf = function (f) { const ts = S().tanks; for (let i = 0; i < ts.length; i++) if (ts[i].fish.indexOf(f) >= 0) return ts[i]; return null; };

  /* ---------- Boden-Form ---------- */
  AA.setShape = function (id) {
    if (!AA.SHAPE_BY[id]) return 'unknown';
    const t = AA.tank();
    if (id === 'flat') delete t.shape; else t.shape = id;
    AA.emit('sceneChanged');
    return true;
  };

  /* ---------- Biotop ---------- */
  function score(b, t) {
    const m = sets[b.id], seen = {}; let deco = 0, fit = 0;
    t.deco.forEach(function (o) { if (m.deco[o.type] && !seen[o.type]) { seen[o.type] = 1; deco++; } });
    t.fish.forEach(function (f) { if (m.fish[f.sp]) fit++; });
    const c = { wall: !!m.walls[t.wall], floor: !!m.floors[t.floor], deco: deco >= AA.BIO.deco, fish: t.fish.length >= AA.BIO.fish && fit >= t.fish.length * AA.BIO.share };
    return { b: b, c: c, pts: (c.wall ? 1 : 0) + (c.floor ? 1 : 0) + (c.deco ? 1 : 0) + (c.fish ? 1 : 0), nDeco: deco, nFit: fit, n: t.fish.length };
  }
  /* bestes Biotop eines Beckens: { b, c: { wall, floor, deco, fish }, pts 0…4, tier (ab 2 Punkten) } oder null, wenn zum Wasser keins passt */
  AA.biotope = function (t) {
    let best = null;
    AA.BIOTOPES.forEach(function (b) { if (b.water !== t.water) return; const r = score(b, t); if (!best || r.pts > best.pts || (r.pts === best.pts && r.nFit > best.nFit)) best = r; });
    if (best) best.tier = AA.BIO.tiers[best.pts] || null;
    return best;
  };
  AA.bioTier = function (t) { const r = AA.biotope(t); return r && r.tier ? r : null; };
  AA.bioGrow = function (t) { const r = AA.bioTier(t); return r ? r.tier.grow : 1; };
  AA.bioLuck = function (t) { const r = AA.bioTier(t); return r ? r.tier.luck : 1; };
  AA.bioValue = function (f, t) { t = t || AA.tankOf(f); if (!t) return 1; const r = AA.bioTier(t); return r && sets[r.b.id].fish[f.sp] ? r.tier.value : 1; };
  const farm0 = AA.farmMult;
  AA.farmMult = function (f) { return farm0(f) * AA.bioValue(f); };
  const chance0 = AA.variantChance;                  // Glück: Eier aus einem Biotop-Becken mutieren öfter
  AA.variantChance = function (t) { return Math.min(0.6, chance0() * AA.bioLuck(t || AA.tank())); };

  /* ---------- Räuber (Runde 11): fressen KEINE Fische mehr – alle vertragen sich. Übrig bleibt nur: große Jäger (pred an der Art)
     schnappen sich Lebendfutter (js/life.js, js/tankview.js). ---------- */
  AA.bodyLen = function (f) { const d = AA.FISH_BY[f.sp]; return d.len * (f.adult ? 1 : 0.4 + 0.6 * Math.min(1, f.age / d.grow)); };
  AA.isPred = function (f) { return !!AA.FISH_BY[f.sp].pred; };
  AA.preyOf = function () { return []; };
  AA.predRisk = function () { return false; };
  AA.predTick = function (t) { if (t.hunt) delete t.hunt; };

  /* ---------- Nachholen: Bericht sammeln ---------- */
  const catch0 = AA.catchUp;
  AA.catchUp = function (seconds) {
    const s = S(), st = s.stats, b = { coins: s.coins, wages: st.wages | 0, miss: st.contractsMissed | 0, done: st.contractsDone | 0, del: st.delivered | 0, sold: st.soldCoins | 0, rep: s.rep | 0, staff: JSON.stringify(s.staff || {}) };
    const eggs0 = s.tanks.reduce(function (n, t) { return n + t.eggs.length; }, 0);
    const sum = catch0(seconds);
    if (!(seconds > 0)) return sum;
    sum.wages = (st.wages | 0) - b.wages; sum.cMiss = (st.contractsMissed | 0) - b.miss; sum.cDone = (st.contractsDone | 0) - b.done;
    sum.delivered = (st.delivered | 0) - b.del; sum.soldCoins = (st.soldCoins | 0) - b.sold; sum.coins = s.coins - b.coins; sum.rep = (s.rep | 0) - b.rep;
    const was = JSON.parse(b.staff); sum.quit = Object.keys(AA.STAFF).filter(function (k) { return was[k] && !s.staff[k]; });
    sum.staff = Object.keys(AA.STAFF).filter(function (k) { return s.staff[k]; });
    sum.matings = Math.max(0, s.tanks.reduce(function (n, t) { return n + (t.matings ? t.matings.length : 0); }, 0));
    sum.eggs = s.tanks.reduce(function (n, t) { return n + t.eggs.length; }, 0); sum.eggs0 = eggs0;
    AA.emit('hud');
    return sum;
  };

  /* ---------- Becken-Übersicht: was ist in diesem Becken los? ---------- */
  AA.tankStatus = function (t) {
    const s = S(), o = { n: AA.count(t), cap: AA.cap(t), fish: t.fish.length, hungry: 0, sick: 0, young: 0, dirt: t.dirt, eggs: t.eggs.length, soon: 0, caviar: 0, deliver: 0, mating: t.matings ? t.matings.length : 0, risk: false, fed: t.fish.length ? AA.fedAvg(t) : 1 };
    t.fish.forEach(function (f) { if (f.sick) o.sick++; else if (f.hunger < 0.4) o.hungry++; if (!f.adult) o.young++; const c = AA.caviarStatus(f); if (c && c.ok) o.caviar++; });
    t.eggs.forEach(function (e) { if (e.hatch < 600 * AA.speed()) o.soon++; });        // schlüpft in den nächsten 10 echten Minuten
    o.bio = AA.biotope(t);
    const warn = [];
    if (o.sick) warn.push(['🤒', o.sick + (o.sick === 1 ? ' Fisch ist krank' : ' Fische sind krank'), 3]);
    if (o.hungry) warn.push(['🍽️', o.hungry + (o.hungry === 1 ? ' Fisch hat Hunger' : ' Fische haben Hunger'), 2]);
    if (o.dirt > 0.5) warn.push(['🧽', 'Becken zu ' + Math.round(o.dirt * 100) + ' % schmutzig', o.dirt > 0.8 ? 3 : 2]);
    if (o.soon) warn.push(['🐣', o.soon + (o.soon === 1 ? ' Ei schlüpft' : ' Eier schlüpfen') + ' gleich', 0]);
    else if (o.eggs) warn.push(['🥚', o.eggs + (o.eggs === 1 ? ' Ei' : ' Eier') + ' im Becken', 0]);
    if (o.caviar) warn.push(['🥄', 'Kaviar bereit (' + o.caviar + ')', 0]);
    if (o.mating) warn.push(['❤️', o.mating > 1 ? o.mating + ' Paare balzen' : 'Balz läuft', 0]);
    if (o.n >= o.cap) warn.push(['📦', 'Becken ist voll', 1]);
    o.warn = warn; o.level = warn.reduce(function (m, w) { return Math.max(m, w[2]); }, 0);
    return o;
  };
  AA.tanksAlert = function () { let n = 0; S().tanks.forEach(function (t, i) { if (i !== S().active && AA.tankStatus(t).level >= 2) n++; }); return n; };
})(window.AA);
