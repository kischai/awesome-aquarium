'use strict';
/* Awesome Aquarium – Training: Hindernis-Parcours. Der Fisch schwimmt von allein nach rechts, du räumst ihm den Weg frei,
   indem du die Hindernisse im richtigen Moment anklickst. 3 Versuche; nach einem Treffer geht es kurz vor dem Hindernis weiter.
   Wer durchkommt, lernt den nächsten Trick und bekommt Münzen + Futter (plus alles, was unterwegs eingesammelt wurde). */
(function (AA) {
  const M = AA.mini, TAU = Math.PI * 2;
  const FX = 230, FY = 300, FLOOR = 438, HITW = 46, SPEED = 170;
  /* T = so lange bleibt das Hindernis nach dem Klick harmlos (Sekunden); r = Klick-Radius; dy = Klick-Mitte relativ zur Bahn */
  const OB = {
    hook: { img: 'prop/hook', w: 62, name: 'Haken', hint: 'einfach wegklicken', r: 62, dy: -34 },
    bomb: { img: 'prop/bomb', w: 76, name: 'Bombe', hint: 'SOFORT klicken!', r: 62, dy: 0, fuse: 1.7 },
    umbrella: { img: 'prop/umbrella', w: 126, name: 'Regenschirm', hint: 'klicken, wenn der Fisch nah ist', r: 82, dy: -8, T: 1.3 },
    plant: { img: 'prop/monsterplant', w: 150, name: 'Fress-Pflanze', hint: 'erst kurz davor klicken', r: 86, dy: 6, T: 1.0 },
    paw: { img: 'prop/catpaw', w: 88, name: 'Katzenpfote', hint: 'im letzten Moment klicken', r: 74, dy: -26, T: 0.85 }
  };
  const ORDER = ['hook', 'umbrella', 'bomb', 'plant', 'paw'];

  const T = AA.train = { f: null };

  T.start = function (fishData) {
    const st = AA.trainStatus(fishData);
    if (!st.ok) return st;
    const def = AA.FISH_BY[fishData.sp], idx = fishData.tricks.length;
    T.f = fishData; T.def = def; T.trick = st.trick; T.key = AA.spriteKey(fishData);
    T.fw = AA.clamp(def.len * AA.PHASE_SCALE[AA.phase(fishData)] * 1.15, 74, 150);   // lange Tiere (Muräne, Hai) nicht breiter als die Hindernis-Abstände
    T.phase = 'count'; T.count = 3.4; T.lastTick = 4; T.t = 0;
    T.scroll = 0; T.slow = 0; T.tries = AA.BAL.trainTries; T.pause = 0; T.flash = 0; T.wig = 0;
    T.loot = { coins: 0, food: 0 }; T.falling = []; T.fx = []; T.ink = 0; T.squid = null; T.poison = [];
    T.lootT = 2.2; T.done = false; T.resultShown = false; T.tank = AA.tank();
    // Parcours bauen: je mehr Tricks der Fisch schon kann, desto länger und gemeiner
    const n = 5 + Math.min(5, idx), obs = [];
    let X = 760, last = '';
    for (let i = 0; i < n; i++) {
      let type;
      if (i < Math.min(n, 2 + idx)) type = ORDER[i % ORDER.length];        // die ersten in fester Reihenfolge zum Kennenlernen
      else do { type = AA.pick(ORDER); } while (type === last);
      last = type;
      obs.push({ type: type, X: X, off: 0, lock: 0, gone: false, y: 0, vy: 0, fuse: null, smoke: 0, seen: false, a: 1 });
      X += AA.rand(430, 540);
    }
    T.obs = obs; T.finish = X - 160;
    // Störungen von oben: Giftfutter und der lila Tintenfisch
    T.events = [];
    const np = 1 + Math.min(3, Math.floor(idx / 2)), ns = idx >= 1 ? 1 + (idx >= 4 ? 1 : 0) : 0;
    for (let i = 0; i < np; i++) T.events.push({ at: AA.rand(300, T.finish - 500), kind: 'poison' });
    for (let i = 0; i < ns; i++) T.events.push({ at: AA.rand(500, T.finish - 600), kind: 'squid' });
    T.events.sort(function (a, b) { return a.at - b.at; });
    M.open(T, '🎓 Training: ' + AA.esc(fishData.name), 'Lernziel: <b>' + AA.esc(st.trick.name) + '</b> · Klick die Hindernisse im richtigen Moment weg');
    return st;
  };

  function sx(o) { return FX + (o.X - T.scroll); }
  function puff(x, y, col, n) { for (let i = 0; i < (n || 8); i++) T.fx.push({ x: x, y: y, vx: AA.rand(-90, 90), vy: AA.rand(-110, 40), r: AA.rand(4, 10), life: 0, max: AA.rand(0.4, 0.8), col: col }); }
  function hit(o, why) {
    T.tries--; T.flash = 1; AA.audio.play(why === 'smoke' ? 'boom' : 'hit');
    T.hitOb = o;
    if (T.tries <= 0) { T.phase = 'lose'; T.pause = 1.2; return; }
    T.phase = 'hitpause'; T.pause = 1.3;
  }
  function rearm(o) { o.off = 0; o.lock = 0; o.gone = false; o.y = 0; o.vy = 0; o.fuse = null; o.smoke = 0; o.seen = false; o.a = 1; }

  T.update = function (dt) {
    T.t += dt;
    for (let i = T.fx.length - 1; i >= 0; i--) { const p = T.fx[i]; p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; if (p.life > p.max) T.fx.splice(i, 1); }
    if (T.flash > 0) T.flash = Math.max(0, T.flash - dt * 2.2);
    if (T.phase === 'count') {
      T.count -= dt;
      const c = Math.ceil(T.count - 0.4);
      if (c !== T.lastTick && c >= 1 && c <= 3) { T.lastTick = c; AA.audio.play('tick'); }
      if (T.count <= 0.4 && T.lastTick !== 0) { T.lastTick = 0; AA.audio.play('go'); }
      if (T.count <= 0) T.phase = 'run';
      return;
    }
    if (T.phase === 'hitpause') {
      T.pause -= dt;
      if (T.pause <= 0) {                             // kurz vor dem Hindernis wieder einsetzen
        const o = T.hitOb; rearm(o);
        T.scroll = Math.max(0, o.X - 330); T.slow = 0; T.ink = 0; T.squid = null; T.poison = [];
        T.phase = 'run';
      }
      return;
    }
    if (T.phase === 'lose' || T.phase === 'win') {
      T.pause -= dt; T.wig += dt;
      if (T.pause <= 0 && !T.resultShown) { T.resultShown = true; finish(); }
      return;
    }
    // ---- läuft ----
    if (T.slow > 0) T.slow -= dt;
    if (T.ink > 0) T.ink -= dt;
    const v = SPEED * (T.slow > 0 ? 0.6 : 1);
    T.scroll += v * dt;
    while (T.events.length && T.scroll >= T.events[0].at) {
      const ev = T.events.shift();
      if (ev.kind === 'poison') T.poison.push({ x: FX + 330, y: -30, vx: -150, vy: 150, rot: 0 });
      else if (!T.squid) T.squid = { x: AA.rand(560, 780), y: -90, ty: AA.rand(100, 150), t: 1.9, gone: false };
    }
    for (let i = 0; i < T.obs.length; i++) {
      const o = T.obs[i], d = OB[o.type], x = sx(o);
      if (x < -200) continue;
      if (o.gone) { o.vy += (o.type === 'hook' ? -1400 : 900) * dt; o.y += o.vy * dt; o.a = Math.max(0, o.a - dt * 1.6); continue; }
      if (o.off > 0) { o.off -= dt * v / SPEED; if (o.off <= 0) { o.off = 0; o.lock = 0.45; AA.audio.play('snap'); } }   // läuft mit dem Fisch-Tempo: vergiftet bleibt das Zeitfenster gleich groß
      if (o.lock > 0) o.lock -= dt;
      if (o.type === 'bomb') {
        if (o.smoke > 0) {
          o.smoke -= dt;
          if (o.smoke <= 0) { o.gone = true; o.a = 0; }
          else if (Math.abs(x - FX) < 78) { o.smoke = 0; hit(o, 'smoke'); return; }
          continue;
        }
        if (!o.seen && x < M.W - 40 && !(T.ink > 0 && x > 470)) { o.seen = true; o.fuse = d.fuse; }   // unter der Tinte zündet die Lunte noch nicht – das wäre unfair
        if (o.seen && o.fuse !== null) {
          o.fuse -= dt;
          if (o.fuse <= 0) { o.fuse = null; o.smoke = 9; AA.audio.play('boom'); puff(x, FY, '#5b5b66', 16); }
        }
        if (o.fuse !== null && Math.abs(x - FX) < HITW) { hit(o, 'bomb'); return; }
        continue;
      }
      if (o.off <= 0 && Math.abs(x - FX) < HITW) { hit(o, o.type); return; }
    }
    // Giftfutter
    for (let i = T.poison.length - 1; i >= 0; i--) {
      const p = T.poison[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 2;
      if (Math.hypot(p.x - FX, p.y - FY) < 46) { T.poison.splice(i, 1); T.slow = 4; puff(FX, FY, '#7fd43a', 12); AA.audio.play('error'); }
      else if (p.y > FLOOR + 40) T.poison.splice(i, 1);
    }
    // Tintenfisch
    if (T.squid) {
      const s = T.squid;
      if (s.gone) { s.y -= 420 * dt; if (s.y < -120) T.squid = null; }
      else {
        s.y += (s.ty - s.y) * Math.min(1, dt * 3.5);
        s.t -= dt;
        if (s.t <= 0) { T.ink = 3.6; s.gone = true; AA.audio.play('ink'); puff(s.x, s.y + 40, '#4a1a66', 18); }
      }
    }
    // Münzen und Futter, die herunterrieseln
    T.lootT -= dt;
    if (T.lootT <= 0) { T.lootT = AA.rand(1.5, 3); T.falling.push({ kind: Math.random() < 0.62 ? 'coin' : 'food', x: AA.rand(340, 900), y: -24, vy: AA.rand(58, 88), ph: Math.random() * 6 }); }
    for (let i = T.falling.length - 1; i >= 0; i--) { const q = T.falling[i]; q.y += q.vy * dt; q.x += Math.sin(T.t * 2 + q.ph) * 18 * dt - v * 0.12 * dt; if (q.y > FLOOR + 10) T.falling.splice(i, 1); }
    if (T.scroll >= T.finish) { T.phase = 'win'; T.pause = 1.1; T.wig = 0; AA.audio.play('win'); puff(FX, FY, '#ffe36e', 18); }
  };

  T.down = function (p) {
    if (T.phase !== 'run') return;
    // 1) Dinge von oben: Münzen, Futter, Gift, Tintenfisch
    for (let i = T.falling.length - 1; i >= 0; i--) {
      const q = T.falling[i];
      if (Math.hypot(p.x - q.x, p.y - q.y) < 36) {
        T.falling.splice(i, 1);
        if (q.kind === 'coin') T.loot.coins++; else T.loot.food++;
        AA.audio.play(q.kind === 'coin' ? 'coin' : 'pop'); puff(q.x, q.y, q.kind === 'coin' ? '#ffd23f' : '#ff9a3c', 6);
        return;
      }
    }
    for (let i = T.poison.length - 1; i >= 0; i--) {
      const q = T.poison[i];
      if (Math.hypot(p.x - q.x, p.y - q.y) < 46) { T.poison.splice(i, 1); AA.audio.play('pop'); puff(q.x, q.y, '#9b59d0', 10); return; }
    }
    if (T.squid && !T.squid.gone && Math.hypot(p.x - T.squid.x, p.y - T.squid.y) < 70) { T.squid.gone = true; AA.audio.play('pop'); puff(T.squid.x, T.squid.y, '#d7a8f5', 8); return; }
    // 2) Hindernisse auf der Bahn
    let best = null, bd = 1e9;
    for (let i = 0; i < T.obs.length; i++) {
      const o = T.obs[i], d = OB[o.type], x = sx(o);
      if (o.gone || x > M.W + 20 || x < FX - 60) continue;
      if (o.type === 'bomb' && o.fuse === null) continue;
      const dd = Math.hypot(p.x - x, p.y - (FY + d.dy));
      if (dd < d.r && dd < bd) { bd = dd; best = o; }
    }
    if (!best) return;
    const d = OB[best.type], x = sx(best);
    if (best.type === 'hook') { best.gone = true; best.vy = -200; AA.audio.play('pop'); }
    else if (best.type === 'bomb') { best.gone = true; best.vy = -260; best.fuse = null; AA.audio.play('pop'); puff(x, FY - 40, '#ffd23f', 6); }
    else if (best.off <= 0 && best.lock <= 0) { best.off = d.T; AA.audio.play('snap'); puff(x, FY + d.dy, '#ffffff', 6); }
  };

  function finish() {
    const f = T.f, ok = T.phase === 'win';
    T.done = true;
    const res = AA.finishTraining(f, ok, T.loot);
    AA.save();
    if (ok) {
      const more = f.tricks.length < AA.TRICKS.length;
      M.result('<div class="h2">Geschafft! 🎉</div><p><b>' + AA.esc(f.name) + '</b> kann jetzt den Trick <b>' + AA.esc(res.trick.name) + '</b>.</p>' +
        '<div class="rewards"><span>🪙 +' + res.coins + '</span><span>🥫 +' + res.food + '</span></div>' +
        '<p class="small">Belohnung ' + res.base.coins + ' 🪙 + ' + res.base.food + ' 🥫' + (res.loot.coins || res.loot.food ? ' · unterwegs gesammelt ' + res.loot.coins + ' 🪙 + ' + res.loot.food + ' 🥫' : '') + '</p>' +
        '<p class="small">' + (res.trick.id === 'follow' ? 'Vorführen: Werkzeug „Tricks“ wählen und ' + AA.say('die Maustaste gedrückt halten', 'den Finger aufs Becken halten') + ' – der Fisch folgt der Hand.' : 'Vorführen: Werkzeug „Tricks“ wählen und in der Nähe ans Glas klopfen.') +
        (more ? ' Den nächsten Trick gibt es in der nächsten Wachstumsphase.' : ' Damit ist ' + AA.esc(f.name) + ' voll ausgebildet!') + '</p>' +
        '<button class="btn green lg" data-act="close">Super!</button>');
    } else {
      const st = AA.trainStatus(f);
      M.result('<div class="h2">Knapp daneben 🙈</div><p>Drei Treffer – das Training ist für diese Wachstumsphase vorbei.</p>' +
        '<p class="small">' + (st.why === 'wait' ? 'Nächster Versuch in ' + AA.fmtDur(st.wait / AA.speed()) + '.' : '') + ' Eingesammeltes zählt nur, wenn der Parcours geschafft wird.</p>' +
        '<button class="btn blue lg" data-act="close">Okay</button>');
    }
    AA.emit('trained', f, ok, res);
  }
  /* Dialog vorzeitig geschlossen: vor dem Startschuss folgenlos, danach zählt es als Fehlversuch */
  T.abort = function () {
    if (T.done) return;
    T.done = true;
    if (T.phase === 'count') return;
    AA.finishTraining(T.f, T.phase === 'win', T.loot);
    AA.emit('trained', T.f, false, null);
  };

  /* ---------- Zeichnen ---------- */
  function drawOb(ctx, o) {
    const d = OB[o.type], im = AA.assets.get(d.img), x = sx(o);
    if (!im || x < -160 || x > M.W + 160) return;
    const w = d.w, h = w * im.height / im.width, t = T.t;
    ctx.save();
    ctx.globalAlpha = o.gone ? o.a : 1;
    if (o.type === 'hook') {
      const top = FY - h + 34 + o.y;
      ctx.strokeStyle = '#8b97a3'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + 2, -10); ctx.lineTo(x + 2, top + 8); ctx.stroke();
      ctx.translate(x, top); ctx.rotate(Math.sin(t * 2 + o.X) * 0.05);
      ctx.drawImage(im, -w / 2, 0, w, h);
    } else if (o.type === 'bomb') {
      if (o.smoke > 0) {                              // Rauchwolke
        const a = Math.min(1, o.smoke / 1.2);
        for (let i = 0; i < 9; i++) {
          const an = i * 0.7 + t * 0.4, rr = 46 + (i % 3) * 16;
          ctx.fillStyle = i % 2 ? 'rgba(70,70,82,' + (0.82 * a) + ')' : 'rgba(104,104,118,' + (0.82 * a) + ')';
          ctx.beginPath(); ctx.arc(x + Math.cos(an) * 46, FY + Math.sin(an * 1.3) * 40, rr, 0, TAU); ctx.fill();
        }
        M.text(ctx, '💀', x, FY, 44, '#fff');
      } else {
        ctx.translate(x, FY + 4 + o.y);
        if (o.fuse !== null && o.fuse < 0.7) ctx.scale(1 + Math.sin(t * 40) * 0.05, 1 + Math.sin(t * 40) * 0.05);
        ctx.drawImage(im, -w / 2, -h / 2, w, h);
        if (o.fuse !== null && !o.gone) {             // Lunte als Ring, der abläuft
          ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(0, 8, 54, -Math.PI / 2, -Math.PI / 2 + TAU * (o.fuse / d.fuse)); ctx.stroke();
        }
      }
    } else if (o.type === 'umbrella') {
      ctx.translate(x, FY - 8);
      if (o.off > 0) { ctx.scale(0.26, 1.04); ctx.globalAlpha = 0.8; }
      ctx.drawImage(im, -w / 2, -h / 2, w, h);
    } else if (o.type === 'plant') {
      ctx.translate(x + 30, FLOOR + 14);
      if (o.off > 0) { ctx.rotate(0.5); ctx.globalAlpha = 0.72; } else ctx.rotate(Math.sin(t * 3 + o.X) * 0.05);
      ctx.drawImage(im, -w * 0.5, -h, w, h);
    } else if (o.type === 'paw') {
      const up = o.off > 0 ? -210 : Math.sin(t * 3.2 + o.X) * 7;
      o.y += (up - o.y) * 0.25;
      const top = FY + 34 - h + o.y, cut = 0.22;
      ctx.drawImage(im, 0, 0, im.width, im.height * cut, x - w / 2, -40, w, top + h * cut + 40);   // der Arm reicht bis über den Rand
      ctx.drawImage(im, 0, im.height * cut, im.width, im.height * (1 - cut), x - w / 2, top + h * cut, w, h * (1 - cut));
    }
    ctx.restore();
    if (!o.gone && !(o.type === 'bomb' && o.smoke > 0) && x < M.W - 10 && x > FX + 20) {
      const safe = o.off > 0;
      M.pill(ctx, safe ? '✓ frei' : d.name + ' – ' + d.hint, x, o.type === 'paw' || o.type === 'hook' ? FLOOR - 6 : FY - 118, safe ? 'rgba(40,150,70,0.9)' : (o.type === 'bomb' ? 'rgba(190,40,40,0.92)' : 'rgba(8,50,78,0.86)'), 13);
    }
  }

  T.render = function (ctx) {
    const t = T.t;
    M.scene(ctx, T.tank, T.scroll, FLOOR);
    // Ziel-Fahne
    const gx = FX + (T.finish - T.scroll) + 60;
    if (gx < M.W + 60) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(gx - 3, 70, 6, FLOOR - 50);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = (i + j) % 2 ? '#1b2a3a' : '#ffffff'; ctx.fillRect(gx + 3 + i * 18, 70 + j * 18, 18, 18); }
    }
    for (let i = 0; i < T.obs.length; i++) drawOb(ctx, T.obs[i]);
    // Fisch
    const bob = Math.sin(t * 3) * 5, hurt = T.phase === 'hitpause' || T.phase === 'lose';
    ctx.save();
    if (hurt) ctx.globalAlpha = 0.45 + 0.4 * Math.abs(Math.sin(t * 16));
    let tilt = Math.sin(t * 3 + 1) * 0.06;
    if (T.phase === 'win') tilt = Math.sin(T.wig * 9) * 0.4;
    if (hurt) tilt = 0.5;
    M.fish(ctx, T.key, FX, FY + bob, T.fw, t * (T.slow > 0 ? 6 : 11), 1.05, tilt, hurt, T.f.v);
    ctx.restore();
    if (T.slow > 0) { M.pill(ctx, '🤢 vergiftet – langsamer', FX, FY - 78, 'rgba(90,150,40,0.92)', 13); }
    // Dinge von oben
    for (let i = 0; i < T.falling.length; i++) { const q = T.falling[i]; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(Math.sin(t * 2 + q.ph) * 0.25); M.sprite(ctx, q.kind === 'coin' ? 'prop/coin' : 'prop/foodcan', 0, 0, q.kind === 'coin' ? 38 : 30); ctx.restore(); }
    for (let i = 0; i < T.poison.length; i++) { const q = T.poison[i]; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(Math.sin(q.rot) * 0.4); M.sprite(ctx, 'prop/poison', 0, 0, 44); ctx.restore(); M.pill(ctx, 'Gift – wegklicken!', q.x, q.y - 48, 'rgba(120,50,170,0.92)', 13); }
    if (T.squid) {
      const s = T.squid;
      ctx.save(); ctx.translate(s.x, s.y);
      AA.drawFishSprite(ctx, 'fish/squid_m', 74, t * 5, 1, false);
      ctx.restore();
      if (!s.gone) M.pill(ctx, 'Tintenfisch – wegklicken!', s.x, s.y + 84, 'rgba(120,50,170,0.92)', 13);
    }
    for (let i = 0; i < T.fx.length; i++) { const p = T.fx[i]; ctx.globalAlpha = Math.max(0, 1 - p.life / p.max); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    // Tinte: verdeckt die rechte Seite
    if (T.ink > 0) {
      const a = Math.min(1, T.ink / 0.6) * 0.88;
      ctx.fillStyle = 'rgba(52,16,78,' + a.toFixed(3) + ')';
      for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc(420 + (i % 4) * 170 + Math.sin(t + i) * 20, 110 + Math.floor(i / 4) * 150 + Math.cos(t * 0.8 + i * 2) * 18, 128, 0, TAU); ctx.fill(); }
    }
    if (T.flash > 0) { ctx.fillStyle = 'rgba(255,60,60,' + (0.35 * T.flash).toFixed(3) + ')'; ctx.fillRect(0, 0, M.W, M.H); }
    // Anzeige: Versuche, Fortschritt, Gesammeltes
    for (let i = 0; i < AA.BAL.trainTries; i++) { ctx.save(); ctx.globalAlpha = i < T.tries ? 1 : 0.22; AA.drawHeart(ctx, 34 + i * 38, 34, 34); ctx.restore(); }
    const pw = 360, px = (M.W - pw) / 2, pr = AA.clamp(T.scroll / T.finish, 0, 1);
    ctx.fillStyle = 'rgba(8,50,78,0.55)'; AA.roundRect(ctx, px, 22, pw, 18, 9); ctx.fill();
    ctx.fillStyle = '#58d26a'; AA.roundRect(ctx, px + 2, 24, Math.max(14, (pw - 4) * pr), 14, 7); ctx.fill();
    M.text(ctx, '🏁', px + pw + 16, 31, 20);
    M.sprite(ctx, 'prop/coin', M.W - 150, 32, 30); M.text(ctx, '' + T.loot.coins, M.W - 118, 33, 22, '#ffe36e', 'left');
    M.sprite(ctx, 'prop/foodcan', M.W - 70, 32, 22); M.text(ctx, '' + T.loot.food, M.W - 48, 33, 22, '#ffd0a0', 'left');
    if (T.phase === 'count') {
      const c = Math.ceil(T.count - 0.4), k = (T.count - 0.4) % 1;
      ctx.fillStyle = 'rgba(8,40,66,0.35)'; ctx.fillRect(0, 0, M.W, M.H);
      M.text(ctx, c >= 1 ? '' + c : 'Los!', M.W / 2, M.H / 2 - 10, 120 + (c >= 1 ? k * 40 : 0), '#fff');
      M.text(ctx, 'Klick die Hindernisse weg, bevor ' + T.f.name + ' sie erreicht', M.W / 2, M.H / 2 + 110, 22, '#fff3a6');
    } else if (T.phase === 'hitpause') {
      M.text(ctx, 'Autsch! Noch ' + T.tries + (T.tries === 1 ? ' Versuch' : ' Versuche'), M.W / 2, M.H / 2 - 120, 40, '#ffd0d0');
    }
  };
})(window.AA);
