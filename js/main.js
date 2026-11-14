'use strict';
/* Awesome Aquarium – Start, Spielschleife, Eingabe und die Verbindung Daten <-> Ansicht (v2) */
(function (AA) {
  const V = AA.view, UI = AA.ui, $ = AA.$, W = AA.W, H = AA.H;
  let canvas, ctx, R = 1, last = 0, lastWall = Date.now(), saveT = 0, uiT = 0;
  let drag = null;
  let maxR = 2, slow = 0, frameAvg = 0.016;
  V.holdId = 0;

  /* sichere Ränder (Notch, Home-Strich) aus CSS env() – im Browser auf dem Rechner alle 0 */
  function safe() {
    const cs = getComputedStyle(document.documentElement), g = function (k) { return parseFloat(cs.getPropertyValue(k)) || 0; };
    return { t: g('--sat'), r: g('--sar'), b: g('--sab'), l: g('--sal') };
  }
  function fit() {
    const sa = safe(), aw = Math.max(200, window.innerWidth - sa.l - sa.r), ah = Math.max(150, window.innerHeight - sa.t - sa.b);
    const sc = Math.min(aw / W, ah / H), st = $('#stage');
    st.style.left = (sa.l + aw / 2) + 'px'; st.style.top = (sa.t + ah / 2) + 'px';      // Runde 11: Bühne in den sicheren Bereich
    st.style.transform = 'translate(-50%, -50%) scale(' + sc + ')';
    /* Kleine Bildschirme (Handy quer): Die Bühne schrumpft, die Bedienelemente sollen aber lesbar und tippbar bleiben. Darum werden Leisten,
       Karten und Fenster um --ui größer gezeichnet (CSS zoom); ab 1,2 schaltet die Oberfläche auf die schlanke Fassung (.compact, siehe css). */
    const ui = AA.clamp(0.85 / sc, 1, 1.9);
    st.style.setProperty('--ui', ui.toFixed(3));
    st.classList.toggle('compact', ui > 1.2);
    V.ui = ui;
    if (UI.fitTop) UI.fitTop(true);                    // obere Leiste: passt sie noch in eine Zeile? (js/ui.js)
    R = AA.clamp((window.devicePixelRatio || 1) * sc, 1, maxR);
    canvas.width = Math.round(W * R); canvas.height = Math.round(H * R);
    V.res = R;                                          // Zeichen-Pixel je Spiel-Pixel (für die Wahl zwischen normalem und großem Deko-Bild)
  }
  /* Zeiger in Welt-Koordinaten (das Becken steht verkleinert im Raum: V.toWorld); sx/sy = Stelle auf der Bühne */
  function pos(e) { const r = canvas.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * W, sy = (e.clientY - r.top) / r.height * H, p = V.toWorld(sx, sy); p.sx = sx; p.sy = sy; p.touch = e.pointerType === 'touch' || e.pointerType === 'pen'; return p; }
  /* Runde 11: mit dem Finger trifft man Fische nicht pixelgenau – dann zählt der nächste Fisch in Fingerbreite */
  function fishAt(p) { return V.hitFish(p.x, p.y) || (p.touch ? V.hitFishNear(p.x, p.y, 34 * (V.ui || 1)) : null); }
  function outside(p) { return p.x < 0 || p.y < 0 || p.x > W || p.y > H; }
  function real(sec) { return sec / AA.speed(); }

  /* ---------- Werkzeuge ---------- */
  const FEED_MSG = {
    nofish: 'Noch keine Fische da – ab in den Shop! 🛒',
    nofood: '🥫 Futter ist alle. Nachschub: Shop → Futter, Training oder das Tagesgeschenk 🎁.',
    sated: '😊 Alle satt – heb dir das Futter lieber auf.',
    wait: 'Das reicht erstmal – lass sie aufessen.',
    nosick: '💊 Hier ist niemand krank – heb dir die Medizin auf.',
    nopred: '🐟 In diesem Becken lebt kein großer Jäger (Hecht, Wels, Hai & Co.), der Futterfische schnappt.'
  };
  function feed(x) {
    const kind = V.foodKind || 'normal', r = V.sprinkle(x, kind);      // Sorte: die Leiste über dem Futter-Werkzeug (js/lifeui.js)
    if (r === true) return;
    const out = r === 'nofood' && kind !== 'normal';
    UI.toast(out ? AA.FOOD2[kind].ico + ' ' + AA.FOOD2[kind].name + ' ist alle – Nachschub gibt es im Shop unter Futter.' : (FEED_MSG[r] || 'Gerade nicht.'), r === 'nofood' ? 'warn' : '');
    if (r === 'nofood') AA.audio.play('error');
    if (out) { V.foodKind = null; if (UI.lifeFoodBar) UI.lifeFoodBar(); }
  }
  function scrub(p) {
    const tank = AA.tank();
    if (!AA.scrub(tank)) { UI.toast('✨ Das Becken ist schon blitzblank.'); return; }
    V.scrubFx(p.x, p.y);
    V.floatText(p.x, p.y - 30, '+' + AA.BAL.cleanXp + ' XP', '#d6fbff');
    AA.audio.play('wipe');
    if (tank.dirt <= 0) { V.puff('spark', W / 2, 300, 10); V.floatText(W / 2, 250, 'Blitzblank!', '#fff3a6'); AA.audio.play('sparkle'); }
  }
  function collectChest(o) {
    const res = AA.collectChest();
    if (!res) return;
    const b = V.decoBox(o);
    V.floatText(o.x, b.y - 8, '+' + AA.fmt(res.coins) + ' Münzen' + (res.pearls ? ' +1 Perle' : ''), '#ffe36e');
    V.puff('coin', o.x, b.y + b.h * 0.4, 8);
    AA.audio.play('chest');
    UI.toast((o.type === 'bubbleclam' ? '🦪 Muschel' : '💰 Schatzkiste') + ' geleert: <b>+' + AA.fmt(res.coins) + ' Münzen</b>' + (res.pearls ? ' und eine Perle' : '') + '. Morgen ist sie wieder voll.', 'gold');
    UI.updateCard(); AA.save();
  }

  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    AA.audio.unlock();
    const p = pos(e), P = V.pointer;
    if (outside(p)) return;                         // neben der Bühne (das Becken füllt sie seit 14.11.2026 ganz)
    if (AA.visit) {                                  // zu Besuch bei Freunden: Fische ansehen ja, anfassen nein
      const fv = fishAt(p);
      V.select(fv || null); if (fv) AA.audio.play('pop');
      return;
    }
    P.x = p.x; P.y = p.y; P.down = true; P.inside = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
    if (V.tool === 'hand' || V.tool === 'deco') {   // Deko-Modus (Runde 10): wie die Hand, nur Fische und Eier lassen sich nicht anklicken
      const deco = V.tool === 'deco';
      const hd0 = V.overSizeHandle(p.x, p.y, p.touch ? 16 * (V.ui || 1) : 0);
      if (hd0) {                                     // am runden Anfasser gepackt: Größe ziehen, der Fuß bleibt stehen
        // Die Rahmenecke liegt bei Fuß + Größe · (dx, dy). Gemerkt wird, wo die Maus relativ zur Ecke zugepackt hat (gx, gy) –
        // beim Ziehen wird die Größe so gewählt, dass die Ecke der Maus entlang ihrer Diagonale folgt.
        const so = V.selDeco, sb = V.decoBox(so), s0 = AA.decoScale(so), st = V.stackInfo(so), fy = st ? st.y : AA.floorY(so.z, so.x);
        const dx = hd0.side * sb.w / 2 / s0, dy = (sb.y - fy) / s0;
        drag = { size: true, o: so, s0: s0, ax: sb.cx, ay: fy, dx: dx, dy: dy, gx: p.x - (sb.cx + dx * s0), gy: p.y - (fy + dy * s0) };
        V.sizing = so; V.sizeT = V.time;
        return;
      }
      const o = V.hitDeco(p.x, p.y), f = deco ? null : (V.hitFish(p.x, p.y) || (p.touch && !o ? V.hitFishNear(p.x, p.y, 34 * (V.ui || 1)) : null));
      if (o && !deco && AA.DECO_BY[o.type].daily && AA.state.active === 0 && AA.chestInfo().ready && !(f && f.z > o.z)) { collectChest(o); return; }
      if (f) { V.select(f); AA.audio.play('pop'); return; }
      const egg = deco ? null : V.hitEgg(p.x, p.y);
      if (egg) {                                     // Runde 12: antippen = Info-Fenster, ziehen = im Becken umlegen (entschieden beim Loslassen)
        const pe = V.eggPos(egg);
        drag = { egg: egg, ox: p.x - pe.x, oy: p.y - pe.y, sx: p.x, sy: p.y, moved: false };
        return;
      }
      if (o) {                                       // ox/oy: wo die Maus relativ zum Fuß des Stücks zugepackt hat (Kies-Linie bzw. Oberseite der Plattform)
        const st = V.stackInfo(o);
        V.selectDeco(o); drag = { o: o, ox: p.x - (st ? st.x : o.x), oy: p.y - (st ? st.y : AA.floorY(o.z, o.x)), sx: p.x, sy: p.y, moved: false }; return;
      }
      V.select(null); V.selectDeco(null);
    } else if (V.tool === 'food') feed(p.x);
    else if (V.tool === 'sponge') scrub(p);
    else if (V.tool === 'tap') { V.holdId++; V.knock(p.x, p.y); }
  }
  function onMove(e) {
    const p = pos(e), P = V.pointer;
    P.x = p.x; P.y = p.y; P.inside = p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H;
    if (P.down) {
      if (drag && drag.size) {
        const qx = p.x - drag.gx - drag.ax, qy = p.y - drag.gy - drag.ay;
        let s = (qx * drag.dx + qy * drag.dy) / (drag.dx * drag.dx + drag.dy * drag.dy);
        if (Math.abs(s - 1) < 0.035) s = 1;          // nahe der Originalgröße rastet es ein
        V.resizeDeco(drag.o, Math.max(0.01, s));
      } else if (drag && drag.egg) {
        if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) > 6) { drag.moved = true; V.dragEgg = drag.egg; }
        if (drag.moved) {
          const e2 = drag.egg, x = AA.clamp(p.x - drag.ox, AA.xLimits(e2.z)[0] + 30, AA.xLimits(e2.z)[1] - 30);
          let z = e2.z;
          for (let k = 0; k < 3; k++) z = AA.zFromY(p.y - drag.oy + 16 * AA.depthScale(z) + AA.lift(x));      // Ei liegt 16 × Tiefe über dem Kies
          e2.x = Math.round(x); e2.z = Math.round(AA.clamp(z, 0.02, 1) * 1000) / 1000;
        }
      } else if (drag) {
        if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) > 5) { drag.moved = true; V.dragDeco = drag.o; }
        if (drag.moved) {
          const o = drag.o, fx = p.x - drag.ox, fy = p.y - drag.oy, spot = V.stackSpot(o, fx, fy);
          V.dropSpot = spot;
          if (spot) { o.on = spot.P.id; o.oi = spot.i; o.ou = Math.round(spot.u * 1000) / 1000; }      // auf die Plattform
          else {                                       // auf den Kies (im Deko-Modus mit Raster: rastet auf 16 Pixel und 5 % Tiefe ein)
            delete o.on; delete o.oi; delete o.ou;
            let z = AA.zFromY(fy + AA.lift(fx)), x = fx;
            if (V.tool === 'deco' && V.grid) { x = Math.round(x / AA.GRID.x) * AA.GRID.x; z = AA.clamp(Math.round(z / AA.GRID.z) * AA.GRID.z, 0, 1); }
            o.z = z; o.x = x; AA.decoClampX(o);
          }
          V.syncStack();
        }
      }
    } else if (V.tool === 'hand' || V.tool === 'deco') {
      const hd = V.overSizeHandle(p.x, p.y);
      canvas.style.cursor = hd ? (hd.side > 0 ? 'nesw-resize' : 'nwse-resize') : (V.tool === 'hand' && V.hitFish(p.x, p.y) ? 'pointer' : (V.hitDeco(p.x, p.y) ? 'grab' : 'default'));
    }
  }
  function onUp() {
    V.pointer.down = false;
    if (drag && drag.egg) {
      const egg = drag.egg;
      if (drag.moved) { V.dragEgg = null; AA.audio.play('pop'); AA.save(); }
      else {                                         // glitzernde Eier verraten nur, DASS etwas Besonderes kommt – nicht was
        const pe = V.eggPos(egg);
        if (egg.v) { for (let i = 0; i < 5; i++) V.twinkle(pe.x + AA.rand(-26, 26), pe.y + AA.rand(-30, 18), '#fff3a6', AA.rand(9, 15)); AA.audio.play('sparkle'); }
        else AA.audio.play('pop');
        if (UI.eggInfo) UI.eggInfo(egg);
      }
      drag = null; return;
    }
    if (drag) {
      if (drag.size) { V.sizing = null; V.sizeT = V.time; if (AA.decoScale(drag.o) !== drag.s0) { AA.audio.play('pop'); AA.save(); } }
      else if (drag.moved) { V.dragDeco = null; V.dropSpot = null; AA.audio.play(drag.o.on ? 'click' : 'pop'); AA.save(); UI.updateCard(); }
      drag = null;
    }
  }
  /* Mausrad / Zwei-Finger-Wischen / Zoom-Geste über dem ausgewählten Stück: Größe ändern */
  let wheel = null, wheelSave = 0;
  function onWheel(e) {
    if (AA.visit) return;
    const o = V.selDeco;
    if (!o || (V.tool !== 'hand' && V.tool !== 'deco') || UI.modalKind || drag || !AA.decoRange(AA.DECO_BY[o.type])) return;
    const p = pos(e), b = V.decoBox(o);
    if (p.x < b.x - 14 || p.x > b.x + b.w + 14 || p.y < b.y - 14 || p.y > b.by + 14) return;
    e.preventDefault();
    const now = Date.now();
    if (!wheel || wheel.o !== o || now - wheel.t > 700 || Math.abs(wheel.s - AA.decoScale(o)) > 0.02) wheel = { o: o, s: AA.decoScale(o), t: now };
    let dy = e.deltaY; if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= 400;
    dy = AA.clamp(dy, -160, 160);
    const r = AA.decoRange(AA.DECO_BY[o.type]);
    wheel.s = AA.clamp(wheel.s * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0012)), r[0], r[1]);   // die Zoom-Geste kommt als Rad + ctrl mit kleinen Werten
    wheel.t = now;
    V.resizeDeco(o, wheel.s);
    clearTimeout(wheelSave); wheelSave = setTimeout(AA.save, 600);
  }
  /* ein Schritt größer / kleiner (Tasten, Knöpfe): immer auf die nächste volle 10-%-Stufe */
  V.stepDeco = function (o, dir) {
    const s = AA.decoScale(o), k = dir > 0 ? Math.floor(s * 10 + 1.0001) / 10 : Math.ceil(s * 10 - 1.0001) / 10;
    const r = V.resizeDeco(o, k);
    AA.audio.play(r === s ? 'error' : 'click');
    AA.save();
    return r;
  };

  function onKey(e) {
    if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range') return;      // Textfeld: tippen lassen (der Größen-Regler ist keins)
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = (e.key || '').toLowerCase();
    if (k === 'escape') {
      if (UI.modalKind) { if (!UI.lockModal) UI.close(); }
      else { const had = V.sel || V.selDeco; V.select(null); V.selectDeco(null); if (V.tool !== 'deco') UI.setTool('hand'); else if (!had && UI.decoMode) UI.decoMode(false); }   // im Deko-Modus: erst abwählen, dann raus
      return;
    }
    if (UI.modalKind) return;
    if (AA.visit) { if (k === 'f') UI.photo(); else if (k === 'l') UI.toggleNight(); return; }      // zu Besuch: nur gucken (Foto und Licht gehen)
    if (V.selDeco && (k === '+' || k === '=' || k === '-' || k === '_') && AA.decoRange(AA.DECO_BY[V.selDeco.type])) { V.stepDeco(V.selDeco, k === '+' || k === '=' ? 1 : -1); e.preventDefault(); return; }
    if (k === '1') UI.setTool('hand'); else if (k === '2') UI.setTool('food'); else if (k === '3') UI.setTool('sponge'); else if (k === '4') UI.setTool('tap');
    else if (k === '5' && UI.decoMode) UI.decoMode();
    else if (V.tool === 'deco' && V.selDeco && UI.decoKey && UI.decoKey(k)) { e.preventDefault(); }
    else if (k === 's') UI.openStore(); else if (k === 'e') UI.openMedals(); else if (k === 'g') UI.gift(); else if (k === 't') UI.openHunt();
    else if (k === 'a') UI.openQuests(); else if (k === 'b') { UI.bookSp = null; UI.openBook(); } else if (k === 'k') UI.openOffice(); else if (k === 'u') UI.openTanks();
    else if (k === 'f') UI.photo(); else if (k === 'l') UI.toggleNight(); else if (k === 'h' && UI.feedAll) UI.feedAll();
    else if (k === 'r' && UI.toggleFriends) UI.toggleFriends();
    else if (k === 'z' && UI.openRank) UI.openRank(); else if (k === 'c' && UI.openLogin7) UI.openLogin7();
    else if (k === 'm' && AA.music) { const on = AA.music.toggle(); UI.toast(on ? '🎵 Musik an' : '🔇 Musik aus'); }
  }

  /* ---------- Ereignisse aus der Simulation sichtbar machen ---------- */
  function active(t) { return !AA.quiet && t === AA.tank(); }
  AA.on('fishAdded', function (f) {
    V.sync();
    const fv = V.byId[f.id], big = AA.FISH_BY[f.sp].len >= 150;     // große Tiere platschen tiefer und länger
    if (!fv) { AA.audio.play('splash', { big: big }); return; }
    fv.enterFromTop(); V.puff('spark', fv.x, 60, 4);
    setTimeout(function () {                           // Ton und Tropfen genau dann, wenn der Fisch die Wasseroberfläche trifft
      if (V.byId[f.id] === fv) V.splashFx(fv.x, big);
      AA.audio.play('splash', { big: big });
    }, 420);
  });
  AA.on('fishRemoved', function (f, how, v) {
    const fv = V.byId[f.id];
    if (fv) {
      if (how === 'sell' || how === 'deliver') { fv.leave(); V.floatText(fv.x, fv.y - 34, '+' + AA.fmt(v) + ' Münzen', '#ffe36e'); V.puff('coin', fv.x, fv.y, 5); if (how === 'sell') UI.coinFly(fv.x, fv.y, v); }
      else V.puff('spark', fv.x, fv.y, 8);
      if (V.sel === fv) V.select(null);
    }
    if (how === 'sell') AA.audio.play('coin');
  });
  AA.on('matured', function (f, t) {
    if (!active(t)) return;
    const fv = V.byId[f.id];
    if (fv) V.puff('spark', fv.x, fv.y, 8);
    AA.audio.play('sparkle');
    UI.toast('✨ ' + AA.esc(f.name) + ' ist erwachsen – jetzt ' + AA.fmt(AA.fishValue(f)) + ' Münzen wert.');
  });
  AA.on('phase', function (f, t) {
    if (!active(t)) return;
    const fv = V.byId[f.id];
    if (fv) V.puff('spark', fv.x, fv.y, 4);
    if (AA.trainStatus(f).ok) UI.toast('🎓 ' + AA.esc(f.name) + ' ist gewachsen und bereit für das nächste Training.');
  });
  AA.on('sick', function (f, t) { if (active(t)) { UI.toast('🤒 ' + AA.esc(f.name) + ' ist vor Hunger krank geworden.', 'warn'); AA.audio.play('error'); } });
  AA.on('recovered', function (f, t) { if (active(t)) UI.toast('💚 ' + AA.esc(f.name) + ' ist wieder gesund.'); });
  AA.on('mateStart', function () { AA.audio.play('heart'); });
  AA.on('eggLaid', function (egg, a, b, t) {         // a, b = Eltern; beim Glitzer-Ei von der Wochenkarte gibt es keine
    if (!active(t)) return;
    const pe = V.eggPos(egg), nm = AA.esc(AA.FISH_BY[egg.sp].name);
    if (egg.v) for (let i = 0; i < 10; i++) V.twinkle(pe.x + AA.rand(-40, 40), pe.y + AA.rand(-46, 22), '#fff3a6', AA.rand(9, 17));
    if (a && b) {
      V.puff('heart', W / 2, AA.floorY(0.55) - 180, 8);
      AA.audio.play('heart');
      if (egg.v) { AA.audio.play('sparkle'); UI.toast('✨🥚 ' + AA.esc(a.name) + ' &amp; ' + AA.esc(b.name) + ' haben ein Ei gelegt – <b>und es glitzert!</b> Da schlüpft eine Farbvariante, in ' + AA.fmtDur(real(egg.hatch)) + '.', 'gold'); }
      else UI.toast('🥚 ' + AA.esc(a.name) + ' &amp; ' + AA.esc(b.name) + ' haben ein Ei gelegt! Es schlüpft in ' + AA.fmtDur(real(egg.hatch)) + '.', 'love');
    } else {
      AA.audio.play('sparkle');
      UI.toast('✨🥚 Das Glitzer-Ei (' + nm + ') liegt im Kies. Es schlüpft in ' + AA.fmtDur(real(egg.hatch)) + ' – welche Farbe, siehst du dann.', 'gold');
    }
    AA.save();
  });
  AA.on('mateFailed', function (a, b, t) {
    if (!active(t)) return;
    AA.audio.play('fail');
    UI.toast('💔 Diesmal hat es bei ' + AA.esc(a.name) + ' &amp; ' + AA.esc(b.name) + ' nicht gefunkt. Ihr könnt es gleich noch einmal versuchen.', 'warn');
    AA.save();
  });
  AA.on('hatched', function (baby, egg, t, fresh) {   // fresh = neu fürs Sammelbuch
    if (AA.quiet) return;
    const vd = baby.v && AA.VAR_BY[baby.v];
    if (t !== AA.tank()) {                             // anderes Becken: nur bei einer Farbvariante Bescheid sagen
      if (vd) { AA.audio.play('sparkle'); UI.toast('✨ In „' + AA.esc(t.name) + '“ ist eine Farbvariante geschlüpft: <b>' + AA.esc(AA.speciesName(baby.sp, baby.v)) + '</b> (' + vd.rare + ')' + (fresh ? ' – neu im Sammelbuch!' : '') + '.', 'big'); }
      return;
    }
    V.sync();
    const fv = V.byId[baby.id], p = V.eggPos(egg);
    if (fv) {
      fv.z = fv.zT = egg.z; fv.x = p.x; fv.y = p.y - 18; fv.tx = fv.x + AA.rand(-80, 80); fv.ty = fv.y - AA.rand(60, 160);
      V.puff('spark', p.x, p.y, 8);
    }
    AA.audio.play('hatch');
    if (vd) {                                        // Farbvariante: großer Auftritt
      V.puff('star', p.x, p.y - 10, 7 + vd.tier * 2);
      for (let i = 0; i < 10 + vd.tier * 5; i++) V.twinkle(p.x + AA.rand(-70, 70), p.y + AA.rand(-90, 20), i % 2 ? '#fff3a6' : '#ffffff', AA.rand(10, 20));
      V.floatText(p.x, p.y - 60, '✨ ' + vd.name + '!', '#fff3a6');
      AA.audio.play(vd.tier >= 3 ? 'level' : 'chest'); AA.audio.play('sparkle');
      UI.toast('✨ <b>' + vd.rare + '!</b> Aus dem Ei schlüpft ein <b>' + AA.esc(AA.speciesName(baby.sp, baby.v)) + '</b> – ' + AA.esc(baby.name) + '.' +
        (fresh ? '<br><small>Neu im Sammelbuch: Belohnung abholen (Taste B).</small>' : ''), 'big');
      AA.save();
    } else UI.toast('🐣 Geschlüpft: Baby-' + AA.esc(AA.FISH_BY[baby.sp].name) + ' ' + AA.esc(baby.name) + ' – und sehr hungrig!');
    const cl = AA.fishClass(baby);
    if (cl.id === 'S' || cl.id === 'A') {            // Top-Gene: kleiner Auftritt
      for (let i = 0; i < (cl.id === 'S' ? 14 : 6); i++) V.twinkle(p.x + AA.rand(-50, 50), p.y + AA.rand(-70, 10), cl.col, AA.rand(9, 16));
      V.floatText(p.x, p.y - (vd ? 95 : 60), 'Klasse ' + cl.id + '!', cl.id === 'S' ? '#ffd76a' : '#d9c4ff');
      if (cl.id === 'S') { AA.audio.play('win'); UI.toast('🧬 <b>Klasse S!</b> ' + AA.esc(baby.name) + ' hat Top-Gene (' + AA.geneSum(baby) + ' von 15) – ein Zuchttier fürs Imperium.', 'big'); }
    }
  });
  AA.on('trained', function () { UI.refresh(); UI.updateCard(); AA.save(); });
  AA.on('hunted', function () { UI.refresh(); });
  AA.on('tankChanged', function () { V.rebuild(); UI.refresh(); if (!AA.quiet) UI.toast('🏠 ' + AA.esc(AA.tank().name)); AA.save(); if (V.prewarm) V.prewarm(); });
  AA.on('sceneChanged', function () { V.clearThumbs(); AA.save(); });
  AA.on('decoRemoved', function (o) { if (V.selDeco === o) V.selectDeco(null); });

  /* ---------- Spielschleife ---------- */
  function frame(ts) {
    requestAnimationFrame(frame);
    const now = Date.now();
    let dt = (ts - last) / 1000; last = ts;
    const wall = (now - lastWall) / 1000; lastWall = now;
    if (dt > 0 && dt < 0.5) {                        // läuft es zäh? Dann die Auflösung der Zeichenfläche schrittweise senken
      frameAvg += (dt - frameAvg) * 0.05;
      if (frameAvg > 0.03 && R > 1) { if (++slow > 120) { slow = 0; frameAvg = 0.016; maxR = Math.max(1, R - 0.5); fit(); } } else slow = 0;
    }
    if (!(dt > 0) || dt > 0.05) dt = dt > 0.05 ? 0.05 : 0.016;
    if (AA.visit) { /* zu Besuch: der Stand des Freundes bleibt, wie er gespeichert wurde – nur die Fische schwimmen */ }
    else if (wall > 1.5) AA.catchUp(wall * AA.speed());      // Tab war im Hintergrund / Rechner hat geschlafen
    else if (wall > 0) AA.tick(wall * AA.speed(), wall);
    V.update(dt);
    ctx.setTransform(R, 0, 0, R, 0, 0);
    V.render(ctx);
    AA.mini.frame(dt);
    uiT -= dt; if (uiT <= 0) { uiT = 0.25; UI.tick(); }
    saveT += dt; if (saveT > 10) { saveT = 0; AA.save(); }
  }

  /* Start in zwei Schritten: erst klären, WELCHER Spielstand gilt (zu Besuch bei einem Freund? liegt in der Wolke etwas Neueres? – js/cloud.js),
     dann wie gewohnt laden und loslegen. Ohne Wolke geht es sofort weiter. */
  function boot() {
    const C = AA.cloud, v = C && C.visitData ? C.visitData() : null;
    if (v) {
      if (AA.loadRaw(v.raw, true)) {
        AA.visit = v;
        try { const mine = JSON.parse(localStorage.getItem(AA.SAVE_KEY) || '{}').settings || {}, st = AA.state.settings; st.sound = mine.sound !== false; st.music = mine.music !== false; st.amb = mine.amb; st.night = !!mine.night; } catch (e) { /* dann die Einstellungen des Freundes */ }
        start(null); return;
      }
      C.clearVisit();                                // der Stand des Freundes ließ sich nicht lesen: einfach nach Hause
    }
    const go = function () {
      let back = null;
      if (AA.load()) {
        const s = AA.state, away = (Date.now() - (s.lastSeen || Date.now())) / 1000;
        if (away > 30) { back = AA.catchUp(away * AA.speed()); back.real = away; }
      } else AA.newGame();
      start(back);
    };
    if (C && C.on) C.before(go); else go();
  }
  function start(back) {
    canvas = $('#cv'); ctx = canvas.getContext('2d');
    AA.audio.on = !!AA.state.settings.sound;
    AA.audio.mode = 'rec'; AA.audio.amb = AA.state.settings.amb !== false;     // Runde 11: nur noch die neuen Klänge; Blubbern im Hintergrund
    fit();
    window.addEventListener('resize', fit);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', function () { if (!V.pointer.down) V.pointer.inside = false; });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', function () { if (document.hidden) AA.save(); });
    window.addEventListener('pagehide', function () { AA.save(); });
    window.addEventListener('beforeunload', function () { AA.save(); });
    AA.assets.load(function (p) { $('#load-fill').style.width = Math.round(p * 100) + '%'; }).then(function () {
      V.rebuild();
      UI.init();
      lastWall = Date.now();
      requestAnimationFrame(function (ts) { last = ts; requestAnimationFrame(frame); });
      if (V.prewarm) V.prewarm();                      // Runde 14: Nachbarbecken im Leerlauf vorbereiten
      const ld = $('#loading'); ld.classList.add('gone'); setTimeout(function () { ld.style.display = 'none'; }, 600);
      const hello = function () {
        if (!AA.state.intro) { delete AA.state.news; UI.intro(); }
        else if (AA.state.news) UI.news();            // einmalig nach einem Update (Umzug ins Süßwasser, was neu ist)
        else if (back && back.real > 120) UI.welcomeBack(back);
      };
      if (UI.cloudBoot) UI.cloudBoot(hello); else hello();      // mit Wolke: erst anmelden bzw. Besuchs-Ansicht, dann das Übliche
      AA.ready = true;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.AA);
