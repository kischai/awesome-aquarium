'use strict';
/* Awesome Aquarium – Runde 18/19: Weihnachten (Oberfläche) – der Adventskalender
   In der Weihnachtszeit (AA.season().advent, 15. November bis 6. Januar) sitzt am linken Rand ein Knopf „Advent“. Er öffnet den Kalender: das
   Higgsfield-Visual (assets/ui/advent) mit 24 Türchen genau auf den gemalten Türen, nummeriert von 1 bis 24 und gemischt wie bei einem echten Kalender.
   Runde 19: Die Türchen gehen auf. Türchen N ab dem N. Dezember; verpasste lassen sich bis 6. Januar nachholen (vom 1. bis 6. Januar sind alle offen).
   Vor dem 1. Dezember steht „ab 1. Dezember“ darüber. Spielstand: s.advent = { y: Saison-Jahr (Dezember), o: [geöffnete Nummern], egg: 1 = Ei von Türchen 24
   wartet auf Platz }. Am Knopf zeigt ein roter Punkt, wie viele Türchen gerade offen stehen. Beim Besuch bei Freunden kein Knopf.
   Der Rest von Weihnachten steht in js/data.js (Arten, Deko, AA.season), js/state.js (Mistelzweig, Aufräumen), js/ui.js (Reiter „Weihnachten“),
   js/fish.js (Mütze, Heiligenschein, Purzelbaum) und js/tankview.js (Schneemann, Schneekugel, Lichterkette). */
(function (AA) {
  const UI = AA.ui, $ = AA.$, esc = AA.esc, fmt = AA.fmt;
  /* Lage der gemalten Türen im Visual (1344 × 752 Pixel): Spalten und Zeilen von–bis, gemessen am Bild */
  const W = 1344, H = 752;
  const COLS = [[356, 451], [463, 558], [571, 666], [678, 773], [786, 880], [893, 988]];
  const ROWS = [[274, 362], [378, 466], [481, 569], [585, 674]];
  const NUMS = [2, 4, 14, 11, 10, 17, 18, 9, 8, 1, 5, 15, 16, 24, 12, 3, 22, 20, 21, 7, 6, 19, 13, 23];      // fest gemischt – Zeile für Zeile
  /* Was hinter den Türchen steckt (gemischt: Münzen, Futter, Perlen, Weihnachts-Deko, Spezialfutter, Glitzer-Eier; hinter der 24 ein Regenbogen-Seepferdchen) */
  const GIFTS = {
    1: { k: 'coins', n: 500 }, 2: { k: 'food', n: 30 }, 3: { k: 'pearls', n: 2 }, 4: { k: 'deco', id: 'baubles' }, 5: { k: 'food2', id: 'color', n: 3 }, 6: { k: 'pearls', n: 3 },
    7: { k: 'coins', n: 1000 }, 8: { k: 'glitter', n: 1 }, 9: { k: 'food2', id: 'turbo', n: 3 }, 10: { k: 'deco', id: 'snowmoss' }, 11: { k: 'food', n: 50 }, 12: { k: 'pearls', n: 3 },
    13: { k: 'deco', id: 'firtree' }, 14: { k: 'coins', n: 2000 }, 15: { k: 'deco', id: 'xmassign' }, 16: { k: 'food2', id: 'live', n: 3 }, 17: { k: 'pearls', n: 4 }, 18: { k: 'deco', id: 'giftpile' },
    19: { k: 'coins', n: 3000 }, 20: { k: 'glitterBig', n: 1 }, 21: { k: 'deco', id: 'mistletoe' }, 22: { k: 'pearls', n: 5 }, 23: { k: 'deco', id: 'firlit' }, 24: { k: 'egg', sp: 'xmashorse', v: 'rainbow' }
  };
  AA.ADVENT = { cols: COLS, rows: ROWS, nums: NUMS, gifts: GIFTS };
  const pct = function (v) { return (v * 100).toFixed(3) + '%'; };

  /* ---------- Regeln ---------- */
  function today() { return window.AA_DATE ? new Date(window.AA_DATE + 'T12:00:00') : new Date(AA.nowMs ? AA.nowMs() : Date.now()); }
  function seasonYear(d) { return d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear(); }
  /* Darf Türchen n heute auf? 'yes' | 'later' (kommt noch) | 'over' (Saison vorbei) */
  AA.adventCan = function (n, d) {
    d = d || today();
    const m = d.getMonth() + 1, day = d.getDate();
    if (m === 12) return day >= n ? 'yes' : 'later';
    if (m === 1) return day <= 6 ? 'yes' : 'over';
    if (m === 11) return 'later';
    return 'over';
  };
  function adv() {
    const s = AA.state, y = seasonYear(today());
    if (!s.advent || typeof s.advent !== 'object' || s.advent.y !== y) s.advent = { y: y, o: [], egg: s.advent && s.advent.egg && s.advent.y === y ? 1 : 0 };
    if (!Array.isArray(s.advent.o)) s.advent.o = [];
    s.advent.o = s.advent.o.filter(function (n, i, a) { return n >= 1 && n <= 24 && a.indexOf(n) === i; });
    return s.advent;
  }
  AA.adventState = adv;
  AA.adventOpenable = function () {                     // wie viele Türchen gerade aufgehen dürfen (für den roten Punkt)
    if (!AA.state || !AA.seasonNow().advent) return 0;
    const A = adv(); let n = 0;
    for (let i = 1; i <= 24; i++) if (A.o.indexOf(i) < 0 && AA.adventCan(i) === 'yes') n++;
    return n;
  };
  const SHORT = { baubles: 'Kugeln', snowmoss: 'Schneemoos', firtree: 'Tanne', xmassign: 'Schild', giftpile: 'Geschenke', mistletoe: 'Mistel', firlit: 'Lichterbaum' };
  function giftLabel(g) {                              // txt = für die Meldung, sh = kurz für das offene Türchen
    if (g.k === 'coins') return { ico: '🪙', txt: fmt(g.n) + ' Münzen', sh: fmt(g.n) };
    if (g.k === 'food') return { ico: '🥫', txt: g.n + ' Prisen Futter', sh: g.n + ' Futter' };
    if (g.k === 'pearls') return { ico: '🫧', txt: g.n + ' Perlen', sh: g.n + ' Perlen' };
    if (g.k === 'food2') { const F = AA.FOOD2[g.id]; return { ico: F ? F.ico || '🍤' : '🍤', txt: g.n + '× ' + (F ? F.name : 'Spezialfutter'), sh: g.n + '×' }; }
    if (g.k === 'glitter') return { ico: '🥚', txt: 'Glitzer-Ei', sh: 'Glitzer-Ei' };
    if (g.k === 'glitterBig') return { ico: '💎', txt: 'Großes Glitzer-Ei', sh: 'Großes Ei' };
    if (g.k === 'deco') return { ico: '🎄', txt: AA.DECO_BY[g.id] ? AA.DECO_BY[g.id].name : g.id, sh: SHORT[g.id] || 'Deko' };
    if (g.k === 'egg') return { ico: '🌈', txt: 'Regenbogen-Ei: ' + (AA.FISH_BY[g.sp] ? AA.FISH_BY[g.sp].name : g.sp), sh: 'Regenbogen' };
    return { ico: '🎁', txt: 'Überraschung', sh: '' };
  }
  AA.adventLabel = function (n) { return giftLabel(GIFTS[n]); };
  /* Ei von Türchen 24: ins erste Becken mit Platz, in dem es leben kann (das aktuelle zuerst). Kein Platz → wartet (A.egg). */
  function placeEgg(g) {
    const s = AA.state, def = AA.FISH_BY[g.sp]; if (!def) return null;
    const order = [s.active].concat(s.tanks.map(function (t, i) { return i; }).filter(function (i) { return i !== s.active; }));
    for (let k = 0; k < order.length; k++) {
      const t = s.tanks[order[k]];
      if (!t || !AA.livesIn(def, t) || AA.count(t) >= AA.cap(t)) continue;
      const e = { id: AA.uid(), sp: def.id, x: AA.W / 2 + AA.rand(-200, 200), z: AA.rand(0.3, 0.8), hatch: def.hatch, total: def.hatch, gift: 1 };
      if (g.v && AA.VAR_BY && AA.VAR_BY[g.v]) e.v = g.v;
      t.eggs.push(e);
      AA.emit('tankChanged');
      return t;
    }
    return null;
  }
  function give(g) {
    const s = AA.state;
    if (g.k === 'coins') AA.addCoins(g.n, false);
    else if (g.k === 'food') AA.addFood(g.n);
    else if (g.k === 'pearls') AA.addPearls(g.n);
    else if (g.k === 'food2') { s.food2[g.id] = (s.food2[g.id] | 0) + g.n; AA.emit('hud'); }
    else if (g.k === 'glitter') { s.glitter = (s.glitter | 0) + g.n; AA.emit('hud'); }
    else if (g.k === 'glitterBig') { s.glitterBig = (s.glitterBig | 0) + g.n; AA.emit('hud'); }
    else if (g.k === 'deco') { s.storage = s.storage || []; s.storage.push({ type: g.id }); AA.emit('storage'); }
    else if (g.k === 'egg') { const t = placeEgg(g); if (!t) { adv().egg = 1; return { wait: true }; } return { tank: t }; }
    return {};
  }
  /* Türchen öffnen: { ok, n, gift, info } oder { ok: false, why } */
  AA.adventOpen = function (n) {
    n = n | 0;
    if (!AA.state || !GIFTS[n]) return { ok: false, why: 'unknown' };
    if (!AA.seasonNow().advent) return { ok: false, why: 'over' };
    const A = adv();
    if (A.o.indexOf(n) >= 0) return { ok: false, why: 'open' };
    const c = AA.adventCan(n);
    if (c !== 'yes') return { ok: false, why: c };
    A.o.push(n);
    const info = give(GIFTS[n]);
    return { ok: true, n: n, gift: GIFTS[n], info: info };
  };
  /* wartendes Ei nachliefern, sobald ein passendes Becken Platz hat */
  AA.adventEggRetry = function () {
    const s = AA.state; if (!s || !s.advent || !s.advent.egg || AA.visit) return null;
    const t = placeEgg(GIFTS[24]);
    if (t) { s.advent.egg = 0; return t; }
    return null;
  };

  /* ---------- Fenster ---------- */
  function html() {
    const A = adv(), d = today(), before = d.getMonth() === 10, src = AA.assets.src('ui/advent');
    let doors = '', k = 0;
    ROWS.forEach(function (r) {
      COLS.forEach(function (c) {
        const n = NUMS[k], open = A.o.indexOf(n) >= 0, can = !open && AA.adventCan(n, d) === 'yes', L = giftLabel(GIFTS[n]);
        const dw = c[1] - c[0] + 1, dh = r[1] - r[0] + 1;
        const leaf = 'background-size:' + pct(W / dw) + ' ' + pct(H / dh) + ';background-position:' + pct(c[0] / (W - dw)) + ' ' + pct(r[0] / (H - dh));      // die gemalte Tür selbst (Bild über --adv, einmal je Fenster)
        doors += '<button class="adv-door' + (open ? ' open' : '') + (can ? ' can' : '') + (!open && !can ? ' shut' : '') + '" data-act="advdoor" data-id="' + n + '" title="Türchen ' + n + (open ? ': ' + esc(L.txt) : (can ? ' – öffnen!' : '')) + '" style="left:' + pct(c[0] / W) + ';top:' + pct(r[0] / H) +
          ';width:' + pct(dw / W) + ';height:' + pct(dh / H) + '"><i class="in"><b>' + L.ico + '</b><small>' + esc(L.sh) + '</small></i><i class="leaf" style="' + leaf + '"></i><span>' + n + '</span></button>';
        k++;
      });
    });
    const can = AA.adventOpenable(), left = 24 - A.o.length;
    const note = before ? 'Ab 1. Dezember öffnest du hier jeden Tag ein Türchen – verpasste kannst du bis 6. Januar nachholen.'
      : (can ? can + (can === 1 ? ' Türchen wartet' : ' Türchen warten') + ' auf dich – einfach antippen!' : (left ? 'Morgen geht das nächste Türchen auf. 🎄' : 'Alle 24 Türchen offen – frohe Weihnachten! 🎅'));
    const egg = A.egg ? '<div class="adv-egg">🌈 Dein Regenbogen-Ei wartet: mach Platz in einem Meerwasser-Becken, dann kommt es von allein.</div>' : '';
    return '<div class="m-head"><div class="m-title">🎄 Adventskalender' + (before ? ' <small class="adv-soon">ab 1. Dezember</small>' : '') + '</div><div style="flex:1"></div><button class="x" data-act="close" title="Schließen">✕</button></div>' +
      '<div class="adv-wrap' + (before ? ' before' : '') + '" style="--adv:url(\'' + src + '\')"><img class="adv-img" src="' + src + '" alt="">' + doors + '</div>' + egg +
      '<div class="adv-note">' + note + '</div>';
  }
  UI.openAdvent = function () {
    if (AA.adventEggRetry()) UI.toast('🌈 Dein Regenbogen-Ei liegt jetzt im Becken!', 'gold');
    UI.open('advent', html(), 'advent');
    AA.assets.refreshImgs();                           // im Netz: Platzhalter, bis das Päckchen u-advent da ist (setzt sich dann von selbst ein)
    let tries = 0;
    (function leaves() {                               // die Türflügel zeigen dasselbe Bild – sobald es da ist, einsetzen
      const w = document.querySelector('#modal .adv-wrap'); if (!w || UI.modalKind !== 'advent') return;
      if (AA.assets.get('ui/advent')) { w.style.setProperty('--adv', 'url(\'' + AA.assets.src('ui/advent') + '\')'); return; }
      if (++tries < 40) setTimeout(leaves, 250);
    })();
    if (AA.audio) AA.audio.play('sparkle');
  };
  UI.xmasClick = function (act, id) {
    if (act !== 'advdoor') return false;
    const r = AA.adventOpen(+id);
    if (!r.ok) {
      if (r.why === 'later') { const d = today(); UI.toast('🎄 Türchen ' + id + ' geht am ' + id + '. Dezember auf' + (d.getMonth() === 10 ? ' – noch ein bisschen Geduld!' : '.'), 'warn'); }
      else if (r.why === 'open') UI.toast('🎁 Türchen ' + id + ': ' + esc(giftLabel(GIFTS[+id]).txt) + ' – schon abgeholt.');
      return true;
    }
    const L = giftLabel(r.gift);
    const el = document.querySelector('#modal .adv-door[data-id="' + r.n + '"]');
    if (el) { el.classList.remove('can'); el.classList.add('opening'); el.title = 'Türchen ' + r.n + ': ' + L.txt; }
    AA.audio.play(r.n === 24 ? 'level' : 'chest');
    if (r.n === 24 && UI.confetti) UI.confetti(60);
    UI.toast('🎁 <b>Türchen ' + r.n + ':</b> ' + esc(L.txt) + (r.info.wait ? ' – es wartet, bis in einem Meerwasser-Becken Platz ist.' : (r.info.tank ? ' – liegt in „' + esc(r.info.tank.name) + '“.' : (r.gift.k === 'deco' ? ' – liegt im Deko-Lager.' : '!'))), 'gold');
    AA.save(); UI.refresh(); syncBtn();
    setTimeout(function () { if (UI.modalKind === 'advent') { const g = document.querySelector('#modal .adv-note'); if (g) { const can = AA.adventOpenable(); g.textContent = can ? can + (can === 1 ? ' Türchen wartet' : ' Türchen warten') + ' auf dich – einfach antippen!' : 'Morgen geht das nächste Türchen auf. 🎄'; } } }, 50);
    return true;
  };
  /* Knopf am linken Rand: nur in der Weihnachtszeit, nicht beim Besuch bei Freunden. Roter Punkt = Türchen, die aufgehen dürfen; vor Dezember „ab 1.12.“ */
  function syncBtn() {
    const stage = $('#stage');
    if (!stage || !AA.state) return;
    let b = $('#advent-btn');
    const on = AA.seasonNow().advent && !AA.visit;
    if (!b) {
      if (!on) return;
      b = document.createElement('button');
      b.id = 'advent-btn'; b.title = 'Adventskalender';
      b.innerHTML = '<span class="soon"></span><img alt="" src="' + AA.assets.src('prop/advent_btn') + '"><b>Advent</b>';
      b.addEventListener('click', function (e) { e.stopPropagation(); UI.openAdvent(); });
      stage.appendChild(b);
    }
    b.classList.toggle('hidden', !on);
    if (!on) return;
    const n = AA.adventOpenable(), before = today().getMonth() === 10, sp = b.querySelector('.soon'), txt = before ? 'ab 1.12.' : (n ? String(n) : '');
    if (sp && sp.textContent !== txt) sp.textContent = txt;
    if (sp) sp.classList.toggle('hidden', !txt);
    b.classList.toggle('ready', n > 0);
    if (AA.state.advent && AA.state.advent.egg && AA.adventEggRetry()) { UI.toast('🌈 Dein Regenbogen-Ei aus dem Adventskalender liegt jetzt im Becken!', 'gold'); AA.save(); }
  }
  UI.xmasInit = function () {
    syncBtn();
    setInterval(syncBtn, 2000);                        // Weihnachtszeit beginnt/endet, Besuch bei Freunden an/aus, neuer Tag
  };
})(window.AA);
