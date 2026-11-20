'use strict';
/* Awesome Aquarium – Oberfläche für Runde 7: Biotop-Karte und Boden-Formen im Shop (Aussehen), Becken-Übersicht, Bericht „Während du weg warst“,
   (Räuber-Meldungen gibt es seit Runde 11 nicht mehr.) Regeln in js/eco.js. */
(function (AA) {
  const $ = AA.$, esc = AA.esc, fmt = AA.fmt, UI = AA.ui, V = AA.view;
  function head(title, extra) { return '<div class="m-head"><div class="m-title">' + title + '</div>' + (extra || '') + '<button class="x" data-act="close" title="Schließen">✕</button></div>'; }
  function pct(k) { return '+' + Math.round((k - 1) * 100) + ' %'; }
  function names(list, by, n) { return list.slice(0, n).map(function (id) { return esc((by[id] || { name: id }).name); }).join(', ') + (list.length > n ? ' …' : ''); }

  /* ================= Shop → Aussehen: Biotop ================= */
  UI.bioSel = null;
  function bonusTxt(T) { return 'Wachstum ' + pct(T.grow) + ' · Glück auf Farbvarianten ' + pct(T.luck) + ' · Wert der Biotop-Arten ' + pct(T.value); }
  UI.ecoLookTop = function () {
    const t = AA.tank(), best = AA.biotope(t);
    if (!best) return '';
    const all = AA.BIOTOPES.filter(function (b) { return b.water === t.water; });
    const b = all.find(function (x) { return x.id === UI.bioSel; }) || best.b;
    const r = b === best.b ? best : (function () { const keep = AA.BIOTOPES; let out = null; AA.BIOTOPES = [b]; try { out = AA.biotope(t); } finally { AA.BIOTOPES = keep; } return out; })();
    const row = function (ok, txt) { return '<li class="' + (ok ? 'ok' : 'no') + '">' + (ok ? '✅' : '⬜') + ' ' + txt + '</li>'; };
    const T = r.tier, next = AA.BIO.tiers[Math.min(4, Math.max(2, r.pts + 1))];
    return '<div class="card wide bio"><div class="pic emoji">' + b.ico + '</div><div class="nm">Biotop: ' + esc(b.name) + ' <small class="tagline">' + (T ? T.ico + ' ' + T.name + ' – ' + r.pts + ' von 4' : r.pts + ' von 4 – ab 2 gibt es Bonus') + '</small></div>' +
      '<ul class="biolist">' +
      row(r.c.wall, '<b>Kulisse:</b> ' + names(b.walls, AA.WALL_BY, 5)) +
      row(r.c.floor, '<b>Boden:</b> ' + names(b.floors, AA.FLOOR_BY, 5)) +
      row(r.c.deco, '<b>Deko:</b> ' + r.nDeco + ' von ' + AA.BIO.deco + ' verschiedenen passenden Stücken <small>(' + names(b.deco, AA.DECO_BY, 6) + ')</small>') +
      row(r.c.fish, '<b>Bewohner:</b> ' + r.nFit + ' von ' + r.n + ' Fischen passen <small>(mindestens ' + AA.BIO.fish + ' Fische, davon ' + Math.round(AA.BIO.share * 100) + ' % aus: ' + names(b.fish, AA.FISH_BY, 7) + ')</small>') +
      '</ul><div class="info">' + (T ? '<b>Dein Bonus:</b> ' + bonusTxt(T) + '.' : 'Noch kein Bonus.') + (r.pts < 4 ? ' <span class="nx">Nächste Stufe ' + next.ico + ': ' + bonusTxt(next) + '.</span>' : ' Mehr geht nicht – perfektes Biotop!') + '</div>' +
      (all.length > 1 ? '<div class="two">' + all.map(function (x) { return '<button class="seg' + (x === b ? ' active' : '') + '" data-act="biosel" data-id="' + x.id + '">' + x.ico + ' ' + esc(x.name) + '</button>'; }).join('') + '</div>' : '') + '</div>';
  };
  UI.ecoShapes = function () {
    const t = AA.tank(), cur = t.shape || 'flat';
    return '<div class="sec">Boden-Form – wie der Boden aufgeschüttet ist. Gratis, jederzeit wechselbar; Deko, Eier und Krabbler wandern mit</div>' + AA.SHAPES.map(function (sh) {
      return '<div class="card"><div class="pic floor"><img src="' + V.shapeThumb(sh.id) + '" alt=""></div><div class="nm">' + esc(sh.name) + '</div>' +
        (cur === sh.id ? '<button class="buy active" disabled>✓ Aktiv</button>' : '<button class="buy use" data-act="setshape" data-id="' + sh.id + '">Verwenden</button>') + '</div>';
    }).join('');
  };

  /* ================= Becken-Übersicht ================= */
  /* Runde 14: Kachel-Kopf in der Kulissen-Farbe – auf dunklen Kulissen (Tiefsee, Riff bei Nacht, Vulkan …) helle Schrift, sonst war der Name kaum lesbar.
     Entschieden nach WCAG-Kontrast: welche Schrift (dunkelblau oder weiß) hebt sich vom mittleren Ton des Verlaufs besser ab? */
  function lum(hex) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 1;
    const n = parseInt(m[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255].reduce(function (a, v, i) { v /= 255; v = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); return a + v * [0.2126, 0.7152, 0.0722][i]; }, 0);
  }
  AA.wallDark = function (w) { const L = (lum(w.cols[0]) + lum(w.cols[3])) / 2; return 1.05 / (L + 0.05) > (L + 0.05) / 0.08; };
  UI.openTanks = function () {
    const s = AA.state;
    const tiles = s.tanks.map(function (t, i) {
      const st = AA.tankStatus(t), R = t.role && AA.ROLES[t.role], bio = st.bio && st.bio.tier ? st.bio : null, w = AA.WALL_BY[t.wall] || AA.WALLS[0];
      return '<button class="tile lv' + st.level + (i === s.active ? ' here' : '') + (AA.wallDark(w) ? ' dk' : '') + '" data-act="gotank" data-id="' + i + '" style="--w1:' + w.cols[0] + ';--w2:' + w.cols[3] + '">' +
        '<div class="t-top"><span class="t-ico">' + AA.tankIco(t) + '</span><b>' + esc(t.name) + '</b>' + (i === s.active ? '<i class="t-here">hier</i>' : '') + '</div>' +
        '<div class="t-sub">🐟 ' + st.n + ' / ' + st.cap + (st.young ? ' · 🍼 ' + st.young : '') + (R ? ' · ' + R.ico + ' ' + R.name : '') + (bio ? ' · ' + bio.b.ico + bio.tier.ico : '') + (UI.lifeTile ? UI.lifeTile(t) : '') + '</div>' +
        '<div class="t-bars"><span title="satt">🍽️<i class="bar hunger"><i style="width:' + Math.round(st.fed * 100) + '%"></i></i></span><span title="sauber">🫧<i class="bar clean"><i style="width:' + Math.round((1 - st.dirt) * 100) + '%"></i></i></span></div>' +
        '<div class="t-warn">' + (st.warn.length ? st.warn.map(function (x) { return '<span class="w' + x[2] + '">' + x[0] + ' ' + x[1] + '</span>'; }).join('') : '<span class="w0 calm">🌊 Alles ruhig</span>') + '</div></button>';
    }).join('');
    UI.open('tanks', head('🗂️ Alle Becken', UI.lifeTanksHead ? UI.lifeTanksHead() : '') + '<div class="tiles">' + tiles + '</div>', 'store tanks-m');
  };
  function tanksSig() { return AA.state.tanks.map(function (t) { const x = AA.tankStatus(t); return x.level + ':' + x.warn.length + ':' + x.n + ':' + Math.round(x.fed * 10) + ':' + Math.round(x.dirt * 10); }).join('|') + AA.state.active + (AA.feedAllPlan ? ':' + AA.feedAllPlan().need + ':' + AA.state.food : ''); }

  /* ================= Bericht: Während du weg warst ================= */
  UI.welcomeBack = function (sum) {
    const s = AA.state, sec = [], li = function (a) { return a.length ? '<ul>' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : ''; };
    const news = (AA.farmNews || []).splice(0);
    const money = [], breed = [], bad = [], todo = [];
    if (sum.wages) money.push('👥 Löhne: <b class="dn">−' + fmt(sum.wages) + '</b> Münzen' + (sum.staff && sum.staff.length ? ' <small>(' + sum.staff.map(function (k) { return AA.STAFF[k].name; }).join(', ') + ')</small>' : ''));
    if (sum.delivered) money.push('🧑‍💼 ' + sum.delivered + (sum.delivered === 1 ? ' Lieferung' : ' Lieferungen') + ' durch den Verkäufer');
    if (sum.cDone) money.push('🏆 ' + sum.cDone + (sum.cDone === 1 ? ' Vertrag' : ' Verträge') + ' erfüllt');
    if (sum.coins) money.unshift('Kasse unterm Strich: <b class="' + (sum.coins < 0 ? 'dn' : 'up') + '">' + (sum.coins > 0 ? '+' : '−') + fmt(Math.abs(sum.coins)) + '</b> Münzen' + (sum.rep ? ' · Ruf ' + (sum.rep > 0 ? '+' : '') + sum.rep : ''));
    if (sum.hatched) breed.push('🐣 ' + sum.hatched + (sum.hatched === 1 ? ' Baby ist' : ' Babys sind') + ' geschlüpft');
    if (sum.matured) breed.push('✨ ' + sum.matured + (sum.matured === 1 ? ' Fisch ist' : ' Fische sind') + ' erwachsen geworden' + (sum.xp ? ' – <b>+' + fmt(sum.xp) + ' XP</b>' : ''));
    if (sum.bred) breed.push('🧑‍🔬 Der Zuchtmeister hat ' + sum.bred + (sum.bred === 1 ? ' Paar' : ' Paare') + ' gepaart');
    (sum.variants || []).slice(0, 4).forEach(function (x) { breed.push('🌈 <b>' + esc(AA.speciesName(x.sp, x.v)) + '</b> geschlüpft – ' + AA.VAR_BY[x.v].rare + (x.fresh ? ', neu im Sammelbuch!' : '')); });
    if (sum.variants && sum.variants.length > 4) breed.push('🌈 … und ' + (sum.variants.length - 4) + ' weitere Farbvarianten');
    if (sum.eggs) breed.push('🥚 ' + sum.eggs + (sum.eggs === 1 ? ' Ei wartet' : ' Eier warten') + ' noch');
    if (sum.matings) breed.push('🧑‍🔬 Der Zuchtmeister hat ' + sum.matings + (sum.matings === 1 ? ' Paar' : ' Paare') + ' zusammengebracht');
    if (sum.sick) bad.push('🤒 ' + sum.sick + (sum.sick === 1 ? ' Fisch ist' : ' Fische sind') + ' vor Hunger krank geworden – füttern hilft');
    if (sum.ordersFailed) bad.push('⌛ ' + sum.ordersFailed + (sum.ordersFailed === 1 ? ' Kundenauftrag ist' : ' Kundenaufträge sind') + ' abgelaufen');
    news.forEach(function (m) { bad.push(esc(m)); });
    const alerts = s.tanks.filter(function (t) { return AA.tankStatus(t).level >= 2; }).length;
    if (alerts) todo.push('🗂️ ' + alerts + (alerts === 1 ? ' Becken braucht' : ' Becken brauchen') + ' dich (Hunger, Schmutz oder Kranke)');
    if (AA.ordersReady()) todo.push('📦 ' + AA.ordersReady() + (AA.ordersReady() === 1 ? ' Kundenauftrag' : ' Kundenaufträge') + ' kannst du beliefern');
    if (AA.contractsOpen()) todo.push('📜 ' + AA.contractsOpen() + (AA.contractsOpen() === 1 ? ' Vertrag wartet' : ' Verträge warten') + ' auf Lieferung');
    if (AA.caviarReady()) todo.push('🥄 Kaviar bereit (' + AA.caviarReady() + ')');
    if (AA.questOpen() > 0) todo.push('📋 Bei den Aufträgen wartet etwas zum Abholen');
    if (!s.daily.chest) todo.push('💰 Die Schatzkiste ist gefüllt');
    if (!s.daily.gift) todo.push('🎁 Dein Tagesgeschenk wartet');
    const tr = AA.marketTrends(); if (tr.length) todo.push('📈 Heute gefragt: ' + tr.map(function (x) { return esc(AA.FISH_BY[x.sp].name) + ' +' + Math.round((x.mult - 1) * 100) + ' %'; }).join(', '));
    if (bad.length) sec.push('<div class="rp bad"><h4>⚠️ Nicht so gut</h4>' + li(bad) + '</div>');
    if (money.length) sec.push('<div class="rp"><h4>💰 Kasse & Personal</h4>' + li(money) + '</div>');
    if (breed.length) sec.push('<div class="rp"><h4>🐣 Zucht</h4>' + li(breed) + '</div>');
    if (todo.length) sec.push('<div class="rp"><h4>📌 Jetzt zu tun</h4>' + li(todo) + '</div>');
    /* Runde 20g: Freunde – Geschenke, Hilfe beim Füttern/Putzen und Herzen kommen kurz nach dem Start aus der Wolke und landen hier (UI.awayNote) */
    const fr = (UI.awayFriends || []).slice();
    sec.push('<div class="rp friends' + (fr.length ? '' : ' hidden') + '" id="wb-friends"><h4>👥 Freunde</h4><ul>' + fr.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>');
    if (!sec.some(function (x) { return x.indexOf('hidden') < 0; })) sec.push('<div class="rp"><h4>🌊 Alles ruhig</h4><ul><li>Nichts Besonderes passiert.</li></ul></div>');
    UI.open('welcome', '<div class="hero report"><div class="h2">Während du weg warst</div><div class="sub">' + AA.fmtDur(sum.real || sum.seconds) + (sum.days ? ' – das waren ' + sum.days + (sum.days === 1 ? ' Spieltag' : ' Spieltage') : '') + '</div>' + sec.join('') +
      '<div class="row end"><button class="btn" data-act="opentanks">🗂️ Becken-Übersicht</button><button class="btn green lg" data-act="close">Weiter</button></div></div>', 'small hero-m report-m');
  };

  /* ================= Fisch-Karte ================= */
  UI.cardEco = function (d) {
    const sub = $('#c-sub'); if (!sub) return;
    sub.title = '';                                  // Runde 11: kein Räuber-Hinweis mehr – alle Fische vertragen sich
  };

  /* ================= Klicks, Meldungen ================= */
  UI.ecoClick = function (act, id) {
    if (act === 'setshape') { const r = AA.setShape(id); if (r === true) { AA.audio.play('click'); UI.toast('🏔️ Boden-Form: ' + esc(AA.SHAPE_BY[id].name) + '.'); UI.openStore(); } return true; }
    if (act === 'biosel') { UI.bioSel = id; UI.openStore(); return true; }
    if (act === 'opentanks') { UI.openTanks(); return true; }
    if (act === 'gotank' && UI.modalKind === 'tanks') { AA.audio.play('click'); UI.close(); if (+id !== AA.state.active) AA.switchTank(+id); return true; }
    return false;
  };
  let lastSig = '', lastTier = {};
  UI.ecoRefresh = function () {
    const n = AA.tanksAlert(), bd = $('#tanks-badge');
    if (bd) { bd.textContent = n; bd.classList.toggle('hidden', !n); }
    if (UI.modalKind === 'tanks') { const sg = tanksSig(); if (sg !== lastSig) { lastSig = sg; const el = $('#modal .tiles'), sc = el ? el.scrollTop : 0; UI.openTanks(); const e2 = $('#modal .tiles'); if (e2) e2.scrollTop = sc; } }
    const t = AA.tank(), r = AA.bioTier(t), now = r ? r.b.id + r.pts : '';            // neue Biotop-Stufe im aktuellen Becken
    if (lastTier[t.id] !== undefined && now && now !== lastTier[t.id] && (!lastTier[t.id] || r.pts > +lastTier[t.id].slice(-1)) && AA.ready && !AA.quiet)
      UI.toast(r.b.ico + ' <b>Biotop ' + esc(r.b.name) + ': ' + r.tier.ico + ' ' + r.tier.name + '!</b><br><small>' + bonusTxt(r.tier) + '</small>', 'big');
    lastTier[t.id] = now;
  };
  UI.ecoInit = function () {
    const btn = $('#btn-tanks'); if (btn) btn.addEventListener('click', function () { AA.audio.play('click'); UI.openTanks(); });
  };
})(window.AA);
