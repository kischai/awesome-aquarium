'use strict';
/* Awesome Aquarium – Oberfläche für Runde 8 (Regeln in js/life.js):
     • Kreuzungs-Planer (Hybride) samt Umschalter im Zuchtplaner, Liste der Kreuzungen im Büro → Zucht
     • Fisch-Karte: Schwarm, Anemone, Versteck, Hybrid, Spezialfutter, Set-Bonus; Knopf „Kreuzen“
     • Sammelbuch: Reiter Titel, Set-Zeile je Art
     • Futter-Leiste über dem Futter-Werkzeug (Sorte wählen) und „Alle füttern“
     • Becken-Vorlagen im Shop (Kies & Hintergrund), Putzkolonne im Krabbler-Reiter und in der Becken-Übersicht
     • Einstellungen: Klang neu/klassisch, Blubbern im Hintergrund; Meldungen zu Titeln, Sets, Schwärmen */
(function (AA) {
  const $ = AA.$, esc = AA.esc, fmt = AA.fmt, UI = AA.ui, V = AA.view;
  const PEARL = '<span class="pearl" title="Perlen"></span>';
  function real(sec) { return sec / AA.speed(); }
  function head(title, extra) { return '<div class="m-head"><div class="m-title">' + title + '</div>' + (extra || '') + '<button class="x" data-act="close" title="Schließen">✕</button></div>'; }
  function coin() { return '<img class="ic" src="' + AA.assets.src('prop/coin') + '" alt="Münzen">'; }
  function pc(x) { const v = x * 100; return (v > 0 && v < 1 ? '<1' : (v > 99 && v < 100 ? '>99' : Math.round(v))) + ' %'; }
  function pct(k) { return Math.round((k - 1) * 100); }
  function fishImg(f, px) { const key = AA.spriteKey(f); return f.v ? AA.assets.variantSrc(key, f.v, px || 120) : AA.assets.src(key); }
  function fail(msg) { UI.toast('⚠️ ' + msg, 'warn'); AA.audio.play('fail'); }
  function live() { return AA.ready && !AA.quiet; }
  function sp(id) { return AA.FISH_BY[id]; }

  /* ================= Kreuzungs-Planer ================= */
  UI.cross = null;
  const X_WHY = { parents: 'Beide Eltern-Arten müssen in diesem Becken leben.', busy: 'In diesem Becken wird gerade schon geturtelt.', hungry: 'Die Eltern müssen satt und gesund sein.',
    pair: 'Du brauchst ein erwachsenes ♂ der einen und ein ♀ der anderen Art.', dirty: 'Erst putzen – gekreuzt wird nur im sauberen Becken.', full: 'Kein Platz für ein Ei: Becken vergrößern oder Fische verkaufen.', coins: 'Dafür reichen die Münzen nicht.' };
  const X_SHORT = { parents: 'Eltern fehlen', busy: 'Balz läuft …', hungry: 'Eltern hungrig', pair: 'Kein gemischtes Paar', dirty: 'Becken zu schmutzig', full: 'Becken voll', coins: 'Zu wenig Münzen' };
  function xWhy(st) { return st.why === 'cd' ? 'Nach einer Kreuzung ruhen sich die Eltern aus – wieder in ' + AA.fmtShort(real(st.cd)) + '.' : (st.why === 'level' ? 'Diese Kreuzung gelingt erst ab Level ' + st.def.lvl + '.' : X_WHY[st.why] || 'Gerade nicht möglich.'); }
  function xShort(st) { return st.why === 'cd' ? 'wieder in ' + AA.fmtShort(real(st.cd)) : (st.why === 'level' ? '🔒 Ab Level ' + st.def.lvl : X_SHORT[st.why] || 'gerade nicht'); }
  function xName(h) { return AA.bookHas(h.id) ? esc(sp(h.id).name) : esc(sp(h.a).name) + ' × ' + esc(sp(h.b).name); }
  function xRow(f, sel, act, dim) {
    const vd = f.v && AA.VAR_BY[f.v];
    return '<button class="prow' + (sel ? ' on' : '') + (dim ? ' dim' : '') + '" data-act="' + act + '" data-id="' + f.id + '"><img src="' + fishImg(f, 96) + '" alt=""><span class="p-nm">' + esc(f.name) + ' <small>' + esc(sp(f.sp).name) + '</small>' +
      (vd ? ' ' + UI.varChip(f.v, true) : '') + '</span><span class="p-g">' + UI.clsChip(f) + '<span class="genes">' + UI.genesTxt(f) + '</span></span></button>';
  }
  /* Umschalter über dem Planer: Reinzucht oder Kreuzung – erscheint nur, wenn in diesem Becken beide Eltern-Arten einer Kreuzung leben */
  function modeRow(pure, hid) {
    const t = AA.tank(), opts = AA.crossOptions(t).filter(function (st) { return st.why !== 'level' && (hid ? true : (st.h.a === pure || st.h.b === pure)); });
    if (!opts.length) return '';
    const cur = hid ? AA.HYB_BY[hid] : null, list = cur ? [cur.a, cur.b] : [pure];
    return '<div class="x-mode">' + list.map(function (p) {
      const on = !hid && p === pure, ok = on || AA.mateStatus(p, t).ok;
      return '<button class="seg' + (on ? ' active' : '') + '" data-act="x-pure" data-id="' + p + '"' + (ok ? '' : ' disabled title="Reinzucht geht gerade nicht (kein sattes Paar, Pause oder Becken voll)"') + '>❤ Reinzucht ' + esc(sp(p).name) + '</button>';
    }).join('') + opts.map(function (st) { return '<button class="seg xo' + (hid === st.h.id ? ' active' : '') + '" data-act="x-open" data-id="' + st.h.id + '">🧬 Kreuzen: ' + xName(st.h) + '</button>'; }).join('') + '</div>';
  }
  UI.lifePlanTop = function (pure) { return modeRow(pure, null); };
  function crossHtml() {
    const X = UI.cross, t = AA.tank(), st = AA.crossStatus(X.hid, t), h = st.h, def = st.def, A = sp(h.a), B = sp(h.b), known = AA.bookHas(X.hid);
    const a = st.males.find(function (x) { return x.id === X.a; }) || null, b = st.females.find(function (x) { return x.id === X.b; }) || null;
    const byG = function (x, y) { return AA.geneSum(y) - AA.geneSum(x); };
    const none = function (who) { return '<div class="wk-note">Kein erwachsenes, sattes ' + who + ' der beiden Arten in diesem Becken.</div>'; };
    let s = head('🧬 Kreuzung · ' + esc(A.name) + ' × ' + esc(B.name), '<div class="m-coins"><span title="Münzen">' + coin() + ' <b>' + fmt(AA.state.coins) + '</b></span></div>') + modeRow(null, X.hid);
    s += '<div class="planner xp"><div class="p-col"><div class="p-h">♂ Vater wählen</div>' + (st.males.slice().sort(byG).map(function (f) { return xRow(f, a === f, 'x-m', !!(b && b.sp === f.sp)); }).join('') || none('♂')) + '</div>' +
      '<div class="p-col"><div class="p-h">♀ Mutter wählen</div>' + (st.females.slice().sort(byG).map(function (f) { return xRow(f, b === f, 'x-f', !!(a && a.sp === f.sp)); }).join('') || none('♀')) + '</div><div class="p-fc">';
    s += '<div class="x-kid"><div class="x-pic"><img' + (known ? '' : ' class="sil"') + ' src="' + AA.assets.src('fish/' + X.hid + '_m') + '" alt=""></div><div class="x-txt"><b>' + (known ? esc(def.name) : '??? – noch nie gezüchtet') + '</b>' +
      '<small>' + (known ? esc(def.info) : 'Ein Hybrid aus ' + esc(A.name) + ' und ' + esc(B.name) + '. Wie er aussieht, zeigt sich erst, wenn er schlüpft.') + '</small>' +
      '<small>Erwachsen <b>' + fmt(def.sell) + '</b> Münzen wert · wächst ' + AA.fmtDur(real(def.grow)) + ' · ' + AA.WATER[AA.waterOf(def)].ico + ' ' + AA.WATER[AA.waterOf(def)].name + ' · unfruchtbar</small></div></div>';
    if (a && b && a.sp !== b.sp) {
      const F = AA.crossForecast(a, b, X.hid);
      s += '<div class="p-h">Prognose für das Ei</div><div class="fc-cls">' + AA.CLASSES.slice().reverse().map(function (c) {
        const p = F.cls[c.id] || 0;
        return '<div class="fc-row' + (p < 0.0005 ? ' zero' : '') + '"><b class="cls" style="--cc:' + c.col + '">' + c.id + '</b><span class="fc-bar"><i style="width:' + Math.round(p * 100) + '%;background:' + c.col + '"></i></span><span class="fc-p">' + pc(p) + '</span></div>';
      }).join('') + '</div>';
      s += '<div class="fc-genes">' + ['c', 's', 'v'].map(function (k) { return '<span title="' + AA.GENE_NAMES[k][0] + '">' + AA.GENE_NAMES[k][1] + ' ⌀ ' + F.genes[k].mean.toFixed(1).replace('.', ',') + ' <small>(bis ' + F.genes[k].max + ')</small></span>'; }).join('') + '</div>';
      const vs = F.vars.filter(function (x) { return x.p >= 0.001; });
      s += '<div class="p-h">Farbvariante</div><div class="fc-vars">' + vs.map(function (x) { return '<span class="fc-v">' + UI.varChip(x.v, true) + ' ' + pc(x.p) + '</span>'; }).join('') + '<span class="fc-v plain">normale Farbe ' + pc(F.plain) + '</span></div>';
      s += '<div class="wk-note">Jede Kreuzung bringt ein Ei – danach ruhen sich beide Eltern so lange aus, wie das Junge zum Großwerden braucht. Eine Farbvariante vererbt sich nur, wenn beide Eltern dieselbe tragen. Hybride sind unfruchtbar – jeder muss neu gekreuzt werden.</div>' +
        (st.ok ? '<button class="btn violet big" data-act="x-go">🧬 Kreuzen · ' + fmt(st.cost) + ' ' + coin() + '</button>' : '<button class="btn big" disabled>' + xShort(st) + '</button><div class="wk-note">' + xWhy(st) + '</div>');
    } else s += '<div class="wk-note">Wähle ein ♂ der einen und ein ♀ der anderen Art – dann siehst du hier, was aus dem Ei wird. ' + (st.ok ? '' : xWhy(st)) + '</div>';
    return s + '</div></div>';
  }
  function reCross() { const l = $('#modal .planner'), sc = l ? l.scrollTop : 0; UI.open('planner', crossHtml(), 'store planner-m'); const l2 = $('#modal .planner'); if (l2) l2.scrollTop = sc; }
  UI.openCross = function (hid, d) {
    const t = AA.tank(), st = AA.crossStatus(hid, t);
    AA.assets.want('fish/' + hid + '_m');
    UI.cross = { hid: hid, a: null, b: null };
    const best = function (list, notSp) { let o = null, sc = -1; list.forEach(function (x) { if (x.sp === notSp) return; const g = AA.geneSum(x); if (g > sc) { sc = g; o = x; } }); return o; };
    if (d && st.males.indexOf(d) >= 0) { UI.cross.a = d.id; const o = best(st.females, d.sp); if (o) UI.cross.b = o.id; }
    else if (d && st.females.indexOf(d) >= 0) { UI.cross.b = d.id; const o = best(st.males, d.sp); if (o) UI.cross.a = o.id; }
    else {                                             // bestes gemischtes Paar
      let bp = null, sc = -1;
      st.males.forEach(function (m) { st.females.forEach(function (f) { if (m.sp === f.sp) return; const g = AA.geneSum(m) + AA.geneSum(f); if (g > sc) { sc = g; bp = [m, f]; } }); });
      if (bp) { UI.cross.a = bp[0].id; UI.cross.b = bp[1].id; }
    }
    UI.open('planner', crossHtml(), 'store planner-m');
    return true;
  };
  function crossGo() {
    const X = UI.cross; if (!X) return;
    const t = AA.tank(), a = t.fish.find(function (x) { return x.id === X.a; }), b = t.fish.find(function (x) { return x.id === X.b; });
    const st = AA.startCross(X.hid, a, b);
    if (st.ok) { UI.close(); UI.toast('🧬 ' + esc(a.name) + ' &amp; ' + esc(b.name) + ' turteln … gleich gibt es ein Hybrid-Ei!', 'love'); AA.save(); }
    else fail(xWhy(st));
    UI.updateCard();
  }
  /* Karte: Reinzucht geht nicht, aber eine Kreuzung wäre drin -> Kreuzungs-Planer (auch wenn gerade Pause ist: dort steht, warum) */
  function crossFor(d, t) {
    if (!d.adult) return null;
    const xs = AA.crossesFor(d.sp).map(function (h) { return AA.crossStatus(h.id, t); }).filter(function (st) { return st.why !== 'parents' && st.why !== 'level'; });
    return xs.length ? (xs.find(function (st) { return st.ok; }) || xs[0]) : null;
  }
  UI.lifeBreed = function (d) { const st = crossFor(d, AA.tank()); if (!st) return false; UI.openCross(st.h.id, d); return true; };
  /* Büro → Zucht: alle fünf Kreuzungen und was ihnen noch fehlt */
  UI.lifeZucht = function () {
    const t = AA.tank();
    const rows = AA.HYBRIDS.map(function (h) {
      const st = AA.crossStatus(h.id, t), known = AA.bookHas(h.id), w = AA.WATER[AA.waterOf(st.def)];
      let act;
      if (st.why === 'level') act = '<button class="btn" disabled>🔒 Ab Level ' + st.def.lvl + '</button>';
      else if (st.why === 'parents') act = '<small class="o-fine">Beide Arten müssen im selben Becken leben</small>';
      else act = '<button class="btn ' + (st.ok ? 'violet' : 'blue') + '" data-act="x-open" data-id="' + h.id + '">🧬 ' + (st.ok ? 'Planen' : 'Ansehen') + '</button>' + (st.ok ? '' : '<small class="o-fine">' + xShort(st) + '</small>');
      return '<div class="quest order' + (st.ok ? ' ready' : '') + '"><div class="o-pic"><img' + (known ? '' : ' class="sil"') + ' src="' + AA.assets.src('fish/' + h.id + '_m') + '" alt=""></div><div class="q-main">' +
        '<div class="q-title">' + (known ? esc(st.def.name) : '???') + ' <small class="o-kind">Hybrid</small></div><div class="q-desc">' + esc(sp(h.a).name) + ' × ' + esc(sp(h.b).name) + ' · ' + w.ico + ' ' + w.name + ' · erwachsen ' + fmt(st.def.sell) + ' Münzen wert</div></div>' +
        '<div class="q-act">' + act + '</div></div>';
    }).join('');
    return '<div class="sec">🧬 Kreuzungen – Hybride gibt es nur so</div>' + rows +
      '<div class="wk-note">Ein ♂ der einen und ein ♀ der anderen Art, beide erwachsen und satt, im selben Becken. Die Kreuzung kostet das ' + String(AA.CROSS.cost).replace('.', ',') + '-Fache beider Paarungs-Gebühren, bringt immer ein Ei, ' +
      'danach ruhen sich beide Eltern so lange aus, wie das Junge zum Großwerden braucht. Hybride sind mehr wert als beide Eltern zusammen, aber unfruchtbar.</div>';
  };
  UI.lifeZuchtSig = function () { const t = AA.tank(); return AA.HYBRIDS.map(function (h) { const st = AA.crossStatus(h.id, t); return (st.ok ? 1 : st.why) + (AA.bookHas(h.id) ? 'k' : ''); }).join(','); };

  /* ================= Fisch-Karte ================= */
  UI.cardLife = function (d) {
    const el = $('#c-life'); if (!el) return;
    const def = sp(d.sp), t = AA.tank(), s = AA.state, chips = [];
    const chip = function (txt, title, cls) { chips.push('<span class="lchip' + (cls ? ' ' + cls : '') + '" title="' + title + '">' + txt + '</span>'); };
    if (def.hybrid) chip('🧬 Hybrid', esc(sp(def.hybrid[0]).name) + ' × ' + esc(sp(def.hybrid[1]).name) + ' – nur durch Kreuzen zu bekommen, unfruchtbar', 'hy');
    const sc = AA.schoolState(d, t);
    if (sc) {
      if (sc.school) chip('🐟 Im Schwarm (' + sc.n + ')', 'Schwimmt im Schwarm: zufrieden und wächst ' + pct(AA.SCHOOL.grow) + ' % schneller.', 'ok');
      else if (sc.lonely) chip('😢 Einsam (' + sc.n + ' von ' + AA.SCHOOL.lonely + ')', 'Schwarmfisch mit zu wenig Artgenossen: unglücklich und wächst ' + Math.round((1 - AA.SCHOOL.lonelyGrow) * 100) + ' % langsamer. Ab ' + AA.SCHOOL.lonely + ' ist er zufrieden, ab ' + AA.SCHOOL.min + ' schwimmen sie im Schwarm.', 'bad');
      else chip('🐟 Schwarmfisch (' + sc.n + ' von ' + AA.SCHOOL.min + ')', 'Ab ' + AA.SCHOOL.min + ' Artgenossen im Becken schwimmen sie sichtbar im Schwarm und wachsen ' + pct(AA.SCHOOL.grow) + ' % schneller.');
    }
    if (d.sp === 'clown') {
      const n = AA.hostCount(t);
      chip(n ? '🏠 Wohnt in der Anemone' : '🏠 Sucht eine Anemone', n ? 'Bleibt bei seiner Anemone, verteidigt sie und legt seine Eier daneben. Nach der Balz ist er hier ein Viertel schneller wieder bereit.' : 'Mit einer Anemone (Shop → Deko) hat er ein Zuhause: nach der Balz ein Viertel schneller wieder bereit, die Eier liegen geschützt daneben.', n ? 'ok' : '');
    }
    if (def.hab === 'lurk') chip('🕳️ Höhlenbewohner', 'Wohnt in einem Versteck (Deko mit 🏠) und schaut nur mit dem Kopf heraus. Kommt zum Fressen und nachts hervor.');
    else if (def.hab === 'bottom') chip('⬇️ Grundfisch', 'Bleibt am Boden, ruht und wühlt im Kies und wartet, bis das Futter zu ihm sinkt.');
    if (AA.RIG && AA.RIG[d.sp + '_m'] && AA.RIG[d.sp + '_m'].kind === 'up') chip('🌿 Klammerer', 'Hält sich gern mit dem Schwanz an Pflanzen fest.');
    if (d.colorN > 0) chip('🌈 ' + d.colorN + (d.colorN === 1 ? ' Ei' : ' Eier'), 'Farbfutter wirkt: doppeltes Glück auf Farbvarianten bei den nächsten ' + (d.colorN === 1 ? 'Ei' : d.colorN + ' Eiern') + ' dieses Fisches.', 'ok');
    if (d.turboT > s.clock) chip('⚡ ' + AA.fmtShort(real(d.turboT - s.clock)), 'Turbofutter wirkt: wächst ' + pct(AA.FOOD2.turbo.grow) + ' % schneller.', 'ok');
    if (AA.setComplete(d.sp)) chip('👑 Set +' + pct(AA.SETBONUS) + ' %', 'Alle Farbvarianten dieser Art stehen im Sammelbuch: Jeder ' + esc(def.name) + ' ist ' + pct(AA.SETBONUS) + ' % mehr wert.', 'ok');
    if (UI.wildChips) UI.wildChips(d, def, t, chip);      // Saugwels, Rückenschwimmer, Putzerfisch … (js/wildui.js)
    const html = chips.join('');
    if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; el.classList.toggle('hidden', !html); }
    const bb = $('#c-breed'); if (!bb) return;
    if (def.hybrid) { bb.disabled = true; bb.textContent = '🧬 Unfruchtbar'; return; }
    if (d.adult && !AA.fishMateStatus(d, t).ok) {      // Reinzucht geht nicht – aber vielleicht eine Kreuzung
      const st = crossFor(d, t);
      if (st) { bb.disabled = false; bb.textContent = st.ok ? '🧬 Kreuzen · ' + fmt(st.cost) : '🧬 Kreuzen …'; const hn = $('#c-hint'); if (hn && !d.sick) hn.textContent = 'Mit ' + sp(st.h.a === d.sp ? st.h.b : st.h.a).name + ' kreuzen: Daraus schlüpft sicher ein Hybrid.'; }
    }
  };

  /* ================= Sammelbuch: Titel und Sets ================= */
  UI.lifeTitles = function () {
    const s = AA.state;
    const rows = AA.TITLES.map(function (T) {
      const p = AA.titleProgress(T), got = !!s.titles[T.id], on = s.title === T.id, q = p.total ? Math.round(p.have / p.total * 100) : 0;
      return '<div class="quest title' + (got ? ' ready' : '') + (on ? ' worn' : '') + '"><div class="q-ico">' + T.ico + '</div><div class="q-main"><div class="q-title">' + esc(T.name) + (on ? ' <small class="o-kind">dein Titel</small>' : '') + '</div>' +
        '<div class="q-desc">' + esc(T.info) + '</div><div class="bar q"><i style="width:' + q + '%"></i><span>' + p.have + ' / ' + p.total + '</span></div></div>' +
        '<div class="q-act">' + (got ? (on ? '<button class="btn" disabled>✓ Getragen</button>' : '<button class="btn green" data-act="titlesel" data-id="' + T.id + '">Tragen</button>') : '<span class="prog">+' + T.pearls + ' ' + PEARL + '</span>') + '</div></div>';
    }).join('');
    const n = AA.setsDone();
    return '<div class="sec">🏅 Titel gibt es für komplette Gruppen im Sammelbuch – jeder bringt Perlen, und einen davon trägst du neben deinem Level.</div>' + rows +
      '<div class="wk-note">👑 <b>Sets:</b> Hast du alle Farbvarianten einer Art entdeckt, ist jeder Fisch dieser Art dauerhaft ' + pct(AA.SETBONUS) + ' % mehr wert. Komplette Sets bisher: <b>' + n + '</b>.</div>';
  };
  UI.lifeBookInfo = function (id) {
    const b = AA.state.book[id]; if (!b) return '';
    const vs = AA.variantsOf(id), have = vs.filter(function (v) { return b.v[v.id]; }).length, def = sp(id);
    const life = def.school ? '🐟 <b>Schwarmfisch:</b> ab ' + AA.SCHOOL.min + ' Tieren im Becken schwimmen sie im Schwarm und wachsen ' + pct(AA.SCHOOL.grow) + ' % schneller; unter ' + AA.SCHOOL.lonely + ' sind sie einsam.' :
      (def.hab === 'lurk' ? '🕳️ <b>Höhlenbewohner:</b> wohnt in einem Versteck und kommt nur kurz heraus.' : (def.hab === 'bottom' ? '⬇️ <b>Grundfisch:</b> bleibt am Boden und wartet, bis Futter herabsinkt.' : (id === 'clown' ? '🏠 <b>Anemonenfisch:</b> wohnt in der Anemone – dort klappt die Balz öfter.' : '')));
    return (life ? '<div class="setline life">' + life + '</div>' : '') + '<div class="setline' + (have === vs.length ? ' done' : '') + '">👑 ' + (have === vs.length ? '<b>Set komplett:</b> jeder ' + esc(sp(id).name) + ' ist ' + pct(AA.SETBONUS) + ' % mehr wert.' :
      'Set: ' + have + ' von ' + vs.length + ' Farbvarianten – komplett gibt es dauerhaft +' + pct(AA.SETBONUS) + ' % Wert für diese Art.') + '</div>';
  };

  /* ================= Futter-Leiste und „Alle füttern“ ================= */
  function foodKinds() {
    const s = AA.state, out = [{ k: 'normal', name: 'Flocken', n: s.food, lvl: 1, info: 'Normales Futter: eine Prise pro Klick.' }];
    AA.FOOD.forEach(function (f) { if (f.kind) out.push({ k: f.kind, ico: f.ico, name: AA.FOOD2[f.kind].name, n: s.food2[f.kind] | 0, lvl: f.lvl, info: f.info }); });
    return out;
  }
  function onBar(e) {
    const b = e.target.closest('[data-kind]'); if (!b) return;
    const k = b.dataset.kind;
    AA.audio.unlock(); AA.audio.play('click');
    if (k === 'all') { UI.feedAll(); return; }
    if (k !== 'normal' && (AA.state.food2[k] | 0) <= 0) { UI.toast(AA.FOOD2[k].ico + ' Kein ' + AA.FOOD2[k].name + ' im Vorrat – gibt es im Shop unter Futter.'); UI.openStore('food'); return; }
    V.foodKind = k === 'normal' ? null : k;
    UI.lifeFoodBar();
  }
  UI.lifeFoodBar = function () {
    let el = $('#foodbar');
    if (!el) { el = document.createElement('div'); el.id = 'foodbar'; el.className = 'panel hidden'; $('#stage').appendChild(el); el.addEventListener('click', onBar); }
    const on = V.tool === 'food' && !UI.modalKind && !!AA.state;
    el.classList.toggle('hidden', !on);
    if (!on) return;
    const s = AA.state, list = foodKinds().filter(function (k) { return k.k === 'normal' || s.level >= k.lvl || k.n > 0; });
    if (V.foodKind && !(s.food2[V.foodKind] > 0)) V.foodKind = null;        // Sorte aufgebraucht: zurück zu den Flocken
    const cur = V.foodKind || 'normal', P = AA.feedAllPlan();
    const html = list.map(function (k) {
      return '<button class="fk' + (cur === k.k ? ' on' : '') + (k.n <= 0 ? ' zero' : '') + '" data-kind="' + k.k + '" title="' + esc(k.name) + ': ' + esc(k.info) + '">' + (k.ico ? '<span>' + k.ico + '</span>' : '<img src="' + AA.assets.src('prop/foodcan') + '" alt="">') +
        '<small>' + esc(k.name) + '</small><i>' + (k.n > 999 ? '999+' : k.n) + '</i></button>';
    }).join('') + '<button class="fk all" data-kind="all" title="Füttert alle Becken auf einmal (Taste H): Jedes bekommt so viele Prisen Flocken, wie seine Fische brauchen."' + (P.need ? '' : ' disabled') + '><span>🍽️</span><small>Alle füttern</small>' + (P.need ? '<i>' + (P.need > 999 ? '999+' : P.need) + '</i>' : '') + '</button>';
    if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
  };
  UI.feedAll = function () {
    const r = AA.feedAll();
    if (r === 'sated') { UI.toast('😊 Alle satt – in keinem Becken hat jemand Hunger.'); return r; }
    if (r === 'nofood') { UI.toast('🥫 Futter ist alle. Nachschub: Shop → Futter, Training oder das Tagesgeschenk 🎁.', 'warn'); AA.audio.play('error'); return r; }
    AA.audio.play('sprinkle'); AA.audio.play('bubbles', { n: 4, vol: 0.06 });
    UI.toast('🍽️ <b>Alle gefüttert:</b> ' + r.used + (r.used === 1 ? ' Prise' : ' Prisen') + ' für ' + r.fish + (r.fish === 1 ? ' Fisch' : ' Fische') + ' in ' + r.tanks + ' Becken' + (r.healed ? ' · ' + r.healed + ' wieder gesund' : '') +
      (r.short ? '<br><small>Das Futter hat nicht für alle gereicht – es fehlen ' + (r.need - r.used) + ' Prisen.</small>' : ''), r.short ? 'warn' : 'gold');
    if (!UI.modalKind) V.floatText(AA.W / 2, 240, '🍽️ Mahlzeit!', '#fff3a6');
    AA.save(); UI.refresh();
    if (UI.modalKind === 'tanks') UI.openTanks();
    return r;
  };
  UI.lifeTanksHead = function () {
    const P = AA.feedAllPlan();
    return '<div class="m-coins"><button class="btn green sm" data-act="feedall"' + (P.need ? '' : ' disabled') + ' title="Jedes Becken bekommt so viele Prisen, wie seine Fische brauchen (Taste H)">🍽️ Alle füttern' + (P.need ? ' · ' + P.need + ' 🥫' : ' · alle satt') + '</button><small>Vorrat ' + fmt(AA.state.food) + '</small></div>';
  };

  /* ================= Putzkolonne ================= */
  UI.lifeCrewTop = function (t) {
    const C = AA.crewInfo(t), J = AA.JOBS, K = AA.CREW;
    const part = function (k) { return '<span class="lchip' + (C.jobs[k] ? ' ok' : '') + '" title="' + J[k].name + '">' + J[k].ico + ' ' + J[k].name + ' ' + C.jobs[k] + '</span>'; };
    return '<br><b>🧹 Putzkolonne:</b> ' + ['algae', 'glass', 'food', 'doctor'].map(part).join(' ') + ' – bremst das Veralgen gerade um <b>' + Math.round(C.power * 100) + ' %</b>' + (C.bonus ? ' (davon ' + Math.round(C.bonus * 100) + ' % Team-Bonus)' : '') +
      '. Zwei verschiedene Jobs: +' + Math.round(K.two * 100) + ' %, alle drei (Algen, Scheibe, Reste): +' + Math.round(K.three * 100) + ' % und bis zu ' + Math.round(K.maxFull * 100) + ' % statt ' + Math.round(K.max * 100) + ' %. Scheibenputzer ziehen saubere Spuren durchs Glas' +
      (C.jobs.food ? '' : '; ohne Resteverwerter fault liegen gebliebenes Futter und macht Dreck') + '. Die 🩺 Putzergarnele putzt Fische, die bei ihr vorbeikommen – Kranke werden dabei gesund.';
  };
  UI.lifeTile = function (t) { const p = AA.crewInfo(t).power; return p > 0 ? ' · 🧹 ' + Math.round(p * 100) + ' %' : ''; };

  /* ================= Becken-Vorlagen ================= */
  function tplCost(P) { return ((P.coins ? fmt(P.coins) + ' ' + coin() : '') + (P.pearls ? (P.coins ? ' + ' : '') + P.pearls + ' ' + PEARL : '')) || 'gratis'; }
  UI.lifeLookTop = function () {
    const s = AA.state, t = AA.tank();
    const rows = s.templates.map(function (tp) {
      const P = AA.templatePlan(tp.id, t), w = AA.WALL_BY[tp.wall], f = AA.FLOOR_BY[tp.floor], sh = AA.SHAPE_BY && AA.SHAPE_BY[tp.shape];
      const poor = s.coins < P.coins || (P.pearls > 0 && s.pearls < P.pearls);
      return '<div class="tpl"><div class="tpl-main"><b>' + AA.WATER[tp.water].ico + ' ' + esc(tp.name) + '</b><small>' + esc(w ? w.name : '?') + ' · ' + esc(f ? f.name : '?') + (sh && tp.shape !== 'flat' ? ' · ' + esc(sh.name) : '') + ' · ' + tp.deco.length + ' Deko-Stücke</small>' +
        '<small>' + (P.buy.length ? 'kauft ' + P.buy.length + (P.buy.length === 1 ? ' Stück' : ' Stücke') + ' nach' : 'alles Nötige steht schon im Becken') + (P.skip.length ? ' · ' + P.skip.length + ' passen hier nicht' : '') + '</small></div>' +
        '<div class="tpl-act"><button class="buy ' + (poor ? 'poor' : 'use') + '" data-act="tplask" data-id="' + tp.id + '"' + (poor ? ' disabled' : '') + '>Anwenden · ' + tplCost(P) + '</button><button class="lnk" data-act="tpldel" data-id="' + tp.id + '">löschen</button></div></div>';
    }).join('');
    return '<div class="card wide tplcard"><div class="pic emoji">📋</div><div class="nm">Becken-Vorlagen <small class="tagline">' + s.templates.length + ' von 12</small></div>' +
      '<div class="info">Speichert Kulisse, Boden, Boden-Form und die ganze Deko-Anordnung dieses Beckens. In einem anderen Becken anwenden: Vorhandene Deko rückt an ihren Platz, fehlende wird automatisch nachgekauft.</div>' +
      '<div class="tpl-save"><input id="tpl-name" class="txt" maxlength="24" placeholder="Name der Vorlage" value="' + esc(t.name) + '" spellcheck="false" autocomplete="off"><button class="buy use" data-act="tplsave">💾 Dieses Becken speichern</button></div>' +
      (rows ? '<div class="tpls">' + rows + '</div>' : '') + '</div>';
  };
  const SKIP_WHY = { gone: 'gibt es nicht mehr', level: 'Level zu niedrig', water: 'falsches Wasser', unique: 'Einzelstück' };
  function tplAsk(id) {
    const t = AA.tank(), P = AA.templatePlan(id, t); if (!P) return;
    const tp = P.tpl, w = AA.WALL_BY[tp.wall], f = AA.FLOOR_BY[tp.floor], sh = AA.SHAPE_BY && AA.SHAPE_BY[tp.shape], li = [];
    li.push('🎨 Kulisse <b>' + esc(w ? w.name : '?') + '</b>' + (P.wallBuy ? ' (kostet ' + P.wallBuy + ' Perlen)' : '') + ', Boden <b>' + esc(f ? f.name : '?') + '</b>' + (P.floorOk ? '' : ' (erst ab Level ' + (f ? f.lvl : '?') + ' – der Boden bleibt, wie er ist)') + (sh ? ', Form <b>' + esc(sh.name) + '</b>' : ''));
    li.push('🪸 ' + tp.deco.length + ' Deko-Plätze: ' + (tp.deco.length - P.buy.length - P.skip.length) + ' aus diesem Becken, <b>' + P.buy.length + ' neu gekauft</b>' + (P.coins ? ' für ' + fmt(P.coins) + ' Münzen' : ''));
    if (P.skip.length) li.push('⚠️ ' + P.skip.length + (P.skip.length === 1 ? ' Stück lässt' : ' Stücke lassen') + ' sich hier nicht aufstellen: ' + P.skip.slice(0, 4).map(function (x) { return esc(x.d ? x.d.name : x.x.type) + ' (' + SKIP_WHY[x.why] + ')'; }).join(', ') + (P.skip.length > 4 ? ' …' : ''));
    li.push('Deko, die nicht zur Vorlage gehört, bleibt stehen, wo sie ist. Fische und Krabbler ziehen nicht um.');
    UI.open('confirm', head('📋 Vorlage anwenden?') + '<div class="confirm"><p>Vorlage <b>„' + esc(tp.name) + '“</b> auf <b>„' + esc(t.name) + '“</b> anwenden?</p><ul class="tplist">' + li.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' +
      '<div class="row end"><button class="btn grey" data-act="tab" data-id="look">Zurück</button><button class="btn green" data-act="tplyes" data-id="' + id + '">Anwenden · ' + tplCost(P) + '</button></div></div>', 'small');
  }

  /* ================= Einstellungen ================= */
  UI.lifeSetting = function () {                     // Runde 11: nur noch die neuen Klänge – der Schalter Neu/Klassisch ist weg
    const amb = AA.state.settings.amb !== false;
    return '<div class="set"><div><b>Blubbern im Hintergrund</b><small>Alle paar Sekunden steigen leise ein paar Blasen auf.</small></div>' +
      '<div class="row"><button class="seg' + (amb ? ' active' : '') + '" data-act="ambset" data-id="1">An</button><button class="seg' + (!amb ? ' active' : '') + '" data-act="ambset" data-id="0">Aus</button></div></div>';
  };

  /* ================= Klicks ================= */
  UI.lifeClick = function (act, id) {
    const s = AA.state;
    if (act === 'x-open') { UI.openCross(id, null); return true; }
    if (act === 'x-pure') { if (!UI.openPlanner || !UI.openPlanner({ sp: id })) fail('Reinzucht geht gerade nicht.'); return true; }
    if (act === 'x-m' || act === 'x-f') {
      const X = UI.cross; if (!X) return true;
      const t = AA.tank(), me = t.fish.find(function (x) { return x.id === id; }); if (!me) return true;
      X[act === 'x-m' ? 'a' : 'b'] = id;
      const ok = act === 'x-m' ? 'b' : 'a', other = t.fish.find(function (x) { return x.id === X[ok]; });
      if (other && other.sp === me.sp) {               // gleiche Art gewählt: den besten Partner der anderen Art nehmen
        const st = AA.crossStatus(X.hid, t), list = (act === 'x-m' ? st.females : st.males).filter(function (x) { return x.sp !== me.sp; }).sort(function (x, y) { return AA.geneSum(y) - AA.geneSum(x); });
        X[ok] = list.length ? list[0].id : null;
      }
      reCross(); return true;
    }
    if (act === 'x-go') { crossGo(); return true; }
    if (act === 'titlesel') { if (s.titles[id]) { s.title = id; AA.save(); UI.refresh(); UI.openBook(); } return true; }
    if (act === 'feedall') { UI.feedAll(); return true; }
    if (act === 'tplsave') {
      const inp = $('#tpl-name'), r = AA.saveTemplate(inp ? inp.value : '');
      if (r === 'max') fail('Mehr als 12 Vorlagen gehen nicht – lösch erst eine.');
      else { AA.audio.play('buy'); UI.toast('📋 Vorlage <b>„' + esc(r.name) + '“</b> gespeichert (' + r.deco.length + ' Deko-Stücke).', 'gold'); AA.save(); UI.openStore(); }
      return true;
    }
    if (act === 'tpldel') { if (AA.deleteTemplate(id)) { AA.save(); UI.openStore(); } return true; }
    if (act === 'tplask') { tplAsk(id); return true; }
    if (act === 'tplyes') {
      const P = AA.templatePlan(id), r = AA.applyTemplate(id);
      if (typeof r === 'string') { fail(r === 'coins' ? 'Dafür reichen die Münzen nicht.' : (r === 'pearls' ? 'Dafür reichen die Perlen nicht.' : 'Die Vorlage gibt es nicht mehr.')); return true; }
      UI.close(); AA.audio.play('buy'); UI.setTool('hand');
      UI.toast('📋 <b>„' + esc(P.tpl.name) + '“</b> steht: ' + (r.bought ? r.bought + (r.bought === 1 ? ' Stück' : ' Stücke') + ' nachgekauft' : 'nichts nachgekauft') + (r.skipped ? ', ' + r.skipped + ' ausgelassen' : '') + '.', 'gold');
      AA.save(); return true;
    }
    if (act === 'sfxtest') { AA.audio.play('splash'); setTimeout(function () { AA.audio.play('splash', { big: true }); }, 1100); return true; }
    if (act === 'ambset') { s.settings.amb = id === '1'; AA.audio.amb = s.settings.amb; AA.save(); UI.openSettings(); return true; }
    return false;
  };

  /* ================= laufende Anzeige, Meldungen ================= */
  const schoolSeen = {}, toldSchool = {};
  UI.lifeRefresh = function () {
    if (!AA.state) return;
    UI.lifeFoodBar();
    const T = AA.titleOf(), lt = document.querySelector('.lvl-title');
    if (lt) { const tx = T ? T.ico + ' ' + T.name : 'Level'; if (lt.textContent !== tx) { lt.textContent = tx; lt.title = T ? 'Dein Titel: ' + T.info + ' (Sammelbuch → Titel)' : ''; } }
    if (!live() || UI.modalKind) return;
    const t = AA.tank(), c = AA.schoolCounts(t);       // ein Schwarm hat sich gebildet?
    for (const k in c) {
      const key = t.id + ':' + k, st = c[k] >= AA.SCHOOL.min ? 2 : (c[k] < AA.SCHOOL.lonely ? 0 : 1), was = schoolSeen[key];
      if (was !== undefined && st === 2 && was < 2) { UI.toast('🐟 <b>' + esc(sp(k).name) + '-Schwarm!</b> Ab ' + AA.SCHOOL.min + ' Tieren schwimmen sie zusammen – zufrieden und ' + pct(AA.SCHOOL.grow) + ' % schneller im Wachstum.', 'gold'); AA.audio.play('sparkle'); }
      schoolSeen[key] = st;
    }
  };
  UI.lifeInit = function () {
    UI.lifeFoodBar();
    AA.on('title', function (T) { if (!live()) return; UI.toast(T.ico + ' <b>Neuer Titel: ' + esc(T.name) + '!</b> ' + esc(T.info) + '. +' + T.pearls + ' Perlen<br><small>Im Sammelbuch unter „Titel“ wählst du, welchen du trägst.</small>', 'big'); AA.audio.play('win'); UI.refresh(); });
    AA.on('setDone', function (id) { if (!live()) return; UI.toast('👑 <b>Set komplett: ' + esc(sp(id).name) + '</b> – alle Farbvarianten entdeckt. Jeder ' + esc(sp(id).name) + ' ist ab jetzt ' + pct(AA.SETBONUS) + ' % mehr wert.', 'big'); AA.audio.play('chest'); });
    AA.on('cleaned', function (f, healed, by) { if (live() && healed && AA.tankOf(f) === AA.tank()) UI.toast('🩺 ' + (by ? esc(by) : 'Die Putzergarnele') + ' hat <b>' + esc(f.name) + '</b> gesund geputzt.', 'gold'); });
    AA.on('fishAdded', function (f) {                  // Schwarmfisch gekauft: einmal je Art erklären, was er braucht
      const def = sp(f.sp); if (!live() || !def.school || toldSchool[f.sp]) return;
      const st = AA.schoolState(f);
      if (st && !st.school) { toldSchool[f.sp] = 1; setTimeout(function () { UI.toast('🐟 <b>' + esc(def.name) + '</b> ist ein Schwarmfisch: unter ' + AA.SCHOOL.lonely + ' ist er einsam, ab ' + AA.SCHOOL.min + ' schwimmen sie im Schwarm und wachsen ' + pct(AA.SCHOOL.grow) + ' % schneller. Jetzt: ' + st.n + '.'); }, 900); }
    });
    AA.on('hatched', function (baby, egg, t, fresh) {
      if (!live() || !AA.isHybrid(baby.sp) || t !== AA.tank()) return;
      const fv = V.byId[baby.id];
      if (fv) { V.floatText(fv.x, fv.y - 90, '🧬 Hybrid!', '#e2ccff'); for (let i = 0; i < 12; i++) V.twinkle(fv.x + AA.rand(-60, 60), fv.y + AA.rand(-70, 20), '#d9b8ff', AA.rand(10, 18)); }
      if (fresh) AA.audio.play('win');
    });
    AA.on('tankChanged', function () { V.foodKind = V.foodKind && AA.state.food2[V.foodKind] > 0 ? V.foodKind : null; });
  };
})(window.AA);
