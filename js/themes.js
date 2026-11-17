'use strict';
/* Awesome Aquarium – Runde 19: Themen-Sets (Regeln). Daten AA.THEMES in js/data.js · Oberfläche js/themesui.js · Effekte js/themefx.js · Regeln in Worten: docs/MECHANIK.md § 11h.
   Spielstand: s.themes[id] = erreichte Stufen als Bits (1 Entdeckt, 2 Gezüchtet, 4 Ausgestellt) · s.bred[art] = selbst ausgebrütet (eigenes Ei geschlüpft) ·
   s.critters[id] = Krabbler einmal besessen · s.badges = bis zu 3 Set-Abzeichen · s.pin = angeheftetes Set · s.themeTold = schon gegebene Hinweise ·
   t.fx = Becken-Effekt (ID aus AA.THEME_FX). */
(function (AA) {
  const S = function () { return AA.state; };
  const BIT = AA.THEME_BIT = { found: 1, bred: 2, shown: 4 };
  const SEASON = function (id) { const f = AA.FISH_BY[id] || AA.DECO_BY[id]; return !!(f && f.season); };

  /* ---------- Daten rund ums Set ---------- */
  function lvlOf(id) { const d = AA.FISH_BY[id] || AA.DECO_BY[id]; return d ? d.lvl : 0; }
  /* Tiere eines Sets: Fisch-Arten oder Krabbler; Regionen = Biotop-Arten im Level-Band (neue Arten des Biotops kommen von selbst dazu) */
  AA.themeItems = function (T) {
    if (T._items) return T._items;
    let L = [];
    if (T.kind === 'region') L = AA.BIOTOPE_BY[T.bio].fish.filter(function (id) { const f = AA.FISH_BY[id]; return f && f.lvl >= T.lv[0] && f.lvl <= T.lv[1]; });
    else if (T.list) L = T.list.filter(function (id) { return AA.FISH_BY[id] || (AA.DECO_BY[id] && AA.DECO_BY[id].crawl); });
    L = L.slice().sort(function (a, b) { return lvlOf(a) - lvlOf(b); });
    return (T._items = L);
  };
  AA.themeIsCritter = function (id) { return !AA.FISH_BY[id]; };
  AA.themeStages = function (T) { return T.kind === 'region' || T.kind === 'coll' ? [1, 2, 4] : (T.kind === 'crawl' ? [1, 4] : [1]); };
  AA.themeNeed = function (T, bit) { const n = AA.themeItems(T).length; return bit === 2 && n >= 12 ? Math.ceil(n * 0.75) : n; };      // Gezüchtet: ab 12 Tieren reichen drei Viertel
  AA.themePearls = function (T) {
    if (T.kind === 'family') return T.pearls || 0;
    if (T.kind === 'master' || T.titleId) return 0;    // Titel aus AA.TITLES bringen ihre Perlen selbst (AA.checkTitles)
    const n = AA.themeItems(T).length;
    return n <= 5 ? 3 : (n <= 8 ? 4 : (n <= 11 ? 5 : (n <= 14 ? 6 : (n <= 16 ? 7 : 8))));
  };
  AA.themeLevels = function (T) { const L = AA.themeItems(T).map(lvlOf); return L.length ? [Math.min.apply(null, L), Math.max.apply(null, L)] : null; };
  AA.themeSeason = function (T) { return !!T.season; };

  /* ---------- Titel der Sets (neben AA.TITLES; getragen wie diese, s.title) ---------- */
  AA.SET_TITLES = AA.THEMES.filter(function (T) { return T.title; }).map(function (T) {
    return { id: 'set_' + T.id, name: T.title, ico: T.ico, info: 'Themen-Set „' + T.name + '“', theme: T.id };
  });
  AA.themeTitleId = function (T) { return T.titleId || (T.title ? 'set_' + T.id : null); };
  AA.titleById = function (id) {
    if (!id) return null;
    for (let i = 0; i < AA.TITLES.length; i++) if (AA.TITLES[i].id === id) return AA.TITLES[i];
    for (let i = 0; i < AA.SET_TITLES.length; i++) if (AA.SET_TITLES[i].id === id) return AA.SET_TITLES[i];
    return null;
  };
  AA.titleOf = function () { const s = S(); return s && s.title ? AA.titleById(s.title) : null; };      // ersetzt die Fassung aus js/life.js (kennt jetzt auch Set-Titel)

  /* ---------- Fortschritt ---------- */
  function shownMap(s) {                               // was gerade erwachsen in deinen Becken lebt (Krabbler: was drin krabbelt)
    const m = {};
    s.tanks.forEach(function (t) {
      t.fish.forEach(function (f) { if (f.adult) m[f.sp] = 1; });
      t.deco.forEach(function (o) { const d = AA.DECO_BY[o.type]; if (d && d.crawl) m[o.type] = 1; });
    });
    return m;
  }
  function has(s, id) { if (AA.FISH_BY[id]) { const b = s.book[id]; return !!(b && b.n); } return !!s.critters[id]; }
  function bred(s, id) { return AA.FISH_BY[id] ? !!s.bred[id] : !!s.critters[id]; }      // Krabbler vermehren sich nicht: einmal besessen zählt
  AA.themeHas = function (id) { return has(S(), id); };
  AA.themeBred = function (id) { return bred(S(), id); };
  AA.themeShownMap = function () { return shownMap(S()); };
  AA.themeProgress = function (T, sm) {
    const s = S(), bits = (s.themes && s.themes[T.id]) | 0;
    if (T.kind === 'master') {
      const ti = AA.titleById(T.titleId), p = AA.titleProgress(ti);
      return { n: p.total, found: p.have, need: { 1: p.total }, bits: bits };
    }
    if (T.kind === 'family') {
      const f = AA.familyProgress ? AA.familyProgress(T) : null;
      return { n: f ? f.total : 0, found: f ? f.have : 0, need: { 1: f ? f.total : 0 }, bits: bits, fam: f };
    }
    const L = AA.themeItems(T); sm = sm || shownMap(s);
    let a = 0, b = 0, c = 0;
    L.forEach(function (id) { if (has(s, id)) a++; if (bred(s, id)) b++; if (sm[id]) c++; });
    return { n: L.length, found: a, bred: b, shown: c, need: { 1: L.length, 2: AA.themeNeed(T, 2), 4: L.length }, bits: bits };
  };
  AA.themeValue = function (p, bit) { return bit === 1 ? p.found : (bit === 2 ? p.bred : p.shown); };
  function reached(T, p, bit) {
    if (T.kind === 'master') return bit === 1 && !!S().titles[T.titleId];      // Meister: der Titel selbst (wie bisher von AA.checkTitles vergeben)
    if (T.kind === 'family') return bit === 1 && !!(p.fam && p.fam.done);
    return p.n > 0 && AA.themeValue(p, bit) >= p.need[bit];
  }

  /* ---------- Belohnungen ---------- */
  function reward(T, bit, silent) {
    const s = S(), out = { id: T.id, bit: bit };
    if (bit === 1) {
      const pe = AA.themePearls(T);
      if (pe) { AA.addPearls(pe); out.pearls = pe; }
      const tid = T.title ? 'set_' + T.id : null;
      if (tid && !s.titles[tid]) { s.titles[tid] = 1; if (!s.title) s.title = tid; out.title = tid; }
      if (T.id === 'fam_book' && s.badges.indexOf(T.id) < 0 && s.badges.length < 3) s.badges.push(T.id);      // Familienwappen
    } else if (bit === 2) {
      if (T.fx) out.fx = T.fx;
    } else if (bit === 4) {
      if (T.kind === 'region') { const w = 'gold_' + T.id; if (s.walls.indexOf(w) < 0) s.walls.push(w); out.wall = w; }
      else {
        const id = 'trophy_' + T.id, why = 'Themen-Set „' + T.name + '“';
        if (silent || !AA.awardTrophy) { s.storage = s.storage || []; s.storage.push({ type: id }); s.trophies = s.trophies || []; s.trophies.push({ id: id, why: why, at: Date.now() }); }      // beim Laden: still ins Lager
        else AA.awardTrophy(id, why);
        out.trophy = id;
      }
      if (s.badges.indexOf(T.id) < 0 && s.badges.length < 3) s.badges.push(T.id);
    }
    return out;
  }
  function markCritters(s) {                           // Krabbler einmal besessen (Becken und Lager)
    const see = function (type) { const d = AA.DECO_BY[type]; if (d && d.crawl) s.critters[type] = 1; };
    s.tanks.forEach(function (t) { t.deco.forEach(function (o) { see(o.type); }); });
    (s.storage || []).forEach(function (it) { see(it.type); });
  }
  /* Alle Sets prüfen: neu erreichte Stufen eintragen und belohnen. silent = ohne Feier (beim Laden). Liefert die neuen Stufen. */
  AA.checkThemes = function (silent) {
    const s = S();
    if (!s || !s.themes || AA.visit || AA.loadingGuest) return [];
    markCritters(s);
    const sm = shownMap(s), got = [];
    AA.THEMES.forEach(function (T) {
      const p = AA.themeProgress(T, sm);
      AA.themeStages(T).forEach(function (bit) {
        if (((s.themes[T.id] | 0) & bit) || !reached(T, p, bit)) return;
        s.themes[T.id] = (s.themes[T.id] | 0) | bit;
        got.push(reward(T, bit, silent));
      });
    });
    if (got.length && !silent) { AA.emit('hud'); AA.emit('storage'); got.forEach(function (r) { AA.emit('theme', r); }); }
    return got;
  };
  let pend = 0;
  AA.themeSoon = function () { if (pend) return; pend = setTimeout(function () { pend = 0; if (AA.state && AA.ready !== false) AA.checkThemes(false); }, 0); };

  /* ---------- Hinweise: fast geschafft, Shop-Schildchen ---------- */
  /* Sets, denen für die nächste Stufe nur noch 1–2 Tiere fehlen: [{ T, bit, miss: [ids] }] */
  AA.themeNear = function () {
    const s = S(), sm = shownMap(s), out = [];
    AA.THEMES.forEach(function (T) {
      if (T.kind === 'master' || T.kind === 'family') return;
      const p = AA.themeProgress(T, sm), bits = p.bits;
      const bit = AA.themeStages(T).filter(function (b) { return !(bits & b); })[0];
      if (!bit) return;
      const left = p.need[bit] - AA.themeValue(p, bit);
      if (left < 1 || left > 2) return;
      const L = AA.themeItems(T), miss = L.filter(function (id) { return bit === 1 ? !has(s, id) : (bit === 2 ? !bred(s, id) : !sm[id]); });
      out.push({ T: T, bit: bit, left: left, miss: miss });
    });
    return out;
  };
  /* Für welches Set fehlt diese Art noch (Stufe Entdeckt)? Das am weitesten fortgeschrittene: { T, have, n } oder null */
  AA.themeFor = function (id) {
    const s = S(); let best = null;
    AA.THEMES.forEach(function (T) {
      if (T.kind === 'master' || T.kind === 'family' || ((s.themes[T.id] | 0) & 1)) return;
      const L = AA.themeItems(T); if (L.indexOf(id) < 0 || has(s, id)) return;
      let h = 0; L.forEach(function (x) { if (has(s, x)) h++; });
      const q = h / L.length;
      if (!best || q > best.q) best = { T: T, have: h, n: L.length, q: q };
    });
    return best;
  };
  /* Effekte, die du freigespielt hast (Stufe Gezüchtet) */
  AA.themeFxOwned = function () {
    const s = S(), out = [];
    AA.THEMES.forEach(function (T) { if (T.fx && ((s.themes[T.id] | 0) & 2) && out.indexOf(T.fx) < 0) out.push(T.fx); });
    return out;
  };
  AA.setTankFx = function (fx, t) {
    t = t || AA.tank();
    if (fx && AA.themeFxOwned().indexOf(fx) < 0) return false;
    if (fx) t.fx = fx; else delete t.fx;
    AA.emit('sceneChanged'); return true;
  };
  AA.themeGoldCount = function () { const s = S(); let n = 0; for (const k in s.themes) if (s.themes[k] & 4) n++; return n; };
  AA.setBadges = function (list) {
    const s = S();
    s.badges = (list || []).filter(function (id) { const T = AA.THEME_BY[id]; return T && (((s.themes[id] | 0) & 4) || (T.kind === 'family' && ((s.themes[id] | 0) & 1))); }).slice(0, 3);
    AA.emit('hud');
  };
  /* Krabbler-Album komplett ausgestellt (alle sechs Alben): einmal am Tag laufen alle Krabbler im Gänsemarsch (js/themefx.js) */
  AA.themeParade = function () { const s = S(); return AA.THEMES.every(function (T) { return T.kind !== 'crawl' || ((s.themes[T.id] | 0) & 4); }); };

  /* ---------- Familie (Daten aus der Wolke: js/cloud.js – Freundesliste mit „seen“, Zähler my_social_counts) ---------- */
  AA.familyProgress = function (T) {
    const C = AA.cloud, s = S(), online = !!(C && C.on && C.user);
    const fr = online && Array.isArray(C.friends) ? C.friends.filter(function (f) { return f.status === 'accepted'; }) : [];
    if (T.id === 'fam_book') {                         // jede Art (ohne Saison-Tiere und Hybride) bei mindestens zwei von euch im Sammelbuch
      const L = AA.FISH.filter(function (f) { return !f.season && !f.hybrid; }), seen = fr.map(function (f) { const o = {}; (Array.isArray(f.seen) ? f.seen : []).forEach(function (k) { o[k] = 1; }); return o; });
      let have = 0; const miss = [];
      L.forEach(function (f) {
        let n = s.book[f.id] && s.book[f.id].n ? 1 : 0;
        seen.forEach(function (o) { if (o[f.id]) n++; });
        if (n >= 2) have++; else miss.push({ id: f.id, n: n });
      });
      return { have: have, total: L.length, done: online && fr.length > 0 && have >= L.length, members: fr.length + 1, miss: miss, online: online };
    }
    const k = T.id === 'fam_gifts' ? 'gifts' : 'helps', n = online && C.counts ? C.counts[k] | 0 : 0;
    return { have: Math.min(T.need, n), total: T.need, done: online && n >= T.need, online: online };
  };

  /* ---------- Spielstand ---------- */
  function okMap(o, test) { const m = {}; if (o && typeof o === 'object') for (const k in o) if (test(k)) m[k] = 1; return m; }
  AA.themesFix = function (o) {
    const th = o.themes && typeof o.themes === 'object' ? o.themes : {};
    o.themes = {}; for (const k in th) if (AA.THEME_BY[k] && (th[k] & 7)) o.themes[k] = th[k] & 7;
    o.bred = okMap(o.bred, function (k) { return !!AA.FISH_BY[k]; });
    o.critters = okMap(o.critters, function (k) { return !!(AA.DECO_BY[k] && AA.DECO_BY[k].crawl); });
    o.themeTold = okMap(o.themeTold, function (k) { return /^[a-z0-9_]+:[124]$/.test(k); });
    o.badges = (Array.isArray(o.badges) ? o.badges : []).filter(function (id, i, a) {
      const T = AA.THEME_BY[id]; return T && a.indexOf(id) === i && (((o.themes[id] | 0) & 4) || (T.kind === 'family' && ((o.themes[id] | 0) & 1)));
    }).slice(0, 3);
    if (o.pin && !AA.THEME_BY[o.pin]) delete o.pin;
    (o.tanks || []).forEach(function (t) { if (t && t.fx && !AA.THEME_FX[t.fx]) delete t.fx; });
    if (o.titles) for (const k in o.titles) if (k.indexOf('set_') === 0 && !AA.titleById(k)) delete o.titles[k];
    if (o.title && !(o.titles && o.titles[o.title])) delete o.title;
    return o;
  };
  /* Nach dem Laden (js/state.js): beim ersten Mal das Geschaffte still gutschreiben – die Neuigkeit sagt es dann mit Konfetti */
  AA.themesAfterLoad = function (o, guest) {
    AA.themesFix(o);
    if (guest) return;
    const first = !o.themesV;
    if (first) {                                       // einmalig: Kreuzungen im Sammelbuch hat man selbst gezüchtet (Hybride gibt es nur so)
      AA.FISH.forEach(function (f) { if (f.hybrid && o.book[f.id] && o.book[f.id].n) o.bred[f.id] = 1; });
      o.themesV = 1;
    }
    const got = AA.checkThemes(true);
    if (first && got.length) {
      let pearls = 0; got.forEach(function (r) { pearls += r.pearls || 0; });
      o.news = o.news || {};
      o.news.themes = { pearls: pearls, list: got.map(function (r) { return r.id + ':' + r.bit; }).slice(0, 60) };
    }
  };
  AA.themesNew = function (o) { AA.themesFix(o); o.themesV = 1; };      // neues Spiel

  /* ---------- Ereignisse ---------- */
  AA.on('hatched', function (baby, e) { const s = S(); if (s && s.bred && e && e.bred && !AA.visit) s.bred[baby.sp] = 1; AA.themeSoon(); });
  ['bookNew', 'matured', 'fishAdded', 'fishRemoved', 'tankChanged', 'decoAdded', 'decoRemoved', 'storage', 'title', 'friends', 'counts'].forEach(function (ev) { AA.on(ev, AA.themeSoon); });
  AA.themeSeasonal = SEASON;
})(window.AA);
