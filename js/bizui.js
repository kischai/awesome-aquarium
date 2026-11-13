'use strict';
/* Awesome Aquarium – Oberfläche für den Zuchtbetrieb (Runde 5): Büro mit Kunden, Markt und Bilanz; Gene und Liefern auf der Fisch-Karte;
   fliegende Münzen. Regeln in js/biz.js. */
(function (AA) {
  const $ = AA.$, esc = AA.esc, fmt = AA.fmt, UI = AA.ui, V = AA.view;
  function real(sec) { return sec / AA.speed(); }
  function head(title, extra) { return '<div class="m-head"><div class="m-title">' + title + '</div>' + (extra || '') + '<button class="x" data-act="close" title="Schließen">✕</button></div>'; }
  function coin() { return '<img class="ic" src="' + AA.assets.src('prop/coin') + '" alt="Münzen">'; }
  function pct(x) { const v = Math.round(x * 100); return (v > 0 ? '+' : (v < 0 ? '−' : '±')) + Math.abs(v) + ' %'; }
  function dur(sec) {                                  // Restzeit kurz: „1 Tag 3 Std“, „5 Std 10 Min“, „42 Sek“
    sec = Math.max(0, sec);
    if (sec >= 86400) { const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600); return d + (d === 1 ? ' Tag' : ' Tage') + (h ? ' ' + h + ' Std' : ''); }
    return AA.fmtDur(sec);
  }
  UI.clsChip = function (f, big) { const c = AA.fishClass(f); return '<b class="cls' + (big ? ' big' : '') + '" style="--cc:' + c.col + '" title="Güteklasse ' + c.id + ' (Summe der Gene ' + AA.geneSum(f) + ' von 15)">' + c.id + '</b>'; };
  UI.genesTxt = function (f) { const g = f.g || {}; return ['c', 's', 'v'].map(function (k) { return '<span title="' + AA.GENE_NAMES[k][0] + '">' + AA.GENE_NAMES[k][1] + (g[k] || '?') + '</span>'; }).join(''); };
  function custOf(o) { return AA.CUSTOMERS.find(function (c) { return c.id === o.c; }); }
  function orderWhat(o) {
    const nm = esc(AA.FISH_BY[o.sp].name);
    return o.n + '× ' + nm + (o.v ? ' in <b>' + esc(AA.VAR_BY[o.v].name) + '</b>' : '') + (o.cls !== 'C' ? ' · ab Klasse <b>' + o.cls + '</b>' : '');
  }

  /* ================= Büro ================= */
  UI.officeTab = 'kunden';
  function repBox() {
    const s = AA.state, R = AA.repLevel(), nx = R.next;
    return '<div class="repbox"><div class="rep-ico">' + R.ico + '</div><div class="rep-main"><div class="rep-name">' + esc(R.name) + '</div>' +
      '<div class="bar rep"><i style="width:' + Math.round(R.frac * 100) + '%"></i><span>' + (nx ? 'Ruf ' + s.rep + ' / ' + nx.at + ' → ' + esc(nx.name) : 'Ruf ' + s.rep + ' · höchste Stufe') + '</span></div>' +
      '<small>Kunden zahlen +' + Math.round(AA.ORDERS.repBonus * 100) + ' % je Stufe (gerade +' + Math.round(AA.ORDERS.repBonus * 100 * R.i) + ' %). 🏨 Hotels ab „' + AA.REP_LEVELS[1].name + '“, 🎩 Sammler ab „' + AA.REP_LEVELS[2].name + '“.</small></div></div>';
  }
  function kundenHtml() {
    const s = AA.state;
    const rows = s.orders.map(function (o) {
      const C = custOf(o), cand = AA.orderCandidates(o), left = o.due - s.clock, hot = left < 86400 * 0.5;
      const key = 'fish/' + o.sp + '_m', src = o.v ? AA.assets.variantSrc(key, o.v, 120) : AA.assets.src(key);
      return '<div class="quest order' + (cand.length ? ' ready' : '') + '"><div class="o-pic"><img src="' + src + '" alt=""></div><div class="q-main">' +
        '<div class="q-title">' + C.ico + ' ' + esc(o.name) + ' <small class="o-kind">' + C.kind + '</small></div>' +
        '<div class="q-desc">möchte ' + orderWhat(o) + ' – erwachsen und gesund</div>' +
        '<div class="o-prog"><div class="bar q"><i style="width:' + Math.round(o.got / o.n * 100) + '%"></i><span>' + o.got + ' / ' + o.n + ' geliefert</span></div>' +
        '<span class="o-due' + (hot ? ' hot' : '') + '" data-due="' + o.due + '">⏳ ' + dur(real(left)) + '</span></div></div>' +
        '<div class="q-act"><div class="o-pay">je <b>' + fmt(o.pay) + '</b> ' + coin() + '</div>' +
        (cand.length ? '<button class="btn green" data-act="odeliver" data-id="' + o.id + '">📦 Liefern' + (cand.length > 1 ? ' (' + cand.length + ' passen)' : '') + '</button>' : '<button class="btn" disabled>Kein passender Fisch</button>') +
        '<button class="lnk" data-act="odecline" data-id="' + o.id + '">Ablehnen (−' + AA.ORDERS.declineRep + ' Ruf)</button></div></div>';
    }).join('');
    const wait = s.orders.length < AA.ORDERS.max && s.orderNext - s.clock < 7 * 86400 ? '<div class="q-bonus">🔔 Nächster Kunde in <b data-due="' + s.orderNext + '">' + dur(real(Math.max(0, s.orderNext - s.clock))) + '</b></div>' : '';
    return repBox() + rows + wait +
      '<div class="wk-note">Geliefert wird aus allen Becken – zuerst der passende Fisch mit den schwächsten Genen, deine besten Zuchttiere bleiben. Kunden zahlen ihren festen Preis, egal wie der Markt steht. ' +
      'Frist verpasst: −' + AA.ORDERS.failRep + ' Ruf (−' + Math.ceil(AA.ORDERS.failRep / 2) + ', wenn schon etwas geliefert war). Komplett beliefert: Ruf ' + AA.CUSTOMERS.map(function (c) { return c.ico + ' +' + c.rep; }).join(' · ') + '.</div>';
  }
  function marktHtml() {
    const s = AA.state, tr = AA.marketTrends();
    let list = AA.FISH.filter(function (f) { return s.book[f.id]; });
    const own = list.length > 0;
    if (!own) list = AA.FISH.filter(function (f) { return f.lvl <= s.level; });
    list = list.map(function (f) { return { f: f, k: AA.marketFactor(f.id), raw: AA.marketFactor(f.id, true), ch: AA.marketChange(f.id), sat: AA.marketSat(f.id) }; }).sort(function (a, b) { return b.k - a.k; });
    const trends = tr.length ? '<div class="trends">' + tr.map(function (t) { const f = AA.FISH_BY[t.sp];
      return '<div class="trend"><img src="' + AA.assets.src('fish/' + t.sp + '_m') + '" alt=""><div><b>' + esc(f.name) + '</b><small>Trend heute: ' + pct(t.mult - 1) + '</small></div></div>'; }).join('') + '</div>' : '';
    const rows = list.map(function (x) {
      const f = x.f, b = Math.round(f.sell * AA.CLASSES[1].mult * x.k), up = x.ch > 0.005, dn = x.ch < -0.005, tr2 = AA.state.market.t[f.id];
      return '<div class="mrow' + (tr2 ? ' hot' : '') + '"><img src="' + AA.assets.src('fish/' + f.id + '_m') + '" alt=""><span class="m-nm">' + esc(f.name) + (tr2 ? ' <i class="tag">📈 Trend</i>' : '') + '</span>' +
        '<span class="m-k"><span class="mbar"><i style="width:' + Math.round(AA.clamp((x.k - 0.3) / 1.7, 0, 1) * 100) + '%"></i></span>' + Math.round(x.k * 100) + ' %</span>' +
        '<span class="m-ch ' + (up ? 'up' : (dn ? 'dn' : '')) + '">' + (up ? '▲ ' : (dn ? '▼ ' : '')) + (up || dn ? pct(x.ch) : '–') + '</span>' +
        '<span class="m-sat">' + (x.sat < 0.98 ? '📉 gesättigt ' + pct(x.sat - 1) : '') + '</span>' +
        '<span class="m-p">' + fmt(b) + ' ' + coin() + '</span></div>';
    }).join('');
    return trends + '<div class="mhead"><span></span><span>Art</span><span>Kurs heute</span><span>seit gestern</span><span>Sättigung</span><span>Erwachsen, Klasse B</span></div>' +
      '<div class="mlist">' + rows + '</div>' +
      '<div class="wk-note">' + (own ? 'Deine Arten (aus dem Sammelbuch), teuerste zuerst.' : 'Alle Arten bis zu deinem Level.') + ' Der Kurs wechselt jeden Spieltag (75–125 %), zwei Arten sind im Trend. ' +
      'Jeder Verkauf einer Art drückt ihren Preis um ein Stück (bis höchstens −60 %); über Nacht erholt er sich zur Hälfte. Verkaufswert = Grundpreis × Güteklasse (C 1 · B 1,25 · A 1,75 · S 2,75) × Farbvariante (×2 bis ×10) × Kurs.</div>';
  }
  function bilanzHtml() {
    const s = AA.state, d0 = AA.ledgerSum(1), d7 = AA.ledgerSum(7), R = AA.repLevel(), st = s.stats;
    const days = []; for (let k = 6; k >= 0; k--) { const L = s.ledger[AA.day() - k] || { i: 0, o: 0 }; days.push({ k: k, p: L.i - L.o, i: L.i, o: L.o }); }
    const mx = Math.max(1, Math.max.apply(null, days.map(function (x) { return Math.abs(x.p); })));
    const bars = days.map(function (x) { const h = Math.round(Math.abs(x.p) / mx * 60);
      return '<div class="bday"><div class="bcol"><i class="' + (x.p < 0 ? 'neg' : '') + '" style="height:' + h + 'px" title="Einnahmen ' + fmt(x.i) + ' · Ausgaben ' + fmt(x.o) + '"></i></div><small>' + (x.k === 0 ? 'heute' : '−' + x.k) + '</small><b>' + (x.p < 0 ? '−' : '') + fmt(Math.abs(x.p)) + '</b></div>'; }).join('');
    const best = Object.keys(d7.sp).map(function (sp) { return { sp: sp, n: d7.sp[sp][0], c: d7.sp[sp][1] }; }).sort(function (a, b) { return b.c - a.c; }).slice(0, 3);
    const col = function (L, t) { return '<div class="pl"><b>' + t + '</b><div><span>Einnahmen</span><b>' + fmt(L.i) + '</b></div><div class="sub"><span>davon Fischverkauf</span><b>' + fmt(L.sales) + '</b></div>' +
      '<div class="sub"><span>davon Kunden</span><b>' + fmt(L.orders) + '</b></div><div><span>Ausgaben</span><b>−' + fmt(L.o) + '</b></div><div class="sum ' + (L.profit < 0 ? 'neg' : '') + '"><span>Gewinn</span><b>' + (L.profit < 0 ? '−' : '') + fmt(Math.abs(L.profit)) + ' ' + coin() + '</b></div></div>'; };
    return '<div class="firm"><div class="f-ico">' + R.ico + '</div><div><small>Firmenstufe</small><b>' + esc(R.name) + '</b></div><div class="f-stock"><small>Lagerwert (alle Fische, heutiger Kurs)</small><b>' + fmt(AA.stockValue()) + ' ' + coin() + '</b></div></div>' +
      '<div class="pls">' + col(d0, 'Heute') + col(d7, 'Letzte 7 Tage') + '<div class="pl chart"><b>Gewinn je Spieltag</b><div class="bars">' + bars + '</div></div></div>' +
      '<div class="pls two"><div class="pl"><b>🏆 Bestseller (7 Tage)</b>' + (best.length ? best.map(function (x, i) { return '<div><span>' + (i + 1) + '. ' + esc(AA.FISH_BY[x.sp].name) + ' (' + x.n + '×)</span><b>' + fmt(x.c) + '</b></div>'; }).join('') : '<div class="sub"><span>Noch nichts verkauft.</span></div>') + '</div>' +
      '<div class="pl"><b>📊 Seit Firmengründung</b><div><span>Kundenaufträge erfüllt</span><b>' + fmt(st.ordersDone) + '</b></div><div><span>Fische an Kunden geliefert</span><b>' + fmt(st.delivered) + '</b></div>' +
      '<div><span>Fische verkauft (gesamt)</span><b>' + fmt(st.sold) + '</b></div><div><span>Klasse S gezüchtet</span><b>' + fmt(st.sBred) + '</b></div><div><span>Aufträge verpasst</span><b>' + fmt(st.ordersFailed) + '</b></div></div></div>';
  }
  function officeHtml() {
    const R = AA.repLevel(), ready = AA.ordersReady();
    const TABS = [['kunden', '📦 Kunden' + (ready ? ' (' + ready + ')' : '')], ['vertrag', '📜 Verträge'], ['zucht', '🧬 Zucht'], ['personal', '👥 Personal'], ['markt', '📈 Markt'], ['bilanz', '📊 Bilanz']];
    const fb = UI.farmHtml ? UI.farmHtml(UI.officeTab) : null;
    const body = fb !== null ? fb : UI.officeTab === 'markt' ? marktHtml() : (UI.officeTab === 'bilanz' ? bilanzHtml() : kundenHtml());
    return head('🏢 Büro', '<div class="m-coins"><span title="Firmenstufe">' + R.ico + ' <b>' + esc(R.name) + '</b></span><span title="Münzen">' + coin() + ' <b>' + fmt(AA.state.coins) + '</b></span></div>') +
      '<div class="tabs">' + TABS.map(function (t) { return '<button class="tab' + (t[0] === UI.officeTab ? ' active' : '') + '" data-act="otab" data-id="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div class="list office o-' + UI.officeTab + '">' + body + '</div>';
  }
  function officeSig() { const s = AA.state; return UI.officeTab + '|' + s.orders.map(function (o) { return o.id + ':' + o.got + ':' + AA.orderCandidates(o).length; }).join(',') + '|' + s.rep + '|' + (s.market && s.market.day) + '|' + s.coins + '|' + s.orders.length + (UI.farmSig ? UI.farmSig() : ''); }
  UI.openOffice = function (tab) {
    if (tab) UI.officeTab = tab;
    const l = $('#modal .list.office'), sc = UI.modalKind === 'office' && l && !tab ? l.scrollTop : 0;
    UI._oSig = officeSig();
    UI.open('office', officeHtml(), 'store office');
    const l2 = $('#modal .list.office'); if (l2) l2.scrollTop = sc;
  };

  /* ================= Fisch-Karte ================= */
  UI.cardBiz = function (d) {
    const g = $('#c-gen'); if (!g) return;
    const sig = (d.g ? d.g.c + '' + d.g.s + d.g.v : '') + (d.v || '');
    if (g.dataset.k !== sig) { g.dataset.k = sig; g.innerHTML = UI.clsChip(d) + '<span class="genes">' + UI.genesTxt(d) + '</span>'; }
    const o = AA.bestOrderFor(d), row = $('#c-deliver-row'), b = $('#c-deliver');
    if (row) { row.classList.toggle('hidden', !o); if (o) { b.textContent = '📦 An ' + o.name + ' · ' + fmt(o.pay); b.dataset.id = o.id; b.title = 'Auftrag: ' + o.n + '× ' + AA.FISH_BY[o.sp].name + ' (' + o.got + ' geliefert)'; } }
    const mf = AA.marketFactor(d.sp), vv = $('#c-val');
    if (vv && Math.abs(mf - 1) > 0.02) vv.innerHTML += ' <small class="' + (mf > 1 ? 'up' : 'dn') + '" title="Tageskurs dieser Art">' + (mf > 1 ? '▲ ' : '▼ ') + pct(mf - 1) + '</small>';
  };
  UI.deliverFish = function (oid, f) {
    const fv = f && V.byId[f.id], pos = fv ? { x: fv.x, y: fv.y } : null;
    const r = AA.deliver(oid, f);
    if (typeof r === 'string') { UI.fail(r === 'nofish' ? 'nofish' : 'unknown'); return null; }
    if (pos) UI.coinFly(pos.x, pos.y, r.pay);
    AA.audio.play('coin');
    UI.toast('📦 ' + esc(r.fish.name) + ' geht an <b>' + esc(r.order.name) + '</b>: +' + fmt(r.pay) + ' Münzen' + (r.done ? '<br><small>Auftrag komplett! Ruf +' + r.rep + '</small>' : ' (' + r.order.got + ' / ' + r.order.n + ')'), r.done ? 'big' : 'gold');
    if (r.done) AA.audio.play('chest');
    AA.save(); UI.refresh();
    return r;
  };

  /* ================= fliegende Münzen ================= */
  UI.coinFly = function (x, y, amount) {
    const st = $('#stage'), tgt = $('#coins'); if (!st || !tgt || AA.quiet) return;
    const sr = st.getBoundingClientRect(), sc = sr.width / AA.W, tr = tgt.parentNode.getBoundingClientRect();
    const tx = (tr.left - sr.left + 26) / sc, ty = (tr.top - sr.top + tr.height / 2) / sc;
    if (V.toStage) { const q = V.toStage(x, y); x = q.x; y = q.y; }      // Welt -> Bühne (das Becken steht verkleinert im Raum)
    const n = Math.min(9, 2 + Math.floor(Math.log2(Math.max(1, amount))));
    for (let i = 0; i < n; i++) {
      const im = document.createElement('img'); im.className = 'flycoin'; im.src = AA.assets.src('prop/coin');
      const sx = x + AA.rand(-26, 26), sy = y + AA.rand(-18, 18);
      im.style.left = sx + 'px'; im.style.top = sy + 'px'; st.appendChild(im);
      const mx = (sx + tx) / 2 + AA.rand(-60, 60), my = Math.min(sy, ty) - AA.rand(40, 120);
      const a = im.animate([{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 }, { transform: 'translate(calc(' + (mx - sx) + 'px - 50%), calc(' + (my - sy) + 'px - 50%)) scale(1.1)', opacity: 1, offset: 0.45 },
        { transform: 'translate(calc(' + (tx - sx) + 'px - 50%), calc(' + (ty - sy) + 'px - 50%)) scale(.7)', opacity: 0.9 }], { duration: 650 + i * 70, delay: i * 45, easing: 'ease-in', fill: 'forwards' });
      a.onfinish = function () { im.remove(); const p = tgt.parentNode; p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); };
    }
  };

  /* ================= Marken, Meldungen ================= */
  let lastReady = -1;
  UI.bizRefresh = function () {
    const s = AA.state; if (!s || !s.orders || !$('#btn-office')) return;
    const ready = AA.ordersReady(), bb = $('#office-badge');
    bb.classList.toggle('hidden', ready === 0 && s.orders.length === 0); bb.classList.toggle('todo', ready === 0); bb.textContent = ready || s.orders.length;
    bb.title = ready ? 'So viele Aufträge kannst du jetzt beliefern' : 'Offene Kundenaufträge';
    $('#btn-office').classList.toggle('ready', ready > 0);
    if (lastReady >= 0 && ready > lastReady && !AA.quiet && AA.ready && !UI.modalKind) { UI.toast('📦 Du hast jetzt einen passenden Fisch für einen Kundenauftrag – ab ins Büro (Taste K).', 'gold'); }
    lastReady = ready;
    if (UI.modalKind === 'office') {
      if (officeSig() !== UI._oSig) UI.openOffice();
      else document.querySelectorAll('#modal [data-due]').forEach(function (el) { const left = +el.dataset.due - s.clock; el.textContent = (el.tagName === 'B' ? '' : '⏳ ') + dur(real(Math.max(0, left))); });
    }
  };
  UI.bizClick = function (act, id, b) {
    if (act === 'office') { UI.openOffice(); return true; }
    if (act === 'otab') { UI.openOffice(id); return true; }
    if (act === 'odeliver') { UI.deliverFish(id); if (UI.modalKind === 'office') UI.openOffice(); return true; }
    if (act === 'odecline') { const o = AA.state.orders.find(function (x) { return x.id === id; }); if (o && AA.declineOrder(id)) { UI.toast('Auftrag von ' + esc(o.name) + ' abgelehnt (−' + AA.ORDERS.declineRep + ' Ruf).'); AA.save(); UI.openOffice(); } return true; }
    return false;
  };
  UI.bizInit = function () {
    $('#btn-office').addEventListener('click', function () { AA.audio.play('click'); UI.openOffice(); });
    AA.on('orderNew', function () { if (!AA.quiet && AA.ready) UI.toast('🔔 Neuer Kundenauftrag im Büro (Taste K).', 'gold'); });
    AA.on('orderFailed', function (o) { if (!AA.quiet && AA.ready) { UI.toast('⌛ Frist verpasst: ' + esc(o.name) + ' ist weg (−' + (o.got ? Math.ceil(AA.ORDERS.failRep / 2) : AA.ORDERS.failRep) + ' Ruf).', 'warn'); AA.audio.play('fail'); } });
    AA.on('repUp', function (R) { if (!AA.quiet && AA.ready) { UI.toast(R.ico + ' <b>Neue Firmenstufe: ' + esc(R.name) + '!</b>' + (R.i === 1 ? '<br><small>Ab jetzt bestellen auch Hotels.</small>' : (R.i === 2 ? '<br><small>Ab jetzt melden sich Sammler – die zahlen für Klasse A/S und Farbvarianten richtig gut.</small>' : '<br><small>Kunden zahlen jetzt ' + Math.round(AA.ORDERS.repBonus * 100 * R.i) + ' % mehr.</small>')), 'big'); AA.audio.play('level'); } });
    AA.on('newDay', function () {
      if (AA.quiet) return;
      const t = AA.marketTrends(); if (t.length) setTimeout(function () { UI.toast('📈 Heute gefragt: ' + t.map(function (x) { return '<b>' + esc(AA.FISH_BY[x.sp].name) + '</b> ' + pct(x.mult - 1); }).join(', '), 'gold'); }, 900);
    });
  };
})(window.AA);
