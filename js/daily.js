'use strict';
/* Awesome Aquarium – Runde 20f: Fisch des Tages (−30 % im Shop) und Glücksrad (einmal am Tag).
   • Fisch des Tages: für jeden Kalendertag fest (aus dem Datum gewürfelt), aus den Arten, die man mit seinem Level schon kaufen kann – keine
     Hybride, Specials, Saison- oder Perlen-Arten. Der Rabatt gilt beim Kauf mit Münzen (AA.priceOf, js/state.js AA.buyFish).
   • Glücksrad: Knopf 🎡 oben (Taste W). Einmal am Tag drehen (s.wheelDay = Datum). Acht Felder mit Gewichten; Münzen wachsen mit dem Level.
     Das Ergebnis würfelt AA.spinWheel – die Animation zeigt nur, wo das Rad stehen bleibt. */
(function (AA) {
  const $ = AA.$, esc = AA.esc, fmt = AA.fmt;
  function S() { return AA.state; }
  function today() { return AA.today ? AA.today() : new Date().toISOString().slice(0, 10); }
  function dayNum(d) { return Math.floor(Date.parse((d || today()) + 'T00:00:00Z') / 864e5); }

  /* ---------- Fisch des Tages ---------- */
  AA.DAILY = { off: 0.3 };
  AA.fishOfDay = function (lvl, day) {
    const s = S(), L = lvl === undefined ? (s ? s.level : 1) : lvl;
    const pool = AA.FISH.filter(function (f) { return !f.hybrid && !f.special && !f.season && !f.pearlOnly && f.lvl <= L && f.price >= 15; })
      .sort(function (a, b) { return a.lvl - b.lvl || (a.id < b.id ? -1 : 1); });
    if (!pool.length) return null;
    const r = AA.rng(dayNum(day) * 7919 + 13);
    r(); r();
    return pool[Math.min(pool.length - 1, Math.floor(Math.pow(r(), 0.65) * pool.length))];      // die teureren etwas öfter – da lohnt die Ersparnis
  };
  AA.isFishOfDay = function (def) { const f = AA.fishOfDay(); return !!(f && def && f.id === def.id); };
  AA.priceOf = function (def) { return def && AA.isFishOfDay(def) ? Math.round(def.price * (1 - AA.DAILY.off)) : (def ? def.price : 0); };

  /* ---------- Glücksrad ---------- */
  // Felder in Rad-Reihenfolge; w = Gewicht. coins wächst mit dem Level (× 1 … × 3 bei Level 60).
  AA.WHEEL = [
    { id: 'c1', ico: '🪙', coins: 100, w: 22, col: '#ffd76a' },
    { id: 'food', ico: '🍽️', food: 30, w: 16, col: '#8fd3ff' },
    { id: 'c2', ico: '🪙', coins: 300, w: 16, col: '#ffb85a' },
    { id: 'p1', ico: '🫧', pearls: 1, w: 12, col: '#d7b6ff' },
    { id: 'turbo', ico: '⚡', turbo: 3, w: 12, col: '#9ff0b0' },
    { id: 'c3', ico: '💰', coins: 800, w: 9, col: '#ff9a7a' },
    { id: 'p3', ico: '🫧', pearls: 3, w: 4, col: '#b18cff' },
    { id: 'jack', ico: '👑', coins: 3000, w: 2, col: '#ffe14d' }
  ];
  AA.wheelMult = function () { return 1 + Math.min(2, (S().level || 1) / 30); };
  AA.wheelPrizeText = function (p) {
    if (p.coins) return fmt(Math.round(p.coins * AA.wheelMult() / 10) * 10) + ' Münzen';
    if (p.food) return p.food + ' Prisen Futter';
    if (p.pearls) return p.pearls + (p.pearls === 1 ? ' Perle' : ' Perlen');
    if (p.turbo) return p.turbo + '× Turbofutter';
    return '';
  };
  AA.wheelReady = function () { const s = S(); return !!s && s.wheelDay !== today() && !AA.visit; };
  /* dreht (Ergebnis-Index) und schreibt den Gewinn gut; force = Index für Tests */
  AA.spinWheel = function (force) {
    const s = S();
    if (!AA.wheelReady()) return null;
    let i = force;
    if (i === undefined) {
      let sum = 0; AA.WHEEL.forEach(function (p) { sum += p.w; });
      let x = Math.random() * sum; i = 0;
      while (i < AA.WHEEL.length - 1 && x >= AA.WHEEL[i].w) { x -= AA.WHEEL[i].w; i++; }
    }
    const p = AA.WHEEL[i];
    s.wheelDay = today(); s.stats.wheel = (s.stats.wheel | 0) + 1;
    if (p.coins) AA.addCoins(Math.round(p.coins * AA.wheelMult() / 10) * 10, false);
    if (p.food) AA.addFood(p.food);
    if (p.pearls) AA.addPearls(p.pearls);
    if (p.turbo) { s.food2 = s.food2 || {}; s.food2.turbo = (s.food2.turbo | 0) + p.turbo; }
    AA.save();
    return i;
  };

  /* ---------- Oberfläche ---------- */
  const UI = AA.ui;
  function head(t) { return '<div class="m-head"><div class="m-title">' + t + '</div><button class="x" data-act="close" title="Schließen">✕</button></div>'; }
  function wheelSvg(rot) {
    const n = AA.WHEEL.length, R = 130, cx = 140, cy = 140;
    let g = '';
    AA.WHEEL.forEach(function (p, k) {
      const a0 = (k / n) * Math.PI * 2 - Math.PI / 2, a1 = ((k + 1) / n) * Math.PI * 2 - Math.PI / 2, am = (a0 + a1) / 2;
      const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0), x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
      g += '<path d="M' + cx + ' ' + cy + ' L' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A' + R + ' ' + R + ' 0 0 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' Z" fill="' + p.col + '" stroke="#ffffff" stroke-width="3"/>';
      g += '<text x="' + (cx + R * 0.66 * Math.cos(am)).toFixed(1) + '" y="' + (cy + R * 0.66 * Math.sin(am) + 9).toFixed(1) + '" font-size="26" text-anchor="middle">' + p.ico + '</text>';
    });
    return '<svg class="wheel-svg" viewBox="0 0 280 300" width="280" height="300"><g class="wheel-rot" style="transform-origin:140px 140px;transform:rotate(' + (rot || 0) + 'deg)">' + g +
      '<circle cx="140" cy="140" r="22" fill="#ffffff" stroke="#3a3f52" stroke-width="4"/></g><path d="M140 2 L128 26 L152 26 Z" fill="#e8344a" stroke="#ffffff" stroke-width="3"/></svg>';
  }
  UI.openWheel = function () {
    const ready = AA.wheelReady();
    const list = AA.WHEEL.map(function (p) { return '<span class="wheel-prize" style="background:' + p.col + '">' + p.ico + ' ' + esc(AA.wheelPrizeText(p)) + '</span>'; }).join('');
    UI.open('wheel', head('🎡 Glücksrad') + '<div class="confirm wheel-box"><div class="wheel-wrap">' + wheelSvg(0) + '</div>' +
      '<p class="wheel-msg">' + (ready ? 'Einmal am Tag drehen – was gewinnst du heute?' : 'Heute schon gedreht. Morgen wieder!') + '</p>' +
      '<div class="wheel-list">' + list + '</div>' +
      '<div class="row"><button class="btn green" data-act="wheel-spin"' + (ready ? '' : ' disabled') + '>🎡 Drehen</button></div></div>', 'small');
  };
  function spinAnim(i) {
    const n = AA.WHEEL.length, seg = 360 / n, target = 360 * 5 + (360 - (i + 0.5) * seg) + (Math.random() - 0.5) * seg * 0.6;
    const el = $('#modal .wheel-rot'), btn = $('#modal [data-act="wheel-spin"]'), msg = $('#modal .wheel-msg');
    if (btn) btn.disabled = true;
    const done = function () {
      const p = AA.WHEEL[i];
      if (msg) msg.innerHTML = '🎉 Gewonnen: <b>' + p.ico + ' ' + esc(AA.wheelPrizeText(p)) + '</b>';
      AA.audio.play(p.id === 'jack' || p.pearls ? 'level' : 'coin');
      UI.toast('🎡 Glücksrad: <b>' + p.ico + ' ' + esc(AA.wheelPrizeText(p)) + '</b>', 'gold');
      if (UI.refresh) UI.refresh(); markWheel();
    };
    if (!el || window.AA_NO_ANIM) { done(); return; }
    el.style.transition = 'transform 3.6s cubic-bezier(0.17, 0.67, 0.12, 1)';
    requestAnimationFrame(function () { el.style.transform = 'rotate(' + target.toFixed(1) + 'deg)'; });
    setTimeout(done, 3700);
  }
  function markWheel() { const d = $('#wheel-dot'); if (d) d.classList.toggle('hidden', !AA.wheelReady()); }
  AA.markWheel = markWheel;
  UI.dailyClick = function (act) {
    if (act === 'wheel-spin') {
      const i = AA.spinWheel();
      if (i === null) { UI.toast('🎡 Heute schon gedreht – morgen wieder!', 'warn'); return true; }
      AA.audio.play('click'); spinAnim(i);
      return true;
    }
    if (act === 'wheel-open') { UI.openWheel(); return true; }
    return false;
  };
  /* Shop: Kopfzeile mit dem Fisch des Tages (im Reiter Fische) */
  UI.fishOfDaySec = function () {
    const f = AA.fishOfDay(); if (!f) return '';
    const t = AA.tank(), why = AA.whyNot(f, t), w = AA.waterOf(f);
    return '<div class="sec daily-sec">🏷️ <b>Fisch des Tages:</b> ' + esc(f.name) + ' – heute <b>' + Math.round(AA.DAILY.off * 100) + ' % günstiger</b> (' + fmt(AA.priceOf(f)) + ' statt ' + fmt(f.price) + ' Münzen)' +
      (why === 'water' ? ' · lebt im ' + AA.WATER[w].name + '-Becken' : (why ? ' · braucht ein anderes Becken' : '')) + '</div>';
  };
  AA.on && AA.on('ready', function () { setTimeout(markWheel, 500); });
  setInterval(function () { if (AA.state) markWheel(); }, 60000);
})(window.AA);
