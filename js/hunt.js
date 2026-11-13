'use strict';
/* Awesome Aquarium – Schatzsuche: 45 Sekunden lang schwimmt ein Fisch deiner Wahl der Maus hinterher und sammelt Münzen.
   Versteckte Kisten am Grund geben Extra-Preise (Münzen, Futter, ab und zu eine Perle oder ein Deko-Stück fürs Becken). */
(function (AA) {
  const M = AA.mini, TAU = Math.PI * 2;
  const FLOOR = 438, SPEED = 120;
  const SCENERY = ['rock_grey', 'seaweed_brown', 'coral_purple', 'rocks_brown', 'seaweed_lime', 'braincoral', 'coral_plate', 'seaweed_pink', 'mushrooms', 'coral_lilac'];
  const PRIZE_DECO = ['starfish', 'seaweed_brown', 'rock_grey', 'seaweed_lime', 'braincoral', 'mushrooms', 'coral_purple',
    'ludwigia', 'conch', 'tubesponge', 'bottle', 'cupcoral', 'seaslug', 'turbosnail'];

  const H = AA.hunt = {};

  H.start = function (fishData) {
    if (!AA.beginHunt()) return false;
    const def = AA.FISH_BY[fishData.sp];
    H.f = fishData; H.key = AA.spriteKey(fishData);
    H.fw = AA.clamp(def.len * AA.PHASE_SCALE[AA.phase(fishData)] * 0.95, 64, 170);
    H.x = 220; H.y = 270; H.vx = 0; H.vy = 0; H.px = 300; H.py = 270;
    H.t = 0; H.left = AA.BAL.huntSeconds; H.scroll = 0; H.intro = 1.6; H.over = false; H.done = false; H.shown = false;
    H.coins = 0; H.items = []; H.prizes = []; H.fx = []; H.pops = []; H.spawnT = 0.4; H.tank = AA.tank();
    H.chests = [{ at: AA.rand(7, 12) }, { at: AA.rand(20, 27) }, { at: AA.rand(33, 40) }];
    H.props = []; H.propX = 300;
    M.open(H, '🧭 Schatzsuche', AA.say('Beweg die Maus', 'Zieh mit dem Finger') + ' – <b>' + AA.esc(fishData.name) + '</b> schwimmt hinterher. Münzen einsammeln, Kisten am Grund aufstöbern!');
    AA.save();
    return true;
  };

  function prize() {
    const s = AA.state, r = Math.random();
    if (r < 0.1) return { kind: 'pearl', n: 1, txt: '+1 Perle', ico: '🦪' };
    if (r < 0.26) {
      const pool = PRIZE_DECO.filter(function (id) { return AA.DECO_BY[id].lvl <= s.level && AA.decoFits(AA.DECO_BY[id], H.tank); });
      if (pool.length) { const id = AA.pick(pool); return { kind: 'deco', type: id, txt: AA.DECO_BY[id].name, ico: '🎁' }; }
    }
    if (r < 0.55) { const n = AA.randi(4, 10); return { kind: 'food', n: n, txt: '+' + n + ' Futter', ico: '🥫' }; }
    const n = AA.randi(8, 18) + Math.floor(s.level / 3);
    return { kind: 'coins', n: n, txt: '+' + n + ' Münzen', ico: '🪙' };
  }
  function spawnCoins() {
    const kind = Math.random(), x0 = M.W + 40, y0 = AA.rand(100, 390);
    if (kind < 0.3) for (let i = 0; i < 3; i++) H.items.push({ x: x0 + i * 50, y: y0, ph: i });
    else if (kind < 0.5) for (let i = 0; i < 5; i++) H.items.push({ x: x0 + i * 44, y: AA.clamp(y0 - Math.sin(i / 4 * Math.PI) * 80, 80, 400), ph: i });
    else if (kind < 0.75) for (let i = 0; i < 2; i++) H.items.push({ x: x0, y: AA.clamp(y0 + i * 48, 80, 400), ph: i });
    else H.items.push({ x: x0, y: y0, ph: 0 });
  }
  function puff(x, y, col, n) { for (let i = 0; i < (n || 6); i++) H.fx.push({ x: x, y: y, vx: AA.rand(-80, 80), vy: AA.rand(-100, 20), r: AA.rand(3, 8), life: 0, max: AA.rand(0.35, 0.7), col: col }); }

  H.move = function (p) { H.px = p.x; H.py = p.y; };
  H.down = function (p) { H.px = p.x; H.py = p.y; };

  H.update = function (dt) {
    H.t += dt;
    for (let i = H.fx.length - 1; i >= 0; i--) { const p = H.fx[i]; p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt; if (p.life > p.max) H.fx.splice(i, 1); }
    for (let i = H.pops.length - 1; i >= 0; i--) { const p = H.pops[i]; p.life += dt; p.y -= 30 * dt; if (p.life > 1.8) H.pops.splice(i, 1); }
    // Fisch folgt dem Zeiger
    const tx = AA.clamp(H.px, 50, M.W - 240), ty = AA.clamp(H.py, 70, FLOOR - 26);
    H.vx += ((tx - H.x) * 5 - H.vx) * Math.min(1, dt * 6); H.vy += ((ty - H.y) * 5 - H.vy) * Math.min(1, dt * 6);
    H.x += H.vx * dt; H.y += H.vy * dt;
    if (H.over) { if (!H.shown && H.t - H.overAt > 0.9) { H.shown = true; finish(); } return; }
    if (H.intro > 0) { H.intro -= dt; return; }
    H.left -= dt;
    const run = AA.BAL.huntSeconds - H.left;
    H.scroll += SPEED * dt;
    // Kulisse und Münzen wandern nach links
    while (H.propX < H.scroll + M.W + 200) { H.props.push({ X: H.propX, type: AA.pick(SCENERY), flip: Math.random() < 0.5, w: AA.rand(90, 170) }); H.propX += AA.rand(190, 380); }
    while (H.props.length && H.props[0].X < H.scroll - 260) H.props.shift();
    H.spawnT -= dt;
    if (H.spawnT <= 0) { H.spawnT = AA.rand(1.9, 3.2); spawnCoins(); }
    for (let i = H.items.length - 1; i >= 0; i--) {
      const c = H.items[i]; c.x -= SPEED * dt;
      if (Math.hypot(c.x - H.x, c.y - H.y) < 30 + H.fw * 0.22) { H.items.splice(i, 1); H.coins++; AA.audio.play('coin'); puff(c.x, c.y, '#ffd23f', 5); }
      else if (c.x < -40) H.items.splice(i, 1);
    }
    // versteckte Kisten
    for (let i = 0; i < H.chests.length; i++) {
      const c = H.chests[i];
      if (c.x === undefined) { if (run >= c.at) { c.x = M.W + 80; c.open = false; c.weed = AA.pick(['seaweed_brown', 'seaweed_lime', 'seaweed_pink']); } continue; }
      c.x -= SPEED * dt;
      if (!c.open && Math.hypot(c.x - H.x, FLOOR - 20 - H.y) < 62) {
        c.open = true;
        const p = prize(); H.prizes.push(p);
        H.pops.push({ x: c.x, y: FLOOR - 96, str: p.ico + ' ' + p.txt, life: 0 });
        AA.audio.play('chest'); puff(c.x, FLOOR - 50, '#fff3a6', 14);
      }
    }
    if (H.left <= 0) { H.left = 0; H.over = true; H.overAt = H.t; AA.audio.play('win'); }
  };

  function finish() {
    H.done = true;
    const placed = AA.finishHunt(H.coins, H.prizes);
    AA.save();
    let list = '';
    H.prizes.forEach(function (p) { list += '<span>' + p.ico + ' ' + AA.esc(p.txt) + '</span>'; });
    M.result('<div class="h2">Zeit um! ⏱</div><p><b>' + AA.esc(H.f.name) + '</b> hat <b>' + H.coins + ' Münzen</b> eingesammelt' + (H.coins ? ' (+' + H.coins + ' XP)' : '') + '.</p>' +
      '<div class="rewards"><span>🪙 +' + H.coins + '</span>' + list + '</div>' +
      (placed.length ? '<p class="small">Die Deko aus den Kisten steht jetzt in deinem Becken.</p>' : '') +
      '<p class="small">Schatzsuchen heute übrig: ' + AA.huntsLeft() + ' von ' + AA.BAL.hunts + '.</p>' +
      '<button class="btn green lg" data-act="close">Fertig</button>');
    AA.emit('hunted', H.coins, H.prizes);
  }
  /* vorzeitig geschlossen: was bis dahin gesammelt wurde, zählt */
  H.abort = function () { if (H.done) return; H.done = true; AA.finishHunt(H.coins, H.prizes); AA.emit('hunted', H.coins, H.prizes); AA.save(); };

  H.render = function (ctx) {
    const t = H.t;
    M.scene(ctx, H.tank, H.scroll, FLOOR);
    for (let i = 0; i < H.props.length; i++) {      // Kulisse
      const p = H.props[i], im = AA.assets.get('deco/' + p.type); if (!im) continue;
      const x = p.X - H.scroll, h = p.w * im.height / im.width;
      ctx.save(); ctx.translate(x, FLOOR + 22); if (p.flip) ctx.scale(-1, 1);
      ctx.globalAlpha = 0.92; ctx.drawImage(im, -p.w / 2, -h, p.w, h); ctx.restore();
    }
    for (let i = 0; i < H.chests.length; i++) {     // Kisten, halb hinter Seegras versteckt
      const c = H.chests[i]; if (c.x === undefined || c.x < -120) continue;
      M.sprite(ctx, c.open ? 'deco/chest' : 'deco/chest_closed', c.x, FLOOR - (c.open ? 30 : 22), 84);
      const wim = AA.assets.get('deco/' + c.weed);
      if (wim && !c.open) { ctx.save(); ctx.translate(c.x - 26, FLOOR + 26); AA.drawSway(ctx, wim, 70, 70 * wim.height / wim.width, t, 0.08, c.at); ctx.restore(); }
    }
    const coin = AA.assets.get('prop/coin');
    for (let i = 0; i < H.items.length; i++) {
      const c = H.items[i], k = Math.abs(Math.cos(t * 3 + c.ph * 0.6)) * 0.6 + 0.4;
      if (coin) ctx.drawImage(coin, c.x - 17 * k, c.y - 17 + Math.sin(t * 3 + c.ph) * 3, 34 * k, 34 * coin.height / coin.width);
    }
    M.fish(ctx, H.key, H.x, H.y, H.fw, t * 10, 1, AA.clamp(H.vy * 0.0022, -0.5, 0.5), false, H.f.v);
    for (let i = 0; i < H.fx.length; i++) { const p = H.fx[i]; ctx.globalAlpha = Math.max(0, 1 - p.life / p.max); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (let i = 0; i < H.pops.length; i++) { const p = H.pops[i]; ctx.globalAlpha = p.life < 1.3 ? 1 : Math.max(0, 1 - (p.life - 1.3) / 0.5); M.text(ctx, p.str, AA.clamp(p.x, 110, M.W - 110), p.y, 26, '#fff3a6'); }
    ctx.globalAlpha = 1;
    // Anzeige
    const pw = 360, px = (M.W - pw) / 2, pr = AA.clamp(H.left / AA.BAL.huntSeconds, 0, 1);
    ctx.fillStyle = 'rgba(8,50,78,0.55)'; AA.roundRect(ctx, px, 22, pw, 18, 9); ctx.fill();
    ctx.fillStyle = pr > 0.25 ? '#58d26a' : '#ff5a4d'; AA.roundRect(ctx, px + 2, 24, Math.max(14, (pw - 4) * pr), 14, 7); ctx.fill();
    M.text(ctx, '⏱ ' + Math.ceil(H.left) + ' s', px - 52, 32, 22);
    M.sprite(ctx, 'prop/coin', M.W - 120, 32, 32); M.text(ctx, '' + H.coins, M.W - 94, 33, 26, '#ffe36e', 'left');
    for (let i = 0; i < H.prizes.length; i++) M.text(ctx, H.prizes[i].ico, 34 + i * 34, 34, 24);
    if (H.intro > 0) M.text(ctx, H.intro > 0.5 ? 'Bereit?' : 'Los!', M.W / 2, M.H / 2 - 20, 90, '#fff');
    if (H.over) M.text(ctx, 'Zeit um!', M.W / 2, M.H / 2 - 20, 80, '#fff3a6');
  };
})(window.AA);
