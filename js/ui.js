'use strict';
/* Awesome Aquarium – Bedienoberfläche: HUD, Shop, Fisch-Karte, Dialoge (v2) */
(function (AA) {
  const $ = AA.$, esc = AA.esc, fmt = AA.fmt, V = AA.view, B = AA.BAL;
  const UI = AA.ui = { storeTab: 'fish', modalKind: null, buy: null, lockModal: false, pending: null };
  let COIN = '🪙', FOODI = '🥫';
  const PEARL = '<span class="pearl" title="Perlen"></span>';
  const ERR = { coins: 'Nicht genug Münzen.', pearls: 'Nicht genug Perlen.', full: 'Das Becken ist voll.', level: 'Dafür brauchst du ein höheres Level.', max: 'Mehr geht nicht.',
    unknown: 'Das gibt es nicht.', water: 'Das passt nicht zum Wasser in diesem Becken.', decofull: 'In dieses Becken passt keine Deko mehr.', nofish: 'Kein passender Fisch da (erwachsen, gesund, Klasse/Farbe wie gewünscht).', crawlfull: 'Mehr Krabbler passen nicht in dieses Becken.', owned: 'Die hast du schon.',
    ocean: 'Diese Art lebt nur im Meeresbecken.', deep: 'Diese Art lebt nur im Tiefsee-Becken.', nodeep: 'Ins Tiefsee-Becken dürfen nur Tiefsee-Tiere.', big: 'Diese Art braucht das größte Becken (125 Gallonen) oder das Meeresbecken.' };
  function real(sec) { return sec / AA.speed(); }       // Spiel-Sekunden -> echte Sekunden beim aktuellen Tempo

  /* ---------- Toasts ---------- */
  UI.toast = function (msg, kind) {
    if (AA.quiet) return;
    const box = $('#toasts'), el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.innerHTML = msg;
    box.appendChild(el);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(function () { el.classList.add('out'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 420); }, kind === 'big' ? 4600 : 3200);
  };
  UI.fail = function (code) { UI.toast('⚠️ ' + (ERR[code] || 'Das geht gerade nicht.'), 'warn'); AA.audio.play('error'); };

  /* ---------- HUD ---------- */
  function setBar(sel, v) { const el = $(sel); el.style.width = Math.round(AA.clamp(v, 0, 1) * 100) + '%'; el.parentNode.parentNode.classList.toggle('low', v < 0.25); }
  UI.refresh = function () {
    const s = AA.state, t = AA.tank(), xp = AA.xpProgress();
    $('#lvl-num').textContent = s.level;
    $('#xp-fill').style.width = Math.round(Math.min(1, xp.frac) * 100) + '%';
    $('#xp-text').textContent = xp.max ? 'Max-Level' : fmt(xp.cur) + ' / ' + fmt(xp.need) + ' XP';
    $('#coins').textContent = fmt(s.coins);
    $('#pearls').textContent = fmt(s.pearls);
    $('#food').textContent = fmt(s.food);
    $('#food-n').textContent = s.food > 999 ? '999+' : s.food;
    $('#food-n').classList.toggle('zero', s.food <= 0);
    setBar('#clean-fill', 1 - t.dirt); setBar('#fed-fill', AA.fedAvg(t));
    const bio = AA.bioTier(t);
    $('#tank-name').textContent = AA.tankIco(t) + ' ' + (bio ? bio.b.ico + bio.tier.ico + ' ' : '') + (t.role && AA.ROLES[t.role] ? AA.ROLES[t.role].ico + ' ' : '') + t.name;
    $('#tank-count').textContent = AA.count(t) + ' / ' + AA.cap(t) + ' 🐟' + (t.feeder > 0 ? ' · ⏲️' : '');
    const multi = s.tanks.length > 1;
    $('#tank-prev').style.visibility = multi ? 'visible' : 'hidden';
    $('#tank-next').style.visibility = multi ? 'visible' : 'hidden';
    $('#btn-sound').textContent = s.settings.sound ? '🔊' : '🔇';
    $('#btn-light').textContent = s.settings.night ? '☀️' : '🌙';
    $('#medal-dot').classList.toggle('hidden', AA.claimable() === 0);
    $('#gift-dot').classList.toggle('hidden', !!s.daily.gift);
    const hl = AA.huntsLeft(), hb = $('#hunt-badge');
    hb.classList.toggle('hidden', hl === 0); hb.textContent = hl;
    const sp = $('#speed-tag');
    sp.classList.toggle('hidden', AA.speed() === 1);
    sp.textContent = '⏩ ' + AA.speed() + '×';
    if (UI.metaRefresh) UI.metaRefresh();              // Marken an „Aufträge“ und „Buch“ (js/metaui.js)
    if (UI.bizRefresh) UI.bizRefresh();
    if (UI.farmRefresh) UI.farmRefresh();
    if (UI.ecoRefresh) UI.ecoRefresh();                // Marke am „Büro“ (js/bizui.js)
    if (UI.lifeRefresh) UI.lifeRefresh();              // Futter-Leiste, Titel, Schwarm-Meldungen (js/lifeui.js)
    UI.fitTop();
  };
  /* 14.11.2026: Die obere Leiste passt sich an, statt dass sich Balken und Knöpfe überlappen (große Zahlen wie 3.005.959 Münzen,
     schmale Fenster). Stufe für Stufe, bis alles passt: t1 seltene Knöpfe (📷 🌙 🔊 ⚙️) wandern ins Menü ☰ · t2 die zwei Balken
     stehen übereinander · t3 Level nur als Plakette · t4 auch 📅 und 🧭 ins Menü. Gemessen wird nur, wenn sich Zahlen oder Größe ändern. */
  const TIGHT = ['t1', 't2', 't3', 't4'];
  let tightKey = '';
  function topOverflows(top) {
    const m = top.querySelector('.meters');
    return top.scrollWidth > top.clientWidth + 1 || (m && m.scrollWidth > m.clientWidth + 1);
  }
  UI.fitTop = function (force) {
    const top = $('#hud-top'), st = $('#stage');
    if (!top || !st) return;
    const key = [$('#coins').textContent, $('#pearls').textContent, $('#food').textContent, $('#xp-text').textContent, $('#speed-tag').className,
      st.style.getPropertyValue('--ui'), st.classList.contains('compact'), document.body.classList.contains('visiting')].join('|');
    if (!force && key === tightKey) return;
    tightKey = key;
    TIGHT.forEach(function (c) { top.classList.remove(c); });
    if (st.classList.contains('compact')) return;      // die schlanke Fassung (Handy) hat ihr eigenes Layout
    for (let i = 0; i < TIGHT.length && topOverflows(top); i++) top.classList.add(TIGHT[i]);
  };
  const warn = { hunger: 0, dirt: 0, sick: 0, food: 0 };
  UI.tick = function () {
    UI.refresh(); UI.updateCard();
    if (AA.visit) return;                             // zu Besuch: keine Mahnungen (Hunger, Algen) – ist ja nicht dein Becken
    const t = AA.tank(), s = AA.state, now = Date.now();
    $('#btn-store').classList.toggle('pulse', AA.count(t) === 0 && !UI.modalKind);
    if (UI.modalKind || AA.quiet || !t.fish.length) return;
    let sick = null, hungry = 0;
    for (let i = 0; i < t.fish.length; i++) { if (t.fish[i].sick) sick = t.fish[i]; if (t.fish[i].hunger < 0.15) hungry++; }
    if (sick && now - warn.sick > 300000) { warn.sick = now; UI.toast('🤒 ' + esc(sick.name) + ' ist krank und wächst nicht mehr – Füttern macht wieder gesund.', 'warn'); }
    else if (hungry && s.food <= 0 && now - warn.food > 240000) { warn.food = now; UI.toast('🥫 Futter ist alle – Nachschub gibt es im Shop, beim Training oder als Tagesgeschenk 🎁.', 'warn'); }
    else if (hungry && now - warn.hunger > 240000) { warn.hunger = now; UI.toast('🍽️ ' + (hungry === 1 ? 'Ein Fisch hat' : hungry + ' Fische haben') + ' Hunger.', 'warn'); }
    else if (t.dirt > 0.6 && now - warn.dirt > 300000) { warn.dirt = now; UI.toast('🧽 Das Becken veralgt – schnapp dir die Bürste.', 'warn'); }
  };

  UI.setTool = function (tool) {
    V.tool = tool;
    const st = $('#stage');
    ['hand', 'food', 'sponge', 'tap', 'deco'].forEach(function (k) { st.classList.toggle('tool-' + k, k === tool); });
    document.querySelectorAll('#hud-bottom .tool').forEach(function (b) { b.classList.toggle('active', b.dataset.tool === tool); });
    if (tool === 'deco') { V.select(null); if (UI.toggleFriends) UI.toggleFriends(false); }            // Deko-Modus (Runde 10): Deko bleibt auswählbar
    else if (tool !== 'hand') { V.select(null); V.selectDeco(null); if (UI.toggleFriends) UI.toggleFriends(false); }   // die Freundes-Leiste macht Platz für die Futter-Sorten
    if (UI.lifeFoodBar) UI.lifeFoodBar();             // Futter-Sorten erscheinen nur beim Futter-Werkzeug
    if (UI.decoSync) UI.decoSync();                   // Lager-Leiste und Kopfzeile des Deko-Modus (js/decorui.js)
  };

  /* ---------- Modal ---------- */
  UI.open = function (kind, html, cls, lock) {
    if (UI.modalKind === 'mini' && kind !== 'mini') AA.mini.closed();
    UI.modalKind = kind; UI.lockModal = !!lock;
    $('#toasts').innerHTML = '';
    const m = $('#modal');
    m.className = cls || '';
    m.innerHTML = html;
    $('#overlay').classList.remove('hidden');
  };
  UI.close = function () {
    const was = UI.modalKind;
    UI.modalKind = null; UI.lockModal = false; $('#overlay').classList.add('hidden'); $('#modal').innerHTML = '';
    if (was === 'mini') AA.mini.closed();
  };
  function head(title, extra) { return '<div class="m-head"><div class="m-title">' + title + '</div>' + (extra || '') + '<button class="x" data-act="close" title="Schließen">✕</button></div>'; }
  function pic(key, cls) { return '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="' + AA.assets.src(key) + '" alt="">'; }

  /* ---------- Shop ---------- */
  const TABS = [['fish', '🐠 Fische'], ['crawl', '🦀 Krabbler'], ['food', '🥫 Futter'], ['deco', '🪸 Deko'], ['look', '🎨 Kies & Hintergrund'], ['tank', '🏠 Aquarien'], ['perk', '⚡ Perks']];
  function buyBtn(act, id, price, locked, lvl, extraLock, pearls) {
    const s = AA.state;
    if (locked) return '<button class="buy locked" disabled>🔒 Ab Level ' + lvl + '</button>';
    if (extraLock) return '<button class="buy locked" disabled>' + extraLock + '</button>';
    const poor = pearls ? s.pearls < price : s.coins < price;
    return '<button class="buy' + (poor ? ' poor' : '') + (pearls ? ' pearlbuy' : '') + '" data-act="' + act + '" data-id="' + id + '"' + (poor ? ' disabled' : '') + '>' + (pearls ? PEARL : COIN) + ' ' + fmt(price) + '</button>';
  }
  /* Kopfzeile für die Arten des anderen Wassers: sagt, wo sie leben, und führt dorthin */
  function otherWaterSec(what) {
    const s = AA.state, t = AA.tank(), ow = t.water === 'salt' ? 'fresh' : 'salt', W = AA.WATER[ow];
    const idx = s.tanks.findIndex(function (tk) { return tk.water === ow; });
    let way;
    if (idx >= 0) way = '<button class="lnk" data-act="gotankstore" data-id="' + idx + '">→ zu „' + esc(s.tanks[idx].name) + '“ wechseln</button>';
    else if (ow === 'fresh' && !AA.hasBonusTank()) way = 'Das Süßwasser-Becken gibt es ab Level ' + AA.FRESH_TANK.lvl[0] + ' für ' + fmt(AA.FRESH_TANK.price[0]) + ' Münzen im Reiter <button class="lnk" data-act="tab" data-id="tank">🏠 Aquarien</button>.';
    else way = 'Ein ' + W.name + '-Becken gibt es im Reiter <button class="lnk" data-act="tab" data-id="tank">🏠 Aquarien</button>.';
    return '<div class="sec other">' + W.ico + ' <b>' + W.name + '-' + what + '</b> – leben nur im ' + W.name + '-Becken. ' + way + '</div>';
  }
  function fishCards() {
    const s = AA.state, t = AA.tank(), full = AA.count(t) >= AA.cap(t), W = AA.WATER;
    const LOCK = { ocean: '🦈 Nur Meeresbecken', deep: '🌌 Nur Tiefsee-Becken', nodeep: '🌌 Kein Tiefsee-Tier', big: '📐 Nur großes Becken' };
    const card = function (f) {
      const locked = s.level < f.lvl, w = AA.waterOf(f), why = AA.whyNot(f, t), wrong = !!why;
      return '<div class="card' + (locked ? ' is-locked' : '') + (wrong ? ' is-other' : '') + '">' +
        '<div class="pic' + (f.inv ? ' inv' : '') + '">' + pic('fish/' + f.id + '_m') + pic('fish/' + f.id + '_b', 'baby') + '</div>' +
        '<div class="nm">' + esc(f.name) + '</div><div class="info">' + esc(f.info) + '</div>' +
        '<div class="stats"><span title="' + W[w].name + '">' + W[w].ico + '</span>' + 
        (f.school ? '<span class="tag-job" title="Schwarmfisch: ab ' + AA.SCHOOL.min + ' Tieren schwimmen sie im Schwarm und wachsen schneller – unter ' + AA.SCHOOL.lonely + ' sind sie einsam">🐟 Schwarm</span>' : '') +
        (UI.wildTags ? UI.wildTags(f) : '') +
        (f.hab === 'bottom' ? '<span title="Grundfisch: bleibt am Boden">⬇️ Grund</span>' : (f.hab === 'lurk' ? '<span title="Höhlenbewohner: braucht ein Versteck (Deko mit 🏠)">🕳️ Höhle</span>' : '')) +
        (f.id === 'clown' ? '<span title="Wohnt in einer Anemone (Shop → Deko): nach der Balz schneller wieder bereit">🏠 Anemone</span>' : '') + '<span title="Zeit bis erwachsen">⏱ ' + AA.fmtDur(real(f.grow)) + '</span><span title="Verkaufswert (erwachsen)">💰 ' + fmt(f.sell) + '</span><span title="Paarung kostet">❤ ' + fmt(f.mate) + '</span></div>' +
        (f.special ? '<div class="stats"><span class="tag-special" title="Besonderes Tier: gibt es nur für Perlen">⭐ Besonderes Tier</span></div>' : '') +
        buyBtn('buyfish', f.id, f.pearlOnly ? f.pearls : f.price, locked, f.lvl, why ? (LOCK[why] || W[w].ico + ' ' + W[w].only) : (full ? 'Becken voll' : ''), !!f.pearlOnly) + '</div>';
    };
    const fits = function (f) { const w = AA.waterOf(f); return w === 'both' || w === t.water; };
    const base = AA.FISH.filter(function (f) { return !f.hybrid; }).sort(function (a, b) { return a.lvl - b.lvl; });      // Hybride gibt es nur durch Kreuzen
    const spec = base.filter(function (f) { return f.special && fits(f) && !AA.whyNot(f, t); });      // Runde 12: besondere Tiere (nur für Perlen) stehen oben
    const mine = base.filter(function (f) { return !f.special && fits(f) && !AA.whyNot(f, t); }), rest = base.filter(function (f) { return !fits(f); });
    /* Arten mit passendem Wasser, die trotzdem ein anderes Becken brauchen, stehen in eigenen Gruppen darunter – mit Weg dorthin */
    const goTo = function (test, hint) { const i = s.tanks.findIndex(test); return i >= 0 ? ' <button class="lnk" data-act="gotankstore" data-id="' + i + '">→ zu „' + esc(s.tanks[i].name) + '“ wechseln</button>' : ' ' + hint; };
    const toTanks = 'Gibt es im Reiter <button class="lnk" data-act="tab" data-id="tank">🏠 Aquarien</button>.';
    const GROUPS = [
      ['big', '📐 <b>Bodenhaie</b> – brauchen Platz: nur im größten Becken (' + AA.SIZES[AA.SIZES.length - 1].gal + ' Gallonen) oder im Meeresbecken.', function () { return goTo(function (tk) { return tk !== t && tk.water === 'salt' && !tk.deep && (tk.ocean || tk.size === AA.SIZES.length - 1); }, 'Vergrößern kannst du im Reiter <button class="lnk" data-act="tab" data-id="tank">🏠 Aquarien</button>.'); }],
      ['ocean', '🦈 <b>Meeresriesen</b> – leben nur im Meeresbecken.', function () { return goTo(function (tk) { return tk.ocean; }, toTanks); }],
      ['deep', '🌌 <b>Tiefsee-Tiere</b> – leben nur im stockdunklen Tiefsee-Becken.', function () { return goTo(function (tk) { return tk.deep; }, toTanks); }],
      ['nodeep', '🌊 <b>Keine Tiefsee-Tiere</b> – denen ist es hier unten zu dunkel und zu kalt.', function () { return goTo(function (tk) { return tk.water === 'salt' && !tk.deep; }, ''); }]
    ];
    let h = '<div class="sec">' + AA.tankIco(t) + ' „' + esc(t.name) + '“ ist ' + (t.deep ? 'das <b>Tiefsee-Becken</b>' : (t.ocean ? 'das <b>Meeresbecken</b>' : 'ein <b>' + W[t.water].name + '-Becken</b>')) + ' (' + AA.count(t) + ' von ' + AA.cap(t) + ' Bewohnern). Fische kommen als hungrige Babys.</div>' +
      (spec.length ? '<div class="sec special">⭐ <b>Besondere Tiere</b> – gibt es nur für Perlen <span class="pearl" title="Perlen"></span>. Du hast <b>' + fmt(s.pearls) + '</b>.</div>' + spec.map(card).join('') + '<div class="sec">Fische</div>' : '') +
      mine.map(card).join('');
    GROUPS.forEach(function (g) {
      const l = base.filter(function (f) { return fits(f) && AA.whyNot(f, t) === g[0]; });
      if (l.length) h += '<div class="sec other">' + g[1] + g[2]() + '</div>' + l.map(card).join('');
    });
    return h + (rest.length ? otherWaterSec('Arten') + rest.map(card).join('') : '');
  }
  function foodCards() {
    const s = AA.state, t = AA.tank();
    let h = '<div class="sec">Vorrat: <b>' + fmt(s.food) + ' Prisen</b> · Eine Prise = ' + B.flakes + ' Flocken, jeder Bissen bringt 1 XP.' +
      (t.feeder > 0 ? ' · ⏲️ Futterautomat in „' + esc(t.name) + '“ läuft noch ' + AA.fmtDur(real(t.feeder)) + '.' : '') +
      ' · <b>Spezialfutter</b> streust du mit dem Futter-Werkzeug: Sorte in der Leiste darüber wählen.</div>';
    h += AA.FOOD.map(function (f) {
      const locked = s.level < f.lvl, have = f.kind ? s.food2[f.kind] | 0 : 0;
      return '<div class="card' + (locked ? ' is-locked' : '') + '"><div class="pic food">' + (f.days ? '<span class="big-emoji">⏲️</span>' : (f.kind ? '<span class="big-emoji">' + f.ico + '</span><b class="mult">×' + f.n + '</b>' : pic('prop/foodcan') + '<b class="mult">×' + f.food + '</b>')) + '</div>' +
        '<div class="nm">' + esc(f.name) + '</div><div class="info">' + esc(f.info) + (f.kind ? ' <b>Im Vorrat: ' + have + '</b>' : '') + '</div>' +
        buyBtn('buyfood', f.id, f.pearls || f.price, locked, f.lvl, '', !!f.pearls) + '</div>';
    }).join('');
    h += '<div class="card"><div class="pic food"><span class="big-emoji">🎁</span></div><div class="nm">Tagesgeschenk</div><div class="info">' + B.gift + ' Prisen gratis – einmal pro Tag.</div>' +
      (s.daily.gift ? '<button class="buy locked" disabled>Wieder in ' + AA.fmtShort(real(AA.dayLeft())) + '</button>' : '<button class="buy use" data-act="gift">Abholen</button>') + '</div>';
    return h;
  }
  function decoCards() {
    const s = AA.state;
    return '<div class="sec">Einrichten: Stück im Becken antippen, dann <b>ziehen</b> zum Verschieben (nach oben = weiter hinten), <b>↔ spiegeln</b> und die <b>Größe</b> ändern – am runden Anfasser, mit dem Regler oder den Tasten + und −. Wie weit, hängt vom Stück ab (📐). Stücke mit <b>🧱 Stellfläche</b> sind oben flach: Zieh andere Deko darauf, sie bleibt dort stehen.' + (UI.wildDecoTop ? UI.wildDecoTop() : '') + '</div>' + (UI.decorShopTop ? UI.decorShopTop() : '') +
    AA.DECO.filter(function (d) { return !d.fixed && !d.crawl; }).sort(function (a, b) { return (a.trophy ? 1 : 0) - (b.trophy ? 1 : 0) || a.lvl - b.lvl; }).map(function (d) {
      const locked = s.level < d.lvl && !d.trophy, rg = AA.decoRange(d);
      const tags = '<span>' + AA.DECO_CAT[d.cat] + '</span>' + (d.tops ? '<span class="tag-plat" title="Oben flach: Andere Deko lässt sich daraufstellen und wandert mit">🧱 Stellfläche' + (d.tops.length > 1 ? ' ×' + d.tops.length : '') + '</span>' : '') +
        (d.hide ? '<span title="Fische verstecken sich hier">🏠 Versteck</span>' : '') + (d.sway ? '<span title="Wiegt sich im Wasser">🌿 Wiegt sich</span>' : '') + (d.alive ? '<span>🫀 Lebendig</span>' : '') + (d.bubbles ? '<span>🫧 Blubbert</span>' : '') +
        (d.path ? '<span title="Liegt flach im Kies – Fische schwimmen darüber, andere Deko stellst du einfach darauf">🛤️ Weg</span>' : '') + (d.stairs ? '<span title="Jede Stufe ist eine Stellfläche">🪜 Treppe</span>' : '') +
        (UI.wildDecoTags ? UI.wildDecoTags(d) : '') + (UI.decorTags ? UI.decorTags(d) : '') +
        (d.home ? '<span title="In der Natur zu Hause im ' + AA.WATER[d.home].name + ' – passt trotzdem in jedes Becken">' + AA.WATER[d.home].ico + ' ' + AA.WATER[d.home].name + '-Typ</span>' : '') +
        (rg ? '<span title="So klein und so groß lässt es sich im Becken ziehen">📐 ' + pct(rg[0]) + '–' + pct(rg[1]) + ' %</span>' : '<span title="Lässt sich nicht größer oder kleiner ziehen">🔒 Feste Größe</span>');
      return '<div class="card' + (locked ? ' is-locked' : '') + '">' +
        '<div class="pic deco">' + pic('deco/' + d.id) + '</div>' +
        '<div class="nm">' + esc(d.name) + '</div>' + (d.info ? '<div class="info">' + esc(d.info) + '</div>' : '') +
        '<div class="stats">' + tags + '</div>' +
        (d.trophy ? '<button class="buy locked" disabled>🏆 Nur zu gewinnen' + (AA.trophyCount ? ' · ' + AA.trophyCount(d.id) + '× im Besitz' : '') + '</button>' : buyBtn('buydeco', d.id, d.price, locked, d.lvl, d.unique && s.clam ? '✓ Gekauft' : '')) + '</div>';
    }).join('');
  }
  /* Krabbler: Schnecken, Seesterne, Seeigel & Co. – sie wandern von allein über den Kies */
  function crawlCards() {
    const s = AA.state, t = AA.tank(), have = AA.decoCount(t, true), cmax = AA.crawlMax(t), full = have >= cmax, cp = AA.cleanPower(t);
    let h = '<div class="sec">Krabbler wuseln von allein über den Kies und brauchen kein Futter – Schnecken, Seesterne und Seeigel klettern auch an die Scheibe 🪟. In „' + esc(t.name) + '“ leben <b>' + have + ' von ' + cmax + '</b>' + (t.ocean || t.deep ? '' : ' (im Meeres- und Tiefsee-Becken passen ' + AA.BAL.maxCrawlBig + ')') + '.' +
      (UI.lifeCrewTop ? UI.lifeCrewTop(t) : ' Algenfresser 🧽 bremsen das Veralgen' + (cp > 0 ? ' – im Moment um <b>' + Math.round(cp * 100) + ' %</b>' : '') + ' (zusammen höchstens ' + Math.round(B.cleanMax * 100) + ' %).') + (UI.wildCrewNote ? UI.wildCrewNote(t) : '') + '</div>';
    const cr = AA.DECO.filter(function (d) { return d.crawl; }).sort(function (a, b) { return (AA.decoFits(b, t) ? 1 : 0) - (AA.decoFits(a, t) ? 1 : 0) || a.lvl - b.lvl; });
    let sep = false;
    h += cr.map(function (d) {
      const locked = s.level < d.lvl, w = AA.waterOf(d), wrong = !AA.decoFits(d, t);
      let pre = '';
      if (wrong && !sep) { sep = true; pre = otherWaterSec('Krabbler'); }
      const job = d.job && AA.JOBS ? AA.JOBS[d.job] : null;
      const tags = (job ? '<span class="tag-job" title="Job in der Putzkolonne">' + job.ico + ' ' + job.name + '</span>' : '') + (d.clean ? '<span title="Bremst das Veralgen">🧽 −' + Math.round(d.clean * 100) + ' % Schmutz</span>' : '') + (d.eats && d.job !== 'food' ? '<span title="Frisst Futter, das am Boden liegen bleibt">🍽️ Räumt Futterreste weg</span>' : '') +
        (d.glass ? '<span title="Klettert auch an die Scheibe und die Seitenwände – dort sieht man die Unterseite">🪟 Klettert ans Glas</span>' : '') +
        (!d.clean && !d.eats && !d.glass && !job ? '<span>✨ Einfach hübsch</span>' : '');
      return pre + '<div class="card' + (locked ? ' is-locked' : '') + (wrong ? ' is-other' : '') + '">' +
        '<div class="pic deco">' + pic('deco/' + d.id) + '</div>' +
        '<div class="nm">' + esc(d.name) + '</div><div class="info">' + esc(d.info || '') + '</div>' +
        '<div class="stats"><span title="' + AA.WATER[w].name + '">' + AA.WATER[w].ico + '</span>' + tags + '</div>' +
        buyBtn('buydeco', d.id, d.price, locked, d.lvl, wrong ? AA.WATER[w].ico + ' ' + AA.WATER[w].only : (full ? 'Becken voll' : '')) + '</div>';
    }).join('');
    return h;
  }
  function lookCards() {
    const s = AA.state, t = AA.tank();
    let h = (UI.ecoLookTop ? UI.ecoLookTop() : '') + (UI.lifeLookTop ? UI.lifeLookTop() : '') + '<div class="sec">Boden – Wechsel ist gratis, neue Böden gibt es mit höherem Level</div>';
    h += AA.FLOORS.map(function (f) {
      const locked = s.level < f.lvl;
      let btn;
      if (t.floor === f.id) btn = '<button class="buy active" disabled>✓ Liegt im Becken</button>';
      else if (locked) btn = '<button class="buy locked" disabled>🔒 Ab Level ' + f.lvl + '</button>';
      else btn = '<button class="buy use" data-act="setfloor" data-id="' + f.id + '">Verwenden</button>';
      return '<div class="card' + (locked ? ' is-locked' : '') + '"><div class="pic floor"><img data-fl="' + f.id + '" src="' + V.floorThumb(f.id) + '" alt=""></div><div class="nm">' + esc(f.name) + '</div>' + btn + '</div>';
    }).join('');
    if (UI.ecoShapes) h += UI.ecoShapes();
    /* Runde 12: Hintergründe gehören dir, sobald du sie einmal gekauft hast – in jedem Becken. Deine stehen oben, getrennt vom Rest. */
    const isOwned = function (w) { return s.walls.indexOf(w.id) >= 0 || !w.pearls; };      // Gratis-Farben gelten als vorhanden
    const wallCard = function (w) {
      const owned = isOwned(w);
      let btn;
      if (t.wall === w.id) btn = '<button class="buy active" disabled>✓ Hängt in diesem Becken</button>';
      else if (owned) btn = '<button class="buy use" data-act="setwall" data-id="' + w.id + '">Verwenden</button>';
      else btn = buyBtn('setwall', w.id, w.pearls, false, 0, '', true);
      const tg = '<div class="stats">' + (owned && w.pearls ? '<span class="tag-owned" title="Einmal gekauft – in jedem Becken nutzbar">✓ Gehört dir</span>' : '') + (w.live ? '<span class="tag-special" title="Im Hintergrund ziehen Silhouetten vorbei">🎞️ Lebendig</span>' : '') +
        (w.special ? '<span class="tag-special" title="Besonders kräftige Kulisse – ein Hingucker">✨ Spezial</span>' : '') + (w.img ? '<span>🖼️ Gemalt</span>' : '') + (w.home ? '<span>' + AA.WATER[w.home].ico + ' ' + AA.WATER[w.home].name + '</span>' : '') + '</div>';
      return '<div class="card' + (owned ? ' is-owned' : '') + '"><div class="pic floor"><img data-wl="' + w.id + '" src="' + V.wallThumb(w.id) + '" alt=""></div><div class="nm">' + esc(w.name) + '</div>' + tg + btn + '</div>';
    };
    const mineW = AA.WALLS.filter(isOwned), shopW = AA.WALLS.filter(function (w) { return !isOwned(w); });
    h += '<div class="sec">🖼️ <b>Deine Hintergründe</b> (' + mineW.length + ') – einmal mit Perlen gekauft, gehören sie dir für immer und passen in <b>jedes</b> Becken. Einfach „Verwenden“.</div>';
    h += mineW.map(wallCard).join('');
    if (shopW.length) h += '<div class="sec">Weitere Hintergründe – kosten einmalig Perlen (jedes Level und jede Medaille bringt welche)</div>' + shopW.map(wallCard).join('');
    return h;
  }
  function tankCards() {
    const s = AA.state, t = AA.tank(), cur = AA.SIZES[t.size];
    let h = '<div class="card wide"><div class="pic emoji">📐</div><div class="nm">' + esc(t.name) + ' vergrößern <button class="mini" data-act="renametank" title="Becken umbenennen">✏️</button></div>';
    if (t.ocean) h += '<div class="info">Das Meeresbecken ist von Anfang an riesig: Platz für ' + AA.cap(t) + ' Bewohner.</div><button class="buy active" disabled>✓ Maximal</button>';
    else if (t.deep) h += '<div class="info">Das Tiefsee-Becken ist von Anfang an riesig: Platz für ' + AA.cap(t) + ' Bewohner.</div><button class="buy active" disabled>✓ Maximal</button>';
    else if (t.size < AA.SIZES.length - 1) {
      const nx = AA.SIZES[t.size + 1], rq = AA.tankReqFor(s.active, t.size + 1);
      h += '<div class="info">Jetzt: ' + cur.gal + ' Gallonen für ' + cur.cap + ' Bewohner. Nächste Stufe: ' + nx.gal + ' Gallonen für <b>' + nx.cap + ' Bewohner</b> – das Becken wird dabei sichtbar größer, Fische und Deko haben mehr Platz.</div>' + buyBtn('upgradetank', '', rq.price, s.level < rq.lvl, rq.lvl);
    } else h += '<div class="info">' + cur.gal + ' Gallonen für ' + cur.cap + ' Bewohner – größer geht’s nicht.</div><button class="buy active" disabled>✓ Maximal</button>';
    h += '</div>';
    const tankBtn = function (id, label, rq) {            // Kauf-Knopf mit Wasserart im Text
      if (s.level < rq.lvl) return '<button class="buy locked" disabled>🔒 Ab Level ' + rq.lvl + '</button>';
      const poor = s.coins < rq.price;
      return '<button class="buy' + (poor ? ' poor' : '') + '" data-act="buytank" data-id="' + id + '"' + (poor ? ' disabled' : '') + '>' + label + ' · ' + COIN + ' ' + fmt(rq.price) + '</button>';
    };
    if (!AA.hasBonusTank()) {
      const rq = AA.newTankReq(true);
      h += '<div class="card wide"><div class="pic emoji">🌿</div><div class="nm">Süßwasser-Becken <small class="tagline">Sonderangebot</small></div>' +
        '<div class="info">Dein erstes Süßwasser-Becken: Guppys, Neons, Skalare, Goldfische & Co. leben nur hier. 50 Gallonen für 10 Bewohner, eigener Kies, eigene Deko – ausbaubar wie jedes Becken.</div>' +
        tankBtn('bonus', '🌿 Süßwasser', rq) + '</div>';
    }
    if (UI.lightCard) h += UI.lightCard();              // Runde 12: Licht-Studio (js/extrasui.js)
    if (UI.farmTankCards) h += UI.farmTankCards();      // Zuchtstation, Meeresbecken (js/farmui.js)
    if (UI.wildTankCards) h += UI.wildTankCards();      // Tiefsee-Becken (js/wildui.js)
    h += '<div class="card wide"><div class="pic emoji">🆕</div><div class="nm">Neues Aquarium</div>';
    const reg = AA.regularTanks();
    if (reg < AA.MAX_TANKS) {
      const rq = AA.newTankReq(false);
      h += '<div class="info">Ein zusätzliches Becken (50 Gallonen, 10 Bewohner) mit eigenem Kies und eigener Deko – du entscheidest beim Kauf, ob Meer- oder Süßwasser. Du hast ' + reg + ' von ' + AA.MAX_TANKS + '.</div>' +
        '<div class="two">' + tankBtn('salt', '🌊 Meerwasser', rq) + (s.level < rq.lvl ? '' : tankBtn('fresh', '🌿 Süßwasser', rq)) + '</div>';
    } else h += '<div class="info">Du hast alle ' + AA.MAX_TANKS + ' Becken.</div><button class="buy active" disabled>✓ Alle gekauft</button>';
    h += '</div>';
    s.tanks.forEach(function (tk, i) {
      h += '<div class="card wide"><div class="pic emoji">' + AA.tankIco(tk) + '</div><div class="nm">' + esc(tk.name) + ' <small class="tagline">' + (tk.ocean ? 'Meeresbecken' : (tk.deep ? 'Tiefsee-Becken' : AA.WATER[tk.water].name)) + (tk.role && AA.ROLES[tk.role] ? ' · ' + AA.ROLES[tk.role].ico + ' ' + AA.ROLES[tk.role].name : '') + '</small></div>' +
        '<div class="info">' + AA.count(tk) + ' / ' + AA.cap(tk) + ' Bewohner · satt ' + Math.round(AA.fedAvg(tk) * 100) + ' % · sauber ' + Math.round((1 - tk.dirt) * 100) + ' %' + (tk.feeder > 0 ? ' · ⏲️ Automat' : '') + '</div>' +
        (i === s.active ? '<button class="buy active" disabled>✓ Du bist hier</button>' : '<button class="buy use" data-act="gotank" data-id="' + i + '">Ansehen</button>') + '</div>';
    });
    return h;
  }
  function perkCards() {
    return '<div class="soon">🚧 <b>Kommt später.</b> Hier landen bald Perks und Extras – ein kleiner Ausblick:</div>' + AA.PERKS.map(function (p) {
      return '<div class="card is-soon"><div class="pic emoji">' + p.ico + '</div><div class="nm">' + esc(p.name) + '</div><div class="info">' + esc(p.desc) + '</div><button class="buy locked" disabled>Kommt später</button></div>';
    }).join('');
  }
  function storeHtml() {
    const s = AA.state, t = AA.tank();
    const body = { fish: fishCards, crawl: crawlCards, food: foodCards, deco: decoCards, look: lookCards, tank: tankCards, perk: perkCards }[UI.storeTab]();
    return head('🛒 Shop', '<div class="m-coins"><span id="m-coins">' + COIN + ' <b>' + fmt(s.coins) + '</b></span><span id="m-pearls">' + PEARL + ' <b>' + fmt(s.pearls) + '</b></span><small>Level ' + s.level + ' · ' + AA.count(t) + '/' + AA.cap(t) + ' 🐟</small></div>') +
      '<div class="tabs">' + TABS.map(function (tb) { return '<button class="tab' + (tb[0] === UI.storeTab ? ' active' : '') + '" data-act="tab" data-id="' + tb[0] + '">' + tb[1] + '</button>'; }).join('') + '</div>' +
      '<div class="grid g-' + UI.storeTab + '">' + body + '</div>';
  }
  /* Boden- und Kulissen-Bilder kommen päckchenweise nach (js/assets.js): Ist der Shop gerade offen, die Vorschau an Ort und Stelle auffrischen –
     sonst zeigt jede Karte den hellen Kies, bis man den Reiter neu öffnet. */
  AA.on('assets', function (g) {
    if (UI.modalKind !== 'store' || UI.storeTab !== 'look') return;
    const id = g.slice(2);
    if (g.indexOf('k-') === 0) { const im = $('#modal img[data-fl="' + id + '"]'); if (im) im.src = V.floorThumb(id); }
    else if (g.indexOf('w-') === 0) AA.WALLS.forEach(function (w) { if (w.img === 'bg/' + id) { const im = $('#modal img[data-wl="' + w.id + '"]'); if (im) im.src = V.wallThumb(w.id); } });
  });
  UI.openStore = function (tab) {
    if (tab) UI.storeTab = tab;
    const g = $('#modal .grid'), sc = (UI.modalKind === 'store' && g && !tab) ? g.scrollTop : 0;
    UI.open('store', storeHtml(), 'store');
    const g2 = $('#modal .grid'); if (g2) g2.scrollTop = sc;
  };

  /* ---------- Fisch kaufen: erst das Geschlecht, dann der Name ---------- */
  function buyHtml() {
    const b = UI.buy, f = AA.FISH_BY[b.id], s = AA.state;
    return head(esc(f.name) + ' kaufen') +
      '<div class="buybox"><div class="pic big' + (f.inv ? ' inv' : '') + '">' + pic('fish/' + f.id + '_' + b.sex) + pic('fish/' + f.id + '_b', 'baby') + '</div>' +
      '<div class="form"><label>1. Geschlecht</label><div class="row"><button class="seg' + (b.sex === 'm' ? ' active' : '') + '" data-act="sex" data-id="m">♂ Männchen</button><button class="seg' + (b.sex === 'f' ? ' active' : '') + '" data-act="sex" data-id="f">♀ Weibchen</button></div>' +
      '<label>2. Name</label><div class="row"><input id="buy-name" maxlength="14" value="' + esc(b.name) + '" autocomplete="off" spellcheck="false"><button class="btn blue sm" data-act="rndname" title="Zufallsname">🎲</button></div>' +
      '<div class="note">Zieht als hungriges Baby ein und ist in <b>' + AA.fmtDur(real(f.grow)) + '</b> erwachsen (4 Wachstumsphasen, in jeder kann es einen Trick lernen). Für Nachwuchs brauchst du ♂ und ♀ derselben Art.</div>' +
      '<div class="row end"><button class="btn grey" data-act="backstore">Zurück</button>' +
      (f.pearls ? '<button class="btn violet" data-act="confirmfishp"' + (s.pearls < f.pearls ? ' disabled' : '') + '>' + (f.pearlOnly ? 'Kaufen · ' : '') + fmt(f.pearls) + ' Perlen</button>' : '') +
      (f.pearlOnly ? '' : '<button class="btn green" data-act="confirmfish"' + (s.coins < f.price ? ' disabled' : '') + '>Kaufen · ' + fmt(f.price) + ' Münzen</button>') + '</div></div></div>';
  }
  /* ---------- Runde 12: Info-Fenster zu einem Ei (antippen im Becken) ---------- */
  UI.eggInfo = function (egg) {
    const f = AA.FISH_BY[egg.sp];
    if (!f) return;
    UI.egg = egg;
    UI.open('egginfo', eggHtml(egg), 'small');
  };
  function eggHtml(egg) {
    const f = AA.FISH_BY[egg.sp], done = AA.clamp(1 - egg.hatch / (egg.total || egg.hatch || 1), 0, 1), g = egg.g;
    const stage = done < 0.25 ? 'Frisch gelegt – noch ganz klar, man sieht den Dotter.' : done < 0.6 ? 'Im Ei wächst schon ein kleiner Schatten heran.' : done < 0.92 ? 'Das Kleine ist gut zu sehen und zuckt ab und zu.' : 'Gleich ist es so weit – das Ei wackelt schon!';
    let h = head('🥚 Ei: ' + esc(f.name)) + '<div class="eggbox"><div class="pic big">' + pic('fish/' + f.id + '_b', 'baby') + '</div><div class="form">';
    h += '<div class="eggrow"><b>Schlüpft in</b><span id="egg-left">' + AA.fmtDur(real(egg.hatch)) + '</span></div>';
    h += '<div class="bar grow"><i style="width:' + Math.round(done * 100) + '%"></i><span>' + Math.round(done * 100) + ' % ausgebrütet</span></div>';
    h += '<div class="note">' + stage + '</div>';
    if (egg.pa) h += '<div class="eggrow"><b>Eltern</b><span>' + esc(egg.pa[0]) + ' &amp; ' + esc(egg.pa[1]) + '</span></div>';
    if (egg.hy && AA.FISH_BY[egg.hy[0]] && AA.FISH_BY[egg.hy[1]]) h += '<div class="eggrow"><b>🧬 Kreuzung</b><span>' + esc(AA.FISH_BY[egg.hy[0]].name) + ' × ' + esc(AA.FISH_BY[egg.hy[1]].name) + '</span></div>';
    if (egg.v) h += '<div class="eggrow gold"><b>✨ Es glitzert!</b><span>Da schlüpft eine Farbvariante – welche, siehst du erst beim Schlüpfen.</span></div>';
    if (g) {
      const N = AA.GENE_NAMES, cl = AA.fishClass({ g: g });
      h += '<div class="eggrow"><b>Gene</b><span>' + ['c', 's', 'v'].map(function (k) { return N[k][1] + ' ' + N[k][0] + ' ' + g[k]; }).join(' · ') + '</span></div>';
      h += '<div class="eggrow"><b>Klasse</b><span><i class="cls" style="background:' + cl.col + '">' + cl.id + '</i> ' + (cl.id === 'S' ? 'Top-Zucht!' : cl.id === 'A' ? 'Sehr gute Gene.' : cl.id === 'B' ? 'Ordentlich.' : 'Ganz normal.') + '</span></div>';
    }
    h += '<div class="eggrow"><b>Art</b><span>' + esc(f.info || '') + '</span></div>';
    h += '<div class="note">Tipp: Eier kannst du mit der Hand im Becken herumziehen und woanders hinlegen.</div>';
    return h + '<div class="row end"><button class="btn green" data-act="close">Alles klar</button></div></div></div>';
  }
  setInterval(function () {                           // Countdown im offenen Ei-Fenster mitlaufen lassen
    if (UI.modalKind !== 'egginfo' || !UI.egg) return;
    const el = document.getElementById('egg-left');
    if (!el) return;
    const tank = AA.tank();
    if (!tank || tank.eggs.indexOf(UI.egg) < 0) { el.textContent = 'geschlüpft! 🐣'; return; }
    el.textContent = AA.fmtDur(real(UI.egg.hatch));
  }, 1000);
  UI.buyFishDialog = function (id) {
    UI.buy = { id: id, sex: Math.random() < 0.5 ? 'm' : 'f', name: AA.pick(AA.NAMES) };
    UI.open('buyfish', buyHtml(), 'small');
    const inp = $('#buy-name'); if (inp) { inp.focus(); inp.select(); }
  };

  /* ---------- Erfolge ---------- */
  UI.openMedals = function () {
    const rows = AA.MEDALS.map(function (m) {
      const st = AA.medalState(m), goal = st.goal || m.goals[m.goals.length - 1], p = Math.round(Math.min(1, st.cur / goal) * 100);
      let tiers = '';
      AA.MEDAL_TIERS.forEach(function (tr, i) { tiers += '<span class="medal' + (i < st.got ? ' got' : (i < st.reached ? ' ready' : '')) + '" title="' + tr.name + ': ' + fmt(m.goals[i]) + '">' + tr.ico + '</span>'; });
      let act;
      if (st.claimable) { const tr = AA.MEDAL_TIERS[st.got]; act = '<button class="btn green" data-act="claim" data-id="' + m.id + '">' + tr.name + ' abholen</button><small>+' + fmt(tr.xp) + ' XP · +' + tr.pearls + ' ' + PEARL + '</small>'; }
      else if (st.got >= m.goals.length) act = '<span class="done">✓ Alle vier</span>';
      else act = '<span class="prog">' + fmt(Math.min(st.cur, goal)) + ' / ' + fmt(goal) + '</span>';
      return '<div class="quest' + (st.claimable ? ' ready' : '') + '"><div class="q-main"><div class="q-title">' + esc(m.name) + '</div><div class="q-desc">' + esc(m.desc) + '</div><div class="bar q"><i style="width:' + p + '%"></i></div></div>' +
        '<div class="q-tiers">' + tiers + '</div><div class="q-act">' + act + '</div></div>';
    }).join('');
    UI.open('medals', head('🏅 Erfolge') + '<div class="list">' + rows + '</div>', 'mid');
  };

  /* ---------- Schatzsuche: Fisch aussuchen ---------- */
  UI.openHunt = function () {
    const t = AA.tank(), left = AA.huntsLeft();
    let body;
    if (left <= 0) body = '<p>Für heute sind beide Tauchgänge verbraucht. Die nächste Schatzsuche gibt es in <b>' + AA.fmtShort(real(AA.dayLeft())) + '</b>.</p><div class="row end"><button class="btn grey" data-act="close">Okay</button></div>';
    else if (!t.fish.length) body = '<p>Du brauchst mindestens einen Fisch im Becken, der für dich tauchen geht.</p><div class="row end"><button class="btn green" data-act="tab" data-id="fish">Zum Shop</button></div>';
    else {
      body = '<p>Such dir einen Fisch aus. Er hat <b>' + B.huntSeconds + ' Sekunden</b>, um Münzen einzusammeln – ' + AA.say('beweg einfach die Maus', 'zieh einfach mit dem Finger') + '. Am Grund sind Kisten mit Extras versteckt. Heute noch <b>' + left + ' von ' + B.hunts + '</b>.</p><div class="pick">' +
        t.fish.map(function (f) { return '<button class="pickfish" data-act="hunt" data-id="' + f.id + '"><img src="' + AA.assets.variantSrc(AA.spriteKey(f), f.v, 160) + '" alt=""><span>' + (f.v ? '✨ ' : '') + esc(f.name) + '</span></button>'; }).join('') + '</div>';
    }
    UI.open('hunt', head('🧭 Schatzsuche') + '<div class="confirm">' + body + '</div>', 'mid');
  };

  /* ---------- Einstellungen ---------- */
  /* Runde 11: kein Spieltempo mehr (immer Echtzeit), keine Münz-/XP-Knöpfe, keine Räuber, nur noch die neuen Klänge – dafür oben das Profil und die Musik */
  UI.openSettings = function () {
    const s = AA.state, st = s.stats;
    UI.open('settings', head('⚙️ Einstellungen') +
      '<div class="list settings">' +
      (UI.profileSetting ? UI.profileSetting() : '') +
      '<div class="set"><div><b>Ton</b><small>Blubbern, Klopfen, Münzen.</small></div><div class="row"><button class="seg' + (s.settings.sound ? ' active' : '') + '" data-act="sound" data-id="1">An</button><button class="seg' + (!s.settings.sound ? ' active' : '') + '" data-act="sound" data-id="0">Aus</button></div></div>' +
      (UI.musicSetting ? UI.musicSetting() : '') +
      (UI.lifeSetting ? UI.lifeSetting() : '') +
      (UI.cloudSetting ? UI.cloudSetting() : '') + (UI.familySetting ? UI.familySetting() : '') +
      '<div class="set"><div><b>Deine Bilanz</b><small>' + fmt(st.bought) + ' Fische gekauft · ' + fmt(st.raised) + ' großgezogen · ' + fmt(st.eggs) + ' Eier · ' + fmt(st.trained) + ' Tricks beigebracht · ' + fmt(st.sold) + ' verkauft (' + fmt(st.soldCoins) + ' Münzen) · ' + fmt(st.cleans) + ' Bürstenstriche</small></div></div>' +
      '<div class="set kbd-only"><div><b>Tastenkürzel</b><small>1 Auswahl · 2 Füttern · 3 Putzen · 4 Tricks/Klopfen · 5 Deko · S Shop · K Büro · A Aufträge · B Sammelbuch · E Erfolge · G Geschenk · T Schatzsuche · U Becken-Übersicht · H Alle füttern · F Foto · L Licht · M Musik · Esc Schließen</small></div></div>' +
      '<div class="set"><div><b>Neu anfangen</b><small>Gespeichert wird automatisch im Browser' + (AA.cloud && AA.cloud.user ? ' und in der Wolke' : '') + '. Hier fängst du ganz von vorn an.</small></div><div class="row"><button class="btn red" data-act="reset">Neu anfangen</button></div></div>' +
      '</div>', 'mid');
  };

  UI.intro = function () {
    UI.open('intro', '<div class="hero"><div class="logo">Awesome <br>Aquarium</div>' +
      '<ul><li>🛒 Kauf im <b>Shop</b> deine ersten Fische – sie kommen als hungrige Babys.</li>' +
      '<li>🥫 <b>Füttern</b> kostet Futter aus dem Vorrat und bringt XP. Wer zu lange hungert, wird krank und wächst nicht.</li>' +
      '<li>🧽 <b>Putzen</b>: jeder Bürstenstrich gibt 10 XP. 🎓 <b>Trainieren</b>: ein Trick pro Wachstumsphase, dafür Münzen und Futter.</li>' +
      '<li>❤ ♂ + ♀ einer Art <b>paaren</b>, Nachwuchs großziehen, verkaufen. Dazu täglich Schatzkiste, 🎁 Geschenk und 🧭 Schatzsuche.</li>' +
      '<li>📋 Jeden Tag drei <b>Aufträge</b>, 📖 im <b>Sammelbuch</b> gibt es Belohnungen für jede neue Art – und beim Züchten schlüpft manchmal eine seltene ✨ <b>Farbvariante</b>.</li>' +
      '<li>🏢 Im <b>Büro</b> warten Kunden auf deine Fische. Gute Gene (Klasse A/S) und Farbvarianten bringen das große Geld – bau dir dein Aquaristik-Imperium.</li></ul>' +
      (AA.loadError ? '<div class="note warn">⚠️ Dein alter Spielstand ließ sich nicht lesen (' + esc(AA.loadError) + '). Er wurde nicht gelöscht, sondern im Browser-Speicher unter „' + AA.SAVE_KEY + '-kaputt“ aufgehoben.</div>' : '') +
      '<button class="btn green lg" data-act="introok">Los geht’s!</button></div>', 'small hero-m', true);
  };
  /* Einmalig nach einem Update: was neu ist – und wohin Süßwasser-Tiere umgezogen sind (state.js: migrateWater) */
  UI.news = function () {
    const s = AA.state, n = s.news || {}, w = n.water, li = [];
    if (w && (w.fish || w.crawl)) {
      const tk = s.tanks[w.tank];
      li.push('🌿 <b>Umzug:</b> ' + (w.fish ? w.fish + (w.fish === 1 ? ' Süßwasser-Bewohner' : ' Süßwasser-Bewohner') : '') + (w.fish && w.crawl ? ' und ' : '') + (w.crawl ? w.crawl + ' Krabbler' : '') +
        (w.fish + w.crawl === 1 ? ' ist' : ' sind') + ' nach „' + esc(tk ? tk.name : 'Süßwasser') + '“ gezogen' + (w.gift ? ' – das Süßwasser-Becken ist geschenkt' : '') + '.' + (w.left ? ' ' + w.left + ' hatten keinen Platz mehr und bleiben, wo sie sind.' : ''));
    }
    if (n.tempo) {                                     // Runde 15: neues Spieltempo
      li.push('⏱️ <b>Neues Tempo:</b> Fische wachsen jetzt in Minuten statt Stunden – Clownfisch ' + AA.fmtDur(AA.FISH_BY.clown.grow) + ', Skalar ' + AA.fmtDur(AA.FISH_BY.skalar.grow) +
        ', Blobfisch ' + AA.fmtDur(AA.FISH_BY.blobfish.grow) + ', Quastenflosser ' + AA.fmtDur(AA.FISH_BY.coelacanth.grow) + '. Was gerade wächst, behält seinen Fortschritt.');
      li.push('❤️ <b>Paaren:</b> Die Eltern dürfen wieder, sobald ihr Junges erwachsen wäre (höchstens nach ' + AA.fmtDur(AA.TEMPO.pauseMax) + ') – beim Clownfisch nach ' + AA.fmtDur(AA.FISH_BY.clown.pause) + '. Der Zuchtmeister arbeitet jetzt auch, während du weg bist.');
      li.push('⭐ <b>Neu: XP fürs Großziehen</b> – jeder Fisch, der bei dir erwachsen wird, bringt Erfahrung (Clownfisch ' + AA.FISH_BY.clown.xp + ', Blobfisch ' + AA.FISH_BY.blobfish.xp + ').');
      li.push('🌈 Farbvarianten sind seltener geworden (1 % je Ei), Farbfutter wirkt für die nächsten 3 Eier, der Markt erholt sich schon nach einer halben Stunde.');
    }
    if (n.curve) {                                     // Runde 16: flachere Level-Kurve hat jemanden direkt aufsteigen lassen (state.js)
      const k = n.curve.to - n.curve.from;
      li.push('📈 <b>Schneller leveln:</b> Ab Level 31 braucht jedes Level jetzt viel weniger XP. Du bist direkt auf Level ' + n.curve.to + ' gestiegen – +' + k + (k === 1 ? ' Perle' : ' Perlen') + '.');
    }
    if (n.bonus && UI.r14News) UI.r14News(li, n.bonus);            // Runde 14: Extra-Geschenk (js/socialui.js)
    if (n.v12 && UI.r12News) UI.r12News(li);           // Runde 12 (js/extrasui.js)
    if (UI.r11News) UI.r11News(li, n);                 // Runde 11 + Geschenk (js/socialui.js)
    if (n.v10 && UI.r10News) UI.r10News(li);           // Runde 10 (js/decorui.js)
    if (n.v9 && UI.wildNews) UI.wildNews(li);          // Runde 9 (js/wildui.js)
    if (n.v8) {                                        // Runde 8
      li.push('🐠 <b>Fische mit Charakter:</b> Grundfische bleiben am Boden und wühlen im Kies, Muränen und Aale wohnen in Verstecken, Clownfische verteidigen ihre Anemone, Seepferdchen halten sich an Pflanzen fest – und wer die Futterdose zückt, sieht alle betteln.');
      li.push('🐟 <b>Schwärme:</b> Ab ' + AA.SCHOOL.min + ' Neons, Danios, Chromis & Co. schwimmen sie sichtbar im Schwarm und wachsen ' + Math.round((AA.SCHOOL.grow - 1) * 100) + ' % schneller. Unter ' + AA.SCHOOL.lonely + ' sind sie einsam.');
      li.push('🧬 <b>Hybride:</b> Platy × Schwertträger, Karpfen × Koi, Beluga × Stör … fünf Kreuzungen, die es nur aus dem Zuchtplaner gibt. Büro → Zucht zeigt, was geht.');
      li.push('👑 <b>Sets und Titel:</b> Alle Farbvarianten einer Art = +' + Math.round((AA.SETBONUS - 1) * 100) + ' % Wert für diese Art. Komplette Gruppen bringen Titel und Perlen (Sammelbuch → Titel).');
      li.push('🧹 <b>Putzkolonne:</b> Krabbler haben Jobs – Algenfresser, Scheibenputzer, Resteverwerter. Ein gemischtes Team hält das Becken bis zu ' + Math.round(AA.CREW.maxFull * 100) + ' % sauberer. Neu: die Putzergarnele, die Kranke heilt.');
      li.push('🌈 <b>Spezialfutter</b> (Shop → Futter): Farbfutter, Turbofutter, Medizin und Lebendfutter für große Jäger. Beim Füttern wählst du die Sorte – und <b>„Alle füttern“</b> versorgt jedes Becken mit einem Klick (Taste H).');
      li.push('📋 <b>Becken-Vorlagen</b> (Shop → Kies & Hintergrund): Kulisse, Boden und Deko speichern und in einem anderen Becken anwenden – fehlende Deko wird nachgekauft.');
      li.push('🪟 <b>Mehr Tiefe:</b> Seitenscheiben, feinerer Kies in großen Becken, ein riesiges Meeresbecken – und ein neuer Platscher, wenn Fische einziehen (Einstellungen → Klang).');
    }
    if (n.v7) {                                        // Runde 7
      li.push('🪸 <b>Biotope:</b> Passen Kulisse, Boden, Deko und Bewohner zusammen (Riff, Amazonas, Japan-Teich, Heimischer Fluss, Tiefsee), gibt es Bonus auf Wachstum, Glück und Wert. Stand: Shop → Aussehen.');
      li.push('🦈 <b>Große Jäger:</b> Hecht, Wels, Hai & Co. schnappen sich gern Lebendfutter.');
      li.push('🏔️ <b>20 neue Böden, 10 Boden-Formen</b> (Hang, Tal, Hügel, Terrasse, Dünen …) und <b>20 neue Kulissen</b> – alles im Shop unter Aussehen.');
      li.push('🗂️ <b>Becken-Übersicht</b> (Taste U oder der Knopf neben dem Becken-Namen): alle Becken mit Warnsymbolen, ein Klick bringt dich hin.');
      li.push('📋 <b>„Während du weg warst“</b>: ein Bericht statt vieler Einzelmeldungen. Und das Spiel <b>startet schneller</b> – geladen wird erst, was in deinen Becken schwimmt.');
    }
    if (n.v6) {                                        // Runde 6
      li.push('🧬 <b>Zuchtplaner:</b> „Paaren“ öffnet jetzt den Planer – du wählst beide Eltern und siehst vorher die Chancen auf Klasse und Farbe.');
      li.push('🥚 <b>Zuchtstation</b> (Shop → Aquarien): mach ein Becken zum <b>Brutbecken</b> (Eier ×2) oder <b>Aufzuchtbecken</b> (Jungfische +50 %).');
      li.push('👥 <b>Personal & Verträge</b> im Büro: Pfleger, Verkäufer und Zuchtmeister gegen Tageslohn – und Lieferverträge mit festem Preis (wer zu spät liefert, zahlt Strafe).');
      li.push('🐟 <b>14 neue Tiere:</b> Karpfen mit sechs Zuchtformen, Forelle, Lachs, Hecht, Wels, Stör & Beluga (Kaviar ernten!), Zitteraal, Schwertfisch, Dorade, Seeteufel, Schleie, Rotflossen-Antennenwels, Hummer.');
      li.push('🦈 <b>Meeresbecken</b> ab Level ' + AA.OCEAN.lvl + ': Rochen, Haie, Schwertfisch und Schildkröte ziehen nur noch dort neu ein (wer schon da ist, darf bleiben).');
      li.push('📐 Becken <b>wachsen jetzt sichtbar</b> mit jedem Ausbau, lassen sich <b>umbenennen</b> (Klick auf den Namen), Grundfische bleiben am Boden, Clownfische wohnen in der Anemone – und die Krabbler haben keinen Mund mehr.');
    }
    if (n.v5) {                                        // Runde 5
      li.push('🧬 <b>Gene:</b> Jeder Fisch hat jetzt Farbe, Größe und Vitalität (je 1–5) und daraus eine <b>Güteklasse</b> C, B, A oder S. Babys erben von den Eltern – züchte mit deinen Besten!');
      li.push('🏢 <b>Büro</b> (unten links, Taste K): <b>Kunden</b> bestellen Fische mit Frist und zahlen gut, <b>Markt</b> mit Tageskurs und Trend-Arten, <b>Bilanz</b> mit Gewinn und Lagerwert.');
      li.push('💰 Klasse und Farbvariante machen jetzt den Preis: Klasse S ×2,75, Regenbogen ×10. Aber Vorsicht – wer dieselbe Art massenhaft verkauft, drückt den Preis.');
      li.push('⭐ Mit jedem erfüllten Auftrag steigt dein <b>Ruf</b>: vom Hobbyzüchter bis zum Aquaristik-Imperium. Ab „Kleiner Zuchtbetrieb“ bestellen Hotels, ab „Fachbetrieb“ Sammler.');
    }
    if (n.v4) {                                        // Runde 4
      const C = AA.bookCounts();
      li.push('✨ <b>Farbvarianten:</b> Beim Züchten schlüpft manchmal eine Mutation – Albino, Gold, Amethyst, Sternennacht oder der legendäre Regenbogen. Ein Ei mit Variante glitzert; Eltern vererben ihre Farbe oft weiter.');
      li.push('📖 <b>Sammelbuch</b> (unten links, Taste B): alle ' + C.speciesMax + ' Arten und ' + C.varsMax + ' Farbvarianten. Jede erste Entdeckung bringt eine Belohnung' + (C.open ? ' – <b>' + C.open + ' warten schon</b> für die Arten, die du bereits hattest' : '') + '.');
      li.push('📋 <b>Tagesaufträge</b> (Taste A): jeden Spieltag drei kleine Aufgaben. Alle drei geschafft = Perle + Stempel auf der Wochenkarte – und die bringt Glitzer-Eier mit sicherer Farbvariante.');
      if (!('water' in n)) li.push('⭐ Seesterne und Seeigel drehen sich an der Scheibe nicht mehr – sie kleben jetzt ruhig, wie es sich gehört.');
    }
    if ('water' in n) {                                // Runde 3 (Stand von davor)
    li.push('🌊 🌿 <b>Meerwasser und Süßwasser:</b> Jedes Becken hat jetzt eine Wasserart, Fische und Krabbler leben nur in ihrer. Dein erstes Becken ist Meerwasser' + (AA.hasWater('fresh') ? '.' : '; das Süßwasser-Becken gibt es ab Level ' + AA.FRESH_TANK.lvl[0] + ' im Shop unter „Aquarien“.'));
    li.push('📐 <b>Deko einrichten:</b> antippen, dann größer oder kleiner ziehen – und auf Plattformen (flache Steine, Stümpfe, Stege) kannst du andere Deko draufstellen.');
    li.push('🖼️ <b>Gemalte Hintergründe</b>, 21 neue Fischarten, hohe Pflanzen und neue Krabbler – alles im Shop. Schnecken, Seesterne und Seeigel klettern jetzt auch an die Scheibe.');
    li.push('😢 <b>Ehrliche Gesichter:</b> Wer Hunger hat, krank ist oder im Dreck sitzt, schaut jetzt traurig – ein Blick ins Becken zeigt, wem etwas fehlt.');
    }
    UI.open('news', '<div class="hero news"><div class="h2">Neu im Aquarium</div><ul>' + li.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul><button class="btn green lg" data-act="newsok">Alles klar</button></div>', 'small hero-m', true);
  };
  UI.welcomeBack = function (sum) {
    const lines = [], t = AA.tank(), s = AA.state;
    if (sum.matured) lines.push('✨ ' + sum.matured + (sum.matured === 1 ? ' Fisch ist' : ' Fische sind') + ' erwachsen geworden' + (sum.xp ? ' – +' + AA.fmt(sum.xp) + ' XP' : ''));
    if (sum.bred) lines.push('🧑‍🔬 Der Zuchtmeister hat ' + sum.bred + (sum.bred === 1 ? ' Paar' : ' Paare') + ' gepaart');
    if (sum.hatched) lines.push('🐣 ' + sum.hatched + (sum.hatched === 1 ? ' Baby ist' : ' Babys sind') + ' geschlüpft');
    (sum.variants || []).slice(0, 4).forEach(function (x) {      // Farbvarianten, die in der Zwischenzeit geschlüpft sind
      lines.push('✨ <b>' + esc(AA.speciesName(x.sp, x.v)) + '</b> geschlüpft – ' + AA.VAR_BY[x.v].rare + (x.fresh ? ', neu im Sammelbuch!' : ''));
    });
    if (sum.variants && sum.variants.length > 4) lines.push('✨ … und ' + (sum.variants.length - 4) + ' weitere Farbvarianten');
    if (AA.questOpen() > 0) lines.push('📋 Bei den Aufträgen wartet etwas zum Abholen');
    if (sum.ordersFailed) lines.push('⌛ ' + sum.ordersFailed + (sum.ordersFailed === 1 ? ' Kundenauftrag ist' : ' Kundenaufträge sind') + ' abgelaufen');
    if (AA.ordersReady()) lines.push('📦 Du kannst ' + AA.ordersReady() + (AA.ordersReady() === 1 ? ' Kundenauftrag' : ' Kundenaufträge') + ' beliefern');
    const tr = AA.marketTrends(); if (tr.length) lines.push('📈 Heute gefragt: ' + tr.map(function (x) { return esc(AA.FISH_BY[x.sp].name) + ' +' + Math.round((x.mult - 1) * 100) + ' %'; }).join(', '));
    if (sum.sick) lines.push('🤒 ' + sum.sick + (sum.sick === 1 ? ' Fisch ist' : ' Fische sind') + ' vor Hunger krank geworden – füttern hilft');
    if (!s.daily.chest) lines.push('💰 Die Schatzkiste ist gefüllt');
    if (!s.daily.gift) lines.push('🎁 Dein Tagesgeschenk wartet');
    if (t.fish.length && AA.fedAvg(t) < 0.3) lines.push('🍽️ Deine Fische haben Hunger');
    if (t.dirt > 0.5) lines.push('🧽 Das Becken braucht die Bürste');
    if (!lines.length) lines.push('🌊 Alles ruhig im Becken');
    UI.open('welcome', '<div class="hero"><div class="h2">Willkommen zurück!</div><div class="sub">Du warst ' + AA.fmtDur(sum.real || sum.seconds) + ' weg.</div><ul>' + lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul><button class="btn green lg" data-act="close">Weiter</button></div>', 'small hero-m');
  };

  /* ---------- Karte rechts: ausgewählter Fisch / ausgewählte Deko ---------- */
  function fishCardHtml(f) {
    const d = f.d, multi = AA.state.tanks.length > 1;
    return '<button class="x" data-act="desel" title="Schließen">✕</button>' +
      '<div class="c-top"><div class="c-pic"><img id="c-img" alt=""></div><div class="c-id"><div class="c-name"><span id="c-name">' + esc(d.name) + '</span><span class="sex ' + d.sex + '">' + (d.sex === 'm' ? '♂' : '♀') + '</span><button class="mini" data-act="rename" title="Umbenennen">✏️</button></div><div class="c-sub" id="c-sub"></div><div id="c-var"></div><div id="c-gen"></div></div></div><div id="c-life"></div>' +
      '<div class="bar grow"><i id="c-grow"></i><span id="c-growtext"></span></div>' +
      '<div class="bar hunger"><i id="c-hunger"></i><span id="c-hungertext"></span></div>' +
      '<div class="c-row"><span id="c-tricks"></span><span id="c-val"></span></div>' +
      '<div class="c-btns"><button class="btn blue" id="c-train" data-act="train">🎓 Trainieren</button><button class="btn pink" id="c-breed" data-act="breed">❤ Paaren</button></div>' +
      '<div class="c-btns"><button class="btn green" id="c-sell" data-act="sell">Verkaufen</button>' + (multi ? '<button class="btn grey" data-act="movefish" title="In ein anderes Becken setzen">⇄ Umsetzen</button>' : '') + '</div>' +
      '<div class="c-btns hidden" id="c-deliver-row"><button class="btn violet" id="c-deliver" data-act="deliver">📦 Liefern</button></div>' +
      '<div class="c-btns hidden" id="c-farm-row"><button class="btn gold" id="c-caviar" data-act="caviar">🥄 Kaviar</button><button class="btn violet hidden" id="c-contract" data-act="cdeliver">📜 Vertrag</button></div>' +
      '<div class="c-hint" id="c-hint"></div>';
  }
  function pct(v) { return Math.round(v * 100); }
  /* Größe einstellen: Regler mit − / + und Marke bei 100 %; Stücke mit fester Größe bekommen nur ein Schloss */
  function sizeHtml(o, def) {
    const r = AA.decoRange(def);
    if (!r) return '<div class="c-size fixed">🔒 Feste Größe<small>' + (def.crawl || def.alive ? 'Ein Tier lässt sich nicht aufpusten.' : 'Hier zählt, was drin ist.') + '</small></div>';
    return '<div class="c-size">' +
      '<div class="c-size-top"><span>Größe</span><b id="c-sizeval"></b></div>' +
      '<div class="c-size-row"><button class="rnd" data-act="sizedn" title="Kleiner (Taste −)">−</button>' +
      '<input type="range" id="c-size" min="' + pct(r[0]) + '" max="' + pct(r[1]) + '" step="1" value="' + pct(AA.decoScale(o)) + '" aria-label="Größe in Prozent">' +
      '<button class="rnd" data-act="sizeup" title="Größer (Taste +)">+</button></div>' +
      '<div class="c-size-foot"><span>geht von ' + pct(r[0]) + ' bis ' + pct(r[1]) + ' %</span><button class="lnk" data-act="size1" id="c-size1">↺ Originalgröße</button></div>' +
      '</div>';
  }
  UI.syncSize = function () {
    const o = V.selDeco, inp = $('#c-size');
    if (!o || !inp) return;
    const r = AA.decoRange(AA.DECO_BY[o.type]);
    if (!r) return;
    const s = AA.decoScale(o), p = pct(s), card = $('#card');
    if (+inp.value !== p) inp.value = p;
    inp.style.setProperty('--p', ((s - r[0]) / (r[1] - r[0])).toFixed(4));          // gefüllter Teil der Schiene
    inp.style.setProperty('--one', ((1 - r[0]) / (r[1] - r[0])).toFixed(4));        // Marke bei 100 %
    $('#c-sizeval').textContent = p + ' %';
    card.querySelector('[data-act="sizedn"]').disabled = s <= r[0] + 0.001;
    card.querySelector('[data-act="sizeup"]').disabled = s >= r[1] - 0.001;
    $('#c-size1').style.visibility = Math.abs(s - 1) < 0.005 ? 'hidden' : 'visible';
  };
  function decoCardHtml(o) {
    const def = AA.DECO_BY[o.type], multi = AA.state.tanks.length > 1;
    return '<button class="x" data-act="desel" title="Schließen">✕</button>' +
      '<div class="c-top"><div class="c-pic deco">' + pic('deco/' + o.type) + '</div><div class="c-id"><div class="c-name">' + esc(def.name) + '</div><div class="c-sub">' + AA.DECO_CAT[def.cat] + '</div></div></div>' +
      '<div class="c-hint" id="c-dhint"></div>' + sizeHtml(o, def) +
      (UI.decoCardExtra ? UI.decoCardExtra(o, def) : '') +
      '<div class="c-btns">' + (def.crawl ? '' : '<button class="btn blue" data-act="flip">↔ Spiegeln</button>') + (def.daily ? '' : '<button class="btn green" data-act="selldeco">Verkaufen · ' + fmt(AA.decoSellValue(o)) + '</button>') + '</div>' +
      (UI.decoCardStore ? UI.decoCardStore(o, def) : '') +
      (multi && !def.daily ? '<div class="c-btns"><button class="btn grey" data-act="movedeco">⇄ In ein anderes Becken</button></div>' : '');
  }
  UI.buildCard = function () {
    const card = $('#card');
    // Deko in der rechten Beckenhälfte: Karte nach links, damit sie nicht genau auf dem Stück liegt, das man gerade einrichtet
    card.classList.toggle('left', !!(V.selDeco && !V.sel && V.selDeco.x > AA.W / 2));
    if (V.sel) { card.innerHTML = fishCardHtml(V.sel); card.dataset.kind = 'fish'; card.classList.remove('hidden'); }
    else if (V.selDeco) { card.innerHTML = decoCardHtml(V.selDeco); card.dataset.kind = 'deco'; card.classList.remove('hidden'); }
    else { card.classList.add('hidden'); card.innerHTML = ''; card.dataset.kind = ''; }
    UI.updateCard();
    UI.syncSize();
    V.cardZone = card.classList.contains('hidden') ? null : { x0: card.offsetLeft, x1: card.offsetLeft + card.offsetWidth, y1: card.offsetTop + card.offsetHeight };
  };
  const MATE_TXT = { busyme: 'Balzt gerade …', hungryme: 'Erst satt werden', busy: 'Partner balzt …', nomale: 'Kein ♂ da', nofemale: 'Kein ♀ da', hungry: 'Paar ist hungrig', dirty: 'Becken zu schmutzig', full: 'Becken voll', coins: 'Zu wenig Münzen', spawn: 'Laicht nur im Süßwasser', sterile: '🧬 Unfruchtbar' };
  const MATE_HINT = { nomale: 'Zum Paaren fehlt ein erwachsenes ♂ Männchen dieser Art.', nofemale: 'Zum Paaren fehlt ein erwachsenes ♀ Weibchen dieser Art.',
    hungryme: 'Zum Balzen muss dieser Fisch satt und gesund sein.', busyme: 'Dieser Fisch balzt gerade – gleich liegt das Ei im Becken.', cdme: 'Nach der Balz ruht sich jeder Fisch so lange aus, bis sein Junges erwachsen wäre (Ei + Großwerden). Andere Paare dürfen in der Zeit trotzdem.',
    hungry: 'Beide Eltern müssen satt und gesund sein.', dirty: 'Erst putzen – gepaart wird nur im sauberen Becken.', full: 'Kein Platz für ein Ei: Becken vergrößern oder Fische verkaufen.',
    coins: 'Die Paarung kostet den halben Kaufpreis.', cd: 'Alle passenden Partner ruhen sich gerade nach ihrer Balz aus.', busy: 'Alle passenden Partner balzen gerade schon.', spawn: 'Lachse laichen nur im Süßwasser – setz das Paar in ein Süßwasser-Becken um.', pair: 'Dieses Paar kann gerade nicht.',
    sterile: 'Hybride sind unfruchtbar – einen neuen gibt es nur, wenn du die beiden Eltern-Arten wieder kreuzt.' };
  const PHASE_TXT = ['Baby · Phase 1 von 4', 'Baby · Phase 2 von 4', 'Jungfisch · Phase 3 von 4', 'Jungfisch · Phase 4 von 4', 'Erwachsen'];
  UI.updateCard = function () {
    const card = $('#card'), t = AA.tank();
    if (card.dataset.kind === 'fish' && V.sel) {
      const f = V.sel, d = f.d, def = f.def;
      if (!$('#c-img')) return;
      const key = AA.spriteKey(d), im = $('#c-img'), vk = key + '|' + (d.v || '');
      if (im.dataset.k !== vk) {                       // Bild in der Farbe der Variante, darunter Name und Seltenheit
        im.src = AA.assets.variantSrc(key, d.v, 160); im.dataset.k = vk; im.classList.toggle('inv', !!def.inv);
        const vd = d.v && AA.VAR_BY[d.v];
        $('#c-var').innerHTML = vd ? UI.varChip(d.v, true) + '<small>' + vd.rare + '</small>' : '';
        $('#card').classList.toggle('variant', !!vd);
      }
      const ph = AA.phase(d);
      $('#c-sub').textContent = def.name + ' · ' + PHASE_TXT[ph];
      if (d.adult) { $('#c-grow').style.width = '100%'; $('#c-growtext').textContent = 'Ausgewachsen ✓'; }
      else {
        $('#c-grow').style.width = Math.round(Math.min(1, d.age / def.grow) * 100) + '%';
        $('#c-growtext').textContent = d.sick ? 'Krank – wächst nicht' : 'Erwachsen in ' + AA.fmtShort(real(AA.growLeft(d)));
      }
      $('#c-hunger').style.width = Math.round(d.hunger * 100) + '%';
      $('#c-hungertext').textContent = d.sick ? '🤒 Krank – füttern!' : (d.hunger <= 0 ? '😫 Ausgehungert' : (d.hunger < 0.25 ? '🍽️ Hungrig' : (d.hunger < B.hungryBelow ? '😋 Hat Appetit' : '😊 Satt')));
      let stars = '';
      for (let i = 0; i < AA.TRICKS.length; i++) stars += i < d.tricks.length ? '★' : '☆';
      const ts = $('#c-tricks');
      ts.textContent = stars; ts.title = d.tricks.length ? 'Tricks: ' + d.tricks.map(function (id) { return AA.TRICK_BY[id].name; }).join(', ') : 'Noch keine Tricks';
      const val = AA.fishValue(d);
      $('#c-val').innerHTML = 'Wert: <b>' + fmt(val) + '</b> ' + COIN;
      $('#c-sell').textContent = 'Verkaufen · ' + fmt(val);
      const tr = AA.trainStatus(d), tb = $('#c-train');
      tb.disabled = !tr.ok;
      tb.textContent = tr.ok ? '🎓 ' + tr.trick.name : (tr.why === 'wait' ? '🎓 in ' + AA.fmtShort(real(tr.wait)) : (tr.why === 'done' ? '🎓 Alle Tricks' : (tr.why === 'still' ? '🎓 Macht keine Tricks' : (tr.why === 'sick' ? '🎓 Krank' : '🎓 Hungrig'))));
      const ms = AA.fishMateStatus(d, t), bb = $('#c-breed');      // Runde 11: Pause je Fisch
      const canMate = d.adult;
      bb.disabled = !canMate || !ms.ok;
      bb.textContent = !canMate ? '❤ Zu jung' : (ms.ok ? '❤ Paaren · ' + fmt(ms.cost) : ((ms.why === 'cd' || ms.why === 'cdme') ? '❤ ' + (ms.why === 'cd' ? 'Partner ' : '') + 'in ' + AA.fmtShort(real(ms.cd)) : MATE_TXT[ms.why] || '❤ Paaren'));
      let hint = '';
      if (d.sick) hint = 'Krank vor Hunger: wächst nicht und ist weniger wert. Ein paar Bissen machen ' + (d.sex === 'm' ? 'ihn' : 'sie') + ' wieder gesund.';
      else if (tr.ok) hint = 'Bereit fürs Training: Trick „' + tr.trick.name + '“ – bringt 1–8 Münzen und 1–8 Futter.';
      else if (!d.adult) hint = 'Erwachsen ist ' + (d.sex === 'm' ? 'er' : 'sie') + ' mehr wert – und erst dann können Kunden ' + (d.sex === 'm' ? 'ihn' : 'sie') + ' kaufen. Nächstes Training in der nächsten Wachstumsphase.';
      else if (!ms.ok) hint = MATE_HINT[ms.why] || '';
      else {
        hint = 'Jede Balz bringt ein Ei – danach ruhen sich die beiden ' + AA.fmtDur(real(AA.mateCooldown(AA.tank(), d.sp, false))) + ' aus. ';
        if (d.v) hint += '✨ ' + AA.VAR_BY[d.v].name + ' vererbt sich an ' + Math.round(AA.VAR.inherit1 * 100) + ' % der Eier – mit gleichfarbigem Partner an ' + Math.round(AA.VAR.inherit2 * 100) + ' %.';
        else hint += '✨ Chance auf eine Farbvariante im nächsten Ei: ' + String(Math.round(AA.variantChance() * 1000) / 10).replace('.', ',') + ' %.';
      }
      $('#c-hint').textContent = hint;
      if (UI.cardBiz) UI.cardBiz(d);
      if (UI.cardFarm) UI.cardFarm(d); if (UI.cardEco) UI.cardEco(d);                 // Gene, Klasse, Liefern-Knopf, Kurs (js/bizui.js)
      if (UI.cardLife) UI.cardLife(d);                                                  // Schwarm, Anemone, Hybrid, Spezialfutter, Kreuzen-Knopf (js/lifeui.js)
    } else if (card.dataset.kind === 'deco' && V.selDeco) {
      const o = V.selDeco, el = $('#c-dhint'), def = AA.DECO_BY[o.type];
      if (!el) return;
      if (def.daily) {
        const ci = AA.chestInfo();
        el.textContent = ci.ready ? '✨ Gefüllt – einfach antippen! (ca. ' + fmt(ci.value) + ' Münzen' + (ci.pearls ? ' + 1 Perle' : '') + ') Je sauberer das Becken und je zufriedener die Fische, desto mehr.' : 'Heute schon geleert. Wieder gefüllt in ' + AA.fmtShort(real(AA.dayLeft())) + '.';
      } else if (def.crawl) el.textContent = (def.info ? def.info + ' ' : '') + (V.onGlass && V.onGlass(o) ? 'Klebt gerade an der Scheibe – du siehst die Unterseite. ' : '') + 'Hält still, solange du ihn ausgewählt hast – zum Umsetzen einfach ziehen.';
      else {
        const base = o.on && V.decoById(o.on), kids = def.tops ? V.stackKids(o).length : 0;
        let tx = '';
        if (base) tx = 'Steht auf „' + AA.DECO_BY[base.type].name + '“ und wandert mit. Zum Herunternehmen einfach auf den Kies ziehen. ';
        else if (def.tops) tx = '🧱 Stellfläche: Zieh andere Deko oben drauf' + (kids ? ' (' + kids + ' Stück ' + (kids === 1 ? 'steht' : 'stehen') + ' schon da)' : '') + ' – sie wandert dann mit. ';
        else tx = 'Ziehen verschiebt (nach oben = weiter hinten). ';
        el.textContent = tx + (AA.decoRange(def) ? 'Größe: runder Anfasser am Rahmen, Regler oder Tasten + und −.' : '');
      }
    }
  };

  function startRename() {
    const f = V.sel; if (!f) return;
    const span = $('#c-name'); if (!span || span.querySelector('input')) return;
    span.innerHTML = '<input id="c-rename" maxlength="14" value="' + esc(f.d.name) + '" spellcheck="false">';
    const inp = $('#c-rename'); inp.focus(); inp.select();
    const done = function () { const v = inp.value.trim(); if (v) f.d.name = v; span.textContent = f.d.name; AA.save(); };
    inp.addEventListener('blur', done);
    inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = f.d.name; inp.blur(); } });
  }
  function tankChooser(kind) {
    const s = AA.state, WHY = { ocean: ' – nur Meeresbecken', deep: ' – nur Tiefsee-Becken', nodeep: ' – kein Tiefsee-Tier', big: ' – braucht das große Becken' };
    const rows = s.tanks.map(function (tk, i) {
      if (i === s.active) return '';
      const wrong = kind === 'fish' ? !AA.livesIn(AA.FISH_BY[V.sel.d.sp], tk) : !AA.decoFits(AA.DECO_BY[V.selDeco.type], tk);
      const full = wrong || (kind === 'fish' ? AA.count(tk) >= AA.cap(tk) : !AA.decoRoom(tk, AA.DECO_BY[V.selDeco.type]));
      return '<button class="btn ' + (full ? 'grey' : 'blue') + '" data-act="moveto" data-id="' + i + '"' + (full ? ' disabled' : '') + '>' + AA.tankIco(tk) + ' ' + esc(tk.name) + ' (' + AA.count(tk) + '/' + AA.cap(tk) + ')' + (wrong ? (WHY[kind === 'fish' ? AA.whyNot(AA.FISH_BY[V.sel.d.sp], tk) : 'water'] || ' – anderes Wasser') : (full ? ' – voll' : '')) + '</button>';
    }).join('');
    UI.pending = { kind: kind, obj: kind === 'fish' ? V.sel.d : V.selDeco };
    UI.open('move', head('⇄ Wohin?') + '<div class="confirm"><div class="col">' + rows + '</div></div>', 'small');
  }

  /* ---------- Klicks ---------- */
  function onCardClick(e) {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act, f = V.sel, o = V.selDeco;
    if (AA.visit && act !== 'desel') return;          // zu Besuch: Karten sind nur zum Ansehen
    if (act === 'desel') { V.select(null); V.selectDeco(null); }
    else if (act === 'rename') startRename();
    else if (act === 'sell' && f) {
      UI.pending = { kind: 'sell', obj: f.d };
      UI.open('confirm', head('Verkaufen?') + '<div class="confirm"><p><b>' + esc(f.d.name) + '</b> für <b>' + fmt(AA.fishValue(f.d)) + ' Münzen</b> verkaufen?' + (f.d.adult ? '' : ' Erwachsen wäre ' + (f.d.sex === 'm' ? 'er' : 'sie') + ' ' + fmt(f.def.sell) + ' wert.') + '</p>' +
        (function () {                                 // Hinweise vor dem Verkauf: lieber an einen Kunden? Zuchttier?
          const o = AA.bestOrderFor(f.d), cl = AA.fishClass(f.d).id, notes = [];
          if (o && o.pay > AA.fishValue(f.d)) notes.push('📦 <b>' + esc(o.name) + '</b> zahlt ' + fmt(o.pay) + ' Münzen – liefern statt verkaufen (Knopf auf der Karte oder im Büro)?');
          if (cl === 'S' || cl === 'A') notes.push('🧬 <b>Klasse ' + cl + '</b> – ein Zuchttier: Babys erben die Gene. Behalten lohnt sich oft mehr.');
          if (f.d.v) notes.push('✨ <b>Farbvariante ' + esc(AA.VAR_BY[f.d.v].name) + '</b> (' + AA.VAR_BY[f.d.v].rare + '): vererbt ihre Farbe an ' + Math.round(AA.VAR.inherit1 * 100) + ' % der Eier.');
          return notes.length ? '<div class="note warn">' + notes.join('<br>') + '</div>' : '';
        })() +
        '<div class="row end"><button class="btn grey" data-act="close">Behalten</button><button class="btn green" data-act="sellyes">Verkaufen</button></div></div>', 'small');
    }
    else if (act === 'deliver' && f) UI.deliverFish(b.dataset.id, f.d);
    else if ((act === 'caviar' || act === 'cdeliver') && f && UI.farmClick) UI.farmClick(act, b.dataset.id, b);
    else if (act === 'train' && f) { const r = AA.train.start(f.d); if (!r.ok) UI.toast('⚠️ Training geht gerade nicht.', 'warn'); }
    else if (act === 'breed' && f) {
      const st = AA.fishMateStatus(f.d);           // Zuchtplaner: beide Eltern wählen, Prognose sehen (js/farmui.js)
      if (st.ok && UI.openPlanner) UI.openPlanner(f.d);
      else if (UI.lifeBreed && UI.lifeBreed(f.d)) { /* Reinzucht geht nicht, aber eine Kreuzung: Planer ist offen */ }
      else if (!st.ok) UI.toast('⚠️ ' + (MATE_HINT[st.why] || 'Gerade nicht möglich'), 'warn');
      UI.updateCard();
    }
    else if (act === 'movefish' && f) tankChooser('fish');
    else if (act === 'movedeco' && o) tankChooser('deco');
    else if (act === 'flip' && o) { o.flip = !o.flip; AA.audio.play('click'); AA.save(); }
    else if ((act === 'sizeup' || act === 'sizedn') && o) V.stepDeco(o, act === 'sizeup' ? 1 : -1);
    else if (act === 'size1' && o) { V.resizeDeco(o, 1); AA.audio.play('click'); AA.save(); }
    else if (act === 'selldeco' && o) { const v = AA.sellDeco(o); UI.toast('Verkauft für ' + fmt(v) + ' Münzen'); AA.audio.play('coin'); V.selectDeco(null); }
    else if (o && UI.decoAct) UI.decoAct(act, o, b);   // Runde 10: Lager, Drehen, Ebene, Duplizieren, Farbe (js/decorui.js)
  }
  function onCardInput(e) {                             // Regler: sofort mitziehen, nahe 100 % einrasten
    if (e.target.id !== 'c-size' || !V.selDeco) return;
    let v = +e.target.value;
    if (Math.abs(v - 100) <= 3) v = 100;
    V.resizeDeco(V.selDeco, v / 100);
    UI.syncSize();
  }
  UI.gift = function () {
    const s = AA.state;
    if (s.daily.gift) { UI.toast('🎁 Heute schon abgeholt – nächstes Geschenk in ' + AA.fmtShort(real(AA.dayLeft())) + '.'); return; }
    const n = AA.claimGift();
    AA.audio.play('chest'); UI.toast('🎁 Tagesgeschenk: <b>+' + n + ' Prisen Futter</b>', 'gold');
    UI.refresh(); AA.save();
  };
  function onModalClick(e) {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act, id = b.dataset.id, s = AA.state;
    AA.audio.play('click');
    if (UI.cloudClick && UI.cloudClick(act, id, b)) return;       // Anmelden, Profil, Freunde, Besuch (js/cloudui.js) – sperrt im Besuch alles außer „Schließen“
    if (UI.wildClick && UI.wildClick(act, id, b)) return;         // Tiefsee-Becken (js/wildui.js)
    if (UI.socialClick && UI.socialClick(act, id, b)) return;     // Runde 11: Profil, Musik (js/socialui.js)
    if (UI.familyClick && UI.familyClick(act, id, b)) return;     // Runde 10: Rangliste, Login-Kalender, Testfreund, Deko-Modus aus dem Shop (js/familyui.js)
    if (UI.r12Click && UI.r12Click(act, id, b)) return;           // Runde 12: Licht-Studio, Geschenke, Pokale (js/extrasui.js)
    if (UI.lifeClick && UI.lifeClick(act, id, b)) return;         // Kreuzen, Titel, Vorlagen, Alle füttern, Klang (js/lifeui.js)
    if (UI.extraClick && UI.extraClick(act, id, b)) return;       // Aufträge, Wochenkarte, Sammelbuch, Glitzer-Eier (js/metaui.js)
    if (UI.ecoClick && UI.ecoClick(act, id, b)) return;           // Boden-Form, Übersicht, Räuber-Schalter (js/ecoui.js)
    if (UI.farmClick && UI.farmClick(act, id, b)) return;         // Zuchtplaner, Personal, Verträge, Zuchtstation (js/farmui.js)
    if (UI.bizClick && UI.bizClick(act, id, b)) return;           // Büro: Kunden, Markt, Bilanz (js/bizui.js)
    if (act === 'close') UI.close();
    else if (act === 'tab') UI.openStore(id);
    else if (act === 'buyfish') UI.buyFishDialog(id);
    else if (act === 'backstore') UI.openStore('fish');
    else if (act === 'rndname') { UI.buy.name = AA.pick(AA.NAMES); $('#buy-name').value = UI.buy.name; }
    else if (act === 'sex') { UI.buy.name = $('#buy-name').value; UI.buy.sex = id; UI.open('buyfish', buyHtml(), 'small'); }
    else if (act === 'confirmfish' || act === 'confirmfishp') {
      const name = ($('#buy-name').value || '').trim().slice(0, 14) || AA.pick(AA.NAMES);
      const r = AA.buyFish(UI.buy.id, name, UI.buy.sex, act === 'confirmfishp');
      if (typeof r === 'string') UI.fail(r);
      else { UI.close(); UI.toast('🐟 ' + esc(r.name) + ' ist eingezogen – und hat Hunger!'); }
    }
    else if (act === 'buyfood') {
      const r = AA.buyFood(id), def = AA.FOOD_BY[id];
      if (typeof r === 'string') UI.fail(r);
      else { AA.audio.play('buy'); UI.toast(def.days ? '⏲️ Futterautomat läuft: ' + def.days + ' Tage Ruhe in „' + esc(AA.tank().name) + '“.' : (def.kind ? def.ico + ' +' + def.n + '× ' + esc(def.name) + ' – beim Füttern in der Leiste über dem Werkzeug wählen.' : '🥫 +' + def.food + ' Prisen Futter')); UI.openStore(); }
    }
    else if (act === 'gift') { UI.gift(); UI.openStore(); }
    else if (act === 'buydeco') {
      const r = AA.buyDeco(id);
      if (typeof r === 'string') UI.fail(r);
      else {
        UI.close(); AA.audio.play('buy');
        if (id === 'bubbleclam') { if (s.active !== 0) AA.switchTank(0); UI.toast('🦪 Die Blubber-Muschel ersetzt jetzt die Schatzkiste in Aquarium 1.', 'gold'); }
        else if (AA.DECO_BY[id].crawl) { UI.setTool('hand'); UI.toast('🦀 ' + esc(AA.DECO_BY[id].name) + ' ist eingezogen und erkundet jetzt den Kies.'); }
        else { UI.setTool('hand'); V.selectDeco(r); UI.toast('🪸 ' + esc(AA.DECO_BY[id].name) + ' steht im Becken – zieh sie an ihren Platz.'); }
      }
    }
    else if (act === 'setfloor') { const r = AA.setFloor(id); if (typeof r === 'string') UI.fail(r); else { UI.toast('🏖️ ' + esc(AA.FLOOR_BY[id].name) + ' liegt jetzt im Becken.'); UI.openStore(); } }
    else if (act === 'setwall') {
      const had = s.walls.indexOf(id) >= 0, r = AA.setWall(id);
      if (typeof r === 'string') UI.fail(r);
      else { if (!had) AA.audio.play('buy'); UI.toast('🎨 Hintergrund „' + esc(AA.WALL_BY[id].name) + '“ ist aktiv.'); UI.openStore(); }
    }
    else if (act === 'upgradetank') {
      const r = AA.upgradeTank();
      if (typeof r === 'string') UI.fail(r);
      else { AA.audio.play('buy'); UI.toast('📐 Mehr Platz: ' + AA.cap(AA.tank()) + ' Bewohner passen jetzt rein.'); UI.openStore(); }
    }
    else if (act === 'buytank') {
      const r = AA.buyTank(id === 'salt' ? 'salt' : 'fresh', id === 'bonus');
      if (typeof r === 'string') UI.fail(r);
      else { AA.audio.play('level'); UI.close(); UI.toast(AA.tank().water === 'fresh' ? '🌿 Dein Süßwasser-Becken ist da! Im Shop warten jetzt die Süßwasser-Arten.' : '🏠 Dein neues Meerwasser-Aquarium ist da!', 'big'); }
    }
    else if (act === 'gotankstore') { AA.switchTank(+id); UI.openStore(); }
    else if (act === 'gotank') { AA.switchTank(+id); UI.close(); }
    else if (act === 'claim') {
      const tr = AA.claimMedal(id);
      if (tr) { AA.audio.play('chest'); const m = AA.MEDALS.find(function (x) { return x.id === id; }); UI.openMedals(); UI.toast(tr.ico + ' ' + esc(m.name) + ' – ' + tr.name + ': +' + fmt(tr.xp) + ' XP, +' + tr.pearls + ' ' + (tr.pearls === 1 ? 'Perle' : 'Perlen'), 'gold'); }
      else UI.openMedals();
    }
    else if (act === 'hunt') {
      const f = AA.tank().fish.find(function (x) { return x.id === id; });
      if (f && !AA.hunt.start(f)) UI.toast('⚠️ Heute keine Schatzsuche mehr.', 'warn');
    }
    else if (act === 'sellyes') { const p = UI.pending; UI.close(); if (p && p.kind === 'sell') AA.sellFish(p.obj); UI.pending = null; }
    else if (act === 'moveto') {
      const p = UI.pending; UI.close(); UI.pending = null;
      if (!p) return;
      const r = p.kind === 'fish' ? AA.moveFish(p.obj, +id) : AA.moveDeco(p.obj, +id);
      if (typeof r === 'string') UI.fail(r);
      else { AA.audio.play('splash'); UI.toast('⇄ Umgezogen nach „' + esc(s.tanks[+id].name) + '“.'); AA.save(); }
    }
    else if (act === 'sound') { s.settings.sound = id === '1'; AA.audio.on = s.settings.sound; AA.save(); UI.openSettings(); UI.refresh(); }
    else if (act === 'reset') UI.open('confirm', head('Wirklich neu anfangen?') + '<div class="confirm"><p>Alle Fische, Münzen, Perlen und Becken sind dann weg. Das lässt sich nicht rückgängig machen.</p><div class="row end"><button class="btn grey" data-act="close">Abbrechen</button><button class="btn red" data-act="resetyes">Ja, alles löschen</button></div></div>', 'small');
    else if (act === 'resetyes') { AA.resetGame(); AA.save(); UI.close(); UI.refresh(); UI.intro(); }
    else if (act === 'newsok') { delete s.news; AA.save(); UI.close(); if (s.tanks.length > 1) UI.refresh(); }
    else if (act === 'introok') { s.intro = true; AA.loadError = null; AA.save(); UI.close(); UI.toast('👉 Tipp: ' + AA.say('Klick', 'Tipp') + ' unten links auf <b>Shop</b> und kauf deinen ersten Fisch.', 'big'); }
  }

  UI.toggleNight = function () { const s = AA.state.settings; s.night = !s.night; UI.refresh(); UI.toast(s.night ? '🌙 Licht aus – gute Nacht, Fische.' : '☀️ Licht an!'); AA.audio.play('click'); AA.save(); };
  UI.toggleSound = function () { const s = AA.state.settings; s.sound = !s.sound; AA.audio.on = s.sound; UI.refresh(); if (s.sound) AA.audio.play('pop'); AA.save(); };
  UI.photo = function () {
    V.photo($('#cv'), function (ok) {
      if (ok) { AA.audio.play('click'); AA.photoTaken(); UI.toast('📷 Foto gespeichert (Downloads-Ordner).'); }
      else UI.toast('⚠️ Foto ging nicht. Starte das Spiel über „Awesome Aquarium.command“.', 'warn');
    });
  };

  UI.init = function () {
    COIN = '<img class="ic" src="' + AA.assets.src('prop/coin') + '" alt="Münzen">';
    FOODI = '<img class="ic" src="' + AA.assets.src('prop/foodcan') + '" alt="Futter">';
    document.querySelectorAll('img[data-ic]').forEach(function (im) { im.src = AA.assets.src(im.dataset.ic); });
    $('#btn-store').addEventListener('click', function () { AA.audio.play('click'); UI.openStore(); });
    document.querySelectorAll('#hud-bottom .tool').forEach(function (b) { b.addEventListener('click', function () { AA.audio.play('click'); UI.setTool(b.dataset.tool); }); });
    $('#tank-prev').addEventListener('click', function () { AA.switchTank(AA.state.active - 1); });
    $('#tank-next').addEventListener('click', function () { AA.switchTank(AA.state.active + 1); });
    $('#btn-medals').addEventListener('click', function () { AA.audio.play('click'); UI.openMedals(); });
    $('#btn-gift').addEventListener('click', UI.gift);
    $('#btn-hunt').addEventListener('click', function () { AA.audio.play('click'); UI.openHunt(); });
    $('#btn-photo').addEventListener('click', UI.photo);
    $('#btn-light').addEventListener('click', UI.toggleNight);
    $('#btn-sound').addEventListener('click', UI.toggleSound);
    $('#btn-settings').addEventListener('click', function () { AA.audio.play('click'); UI.openSettings(); });
    $('#food-panel').addEventListener('click', function () { AA.audio.play('click'); UI.openStore('food'); });
    $('#modal').addEventListener('click', onModalClick);
    $('#modal').addEventListener('keydown', function (e) { if (e.key === 'Enter' && UI.modalKind === 'buyfish') { const b = $('#modal [data-act="confirmfish"]'); if (b && !b.disabled) b.click(); } });
    $('#card').addEventListener('click', onCardClick);
    $('#card').addEventListener('input', onCardInput);
    $('#card').addEventListener('change', function (e) { if (e.target.id === 'c-size') { AA.audio.play('pop'); AA.save(); } });
    AA.on('decoResized', UI.syncSize);
    $('#overlay').addEventListener('pointerdown', function (e) { if (e.target === $('#overlay') && !UI.lockModal) UI.close(); });
    AA.on('hud', function () {
      if (!AA.quiet) UI.refresh();
      if (UI.modalKind === 'store') { const a = $('#m-coins b'), p = $('#m-pearls b'); if (a) a.textContent = fmt(AA.state.coins); if (p) p.textContent = fmt(AA.state.pearls); }
    });
    AA.on('selection', UI.buildCard);
    AA.on('decoSelection', UI.buildCard);
    AA.on('medals', function (n, more) { $('#medal-dot').classList.toggle('hidden', n === 0); if (more && !AA.quiet) { UI.toast('🏅 Medaille verdient – bei den Erfolgen abholen!', 'gold'); AA.audio.play('sparkle'); } });
    AA.on('levelup', function (lvl) {
      if (AA.quiet) return;
      const un = AA.unlocksAt(lvl);
      UI.toast('🎉 <b>Level ' + lvl + '!</b> +1 Perle' + (un.length ? '<br><small>Neu: ' + un.map(esc).join(', ') + '</small>' : ''), 'big');
      AA.audio.play('level');
      if (UI.modalKind === 'store') UI.openStore();
    });
    AA.on('newDay', function () { if (!AA.quiet) UI.toast('☀️ Neuer Tag: Schatzkiste, 🎁 Geschenk, 🧭 Schatzsuche – und 📋 drei neue Aufträge.', 'gold'); });
    if (UI.cloudInit) UI.cloudInit();                  // Freunde, Konto, Besuch (js/cloudui.js)
    if (UI.metaInit) UI.metaInit();                    // Knöpfe „Aufträge“ und „Buch“ (js/metaui.js)
    if (UI.bizInit) UI.bizInit();
    if (UI.farmInit) UI.farmInit();
    if (UI.lifeInit) UI.lifeInit();                    // Runde 8 (js/lifeui.js)
    if (UI.ecoInit) UI.ecoInit();                      // Runde 7 (js/ecoui.js)
    if (UI.decorInit) UI.decorInit();                  // Runde 10: Deko-Modus, Lager (js/decorui.js)
    if (UI.familyInit) UI.familyInit();                // Runde 10: Rangliste, Login-Kalender, Testfreund (js/familyui.js)
    if (UI.socialInit) UI.socialInit();                // Runde 11: Profil, Musik (js/socialui.js)                    // Runde 6 (js/farmui.js)                      // Knopf „Büro“ (js/bizui.js)
    UI.setTool('hand');
    UI.refresh();
    AA.checkMedals();
  };
})(window.AA);
