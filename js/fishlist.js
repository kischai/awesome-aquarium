/* Awesome Aquarium – Fisch-Übersicht, Schutz „Behalten“, Liefern mit Auswahl, Schilder im Becken (19.11.2026, vor Runde 20c)
   • 🐟 Fisch-Übersicht (Taste I, Knopf 🐟 neben 🗂️, Klick auf „n / m 🐟“): je Becken oder alle, nach Art gruppiert, sortier- und
     filterbar; ein Fisch aufgeklappt zeigt alle Aktionen; Kästchen = Mehrfachauswahl (Verkaufen, Umsetzen, Schützen).
     Rechtsklick auf einen Fisch im Becken öffnet dieselben Aktionen als kleines Menü (UI.fishMenu, js/main.js).
   • 🔒 f.keep – geschützt: Kundenaufträge, Verträge und der Verkäufer nehmen den Fisch nie (AA.orderCandidates / AA.contractCandidates),
     Verkaufen geht erst nach dem Öffnen des Schlosses (AA.sellFish). Automatisch geschützt – einmal je Fisch (f.kp), danach entscheidest du:
     Farbvarianten, Hybride und Klasse S; beim Schlüpfen sofort, alle anderen (Kauf, Geschenk, alte Spielstände) beim nächsten Durchgang.
   • 📦 Liefern im Büro (Kundenaufträge und Lieferverträge): Auswahl statt Automatik, die schwächsten freien Fische sind vorgeschlagen.
   • 🏷️ Schilder über den Fischen (Taste O oder Schalter in der Übersicht): Klasse, ♂/♀, Art, Farbvariante, 🔒. */
(function (AA) {
  const $ = AA.$, esc = AA.esc, fmt = AA.fmt, UI = AA.ui, V = AA.view;
  function head(title, extra) { return '<div class="m-head"><div class="m-title">' + title + '</div>' + (extra || '') + '<button class="x" data-act="close" title="Schließen">✕</button></div>'; }
  function coin() { return '<img class="ic" src="' + AA.assets.src('prop/coin') + '" alt="Münzen">'; }
  function def(f) { return AA.FISH_BY[f.sp] || {}; }
  function S() { return AA.state; }

  /* ================= Schutz ================= */
  AA.isGood = function (f) { return !!(f.v || def(f).hybrid || AA.fishClass(f).id === 'S'); };
  AA.isKept = function (f) { return !!f.keep || (!f.kp && AA.isGood(f)); };            // noch nicht geprüft und wertvoll = geschützt
  AA.autoKeep = function (f) { if (f.kp) return false; f.kp = 1; if (AA.isGood(f)) { f.keep = true; return true; } return false; };
  AA.setKeep = function (f, on) { f.kp = 1; if (on) f.keep = true; else delete f.keep; };
  function sweep() {
    if (AA.visit || !S() || !S().tanks) return 0;
    let n = 0;
    S().tanks.forEach(function (t) { t.fish.forEach(function (f) { if (!f.kp && AA.autoKeep(f)) n++; }); });
    return n;
  }
  function tankOf(f) { const T = S().tanks; for (let i = 0; i < T.length; i++) if (T[i].fish.indexOf(f) >= 0) return i; return -1; }
  function byId(id) {
    const T = S().tanks;
    for (let i = 0; i < T.length; i++) { const f = T[i].fish.find(function (x) { return x.id === id; }); if (f) return { f: f, ti: i, t: T[i] }; }
    return null;
  }
  /* Verkaufen und Umsetzen aus jedem Becken (AA.sellFish / AA.moveFish kennen nur das aktuelle) */
  AA.sellFishAny = function (f) {
    const s = S(), ti = tankOf(f);
    if (ti < 0 || f.keep) return 0;
    if (ti === s.active) return AA.sellFish(f);
    const t = s.tanks[ti];
    AA.unmate(t, f);
    const v = AA.fishValue(f);
    t.fish.splice(t.fish.indexOf(f), 1);
    AA.addCoins(v);
    s.stats.sold++; s.stats.soldCoins += v; if (f.adult) s.stats.soldAdult++;
    AA.bizSold(f, v);
    AA.emit('fishRemoved', f, 'move', v);
    AA.checkMedals();
    return v;
  };
  AA.moveFishAny = function (f, toIdx) {
    const s = S(), from = tankOf(f), to = s.tanks[toIdx];
    if (from < 0 || !to || from === toIdx) return 'unknown';
    if (from === s.active) return AA.moveFish(f, toIdx);
    if (!AA.livesIn(def(f), to)) return AA.whyNot(def(f), to);
    if (AA.count(to) >= AA.cap(to)) return 'full';
    const t = s.tanks[from];
    AA.unmate(t, f);
    t.fish.splice(t.fish.indexOf(f), 1); to.fish.push(f);
    if (toIdx === s.active) V.sync();
    return true;
  };
  /* Warnungen vor dem Verkauf (Fisch-Karte und Übersicht) */
  AA.sellWarnings = function (f) {
    const s = S(), d = def(f), cl = AA.fishClass(f).id, out = [], o = AA.bestOrderFor ? AA.bestOrderFor(f) : null, ti = tankOf(f);
    if (o && o.pay > AA.fishValue(f)) out.push('📦 <b>' + esc(o.name) + '</b> zahlt ' + fmt(o.pay) + ' Münzen – liefern statt verkaufen?');
    if (f.v && AA.VAR_BY[f.v]) out.push('✨ <b>Farbvariante ' + esc(AA.VAR_BY[f.v].name) + '</b> (' + AA.VAR_BY[f.v].rare + ') – vererbt ihre Farbe an ' + Math.round(AA.VAR.inherit1 * 100) + ' % der Eier.');
    if (d.hybrid) out.push('🧬 <b>Hybrid</b> – gibt es nur durch Kreuzen.');
    if (cl === 'S' || cl === 'A') out.push('🏅 <b>Klasse ' + cl + '</b> – ein Zuchttier: Babys erben die Gene.');
    if (f.tricks && f.tricks.length) out.push('🎓 Kann ' + f.tricks.length + (f.tricks.length === 1 ? ' Trick' : ' Tricks') + ' – das Training ist dann weg.');
    if (f.adult) {
      let same = 0, other = 0;
      s.tanks.forEach(function (t) { t.fish.forEach(function (x) { if (x === f || x.sp !== f.sp || !x.adult) return; if (x.sex === f.sex) same++; else other++; }); });
      if (!same && other) out.push('⚠️ Dein einziges erwachsenes <b>' + (f.sex === 'm' ? '♂' : '♀') + '</b> dieser Art – ohne ' + (f.sex === 'm' ? 'ihn' : 'sie') + ' gibt es keine Babys mehr.');
    }
    if (ti >= 0 && AA.matingOf(s.tanks[ti], f.id)) out.push('💞 Balzt gerade – das Ei geht verloren.');
    if (f.gift) out.push('🎁 Ein Geschenk von <b>' + esc(f.gift) + '</b>.');
    return out;
  };

  /* ================= Fisch-Übersicht ================= */
  UI.fl = { tank: null, sort: 'sp', filt: 'all', sel: {}, open: null, move: null };
  const SORTS = [['sp', 'Art'], ['val', 'Wert'], ['cls', 'Klasse'], ['age', 'Alter'], ['name', 'Name']];
  const FILTS = [['all', 'Alle'], ['adult', 'Erwachsen'], ['baby', '🍼 Babys'], ['var', '✨ Varianten'], ['hyb', '🧬 Hybride'], ['keep', '🔒 Geschützt'], ['order', '📦 Gefragt'], ['care', '🍽️ Pflege']];
  function pass(f, k) {
    switch (k) {
      case 'adult': return f.adult;
      case 'baby': return !f.adult;
      case 'var': return !!f.v;
      case 'hyb': return !!def(f).hybrid;
      case 'keep': return !!f.keep;
      case 'order': return !!(AA.bestOrderFor && AA.bestOrderFor(f));
      case 'care': return f.sick || f.hunger < 0.25;
      default: return true;
    }
  }
  function list() {
    const s = S(), L = [], which = UI.fl.tank;
    s.tanks.forEach(function (t, i) { if (which !== 'all' && i !== which) return; t.fish.forEach(function (f) { if (pass(f, UI.fl.filt)) L.push({ f: f, ti: i }); }); });
    const C = {
      val: function (a, b) { return AA.fishValue(b.f) - AA.fishValue(a.f); },
      cls: function (a, b) { return AA.geneSum(b.f) - AA.geneSum(a.f) || AA.fishValue(b.f) - AA.fishValue(a.f); },
      age: function (a, b) { return (b.f.adult - a.f.adult) || (b.f.age - a.f.age); },
      name: function (a, b) { return a.f.name.localeCompare(b.f.name, 'de'); },
      sp: function (a, b) { return def(a.f).name.localeCompare(def(b.f).name, 'de') || (b.f.adult - a.f.adult) || (AA.geneSum(b.f) - AA.geneSum(a.f)) || (a.f.sex < b.f.sex ? -1 : 1); }
    };
    return L.sort(C[UI.fl.sort] || C.sp);
  }
  function img(f) { const key = AA.spriteKey(f); return f.v ? AA.assets.variantSrc(key, f.v, 96) : AA.assets.thumb(key, true); }
  function clsB(f) { const c = AA.fishClass(f), g = f.g || { c: 2, s: 2, v: 2 }; return '<b class="cls" style="--cc:' + c.col + '" title="Klasse ' + c.id + ' · Gene ' + g.c + ' / ' + g.s + ' / ' + g.v + '">' + c.id + '</b>'; }
  function phase(f) { return f.adult ? 'erwachsen' : '🍼 ' + Math.round(Math.min(1, f.age / def(f).grow) * 100) + ' %'; }
  function status(f, ti) { const o = []; if (f.sick) o.push('🤒'); else if (f.hunger < 0.25) o.push('🍽️'); if (AA.matingOf(S().tanks[ti], f.id)) o.push('💞'); return o.join(' '); }
  function moveRows(fs) {
    return S().tanks.map(function (tk, i) {
      const fits = fs.filter(function (f) { return tankOf(f) !== i && AA.livesIn(def(f), tk); }).length, ok = fits > 0 && AA.count(tk) < AA.cap(tk);
      return '<button class="btn ' + (ok ? 'blue' : 'grey') + '" data-act="fl-moveto" data-id="' + i + '"' + (ok ? '' : ' disabled') + '>' + AA.tankIco(tk) + ' ' + esc(tk.name) + ' (' + AA.count(tk) + ' / ' + AA.cap(tk) + ')</button>';
    }).join('');
  }
  function actsHtml(f, ti) {
    const keep = !!f.keep, o = AA.bestOrderFor ? AA.bestOrderFor(f) : null, multi = S().tanks.length > 1;
    let h = '<button class="btn blue" data-act="fl-show" data-id="' + f.id + '">👁️ Zeigen</button>' +
      (keep ? '<button class="btn grey" data-act="fl-keep" data-id="' + f.id + '">🔓 Freigeben</button>'
        : '<button class="btn green" data-act="fl-sell" data-id="' + f.id + '">Verkaufen · ' + fmt(AA.fishValue(f)) + '</button>') +
      (o && !keep ? '<button class="btn violet" data-act="fl-deliver" data-id="' + f.id + '" data-o="' + o.id + '">📦 ' + esc(o.name) + ' · ' + fmt(o.pay) + '</button>' : '') +
      (multi ? '<button class="btn grey" data-act="fl-move" data-id="' + f.id + '">⇄ Umsetzen</button>' : '') +
      (f.adult ? '<button class="btn pink" data-act="fl-breed" data-id="' + f.id + '">❤ Paaren</button>' : '') +
      '<button class="btn blue" data-act="fl-train" data-id="' + f.id + '">🎓 Trainieren</button>' +
      '<button class="btn grey" data-act="fl-rename" data-id="' + f.id + '">✏️ Umbenennen</button>' +
      (keep ? '' : '<button class="btn grey" data-act="fl-keep" data-id="' + f.id + '">🔒 Behalten</button>');
    if (UI.fl.move === f.id) h += '<div class="fl-to"><small>Wohin?</small>' + moveRows([f]) + '</div>';
    return h;
  }
  function rowHtml(x) {
    const f = x.f, d = def(f), keep = !!f.keep, sel = !!UI.fl.sel[f.id], open = UI.fl.open === f.id, o = AA.bestOrderFor ? AA.bestOrderFor(f) : null, t = S().tanks[x.ti];
    return '<div class="fl-row' + (keep ? ' kept' : '') + (sel ? ' sel' : '') + (open ? ' open' : '') + '" data-fid="' + f.id + '">' +
      '<button class="fl-ck' + (sel ? ' on' : '') + '" data-act="fl-ck" data-id="' + f.id + '" title="Auswählen">' + (sel ? '✓' : '') + '</button>' +
      '<button class="fl-main" data-act="fl-open" data-id="' + f.id + '">' +
        '<span class="fl-pic"><img src="' + img(f) + '" alt=""' + (d.inv ? ' class="inv"' : '') + '></span>' +
        '<span class="fl-txt"><span class="fl-l1"><b>' + esc(f.name) + '</b> <span class="sex ' + f.sex + '">' + (f.sex === 'm' ? '♂' : '♀') + '</span> <span class="fl-sp">' + esc(d.name) + '</span></span>' +
        '<span class="fl-l2">' + clsB(f) + (f.v ? UI.varChip(f.v, true) : '') + (d.hybrid ? '<i class="fl-tag hy">🧬 Hybrid</i>' : '') + '<i class="fl-tag">' + phase(f) + '</i>' +
          (f.tricks.length ? '<i class="fl-tag">' + '★'.repeat(f.tricks.length) + '</i>' : '') +
          (UI.fl.tank === 'all' ? '<i class="fl-tag tk">' + AA.tankIco(t) + ' ' + esc(t.name) + '</i>' : '') + '<i class="fl-st">' + status(f, x.ti) + '</i></span></span>' +
        '<span class="fl-val"><b>' + fmt(AA.fishValue(f)) + '</b> ' + coin() + (o && !keep ? '<small>📦 ' + fmt(o.pay) + '</small>' : '') + '</span>' +
      '</button>' +
      '<button class="fl-lock' + (keep ? ' on' : '') + '" data-act="fl-keep" data-id="' + f.id + '" title="' + (keep ? 'Geschützt – antippen zum Freigeben' : 'Behalten: vor Verkauf und Lieferung schützen') + '">' + (keep ? '🔒' : '🔓') + '</button>' +
      (open ? '<div class="fl-acts">' + actsHtml(f, x.ti) + '</div>' : '') + '</div>';
  }
  function grpHtml(sp, items) {
    const d = AA.FISH_BY[sp], m = items.filter(function (x) { return x.f.sex === 'm'; }).length, v = items.filter(function (x) { return x.f.v; }).length;
    const all = items.every(function (x) { return UI.fl.sel[x.f.id]; });
    return '<div class="fl-grp"><button class="fl-ck' + (all ? ' on' : '') + '" data-act="fl-ckgrp" data-id="' + sp + '" title="Alle dieser Art auswählen">' + (all ? '✓' : '') + '</button>' +
      '<img src="' + AA.assets.thumb('fish/' + sp + '_m', true) + '" alt=""' + (d.inv ? ' class="inv"' : '') + '><b>' + esc(d.name) + '</b>' +
      '<small>×' + items.length + ' · ' + m + ' ♂ · ' + (items.length - m) + ' ♀' + (v ? ' · ✨ ' + v : '') + (d.hybrid ? ' · 🧬' : '') + '</small></div>';
  }
  function footHtml() {
    const fs = Object.keys(UI.fl.sel).map(byId).filter(Boolean);
    if (!fs.length) return '<div class="fl-foot hint">Tipp: Kästchen links antippen – dann verkaufst, versetzt oder schützt du mehrere Fische auf einmal.</div>';
    const sell = fs.filter(function (x) { return !x.f.keep; }), sum = sell.reduce(function (a, x) { return a + AA.fishValue(x.f); }, 0), kept = fs.length - sell.length;
    return '<div class="fl-foot"><b class="fl-n">' + fs.length + ' ausgewählt</b>' +
      '<button class="btn green" data-act="fl-bsell"' + (sell.length ? '' : ' disabled') + '>Verkaufen' + (kept ? ' (' + sell.length + ')' : '') + ' · ' + fmt(sum) + '</button>' +
      (S().tanks.length > 1 ? '<button class="btn grey" data-act="fl-bmove">⇄ Umsetzen</button>' : '') +
      '<button class="btn grey" data-act="fl-bkeep" data-id="1">🔒 Schützen</button><button class="btn grey" data-act="fl-bkeep" data-id="0">🔓 Freigeben</button>' +
      '<button class="lnk" data-act="fl-none">Auswahl aufheben</button>' +
      (UI.fl.move === '*' ? '<div class="fl-to"><small>Wohin?</small>' + moveRows(fs.map(function (x) { return x.f; })) + '</div>' : '') + '</div>';
  }
  function sig() {
    return UI.fl.tank + '|' + S().tanks.map(function (t) { return t.fish.map(function (f) { return f.id + (f.adult ? 'a' : Math.round(f.age / def(f).grow * 20)) + (f.keep ? 'k' : '') + (f.sick ? 's' : '') + (f.hunger < 0.25 ? 'h' : '') + f.name; }).join(','); }).join('|') + '|' + (S().orders || []).length;
  }
  UI.openFishList = function (o) {
    const s = S(), lab = !!s.settings.labels;
    o = o || {};
    sweep();
    if (o.tank !== undefined) UI.fl.tank = o.tank;
    if (UI.fl.tank === null || (UI.fl.tank !== 'all' && !s.tanks[UI.fl.tank])) UI.fl.tank = s.active;
    if (o.fresh) { UI.fl.sel = {}; UI.fl.move = null; UI.fl.open = null; if (o.tank === undefined) UI.fl.tank = s.active; }
    if (o.focus) { UI.fl.open = o.focus; UI.fl.filt = 'all'; }
    Object.keys(UI.fl.sel).forEach(function (id) { if (!byId(id)) delete UI.fl.sel[id]; });
    const el0 = UI.modalKind === 'flist' ? $('#modal .fl-list') : null, sc = el0 ? el0.scrollTop : 0;
    const L = list(), all = s.tanks.reduce(function (a, t) { return a + t.fish.length; }, 0);
    const tabs = s.tanks.length > 1 ? '<div class="fl-tanks">' + s.tanks.map(function (t, i) {
      return '<button class="seg' + (UI.fl.tank === i ? ' active' : '') + '" data-act="fl-tank" data-id="' + i + '">' + AA.tankIco(t) + ' ' + esc(t.name) + ' <small>' + t.fish.length + '</small></button>';
    }).join('') + '<button class="seg' + (UI.fl.tank === 'all' ? ' active' : '') + '" data-act="fl-tank" data-id="all">Alle <small>' + all + '</small></button></div>' : '';
    const tools = '<div class="fl-tools"><label class="fl-sort">Sortieren <select id="fl-sort">' + SORTS.map(function (x) { return '<option value="' + x[0] + '"' + (UI.fl.sort === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
      '<div class="fl-filt">' + FILTS.map(function (x) { return '<button class="fl-chip' + (UI.fl.filt === x[0] ? ' on' : '') + '" data-act="fl-filt" data-id="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div></div>';
    let body = '';
    if (!L.length) body = '<div class="fl-empty">' + (UI.fl.filt === 'all' ? '🐟 Hier schwimmt noch kein Fisch.' : 'Kein Fisch passt zu diesem Filter.') + '</div>';
    else if (UI.fl.sort === 'sp') {
      let i = 0;
      while (i < L.length) { const sp = L[i].f.sp, g = []; while (i < L.length && L[i].f.sp === sp) g.push(L[i++]); body += grpHtml(sp, g) + g.map(rowHtml).join(''); }
    } else body = L.map(rowHtml).join('');
    UI.open('flist', head('🐟 Fische', '<button class="fl-lab' + (lab ? ' on' : '') + '" data-act="fl-labels" title="Schilder über den Fischen im Becken (Taste O)">🏷️ Schilder ' + (lab ? 'an' : 'aus') + '</button>') +
      tabs + tools + '<div class="fl-list">' + body + '</div>' + footHtml(), 'store flist-m');
    const el = $('#modal .fl-list');
    if (el) {
      el.scrollTop = sc;
      if (o.focus) { const r = el.querySelector('.fl-row.open'); if (r) r.scrollIntoView({ block: 'center' }); }
    }
    UI._flSig = sig();
  };
  function rerender() { if (UI.modalKind === 'flist') UI.openFishList(); }
  function showFish(x, then) {
    UI.close();
    if (x.ti !== S().active) AA.switchTank(x.ti);
    setTimeout(function () {
      const fv = V.byId[x.f.id];
      if (!fv) return;
      UI.setTool('hand'); V.select(fv); fv.say('👋', 1.2);
      if (then) setTimeout(function () { const b = $('#card ' + then); if (b && !b.disabled) b.click(); }, 80);
    }, 80);
  }
  function sellConfirm(ids) {
    const xs = ids.map(byId).filter(function (x) { return x && !x.f.keep; });
    if (!xs.length) return;
    const sum = xs.reduce(function (a, x) { return a + AA.fishValue(x.f); }, 0), warn = [];
    xs.forEach(function (x) { const w = AA.sellWarnings(x.f); if (w.length) warn.push((xs.length > 1 ? '<b>' + esc(x.f.name) + '</b> (' + esc(def(x.f).name) + '): ' : '') + w.join(xs.length > 1 ? ' · ' : '<br>')); });
    UI.pending = { kind: 'flsell', ids: xs.map(function (x) { return x.f.id; }), back: UI.modalKind === 'flist' };
    const what = xs.length === 1 ? '<b>' + esc(xs[0].f.name) + '</b> (' + esc(def(xs[0].f).name) + ')' : '<b>' + xs.length + ' Fische</b>';
    UI.open('confirm', head('Verkaufen?') + '<div class="confirm"><p>' + what + ' für <b>' + fmt(sum) + ' Münzen</b> verkaufen?</p>' +
      (warn.length ? '<div class="note warn">' + warn.join('<br>') + '</div>' : '') +
      '<div class="row end"><button class="btn grey" data-act="fl-back">Behalten</button><button class="btn green" data-act="fl-sellyes" data-primary>Verkaufen</button></div></div>', 'small');
  }
  function sellNow() {
    const p = UI.pending; UI.pending = null;
    if (!p || p.kind !== 'flsell') return;
    let n = 0, sum = 0;
    p.ids.forEach(function (id) { const x = byId(id); if (!x || x.f.keep) return; const v = AA.sellFishAny(x.f); if (v) { n++; sum += v; delete UI.fl.sel[id]; } });
    if (UI.fl.open && !byId(UI.fl.open)) UI.fl.open = null;
    if (p.back) UI.openFishList(); else UI.close();
    if (n) { AA.audio.play('coin'); UI.toast('🏷️ ' + (n === 1 ? 'Verkauft' : n + ' Fische verkauft') + ': <b>+' + fmt(sum) + '</b> Münzen'); AA.save(); }
  }
  function moveNow(toIdx) {
    const fs = UI.fl.move === '*' ? Object.keys(UI.fl.sel).map(byId).filter(Boolean) : [byId(UI.fl.move)].filter(Boolean), to = S().tanks[toIdx];
    let ok = 0, bad = 0;
    fs.forEach(function (x) { if (x.ti === toIdx) return; const r = AA.moveFishAny(x.f, toIdx); if (r === true) ok++; else bad++; });
    if (UI.fl.move === '*') UI.fl.sel = {};
    UI.fl.move = null;
    rerender();
    if (ok) { AA.audio.play('splash'); AA.save(); }
    UI.toast(ok ? '⇄ ' + (ok === 1 ? 'Ein Fisch' : ok + ' Fische') + ' nach <b>' + esc(to.name) + '</b> umgesetzt' + (bad ? '<br><small>' + bad + ' ' + (bad === 1 ? 'passt' : 'passen') + ' nicht hinein (Platz oder Wasser).</small>' : '') : 'Kein Fisch passt in <b>' + esc(to.name) + '</b> (Platz oder Wasser).', ok ? '' : 'warn');
  }

  /* ================= Liefern mit Auswahl (Büro: Kunden und Verträge) ================= */
  UI.dp = null;
  function pickTarget() {
    const P = UI.dp, s = S();
    if (!P) return null;
    return P.kind === 'order' ? (s.orders || []).find(function (x) { return x.id === P.id; }) : ((s.contracts && s.contracts.act) || []).find(function (x) { return x.id === P.id; });
  }
  function pickCands(o, all) { return UI.dp.kind === 'order' ? AA.orderCandidates(o, all) : AA.contractCandidates(o, all); }
  function openPick(kind, id) {
    UI.dp = { kind: kind, id: id, sel: {} };
    const o = pickTarget();
    if (!o) { UI.dp = null; UI.openOffice(); return; }
    pickCands(o).slice(0, Math.max(0, o.n - o.got)).forEach(function (k) { UI.dp.sel[k.f.id] = 1; });      // Vorschlag: die schwächsten freien
    renderPick();
  }
  function renderPick() {
    const o = pickTarget();
    if (!o) { UI.dp = null; UI.openOffice(); return; }
    const P = UI.dp, need = Math.max(0, o.n - o.got), cands = pickCands(o, true), d = AA.FISH_BY[o.sp];
    Object.keys(P.sel).forEach(function (id) { if (!cands.some(function (k) { return k.f.id === id && !k.f.keep; })) delete P.sel[id]; });
    const n = Object.keys(P.sel).length, full = n >= need;
    const rows = cands.map(function (k) {
      const f = k.f, keep = !!f.keep, on = !!P.sel[f.id], t = S().tanks[k.t], dis = keep || (!on && full);
      return '<div class="fl-row dp' + (keep ? ' kept' : '') + (on ? ' sel' : '') + '">' +
        '<button class="fl-ck' + (on ? ' on' : '') + '" data-act="dp-ck" data-id="' + f.id + '"' + (dis ? ' disabled' : '') + '>' + (on ? '✓' : '') + '</button>' +
        '<button class="fl-main" data-act="dp-ck" data-id="' + f.id + '"' + (dis ? ' disabled' : '') + '>' +
          '<span class="fl-pic"><img src="' + img(f) + '" alt=""' + (d.inv ? ' class="inv"' : '') + '></span>' +
          '<span class="fl-txt"><span class="fl-l1"><b>' + esc(f.name) + '</b> <span class="sex ' + f.sex + '">' + (f.sex === 'm' ? '♂' : '♀') + '</span> <span class="fl-sp">' + AA.tankIco(t) + ' ' + esc(t.name) + '</span></span>' +
          '<span class="fl-l2">' + clsB(f) + (f.v ? UI.varChip(f.v, true) : '') + (f.tricks.length ? '<i class="fl-tag">' + '★'.repeat(f.tricks.length) + '</i>' : '') + '</span></span>' +
          '<span class="fl-val"><small>Markt</small><b>' + fmt(AA.fishValue(f)) + '</b></span>' +
        '</button>' +
        (keep ? '<button class="fl-lock on" data-act="dp-keep" data-id="' + f.id + '" title="Geschützt – antippen zum Freigeben">🔒</button>' : '<span class="fl-lock"></span>') + '</div>';
    }).join('');
    UI.open('dpick', head('📦 ' + esc(o.name) + ' – wer geht?') +
      '<div class="dp-what"><img src="' + AA.assets.thumb('fish/' + o.sp + '_m') + '" alt=""><span><b>' + esc(d.name) + '</b> · noch ' + need + ' · je <b>' + fmt(o.pay) + '</b> ' + coin() + '</span>' +
      '<small>Vorgeschlagen sind die schwächsten. 🔒 geschützte erst freigeben.</small></div>' +
      '<div class="fl-list">' + (rows || '<div class="fl-empty">Kein passender Fisch (erwachsen, gesund, nicht in der Balz).</div>') + '</div>' +
      '<div class="fl-foot"><button class="btn grey" data-act="dp-back">Zurück</button><button class="btn green" data-act="dp-go" data-primary' + (n ? '' : ' disabled') + '>📦 ' + n + ' liefern · +' + fmt(n * o.pay) + '</button></div>', 'store dpick-m');
  }
  function pickGo() {
    const P = UI.dp, o = pickTarget();
    if (!P || !o) { UI.dp = null; UI.openOffice(); return; }
    const name = o.name, sp = AA.FISH_BY[o.sp].name, isO = P.kind === 'order';
    let n = 0, coins = 0, last = null;
    Object.keys(P.sel).some(function (id) {
      const x = byId(id); if (!x || x.f.keep) return false;
      const r = isO ? AA.deliver(P.id, x.f) : AA.contractDeliver(P.id, x.f);
      if (!r || typeof r === 'string') return false;
      n++; coins += r.pay; last = r;
      return !!(r.done || r.weekDone);
    });
    UI.dp = null;
    UI.openOffice();
    if (n) {
      AA.audio.play('coin'); AA.save();
      UI.toast((isO ? '📦 ' : '📜 ') + n + ' × ' + esc(sp) + ' an <b>' + esc(name) + '</b>: +' + fmt(coins) + ' Münzen' +
        (last && last.done ? '<br><small>Auftrag erfüllt ✓' + (last.rep ? ' · Ruf +' + last.rep : '') + '</small>' : '') + (last && last.weekDone ? '<br><small>Diese Woche ist erfüllt ✓</small>' : ''), 'gold');
    }
  }

  /* ================= Klicks ================= */
  UI.flistClick = function (act, id, b) {
    if (act === 'odeliver') { openPick('order', id); return true; }            // Büro: Kundenauftrag → Auswahl statt Automatik
    if (act === 'cdel') { openPick('contract', id); return true; }             // Büro: Liefervertrag → Auswahl
    if (act.indexOf('fl-') !== 0 && act.indexOf('dp-') !== 0) return false;
    if (AA.visit) return true;
    const x = id ? byId(id) : null;
    switch (act) {
      case 'fl-tank': UI.fl.tank = id === 'all' ? 'all' : +id; UI.fl.open = null; UI.fl.move = null; rerender(); break;
      case 'fl-filt': UI.fl.filt = id; UI.fl.open = null; rerender(); break;
      case 'fl-open': UI.fl.open = UI.fl.open === id ? null : id; UI.fl.move = null; rerender(); break;
      case 'fl-ck': if (UI.fl.sel[id]) delete UI.fl.sel[id]; else if (x) UI.fl.sel[id] = 1; if (UI.fl.move === '*') UI.fl.move = null; rerender(); break;
      case 'fl-ckgrp': {
        const g = list().filter(function (y) { return y.f.sp === id; }), all = g.every(function (y) { return UI.fl.sel[y.f.id]; });
        g.forEach(function (y) { if (all) delete UI.fl.sel[y.f.id]; else UI.fl.sel[y.f.id] = 1; });
        rerender(); break;
      }
      case 'fl-none': UI.fl.sel = {}; UI.fl.move = null; rerender(); break;
      case 'fl-keep':
        if (!x) break;
        AA.setKeep(x.f, !x.f.keep); AA.save();
        if (UI.modalKind === 'flist') rerender();
        UI.toast(x.f.keep ? '🔒 <b>' + esc(x.f.name) + '</b> ist geschützt – kein Verkauf, keine Lieferung.' : '🔓 <b>' + esc(x.f.name) + '</b> ist freigegeben.');
        break;
      case 'fl-bkeep': Object.keys(UI.fl.sel).forEach(function (fid) { const y = byId(fid); if (y) AA.setKeep(y.f, id === '1'); }); AA.save(); rerender(); break;
      case 'fl-sell': if (x && !x.f.keep) sellConfirm([id]); break;
      case 'fl-bsell': sellConfirm(Object.keys(UI.fl.sel)); break;
      case 'fl-sellyes': sellNow(); break;
      case 'fl-back': { const p = UI.pending; UI.pending = null; if (p && p.back === false) UI.close(); else UI.openFishList(); break; }
      case 'fl-deliver': {
        if (!x || x.f.keep) break;
        const r = AA.deliver(b.dataset.o, x.f);
        if (UI.fl.open === id) UI.fl.open = null;
        delete UI.fl.sel[id]; rerender();                // erst neu zeichnen, dann die Meldung (UI.open leert die Meldungen)
        if (r && typeof r !== 'string') {
          AA.audio.play('coin'); AA.save();
          UI.toast('📦 <b>' + esc(x.f.name) + '</b> geht an <b>' + esc(r.order.name) + '</b>: +' + fmt(r.pay) + ' Münzen' + (r.done ? '<br><small>Auftrag erfüllt ✓' + (r.rep ? ' · Ruf +' + r.rep : '') + '</small>' : ''), 'gold');
        }
        break;
      }
      case 'fl-move':
        if (!x) break;
        if (UI.modalKind !== 'flist') { UI.fl.sel = {}; UI.fl.move = id; UI.openFishList({ tank: x.ti, focus: id }); break; }      // aus dem Rechtsklick-Menü
        UI.fl.move = UI.fl.move === id ? null : id; rerender(); break;
      case 'fl-bmove': UI.fl.move = UI.fl.move === '*' ? null : '*'; rerender(); break;
      case 'fl-moveto': moveNow(+id); break;
      case 'fl-show': if (x) showFish(x); break;
      case 'fl-breed': if (x) showFish(x, '#c-breed'); break;
      case 'fl-train': if (x) showFish(x, '#c-train'); break;
      case 'fl-rename': if (x) showFish(x, '[data-act="rename"]'); break;
      case 'fl-labels': S().settings.labels = !S().settings.labels; AA.save(); rerender(); break;
      case 'dp-ck': if (UI.dp) { if (UI.dp.sel[id]) delete UI.dp.sel[id]; else if (x && !x.f.keep) UI.dp.sel[id] = 1; renderPick(); } break;
      case 'dp-keep': if (x && UI.dp) { AA.setKeep(x.f, false); AA.save(); const o = pickTarget(); if (o && Object.keys(UI.dp.sel).length < o.n - o.got) UI.dp.sel[id] = 1; renderPick(); } break;
      case 'dp-go': pickGo(); break;
      case 'dp-back': UI.dp = null; UI.openOffice(); break;
    }
    return true;
  };

  /* ================= Rechtsklick-Menü am Fisch ================= */
  function hideMenu() { const m = $('#fmenu'); if (m) m.classList.add('hidden'); document.removeEventListener('pointerdown', outside, true); }
  function outside(e) { const m = $('#fmenu'); if (m && !m.contains(e.target)) hideMenu(); }
  UI.fishMenu = function (fv, cx, cy) {
    if (AA.visit || !fv || !fv.d) return false;
    const x = byId(fv.d.id);
    if (!x) return false;
    let m = $('#fmenu');
    if (!m) {
      m = document.createElement('div'); m.id = 'fmenu'; document.body.appendChild(m);
      m.addEventListener('click', function (e) { const b = e.target.closest('[data-act]'); if (!b) return; hideMenu(); UI.flistClick(b.dataset.act, b.dataset.id, b); });
    }
    const d = def(x.f);
    m.innerHTML = '<div class="fm-head"><b>' + esc(x.f.name) + '</b> <span class="sex ' + x.f.sex + '">' + (x.f.sex === 'm' ? '♂' : '♀') + '</span><small>' + esc(d.name) + '</small>' +
      '<span class="fm-tags">' + clsB(x.f) + (x.f.v ? UI.varChip(x.f.v, true) : '') + (d.hybrid ? '<i class="fl-tag hy">🧬 Hybrid</i>' : '') + (x.f.keep ? '<i class="fl-tag">🔒</i>' : '') + '</span></div>' +
      '<div class="fm-acts">' + actsHtml(x.f, x.ti) + '</div>';
    m.classList.remove('hidden');
    const r = m.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
    m.style.left = Math.max(6, Math.min(cx, W - r.width - 6)) + 'px'; m.style.top = Math.max(6, Math.min(cy, H - r.height - 6)) + 'px';
    setTimeout(function () { document.addEventListener('pointerdown', outside, true); }, 0);
    return true;
  };

  /* ================= Fisch-Karte: Schloss, Verkaufen gesperrt ================= */
  UI.flistCard = function () {
    const f = V.sel, card = $('#card');
    if (!f || !card || card.dataset.kind !== 'fish' || !$('#c-keep')) return;
    const keep = !!f.d.keep, k = $('#c-keep'), sb = $('#c-sell');
    if (k.dataset.on !== String(keep)) { k.dataset.on = String(keep); k.textContent = keep ? '🔒' : '🔓'; k.classList.toggle('on', keep); k.title = keep ? 'Geschützt – antippen zum Freigeben' : 'Behalten: vor Verkauf und Lieferung schützen'; }
    if (sb) { sb.disabled = keep; if (keep) sb.textContent = '🔒 Geschützt'; }
    if (keep) { const r = $('#c-deliver-row'); if (r) r.classList.add('hidden'); const c = $('#c-contract'); if (c) c.classList.add('hidden'); }
  };

  /* ================= Schilder im Becken ================= */
  let FONT = null;
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  AA.drawLabels = function (ctx) {
    if (!S().settings.labels || V.photoMode || !V.fish.length) return;
    if (!FONT) { const ff = getComputedStyle(document.body).fontFamily || 'sans-serif'; FONT = ['800 11px ' + ff, '900 10px ' + ff]; }
    ctx.save(); ctx.textBaseline = 'middle';
    for (let i = 0; i < V.fish.length; i++) {
      const fv = V.fish[i], d = fv.d, df = fv.def;
      if (fv.ghost || !d || fv.y < AA.G.top) continue;
      const cl = AA.fishClass(d), vd = d.v && AA.VAR_BY[d.v], name = df.name.length > 18 ? df.name.slice(0, 17) + '…' : df.name, txt = (d.sex === 'm' ? '♂ ' : '♀ ') + name;
      ctx.font = FONT[0];
      const tw = ctx.measureText(txt).width, w = 20 + tw + (vd ? 12 : 0) + (d.keep ? 16 : 0) + 8, h = fv.size() * fv.ar(), bx = df.snake && fv.sn && fv.sn.box,      // Runde 20c: Seeschlange – Schild über dem wirklichen Körper
        x = Math.round((bx ? (bx[0] + bx[2]) / 2 : fv.x) - w / 2), y = Math.round(bx ? bx[1] - 10 : fv.y - h * 0.5 - 16);
      ctx.globalAlpha = 0.92; ctx.fillStyle = 'rgba(8,38,58,0.66)'; rr(ctx, x, y - 9, w, 18, 9); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = cl.col; ctx.beginPath(); ctx.arc(x + 10, y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = FONT[1]; ctx.fillText(cl.id, x + 10, y + 0.5);
      ctx.textAlign = 'left'; ctx.font = FONT[0]; ctx.fillText(txt, x + 20, y + 0.5);
      let px = x + 20 + tw + 4;
      if (vd) { ctx.fillStyle = vd.col; ctx.beginPath(); ctx.arc(px + 5, y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke(); px += 12; }
      if (d.keep) { ctx.font = '10px sans-serif'; ctx.fillText('🔒', px, y + 0.5); }
    }
    ctx.restore();
  };
  UI.toggleLabels = function () {
    const s = S(); s.settings.labels = !s.settings.labels; AA.save();
    UI.toast(s.settings.labels ? '🏷️ Schilder an – Art, Klasse und Variante über jedem Fisch (Taste O)' : '🏷️ Schilder aus');
    rerender();
  };

  /* ================= Start, Auffrischen ================= */
  let sweepT = 0, told = false;
  UI.flistRefresh = function () {
    const now = Date.now();
    if (now - sweepT > 1500) {                         // neue Fische (Kauf, Geschenk, Freunde) einmal prüfen
      sweepT = now;
      const n = sweep();
      if (n && !told && AA.ready && !AA.quiet && S().keepV) UI.toast('🔒 ' + (n === 1 ? 'Ein besonderer Fisch ist' : n + ' besondere Fische sind') + ' jetzt geschützt (Farbvariante, Hybrid oder Klasse S).');
    }
    if (UI.modalKind === 'flist' && sig() !== UI._flSig) UI.openFishList();
    const c = $('#tank-count'); if (c && !c.dataset.fl) { c.dataset.fl = '1'; c.title = 'Fische in diesem Becken (I)'; }
  };
  UI.flistInit = function () {
    const s = S();
    if (!s.keepV) {                                    // einmalig: alle vorhandenen besonderen Fische schützen
      const n = sweep(); s.keepV = 1;
      if (n) setTimeout(function () { UI.toast('🔒 <b>Neu: Schutz „Behalten“.</b> ' + n + (n === 1 ? ' besonderer Fisch ist' : ' besondere Fische sind') + ' jetzt vor Verkauf und Lieferung geschützt (Farbvarianten, Hybride, Klasse S). Alle Fische siehst du mit 🐟 oder Taste I.', 'big'); }, 2500);
      told = true;
    }
    AA.on('hatched', function (baby) { AA.autoKeep(baby); });
    AA.on('stateLoaded', function () { sweep(); });
    const bt = $('#btn-fish'); if (bt) bt.addEventListener('click', function () { UI.openFishList({ fresh: true }); });
    const lb = $('#tank-count'); if (lb) { lb.style.cursor = 'pointer'; lb.addEventListener('click', function (e) { e.stopPropagation(); UI.openFishList({ fresh: true }); }); }      // nur die Zahl öffnet die Übersicht – der Name daneben benennt das Becken um (js/farmui.js)
    document.addEventListener('change', function (e) { if (e.target && e.target.id === 'fl-sort') { UI.fl.sort = e.target.value; UI.openFishList(); } });
  };
})(window.AA);
