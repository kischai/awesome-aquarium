'use strict';
/* Awesome Aquarium – Runde 12: Pokale 🏆, Licht-Studio 💡, lebende Kulissen 🎞️, Becken-Hilfe 🧽 und Geschenke 🎁.
     • Pokale: Deko-Stücke, die es nicht zu kaufen gibt. Wochen-Rangliste (Schönheit, gegen Familie und Testi) → Platz 1/2/3 = Gold/Silber/Bronze,
       volle 7-Tage-Serie im Login-Kalender → Sternenpokal, ein Becken mit Gold-Biotop (4 von 4) → Goldfisch-Statue (einmal je Biotop).
       Sie landen im Deko-Lager und zählen in die Schönheits-Note (je 2 Punkte, höchstens 4).
     • Licht-Studio: Lichtfarbe je Becken (einmal kaufen, in jedem Becken nutzbar) und kräftigere Lichtstrahlen. Zählt in die Schönheit.
     • Lebende Kulissen: bei Kulissen mit `live` ziehen im Hintergrund Silhouetten vorbei (Wal, Schwarm, Lichter der Stadt, Quallen, Polartiere).
     • Becken-Hilfe und Geschenke: siehe unten (mit Testi auch ohne Netz; mit der Familie über js/cloud.js, sobald die Wolke läuft). */
(function (AA) {
  const TAU = Math.PI * 2, W = AA.W, H = AA.H;
  function S() { return AA.state; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ================= Pokale ================= */
  AA.TROPHY = { beauty: 2, beautyMax: 4 };
  AA.trophyCount = function (id) {
    const s = S(); if (!s) return 0;
    let n = 0;
    s.tanks.forEach(function (t) { t.deco.forEach(function (o) { if (o.type === id) n++; }); });
    (s.storage || []).forEach(function (it) { if (it.type === id) n++; });
    return n;
  };
  AA.awardTrophy = function (id, why) {
    const s = S(), def = AA.DECO_BY[id];
    if (!s || !def) return false;
    s.storage = s.storage || [];
    s.storage.push({ type: id });
    s.trophies = s.trophies || [];
    s.trophies.push({ id: id, why: why || '', at: Date.now() });
    if (s.trophies.length > 60) s.trophies.splice(0, s.trophies.length - 60);
    AA.emit('storage');
    AA.emit('trophy', id, why);
    return true;
  };
  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return t.getUTCFullYear() + '-W' + String(Math.ceil(((t - y0) / 86400000 + 1) / 7)).padStart(2, '0');
  }
  AA.weekId = function () { return isoWeek(new Date(AA.nowMs ? AA.nowMs() : Date.now())); };
  /* Wochen-Wertung: beim ersten Start einer neuen Woche zählt, wie du in der Schönheits-Rangliste stehst (mindestens zwei Teilnehmer) */
  AA.weeklyTrophy = function () {
    const s = S(); if (!s || AA.visit) return null;
    const wk = AA.weekId();
    if (s.trophyWeek === wk) return null;
    s.trophyWeek = wk;
    const P = AA.ui && AA.ui.rankPeople ? AA.ui.rankPeople() : [];
    const rows = P.filter(function (p) { return typeof p.beauty === 'number'; }).sort(function (a, b) { return b.beauty - a.beauty || (a.me ? -1 : 1); });
    if (rows.length < 2) return null;
    let place = 0, prev = null, mine = 0;
    rows.forEach(function (p, i) { if (p.beauty !== prev) { place = i + 1; prev = p.beauty; } if (p.me) mine = place; });
    const id = mine === 1 ? 'trophy_gold' : (mine === 2 ? 'trophy_silver' : (mine === 3 ? 'trophy_bronze' : null));
    if (!id) return { place: mine };
    AA.awardTrophy(id, 'Platz ' + mine + ' der Schönheits-Rangliste (' + wk.replace('-W', ', Woche ') + ')');
    return { place: mine, id: id };
  };
  /* Goldfisch-Statue: ein Becken erreicht alle vier Biotop-Punkte – einmal je Biotop */
  AA.bioTrophy = function () {
    const s = S(); if (!s || AA.visit || !AA.biotope) return null;
    s.trophyBio = s.trophyBio || {};
    for (let i = 0; i < s.tanks.length; i++) {
      const r = AA.biotope(s.tanks[i]);
      if (r && r.pts >= 4 && !s.trophyBio[r.b.id]) { s.trophyBio[r.b.id] = 1; AA.awardTrophy('trophy_fish', 'Gold-Biotop „' + r.b.name + '“ in „' + s.tanks[i].name + '“'); return r.b; }
    }
    return null;
  };
  AA.on('login', function () {
    const s = S(), L = s && s.login;
    if (L && L.streak > 0 && L.streak % 7 === 0) AA.awardTrophy('trophy_star', 'Volle 7-Tage-Serie im Login-Kalender');
  });

  /* ================= Licht-Studio ================= */
  AA.LIGHTS = [
    { id: 'natur', name: 'Natur', ico: '☀️', price: 0, info: 'Das normale Tageslicht.' },
    { id: 'moon', name: 'Mondlicht-Blau', ico: '🌙', price: 1500, info: 'Kühles, ruhiges Blau – wie eine Vollmondnacht.' },
    { id: 'sunset', name: 'Sonnenuntergang', ico: '🌅', price: 2500, info: 'Warmes Orange oben, Rosa unten. Kitschig schön.' },
    { id: 'gold', name: 'Goldene Stunde', ico: '✨', price: 3000, info: 'Weiches, goldenes Licht – alles sieht teurer aus.' },
    { id: 'actinic', name: 'Aktinisch', ico: '💜', price: 3500, info: 'Blau-violettes Riff-Licht: Korallen und Fische leuchten.' },
    { id: 'disco', name: 'Disco', ico: '🪩', price: 8000, info: 'Spiegelkugel, bunte Spots, Party im Becken. Die Fische tun so, als wäre nichts.' }
  ];
  AA.LIGHT_BY = {}; AA.LIGHTS.forEach(function (l) { AA.LIGHT_BY[l.id] = l; });
  AA.RAYS = { price: 2000 };
  function owned() { const s = S(); s.lights = Array.isArray(s.lights) && s.lights.length ? s.lights : ['natur']; return s.lights; }
  AA.lightOwned = function (id) { const L = AA.LIGHT_BY[id]; return !!L && (!L.price || owned().indexOf(id) >= 0); };
  AA.setLight = function (id) {
    const s = S(), L = AA.LIGHT_BY[id], t = AA.tank();
    if (!L || AA.visit) return 'unknown';
    if (!AA.lightOwned(id)) {
      if (s.coins < L.price) return 'coins';
      AA.addCoins(-L.price, false); owned().push(id);
    }
    if (id === 'natur') delete t.light; else t.light = id;
    AA.emit('tankChanged');
    return true;
  };
  AA.setRays = function (on) {
    const s = S(), t = AA.tank();
    if (AA.visit) return 'unknown';
    if (on && !s.raysOwned) { if (s.coins < AA.RAYS.price) return 'coins'; AA.addCoins(-AA.RAYS.price, false); s.raysOwned = true; }
    if (on) t.rays = 1; else delete t.rays;
    AA.emit('tankChanged');
    return true;
  };
  /* Bonus für die Schönheits-Note (js/decor.js ruft das auf): Licht bis 4, Pokale bis 4 */
  AA.beautyExtra = function (t) {
    let licht = 0, pokale = 0;
    if (t.light && AA.LIGHT_BY[t.light]) licht += 2;
    if (t.rays) licht += 2;
    t.deco.forEach(function (o) { const d = AA.DECO_BY[o.type]; if (d && d.trophy) pokale += AA.TROPHY.beauty; });
    return { licht: licht, pokale: Math.min(AA.TROPHY.beautyMax, pokale) };
  };

  /* Zeichnen: liegt über Fischen und Deko, unter der Scheibe */
  AA.lightFx = function (ctx, tank, t) {
    const id = tank.light;
    if (tank.rays && !tank.deep) strongRays(ctx, t, id);
    if (!id || !AA.LIGHT_BY[id]) return;
    ctx.save();
    if (id === 'moon') {
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(60,92,205,0.6)'; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'screen';
      const g = ctx.createRadialGradient(W * 0.72, -60, 30, W * 0.72, -60, 700); g.addColorStop(0, 'rgba(175,205,255,0.5)'); g.addColorStop(1, 'rgba(175,205,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else if (id === 'sunset') {
      ctx.globalCompositeOperation = 'multiply';
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,165,95,0.62)'); g.addColorStop(0.55, 'rgba(255,120,150,0.55)'); g.addColorStop(1, 'rgba(170,95,190,0.55)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'screen';
      const r = ctx.createRadialGradient(W * 0.25, -40, 20, W * 0.25, -40, 640); r.addColorStop(0, 'rgba(255,190,110,0.5)'); r.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
    } else if (id === 'gold') {
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(255,212,130,0.5)'; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'screen';
      const r = ctx.createLinearGradient(0, 0, 0, H * 0.8); r.addColorStop(0, 'rgba(255,220,140,0.36)'); r.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
    } else if (id === 'actinic') {
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(135,105,255,0.58)'; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(90,50,200,0.22)'; ctx.fillRect(0, 0, W, H);
    } else if (id === 'disco') disco(ctx, t);
    ctx.restore();
  };
  function strongRays(ctx, t, id) {
    const col = id === 'moon' ? '190,215,255' : (id === 'sunset' ? '255,215,170' : (id === 'actinic' ? '200,170,255' : (id === 'gold' ? '255,230,160' : '255,255,235')));
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 7; i++) {
      const x = 90 + i * 180 + Math.sin(t * 0.17 + i * 2.3) * 60, w = 46 + (i % 3) * 30, a = 0.12 + 0.07 * Math.sin(t * 0.4 + i * 1.3);
      const g = ctx.createLinearGradient(0, 0, 0, 600); g.addColorStop(0, 'rgba(' + col + ',' + (a * 1.7).toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w - 120 + Math.sin(t * 0.3 + i) * 30, 620); ctx.lineTo(x - 170 + Math.sin(t * 0.3 + i) * 30, 620); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  const DISCO = ['255,60,170', '60,200,255', '255,230,60', '120,255,120', '190,90,255', '255,140,60'];
  function disco(ctx, t) {
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(85,75,165,0.55)'; ctx.fillRect(0, 0, W, H);      // dunkler, damit die Spots leuchten
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 6; i++) {
      const a = t * (0.5 + i * 0.07) + i * 1.9, x = W / 2 + Math.cos(a) * W * (0.3 + 0.08 * (i % 3)), y = H * 0.5 + Math.sin(a * 1.3) * H * 0.3, r = 120 + 40 * Math.sin(t * 1.7 + i);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + DISCO[i] + ',0.62)'); g.addColorStop(1, 'rgba(' + DISCO[i] + ',0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 26; i++) {                     // Lichtpunkte der Spiegelkugel wandern über alles
      const a = t * 0.6 + i * 0.83, x = (W / 2 + Math.cos(a) * (180 + (i * 37) % 420) + W) % W, y = 120 + ((i * 53) % 430) + Math.sin(t + i) * 12;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + 0.3 * Math.sin(t * 4 + i)).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(x, y, 2.2 + (i % 3), 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';      // die Kugel selbst hängt oben in der Mitte
    const bx = W / 2, by = AA.G.top + 34, br = 24;
    ctx.strokeStyle = 'rgba(40,40,60,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, by - br); ctx.stroke();
    const g = ctx.createRadialGradient(bx - 8, by - 8, 2, bx, by, br); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#c8ccd8'); g.addColorStop(1, '#6a6e86');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.clip();
    ctx.strokeStyle = 'rgba(60,64,90,0.55)'; ctx.lineWidth = 1;
    for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(bx - br, by + k * 7); ctx.lineTo(bx + br, by + k * 7); ctx.stroke(); }
    const sp = (t * 1.2) % 7;
    for (let k = -4; k <= 4; k++) { const x = bx + (k * 7 + sp) - 3.5; ctx.beginPath(); ctx.moveTo(x, by - br); ctx.lineTo(x, by + br); ctx.stroke(); }
    ctx.restore();
    for (let k = 0; k < 3; k++) { const a = t * 2 + k * 2.1; ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + 0.5 * Math.sin(a * 2)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(bx + Math.cos(a) * br * 0.6, by + Math.sin(a * 1.3) * br * 0.5, 2, 0, TAU); ctx.fill(); }
  }

  /* ================= Lebende Kulissen ================= */
  const live = { kind: null, items: null };
  function fishPath(ctx, x, y, s, dir) {               // kleiner Fisch-Umriss (Silhouette)
    ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(4, -5, -5, -1.5); ctx.lineTo(-11, -5); ctx.lineTo(-9, 0); ctx.lineTo(-11, 5); ctx.lineTo(-5, 1.5); ctx.quadraticCurveTo(4, 5, 10, 0); ctx.fill();
    ctx.restore();
  }
  function whale(ctx, x, y, s, dir, t) {               // großer Wal (Buckelwal-Umriss)
    ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s); ctx.rotate(Math.sin(t * 0.25) * 0.03);
    const k = Math.sin(t * 0.6) * 6;
    ctx.beginPath();
    ctx.moveTo(150, 0);
    ctx.bezierCurveTo(140, -28, 60, -42, -20, -34);
    ctx.bezierCurveTo(-90, -26, -150, -12, -190, -4 + k * 0.4);
    ctx.lineTo(-232, -26 + k); ctx.quadraticCurveTo(-226, -2 + k, -214, 0 + k * 0.6); ctx.quadraticCurveTo(-226, 4 + k, -234, 26 + k);
    ctx.lineTo(-190, 6 + k * 0.4);
    ctx.bezierCurveTo(-120, 22, -20, 34, 40, 30);
    ctx.bezierCurveTo(100, 26, 150, 22, 150, 0);
    ctx.fill();
    ctx.beginPath(); ctx.moveTo(40, 22); ctx.quadraticCurveTo(10, 70 + k, -40, 88 + k); ctx.quadraticCurveTo(-10, 60, 10, 26); ctx.fill();      // Brustflosse
    ctx.restore();
  }
  function jelly(ctx, x, y, s, ph, col) {
    const p = Math.sin(ph) * 0.12;
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (1 + p), s * (1 - p));
    const g = ctx.createRadialGradient(0, -2, 1, 0, 0, 22); g.addColorStop(0, 'rgba(' + col + ',0.55)'); g.addColorStop(1, 'rgba(' + col + ',0.05)');
    ctx.fillStyle = 'rgba(' + col + ',0.13)'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill();
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-16, 4); ctx.bezierCurveTo(-16, -18, 16, -18, 16, 4); ctx.quadraticCurveTo(0, 0, -16, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(' + col + ',0.35)'; ctx.lineWidth = 1.6;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 6, 4); ctx.quadraticCurveTo(i * 6 + Math.sin(ph + i) * 5, 20, i * 6 + Math.sin(ph * 1.3 + i) * 7, 36); ctx.stroke(); }
    ctx.restore();
  }
  function seal(ctx, x, y, s, dir, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
    const k = Math.sin(t * 2.2) * 4;
    ctx.beginPath(); ctx.moveTo(40, -2); ctx.bezierCurveTo(36, -16, 8, -16, -10, -11); ctx.bezierCurveTo(-26, -7, -36, -3, -44, k * 0.5);
    ctx.lineTo(-56, -10 + k); ctx.lineTo(-52, 0 + k); ctx.lineTo(-58, 10 + k); ctx.lineTo(-44, 4 + k * 0.5);
    ctx.bezierCurveTo(-30, 12, 0, 14, 20, 10); ctx.bezierCurveTo(32, 8, 42, 6, 40, -2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10, 8); ctx.quadraticCurveTo(4, 22 + k, -6, 24 + k); ctx.quadraticCurveTo(0, 14, 2, 9); ctx.fill();
    ctx.restore();
  }
  function setupLive(kind) {
    live.kind = kind; live.items = [];
    if (kind === 'whale') live.items.push({ x: rnd(W * 0.15, W * 0.55), y: 250, s: 0.9, dir: 1, v: 18, wait: 0 });
    else if (kind === 'shoal') { for (let i = 0; i < 46; i++) live.items.push({ ox: rnd(-90, 90), oy: rnd(-34, 34), s: rnd(0.55, 1), ph: rnd(0, TAU) }); live.cx = rnd(W * 0.2, W * 0.6); live.dir = 1; }
    else if (kind === 'jelly') { for (let i = 0; i < 7; i++) live.items.push({ x: rnd(80, W - 80), y: rnd(150, 470), s: rnd(0.5, 1.05), ph: rnd(0, TAU), v: rnd(5, 11), col: Math.random() < 0.5 ? '255,160,230' : '180,170,255' }); }
    else if (kind === 'city') { for (let i = 0; i < 34; i++) { const left = i % 2 === 0; live.items.push({ x: left ? rnd(40, W * 0.33) : rnd(W * 0.67, W - 40), y: rnd(250, 470), r: rnd(1.5, 3.4), ph: rnd(0, TAU), sp: rnd(0.6, 2.2) }); } live.orbs = []; }
    else if (kind === 'polar') { live.items.push({ x: W * 0.7, y: 220, s: 1.2, dir: -1, v: 40, wait: 0, kind: 'seal' }); live.flakes = []; for (let i = 0; i < 40; i++) live.flakes.push({ x: rnd(0, W), y: rnd(60, 480), r: rnd(0.8, 2.2), v: rnd(4, 12), ph: rnd(0, TAU) }); }
  }
  let liveT = 0;
  AA.liveBg = function (ctx, kind, t, tank) {
    if (live.kind !== kind || !live.items) setupLive(kind);
    const dt = Math.min(0.1, Math.max(0, t - (liveT || t))); liveT = t;
    const night = !!(AA.state.settings && AA.state.settings.night);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0);                            // nur über dem Kies (auch über Hügeln) – die Silhouetten sind weit weg
    for (let x = W; x >= 0; x -= 32) ctx.lineTo(x, AA.G.fTop + 8 - AA.lift(x));
    ctx.closePath(); ctx.clip();
    if (kind === 'whale') {
      const w = live.items[0];
      if (w.wait > 0) w.wait -= dt;
      else {
        w.x += w.v * w.dir * dt;
        if ((w.dir > 0 && w.x > W + 320) || (w.dir < 0 && w.x < -320)) { w.dir = -w.dir; w.wait = rnd(12, 26); w.y = rnd(170, 330); w.s = rnd(0.7, 1.05); }
      }
      ctx.fillStyle = 'rgba(14,40,80,0.2)';
      whale(ctx, w.x, w.y + Math.sin(t * 0.3) * 10, w.s, w.dir, t);
    } else if (kind === 'shoal') {
      live.cx += 26 * live.dir * dt;
      if ((live.dir > 0 && live.cx > W + 180) || (live.dir < 0 && live.cx < -180)) { live.dir = -live.dir; live.cy = rnd(200, 380); }
      const cy = (live.cy || 300) + Math.sin(t * 0.35) * 40;
      ctx.fillStyle = 'rgba(20,50,90,0.22)';
      live.items.forEach(function (f, i) {
        const wob = Math.sin(t * 1.3 + f.ph) * 6, x = live.cx + f.ox * (1 + 0.15 * Math.sin(t * 0.5 + i)) + Math.sin(t * 0.8 + f.ph) * 5, y = cy + f.oy + wob + Math.sin((x + t * 40) * 0.01) * 14;
        fishPath(ctx, x, y, f.s * 1.25, live.dir);
      });
    } else if (kind === 'jelly') {
      live.items.forEach(function (j) {
        j.ph += dt * 2.1; j.y -= j.v * dt * (0.6 + 0.4 * Math.max(0, Math.sin(j.ph)));
        if (j.y < 90) { j.y = 480; j.x = rnd(80, W - 80); }
        jelly(ctx, j.x + Math.sin(t * 0.4 + j.ph) * 10, j.y, j.s, j.ph, j.col);
      });
    } else if (kind === 'city') {
      live.items.forEach(function (l) {
        const a = 0.35 + 0.35 * Math.sin(t * l.sp + l.ph) + (Math.sin(t * 7 + l.ph * 3) > 0.97 ? 0.3 : 0);
        const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 5);
        g.addColorStop(0, 'rgba(255,220,130,' + Math.min(0.9, a).toFixed(2) + ')'); g.addColorStop(1, 'rgba(255,200,100,0)');
        ctx.fillStyle = g; ctx.fillRect(l.x - l.r * 5, l.y - l.r * 5, l.r * 10, l.r * 10);
      });
      if (Math.random() < dt * 0.25 && live.orbs.length < 5) live.orbs.push({ x: rnd(W * 0.08, W * 0.92), y: 480, v: rnd(10, 18), ph: rnd(0, TAU) });
      for (let i = live.orbs.length - 1; i >= 0; i--) {
        const o = live.orbs[i]; o.y -= o.v * dt;
        if (o.y < 80) { live.orbs.splice(i, 1); continue; }
        const x = o.x + Math.sin(t * 0.7 + o.ph) * 18, a = Math.min(1, (480 - o.y) / 60) * Math.min(1, (o.y - 80) / 80);
        const g = ctx.createRadialGradient(x, o.y, 0, x, o.y, 16); g.addColorStop(0, 'rgba(255,236,170,' + (0.75 * a).toFixed(2) + ')'); g.addColorStop(1, 'rgba(255,210,120,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 16, o.y - 16, 32, 32);
      }
    } else if (kind === 'polar') {
      const a = live.items[0];
      if (a.wait > 0) a.wait -= dt;
      else {
        a.x += a.v * a.dir * dt;
        if ((a.dir > 0 && a.x > W + 120) || (a.dir < 0 && a.x < -120)) { a.dir = -a.dir; a.wait = rnd(8, 18); a.y = rnd(150, 330); a.kind = Math.random() < 0.5 ? 'seal' : 'pengs'; }
      }
      ctx.fillStyle = 'rgba(20,50,80,0.22)';
      if (a.kind === 'seal') seal(ctx, a.x, a.y + Math.sin(t * 0.8) * 8, a.s, a.dir, t);
      else for (let i = 0; i < 3; i++) fishPath(ctx, a.x - a.dir * i * 34, a.y + i * 14 + Math.sin(t * 2 + i) * 4, 2.2, a.dir);     // drei Pinguine
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      live.flakes.forEach(function (f) { f.y += f.v * dt; if (f.y > 480) { f.y = 60; f.x = rnd(0, W); } ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t + f.ph); ctx.beginPath(); ctx.arc(f.x + Math.sin(t * 0.6 + f.ph) * 8, f.y, f.r, 0, TAU); ctx.fill(); });
      ctx.globalAlpha = 1;
    }
    if (night) { ctx.fillStyle = 'rgba(8,22,70,0.0)'; }
    ctx.restore();
  };
})(window.AA);
