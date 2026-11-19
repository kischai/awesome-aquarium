'use strict';
/* Awesome Aquarium – Runde 19: Becken-Effekte der Themen-Sets (Stufe „Gezüchtet“), Funkeln der Gold-Kulissen, Set-Zeichen auf den Pokalen und der
   Gänsemarsch der Krabbler (alle sechs Krabbler-Alben „Ausgestellt“). Regeln und Daten: js/themes.js, js/data.js (AA.THEMES, AA.THEME_FX).
   t.fx = gewählter Effekt des Beckens (Shop → Aquarien → „Becken-Effekt“). js/tankview.js ruft drei Lagen auf:
   back  = hinter Deko und Fischen, über Kies und Kulisse (Sonnenkringel, Wellenlicht, Schatten in der Ferne, Sandwölkchen)
   front = vor allem, unter Nacht und Glas (Blasen, Regen, Blätter, Blüten, Gischt, Schnee, Tinte)
   glow  = nach der Nacht, leuchtet also auch im Dunkeln (Leuchtplankton, Leuchtspuren, Funken).
   Alles bewusst sparsam (höchstens ~90 Teilchen, Glanz aus vorgemalten Bildchen), damit es auch auf dem iPhone flüssig bleibt. */
(function (AA) {
  const V = AA.view, G = AA.G, W = AA.W, H = AA.H, TAU = Math.PI * 2, rnd = AA.rand;
  const FX = AA.themeFx = {};
  const pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /* ---------- vorgemalte Bildchen ---------- */
  const glowC = {};
  function glow(col) {                                 // weicher Lichtpunkt (32 px)
    if (glowC[col]) return glowC[col];
    const c = mk(32, 32), g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, col); gr.addColorStop(0.35, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    return (glowC[col] = c);
  }
  let spotC = null, inkC = null, causC = null, causP = null;
  function spot() {                                    // Sonnenkringel: heller Fleck mit hellerem Rand
    if (spotC) return spotC;
    const c = mk(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,250,215,0.55)'); gr.addColorStop(0.62, 'rgba(255,250,215,0.75)'); gr.addColorStop(0.8, 'rgba(255,250,215,0.35)'); gr.addColorStop(1, 'rgba(255,250,215,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return (spotC = c);
  }
  function ink() {
    if (inkC) return inkC;
    const c = mk(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(26,18,46,0.95)'); gr.addColorStop(0.55, 'rgba(26,18,46,0.6)'); gr.addColorStop(1, 'rgba(26,18,46,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (inkC = c);
  }
  function caustic(ctx) {                              // Wellenlicht: kachelbares Netz aus geschwungenen Linien
    if (causP) return causP;
    if (!causC) {
      const N = 256, c = mk(N, N), g = c.getContext('2d');
      g.strokeStyle = '#ffffff'; g.lineCap = 'round';
      for (let pass = 0; pass < 2; pass++) {
        for (let k = 0; k < 9; k++) {
          const base = (k + 0.5) * N / 9;
          g.lineWidth = 1.6 + (k % 3) * 0.8; g.globalAlpha = 0.55 + (k % 2) * 0.35;
          for (let off = -N; off <= N; off += N) {     // über den Rand weiterzeichnen: nahtlos kachelbar
            g.beginPath();
            for (let u = 0; u <= N; u += 6) {
              const v = base + off + Math.sin(u / N * TAU * 2 + k * 1.7) * 11 + Math.sin(u / N * TAU * 3 + k) * 6;
              if (pass) { if (u) g.lineTo(v, u); else g.moveTo(v, u); } else { if (u) g.lineTo(u, v); else g.moveTo(u, v); }
            }
            g.stroke();
          }
        }
      }
      causC = c;
    }
    causP = ctx.createPattern(causC, 'repeat');
    return causP;
  }
  /* Schatten in der Ferne: Umriss eines Bildes (Fisch oder Deko), klein gemalt und groß gezeichnet – wirkt dadurch weich */
  const silC = {};
  function silhouette(key, w, col) {
    const k = key + '|' + w + '|' + col;
    if (silC[k]) return silC[k];
    const im = AA.assets.get(key);
    if (!im) { if (AA.assets.want) AA.assets.want(key); return null; }
    const sw = Math.max(24, Math.round(w * 0.4)), sh = Math.max(12, Math.round(sw * im.height / im.width)), c = mk(sw, sh), g = c.getContext('2d');
    g.drawImage(im, 0, 0, sw, sh);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, sw, sh);
    return (silC[k] = c);
  }

  /* ---------- Zustand ---------- */
  let cur = null, tid = null, P = [], st = {};
  function reset(id, tank) { cur = id; tid = tank ? tank.id : null; P = []; st = { passAt: 1.2, pass: null, spawn: 0, ev: rnd(2, 5), init: false }; }
  function floorAt(z, x) { return AA.floorY(z, x); }
  function fishList() { return V.fish || []; }
  function bySp(ids) { const L = fishList().filter(function (f) { return f.d && ids.indexOf(f.d.sp) >= 0 && f.y > G.top; }); return L.length ? pick(L) : null; }
  function anyFish() { const L = fishList().filter(function (f) { return f.y > G.top + 10; }); return L.length ? pick(L) : null; }
  function cap(n) { if (P.length > n) P.splice(0, P.length - n); }

  /* ---------- Schatten, die vorbeiziehen ---------- */
  const PASS = {
    manta: { key: 'fish/manta_m', w: 300, sp: [36, 50], y: [150, 330], a: 0.17, every: [28, 50] },
    shark: { key: 'fish/greatwhite_m', w: 340, sp: [52, 70], y: [140, 320], a: 0.14, every: [26, 46] },
    whale: { key: 'fish/whaleshark_m', w: 580, sp: [20, 28], y: [150, 290], a: 0.11, every: [45, 75] },
    ammonite: { key: 'deco/ammonite', w: 120, sp: [14, 22], y: [190, 400], a: 0.2, every: [22, 40], spin: true }
  };
  function passStep(dt, D) {
    if (!st.pass) {
      st.passAt -= dt;
      if (st.passAt <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; st.pass = { dir: dir, x: dir > 0 ? -D.w * 0.45 : W + D.w * 0.45, y: rnd(D.y[0], D.y[1]), v: rnd(D.sp[0], D.sp[1]), ph: Math.random() * TAU }; }
      return;
    }
    const p = st.pass; p.x += p.dir * p.v * dt; p.ph += dt;
    if (p.dir > 0 ? p.x > W + D.w * 0.6 : p.x < -D.w * 0.6) { st.pass = null; st.passAt = rnd(D.every[0], D.every[1]); }
  }
  function passDraw(ctx, D, tank) {
    const p = st.pass; if (!p) return;
    const c = silhouette(D.key, D.w, tank.deep ? '#cfe9ff' : '#04141f'); if (!c) return;
    const dh = D.w * c.height / c.width;
    ctx.save(); ctx.globalAlpha = tank.deep ? D.a * 0.5 : D.a;
    ctx.translate(p.x, p.y + Math.sin(p.ph * 0.6) * 10);
    if (p.dir < 0) ctx.scale(-1, 1);
    if (D.spin) ctx.rotate(Math.sin(p.ph * 0.4) * 0.25);
    ctx.drawImage(c, -D.w / 2, -dh / 2, D.w, dh);
    ctx.restore();
  }

  /* ---------- Blätter, Blüten ---------- */
  function leafPath(ctx, s) {
    ctx.beginPath(); ctx.moveTo(-s, 0);
    ctx.quadraticCurveTo(-s * 0.1, -s * 0.62, s, 0); ctx.quadraticCurveTo(-s * 0.1, s * 0.62, -s, 0); ctx.closePath();
  }
  function drawLeaf(ctx, p, sy) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, sy);
    ctx.fillStyle = p.col; leafPath(ctx, p.s); ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,10,0.35)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-p.s * 0.9, 0); ctx.lineTo(p.s * 0.85, 0); ctx.stroke();
    ctx.restore();
  }
  function drawPetal(ctx, p) {
    const s = p.s;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(0.35 + 0.65 * Math.abs(Math.cos(p.ph)), 1);
    ctx.fillStyle = p.col; ctx.beginPath(); ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.95, -s * 0.7, s * 0.7, s * 0.75, 0, s); ctx.bezierCurveTo(-s * 0.7, s * 0.75, -s * 0.95, -s * 0.7, 0, -s); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-s * 0.18, -s * 0.25, s * 0.18, s * 0.38, 0.3, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* sinkt mit Schaukeln zum Boden, bleibt kurz liegen und verblasst */
  function sinkStep(p, dt, t) {
    if (p.land === undefined) {
      p.y += p.vy * dt; p.x += Math.sin(t * p.fq + p.ph) * p.sw * dt; p.rot += p.vr * dt; p.ph += dt * 2;
      const fy = floorAt(p.z, p.x) - 2;
      if (p.y >= fy) { p.y = fy; p.land = 0; }
      return true;
    }
    p.land += dt; return p.land < 4;
  }
  function landAlpha(p) { return p.land === undefined ? 1 : Math.max(0, 1 - p.land / 4); }

  /* ---------- die 20 Effekte ---------- */
  const E = {
    sunspots: {
      step: function (dt) {
        if (!st.init) { st.init = true; for (let i = 0; i < 8; i++) P.push({ x: rnd(40, W - 40), z: rnd(0.04, 0.96), r: rnd(46, 92), vx: rnd(-14, 14), ph: Math.random() * TAU, f: rnd(0.5, 1) }); }
        P.forEach(function (p) { p.x += p.vx * dt; p.ph += dt * p.f; if (p.x < -60) p.x = W + 50; if (p.x > W + 60) p.x = -50; });
      },
      back: function (ctx, tank) {
        if (tank.deep) return;
        const im = spot(); ctx.save(); ctx.globalCompositeOperation = 'lighter';
        P.forEach(function (p) { const y = floorAt(p.z, p.x); ctx.globalAlpha = 0.34 + 0.16 * Math.sin(p.ph); ctx.drawImage(im, p.x - p.r, y - p.r * 0.32, p.r * 2, p.r * 0.64); });
        ctx.restore();
      }
    },
    colorbubbles: {
      step: function (dt, tank, t) {
        st.spawn -= dt;
        if (st.spawn <= 0 && P.length < 40) {
          st.spawn = 0.22; const x = rnd(80, W - 80), z = rnd(0.1, 0.9);
          P.push({ x: x, y: floorAt(z, x) - 8, r: rnd(3.5, 8.5), vy: rnd(36, 60), ph: Math.random() * TAU, col: pick(['#ff7eb6', '#7ee0ff', '#ffe066', '#9dff8a', '#c79bff', '#ffae6b']) });
        }
        for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.y -= p.vy * dt; p.x += Math.sin(t * 2.2 + p.ph) * 14 * dt; if (p.y < G.top + 10) P.splice(i, 1); }
      },
      front: function (ctx) {
        ctx.save();
        P.forEach(function (p) {
          ctx.globalAlpha = 0.5; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
          ctx.globalAlpha = 0.75; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.28, 0, TAU); ctx.fill();
        });
        ctx.restore();
      }
    },
    manta: { pass: PASS.manta },
    rain: {
      step: function (dt) {
        st.spawn -= dt;
        while (st.spawn <= 0) { st.spawn += 0.035; if (P.length < 70) P.push({ k: 'drop', x: rnd(20, W - 20), y: G.top - rnd(40, 90), vy: rnd(620, 820), len: rnd(10, 18) }); }
        for (let i = P.length - 1; i >= 0; i--) {
          const p = P[i];
          if (p.k === 'drop') { p.y += p.vy * dt; if (p.y >= G.top + 3) { p.k = 'rip'; p.y = G.top + rnd(3, 9); p.life = 0; } }
          else { p.life += dt; if (p.life > 0.7) P.splice(i, 1); }
        }
      },
      front: function (ctx) {
        ctx.save(); ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(225,238,255,0.55)'; ctx.lineWidth = 1.4; ctx.beginPath();
        P.forEach(function (p) { if (p.k === 'drop') { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 2, p.y - p.len); } });
        ctx.stroke();
        P.forEach(function (p) {
          if (p.k !== 'rip') return;
          const k = p.life / 0.7, r = 4 + k * 22;
          ctx.globalAlpha = 0.6 * (1 - k); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.3;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.28, 0, 0, TAU); ctx.stroke();
        });
        ctx.restore();
      }
    },
    leaves: {
      step: function (dt, tank, t) {
        if (!st.init) { st.init = true; for (let i = 0; i < 5; i++) P.push(floatLeaf(rnd(80, W - 80))); }
        st.ev -= dt;
        if (st.ev <= 0) {                              // ab und zu löst sich ein Blatt und sinkt
          st.ev = rnd(7, 13);
          const fl = P.filter(function (p) { return p.float; });
          if (fl.length) { const p = pick(fl); p.float = false; p.vy = rnd(10, 16); p.vr = rnd(-0.8, 0.8); p.z = rnd(0.1, 0.9); p.fq = 0.8; p.sw = 16; }
          if (fl.length < 6) P.push(floatLeaf(Math.random() < 0.5 ? -30 : W + 30));
        }
        for (let i = P.length - 1; i >= 0; i--) {
          const p = P[i];
          if (p.float) {
            p.x += p.vx * dt; p.y = G.top + 3 + Math.sin(t * 1.3 + p.ph) * 2.5; p.rot = Math.sin(t * 0.7 + p.ph) * 0.08;
            if (p.x < -60 || p.x > W + 60) P.splice(i, 1);
          } else if (!sinkStep(p, dt, t)) P.splice(i, 1);
        }
      },
      front: function (ctx) {
        ctx.save();
        P.forEach(function (p) { ctx.globalAlpha = landAlpha(p); drawLeaf(ctx, p, p.float ? 0.45 : 0.8); });
        ctx.restore();
      }
    },
    blossoms: { petal: { every: 0.42, max: 40, s: [7, 11.5], vy: [14, 26], cols: ['#ffc4d8', '#ffb0cb', '#ffd9e6', '#ff9cbf'] } },
    autumn: { petal: { every: 0.6, max: 30, s: [12, 18], vy: [16, 28], leaf: true, cols: ['#e8701a', '#c9381c', '#f2b632', '#b5651d', '#d9481c'] } },
    spray: {
      step: function (dt) {
        if (!st.init) { st.init = true; st.side = Math.random() < 0.5 ? -1 : 1; }
        const x0 = st.side < 0 ? 190 : W - 190;
        st.spawn -= dt;
        while (st.spawn <= 0) { st.spawn += 0.04; if (P.length < 70) P.push({ x: x0 + rnd(-70, 70), y: G.top + rnd(2, 10), vx: rnd(-50, 50), vy: rnd(140, 280), r: rnd(1.2, 3.6), life: 0, max: rnd(1.3, 2.4) }); }
        for (let i = P.length - 1; i >= 0; i--) {
          const p = P[i]; p.life += dt; p.vy -= 300 * dt; p.vx *= 1 - Math.min(1, dt * 1.6); p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.life > p.max || p.y < G.top) P.splice(i, 1);
        }
      },
      front: function (ctx, tank, t) {
        const x0 = st.side < 0 ? 190 : W - 190;
        ctx.save(); ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 9; i++) {                  // Schaumkrone an der Oberfläche
          const x = x0 + (i - 4) * 19 + Math.sin(t * 3 + i) * 5;
          ctx.globalAlpha = 0.28 + 0.12 * Math.sin(t * 4 + i * 1.7);
          ctx.beginPath(); ctx.ellipse(x, G.top + 5 + Math.sin(t * 5 + i) * 2, 16 + (i % 3) * 5, 6, 0, 0, TAU); ctx.fill();
        }
        P.forEach(function (p) { ctx.globalAlpha = 0.75 * (1 - p.life / p.max); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); });
        ctx.restore();
      }
    },
    wavelight: {
      back: function (ctx, tank, t) {
        if (tank.deep) return;
        const pat = caustic(ctx);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = pat;
        ctx.beginPath(); ctx.rect(0, G.top, W, H - G.top); ctx.clip();
        ctx.globalAlpha = 0.075; ctx.translate((t * 17) % 256, (t * 6) % 256); ctx.fillRect(-256, G.top - 256, W + 512, H - G.top + 512);
        ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = pat;
        ctx.beginPath(); ctx.rect(0, G.top, W, H - G.top); ctx.clip();
        ctx.globalAlpha = 0.06; ctx.translate(-((t * 13) % 384), (t * 9) % 384); ctx.scale(1.5, 1.5); ctx.fillRect(-256, -256, W + 256, H + 256);
        ctx.restore();
      }
    },
    plankton: {
      step: function (dt) {
        if (!st.init) { st.init = true; for (let i = 0; i < 42; i++) P.push({ x: rnd(20, W - 20), y: rnd(G.top + 20, G.fTop + 90), vx: rnd(-8, 8), vy: rnd(-5, 5), ph: Math.random() * TAU, f: rnd(1, 2.6), s: rnd(1.4, 3), col: pick(['#7ff9ff', '#9effc5', '#b4a8ff']) }); }
        P.forEach(function (p) {
          p.vx = AA.clamp(p.vx + rnd(-12, 12) * dt, -10, 10); p.vy = AA.clamp(p.vy + rnd(-10, 10) * dt, -7, 7);
          p.x += p.vx * dt; p.y += p.vy * dt; p.ph += dt * p.f;
          if (p.x < 10) p.x = W - 12; if (p.x > W - 10) p.x = 12;
          p.y = AA.clamp(p.y, G.top + 16, G.fTop + 100);
        });
      },
      glow: function (ctx) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        P.forEach(function (p) { ctx.globalAlpha = Math.max(0, 0.35 + 0.4 * Math.sin(p.ph)); const r = p.s * 4; ctx.drawImage(glow(p.col), p.x - r, p.y - r, r * 2, r * 2); });
        ctx.restore();
      }
    },
    marinesnow: { flakes: { n: 50, vy: [8, 16], s: [0.9, 2.2], sw: 6, col: 'rgba(240,248,255,0.7)' } },
    hearts: {
      step: function (dt) {
        st.ev -= dt;
        if (st.ev <= 0) { st.ev = rnd(5, 9); const f = anyFish(); if (f && V.puff) V.puff('heart', f.x, f.y - f.size() * 0.3, 2); }
      }
    },
    sandpuffs: {
      step: function (dt, tank) {
        st.ev -= dt;
        if (st.ev > 0) return;
        st.ev = rnd(1.4, 3.2);
        const bottom = fishList().filter(function (f) { return f.def && f.def.hab === 'bottom' && AA.floorY(f.z, f.x) - f.y < 70; });
        const crawl = tank.deco.filter(function (o) { const d = AA.DECO_BY[o.type]; return d && d.crawl && !(V.onGlass && V.onGlass(o)); });
        let x, z;
        if (bottom.length && Math.random() < 0.7) { const f = pick(bottom); x = f.x; z = f.z; }
        else if (crawl.length && Math.random() < 0.6) { const o = pick(crawl); x = o.x; z = o.z; }
        else { x = rnd(120, W - 120); z = rnd(0.1, 0.9); }
        if (V.puff) V.puff('dust', x, floorAt(z, x) - 2, 6);
      }
    },
    sparks: {
      step: function (dt) {
        st.ev -= dt;
        if (st.ev <= 0) {
          st.ev = rnd(1.1, 2.4);
          const f = bySp(['eleel']) || bySp(AA.THEME_BY.spiky ? AA.themeItems(AA.THEME_BY.spiky) : []) || anyFish();
          if (f) {
            const s = f.size(), x = f.x + rnd(-0.35, 0.35) * s, y = f.y + rnd(-0.25, 0.2) * s, pts = [];
            let a = Math.random() * TAU;
            for (let i = 0; i < 6; i++) { a += rnd(-0.9, 0.9); pts.push([x + Math.cos(a) * (8 + i * 7), y + Math.sin(a) * (8 + i * 7)]); }
            P.push({ x: x, y: y, pts: pts, life: 0, max: 0.24 });
            if (V.twinkle) { V.twinkle(x, y, '#c9f7ff', 9); V.twinkle(pts[5][0], pts[5][1], '#fff36a', 7); }
          }
        }
        for (let i = P.length - 1; i >= 0; i--) { P[i].life += dt; if (P[i].life > P[i].max) P.splice(i, 1); }
      },
      glow: function (ctx) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        P.forEach(function (p) {
          const a = 1 - p.life / p.max;
          [[6, 'rgba(120,220,255,' + (0.3 * a).toFixed(3) + ')'], [2, 'rgba(235,252,255,' + a.toFixed(3) + ')']].forEach(function (L) {
            ctx.strokeStyle = L[1]; ctx.lineWidth = L[0]; ctx.beginPath(); ctx.moveTo(p.x, p.y);
            p.pts.forEach(function (q) { ctx.lineTo(q[0], q[1]); }); ctx.stroke();
          });
        });
        ctx.restore();
      }
    },
    ammonite: { pass: PASS.ammonite },
    shark: { pass: PASS.shark },
    ink: {
      step: function (dt) {
        st.ev -= dt;
        if (st.ev <= 0) {
          st.ev = rnd(7, 13);
          const f = bySp(AA.THEME_BY.squids ? AA.themeItems(AA.THEME_BY.squids) : []) || anyFish();
          if (f) {
            const dir = f.face < 0 ? -1 : 1, x = f.x - dir * f.size() * 0.3;
            for (let i = 0; i < 9; i++) P.push({ x: x + rnd(-6, 6), y: f.y + rnd(-6, 6), vx: rnd(-16, 16) - dir * 22, vy: rnd(-9, 9), r0: rnd(6, 12), life: 0, max: rnd(2.2, 3.4) });
            cap(60);
          }
        }
        for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - Math.min(1, dt * 0.8); if (p.life > p.max) P.splice(i, 1); }
      },
      front: function (ctx) {
        const im = ink(); ctx.save();
        P.forEach(function (p) { const k = p.life / p.max, r = p.r0 + k * 34; ctx.globalAlpha = 0.42 * (1 - k); ctx.drawImage(im, p.x - r, p.y - r, r * 2, r * 2); });
        ctx.restore();
      }
    },
    trails: {
      step: function (dt) {
        st.spawn -= dt;
        if (st.spawn <= 0) {
          st.spawn = 0.06;
          const L = fishList();
          for (let i = 0; i < L.length && i < 12; i++) {
            const f = L[i]; if (f.y < G.top) continue;
            P.push({ x: f.x - (f.face < 0 ? -1 : 1) * f.size() * 0.32, y: f.y, life: 0, max: 0.9, col: f.def && f.def.glow ? '#8ff6ff' : '#ffe9a8' });
          }
          cap(220);
        }
        for (let i = P.length - 1; i >= 0; i--) { P[i].life += dt; if (P[i].life > P[i].max) P.splice(i, 1); }
      },
      glow: function (ctx) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        P.forEach(function (p) { const k = p.life / p.max, r = 2 + 7 * (1 - k); ctx.globalAlpha = 0.45 * (1 - k); ctx.drawImage(glow(p.col), p.x - r, p.y - r, r * 2, r * 2); });
        ctx.restore();
      }
    },
    champagne: {                                       // Runde 20d: Paris – Champagner-Perlen: feine goldene Perlenketten steigen vom Grund auf
      step: function (dt, tank, t) {
        if (!st.init) { st.init = true; st.src = []; for (let i = 0; i < 6; i++) st.src.push({ x: rnd(70, W - 70), z: rnd(0.2, 0.9), next: rnd(0, 0.2), life: rnd(4, 9) }); }
        st.src.forEach(function (q) {                  // Quellen: wandern ab und zu, jede spuckt in kurzen Abständen eine Perle
          q.life -= dt; if (q.life <= 0) { q.x = rnd(70, W - 70); q.z = rnd(0.2, 0.9); q.life = rnd(4, 9); }
          q.next -= dt;
          if (q.next <= 0 && P.length < 160) { q.next = rnd(0.06, 0.14); P.push({ x: q.x + rnd(-2, 2), y: floorAt(q.z, q.x) - 6, r: rnd(1.4, 3.2), vy: rnd(70, 110), ph: Math.random() * TAU }); }
        });
        for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.y -= p.vy * dt; p.vy += 12 * dt; p.x += Math.sin(t * 6 + p.ph) * 6 * dt; if (p.y < G.top + 6) P.splice(i, 1); }
      },
      front: function (ctx) {
        ctx.save();
        P.forEach(function (p) {
          ctx.globalAlpha = 0.75; ctx.fillStyle = '#ffd86a'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
          ctx.globalAlpha = 0.9; ctx.fillStyle = '#fff8d8'; ctx.beginPath(); ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.38, 0, TAU); ctx.fill();
        });
        ctx.restore();
      },
      glow: function (ctx) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25;
        P.forEach(function (p) { if (p.r > 2.4) ctx.drawImage(glow('#ffd86a'), p.x - p.r * 3, p.y - p.r * 3, p.r * 6, p.r * 6); });
        ctx.restore();
      }
    },
    jellyglow: {                                       // Runde 20b: Quallen-Ballett – kleine Leucht-Quallen pulsieren langsam nach oben
      step: function (dt) {
        if (!st.init) { st.init = true; for (let i = 0; i < 9; i++) P.push({ x: rnd(40, W - 40), y: rnd(G.top + 60, G.fTop + 40), vx: rnd(-4, 4), vy: rnd(-12, -6), ph: Math.random() * TAU, s: rnd(7, 13), col: pick(['#ffb4f0', '#c8b8ff', '#8ff6ff', '#ffd2a8']) }); }
        P.forEach(function (p) {
          p.ph += dt * 1.6;
          const push = Math.max(0, Math.sin(p.ph));      // Schub beim Zusammenziehen
          p.y += p.vy * (0.3 + 1.5 * push) * dt; p.x += (p.vx + Math.sin(p.ph * 0.37) * 4) * dt;
          if (p.y < G.top + 24) { p.y = G.fTop + 50; p.x = rnd(40, W - 40); }
          if (p.x < 10) p.x = W - 12; if (p.x > W - 10) p.x = 12;
        });
      },
      glow: function (ctx) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        P.forEach(function (p) {
          const q = Math.sin(p.ph), r = p.s * (1 - 0.12 * q), hh = p.s * (0.8 + 0.12 * q);
          ctx.globalAlpha = 0.4 + 0.15 * q; ctx.drawImage(glow(p.col), p.x - r * 2, p.y - r * 1.7, r * 4, r * 3.4);
          ctx.fillStyle = p.col; ctx.globalAlpha = 0.3 + 0.1 * q;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, r, hh, 0, Math.PI, TAU); ctx.fill();
          ctx.strokeStyle = p.col; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.3;
          for (let k = -1; k <= 1; k++) {
            ctx.beginPath(); ctx.moveTo(p.x + k * r * 0.5, p.y);
            ctx.quadraticCurveTo(p.x + k * r * 0.5 + Math.sin(p.ph * 1.3 + k) * 3, p.y + p.s * 1.1, p.x + k * r * 0.4 + Math.sin(p.ph + k) * 4, p.y + p.s * 2.2);
            ctx.stroke();
          }
        });
        ctx.restore();
      }
    },
    whale: { pass: PASS.whale },
    snow: { flakes: { n: 56, vy: [14, 26], s: [1.6, 3.4], sw: 14, col: 'rgba(255,255,255,0.9)' } }
  };
  /* gemeinsame Bauarten */
  function floatLeaf(x) {
    return { float: true, x: x, y: G.top + 3, s: rnd(16, 25), rot: 0, vr: 0, vx: (x < 0 ? 1 : (x > W ? -1 : (Math.random() < 0.5 ? -1 : 1))) * rnd(6, 13), ph: Math.random() * TAU, col: pick(['#5aa83c', '#4c9a33', '#6dbb4a', '#3d7f2a']) };
  }
  Object.keys(E).forEach(function (id) {
    const D = E[id];
    if (D.pass) { D.step = function (dt) { passStep(dt, D.pass); }; D.back = function (ctx, tank) { passDraw(ctx, D.pass, tank); }; }
    if (D.petal) {
      const Q = D.petal;
      const one = function (y) { return { x: rnd(40, W - 40), y: y, z: rnd(0.05, 0.95), s: rnd(Q.s[0], Q.s[1]), vy: rnd(Q.vy[0], Q.vy[1]), rot: Math.random() * TAU, vr: rnd(-1.4, 1.4), ph: Math.random() * TAU, fq: rnd(0.8, 1.4), sw: rnd(14, 26), col: pick(Q.cols) }; };
      D.step = function (dt, tank, t) {
        if (!st.init) { st.init = true; for (let i = 0; i < Q.max * 0.6; i++) P.push(one(rnd(G.top, G.fTop))); }      // gleich beim Einschalten schon unterwegs
        st.spawn -= dt;
        if (st.spawn <= 0) { st.spawn = Q.every; if (P.length < Q.max) P.push(one(G.top - 6)); }
        for (let i = P.length - 1; i >= 0; i--) if (!sinkStep(P[i], dt, t)) P.splice(i, 1);
      };
      D.front = function (ctx) {
        ctx.save();
        P.forEach(function (p) { ctx.globalAlpha = landAlpha(p); if (Q.leaf) drawLeaf(ctx, p, 0.62 + 0.38 * Math.abs(Math.cos(p.ph))); else drawPetal(ctx, p); });
        ctx.restore();
      };
    }
    if (D.flakes) {
      const Q = D.flakes;
      D.step = function (dt, tank, t) {
        if (!st.init) { st.init = true; for (let i = 0; i < Q.n; i++) P.push({ x: rnd(0, W), y: rnd(G.top, H), vy: rnd(Q.vy[0], Q.vy[1]), s: rnd(Q.s[0], Q.s[1]), ph: Math.random() * TAU }); }
        P.forEach(function (p) {
          p.y += p.vy * dt; p.x += Math.sin(t * 0.9 + p.ph) * Q.sw * dt;
          if (p.y > G.fy1 + 30) { p.y = G.top - 4; p.x = rnd(0, W); }
        });
      };
      D.front = function (ctx) {
        ctx.save(); ctx.fillStyle = Q.col; ctx.beginPath();
        P.forEach(function (p) { ctx.moveTo(p.x + p.s, p.y); ctx.arc(p.x, p.y, p.s, 0, TAU); });
        ctx.fill(); ctx.restore();
      };
    }
  });
  FX.ids = Object.keys(E);

  /* ---------- Schnittstelle für js/tankview.js ---------- */
  let goldT = 0, parT = 0;
  FX.update = function (dt, tank) {
    if (!tank) return;
    const id = tank.fx && E[tank.fx] ? tank.fx : null;
    if (id !== cur || tank.id !== tid) reset(id, tank);
    const wall = AA.WALL_BY[tank.wall];
    if (wall && wall.gold && !V.photoMode && V.twinkle) {      // Gold-Kulisse: hier und da blitzt es golden
      goldT -= dt;
      if (goldT <= 0) { goldT = rnd(0.3, 0.75); V.twinkle(rnd(30, W - 30), rnd(G.top + 24, G.fTop - 12), pick(['#ffe39a', '#fff6cc', '#ffd36b']), rnd(7, 12)); }
    }
    paradeTick(dt, tank);
    if (!cur || dt <= 0 || dt > 1) return;
    const D = E[cur];
    if (D.step) D.step(dt, tank, V.time);
  };
  FX.back = function (ctx, tank, t) { if (cur && E[cur].back && tank.id === tid) E[cur].back(ctx, tank, t); };
  FX.front = function (ctx, tank, t) { if (cur && E[cur].front && tank.id === tid) E[cur].front(ctx, tank, t); };
  FX.glow = function (ctx, tank, t) { if (cur && E[cur].glow && tank.id === tid) E[cur].glow(ctx, tank, t); };
  FX.count = function () { return P.length; };
  FX.current = function () { return cur; };
  /* Herzchen-Blasen: frisch geschlüpft in einem Becken mit diesem Effekt */
  AA.on('hatched', function (baby, e, t) {
    if (!t || !t.fx || t.fx !== 'hearts' || !AA.state || t !== AA.tank() || !V.puff || !e) return;
    V.puff('heart', e.x, AA.floorY(e.z || 0.5, e.x) - 30, 5);
  });

  /* ---------- Set-Zeichen auf den Pokalen der Themen-Sets (Medaillon auf dem Kelch) ---------- */
  V.trophyMark = function (ctx, o, def, b) {
    const T = AA.THEME_BY[def.theme]; if (!T) return;
    const r = b.w * 0.19, y = -b.h * 0.71;
    ctx.save();
    if (o.flip) ctx.scale(-1, 1);
    const gr = ctx.createRadialGradient(-r * 0.3, y - r * 0.3, r * 0.1, 0, y, r);
    gr.addColorStop(0, '#fff6c8'); gr.addColorStop(0.6, '#f3c541'); gr.addColorStop(1, '#b07a12');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, y, r, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.12); ctx.strokeStyle = '#8a5a08'; ctx.stroke();
    ctx.font = Math.round(r * 1.15) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(T.ico, 0, y + r * 0.06);
    ctx.restore();
  };

  /* ---------- Gänsemarsch: alle Krabbler laufen hintereinander eine Runde (einmal am Tag, oder per Knopf im Sammelbuch) ---------- */
  const PAR = { sp: 58, gap: 62, max: 16 };
  const ZPX = G.fy1 - G.fy0;
  let parade = null;
  function crawlers(tank) {
    return tank.deco.filter(function (o) { const d = AA.DECO_BY[o.type]; return d && d.crawl && !(V.onGlass && V.onGlass(o)); });
  }
  AA.startParade = function () {
    const tank = AA.tank(); if (!tank || parade) return false;
    const L = crawlers(tank).sort(function (a, b) { return (AA.DECO_BY[b.type].w || 0) - (AA.DECO_BY[a.type].w || 0); }).slice(0, PAR.max);
    if (L.length < 2) return false;
    const lim = AA.xLimits(), xa = lim[0] + 80, xb = lim[1] - 80, zF = 0.9, zB = 0.32;
    const lead = L[0];
    parade = { tank: tank.id, ids: {}, list: L, path: [[xa, zF], [xb, zF], [xb, zB], [xa, zB], [(xa + xb) / 2, (zF + zB) / 2]], pi: 0, trail: [{ x: lead.x, z: lead.z, d: 0 }], len: 0, t: 0, done: 0 };
    L.forEach(function (o, i) { parade.ids[o.id] = i; });
    if (V.floatText) V.floatText(W / 2, G.top + 70, '🐌 Gänsemarsch!', '#fff3a6');
    return true;
  };
  AA.paradeOn = function () { return !!parade; };
  function endParade() {
    if (!parade) return;
    const tank = AA.tank();
    if (tank && tank.id === parade.tank) parade.list.forEach(function (o) { const c = V.crawl && V.crawl[o.id]; if (c) { c.tx = o.x; c.tz = o.z; c.wait = rnd(1, 4); c.v = 0; } });
    const lead = parade.list[0];
    if (lead && V.floatText && tank && tank.id === parade.tank) V.floatText(lead.x, AA.floorY(lead.z, lead.x) - 60, '🎉', '#fff3a6');
    parade = null;
  }
  function trailAt(d) {                                // Punkt auf der Spur des Anführers bei Weglänge d
    const T = parade.trail;
    if (d <= 0) return T[0];
    let lo = 0, hi = T.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (T[m].d <= d) lo = m; else hi = m - 1; }
    return T[lo];
  }
  function moveTo(o, def, c, tx, tz, sp, dt) {
    const dx = tx - o.x, dz = (tz - o.z) * ZPX, dist = Math.hypot(dx, dz);
    if (dist < 2) { c.v = 0; return dist; }
    const step = Math.min(dist, sp * dt);
    o.x += dx / dist * step; o.z = AA.clamp(o.z + dz / dist * step / ZPX, 0.02, 1);
    c.v = dt > 0 ? step / dt : 0; c.ph += dt * 1.5;
    if (!def.sym && Math.abs(dx) > 1) o.flip = dx < 0;
    return dist;
  }
  V.paradeStep = function (o, def, c, dt) {
    if (!parade || parade.ids[o.id] === undefined) return false;
    const tank = AA.tank();
    if (!tank || tank.id !== parade.tank) return false;
    const i = parade.ids[o.id];
    c.food = null; c.climb = null; c.wave = null;
    if (i === 0) {
      if (parade.pi >= parade.path.length) { c.v = 0; return true; }
      const w = parade.path[parade.pi];
      const ox = o.x, oz = o.z;
      if (moveTo(o, def, c, w[0], w[1], PAR.sp, dt) < 3) parade.pi++;
      const last = parade.trail[parade.trail.length - 1], dd = Math.hypot(o.x - last.x, (o.z - last.z) * ZPX);
      if (dd >= 3) { parade.len += dd; parade.trail.push({ x: o.x, z: o.z, d: parade.len }); }
      if (ox === o.x && oz === o.z && parade.pi < parade.path.length) c.v = 0;
      return true;
    }
    const q = trailAt(parade.len - i * PAR.gap);
    moveTo(o, def, c, q.x, q.z, PAR.sp * 1.6, dt);
    return true;
  };
  function paradeTick(dt, tank) {
    if (parade) {
      parade.t += dt;
      const gone = tank.id !== parade.tank || V.tool === 'deco' || parade.list.some(function (o) { return tank.deco.indexOf(o) < 0; });
      if (gone) { endParade(); return; }
      if (parade.pi >= parade.path.length) parade.done += dt;
      if (parade.done > 7 || parade.t > 90) endParade();
      return;
    }
    const s = AA.state;
    if (!s || AA.visit || !AA.themeParade || V.photoMode) return;
    const day = AA.today ? AA.today() : new Date().toISOString().slice(0, 10);
    if (s.paradeDay === day) return;
    parT += dt;
    if (parT < 8) return;
    parT = 0;
    if (!AA.themeParade() || crawlers(tank).length < 3) return;
    if (AA.startParade()) { s.paradeDay = day; AA.save(); }
  }
})(window.AA);
