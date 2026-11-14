'use strict';
/* Awesome Aquarium – Runde 10, Oberfläche zum Einrichten:
     • Deko-Modus ✏️ (Werkzeug 5): Fische verblassen, oben eine Leiste mit der Schönheits-Note und dem Raster, unten das Lager 📦
     • Lager-Leiste: Mini-Bilder der eingelagerten Stücke – ins Becken ziehen (landet, wo man loslässt) oder antippen (freier Platz)
     • Deko-Karte: Drehen, Ebene vor/zurück, Farben, Duplizieren (mit Preis) und „Ins Lager“
   Regeln dazu: js/decor.js */
(function (AA) {
  const UI = AA.ui, V = AA.view, $ = AA.$, esc = AA.esc, fmt = AA.fmt;
  const WHY = { water: 'Dieses Tier lebt in anderem Wasser – setz es in ein passendes Becken.', decofull: 'Das Becken ist voll mit Deko.',
    crawlfull: 'Mehr Krabbler passen nicht in dieses Becken.', storefull: 'Das Lager ist voll (' + AA.BAL.maxStore + ' Stücke).', coins: 'Dafür reichen die Münzen nicht.',
    level: 'Das gibt es erst mit höherem Level.', unique: 'Davon gibt es nur eines.', unknown: 'Das geht hier nicht.' };
  function coin() { return '<img class="ic" src="' + AA.assets.src('prop/coin') + '" alt="Münzen">'; }
  function why(k) {                                  // Runde 11: die Grenzen hängen vom Becken ab
    const t = AA.tank();
    const txt = k === 'decofull' ? 'Das Becken ist voll mit Deko (' + AA.decoMax(t) + ' Stücke).' : (k === 'crawlfull' ? 'Hier leben schon ' + AA.crawlMax(t) + ' Krabbler – mehr passen nicht hinein.' : (WHY[k] || WHY.unknown));
    UI.toast('⚠️ ' + txt, 'warn'); AA.audio.play('error');
  }
  let hinted = false, drag = null, lastBeauty = -1;

  /* ---------- Deko-Modus ---------- */
  UI.decoMode = function (on) {
    if (AA.visit) return;
    if (on === undefined) on = V.tool !== 'deco';
    UI.setTool(on ? 'deco' : 'hand');
    if (on && !hinted) {
      hinted = true;
      UI.toast('✏️ <b>Deko-Modus:</b> Stücke ziehen, antippen zum Drehen, Färben und Duplizieren. Unten liegt dein 📦 Lager – einfach ins Becken ziehen.', 'big');
    }
  };
  UI.decoSync = function () {
    const on = V.tool === 'deco' && !AA.visit;
    const hd = $('#deco-head'), sb = $('#store-bar');
    if (!hd || !sb) return;
    hd.classList.toggle('hidden', !on); sb.classList.toggle('hidden', !on);
    document.body.classList.toggle('deco-mode', on);
    if (on) { lastBeauty = -1; head(); bar(); }
  };
  function head() {
    const t = AA.tank(), b = AA.beauty(t), w = AA.beautyWord(b.score);
    if (b.score === lastBeauty && $('#dh-beauty').dataset.t === t.id) return;
    lastBeauty = b.score;
    const el = $('#dh-beauty'); el.dataset.t = t.id;
    el.innerHTML = '<span class="dh-star">' + w[2] + '</span><b>' + b.score + '</b><small>/100 · ' + w[1] + '</small>';
    $('#dh-grid').classList.toggle('on', !!V.grid);
    $('#dh-grid').innerHTML = '▦ Raster' + (V.grid ? ' an' : ' aus');
  }
  /* Raster und Seitenscheiben-Linie, solange der Deko-Modus läuft (wird vom Becken aus gezeichnet) */
  V.drawDecoMode = function (ctx) {
    const G = AA.G;
    ctx.save();
    if (V.grid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 1;
      for (let x = AA.GRID.x * 4; x < AA.W; x += AA.GRID.x * 4) { ctx.beginPath(); ctx.moveTo(x, G.top + 30); ctx.lineTo(x, AA.floorY(1)); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      for (let z = 0; z <= 1.0001; z += 0.25) { const y = AA.floorY(z); ctx.beginPath(); ctx.moveTo(AA.wallX(-1, z), y); ctx.lineTo(AA.wallX(1, z), y); ctx.stroke(); }
    }
    if (V.dragDeco) {                                  // beim Ziehen: wo die Seitenscheiben sind (bis hierhin und nicht weiter)
      ctx.strokeStyle = 'rgba(255,227,110,0.55)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
      [-1, 1].forEach(function (sd) { ctx.beginPath(); ctx.moveTo(AA.wallX(sd, 0), G.top + 20); ctx.lineTo(AA.wallX(sd, 0), AA.floorY(0)); ctx.lineTo(AA.wallX(sd, 1), AA.floorY(1)); ctx.stroke(); });
    }
    ctx.restore();
  };

  /* ---------- Lager-Leiste ---------- */
  function bar() {
    const el = $('#sb-track'); if (!el) return;
    const g = AA.storeGroups(), t = AA.tank();
    $('#sb-n').textContent = AA.storeCount() + ' / ' + AA.BAL.maxStore;
    if (!g.length) { el.innerHTML = '<div class="sb-empty">Noch leer. Tipp ein Stück im Becken an und leg es mit <b>📦 Ins Lager</b> hier ab – statt es zu verkaufen.</div>'; return; }
    el.innerHTML = g.map(function (q) {
      const def = AA.DECO_BY[q.type], bad = AA.unstoreStatus(q.i, t) !== 'ok';
      return '<div class="st-item' + (bad ? ' bad' : '') + '" data-i="' + q.i + '" title="' + esc(def.name) + (bad ? ' – passt gerade nicht hierher' : ' – ins Becken ziehen oder antippen') + '">' +
        '<img src="' + AA.decoThumb(q.type, q.c, 96) + '" alt="" draggable="false">' + (q.n > 1 ? '<i class="st-n">' + q.n + '</i>' : '') +
        (def.crawl ? '<i class="st-w">' + AA.WATER[AA.waterOf(def)].ico + '</i>' : '') + '</div>';
    }).join('');
  }
  function stageOf(e) {
    const cv = $('#cv'), r = cv.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return null;
    const sx = (e.clientX - r.left) / r.width * AA.W, sy = (e.clientY - r.top) / r.height * AA.H;
    return V.toWorld(sx, sy);
  }
  function place(i, p) {                               // p = Fuß in Becken-Koordinaten; ohne p: freier Platz
    let o;
    if (p) {
      let x = p.x, z = AA.zFromY(p.y + AA.lift(p.x));
      if (V.grid) { x = Math.round(x / AA.GRID.x) * AA.GRID.x; z = AA.clamp(Math.round(z / AA.GRID.z) * AA.GRID.z, 0, 1); }
      o = AA.unstore(i, x, z);
    } else o = AA.unstore(i);
    if (typeof o === 'string') { why(o); return; }
    if (p) {
      const spot = V.stackSpot(o, p.x, p.y);
      if (spot) { o.on = spot.P.id; o.oi = spot.i; o.ou = Math.round(spot.u * 1000) / 1000; V.syncStack(); }
    }
    V.selectDeco(o); AA.audio.play('pop'); AA.save();
  }
  function ghostSize(it) {
    const def = AA.DECO_BY[it.type], cv = $('#cv'), r = cv.getBoundingClientRect();
    return Math.max(36, def.w * AA.depthScale(0.6) * (it.s || 1) * r.width / AA.W);
  }
  function onDown(e) {
    const it = e.target.closest('.st-item'); if (!it || (e.button !== undefined && e.button !== 0)) return;
    e.preventDefault();
    drag = { i: +it.dataset.i, x: e.clientX, y: e.clientY, el: it, ghost: null };
    try { it.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
  }
  function onMove(e) {
    if (!drag) return;
    if (!drag.ghost && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) {
      const st = AA.state.storage[drag.i]; if (!st) { drag = null; return; }
      const g = document.createElement('img');
      g.className = 'st-ghost'; g.src = drag.el.querySelector('img').src; g.style.width = ghostSize(st) + 'px';
      if (st.f) g.style.transform = 'translate(-50%, -96%) scaleX(-1)';
      if (st.r) g.style.rotate = st.r + 'deg';
      document.body.appendChild(g); drag.ghost = g; V.dragDeco = null;
    }
    if (drag.ghost) { drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px'; drag.ghost.classList.toggle('over', !!stageOf(e)); }
  }
  function onUp(e) {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.ghost) { d.ghost.remove(); const p = stageOf(e); if (p) place(d.i, p); }
    else place(d.i, null);                             // angetippt: an einen freien Platz
  }

  /* ---------- Deko-Karte ---------- */
  UI.decoCardExtra = function (o, def) {
    if (def.daily || def.fixed) return '';
    let h = '';
    if (AA.decoCanTurn(def)) {
      h += '<div class="c-tools"><button class="rnd" data-act="rotl" title="Drehen nach links (Taste Q)">↺</button><b class="c-rot" title="Drehung">' + (o.r ? (o.r > 0 ? '+' : '') + o.r + '°' : '0°') + '</b><button class="rnd" data-act="rotr" title="Drehen nach rechts (Taste E)">↻</button>' +
        '<span class="c-lab">Ebene</span><button class="rnd" data-act="layup" title="Eine Ebene nach vorn: vor die Stücke, die es überdecken">⬆</button><button class="rnd" data-act="laydn" title="Eine Ebene nach hinten: hinter die Stücke davor">⬇</button></div>';
    }
    const pals = AA.decoPals(def);
    if (pals.length) {
      h += '<div class="c-cols"><span class="c-lab">Farbe</span>' +
        '<button class="sw' + (!o.c ? ' on' : '') + '" data-act="dcolor" data-id="" title="Original"><img src="' + AA.assets.src('deco/' + o.type) + '" alt=""></button>' +
        pals.map(function (p) { return '<button class="sw' + (o.c === p.id ? ' on' : '') + '" data-act="dcolor" data-id="' + p.id + '" title="' + esc(p.name) + '" style="background:' + (AA.decoSwatch(o.type, p.id) || '#888') + '"></button>'; }).join('') + '</div>';
    }
    return h;
  };
  UI.decoCardStore = function (o, def) {
    if (def.daily || def.fixed) return '';
    const st = AA.dupStatus(o), price = AA.dupPrice(o);
    return '<div class="c-btns"><button class="btn violet" data-act="dupdeco"' + (st === 'unique' ? ' disabled' : '') + ' title="Noch eins davon kaufen – gleich eingestellt, direkt daneben">⧉ Duplizieren · ' + coin() + ' ' + fmt(price) + '</button>' +
      '<button class="btn grey" data-act="storedeco" title="Ins Lager statt verkaufen – später in jedes Becken wieder einsetzen">📦 Ins Lager</button></div>';
  };
  function rebuild() { UI.buildCard(); }
  UI.decoAct = function (act, o, b) {
    if (act === 'rotl' || act === 'rotr') { if (AA.rotateDeco(o, act === 'rotr' ? 1 : -1)) { AA.audio.play('click'); AA.save(); rebuild(); } else AA.audio.play('error'); }
    else if (act === 'layup' || act === 'laydn') {
      const r = AA.layerDeco(o, act === 'layup' ? 1 : -1);
      if (r === true) { AA.audio.play('click'); AA.save(); UI.toast(act === 'layup' ? '⬆ Eine Ebene nach vorn' : '⬇ Eine Ebene nach hinten'); }
      else { AA.audio.play('error'); UI.toast(r === 'front' ? 'Davor liegt nichts mehr – es ist schon ganz vorn.' : (r === 'back' ? 'Dahinter liegt nichts mehr – es ist schon ganz hinten.' : 'Das geht bei diesem Stück nicht.')); }
    }
    else if (act === 'dcolor') { if (AA.setDecoColor(o, b.dataset.id || '')) { AA.audio.play('pop'); AA.save(); rebuild(); } }
    else if (act === 'dupdeco') {
      const c = AA.dupDeco(o);
      if (typeof c === 'string') { why(c); return; }
      AA.audio.play('coin'); V.selectDeco(c); AA.save();
      UI.toast('⧉ Dupliziert für ' + fmt(AA.DECO_BY[o.type].price) + ' Münzen.');
    }
    else if (act === 'storedeco') {
      const r = AA.storeDeco(o);
      if (r !== true) { why(r); return; }
      AA.audio.play('pop'); V.selectDeco(null); AA.save();
      UI.toast('📦 Im Lager. ' + (V.tool === 'deco' ? 'Unten in der Leiste wartet es.' : 'Wieder auspacken: ✏️ Deko-Modus (Taste 5).'));
    }
  };
  UI.decoKey = function (k) {                          // Tasten im Deko-Modus: Q/E drehen, X spiegeln
    const o = V.selDeco; if (!o) return false;
    if (k === 'q' || k === 'e') { UI.decoAct(k === 'q' ? 'rotl' : 'rotr', o); return true; }
    if (k === 'x' && !AA.DECO_BY[o.type].crawl) { o.flip = !o.flip; AA.audio.play('click'); AA.save(); return true; }
    return false;
  };

  /* ---------- Shop ---------- */
  UI.decorShopTop = function () {
    const n = AA.storeCount();
    return '<div class="sec sec-store">📦 <b>Lager:</b> ' + (n ? n + (n === 1 ? ' Stück wartet' : ' Stücke warten') + ' auf ein Becken.' : 'leer – auf jeder Deko-Karte gibt es „📦 Ins Lager“ statt Verkaufen.') +
      ' <button class="lnk" data-act="decomode">✏️ Deko-Modus öffnen</button> · 🎨 Fast jedes Stück gibt es in mehreren Farben (auf der Karte im Becken).</div>';
  };
  UI.decorTags = function (d) {
    const n = AA.decoPals(d).length;
    return n ? '<span title="Im Becken antippen und umfärben – kostet nichts">🎨 ' + (n + 1) + ' Farben</span>' : '';
  };

  /* ---------- Was ist neu (Runde 10) ---------- */
  UI.r10News = function (li) {
    li.push('✏️ <b>Deko-Modus</b> (Werkzeug unten oder Taste 5): Fische verblassen, du hast Raster, Drehen, Spiegeln, Ebenen und <b>Duplizieren</b> – plus die Schönheits-Note deines Beckens.');
    li.push('📦 <b>Deko-Lager:</b> Deko einlagern statt verkaufen und später in jedes Becken wieder einsetzen – unten als Leiste mit Mini-Bildern, einfach ins Becken ziehen.');
    li.push('🎨 <b>Deko-Farben:</b> Steine gibt es in den Farben aller Steine im Spiel, Holz in fünf Holztönen, Korallen & Co. in vier Farbtönen. Umfärben ist gratis.');
    li.push('🪨 <b>60 neue Stücke:</b> 30 Steine, 10 Wurzeln und Äste, 3 Steinköpfe, 3 Schätze im Atlantis-Stil, ein abgestürztes Ufo, 5 Korallen, 2 pinke Anemonen und 6 Krabbler (Süßwasser und Tiefsee).');
    li.push('🖼️ <b>10 neue Böden und 10 kräftige Kulissen</b> – drei davon Spezial: Korallenriff, Olymp und Weihnachten.');
    li.push('🏆 <b>Rangliste</b> in der Familie (Level, Sammelbuch, Schönheit) und 📅 <b>Tägliches Ritual</b>: sieben Tage am Stück reinschauen – am Ende wartet ein seltener Fisch.');
    li.push('👥 <b>Freunde</b> sitzen jetzt unten in der Leiste – und Testi 🧪 wohnt schon da, zum Ausprobieren und Besuchen.');
  };

  /* ---------- Verdrahten ---------- */
  UI.decorInit = function () {
    const hd = $('#deco-head'), sb = $('#store-bar');
    if (hd) hd.addEventListener('click', function (e) {
      const b = e.target.closest('[data-dh]'); if (!b) return;
      AA.audio.play('click');
      if (b.dataset.dh === 'done') UI.decoMode(false);
      else if (b.dataset.dh === 'grid') { V.grid = !V.grid; lastBeauty = -1; head(); }
      else if (b.dataset.dh === 'beauty') UI.openBeauty();
    });
    if (sb) {
      sb.addEventListener('pointerdown', onDown);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', function () { if (drag && drag.ghost) drag.ghost.remove(); drag = null; });
    }
    AA.on('storage', function () { if (V.tool === 'deco') bar(); });
    AA.on('tankChanged', function () { if (AA.clampTankDeco) AA.clampTankDeco(); if (V.tool === 'deco') { lastBeauty = -1; head(); bar(); } });
    AA.on('decoChanged', function () { lastBeauty = -1; });
    let barT = 0;      // Deko-Päckchen kommen oft dicht hintereinander an: das Lager dann nur einmal kurz danach neu zeichnen
    AA.on('assets', function (g) { if (V.tool !== 'deco' || g.indexOf('d-') !== 0 || barT) return; barT = setTimeout(function () { barT = 0; if (V.tool === 'deco') bar(); }, 200); });
    setInterval(function () { if (V.tool === 'deco' && !document.hidden) head(); }, 700);
    if (AA.clampTankDeco) AA.clampTankDeco();
  };
  /* Wie die Schönheits-Note zustande kommt */
  const PART = { vielfalt: ['🧩', 'Vielfalt', 'verschiedene Deko-Stücke (voll ab ' + AA.BEAUTY.types + ')', 20], pflanzen: ['🌿', 'Pflanzen & Korallen', 'voll ab ' + AA.BEAUTY.plants, 15],
    steine: ['🪨', 'Steine & Holz', 'voll ab ' + AA.BEAUTY.rocks, 10], prestige: ['👑', 'Prestige-Stück', 'mindestens eins', 10], verteilung: ['↔️', 'Verteilung', 'links, Mitte, rechts – vorn und hinten', 10],
    fischarten: ['🐠', 'Fischarten', 'voll ab ' + AA.BEAUTY.species, 10], besatz: ['🐟', 'Besatz', 'voll ab ' + Math.round(AA.BEAUTY.fill * 100) + ' % belegt', 5], sauber: ['🫧', 'Sauberkeit', 'putzen hilft', 10],
    kulisse: ['🖼️', 'Eigene Kulisse & Boden', 'nicht der Start-Kies, nicht das Start-Blau', 5], biotop: ['🌍', 'Biotop', 'Kulisse, Boden, Deko und Bewohner passen zusammen', 5],
    licht: ['💡', 'Licht-Studio', 'Lichtfarbe und Lichtstrahlen (Shop → Aquarien)', 4], pokale: ['🏆', 'Pokale', 'gewonnene Pokale im Becken (je 2)', 4] };
  UI.openBeauty = function () {
    const t = AA.tank(), b = AA.beauty(t), w = AA.beautyWord(b.score);
    let rows = '';
    for (const k in PART) {
      const P = PART[k], v = b.parts[k];
      rows += '<div class="bt-row"><span class="bt-ico">' + P[0] + '</span><div class="bt-txt"><b>' + P[1] + '</b><small>' + P[2] + '</small></div><div class="bar bt-bar"><i style="width:' + Math.round(v / P[3] * 100) + '%"></i></div><b class="bt-v">' + Math.round(v) + '<small>/' + P[3] + '</small></b></div>';
    }
    UI.open('beauty', '<div class="m-head"><div class="m-title">' + w[2] + ' Schönheit: ' + b.score + ' / 100 · ' + w[1] + '</div><button class="x" data-act="close" title="Schließen">✕</button></div>' +
      '<div class="list"><div class="note">So schön ist „' + esc(t.name) + '“. Die beste Note deiner Becken zählt in der 🏆 Rangliste der Familie.</div>' + rows + '</div>', 'mid');
  };
})(window.AA);
