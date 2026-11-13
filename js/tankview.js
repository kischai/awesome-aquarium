'use strict';
/* Awesome Aquarium – Darstellung des Beckens (Canvas 2D, flacher 2D-Look).
   Seitenansicht: oben Wasser, unten der Kies-Streifen. z = Tiefe auf dem Kies (0 = hinten, 1 = vorne) –
   sie bestimmt nur, wer wen verdeckt, wie weit unten etwas steht und eine ganz leichte Größenstaffelung. */
(function (AA) {
  const W = AA.W, H = AA.H, TAU = Math.PI * 2;
  const G = AA.G = { top: 92, fTop: 486, fy0: 536, fy1: 642, fx: -6, fw: 1292 };
  /* Boden-Höhe: z = Tiefe (0 hinten … 1 vorn). Mit x kommt die Boden-Form des Beckens dazu (Hügel, Tal, Hang … – AA.SHAPES): dort liegt der Boden höher. */
  AA.lift = function (x) { const sh = AA.SHAPE_BY[AA.tank().shape]; return sh && sh.f ? AA.LIFT_MAX * sh.f(AA.clamp(x / W, 0, 1)) : 0; };
  AA.floorY = function (z, x) { const y = AA.lerp(G.fy0, G.fy1, z); return x === undefined ? y : y - AA.lift(x); };
  AA.depthScale = function (z) { return (0.84 + 0.16 * z) * V.sprK; };      // sprK: in kleinen Becken wirkt alles etwas größer (siehe V.setZoom)
  AA.xLimits = function () { return [36, W - 36]; };
  AA.zFromY = function (y) { return AA.clamp((y - G.fy0) / (G.fy1 - G.fy0), 0, 1); };

  const V = AA.view = {
    fish: [], byId: {}, food: [], bubbles: [], parts: [], texts: [], rips: [], plank: [], decoT: {}, crawl: {}, shine: {},
    live: [], service: {}, nestle: {}, schools: {}, doctors: [], plants: [], wipe: null, foodKind: 'normal',
    sel: null, selDeco: null, dragDeco: null, sizing: null, sizeT: -9, cardZone: null, dropSpot: null, time: 0, tool: 'hand',
    pointer: { x: 0, y: 0, inside: false, down: false }, photoMode: false, bubT: 1
  };

  const SS = 2;
  function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
  /* Runde 14: Beckenwechsel ohne Ruckler – fertige Kulissen und fertig gemalte Böden mit Form bleiben in kleinen Merkspeichern liegen
     (die zuletzt benutzten; auf Touch-Geräten weniger, wegen des Speichers). Am teuersten war der Boden mit Form: er wird in 2-Pixel-Spalten
     gemalt (über tausend Einzelbilder). Kurz nach jedem Wechsel bereitet V.prewarm die Nachbarbecken (Pfeile links/rechts) im Leerlauf vor. */
  const COARSE = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const bgCache = new Map(), BG_MAX = COARSE ? 2 : 4, floorCache = new Map(), FLOOR_MAX = COARSE ? 3 : 8;
  function lruGet(m, k) { const v = m.get(k); if (v !== undefined) { m.delete(k); m.set(k, v); } return v; }
  function lruPut(m, k, v, max) { m.set(k, v); while (m.size > max) m.delete(m.keys().next().value); return v; }
  function bgFor(wallId, T) { const bk = wallId + '|' + T; return lruGet(bgCache, bk) || lruPut(bgCache, bk, buildBg(wallId, T), BG_MAX); }
  let sceneCv = null, sceneKey = '', glassCv = null;
  let groundCv = null, groundKey = '', curGround = null;      // Runde 13: Szene + flach liegende Wege (Deko mit def.path) – siehe groundCanvas; curGround = das im aktuellen Bild

  /* ---------- statische Ebenen ---------- */
  /* Wasser-Hintergrund: Farbverlauf + flache Silhouetten in der Ferne (alles ohne Konturen, wie die Deko-Sprites) */
  AA.paintWater = function (g, wall, w, h, horizon, seed) {
    const gr = g.createLinearGradient(0, 0, 0, h);
    wall.cols.forEach(function (c, i) { gr.addColorStop(i / (wall.cols.length - 1), c); });
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = AA.rng(seed || 7);
    g.fillStyle = wall.far;
    for (let layer = 0; layer < 2; layer++) {
      g.globalAlpha = layer ? 0.5 : 0.28;
      const n = layer ? 6 : 8, base = horizon + (layer ? 26 : 8);
      for (let i = 0; i < n; i++) {                   // Hügel und Felsen
        const cx = (i + 0.2 + r() * 0.6) / n * w, rw = w * (0.07 + r() * 0.09), rh = h * (layer ? 0.05 + r() * 0.08 : 0.08 + r() * 0.13);
        g.beginPath(); g.ellipse(cx, base, rw, rh, 0, Math.PI, TAU); g.fill();
      }
      for (let i = 0; i < (layer ? 6 : 8); i++) {     // Seegras-Blätter mit runder Spitze
        const x = r() * w, hh = h * (layer ? 0.09 + r() * 0.12 : 0.12 + r() * 0.16), ww = 10 + r() * 10, bend = (r() - 0.5) * 50;
        const tx = x + bend, ty = base - hh, tr = ww * 0.42;
        g.beginPath(); g.moveTo(x - ww, base);
        g.bezierCurveTo(x - ww * 1.1 + bend * 0.2, base - hh * 0.45, tx - ww * 0.9, ty + hh * 0.3, tx - tr, ty);
        g.arc(tx, ty, tr, Math.PI, 0);
        g.bezierCurveTo(tx + ww * 0.9, ty + hh * 0.3, x + ww * 1.1 + bend * 0.2, base - hh * 0.45, x + ww, base);
        g.closePath(); g.fill();
      }
      for (let i = 0; i < 3; i++) {                   // Korallen-Büsche aus Kreisen
        const cx = r() * w, s = 14 + r() * 20;
        for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(cx + (k - 2) * s * 0.7, base - s * (0.6 + (k % 2) * 0.7), s * (0.7 + r() * 0.4), 0, TAU); g.fill(); }
      }
    }
    g.globalAlpha = 1;
  };
  /* Kies-Streifen: das Sprite über die ganze Breite ziehen (etwas breiter als der Bildschirm) */
  AA.FLOOR_CROP = [0.09, 0.82];                       // nur das Mittelstück des Sprites nutzen – die Enden laufen schräg aus
  /* Runde 8: Kies-Maßstab. Bei T < 1 wird der Streifen feiner gezeichnet (mehr Steinchen auf derselben Fläche): oben die Hinterkante, unten die
     dunkle Vorderkante, dazwischen wird die Oberfläche wiederholt (abwechselnd gespiegelt – so gibt es keine harten Kanten). Waagerecht ebenfalls gespiegelt gekachelt. */
  const stripCache = {}, rowCache = {};
  function floorRows(id, im, fx0, fx1) {               // wo endet die gewellte Hinterkante (rs), wo beginnt die Vorderkante (rb)? fx0…fx1 = betrachteter Bereich (Anteil der Bildbreite)
    if (rowCache[id]) return rowCache[id];
    let rs = Math.round(im.height * 0.3), rb = Math.round(im.height * 0.66);
    try {
      const c = mk(im.width, im.height), g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const x0 = Math.round(im.width * (fx0 === undefined ? 0.15 : fx0)), x1 = Math.round(im.width * (fx1 === undefined ? 0.85 : fx1)), d = g.getImageData(x0, 0, x1 - x0, im.height).data, w = x1 - x0;
      const op = [], lum = [];
      for (let y = 0; y < im.height; y++) {
        let n = 0, l = 0;
        for (let x = 0; x < w; x += 2) { const k = (y * w + x) * 4; if (d[k + 3] > 200) { n++; l += 0.3 * d[k] + 0.59 * d[k + 1] + 0.11 * d[k + 2]; } }
        op.push(n / Math.ceil(w / 2)); lum.push(n ? l / n : 0);
      }
      let a = op.findIndex(function (v) { return v > 0.985; }); if (a < 0) a = Math.round(im.height * 0.3);
      a = Math.min(im.height - 4, a + Math.round(im.height * 0.03));
      let ls = 0, nl = 0; for (let y = a; y < a + im.height * 0.2 && y < im.height; y++) { ls += lum[y]; nl++; } ls /= Math.max(1, nl);
      let lb = 0, nb = 0; for (let y = Math.round(im.height * 0.9); y < im.height - 2; y++) if (op[y] > 0.5) { lb += lum[y]; nb++; } lb /= Math.max(1, nb);
      let b = -1;
      if (Math.abs(ls - lb) > 12) for (let y = Math.round(a + im.height * 0.12); y < im.height; y++) if (Math.abs(lum[y] - ls) > Math.abs(ls - lb) * 0.15) { b = y; break; }
      if (b > a + 8) { rs = a; rb = b; }
    } catch (e) { /* Bild nicht lesbar: Schätzwerte */ }
    return (rowCache[id] = { rs: rs, rb: rb });
  }
  /* weiche Kachel: ein Bildausschnitt, dessen Ränder (links, rechts, oben, unten – in Zielpixeln) nach außen durchsichtig auslaufen */
  function softTile(im, sx, sy, sw, sh, dw, dh, fl, fr, ft, fb) {
    const c = mk(Math.max(2, Math.ceil(dw)), Math.max(2, Math.ceil(dh))), g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in';
    const fade = function (x1, y1, a, z) {
      const gr = g.createLinearGradient(0, 0, x1, y1), L = x1 || y1;
      gr.addColorStop(0, a ? 'rgba(0,0,0,0)' : '#000'); gr.addColorStop(Math.min(0.5, a / L), '#000'); gr.addColorStop(Math.max(0.5, 1 - z / L), '#000'); gr.addColorStop(1, z ? 'rgba(0,0,0,0)' : '#000');
      g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    };
    if (fl || fr) fade(c.width, 0, fl, fr);
    if (ft || fb) fade(0, c.height, ft, fb);
    return c;
  }
  /* Kies im kleineren Maßstab T (große Becken, Meeresbecken): Das Boden-Bild wird verkleinert und füllt die Fläche als Kacheln.
     Hinterkante (oben) und Vorderkante (unten) bleiben ganz, die Kiesfläche dazwischen wird wiederholt – ohne Spiegeln (das gäbe Augen-Muster aus
     halbierten Kieseln). Über jede Naht kommt ein weich auslaufender Flicken aus der Bildmitte, so sieht man weder Kante noch Muster. */
  function floorStrip(id, im, T) {
    const key = id + '|' + T.toFixed(3);
    if (stripCache[key]) return stripCache[key];
    const fl = AA.FLOOR_BY[id], sx = im.width * AA.FLOOR_CROP[0], sw = im.width * AA.FLOOR_CROP[1];
    if (fl && fl.seam) return (stripCache[key] = splitStrip(id, im, T, fl.seam));
    return (stripCache[key] = stripFrom(id, im, sx, sw, sw, T));
  }
  /* Zweigeteilter Boden (links ein Material, rechts ein anderes; seam = Lage der Naht im Bild): Jede Hälfte wird für sich als Boden gekachelt
     und füllt ihre Seite des Beckens; in der Mitte treffen sie sich an einer geschwungenen Naht wie im gemalten Bild. (Als EIN Bild gekachelt,
     wiederholte sich die Naht in großen Becken mehrmals und versetzt – der Boden sah zerhackt aus.) */
  function splitStrip(id, im, T, seam) {
    const sx = im.width * AA.FLOOR_CROP[0], sw = im.width * AA.FLOOR_CROP[1], xs = seam * im.width, m = im.width * 0.04;
    const A = stripFrom(id + ':L', im, sx, xs - m - sx, sw, T, sx / im.width + 0.03, (xs - m) / im.width - 0.02);
    const B = stripFrom(id + ':R', im, xs + m, sx + sw - xs - m, sw, T, (xs + m) / im.width + 0.02, (sx + sw) / im.width - 0.03);
    const cw = A.cv.width, ch = A.cv.height, c = mk(cw, ch), g = c.getContext('2d'), sc = G.fw / sw * T * SS;
    g.drawImage(A.cv, 0, 0);
    const xc = cw / 2, per = 34 * sc, dep = 22 * sc;      // Bögen: das rechte Material wölbt sich in runden Lappen über das linke
    g.save(); g.beginPath(); g.moveTo(xc, -per);
    for (let y = -per; y < ch + per; y += per) g.quadraticCurveTo(xc - dep, y + per / 2, xc, y + per);
    g.lineTo(cw, ch + per); g.lineTo(cw, -per); g.closePath(); g.clip();
    g.clearRect(0, 0, cw, ch); g.drawImage(B.cv, 0, 0);
    g.restore();
    return { cv: c, h: A.h };
  }
  /* sx0/sw0 = Ausschnitt des Bildes, der gekachelt wird; swFull = Breite, die im Maßstab 1 das ganze Becken füllt (bestimmt die Kiesel-Größe) */
  function stripFrom(id, im, sx, sw, swFull, T, fx0, fx1) {
    const R = floorRows(id, im, fx0, fx1);
    const Q = SS, FH = H - G.fTop + 40, cw = Math.ceil(G.fw * Q), ch = Math.ceil(FH * Q), sc = G.fw / swFull * T * Q;
    const c = mk(cw, ch), g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const tw = sw * sc, nx = Math.ceil(cw / tw) + 1, topH = R.rs * sc, bandH = (im.height - R.rb) * sc, mh = R.rb - R.rs, midH = mh * sc, bottom = ch - bandH;
    const Fx = Math.min(tw * 0.16, 46 * Q), Fy = Math.min(midH * 0.3, 24 * Q);
    function mirrorRow(srcY, srcH, dy, dh) {           // gespiegelt aneinander: Wellenkante und Vorderkante laufen so ohne Sprung durch
      for (let i = 0; i < nx; i++) { g.save(); g.translate(i * tw + (i % 2 ? tw : 0), dy); g.scale(i % 2 ? -1 : 1, 1); g.drawImage(im, sx, srcY, sw, srcH, 0, 0, tw + 0.5, dh + 0.5); g.restore(); }
    }
    const rows = []; for (let y = topH, k = 0; y < bottom && midH > 2 && k < 40; y += midH - 0.5, k++) rows.push(y);
    const off = function (k) { return k ? -((k * 0.37) % 1) * tw : 0; };
    g.save(); g.beginPath(); g.rect(0, topH - 1, cw, Math.max(2, bottom - topH + 2)); g.clip();
    rows.forEach(function (ry, k) {
      if (!k) { mirrorRow(R.rs, mh, ry, midH); return; }   // erste Reihe: passend zur Hinterkante darüber
      for (let i = 0; i <= nx; i++) g.drawImage(im, sx, R.rs, sw, mh, off(k) + i * tw, ry, tw + 0.5, midH + 0.5);
    });
    if (rows.length && Fx > 2) {                       // Flicken über die senkrechten Nähte
      const pa = softTile(im, sx + sw * 0.5 - Fx / sc, R.rs, 2 * Fx / sc, mh, 2 * Fx, midH + 0.5, Fx, Fx, 0, 0);
      rows.forEach(function (ry, k) { for (let i = (k ? 0 : 1); i <= nx; i++) { const x = off(k) + i * tw; if (x > -Fx && x < cw + Fx) g.drawImage(pa, x - Fx, ry); } });
    }
    if (rows.length > 1 && Fy > 2) {                   // Bänder über die waagrechten Nähte (selbst weich aneinandergesetzt)
      const pb = softTile(im, sx, R.rs + mh * 0.5 - Fy / sc, sw, 2 * Fy / sc, tw, 2 * Fy, Fx, 0, Fy, Fy);
      for (let k = 1; k < rows.length; k++) { const o = -(((k * 0.37) + 0.5) % 1) * tw; for (let i = 0; o + i * (tw - Fx) < cw; i++) g.drawImage(pb, o + i * (tw - Fx), rows[k] - Fy); }
    }
    g.restore();
    mirrorRow(0, R.rs, 0, topH);
    if (rows.length > 1 && Fy > 2) {                   // etwas Kies über der Vorderkante, der weich in die letzte Reihe übergeht
      const m = Math.min(mh * 0.25, 1.6 * Fy / sc), mH = m * sc, t = softTile(im, sx, R.rb - m, sw, m, tw + 0.5, mH + 0.5, 0, 0, mH * 0.85, 0);
      for (let i = 0; i < nx; i++) { g.save(); g.translate(i * tw + (i % 2 ? tw : 0), bottom - mH); g.scale(i % 2 ? -1 : 1, 1); g.drawImage(t, 0, 0); g.restore(); }
    }
    mirrorRow(R.rb, im.height - R.rb, bottom, bandH);
    return { cv: c, h: FH };
  }
  AA.paintFloor = function (g, id, x, y, w, shape, T) {
    let im = AA.assets.get('floor/' + id) || AA.assets.get('floor/sand');
    if (!im) { g.fillStyle = '#eadfd2'; g.fillRect(x, y + 14, w, 300); return 0; }
    let sx = im.width * AA.FLOOR_CROP[0], sw = im.width * AA.FLOOR_CROP[1], h = w * im.height / sw;
    if (T && (Math.abs(T - 1) > 0.01 || (AA.FLOOR_BY[id] || {}).seam) && Math.abs(w - G.fw) < 1) {        // Becken (nicht Vorschau): Kies im passenden Maßstab
      const st = floorStrip(AA.assets.get('floor/' + id) ? id : 'sand', im, T); im = st.cv; sx = 0; sw = st.cv.width; h = st.h;
    }
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const sh = shape && AA.SHAPE_BY[shape];
    if (!sh || !sh.f) { g.drawImage(im, sx, 0, sw, im.height, x, y, w, h); return h; }
    /* Boden mit Form: in schmalen Spalten zeichnen, jede Spalte um ihre Höhe angehoben und nach unten gestreckt (so entsteht keine Lücke am Rand).
       k = Maßstab gegenüber dem Becken (für Vorschaubilder), u = Stelle im Becken 0…1 */
    const k = w / G.fw, L = AA.LIFT_MAX * k, q = g.getTransform ? Math.abs(g.getTransform().a) || 1 : 1;      // q = Gerätepixel je Einheit
    const ck = id + '|' + shape + '|' + (T || 0).toFixed(3) + '|' + q.toFixed(3) + '|' + Math.round(x) + '|' + Math.round(y) + '|' + Math.round(w) + '|' + im.width + 'x' + im.height;
    const hit = lruGet(floorCache, ck);
    if (hit) { g.drawImage(hit, x, y - L, hit.width / q, hit.height / q); return h; }
    const cw = 2, n = Math.ceil(w * q / cw), oc = mk(n * cw, Math.ceil((h + L + 2) * q)), og = oc.getContext('2d');
    og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
    const lift = new Float32Array(n);
    for (let i = 0; i < n; i++) {                      // Spalten in ganzen Gerätepixeln – so entstehen keine Nähte
      const u = AA.clamp(((i + 0.5) * cw / q / k + G.fx) / W, 0, 1), v = sh.f(u), up = L * v;
      lift[i] = v;
      og.drawImage(im, sx + sw * i / n, 0, sw / n, im.height, i * cw, (L - up) * q, cw, (h + up) * q);
    }
    og.globalCompositeOperation = 'source-atop';       // weiches Licht auf den Kuppen, Schatten in den Senken – sonst sieht man die Form auf einfarbigem Boden kaum
    for (let i = 0; i < n; i++) {
      const v = lift[i];
      og.fillStyle = v > 0.5 ? 'rgba(255,255,255,' + ((v - 0.5) * 0.14).toFixed(3) + ')' : 'rgba(0,20,40,' + ((0.5 - v) * 0.12).toFixed(3) + ')';
      og.fillRect(i * cw, 0, cw, oc.height);
    }
    g.drawImage(oc, x, y - L, n * cw / q, oc.height / q);
    if (AA.assets.get('floor/' + id) && Math.abs(w - G.fw) < 1) lruPut(floorCache, ck, oc, FLOOR_MAX);      // nur fertige Becken-Böden merken (keine Vorschaubilder, nicht den Ersatz-Sand, solange das Bild lädt)
    return h;
  };
  function buildBg(wallId, T) {
    const wall = AA.WALL_BY[wallId] || AA.WALLS[0];
    const c = mk(W * SS, H * SS), g = c.getContext('2d');
    g.scale(SS, SS);
    const im = wall.img && AA.assets.get(wall.img);
    if (im) {                                          // gemaltes Hintergrundbild
      /* Runde 12: Die Kulisse sitzt immer auf dem Kies. Maßstab 1 = so, wie sie im normalen Becken liegt (formatfüllend); in großen Becken wird sie
         kleiner gezeichnet (wirkt weiter weg) – aber die Bildzeile an der Hinterkante des Kieses bleibt dort. Vorher hing die kleinere Kulisse oben
         und unter ihr stand ein leerer Streifen: Vulkane & Co. schwebten mitten im Wasser. Oben füllt die oberste Bildzeile (offenes Wasser) den Rest. */
      const tb = Math.pow(T || 1, 0.4);
      const k1 = Math.max(W / im.width, H / im.height), y1 = (H - im.height * k1) * 0.3;
      const A = G.fTop + 12, row = (A - y1) / k1;                    // Bildzeile an der Kies-Hinterkante
      const k = k1 * tb, dw = im.width * k, dh = im.height * k, y0 = A - row * k;
      const x0 = (W - dw) / 2, n = dw >= W - 0.5 ? 0 : Math.ceil(x0 / dw) + 1;
      for (let i = -n; i <= n; i++) {                  // schmaler als das Becken: seitlich gespiegelt kacheln
        g.save(); g.translate(x0 + i * dw + (i % 2 ? dw : 0), 0); g.scale(i % 2 ? -1 : 1, 1);
        g.drawImage(im, 0, 0, im.width, im.height, 0, y0, dw + 0.5, dh);
        if (y0 > 0) g.drawImage(im, 0, 0, im.width, 3, 0, 0, dw + 0.5, y0 + 1.5);
        if (y0 + dh < H) g.drawImage(im, 0, im.height - 2, im.width, 2, 0, y0 + dh - 1, dw + 0.5, H - (y0 + dh) + 2);
        g.restore();
      }
    } else AA.paintWater(g, wall, W, H, G.fTop + 14, 11);
    return c;
  }
  function buildGlass() {
    const c = mk(W, H), g = c.getContext('2d');
    const vg = g.createRadialGradient(W / 2, H / 2, 400, W / 2, H / 2, 840);
    vg.addColorStop(0, 'rgba(0,40,70,0)'); vg.addColorStop(1, 'rgba(0,40,70,0.22)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    return c;
  }
  /* kleine Vorschaubilder für den Shop */
  const thumbs = {};
  V.floorThumb = function (id) {
    if (thumbs['f' + id]) return thumbs['f' + id];
    const c = mk(240, 130), g = c.getContext('2d');
    AA.paintWater(g, AA.WALL_BY[AA.tank().wall] || AA.WALLS[0], 240, 130, 400, 3);
    AA.paintFloor(g, id, -120, 52, 560);
    const u = c.toDataURL('image/png'); if (AA.assets.get('floor/' + id)) thumbs['f' + id] = u;
    return u;
  };
  V.wallThumb = function (id) {
    if (thumbs['w' + id]) return thumbs['w' + id];
    const wim = (AA.WALL_BY[id] || {}).img && AA.assets.get(AA.WALL_BY[id].img);
    if (wim) { const c2 = mk(240, 130), g2 = c2.getContext('2d'); g2.drawImage(wim, 0, 0, 240, 135); AA.paintFloor(g2, AA.tank().floor, -120, 96, 560); return (thumbs['w' + id] = c2.toDataURL('image/jpeg', 0.86)); }
    const c = mk(240, 130), g = c.getContext('2d');
    AA.paintWater(g, AA.WALL_BY[id], 240, 130, 96, 5);
    AA.paintFloor(g, 'sand', -10, 90, 260);
    const u = c.toDataURL('image/png'); if (!(AA.WALL_BY[id] || {}).img) thumbs['w' + id] = u;      // gemalte Kulisse noch nicht geladen: vorerst die Wasserfarbe, nicht merken
    return u;
  };
  /* Vorschau einer Boden-Form mit dem Boden des aktuellen Beckens */
  V.shapeThumb = function (id) {
    const t = AA.tank(), key = 's' + id + '|' + t.floor + '|' + t.wall;
    if (thumbs[key]) return thumbs[key];
    const c = mk(240, 130), g = c.getContext('2d');
    AA.paintWater(g, AA.WALL_BY[t.wall] || AA.WALLS[0], 240, 130, 400, 3);
    AA.paintFloor(g, t.floor, -1, 74, 242, id);
    const u = c.toDataURL('image/png'); if (AA.assets.get('floor/' + t.floor)) thumbs[key] = u;
    return u;
  };
  AA.on('assets', function (g) { if (g.charAt(1) === '-' && (g.charAt(0) === 'k' || g.charAt(0) === 'w')) { sceneKey = null; bgCache.clear(); floorCache.clear(); } });
  V.clearThumbs = function () { for (const k in thumbs) if (k[0] === 'f') delete thumbs[k]; };

  /* ---------- Zeichen-Helfer: verformte Sprites ---------- */
  /* Fisch: Bild in senkrechte Streifen zerlegt; Schwanzflosse schwingt um die Schwanzwurzel,
     der Hinterkörper biegt sich leicht mit. Jeder Streifen wird geschert -> glatte Kontur. */
  AA.drawWavy = function (ctx, img, w, h, phase, rig, amp) {
    const iw = img.width, ih = img.height;
    const tail = rig.tail || 0.22, piv = Math.max(0.62, tail + 0.3), wag = rig.wag || 1;
    const th = Math.sin(phase) * 0.34 * wag * amp;                                        // Ausschlag der Schwanzflosse
    const fold = 1 - 0.2 * Math.min(1, amp) * (0.5 - 0.5 * Math.cos(phase * 2 + 0.5));    // Flosse dreht sich leicht weg
    const bend = Math.sin(phase - 0.9) * 0.05 * amp * h;                                  // Hinterkörper biegt sich mit
    const slope = 2 * bend / ((piv - tail) * w);
    const xT = -w / 2 + tail * w;
    // Kopf und Vorderkörper bleiben starr: ein einziges Stück
    const fsx = Math.round(piv * iw);
    ctx.drawImage(img, fsx, 0, iw - fsx, ih, -w / 2 + fsx / iw * w, -h / 2, (iw - fsx) / iw * w, h);
    // dahinter: NB Streifen Hinterkörper + NF Streifen Schwanzflosse, jeweils geschert
    const NF = 6, NB = w > 110 ? 9 : 7, N = NF + NB;
    let px = 0, py = 0, pu = 0;
    for (let i = 0; i <= N; i++) {
      const u = i <= NF ? tail * i / NF : tail + (piv - tail) * (i - NF) / NB;
      let x, y;
      if (u >= tail) { const q = (piv - u) / (piv - tail); x = -w / 2 + u * w; y = bend * q * q; }
      else { const dx = (tail - u) * w; x = xT - dx * fold; y = bend + dx * (th + slope); }
      if (i > 0) {
        const sx = Math.round(pu * iw), sw = (i === N ? fsx : Math.round(u * iw)) - sx, dw = x - px;
        if (sw > 0 && dw > 0.01) {
          const k = (y - py) / dw;
          ctx.transform(1, k, 0, 1, px, py);
          ctx.drawImage(img, sx, 0, sw, ih, 0, -h / 2, dw + 0.75, h);
          ctx.transform(1, -k, 0, 1, -px, k * px - py);
        }
      }
      px = x; py = y; pu = u;
    }
  };
  /* Von vorn gezeichnete Tiere (Kalmar, Qualle): der Mantel pulsiert, die Arme darunter schlängeln seitlich. Ursprung = Bildmitte.
     split = bis hierhin (Anteil der Bildhöhe) reicht der feste Körper; pulseK = 0 schaltet das Pulsieren ab (Schildkröte: nur die Flossen paddeln). */
  AA.drawJelly = function (ctx, img, w, h, phase, amp, split, pulseK) {
    const iw = img.width, ih = img.height, R = 16;
    split = split || 0.56;
    const pulse = Math.sin(phase) * 0.035 * amp * (pulseK === undefined ? 1 : pulseK);
    ctx.save();
    ctx.scale(1 - pulse, 1 + pulse * 1.3);
    const sy0 = Math.round(split * ih);
    ctx.drawImage(img, 0, 0, iw, sy0, -w / 2, -h / 2, w, split * h + 0.6);
    const off = function (v) { const q = (v - split) / (1 - split); return amp * w * 0.11 * q * q * Math.sin(phase * 1.0 - q * 2.6); };
    for (let k = 0; k < R; k++) {
      const v0 = split + (1 - split) * k / R, v1 = split + (1 - split) * (k + 1) / R;
      const sy = Math.round(v0 * ih), sh = Math.round(v1 * ih) - sy;
      const y0 = -h / 2 + v0 * h, bh = (v1 - v0) * h, d0 = off(v0), d1 = off(v1);
      ctx.save();
      ctx.transform(1, 0, (d1 - d0) / bh, 1, d0, y0);
      ctx.drawImage(img, 0, sy, iw, sh, -w / 2, 0, w, bh + 0.75);
      ctx.restore();
    }
    ctx.restore();
  };
  /* Aufrecht schwimmende Tiere (Seepferdchen): der Kopf bleibt ruhig, Bauch und Ringelschwanz pendeln nach. Ursprung = Bildmitte. */
  AA.drawUp = function (ctx, img, w, h, phase, amp) {
    const R = 14, iw = img.width, ih = img.height;
    const off = function (v) { return amp * w * 0.11 * v * v * Math.sin(phase - v * 2.2); };   // v = 0 oben (Kopf) … 1 unten (Schwanz)
    for (let k = 0; k < R; k++) {
      const v0 = k / R, v1 = (k + 1) / R;
      const sy = Math.round(v0 * ih), sh = Math.round(v1 * ih) - sy;
      const y0 = -h / 2 + v0 * h, bh = h / R, d0 = off(v0), d1 = off(v1);
      ctx.save();
      ctx.transform(1, 0, (d1 - d0) / bh, 1, d0, y0);
      ctx.drawImage(img, 0, sy, iw, sh, -w / 2, 0, w, bh + 0.75);
      ctx.restore();
    }
  };
  /* Muräne: eine Welle läuft vom Kopf zum Schwanz durch den ganzen Körper und wird nach hinten stärker.
     Senkrechte Streifen, jeder geschert -> glatte Kontur. rig.head = ab hier (zum Kopf hin) bleibt das Bild ruhig. */
  AA.drawEel = function (ctx, img, w, h, phase, rig, amp) {
    const N = 24, iw = img.width, ih = img.height, head = rig.head || 0.8;
    const A = h * 0.36 * Math.min(1.5, 0.5 + amp * 0.55);
    const yOf = function (u) { const q = Math.max(0, (head - u) / head); return A * Math.pow(q, 0.85) * Math.sin(phase + u * 7.2); };   // + = die Welle läuft vom Kopf (u = 1) zum Schwanz (u = 0); mit − lief sie nach vorn und der Aal schwamm scheinbar rückwärts
    let px = -w / 2, py = yOf(0), psx = 0;
    for (let i = 1; i <= N; i++) {
      const u = i / N, x = -w / 2 + u * w, y = yOf(u), sx = Math.round(u * iw), dw = x - px;
      ctx.save();
      ctx.transform(1, (y - py) / dw, 0, 1, px, py);
      ctx.drawImage(img, psx, 0, sx - psx, ih, 0, -h / 2, dw + 0.75, h);
      ctx.restore();
      px = x; py = y; psx = sx;
    }
  };
  /* Rochen: Flügelschlag. Jeder senkrechte Streifen wird um die Körperachse herum gestaucht und gestreckt (am stärksten dort,
     wo die Flügel sitzen), als Welle von vorn nach hinten; der lange Schwanz pendelt leicht nach.
     rig.axis = Höhe der Körperachse im Bild, rig.wing = Mitte der Flügel, rig.tail = bis hierhin reicht der Schwanz. */
  AA.drawFlap = function (ctx, img, w, h, phase, rig, amp) {
    const iw = img.width, ih = img.height, ax = rig.axis || 0.5, wc = rig.wing || 0.62, tl = rig.tail || 0.36, span = rig.span || 0.2;
    const a = 0.27 * (rig.wag || 1) * Math.min(1.25, 0.6 + amp * 0.4), yAx = -h / 2 + ax * h;
    const NB = 22, NT = 16;
    for (let i = 0; i < NB; i++) {                                         // Körper mit den Flügeln (rechts von der Schwanzwurzel)
      const u0 = tl + (1 - tl) * i / NB, u1 = tl + (1 - tl) * (i + 1) / NB, um = (u0 + u1) / 2;
      const sx = Math.round(u0 * iw), sw = Math.round(u1 * iw) - sx;
      if (sw <= 0) continue;
      const k = Math.exp(-Math.pow((um - wc) / span, 2));
      const s = 1 - a * k * (0.5 + 0.5 * Math.sin(phase + um * 2.6));      // Flügelschlag läuft von vorn nach hinten
      ctx.drawImage(img, sx, 0, sw, ih, -w / 2 + u0 * w, yAx - ax * h * s, (u1 - u0) * w + 0.75, h * s);
    }
    /* Schwanz: der dünne Teil links von rig.tail wird um rig.tx in die Länge gezogen (die Bilder haben zu kurze Schwänze) und schlägt
       wie eine Peitsche – eine Welle läuft von der Wurzel zur Spitze und wird zur Spitze hin stärker (rig.whip = Ausschlag). */
    const L = tl * w * (rig.tx || 1), xR = -w / 2 + tl * w;
    const A = h * (rig.whip || 0.1) * Math.min(1.3, 0.55 + amp * 0.5);
    const yOf = function (q) { return A * Math.pow(q, 1.35) * Math.sin(phase * 1.25 - q * 3.3); };
    let px = xR, py = 0, psx = Math.round(tl * iw);
    for (let j = 1; j <= NT; j++) {
      const q = j / NT, x = xR - q * L, y = yOf(q), sx = Math.round(tl * (1 - q) * iw), dw = px - x;
      if (psx - sx > 0 && dw > 0.01) {
        ctx.save();
        ctx.transform(1, (py - y) / dw, 0, 1, x, y);
        ctx.drawImage(img, sx, 0, psx - sx, ih, 0, -h / 2, dw + 0.75, h);
        ctx.restore();
      }
      px = x; py = y; psx = sx;
    }
  };
  /* Fuchshai: vorn starr, der Hinterkörper biegt sich sanft, und die extrem lange obere Schwanzflosse schlägt wie eine Peitsche –
     eine Welle läuft von der Schwanzwurzel (rig.tail) bis in die Spitze und wird dort am stärksten (rig.whip). */
  AA.drawWhip = function (ctx, img, w, h, phase, rig, amp) {
    const iw = img.width, ih = img.height, tail = rig.tail || 0.45, piv = Math.min(0.82, tail + 0.3);
    const bend = Math.sin(phase - 0.9) * 0.05 * amp * h, slope = 2 * bend / ((piv - tail) * w);
    const A = h * (rig.whip || 0.16) * Math.min(1.3, 0.5 + amp * 0.55);
    const yOf = function (u) {
      if (u >= tail) { const q = (piv - u) / (piv - tail); return bend * q * q; }
      const q = (tail - u) / tail;
      return bend + q * tail * w * slope * 0.6 + A * Math.pow(q, 1.4) * Math.sin(phase * 0.9 - q * 3.4);
    };
    const fsx = Math.round(piv * iw);
    ctx.drawImage(img, fsx, 0, iw - fsx, ih, -w / 2 + fsx / iw * w, -h / 2, (iw - fsx) / iw * w, h);
    const N = 26;
    let pu = piv, px = -w / 2 + piv * w, py = 0, psx = fsx;
    for (let i = 1; i <= N; i++) {
      const u = piv * (1 - i / N), x = -w / 2 + u * w, y = yOf(u), sx = Math.round(u * iw), dw = px - x;
      if (psx - sx > 0 && dw > 0.01) {
        ctx.save();
        ctx.transform(1, (py - y) / dw, 0, 1, x, y);
        ctx.drawImage(img, sx, 0, psx - sx, ih, 0, -h / 2, dw + 0.75, h);
        ctx.restore();
      }
      pu = u; px = x; py = y; psx = sx;
    }
  };
  /* Pflanze: waagerechte Streifen, oben stärker ausgelenkt. Ursprung = unten Mitte. */
  AA.swayOff = function (w, v, t, amp, ph) { return amp * w * Math.pow(v, 1.6) * Math.sin(t * 1.25 + ph + v * 1.9) + amp * 0.35 * w * v * Math.sin(t * 0.6 + ph * 1.7); };
  AA.drawSway = function (ctx, img, w, h, t, amp, ph) {
    const R = h > 300 ? 22 : 14, iw = img.width, ih = img.height;      // groß gezogene Pflanzen: feinere Streifen, sonst knickt der Bogen
    const off = function (v) { return AA.swayOff(w, v, t, amp, ph); };
    for (let k = 0; k < R; k++) {
      const v0 = 1 - k / R, v1 = 1 - (k + 1) / R;
      const sy = Math.round(k / R * ih), sh = Math.round((k + 1) / R * ih) - sy;
      const y0 = -h * v0, bh = h / R, d0 = off(v0), d1 = off(v1);
      ctx.save();
      ctx.transform(1, 0, (d1 - d0) / bh, 1, d0, y0);
      ctx.drawImage(img, 0, sy, iw, sh, -w / 2, 0, w, bh + 0.75);
      ctx.restore();
    }
  };
  /* geschlossenes Auge: Scheibe in der Farbe des Iris-Rings, darin ein Bogen – wie bei den Baby-Sprites */
  AA.drawBlink = function (ctx, rig, w, h, v) {
    const eyes = rig.eyes;
    if (!eyes) return;
    for (let i = 0; i < eyes.length; i++) {
      const ex = (eyes[i][0] - 0.5) * w, ey = (eyes[i][1] - 0.5) * h, r = eyes[i][2] * w * 1.07;
      ctx.fillStyle = v === 'albino' ? '#f4b0ba' : (rig.lid || '#ffcc66');          // Lid in der Farbe der Iris – bei Albinos zartrosa
      ctx.beginPath(); ctx.arc(ex, ey, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = rig.arc || '#1b1230'; ctx.lineWidth = Math.max(1.2, r * 0.24); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(ex, ey + r * 0.28, r * 0.62, Math.PI + 0.5, TAU - 0.5); ctx.stroke();
    }
  };
  /* ein Fisch-Sprite komplett zeichnen (wird auch vom Shop-Vorschaubild und den Minispielen benutzt). Ursprung = Bildmitte, Blick nach rechts. */
  AA.drawFishSprite = function (ctx, key, w, phase, amp, blink, v) {
    const img = AA.assets.variant(key, v);            // v = Farbvariante (oder nichts)
    if (!img) return 0;
    const rig = AA.RIG[key.slice(5)] || {}, h = w * img.height / img.width, def = AA.FISH_BY[key.slice(5, -2)];
    if (def && def.inv) { ctx.save(); ctx.scale(1, -1); }      // Rückenschwimmender Kongowels: auch hier auf dem Rücken
    AA.drawBody(ctx, img, w, h, phase, rig, amp);
    if (blink) AA.drawBlink(ctx, rig, w, h, v);
    if (def && def.inv) ctx.restore();
    return h;
  };
  /* Trauriges Gesicht: tools/sad.py hat zu jedem Sprite ein kleines Pflaster gebaut (Bild sad/<sprite>, Lage in AA.SAD) – der Mund
     ist darin zum Schmollmund gespiegelt, bei Erwachsenen hängt das Lid, bei Babys ist das Lach-Auge umgedreht. Es wird einfach über
     den Kopf gelegt (gleiche Koordinaten wie das Blinzeln). Dazu kullern Tränen, wenn es richtig schlimm ist. */
  AA.drawSad = function (ctx, key, w, h, sick, t, tears, v) {
    const id = key.slice(5), m = AA.SAD && AA.SAD[id];
    if (!m) return;
    const im = sick ? AA.assets.tinted('sad/' + id, v) : AA.assets.variant('sad/' + id, v);
    if (im) ctx.drawImage(im, (m.r[0] - 0.5) * w, (m.r[1] - 0.5) * h, (m.r[2] - m.r[0]) * w, (m.r[3] - m.r[1]) * h);
    if (!tears || !m.eye) return;
    for (let k = 0; k < m.eye.length; k++) {
      const e = m.eye[k], r = e[2] * w, p = ((t * 0.5 + k * 0.37) % 1.6) / 1.0;
      if (p > 1) continue;
      const x = (e[0] - 0.5) * w - r * 0.25, y = (e[1] - 0.5) * h + r * (0.9 + p * p * 3.4), s = r * 0.3 * (0.6 + 0.4 * Math.min(1, p * 4));
      ctx.save(); ctx.globalAlpha = p < 0.8 ? 0.95 : (1 - p) * 4.75;
      ctx.fillStyle = '#bfeeff'; ctx.strokeStyle = '#3aa0d8'; ctx.lineWidth = Math.max(0.8, s * 0.22);
      ctx.beginPath(); ctx.moveTo(x, y - s * 1.5); ctx.quadraticCurveTo(x + s * 1.15, y + s * 0.2, x, y + s); ctx.quadraticCurveTo(x - s * 1.15, y + s * 0.2, x, y - s * 1.5); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  };
  /* ---------- Runde 12: Beine und Flossen, die sich eigenständig bewegen (Axolotl, Otter, Hamster, Pinguin, Frosch, Seehund) ----------
     tools/rig.py hat zu jedem Bein ein Vieleck p (Bein + schmaler Saum in den Körper), ein Vieleck q (nur der Teil, der aus dem Körper
     ragt) und das Gelenk j gemessen. Beim ersten Gebrauch eines Bildes (auch jeder Farbvariante, jeder kranken Tönung) werden die Beine
     ausgeschnitten und aus dem Körperbild gelöscht; gezeichnet wird: hintere Beine, Körper (mit seiner üblichen Verformung), vordere Beine –
     jedes Bein dreht sich um sein Gelenk vor und zurück. */
  const LIMBC = new WeakMap();
  function polyPath(g, pts, iw, ih) {
    g.beginPath();
    for (let i = 0; i < pts.length; i += 2) { const x = pts[i] * iw, y = pts[i + 1] * ih; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.closePath();
  }
  AA.limbCut = function (img, rig) {
    let c = LIMBC.get(img);
    if (c && c.rig === rig) return c;
    const iw = img.width, ih = img.height, body = document.createElement('canvas');
    body.width = iw; body.height = ih;
    const bg = body.getContext('2d');
    bg.drawImage(img, 0, 0);
    bg.globalCompositeOperation = 'destination-out';
    const parts = rig.limbs.map(function (L) {
      polyPath(bg, L.q, iw, ih); bg.fill();
      let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
      for (let i = 0; i < L.p.length; i += 2) { x0 = Math.min(x0, L.p[i]); x1 = Math.max(x1, L.p[i]); y0 = Math.min(y0, L.p[i + 1]); y1 = Math.max(y1, L.p[i + 1]); }
      const px = Math.max(0, Math.floor(x0 * iw) - 1), py = Math.max(0, Math.floor(y0 * ih) - 1);
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.min(iw, Math.ceil(x1 * iw) + 1) - px); cv.height = Math.max(1, Math.min(ih, Math.ceil(y1 * ih) + 1) - py);
      const g = cv.getContext('2d');
      g.translate(-px, -py); polyPath(g, L.p, iw, ih); g.clip(); g.drawImage(img, 0, 0);
      return { cv: cv, x: px / iw, y: py / ih, L: L };
    });
    c = { rig: rig, body: body, parts: parts };
    LIMBC.set(img, c);
    return c;
  };
  /* Wo und wie schräg liegt der Körper an der Stelle u, wenn drawWavy ihn biegt (gleiche Formeln) – damit die Beine am Körper bleiben,
     wenn Hinterleib und Schwanz schwingen. Ergebnis in BA: x/y = Verschiebung, a = Drehung (Bogenmaß). */
  const BA = { x: 0, y: 0, a: 0 };
  AA.bodyAt = function (rig, u, phase, amp, w, h) {
    BA.x = BA.y = BA.a = 0;
    if (rig.kind) return BA;
    const tail = rig.tail || 0.22, piv = Math.max(0.62, tail + 0.3);
    if (u >= piv) return BA;
    const bend = Math.sin(phase - 0.9) * 0.05 * amp * h, slope = 2 * bend / ((piv - tail) * w);
    if (u >= tail) { const q = (piv - u) / (piv - tail); BA.y = bend * q * q; BA.a = -Math.atan(slope * q); return BA; }
    const th = Math.sin(phase) * 0.34 * (rig.wag || 1) * amp, fold = 1 - 0.2 * Math.min(1, amp) * (0.5 - 0.5 * Math.cos(phase * 2 + 0.5)), dx = (tail - u) * w;
    BA.x = dx * (1 - fold); BA.y = bend + dx * (th + slope); BA.a = -Math.atan(th + slope);
    return BA;
  };
  AA.drawLimbed = function (ctx, img, w, h, phase, rig, amp) {
    const c = AA.limbCut(img, rig), k = Math.min(1.15, 0.3 + amp * 0.75);
    const each = function (far) {
      for (let i = 0; i < c.parts.length; i++) {
        const P = c.parts[i], L = P.L;
        if (!!L.far !== far) continue;
        const B = AA.bodyAt(rig, L.j[0], phase, amp, w, h), jx = (L.j[0] - 0.5) * w + B.x, jy = (L.j[1] - 0.5) * h + B.y;
        const ang = (L.occ ? L.a * (AA.lureK || 0) * Math.sin((AA.lureT || 0) * L.f + L.o)      // Runde 14: Angel wedelt nur, wenn der Fisch gerade will (Fish.lureE)
          : L.a * k * Math.sin(phase * L.f + L.o)) + B.a;
        ctx.save(); ctx.translate(jx, jy); ctx.rotate(ang);
        ctx.drawImage(P.cv, (P.x - L.j[0]) * w, (P.y - L.j[1]) * h, P.cv.width / img.width * w, P.cv.height / img.height * h);
        ctx.restore();
      }
    };
    each(true);
    bodyCore(ctx, c.body, w, h, phase, rig, amp);
    each(false);
  };
  /* je nach Bauart des Tiers die passende Verformung wählen (rig.kind kommt aus tools/rig.py) */
  AA.drawBody = function (ctx, img, w, h, phase, rig, amp) {
    if (rig.limbs && rig.limbs.length && img.width) AA.drawLimbed(ctx, img, w, h, phase, rig, amp);
    else bodyCore(ctx, img, w, h, phase, rig, amp);
  };
  function bodyCore(ctx, img, w, h, phase, rig, amp) {
    const k = rig.kind;
    if (k === 'front') AA.drawJelly(ctx, img, w, h, phase * 0.55, 0.6 + amp * 0.5, rig.split);
    else if (k === 'paddle') AA.drawJelly(ctx, img, w, h, phase * 0.5, 0.5 + amp * 0.5, rig.split, 0);
    else if (k === 'up') AA.drawUp(ctx, img, w, h, phase * 0.5, 0.55 + amp * 0.5);
    else if (k === 'eel') AA.drawEel(ctx, img, w, h, phase * 0.62, rig, amp);
    else if (k === 'flap') AA.drawFlap(ctx, img, w, h, phase * 0.42, rig, amp);
    else if (k === 'whip') AA.drawWhip(ctx, img, w, h, phase * 0.8, rig, amp);
    else AA.drawWavy(ctx, img, w, h, phase, rig, amp);
  }

  /* ---------- Effekte ---------- */
  V.addBubble = function (x, y, r) { if (V.bubbles.length < 160) V.bubbles.push({ x: x, y: y, r: r || AA.rand(2, 5), vy: AA.rand(42, 78), ph: Math.random() * TAU }); };
  V.puff = function (kind, x, y, n) {
    if (kind === 'dust') { for (let i = 0; i < (n || 5); i++) V.parts.push({ kind: 'dust', x: x + AA.rand(-8, 8), y: y + AA.rand(-3, 2), vx: AA.rand(-30, 30), vy: AA.rand(-38, -12), life: 0, max: AA.rand(0.6, 1.1), s: AA.rand(9, 15) }); return; }
    for (let i = 0; i < (n || 6); i++) V.parts.push({ kind: kind, x: x + AA.rand(-12, 12), y: y + AA.rand(-10, 10), vx: AA.rand(-46, 46), vy: AA.rand(-100, -34), life: 0, max: AA.rand(0.8, 1.4), s: AA.rand(13, 21) });
  };
  /* ein einzelnes Funkeln, das an Ort und Stelle aufblitzt (Farbvarianten, Glitzer-Eier) – ohne Schwerkraft */
  V.twinkle = function (x, y, col, size) {
    if (V.parts.length > 220) return;
    V.parts.push({ kind: 'twinkle', x: x, y: y, vx: AA.rand(-5, 5), vy: AA.rand(-12, -3), life: 0, max: AA.rand(0.55, 0.95), s: size || AA.rand(9, 16), col: col || '#fffbe0', rot: AA.rand(-0.5, 0.5) });
  };
  /* Platscher an der Wasseroberfläche (ein Fisch zieht ein): Tropfen spritzen hoch und fallen zurück, Blasen ziehen mit nach unten */
  V.splashFx = function (x, big) {
    const y = G.top + 4, k = big ? 1.5 : 1;
    for (let i = 0; i < (big ? 16 : 9); i++) V.parts.push({ kind: 'drop', x: x + AA.rand(-14, 14) * k, y: y, vx: AA.rand(-90, 90) * k, vy: AA.rand(-210, -90) * (big ? 1.3 : 1), g: 520, life: 0, max: AA.rand(0.5, 0.85), s: AA.rand(10, 18) * (big ? 1.3 : 1) });
    for (let i = 0; i < (big ? 12 : 6); i++) V.addBubble(x + AA.rand(-26, 26) * k, y + AA.rand(20, 90), AA.rand(2, big ? 7 : 5));
    V.ripple(x, y + 6);
  };
  V.floatText = function (x, y, str, col) { V.texts.push({ x: AA.clamp(x, 90, W - 90), y: y, str: str, col: col || '#ffffff', life: 0 }); };
  V.ripple = function (x, y) { V.rips.push({ x: x, y: y, life: 0 }); };

  /* eine Prise Futter – verbraucht Vorrat (AA.shake) */
  V.sprinkle = function (x, kind) {
    const tank = AA.tank();
    kind = kind || V.foodKind || 'normal';
    if (V.food.length >= AA.BAL.maxFlakes) return 'wait';
    const r = kind === 'normal' ? AA.shake(tank) : AA.shake2(tank, kind);
    if (r !== true) return r;
    if (kind === 'live') {                             // Lebendfutter: kleine Futterfische, die nur Räuber jagen
      for (let i = 0; i < AA.FOOD2.live.per; i++) V.live.push({ x: AA.clamp(x + AA.rand(-40, 40), 70, W - 70), y: G.top - 6, vx: AA.rand(-40, 40), vy: AA.rand(80, 130), z: AA.rand(0.3, 0.95), t: 0, turn: 0, ph: Math.random() * TAU, live: true });
      AA.audio.play('splash');
      return true;
    }
    const F = AA.FOOD2[kind], cols = F ? F.cols : ['#e2772b', '#c9541e', '#f0a43a', '#9a5b2a', '#d9483b', '#7a9a2f'];
    for (let i = 0; i < AA.BAL.flakes; i++) {
      V.food.push({ x: AA.clamp(x + AA.rand(-30, 30), 60, W - 60), y: G.top - 12 + AA.rand(-8, 8), vy: AA.rand(24, 38), ph: Math.random() * TAU,
        rot: Math.random() * TAU, col: AA.pick(cols), s: AA.rand(3.4, 5.4) * (kind === 'med' ? 1.15 : 1), z: AA.rand(0.2, 1), landed: 0, kind: kind === 'normal' ? undefined : kind });
    }
    AA.audio.play('sprinkle');
    return true;
  };
  V.knock = function (x, y) {
    V.ripple(x, y);
    AA.audio.play('knock');
    AA.state.stats.taps++;
    for (let i = 0; i < V.fish.length; i++) V.fish[i].onKnock(x, y);
  };
  V.scrubFx = function (x, y) {
    for (let i = 0; i < 6; i++) V.addBubble(x + AA.rand(-46, 46), y + AA.rand(-34, 34), AA.rand(1.5, 4));
    V.parts.push({ kind: 'spark', x: x + AA.rand(-20, 20), y: y + AA.rand(-16, 16), vx: AA.rand(-20, 20), vy: -30, life: 0, max: 0.7, s: 18 });
  };

  /* ---------- Auswahl ---------- */
  V.select = function (f) { V.sel = f || null; if (f) V.selDeco = null; AA.emit('selection', V.sel); };
  V.selectDeco = function (o) { V.selDeco = o || null; if (o) V.sel = null; AA.emit('decoSelection', V.selDeco); if (o) AA.emit('selection', null); };

  V.decoImg = function (o) {
    if (o.type === 'chest') return AA.assets.get(AA.chestInfo().ready ? 'deco/chest' : 'deco/chest_closed');
    return AA.assets.get('deco/' + o.type);
  };
  /* ---------- Stapeln: Deko auf Plattformen ----------
     Plattformen (def.tops) haben eine oder mehrere flache Oberseiten: [x0, x1, h] = von/bis (Anteil der Bildbreite, ungespiegelt) und
     Höhe über der Unterkante (Anteil der Bildhöhe). Ein Stück, das draufsteht, merkt sich nur: auf wem (o.on = id), auf welcher
     Oberseite (o.oi) und wo darauf (o.ou, 0…1). Seine Lage wird daraus jedes Mal neu berechnet – verschiebt, spiegelt oder vergrößert
     man die Plattform, wandert alles mit. Bis zu drei Etagen. */
  V.decoById = function (id) { const d = AA.tank().deco; for (let i = 0; i < d.length; i++) if (d[i].id === id) return d[i]; return null; };
  V.stackInfo = function (o, depth) {
    if (!o.on || (depth | 0) > 3) return null;
    const P = V.decoById(o.on), pd = P && AA.DECO_BY[P.type], top = pd && pd.tops && pd.tops[o.oi | 0];
    if (!top) return null;
    const pb = V.decoBox(P, (depth | 0) + 1);
    const ui = top[0] + (top[1] - top[0]) * AA.clamp(+o.ou || 0, 0, 1), u = P.flip ? 1 - ui : ui;
    return { x: pb.x + u * pb.w, y: pb.by - top[2] * pb.h, ds: pb.ds, P: P, lvl: (pb.lvl | 0) + 1 };
  };
  V.decoBox = function (o, depth) {
    const def = AA.DECO_BY[o.type], img = V.decoImg(o), gc = def.crawl ? V.onGlass(o) : null;
    if (gc) {                                          // klebt an Scheibe oder Seitenwand: Kasten dort, wo er wirklich zu sehen ist
      const gi = gc.mode === 'wall' ? img : (AA.assets.get('deco/' + o.type + '_glass') || img), k = 1.12;
      let gw = def.w * k, gh = gw * (gi ? gi.height / gi.width : 0.8);
      if (gc.mode === 'wall') { const sw = gw; gw = gh; gh = sw; }
      const m = Math.max(gw, gh), q = gc.mode === 'wall' ? gw / 2 * -gc.wallSide : 0;
      return gc.mode === 'wall' ? { x: gc.gx + q - gw / 2, cx: gc.gx + q, y: gc.gy - gh / 2, w: gw, h: gh, by: gc.gy + gh / 2, sc: k, ds: 1, on: null, lvl: 0, glass: true }
        : { x: gc.gx - m / 2, cx: gc.gx, y: gc.gy - m / 2, w: m, h: m, by: gc.gy + m / 2, sc: k, ds: 1, on: null, lvl: 0, glass: true };
    }
    const st = V.stackInfo(o, depth);
    const ds = st ? st.ds : AA.depthScale(o.z), sc = ds * AA.decoScale(o), w = def.w * sc, h = w * (img ? img.height / img.width : 0.8);   // sc = Tiefe × eingestellte Größe
    const cx = st ? st.x : o.x;
    const by = st ? st.y + Math.min(def.sink || 0, 5) * sc * 0.5 : AA.floorY(o.z, o.x) + (def.sink || 0) * sc;     // auf einer Plattform nur ganz leicht „einsinken“
    return { x: cx - w / 2, cx: cx, y: by - h, w: w, h: h, by: by, sc: sc, ds: ds, on: st ? st.P : null, lvl: st ? st.lvl : 0 };
  };
  V.decoAABB = function (o) {                        // Runde 10: achsenparalleler Rahmen um ein gedrehtes Stück
    const b = V.decoBox(o);
    if (!o.r || b.glass) return b;
    const a = o.r * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), hw = b.w / 2;
    const xs = [-hw, hw, hw, -hw], ys = [0, 0, -b.h, -b.h];
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let i = 0; i < 4; i++) { const X = b.cx + xs[i] * c - ys[i] * sn, Y = b.by + xs[i] * sn + ys[i] * c; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
    return { x: x0, cx: b.cx, y: y0, w: x1 - x0, h: y1 - y0, by: y1, sc: b.sc, ds: b.ds, on: b.on, lvl: b.lvl };
  };
  /* gespeicherte Lage (x, z) der gestapelten Stücke nachführen – x für alles, was mit o.x rechnet, z für die Zeichen-Reihenfolge
     (knapp vor der Plattform). Verwaiste Stücke (Plattform weg) fallen auf den Kies. */
  V.syncStack = function () {
    const d = AA.tank().deco;
    for (let pass = 0; pass < 3; pass++) for (let i = 0; i < d.length; i++) {
      const o = d[i];
      if (!o.on) continue;
      const st = V.stackInfo(o);
      if (!st) { delete o.on; delete o.oi; delete o.ou; continue; }
      o.x = st.x; o.z = Math.min(1, st.P.z + 0.0004);
    }
  };
  V.stackRoot = function (o) { let n = 0; while (o && o.on && n++ < 4) o = V.decoById(o.on); return o; };
  V.stackKids = function (P) { return AA.tank().deco.filter(function (d) { return d.on === P.id; }); };
  /* Wohin würde ein Stück fallen, dessen Fuß bei (x, y) losgelassen wird? Vorderste passende Oberseite – oder null (= Kies). */
  V.stackSpot = function (o, x, y) {
    const def = AA.DECO_BY[o.type];
    if (def.crawl || def.daily || def.path) return null;      // Wege (Runde 13) liegen immer auf dem Kies
    const d = AA.tank().deco; let best = null;
    const img = V.decoImg(o), hh = def.w * AA.decoScale(o) * (img ? img.height / img.width : 0.8);
    for (let i = 0; i < d.length; i++) {
      const P = d[i], pd = AA.DECO_BY[P.type];
      if (!pd.tops || P === o || P.r) continue;          // gedrehte Stücke (Runde 10) sind keine Plattform
      let q = P, loop = false, lv = 0;                 // nicht auf sich selbst oder auf etwas, das auf einem selbst steht
      while (q && q.on && lv++ < 4) { q = V.decoById(q.on); if (q === o) loop = true; }
      if (loop) continue;
      const pb = V.decoBox(P);
      if (pb.lvl >= 2) continue;                       // höchstens drei Etagen
      for (let k = 0; k < pd.tops.length; k++) {
        const tp = pd.tops[k], xa = pb.x + (P.flip ? 1 - tp[1] : tp[0]) * pb.w, xb = pb.x + (P.flip ? 1 - tp[0] : tp[1]) * pb.w, ys = pb.by - tp[2] * pb.h;
        if (x < xa - 10 || x > xb + 10 || y < ys - 46 || y > ys + 16) continue;
        if (ys - hh * pb.ds < G.top - 6) continue;      // würde oben aus dem Wasser ragen
        if (best && (P.z < best.P.z || (P.z === best.P.z && Math.abs(y - ys) > Math.abs(y - best.y)))) continue;
        let u = AA.clamp((x - xa) / Math.max(1, xb - xa), 0, 1); if (P.flip) u = 1 - u;
        best = { P: P, i: k, u: u, y: ys, xa: xa, xb: xb };
      }
    }
    return best;
  };
  /* Treffer nach Form statt nach Kasten: je Bild eine grobe Deckkraft-Maske (höchstens 64 Zellen breit), um zwei Zellen aufgedickt,
     damit auch dünne Halme gut zu greifen sind. Ohne das würde ein groß gezogener Tang mit seinem riesigen, fast leeren Kasten
     alles dahinter unanklickbar machen. Kleine Stücke, Krabbler und die Schatzkiste bleiben beim großzügigen Kasten. */
  const maskOf = new Map();
  function decoMask(img) {
    let m = maskOf.get(img);
    if (m !== undefined) return m;
    m = null;
    try {
      const mw = Math.min(64, img.width), mh = Math.max(1, Math.round(mw * img.height / img.width));
      const g = mk(mw, mh).getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, mw, mh);
      const d = g.getImageData(0, 0, mw, mh).data, a = new Uint8Array(mw * mh), out = new Uint8Array(mw * mh);
      for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] > 40 ? 1 : 0;
      for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
        let on = 0;
        for (let yy = Math.max(0, y - 2); yy <= Math.min(mh - 1, y + 2) && !on; yy++)
          for (let xx = Math.max(0, x - 2); xx <= Math.min(mw - 1, x + 2); xx++) if (a[yy * mw + xx]) { on = 1; break; }
        out[y * mw + x] = on;
      }
      m = { w: mw, h: mh, a: out };
    } catch (e) { m = null; }                          // Maske nicht lesbar: dann zählt wie früher der Kasten
    maskOf.set(img, m);
    return m;
  }
  function shapeHit(o, def, b, x, y) {
    const img = V.decoImg(o), m = img && decoMask(img);
    if (!m) return true;
    const v = (b.by - y) / b.h;                          // 0 = Fuß, 1 = Spitze
    if (v < 0 || v > 1) return false;
    let lx = (x - b.cx) * (o.flip ? -1 : 1);
    if (def.sway) lx -= AA.swayOff(b.w, v, V.time, def.sway, (o.x * 0.013) % TAU);     // Pflanzen wiegen sich – die Maske wiegt mit
    const u = lx / b.w + 0.5;
    if (u < 0 || u >= 1) return false;
    return m.a[Math.min(m.h - 1, Math.floor((1 - v) * m.h)) * m.w + Math.floor(u * m.w)] === 1;
  }
  V.hitDeco = function (x0, y0) {
    const tank = AA.tank(); let best = null, bestZ = -1;
    for (let i = 0; i < tank.deco.length; i++) {
      const o = tank.deco[i], def = AA.DECO_BY[o.type], b = V.decoBox(o), zz = b.glass ? 2 : o.z + (o.l || 0) - (def.path ? 5 : 0);      // am Glas = ganz vorn; Wege ganz hinten
      if (best && zz < bestZ) continue;
      let x = x0, y = y0;
      if (o.r && !b.glass) { const a = -o.r * Math.PI / 180, dx = x0 - b.cx, dy = y0 - b.by, c = Math.cos(a), sn = Math.sin(a); x = b.cx + dx * c - dy * sn; y = b.by + dx * sn + dy * c; }   // gedreht: Punkt zurückdrehen
      if (b.w >= 110 && !def.daily && !def.crawl) {
        const m = def.sway ? b.w * def.sway * 1.4 : 0;
        if (x < b.x - m || x > b.x + b.w + m || y < b.y || y > b.by || !shapeHit(o, def, b, x, y)) continue;
      } else if (!(x >= b.x + b.w * 0.08 && x <= b.x + b.w * 0.92 && y >= b.y + b.h * 0.06 && y <= b.by)) continue;
      best = o; bestZ = zz;
    }
    return best;
  };

  /* ---------- Größe ändern ----------
     Alle Wege (Anfasser im Becken, Regler und Knöpfe auf der Karte, Tasten + / −, Mausrad) laufen über V.resizeDeco. */
  V.resizeDeco = function (o, s) {
    const before = AA.decoScale(o);
    let now = AA.setDecoScale(o, s);
    const b = V.decoBox(o);
    if (b.on && b.y < G.top - 6 && now > 0.3) now = AA.setDecoScale(o, Math.floor(now * (b.by - (G.top - 6)) / b.h * 100) / 100);   // auf einer Plattform: nicht aus dem Wasser wachsen
    V.sizeT = V.time;
    if (now !== before) AA.emit('decoResized', o, now);
    return now;
  };
  /* Der runde Anfasser sitzt an der oberen rechten Ecke des Auswahlrahmens. Läge er dort unter der Karte (V.cardZone, meldet die
     Oberfläche), außerhalb des Bildes oder hinter der Leiste oben, weicht er aus: linke Ecke, sonst ein Stück tiefer bzw. an den
     Bildrand geschoben – greifbar bleibt er immer. */
  V.sizeHandle = function () {
    const o = V.selDeco;
    if (!o || (V.tool !== 'hand' && V.tool !== 'deco') || V.photoMode || !AA.decoRange(AA.DECO_BY[o.type])) return null;
    const b = V.decoAABB(o), p = 6, lift = o === V.dragDeco ? 10 : 0, cz = V.cardZone, top = 100;
    const hid = function (x, y) { return !!cz && x > cz.x0 - 22 && x < cz.x1 + 22 && y < cz.y1 + 22; };
    const bad = function (x, y) { return x < 22 || x > W - 22 || hid(x, y); };
    let y = Math.max(top, b.y - p - lift), x = b.x + b.w + p, side = 1;
    if (bad(x, y) && !bad(b.x - p, y)) { x = b.x - p; side = -1; }
    x = AA.clamp(x, 22, W - 22);
    if (hid(x, y)) y = Math.min(b.by - 12, cz.y1 + 26);
    return { x: x, y: AA.clamp(y, top, H - 96), side: side, r: 14 };
  };
  V.overSizeHandle = function (x, y, extra) { const hd = V.sizeHandle(); return hd && Math.hypot(x - hd.x, y - hd.y) <= hd.r + 8 + (extra || 0) ? hd : null; };      // extra: Fingerbreite (Runde 11)
  V.hitFish = function (x, y) {
    let best = null;
    for (let i = 0; i < V.fish.length; i++) { const f = V.fish[i]; if (!f.ghost && f.hit(x, y) && (!best || f.z >= best.z)) best = f; }
    return best;
  };
  V.hitFishNear = function (x, y, r) {               // Runde 11: der nächste Fisch, dessen Mitte höchstens r entfernt ist (Finger)
    let best = null, bd = r;
    for (let i = 0; i < V.fish.length; i++) { const f = V.fish[i]; if (f.ghost) continue; const d = Math.hypot(x - f.x, y - f.y) - f.size() * 0.3; if (d < bd) { bd = d; best = f; } }
    return best;
  };
  V.eggPos = function (e) { const sc = AA.depthScale(e.z); return { x: e.x, y: AA.floorY(e.z, e.x) - 16 * sc, r: 19 * sc }; };
  V.hitEgg = function (x, y) {
    const tank = AA.tank();
    for (let i = 0; i < tank.eggs.length; i++) { const p = V.eggPos(tank.eggs[i]); if (Math.hypot(x - p.x, y - p.y) < p.r * 1.8) return tank.eggs[i]; }
    return null;
  };
  /* Lieblingsplätze einer Art: Deko bestimmter Sorten (Clownfisch -> Anemonen) */
  V.homes = function (types) {
    const tank = AA.tank(), out = [];
    for (let i = 0; i < tank.deco.length; i++) { const o = tank.deco[i]; if (types.indexOf(o.type) < 0) continue; const b = V.decoBox(o); out.push({ x: b.cx, y: b.y + b.h * 0.25, z: Math.max(0.02, o.z - 0.02), w: b.w, id: o.id }); }
    return out;
  };
  V.hideouts = function () {
    const tank = AA.tank(), out = [];
    for (let i = 0; i < tank.deco.length; i++) {
      const o = tank.deco[i], def = AA.DECO_BY[o.type];
      if (!def.hide) continue;
      const b = V.decoBox(o);
      out.push({ x: b.cx + (o.flip ? -1 : 1) * def.hide[0] * b.w, y: b.by - def.hide[1] * b.h, z: Math.max(0.02, o.z - 0.03), fav: def.fav });
    }
    return out;
  };

  /* ---------- Fisch-Ansichten mit den Daten abgleichen ---------- */
  V.sync = function () {
    const tank = AA.tank(), seen = {};
    for (let i = 0; i < tank.fish.length; i++) {
      const d = tank.fish[i]; seen[d.id] = 1;
      if (!V.byId[d.id]) { const f = new AA.Fish(d); V.byId[d.id] = f; V.fish.push(f); }
    }
    for (let i = V.fish.length - 1; i >= 0; i--) {
      const f = V.fish[i];
      if ((!seen[f.d.id] && !f.ghost) || f.dead) {
        V.fish.splice(i, 1); delete V.byId[f.d.id];
        if (V.sel === f) V.select(null);
      }
    }
  };
  /* ---------- Becken-Größe im Raum (Runde 6) ----------
     Ein Becken steht als Ausschnitt k (AA.ZOOM je Ausbaustufe) auf der Bühne und wächst mit jedem Ausbau; das Meeresbecken füllt alles.
     Die Spielwelt bleibt 1280 × 720 – sie wird nur kleiner gezeichnet. Damit ein großes Becken wirklich mehr Platz bietet, sind Fische, Deko und Eier
     in kleinen Becken um sprK = 1/√k größer (bezogen auf die Welt): im kleinsten Becken nimmt ein Fisch also gut die Hälfte mehr Fläche ein. */
  V.kCur = 1; V.sprK = 1; V.txtK = 1; V.ox = 0; V.oy = 0; V.kTank = null;      // txtK: Maßstab für Schrift und Anzeigen (ohne die Verkleinerung des Meeresbeckens)
  V.zoomTarget = function () { const t = AA.tank(); return AA.wide(t) || window.AA_NOZOOM ? 1 : (AA.ZOOM[t.size] || 1); };      // AA_NOZOOM: Schalter für die alten automatischen Tests
  V.setZoom = function (k) { V.kCur = k; V.txtK = 1 / Math.sqrt(k); V.sprK = V.txtK * (AA.wide(AA.tank()) && !window.AA_NOZOOM ? AA.OCEAN_SPR : 1); V.ox = (W - W * k) / 2; V.oy = (H - H * k) * 0.5; };   // Meeresbecken: alles kleiner = riesig
  V.toWorld = function (x, y) { return { x: (x - V.ox) / V.kCur, y: (y - V.oy) / V.kCur }; };
  /* Runde 13: Wie weit nach vorn sieht man den Boden noch ganz? Unten liegt die Leiste (#hud-bottom) über dem Becken. Gibt [z0, z1] zurück:
     den vordersten Streifen, in dem ein Grundfisch noch komplett zu sehen ist (alle 3 Sekunden neu – Fenstergröße, Handy, Becken-Zoom). */
  V.frontBand = function () {
    if (V.fbCache && V.time - V.fbCache.t < 3 && V.time >= V.fbCache.t) return V.fbCache.v;
    let zMax = 0.95;
    try {
      const cv = document.getElementById('cv'), hb = document.getElementById('hud-bottom');
      if (cv && hb) {
        const r = cv.getBoundingClientRect(); let top = Infinity;
        for (let i = 0; i < hb.children.length; i++) { const q = hb.children[i].getBoundingClientRect(); if (q.height > 4 && q.width > 4) top = Math.min(top, q.top); }
        if (top < Infinity && r.height > 0) zMax = AA.clamp(AA.zFromY(V.toWorld(W / 2, (top - r.top) / r.height * H).y - 3), 0.5, 0.95);
      }
    } catch (e) { /* ohne Oberfläche: Standard */ }
    const v = [Math.max(0.42, zMax - 0.13), zMax];
    V.fbCache = { t: V.time, v: v };
    return v;
  };
  /* Runde 13: Welcher Anteil (0–1) eines Kastens am Boden (Mitte x, Tiefe z, Breite w, Höhe h) wird von Deko verdeckt, die davor steht? */
  V.coverAt = function (x, z, w, h) {
    const tank = AA.tank(), fy = AA.floorY(z, x), x0 = x - w / 2, x1 = x + w / 2, y0 = fy - h;
    let cov = 0;
    for (let i = 0; i < tank.deco.length; i++) {
      const o = tank.deco[i], d = AA.DECO_BY[o.type];
      if (!d || d.path || d.crawl || V.onGlass(o)) continue;
      if (o.z + (o.l || 0) < z - 0.02) continue;     // steht dahinter: der Fisch liegt davor
      const b = V.decoAABB(o), ix = Math.min(x1, b.x + b.w) - Math.max(x0, b.x), iy = Math.min(fy, b.by) - Math.max(y0, b.y);
      if (ix > 0 && iy > 0) cov += ix * iy / (w * h) * 0.85;      // der Kasten ist größer als das Bild: etwas weniger zählen
    }
    return Math.min(1, cov);
  };
  V.toStage = function (x, y) { return { x: V.ox + x * V.kCur, y: V.oy + y * V.kCur }; };
  V.rebuild = function () {
    V.fish = []; V.byId = {}; V.food = []; V.parts = []; V.texts = []; V.bubbles = []; V.rips = []; V.decoT = {}; V.crawl = {};
    V.live = []; V.service = {}; V.nestle = {}; V.schools = {}; V.wipe = null; V.shine = {};
    V.sel = null; V.selDeco = null; V.dragDeco = null; V.sizing = null; V.dropSpot = null;
    V.clearThumbs();
    V.sync();
    AA.emit('selection', null);
  };

  /* ---------- Krabbler: wandern von allein über den Kies ----------
     Sie sind als Deko gespeichert (Position x/z und Blickrichtung flip wandern einfach mit); hier steckt nur ihr Verhalten.
     Gangarten: snail = schiebt sich in Schüben, star/urchin = Zeitlupe, crab = kurze Sprints seitwärts, walk = stakst. */
  const ZPX = G.fy1 - G.fy0;                           // Tiefe 0…1 in Pixeln
  function crawlState(o) { return V.crawl[o.id] || (V.crawl[o.id] = { tx: o.x, tz: o.z, wait: AA.rand(0, 5), ph: Math.random() * TAU, v: 0, scan: AA.rand(0, 2), food: null, mode: 'floor' }); }
  /* Scheibe und Seitenwand: Schnecken, Seesterne und Seeigel (def.glass) kleben sich ab und zu an die Frontscheibe – dann sieht man sie von
     unten (Bild deco/<id>_glass, Kopf zeigt im Bild nach oben) und sie liegen vor allen Fischen. Schnecken klettern auch die linke oder
     rechte Seitenwand hoch (Seitenansicht, um 90° gedreht). c.gx/c.gy = Lage auf dem Glas, c.ax/c.ay = Ziel dort, c.legs = wie viele
     Etappen noch, danach geht es zurück auf den Kies. Gespeichert wird davon nichts: nach dem Laden sitzen alle wieder unten. */
  V.onGlass = function (o) { const c = V.crawl[o.id]; return c && c.mode !== 'floor' ? c : null; };
  function glassTarget(o, c) {
    if (c.mode === 'wall') { c.ax = c.gx; c.ay = AA.rand(G.top + 70, AA.floorY(o.z, c.gx) - 60); }
    else { c.ax = AA.clamp(c.gx + AA.rand(-280, 280), 60, W - 60); c.ay = AA.rand(G.top + 60, AA.floorY(1) - 70); }
  }
  function glassStep(o, def, c, dt) {
    const kind = def.crawl[0], night = !!AA.state.settings.night;
    if (o === V.dragDeco) { c.mode = 'floor'; c.tx = o.x; c.tz = o.z; c.wait = 1.5; c.v = 0; return; }   // angefasst: lässt los
    if (o === V.selDeco) { c.v = 0; return; }
    const dx = c.ax - c.gx, dy = c.ay - c.gy, dist = Math.hypot(dx, dy);
    if (dist < 3) {
      c.v = 0; c.wait -= dt;
      if (c.wait > 0) return;
      if (c.legs-- > 0) { glassTarget(o, c); c.wait = AA.rand(2, 8); }
      else if (!c.down) { c.down = true; c.ax = c.mode === 'wall' ? c.gx : AA.clamp(c.gx + AA.rand(-90, 90), 60, W - 60); c.ay = (c.mode === 'wall' ? AA.floorY(o.z) : AA.floorY(1)) - def.w * 0.2; }
      else {                                           // unten angekommen: wieder ein Bodentier
        const lim = AA.xLimits();
        o.x = AA.clamp(c.gx, lim[0] + 24, lim[1] - 24); if (c.mode === 'glass') o.z = 1;
        c.mode = 'floor'; c.down = false; c.tx = o.x; c.tz = o.z; c.wait = AA.rand(2, 6);
      }
      return;
    }
    let gait = 1;
    c.ang = Math.atan2(dy, dx);
    if (kind === 'snail') {
      gait = 0.3 + 0.7 * Math.max(0, Math.sin(c.ph * 2.4));
      if (c.mode === 'glass') {                            // Kopf dreht weich in die neue Richtung; gekrochen wird erst, wenn er ungefähr dorthin zeigt
        if (c.da == null) c.da = c.ang;
        let df = c.ang - c.da; df = Math.atan2(Math.sin(df), Math.cos(df));
        c.da += AA.clamp(df, -1.8 * dt, 1.8 * dt);
        if (Math.abs(df) > 0.5) gait = 0;
      }
    }
    const step = Math.min(dist, def.crawl[1] * 2.2 * (night ? 0.5 : 1) * gait * dt);
    c.gx += dx / dist * step; c.gy += dy / dist * step;
    c.v = dt > 0 ? step / dt : 0;
    if (c.mode === 'glass') o.x = AA.clamp(c.gx, 40, W - 40);
    if (step > 0 && def.job === 'glass') wipeAt(c.gx, c.gy);          // Scheibenputzer: frisst eine saubere Spur in die Algen
  }
  function crawlStep(o, def, dt) {
    const c = crawlState(o), kind = def.crawl[0];
    c.ph += dt;
    if (kind === 'glide') {                          // Runde 12: Scholle – Tempo und Flossenwelle weich nachführen (vorher sprang die Phase bei jedem Tempowechsel: Zittern)
      const mvRaw = Math.min(1, (c.v || 0) / (def.crawl[1] * 0.5 + 0.01));
      c.mvs = (c.mvs || 0) + (mvRaw - (c.mvs || 0)) * Math.min(1, dt * 1.2);
      c.gph = (c.gph || 0) + dt * (0.7 + 1.6 * c.mvs);
      if (def.zap && !V.photoMode) {                   // Runde 14: Zitterrochen – ab und zu ein kleiner Stromstoß (Funken und ein kurzes Zucken der Flossen)
        c.zapT = (c.zapT === undefined ? AA.rand(6, 20) : c.zapT) - dt;
        if (c.zapT <= 0) {
          c.zapT = AA.rand(18, 40); c.mvs = Math.min(1, c.mvs + 0.6);
          const b = V.decoBox(o);
          for (let i = 0; i < 7; i++) V.twinkle(o.x + AA.rand(-0.42, 0.42) * b.w, b.by - b.h * AA.rand(0.2, 0.9), i % 2 ? '#fff36a' : '#9ff4ff', AA.rand(8, 14));
          V.floatText(o.x, b.y - 10, '⚡', '#fff36a');
        }
      }
    }
    if (c.mode !== 'floor') { glassStep(o, def, c, dt); return; }
    if (o === V.dragDeco) { c.tx = o.x; c.tz = o.z; c.wait = 1.5; c.v = 0; c.food = null; c.climb = null; return; }      // wird gerade getragen
    if (o === V.selDeco) { c.v = 0; return; }                                                          // ausgewählt: hält still
    if (V.service[o.id] > V.time) { c.v = 0; c.wait = Math.max(c.wait, 1.5); return; }                 // Putzerstation: putzt gerade einen Fisch
    const night = !!AA.state.settings.night;
    let speed = def.crawl[1] * (night ? 0.5 : 1);
    if (def.eats) {                                    // Futterreste: nach liegen gebliebenen Flocken Ausschau halten
      c.scan -= dt;
      if (c.food && (c.food.eaten || V.food.indexOf(c.food) < 0)) c.food = null;
      if (!c.food && c.scan <= 0) {
        c.scan = 1.5; let bd = 460;
        for (let i = 0; i < V.food.length; i++) {
          const fl = V.food[i];
          if (fl.eaten || fl.landed < 5 || fl.claimed) continue;
          const dd = Math.hypot(fl.x - o.x, (fl.z - o.z) * ZPX);
          if (dd < bd) { bd = dd; c.food = fl; }
        }
        if (c.food) c.food.claimed = true;
      }
      if (c.food) { c.tx = c.food.x; c.tz = c.food.z; speed *= 1.7; }
    }
    const lim = AA.xLimits(), dx = c.tx - o.x, dz = (c.tz - o.z) * ZPX, dist = Math.hypot(dx, dz);
    if (dist < 3) {
      c.v = 0;
      if (c.food) { c.food.eaten = true; c.food = null; V.addBubble(o.x, AA.floorY(o.z, o.x) - 14, 2); c.wait = AA.rand(0.6, 1.6); return; }
      if (c.climb) {                                   // am Glas angekommen: hoch
        c.mode = c.climb; c.climb = null; c.down = false; c.legs = AA.randi(1, 3); c.wait = 0;
        c.gx = c.mode === 'wall' ? (o.x < W / 2 ? 15 : W - 15) : o.x; c.gy = AA.floorY(o.z, o.x) - def.w * 0.2;
        c.wallSide = o.x < W / 2 ? -1 : 1; c.ang = -Math.PI / 2; c.da = c.ang;
        glassTarget(o, c);
        return;
      }
      c.wait -= dt;
      if (c.wait <= 0 && def.glass && !night && AA.assets.get('deco/' + o.type + '_glass') && Math.random() < (V.glassLove === undefined ? 0.3 : V.glassLove)) {
        // Lust auf Glas: nach vorn an die Scheibe – Schnecken manchmal auch an die nähere Seitenwand
        if (kind === 'snail' && Math.random() < 0.3) { c.climb = 'wall'; c.tx = o.x < W / 2 ? lim[0] + 22 : lim[1] - 22; c.tz = o.z; }   // (weiter als lim ± 20 kommt kein Krabbler)
        else { c.climb = 'glass'; c.tx = AA.clamp(o.x + AA.rand(-80, 80), lim[0] + 50, lim[1] - 50); c.tz = 1; }
        c.wait = 0.4;
        return;
      }
      if (c.wait <= 0) {                               // neues Ziel in der Nähe; Seesterne und Seeigel trödeln länger
        const slow = kind === 'star' || kind === 'urchin' || kind === 'glide', far = kind === 'crab' ? 420 : (kind === 'glide' ? 120 : (slow ? 150 : 280));      // glide = Scholle: gleitet ein Stück, liegt dann lange still
        c.tx = AA.clamp(o.x + AA.rand(-far, far), lim[0] + 50, lim[1] - 50);
        c.tz = AA.clamp(o.z + AA.rand(-0.32, 0.32), 0.04, 1);
        c.wait = kind === 'glide' ? AA.rand(25, 70) : (slow ? AA.rand(4, 16) : AA.rand(1.2, 7));
      }
      return;
    }
    let gait = 1;
    if (kind === 'snail') gait = 0.3 + 0.7 * Math.max(0, Math.sin(c.ph * 2.4));
    else if (kind === 'crab') gait = Math.sin(c.ph * 1.3) > -0.25 ? 1 : 0;
    else if (kind === 'walk') gait = 0.55 + 0.45 * Math.abs(Math.sin(c.ph * 5));
    else if (kind === 'glide') gait = 0.9 + 0.1 * Math.sin(c.ph * 0.9);
    const step = Math.min(dist, speed * gait * dt);
    o.x = AA.clamp(o.x + dx / dist * step, lim[0] + 20, lim[1] - 20);
    o.z = AA.clamp(o.z + dz / dist * step / ZPX, 0.02, 1);
    c.v = dt > 0 ? step / dt : 0;
    if (!def.sym && Math.abs(dx) > 3) o.flip = dx < 0;
  }
  /* Krabbler zeichnen: Ursprung = unten Mitte (wie bei der Deko), schon gespiegelt */
  function drawCrawler(ctx, o, def, img, b) {
    const c = crawlState(o), kind = def.crawl[0], mv = Math.min(1, c.v / (def.crawl[1] * 0.5 + 0.01));
    if (kind === 'snail') { const q = Math.sin(c.ph * 2.4) * 0.055 * (0.25 + 0.75 * mv); ctx.scale(1 + q, 1 - q * 0.8); }
    else if (kind === 'star') { const q = Math.sin(c.ph * 0.9) * 0.02; ctx.translate(0, -b.h / 2); ctx.rotate(Math.sin(c.ph * 0.45) * 0.07); ctx.scale(1 + q, 1 + q); ctx.translate(0, b.h / 2); }
    else if (kind === 'urchin') { const q = Math.sin(c.ph * 1.7) * 0.022; ctx.scale(1 + q, 1 + q * 1.4); }
    else if (kind === 'crab') { ctx.translate(0, -Math.abs(Math.sin(c.ph * 12)) * 3.2 * mv); ctx.rotate(Math.sin(c.ph * 12) * 0.06 * mv + Math.sin(c.ph * 1.1) * 0.02); }
    else if (kind === 'glide') { const m = c.mvs || 0, q = Math.sin(c.gph || 0) * (0.004 + 0.009 * m); ctx.translate(0, -1.2 * m); ctx.scale(1 + q, 1 - q * 1.1); }      // Scholle: ganz sachte Flossenwelle, liegt sonst flach
    else { ctx.translate(0, -Math.abs(Math.sin(c.ph * 7)) * 2.4 * mv); ctx.rotate(Math.sin(c.ph * 7) * 0.04 * mv); }
    ctx.drawImage(img, -b.w / 2, -b.h, b.w, b.h);
  }

  /* ---------- Runde 8: wer im Becken welche Rolle hat (Schwarm-Anführer, Wirtsanemone der Clownfische, Putzerstationen, Pflanzen) ---------- */
  function lifeRoles(tank) {
    const by = {}, cnt = AA.schoolCounts(tank);
    for (let i = 0; i < V.fish.length; i++) {
      const f = V.fish[i]; f.isLeader = false; f.lonely = false;
      if (f.ghost) continue;
      if (f.def.school) { (by[f.d.sp] = by[f.d.sp] || []).push(f); f.lonely = (cnt[f.d.sp] || 0) < AA.SCHOOL.lonely; }
    }
    const old = V.schools; V.schools = {};
    for (const sp in by) {
      if (by[sp].length < AA.SCHOOL.min) continue;
      const list = by[sp].filter(function (f) { return f.d.adult || f.d.age > AA.FISH_BY[sp].grow * 0.25; });
      if (list.length < 2) continue;
      const prev = old[sp] && old[sp].leader, L = prev && list.indexOf(prev) >= 0 ? prev : list[0];
      L.isLeader = true;
      let k = 1; for (let i = 0; i < list.length; i++) if (list[i] !== L) list[i].schoolIdx = k++;
      V.schools[sp] = { leader: L, n: list.length, alarm: old[sp] ? old[sp].alarm : 0 };
      if (tank.hunt) V.schools[sp].alarm = V.time + 1;
    }
    const hosts = [], docs = [], plants = [];
    for (let i = 0; i < tank.deco.length; i++) {
      const o = tank.deco[i], d = AA.DECO_BY[o.type];
      if (d.host) hosts.push(o);
      else if (d.job === 'doctor' && !V.onGlass(o)) docs.push(o);
      else if (d.cat === 'plant' && d.sway && !d.crawl) plants.push(o);
    }
    V.doctors = docs; V.plants = plants;
    let ci = 0;
    for (let i = 0; i < V.fish.length; i++) {
      const f = V.fish[i];
      if (!f.def.home) continue;
      f.host = hosts.length ? hosts[Math.floor(ci / 2) % hosts.length] : null; ci++;      // je zwei Clownfische teilen sich eine Anemone
    }
  }
  /* Futterfische (Lebendfutter): zappeln umher, fliehen vor Räubern, verschwinden nach einer Weile */
  function updateLive(dt, t) {
    for (let i = V.live.length - 1; i >= 0; i--) {
      const lv = V.live[i];
      lv.t += dt;
      if (lv.eaten || lv.t > AA.FOOD2.live.life) { V.live.splice(i, 1); continue; }
      if (lv.y < G.top + 30) { lv.y += lv.vy * dt; continue; }   // plumpst erst ins Wasser
      lv.turn -= dt;
      let fx = 0, fy = 0;
      for (let k = 0; k < V.fish.length; k++) {
        const f = V.fish[k]; if (!f.def.pred) continue;
        const dx = lv.x - f.x, dy = lv.y - f.y, dd = Math.hypot(dx, dy);
        if (dd < 170) { fx += dx / (dd + 1) * (170 - dd); fy += dy / (dd + 1) * (170 - dd); }
      }
      if (fx || fy) { const m = Math.hypot(fx, fy) || 1; lv.vx += (fx / m * 150 - lv.vx) * Math.min(1, dt * 5); lv.vy += (fy / m * 90 - lv.vy) * Math.min(1, dt * 5); }
      else if (lv.turn <= 0) { lv.turn = AA.rand(0.5, 1.6); const a = Math.random() * TAU; lv.vx = Math.cos(a) * AA.rand(30, 70); lv.vy = Math.sin(a) * AA.rand(15, 35); }
      lv.x += lv.vx * dt; lv.y += lv.vy * dt;
      if (lv.x < 50 || lv.x > W - 50) { lv.vx *= -1; lv.x = AA.clamp(lv.x, 50, W - 50); }
      const bot = AA.floorY(lv.z, lv.x) - 12;
      if (lv.y < G.top + 30) { lv.y = G.top + 30; lv.vy = Math.abs(lv.vy); } else if (lv.y > bot) { lv.y = bot; lv.vy = -Math.abs(lv.vy); }
    }
  }
  function drawLive(ctx, t) {
    for (let i = 0; i < V.live.length; i++) {
      const lv = V.live[i], sc = AA.depthScale(lv.z) * 1.1, a = lv.t > AA.FOOD2.live.life - 4 ? Math.max(0, (AA.FOOD2.live.life - lv.t) / 4) : 1;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(lv.x, lv.y); ctx.scale((lv.vx < 0 ? -1 : 1) * sc, sc);
      const w = Math.sin(t * 18 + lv.ph) * 2.2;
      ctx.fillStyle = '#9fb3c4'; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-16, -5 + w); ctx.lineTo(-16, 5 + w); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#dfe9f2'; ctx.beginPath(); ctx.ellipse(0, 0, 11, 4.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7f95a8'; ctx.beginPath(); ctx.ellipse(0, -1.8, 9, 1.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#16243a'; ctx.beginPath(); ctx.arc(6.5, -0.8, 1.6, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  /* ---------- Update ---------- */
  V.update = function (dt) {
    V.time += dt;
    const t = V.time, tank = AA.tank();
    const kt = V.zoomTarget();                        // Becken wächst weich auf seine neue Größe
    if (V.kTank !== tank.id) { V.kTank = tank.id; V.setZoom(kt); }
    else if (Math.abs(kt - V.kCur) > 0.0008) V.setZoom(V.kCur + (kt - V.kCur) * Math.min(1, dt * 1.6));
    else if (V.kCur !== kt) V.setZoom(kt);
    V.sync();
    lifeRoles(tank);
    // Futter
    let rot = 0;
    for (let i = V.food.length - 1; i >= 0; i--) {
      const fl = V.food[i];
      if (fl.eaten) { V.food.splice(i, 1); continue; }
      if (!fl.landed) {
        fl.y += fl.vy * dt; fl.x += Math.sin(t * 2.2 + fl.ph) * 14 * dt; fl.rot += dt * 1.5;
        if (fl.y >= AA.floorY(fl.z, fl.x) - 3) { fl.y = AA.floorY(fl.z, fl.x) - 3; fl.landed = 0.001; }
      } else { fl.landed += dt; if (fl.landed > 26) { V.food.splice(i, 1); if (!fl.kind) rot++; } }   // liegen geblieben: fault (Putzkolonne, js/life.js)
    }
    if (rot) AA.rotFood(tank, rot);
    updateLive(dt, t);
    for (let i = 0; i < V.fish.length; i++) V.fish[i].update(dt, V, tank);
    // Blasen
    V.bubT -= dt;
    if (V.bubT <= 0) { V.bubT = AA.rand(0.5, 1.7); const z = Math.random(), bx = AA.rand(40, W - 40); V.addBubble(bx, AA.floorY(z, bx) - 6, AA.rand(1.5, 3.6)); }
    for (let i = 0; i < tank.deco.length; i++) {
      const o = tank.deco[i], def = AA.DECO_BY[o.type];
      if (!def.bubbles) continue;
      V.decoT[o.id] = (V.decoT[o.id] === undefined ? Math.random() * def.bubbles[2] : V.decoT[o.id]) - dt;
      if (V.decoT[o.id] <= 0) {
        V.decoT[o.id] = AA.rand(0.5, 1.5) * def.bubbles[2];
        const b = V.decoBox(o);
        V.addBubble(o.x + (o.flip ? -1 : 1) * (def.bubbles[0] - 0.5) * b.w + AA.rand(-8, 8), b.by - def.bubbles[1] * b.h, AA.rand(2, 5.5) * b.sc);
      }
    }
    V.syncStack();
    for (let i = 0; i < tank.deco.length; i++) {
      const o = tank.deco[i], def = AA.DECO_BY[o.type];
      if (def.crawl) crawlStep(o, def, dt);
      else if (def.prestige) {                         // Prestige-Stücke funkeln
        V.shine[o.id] = (V.shine[o.id] === undefined ? Math.random() : V.shine[o.id]) - dt;
        if (V.shine[o.id] <= 0) { V.shine[o.id] = AA.rand(0.35, 1.1); const b = V.decoBox(o); V.twinkle(b.x + AA.rand(0.12, 0.88) * b.w, b.y + AA.rand(0.08, 0.8) * b.h, Math.random() < 0.7 ? '#fff3b0' : '#ffffff', AA.rand(8, 15) * b.sc); }
      }
    }
    for (let i = V.bubbles.length - 1; i >= 0; i--) {
      const b = V.bubbles[i];
      b.y -= b.vy * dt * (0.7 + b.r * 0.12); b.x += Math.sin(t * 3.1 + b.ph) * 12 * dt;
      if (b.y < -12) V.bubbles.splice(i, 1);
    }
    for (let i = V.parts.length - 1; i >= 0; i--) {
      const p = V.parts[i];
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind !== 'twinkle') p.vy += (p.g || 26) * dt; p.vx *= (1 - 1.2 * dt);
      if (p.life >= p.max) V.parts.splice(i, 1);
    }
    for (let i = V.texts.length - 1; i >= 0; i--) { const x = V.texts[i]; x.life += dt; x.y -= 34 * dt; if (x.life > 1.7) V.texts.splice(i, 1); }
    for (let i = V.rips.length - 1; i >= 0; i--) { V.rips[i].life += dt; if (V.rips[i].life > 0.75) V.rips.splice(i, 1); }
    if (V.wipe) { let any = false; for (let i = 0; i < V.wipe.length; i++) if (V.wipe[i] > 0) { V.wipe[i] = Math.max(0, V.wipe[i] - dt / 240); any = true; } if (any) wipeN += dt * 2; }
    if (!V.plank.length) for (let i = 0; i < 30; i++) V.plank.push({ x: Math.random() * W, y: AA.rand(G.top, G.fTop), s: AA.rand(1, 2.4), ph: Math.random() * TAU, v: AA.rand(4, 12) });
    if (tank.deep) for (let i = 0; i < V.plank.length; i++) { const p = V.plank[i]; p.y += p.v * 1.5 * dt; p.x += Math.sin(t * 0.5 + p.ph) * 5 * dt; if (p.y > G.fTop + 30) { p.y = G.top - 4; p.x = Math.random() * W; } }      // Meeresschnee
    else for (let i = 0; i < V.plank.length; i++) { const p = V.plank[i]; p.x += p.v * dt; p.y += Math.sin(t * 0.7 + p.ph) * 4 * dt; if (p.x > W + 5) p.x = -5; }
  };

  /* ---------- Render ---------- */
  function drawRays(ctx, t, night, ray) {
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const x = 180 + i * 240 + Math.sin(t * 0.22 + i * 1.7) * 44, w = 70 + (i % 3) * 36;
      const a = (0.10 + 0.05 * Math.sin(t * 0.5 + i * 2.1)) * (night ? 0.25 : 1);
      const g = ctx.createLinearGradient(0, 0, 0, 560);
      g.addColorStop(0, 'rgba(' + ray + ',' + (a * 1.6).toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + ray + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w - 150, 580); ctx.lineTo(x - 200, 580); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function sparkle(ctx, x, y, s, a, col) {
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col || '#fffbe0';
    ctx.beginPath();
    ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s);
    ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill();
    ctx.restore();
  }
  function isAbove(o, P) { let n = 0; while (o && o.on && n++ < 4) { o = V.decoById(o.on); if (o === P) return true; } return false; }
  /* Krabbler auf Glas: Schnecken zeigen mit dem Kopf in Kriechrichtung (drehen weich um). Seesterne und Seeigel haben kein Vorn und
     drehen sich NIE – jedes Tier hat seine eigene, feste Schräglage (aus der id). An der Seitenwand: Seitenansicht, Fuß zur Wand. */
  function fixedTilt(o) { let h = 0; const s = String(o.id); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return ((Math.abs(h) % 1000) / 1000 - 0.5) * 0.9; }
  function drawGlassCrawlers(ctx, t) {
    const d = AA.tank().deco;
    for (let i = 0; i < d.length; i++) {
      const o = d[i], c = V.onGlass(o);
      if (!c) continue;
      const def = AA.DECO_BY[o.type], kind = def.crawl[0], b = V.decoBox(o), wall = c.mode === 'wall';
      const img = wall ? V.decoImg(o) : AA.assets.get('deco/' + o.type + '_glass');
      if (!img) continue;
      const w = def.w * b.sc, h = w * img.height / img.width, mv = Math.min(1, c.v / (def.crawl[1] + 0.01));
      ctx.save();
      ctx.translate(c.gx, c.gy);
      if (wall) {
        const up = Math.sin(c.ang) < 0, s = c.wallSide;
        ctx.rotate(s < 0 ? Math.PI / 2 : -Math.PI / 2);
        if (kind === 'snail' && (s < 0) === up) ctx.scale(-1, 1);       // nur die Schnecke hat ein Vorn und wendet; Seestern und Seeigel kippen nie um
        const q = Math.sin(c.ph * 2.4) * 0.05 * (0.25 + 0.75 * mv) * (kind === 'snail' ? 1 : 0.4); ctx.scale(1 + q, 1 - q * 0.8);
        ctx.drawImage(img, -w / 2, -h, w, h);
      } else {
        ctx.fillStyle = 'rgba(20,40,60,0.13)'; ctx.beginPath(); ctx.ellipse(3, 5, w * 0.46, h * 0.46, 0, 0, TAU); ctx.fill();
        if (kind === 'snail') { ctx.rotate((c.da == null ? c.ang : c.da) + Math.PI / 2); const q = Math.sin(c.ph * 2.4) * 0.05 * (0.25 + 0.75 * mv); ctx.scale(1 - q * 0.6, 1 + q); }
        else { ctx.rotate(fixedTilt(o)); const q = Math.sin(c.ph * 1.3) * 0.02; ctx.scale(1 + q, 1 + q); }
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      }
      ctx.restore();
      if (o === V.selDeco && !V.photoMode) {
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 20;
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12, 12); else ctx.rect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
        ctx.stroke(); ctx.restore();
      }
    }
  }
  /* ---------- Runde 12 (Korrektur 18:16): Sand-Wellen am Fuß – der Kies wölbt sich nur AM Stück, nie daneben ----------
     Nach dem Stück gezeichnet und mit seinem eigenen Umriss maskiert: Sand liegt nur auf den Pixeln des Stücks. Entlang der Unterkante
     steigt er in unregelmäßigen Wellen hoch (mal Buckel, mal Mulde – als wäre das Stück verschieden tief eingesunken) und läuft dort,
     wo der Fuß aufhört, auf die Bodenlinie aus. Neben dem Stück bleibt der Boden flach.
     Muster je Stück fest (aus der id); Höhe und Zahl der Wellen wachsen mit der Breite des Fußes (Größe, Tiefe, Beckengröße). */
  function hashOf(o) { let h = 2166136261; const s = String(o.id); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  function prng(seed) {                                    // mulberry32: kleine, feste Zufallsfolge je Stück
    let a = seed | 0;
    return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function sstep(e0, e1, x) { const u = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return u * u * (3 - 2 * u); }
  function sandTex(ctx, x0, y0, x1, y1, up) {              // Kies-Muster aus der Szene (mit den Wegen darauf), um `up` Pixel nach oben versetzt
    x0 = Math.max(0, Math.floor(x0)); x1 = Math.min(W, Math.ceil(x1)); y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(H - up, Math.ceil(y1));
    if (x1 - x0 < 1 || y1 - y0 < 1) return;
    ctx.drawImage(curGround || sceneCv, x0 * SS, (y0 + up) * SS, (x1 - x0) * SS, (y1 - y0) * SS, x0, y0, x1 - x0, y1 - y0);
  }
  /* Farbe der Kies-Kante (die feine dunklere Linie oben am Boden-Bild) – damit die Wellen genauso eingefasst sind wie der Boden selbst */
  const edgeCol = {};
  function floorEdge(id) {
    if (edgeCol[id]) return edgeCol[id];
    const im = AA.assets.get('floor/' + id);
    if (!im) return 'rgba(90,70,50,0.35)';
    try {
      const c = mk(im.width, 40), g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, im.width, 40).data; let r = 0, gg = 0, bb = 0, n = 0;
      for (let x = Math.floor(im.width * 0.15); x < im.width * 0.85; x += 3) for (let y = 0; y < 40; y++) {
        const p = (y * im.width + x) * 4;
        if (d[p + 3] > 200) { r += d[p]; gg += d[p + 1]; bb += d[p + 2]; n++; break; }
      }
      edgeCol[id] = n ? 'rgb(' + Math.round(r / n * 0.86) + ',' + Math.round(gg / n * 0.86) + ',' + Math.round(bb / n * 0.86) + ')' : 'rgba(90,70,50,0.35)';
    } catch (e) { edgeCol[id] = 'rgba(90,70,50,0.35)'; }
    return edgeCol[id];
  }
  /* Wo steht das Stück auf dem Boden? Spalten, die in einer der Zeilen knapp über der Bodenlinie deckend sind; kleine Lücken
     (zwischen Stängeln, zwischen Kieseln) zählen mit, damit ein Büschel eine gemeinsame Welle bekommt */
  function footRuns(d, cw, ch, rows, k, x0) {
    const runs = [], gapMax = Math.round(6 * k);
    let a = -1, last = -1;
    for (let x = 0; x < cw; x++) {
      let on = false;
      for (let i = 0; i < rows.length && !on; i++) { const r = rows[i]; if (r >= 0 && r < ch && d[(r * cw + x) * 4 + 3] > 110) on = true; }
      if (!on) continue;
      if (a < 0) a = x; else if (x - last > gapMax) { runs.push([a, last]); a = x; }
      last = x;
    }
    if (a >= 0) runs.push([a, last]);
    return runs.map(function (r) { return [x0 + r[0] / k, x0 + (r[1] + 1) / k]; }).filter(function (r) { return r[1] - r[0] >= 2.5; });
  }
  function buildFoot(o, def, b, im) {
    const A = o.r ? V.decoAABB(o) : b, fl = b.by - (def.sink || 0) * b.sc;          // fl = Bodenlinie am Fuß
    const cap = Math.min(30, Math.max(8, b.w * 0.18));                                  // höchste mögliche Welle (für den Rahmen)
    const x0 = Math.floor(A.x) - 2, x1 = Math.ceil(A.x + A.w) + 2, y0 = Math.floor(fl - cap - 16), y1 = Math.ceil(Math.max(A.by, b.by) + 3);
    const k = Math.min(3, Math.max(1, V.res || 2)), cw = Math.max(1, Math.round((x1 - x0) * k)), ch = Math.max(1, Math.round((y1 - y0) * k));
    // 1) Umriss des Stücks (genau wie es gleich im Becken steht: Größe, Drehung, Spiegelung)
    const sil = mk(cw, ch), sg = sil.getContext('2d', { willReadFrequently: true });
    sg.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    sg.translate(b.cx, b.by); if (o.r) sg.rotate(o.r * Math.PI / 180); if (o.flip) sg.scale(-1, 1);
    sg.drawImage(im, -b.w / 2, -b.h, b.w, b.h);
    // 2) Fuß finden: erst knapp über der Bodenlinie, sonst ein Stück höher (Bild endet über dem Kies)
    let d = null, runs = [];
    try { d = sg.getImageData(0, 0, cw, ch).data; } catch (e) { d = null; }
    if (d) for (let up = 1; up <= 13 && !runs.length; up += 2) runs = footRuns(d, cw, ch, [0, 1, 2, 3].map(function (i) { return Math.round((fl - up - i - y0) * k); }), k, x0);
    else runs = [[b.cx - b.w * 0.4, b.cx + b.w * 0.4]];
    if (!runs.length) return { cv: null };
    // 3) Wellen je Fuß-Abschnitt: ein paar runde Buckel (zufällig verteilt, verschieden breit und hoch) auf einem flachen Sockel –
    //    dazwischen weiche Mulden. Zahl und Höhe wachsen mit der Breite; manche Stücke sind einseitig angeweht.
    const R = prng(hashOf(o)), drift = R() < 0.35 ? (R() < 0.5 ? 1 : -1) : 0;
    let maxH = 0;
    const crest = runs.map(function (r) {
      const span = r[1] - r[0];
      const hm = Math.max(1.2, Math.min(cap - 2, b.h * 0.12, Math.max(1.5, Math.min(8, span * 0.045)) * (0.85 + 0.3 * R())));     // dezent (Damian 18:53: „nur minimal“)
      const nb = Math.max(1, Math.min(6, Math.round(span / (52 + 30 * R())))), base = 0.1 + 0.14 * R(), tw = Math.max(2, Math.min(16, span * 0.2));
      const B = [];
      for (let i = 0; i < nb; i++) B.push({ c: (i + 0.5 + (R() - 0.5) * 0.6) / nb, s: (0.32 + 0.3 * R()) / nb, a: 0.55 + 0.45 * R() });
      maxH = Math.max(maxH, hm);
      const pts = [], n = Math.max(2, Math.ceil(span));
      for (let i = 0; i <= n; i++) {
        const x = r[0] + span * i / n, t = i / n;
        let v = 0;
        for (let j = 0; j < nb; j++) { const z = (t - B[j].c) / B[j].s; v = Math.max(v, B[j].a * Math.exp(-0.5 * z * z)); }
        let q = base + (1 - base) * v;
        if (drift) q *= 0.6 + 0.4 * (drift > 0 ? t : 1 - t) * 1.6;
        pts.push({ x: x, y: fl - hm * Math.min(1, q) * sstep(0, tw, x - r[0]) * sstep(0, tw, r[1] - x) });
      }
      return pts;
    });
    // 4) Sand malen – in einem Stück (keine Naht an der Bodenlinie): genau der Kies, der an dieser Stelle liegt. Unter der Bodenlinie
    //    (versenkter Teil) nahtlos wie der Boden daneben, samt Schatten; nach oben in die Buckel hinein wird der Schatten ausgeblendet.
    const lay = mk(cw, ch), g = lay.getContext('2d');
    g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    g.save(); g.beginPath();
    g.rect(x0, fl - 0.5, x1 - x0, y1 - fl + 0.5);
    crest.forEach(function (P) { g.moveTo(P[0].x, fl + 1); P.forEach(function (p) { g.lineTo(p.x, p.y); }); g.lineTo(P[P.length - 1].x, fl + 1); g.closePath(); });
    g.clip();
    sandTex(g, x0, fl - maxH - 2, x1, y1, 0);
    const sg2 = g.createLinearGradient(0, fl - maxH, 0, fl);
    sg2.addColorStop(0, 'rgba(40,30,50,0)'); sg2.addColorStop(1, 'rgba(40,30,50,0.16)'); g.fillStyle = sg2;      // unterhalb von fl bleibt 0.16
    g.beginPath(); g.ellipse(b.cx, b.by - 4 * b.sc, b.w * 0.46, Math.max(4, b.w * 0.055), 0, 0, TAU); g.fill();
    g.restore();
    // 5) Kanten: Stück knapp über dem Sand etwas dunkler (eingesunken) und eine feine Kante in der Kantenfarbe des Bodens
    const crestPath = function (dy) { g.beginPath(); crest.forEach(function (P) { P.forEach(function (p, i) { if (i) g.lineTo(p.x, p.y + dy); else g.moveTo(p.x, p.y + dy); }); }); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 1; i <= 2; i++) { crestPath(-i * 0.9); g.strokeStyle = 'rgba(45,30,22,' + (0.06 - i * 0.02).toFixed(3) + ')'; g.lineWidth = 1.3; g.stroke(); }
    crestPath(0); g.strokeStyle = floorEdge(AA.tank().floor); g.globalAlpha = 0.4; g.lineWidth = Math.max(1, 1.1 * V.texScale()); g.stroke(); g.globalAlpha = 1;
    // 6) Maske: über der Bodenlinie genau der Umriss (nichts ragt hinaus), darunter 1 Pixel breiter (deckt den weichen Rand des Bildes)
    const msk = mk(cw, ch), mg = msk.getContext('2d');
    mg.drawImage(sil, 0, 0);
    const fy = Math.max(0, Math.round((fl - y0) * k));
    mg.save(); mg.beginPath(); mg.rect(0, fy, cw, ch - fy); mg.clip();
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) mg.drawImage(sil, dx * k, dy * k);
    mg.restore();
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in'; g.drawImage(msk, 0, 0); g.globalCompositeOperation = 'source-over';
    return { cv: lay, x: x0, y: y0, w: cw / k, h: ch / k };
  }
  /* einmal je Stück gemalt und dann nur noch kopiert; neu, wenn sich Lage, Größe, Drehung, Bild, Kies oder Kulisse ändern */
  const footCache = new Map();
  function cachedFoot(ctx, o, def, b, im) {
    const key = groundKey + '|' + Math.round(b.cx * 2) + '|' + Math.round(b.by * 2) + '|' + Math.round(b.w * 4) + '|' + o.type + '|' + (o.flip ? 1 : 0) + '|' + (o.r || 0) + '|' + im.width + '|' + (V.res || 2);
    let c = footCache.get(o.id);
    if (!c || c.key !== key) {
      c = buildFoot(o, def, b, im); c.key = key;
      footCache.set(o.id, c);
      if (footCache.size > 260) footCache.delete(footCache.keys().next().value);
    }
    if (c.cv) ctx.drawImage(c.cv, c.x, c.y, c.w, c.h);
  }
  /* ---------- Runde 13: Wege – Deko, die flach im Kies liegt (def.path; NICHT def.flat – das trägt die Scholle) ----------
     Das Bild ist von oben gemalt und auf den Blickwinkel des Bodens gestaucht (tools: prep13.py). Es liegt UNTER allem anderen (Deko, Fische,
     Eier, Schatten) und folgt der Boden-Form: in schmalen senkrechten Streifen, jeder um die Hügel-Höhe an seiner Stelle versetzt.
     Alle Wege eines Beckens werden einmal mit der Szene zu einem Boden-Bild verschmolzen (groundCv); neu, wenn sich ein Weg ändert.
     Den Weg, der gerade gezogen wird, malt renderWorld frei darüber. */
  function flatImg(o, def, b) {
    const img = V.decoImg(o);
    if (!img) return null;
    const hd = b.w * (V.res || 2) > img.width * 1.08 ? AA.assets.get('hd/' + o.type) : null;
    let im = hd || img;
    if (o.c && AA.tinted) im = AA.tinted(im, (hd ? 'hd/' : 'deco/') + o.type, o.c) || im;
    return im;
  }
  function drawFlat(ctx, o, def, b) {
    const im = flatImg(o, def, b);
    if (!im) return;
    const N = Math.max(1, Math.ceil(b.w / 10)), iw = im.width, ih = im.height, l0 = AA.lift(b.cx);
    for (let i = 0; i < N; i++) {
      const u0 = i / N, u1 = (i + 1) / N, x0 = b.x + u0 * b.w, x1 = b.x + u1 * b.w;
      const dy = l0 - AA.lift((x0 + x1) / 2), su0 = o.flip ? 1 - u1 : u0, su1 = o.flip ? 1 - u0 : u1;
      const sx = su0 * iw, sw = Math.max(1, (su1 - su0) * iw);
      if (o.flip) { ctx.save(); ctx.translate((x0 + x1) / 2, 0); ctx.scale(-1, 1); ctx.drawImage(im, sx, 0, sw, ih, -(x1 - x0) / 2 - 0.3, b.y + dy, x1 - x0 + 0.6, b.h); ctx.restore(); }
      else ctx.drawImage(im, sx, 0, sw, ih, x0 - 0.3, b.y + dy, x1 - x0 + 0.6, b.h);
    }
  }
  function flatList(tank) {
    const L = [];
    for (let i = 0; i < tank.deco.length; i++) { const o = tank.deco[i], d = AA.DECO_BY[o.type]; if (d && d.path && !d.crawl) L.push(o); }
    return L.sort(function (a, b) { return (a.z + (a.l || 0)) - (b.z + (b.l || 0)); });
  }
  function groundCanvas(tank, flats) {
    const keep = flats.filter(function (o) { return o !== V.dragDeco; });
    if (!keep.length || !sceneKey) { groundKey = sceneKey + '|-'; return sceneCv; }
    const key = sceneKey + '|' + keep.map(function (o) { return o.id + ':' + o.type + ':' + Math.round(o.x) + ':' + Math.round(o.z * 1000) + ':' + AA.decoScale(o) + ':' + (o.flip ? 1 : 0) + ':' + (o.c || '') + ':' + (o.l || 0); }).join(',');
    if (groundKey === key && groundCv) return groundCv;
    if (!groundCv) groundCv = mk(W * SS, H * SS);
    const g = groundCv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W * SS, H * SS); g.drawImage(sceneCv, 0, 0);
    g.setTransform(SS, 0, 0, SS, 0, 0);
    let ok = true;
    keep.forEach(function (o) { const def = AA.DECO_BY[o.type], b = V.decoBox(o); if (!V.decoImg(o)) ok = false; drawFlat(g, o, def, b); });
    groundKey = ok ? key : '';                         // fehlt noch ein Bild: beim nächsten Bild noch einmal
    return groundCv;
  }
  function drawSel(ctx, o, b, t, lift) {             // gestrichelter Rahmen um das ausgewählte Stück
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 20;
    const p = 6; ctx.beginPath();
    ctx.translate(b.cx, b.by - lift); if (o.r) ctx.rotate(o.r * Math.PI / 180);
    if (ctx.roundRect) ctx.roundRect(-b.w / 2 - p, -b.h - p, b.w + p * 2, b.h + p * 2, 12); else ctx.rect(-b.w / 2 - p, -b.h - p, b.w + p * 2, b.h + p * 2);
    ctx.stroke(); ctx.restore();
  }
  function drawDeco(ctx, o, t) {
    if (V.onGlass(o)) return;                          // klebt am Glas: wird später über allem gezeichnet
    const def = AA.DECO_BY[o.type], img = V.decoImg(o), b = V.decoBox(o);
    const lift = (V.dragDeco && (o === V.dragDeco || (b.on && V.stackRoot(o) === V.stackRoot(V.dragDeco) && V.dragDeco !== o && isAbove(o, V.dragDeco)))) ? 10 : 0;
    const foot = def.sink && !def.crawl && !b.on && !lift && sceneCv && !def.nomound && AA.state.settings.mounds !== false;     // Sand-Wellen am Fuß (Schalter: settings.mounds)
    ctx.fillStyle = 'rgba(40,30,50,' + (b.on ? 0.22 : 0.16) + ')';
    ctx.beginPath(); ctx.ellipse(b.cx, b.by - (b.on ? 1 : 4) * b.sc, b.w * ((b.on ? 0.34 : 0.46) - lift * 0.004), Math.max(b.on ? 2.5 : 4, b.w * (b.on ? 0.035 : 0.055)), 0, 0, TAU); ctx.fill();
    ctx.save();
    ctx.translate(b.cx, b.by - lift);
    if (o.r) ctx.rotate(o.r * Math.PI / 180);          // Runde 10: gedreht um den Fuß (positiv = lehnt nach rechts, egal ob gespiegelt)
    if (o.flip) ctx.scale(-1, 1);
    if (def.alive) { const br = Math.sin(t * 1.7 + o.x * 0.01); ctx.scale(1 - br * 0.012, 1 + br * 0.025); }
    // groß gezogen? Dann die große Fassung des Bildes nehmen (hd/<id>), sonst würde es unscharf – gleiche Form, nur mehr Pixel
    const hd = img && b.w * (V.res || 2) > img.width * 1.08 ? AA.assets.get('hd/' + o.type) : null;
    let im = hd || img;
    if (o.c && im && AA.tinted) im = AA.tinted(im, (hd ? 'hd/' : 'deco/') + o.type, o.c) || im;      // Runde 10: Deko-Farbe
    if (!img) { ctx.fillStyle = '#8a6a4a'; ctx.fillRect(-b.w / 2, -b.h, b.w, b.h); }
    else if (def.crawl) drawCrawler(ctx, o, def, img, b);
    else if (def.sway) AA.drawSway(ctx, im, b.w, b.h, t, def.sway * (V.nestle[o.id] > t ? 2.4 : 1), (o.x * 0.013) % TAU);
    else ctx.drawImage(im, -b.w / 2, -b.h, b.w, b.h);
    ctx.restore();
    // Sockel im Kies versenken: Runde 12 – Sand-Wellen nur auf dem Stück selbst (siehe buildFoot); sonst wie früher die Szene über den Rand
    if (foot && img) cachedFoot(ctx, o, def, b, im);
    else if (def.sink && !lift && !b.on && sceneCv) {
      ctx.save();
      const rx = b.w * 0.55, ry = def.sink * b.sc * 1.05;
      ctx.beginPath(); ctx.ellipse(o.x, b.by + 1, rx, ry, 0, 0, TAU); ctx.clip();
      const dx0 = Math.max(0, o.x - rx - 1), dy0 = Math.max(0, b.by - ry), dw = Math.min(W, o.x + rx + 1) - dx0, dh = Math.min(H, b.by + ry + 2) - dy0;
      if (dw > 0 && dh > 0) ctx.drawImage(curGround || sceneCv, dx0 * SS, dy0 * SS, dw * SS, dh * SS, dx0, dy0, dw, dh);
      ctx.restore();
    }
    if (def.daily && !V.photoMode && AA.state.active === 0 && AA.chestInfo().ready) {     // Schatzkiste / Muschel: heute noch nicht geleert
      const k = t * 2.2;
      sparkle(ctx, o.x - b.w * 0.34, b.y + b.h * 0.2 + Math.sin(k) * 3, 9 * b.sc, 0.55 + 0.45 * Math.sin(k * 2.1));
      sparkle(ctx, o.x + b.w * 0.36, b.y + b.h * 0.34 + Math.cos(k * 0.9) * 3, 7 * b.sc, 0.55 + 0.45 * Math.sin(k * 1.7 + 2));
      sparkle(ctx, o.x + b.w * 0.05, b.y - 6 + Math.sin(k * 1.3) * 3, 6 * b.sc, 0.55 + 0.45 * Math.sin(k * 2.6 + 4));
    }
    if (o === V.selDeco && !V.photoMode) drawSel(ctx, o, b, t, lift);
  }

  /* Anfasser zum Größe-Ziehen und Prozent-Schildchen – liegen über allem, damit kein Fisch sie verdeckt */
  function drawSizeHandle(ctx) {
    const hd = V.sizeHandle();
    if (!hd) return;
    const o = V.selDeco, P = V.pointer, hot = V.sizing === o || (P.inside && Math.hypot(P.x - hd.x, P.y - hd.y) <= hd.r + 8);
    ctx.save();
    ctx.translate(hd.x, hd.y);
    ctx.shadowColor = 'rgba(0,30,50,0.4)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.fillStyle = hot ? '#ffe36e' : '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, hd.r * (hot ? 1.12 : 1), 0, TAU); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = '#0b3a57'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.rotate(hd.side > 0 ? -Math.PI / 4 : Math.PI / 4);                  // Doppelpfeil schräg nach außen
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-7, 0); ctx.lineTo(7, 0);
    ctx.moveTo(3.2, -3.8); ctx.lineTo(7, 0); ctx.lineTo(3.2, 3.8);
    ctx.moveTo(-3.2, -3.8); ctx.lineTo(-7, 0); ctx.lineTo(-3.2, 3.8);
    ctx.stroke();
    ctx.restore();
    if (V.sizing !== o && V.time - V.sizeT > 1.2) return;
    const s = AA.decoScale(o), r = AA.decoRange(AA.DECO_BY[o.type]), end = s <= r[0] + 0.001 || s >= r[1] - 0.001;
    const txt = Math.round(s * 100) + ' %' + (s >= r[1] - 0.001 ? ' · größer geht nicht' : (s <= r[0] + 0.001 ? ' · kleiner geht nicht' : ''));
    ctx.save();
    ctx.font = '800 15px ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(txt).width + 20, th = 26;
    const cx = AA.clamp(hd.x, tw / 2 + 8, W - tw / 2 - 8), cy = hd.y - hd.r - 20 < 96 ? hd.y + hd.r + 20 : hd.y - hd.r - 20;     // unter der Leiste oben: Schildchen nach unten
    ctx.globalAlpha = V.sizing === o ? 1 : Math.min(1, (1.2 - (V.time - V.sizeT)) / 0.3);
    ctx.fillStyle = end ? '#ff9f2e' : 'rgba(11,58,87,0.92)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx - tw / 2, cy - th / 2, tw, th, 13); else ctx.rect(cx - tw / 2, cy - th / 2, tw, th);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillText(txt, cx, cy + 1);
    ctx.restore();
  }

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = function (v) { return Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); };
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }
  AA.shade = shade;
  /* Ei mit Farbvariante: Es glitzert – welche Variante drinsteckt, bleibt bis zum Schlüpfen geheim (darum überall dasselbe Gold) */
  function eggGlow(ctx, e, p, r, t) {
    const pul = 0.5 + 0.5 * Math.sin(t * 2.6 + e.x);
    const g = ctx.createRadialGradient(p.x, p.y, r * 0.3, p.x, p.y, r * (2.7 + 0.5 * pul));
    g.addColorStop(0, 'rgba(255,238,140,' + (0.8 + 0.15 * pul).toFixed(3) + ')'); g.addColorStop(0.45, 'rgba(255,205,70,' + (0.34 + 0.12 * pul).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,200,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 3.3, 0, TAU); ctx.fill();
    ctx.save();                                       // feiner Ring, der langsam nach außen läuft und verblasst
    const rp = (t * 0.45 + (e.x % 5) * 0.2) % 1;
    ctx.strokeStyle = 'rgba(255,236,150,' + (0.75 * (1 - rp)).toFixed(3) + ')'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r * (1.1 + 1.5 * rp), r * (1.25 + 1.5 * rp), 0, 0, TAU); ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 5; i++) {                     // fünf Funken, die reihum aufblitzen
      const q = t * 0.6 + i * 0.2 + (e.x % 7) * 0.1, ph = q % 1, a = Math.sin(ph * Math.PI);
      const ang = i * 1.31 + Math.floor(q) * 2.4 + e.x, d = r * (1.3 + 0.7 * ((i * 37 % 10) / 10));
      sparkle(ctx, p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d * 0.9 - r * 0.2, r * (0.36 + 0.36 * a), a, '#fffbe6');
    }
  }
  /* Runde 12: Ei in besserer Qualität – durchscheinende Gallerthülle mit Glanz, Dotter in der Artfarbe und ein Embryo, der mit dem
     Brutfortschritt wächst (erst ein Schatten, dann ein eingerolltes Fischchen mit Auge). Kurz vor dem Schlüpfen: Wackeln und Risse. */
  function drawEgg(ctx, e, t) {
    const p = V.eggPos(e), r = p.r, soon = e.hatch < e.total * 0.04, done = AA.clamp(1 - e.hatch / (e.total || 1), 0, 1);
    const col = (AA.FISH_BY[e.sp] || {}).egg || '#ffd27a', held = e === V.dragEgg;
    if (e.v) eggGlow(ctx, e, p, r, t);
    ctx.fillStyle = 'rgba(40,30,50,' + (held ? 0.1 : 0.18) + ')';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + r * 0.95, r * 0.9, r * 0.28, 0, 0, TAU); ctx.fill();
    ctx.save();
    ctx.translate(p.x + (soon ? Math.sin(t * 28) * 1.2 : 0), p.y - (held ? 8 : 0));
    ctx.rotate(Math.sin(t * (soon ? 9 : 2.2) + e.x) * (soon ? 0.22 : 0.07));
    const pulse = 1 + Math.sin(t * 2.6 + e.x * 0.1) * 0.012 + (held ? 0.06 : 0);
    ctx.scale(pulse, pulse);
    const rx = r * 0.84, ry = r;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';                                     // Gallertmantel
    ctx.beginPath(); ctx.ellipse(0, r * 0.02, rx * 1.16, ry * 1.13, 0, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(-r * 0.32, -r * 0.42, r * 0.08, 0, 0, r * 1.12);
    g.addColorStop(0, shade(col, 0.7)); g.addColorStop(0.5, shade(col, 0.22)); g.addColorStop(1, shade(col, -0.18));
    ctx.globalAlpha = 0.93; ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save(); ctx.clip();
    ctx.fillStyle = shade(col, 0.42); ctx.globalAlpha = 0.85;                      // Dotter – wird kleiner, je weiter das Kleine ist
    ctx.beginPath(); ctx.arc(r * 0.1, r * 0.3, r * (0.52 - done * 0.24), 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    if (done > 0.12) {                                                            // Embryo: eingerollter Bogen, wird dicker und dunkler
      const k = AA.clamp((done - 0.12) / 0.8, 0, 1), dark = shade(col, -0.6), wig = Math.sin(t * (soon ? 7 : 1.6) + e.x) * 0.12 * k;
      ctx.strokeStyle = dark; ctx.globalAlpha = 0.25 + 0.55 * k; ctx.lineCap = 'round';
      ctx.lineWidth = r * (0.12 + 0.22 * k);
      ctx.beginPath(); ctx.arc(0, r * 0.05, r * 0.42, -0.6 + wig, 2.6 + k * 1.2 + wig); ctx.stroke();
      if (done > 0.45) {                                                          // Auge
        const ex = Math.cos(-0.6 + wig) * r * 0.42, ey = r * 0.05 + Math.sin(-0.6 + wig) * r * 0.42;
        ctx.globalAlpha = 0.9; ctx.fillStyle = '#1b1230'; ctx.beginPath(); ctx.arc(ex, ey, r * (0.07 + 0.06 * k), 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex - r * 0.03, ey - r * 0.03, r * 0.035, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.strokeStyle = shade(col, -0.45); ctx.lineWidth = Math.max(1.2, 2 * (r / 14));
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.stroke();
    if (done > 0.92) {                                                            // Risse kurz vor dem Schlüpfen
      ctx.strokeStyle = shade(col, -0.55); ctx.lineWidth = Math.max(1, r * 0.07); ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-rx * 0.55, -ry * 0.35); ctx.lineTo(-rx * 0.25, -ry * 0.5); ctx.lineTo(-rx * 0.05, -ry * 0.32); ctx.lineTo(rx * 0.2, -ry * 0.52); ctx.lineTo(rx * 0.45, -ry * 0.38); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)';                                       // Glanz
    ctx.beginPath(); ctx.ellipse(-r * 0.32, -r * 0.5, r * 0.16, r * 0.26, -0.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-r * 0.05, -r * 0.72, r * 0.06, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(r * 0.42, r * 0.38, r * 0.1, r * 0.2, 0.4, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawFood(ctx) {
    for (let i = 0; i < V.food.length; i++) {
      const fl = V.food[i];
      ctx.save();
      ctx.translate(fl.x, fl.y); ctx.rotate(fl.landed ? 0 : fl.rot);
      ctx.globalAlpha = fl.landed > 22 ? Math.max(0, (26 - fl.landed) / 4) : 1;
      if (fl.kind === 'med') {                         // Medizin: kleine rot-weiße Kapsel
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(-fl.s * 0.45, 0, fl.s * 0.75, fl.s * 0.45, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff5a6a'; ctx.beginPath(); ctx.ellipse(fl.s * 0.45, 0, fl.s * 0.75, fl.s * 0.45, 0, 0, TAU); ctx.fill();
        ctx.restore(); continue;
      }
      if (fl.kind === 'turbo') { ctx.shadowColor = 'rgba(80,220,255,0.9)'; ctx.shadowBlur = 6; }
      ctx.fillStyle = fl.col;
      ctx.beginPath(); ctx.ellipse(0, 0, fl.s, fl.s * (fl.landed ? 0.45 : 0.62), 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(-fl.s * 0.25, -fl.s * 0.15, fl.s * 0.35, fl.s * 0.2, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  AA.drawBubble = function (ctx, x, y, r) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, TAU); ctx.fill();
  };
  function drawBubbles(ctx) {
    ctx.save();
    ctx.lineWidth = 1.3;
    for (let i = 0; i < V.bubbles.length; i++) { const b = V.bubbles[i]; AA.drawBubble(ctx, b.x, b.y, b.r); }
    ctx.restore();
  }

  const PART_CH = { spark: '✨', star: '⭐', zzz: '💤', note: '🎵' };
  AA.drawHeart = function (ctx, x, y, s) {
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.36);
    ctx.bezierCurveTo(x - s * 0.62, y - s * 0.08, x - s * 0.36, y - s * 0.56, x, y - s * 0.2);
    ctx.bezierCurveTo(x + s * 0.36, y - s * 0.56, x + s * 0.62, y - s * 0.08, x, y + s * 0.36);
    ctx.closePath(); ctx.fillStyle = '#ff4d79'; ctx.fill(); ctx.strokeStyle = '#a3123c'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(x - s * 0.2, y - s * 0.22, s * 0.09, s * 0.06, -0.6, 0, TAU); ctx.fill();
  };
  function drawParts(ctx) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const coin = AA.assets.get('prop/coin');
    for (let i = 0; i < V.parts.length; i++) {
      const p = V.parts[i], k = p.life / p.max;
      ctx.globalAlpha = k < 0.15 ? k / 0.15 : Math.max(0, 1 - (k - 0.55) / 0.45);
      const sz = p.s * (0.7 + 0.5 * Math.min(1, k * 3));
      if (p.kind === 'heart') { AA.drawHeart(ctx, p.x, p.y, sz * 1.15); continue; }
      if (p.kind === 'coin' && coin) { ctx.drawImage(coin, p.x - sz * 0.6, p.y - sz * 0.6, sz * 1.2, sz * 1.2 * coin.height / coin.width); continue; }
      if (p.kind === 'spark') { sparkle(ctx, p.x, p.y, sz * 0.6, ctx.globalAlpha); continue; }
      if (p.kind === 'drop') { ctx.fillStyle = 'rgba(232,249,255,0.92)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, sz * 0.13, sz * 0.2, Math.atan2(p.vy, p.vx) + Math.PI / 2, 0, TAU); ctx.fill(); continue; }
      if (p.kind === 'dust') { ctx.fillStyle = 'rgba(236,222,190,0.75)'; ctx.beginPath(); ctx.arc(p.x, p.y, sz * 0.32, 0, TAU); ctx.fill(); continue; }
      if (p.kind === 'twinkle') {                    // blitzt auf und vergeht: erst weißer Kern, darum die Farbe der Variante
        const a = Math.sin(Math.min(1, k) * Math.PI), q = p.s * (0.35 + 0.65 * a);
        sparkle(ctx, p.x, p.y, q, a * 0.9, p.col); sparkle(ctx, p.x, p.y, q * 0.5, a, '#ffffff');
        continue;
      }
      ctx.font = Math.round(sz) + 'px sans-serif';
      ctx.fillText(PART_CH[p.kind] || '✨', p.x, p.y);
    }
    ctx.restore();
  }
  function drawTexts(ctx) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 ' + Math.round(24 * V.txtK) + 'px ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", system-ui, sans-serif';
    for (let i = 0; i < V.texts.length; i++) {
      const x = V.texts[i];
      ctx.globalAlpha = x.life < 1.2 ? 1 : Math.max(0, 1 - (x.life - 1.2) / 0.5);
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(10,45,70,0.85)'; ctx.lineJoin = 'round';
      ctx.strokeText(x.str, x.x, x.y); ctx.fillStyle = x.col; ctx.fillText(x.str, x.x, x.y);
    }
    ctx.restore();
  }
  function drawRips(ctx) {
    ctx.save();
    for (let i = 0; i < V.rips.length; i++) {
      const r = V.rips[i], k = r.life / 0.75;
      for (let j = 0; j < 3; j++) {
        const kk = k - j * 0.16; if (kk <= 0) continue;
        ctx.globalAlpha = Math.max(0, 0.75 * (1 - kk));
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 - j * 0.7;
        ctx.beginPath(); ctx.arc(r.x, r.y, 10 + kk * 78, 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* Schmutz: grüne Algenflecken wachsen dort zuerst, wo das Rauschmuster hoch ist; dazu trübt sich das Wasser */
  const algCv = mk(AA.ALG_W, AA.ALG_H), algCtx = algCv.getContext('2d');
  let algImg = null, algKey = '', wipeN = 0;
  /* Putzspur: pro Zelle des Algen-Rasters, wie sauber eine Schnecke sie gerade geraspelt hat (wächst langsam wieder zu) */
  function wipeAt(x, y) {
    const GW = AA.ALG_W, GH = AA.ALG_H;
    if (!V.wipe) V.wipe = new Float32Array(GW * GH);
    const cx = (x + 22) / (W + 44) * GW, cy = (y + 14) / (H + 28) * GH;
    for (let j = Math.floor(cy - 1); j <= Math.ceil(cy + 1); j++) for (let i = Math.floor(cx - 1); i <= Math.ceil(cx + 1); i++) {
      if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
      const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy); if (d > 1.4) continue;
      const k = j * GW + i; V.wipe[k] = Math.min(1, V.wipe[k] + 0.05 * (1.4 - d));
    }
    wipeN++;
  }
  V.wipeAt = wipeAt;
  /* Runde 14: Trübung, Algen und der Scheiben-Glanz liegen zusammen in EINEM Bild (Beckengröße), neu gerechnet nur, wenn sich die Algen ändern
     (Schmutz-Stufe oder Putzspur) – pro Bild wird es einmal gemalt, genau wie vorher der Glanz allein. Vorher kamen zwei bildschirmgroße Schichten
     pro Bild dazu (Trübung + weich hochgerechnete Algen): ein voll veralgtes Becken lief damit fast halb so schnell. */
  let dirtCv = null;
  function glassLayer(tank) {
    if (!glassCv) glassCv = buildGlass();
    const dirt = tank.dirt;
    if (dirt < 0.012) return glassCv;
    const key = tank.id + ':' + Math.round(dirt * 400) + ':' + Math.floor(wipeN / 8);
    if (key !== algKey || !dirtCv) {
      algKey = key;
      if (!algImg) algImg = algCtx.createImageData(AA.ALG_W, AA.ALG_H);
      const d = algImg.data, nz = AA.algNoise(tank), wp = V.wipe;
      for (let i = 0; i < nz.length; i++) {
        const j = i * 4, v = AA.clamp((dirt * 1.2 - (1 - nz[i])) * 1.7, 0, 1) * (wp ? 1 - wp[i] : 1);
        d[j] = 70 + nz[i] * 40; d[j + 1] = 150 + nz[i] * 40; d[j + 2] = 52; d[j + 3] = v * 150;
      }
      algCtx.putImageData(algImg, 0, 0);
      if (!dirtCv) dirtCv = mk(W, H);
      const g = dirtCv.getContext('2d');
      g.clearRect(0, 0, W, H);
      g.fillStyle = 'rgba(96,132,48,' + (0.16 * dirt).toFixed(3) + ')'; g.fillRect(0, 0, W, H);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(algCv, -22, -14, W + 44, H + 28);
      g.drawImage(glassCv, 0, 0, W, H);
    }
    return dirtCv;
  }

  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  AA.roundRect = rr;
  /* Putzbürste als Mauszeiger – flach gezeichnet, passend zum Rest */
  function drawBrush(ctx) {
    ctx.lineJoin = 'round'; ctx.lineWidth = 2.4; ctx.strokeStyle = '#8a1f55';
    ctx.fillStyle = '#fff3f8';
    for (let i = -3; i <= 3; i++) { rr(ctx, i * 6.2 - 2.4, 4, 4.8, 15, 2); ctx.fill(); ctx.stroke(); }
    rr(ctx, -25, -9, 50, 15, 7); ctx.fillStyle = '#ff5fa2'; ctx.fill(); ctx.stroke();
    rr(ctx, -5, -30, 10, 24, 5); ctx.fillStyle = '#ff8fc0'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; rr(ctx, -20, -6, 22, 4, 2); ctx.fill();
  }
  /* Runde 8: Seitenscheiben, die nach hinten laufen – je größer das Becken, desto tiefer wirkt es (AA.DEPTH) */
  V.texScale = function (t) { t = t || AA.tank(); const big = AA.wide(t); return window.AA_NOZOOM && !big ? 1 : (big ? AA.TEX_OCEAN : AA.TEX[t.size] || 1); };
  /* Runde 14: Kulisse, Boden und Farbvarianten der Nachbarbecken schon einmal vorbereiten (im Leerlauf, Häppchen für Häppchen) –
     dann ist der Wechsel mit den Pfeilen flüssig. Teuer sind vor allem der Boden mit Form und das Umfärben der Varianten (je Tier ~10 ms). */
  let warmT = 0, warmGen = 0;
  V.prewarm = function () {
    clearTimeout(warmT);
    const gen = ++warmGen;
    warmT = setTimeout(function () {
      const s = AA.state; if (!s || AA.visit || V.photoMode) return;
      const n = s.tanks.length, jobs = [], list = n > 1 ? [s.tanks[(s.active + 1) % n], s.tanks[(s.active + n - 1) % n]].filter(function (t, i, a) { return a.indexOf(t) === i; }) : [];      // bei 2 Becken ist „nächstes“ = „voriges“
      const As = AA.assets, cur = AA.tank();
      // Merkspeicher der Varianten nicht überfüllen – was das aktuelle Becken braucht (bis zu 4 Bilder je Tier), geht vor
      let room = (As.VAR_MAX || 0) - 4 * cur.fish.filter(function (f) { return f.v; }).length - 8;
      list.forEach(function (t) {                      // das nächste Becken zuerst; je Becken erst der (teure) Boden, dann Kulisse, dann die Varianten
        const T = V.texScale(t);
        jobs.push(function () { const g = mk(1, 1).getContext('2d'); g.setTransform(SS, 0, 0, SS, 0, 0); AA.paintFloor(g, t.floor, G.fx, G.fTop, G.fw, t.shape, T); });      // nur fürs Merken – gemalt wird in ein winziges Bild
        jobs.push(function () { bgFor(t.wall, T); });
        const vf = t.fish.filter(function (f) { return f.v && AA.VAR_BY && AA.VAR_BY[f.v]; }).slice(0, Math.max(0, room));
        room -= vf.length;
        vf.forEach(function (f) { jobs.push(function () { const k = AA.spriteKey(f); if (f.sick) As.tinted(k, f.v); else As.variant(k, f.v); }); });      // ein Tier je Häppchen
      });
      // Leerlauf abwarten, aber nicht ewig: auf einem ausgelasteten Gerät gibt es sonst nie Leerlauf, und die Aufträge stauen sich
      const idle = window.requestIdleCallback ? function (f) { return window.requestIdleCallback(f, { timeout: 1000 }); } : function (f) { return setTimeout(f, 60); };
      const step = function (dl) {
        let k = 0;
        while (jobs.length && (k === 0 || (dl && dl.timeRemaining && dl.timeRemaining() > 6))) {      // mindestens ein Häppchen, mehr nur, solange bis zum nächsten Bild Zeit ist
          if (gen !== warmGen || AA.state !== s || AA.visit) return;      // inzwischen weitergeschaltet: diese Runde verfällt (die neue wärmt selbst vor)
          jobs.shift()(); k++;
        }
        if (jobs.length) idle(step);
      };
      idle(step);
    }, 500);
  };
  V.depthPx = function () { const t = AA.tank(); return AA.wide(t) ? AA.DEPTH_OCEAN : AA.DEPTH[t.size] || 40; };
  function drawPanes(ctx, tank) {
    const d = V.depthPx(), dt = d * 0.55;
    ctx.save();
    for (let side = 0; side < 2; side++) {
      const x0 = side ? W : 0, x1 = side ? W - d : d, by = G.fTop + 10 - AA.lift(x1);      // Runde 12: endet auf dem Kies, auch wenn er dort aufgeschüttet ist
      const gr = ctx.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, 'rgba(225,248,255,0.20)'); gr.addColorStop(0.7, 'rgba(190,235,255,0.08)'); gr.addColorStop(1, 'rgba(160,220,255,0.05)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, dt); ctx.lineTo(x1, by); ctx.lineTo(x0, H); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;                  // hintere Kante der Scheibe
      ctx.beginPath(); ctx.moveTo(x1, dt); ctx.lineTo(x1, by); ctx.stroke();
      ctx.strokeStyle = 'rgba(30,60,80,0.22)'; ctx.lineWidth = 3;                     // Fuge zum Kies
      ctx.beginPath(); ctx.moveTo(x1, by); ctx.lineTo(x0, H); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;                // Spiegelung
      ctx.beginPath(); ctx.moveTo(x0 + (x1 - x0) * 0.35, dt * 0.35 + 20); ctx.lineTo(x0 + (x1 - x0) * 0.35, by * 0.8); ctx.stroke();
    }
    const tg = ctx.createLinearGradient(0, 0, 0, dt);                                // Wasseroberfläche von unten
    tg.addColorStop(0, 'rgba(255,255,255,0.22)'); tg.addColorStop(1, 'rgba(255,255,255,0.04)');
    ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W - d, dt); ctx.lineTo(d, dt); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(d, dt); ctx.lineTo(W - d, dt); ctx.stroke();
    if (tank.ocean) {                                  // Meeresbecken: Weite – blauer Dunst in der Tiefe
      const hz = ctx.createLinearGradient(0, G.fTop - 260, 0, G.fTop + 130);      // am stärksten an der Hinterkante, läuft auf dem Kies weich aus
      hz.addColorStop(0, 'rgba(40,110,190,0)'); hz.addColorStop(0.72, 'rgba(40,110,190,0.16)'); hz.addColorStop(1, 'rgba(40,110,190,0)');
      ctx.fillStyle = hz; ctx.fillRect(0, G.fTop - 260, W, 390);
    }
    ctx.restore();
  }
  /* ---------- Runde 9: Tiefsee-Becken – Dunkelheit, und was selbst leuchtet ---------- */
  function drawDeep(ctx, tank, t) {
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(8,18,60,0.40)'); gr.addColorStop(0.6, 'rgba(4,10,40,0.52)'); gr.addColorStop(1, 'rgba(2,5,24,0.62)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  const glowCv = {};
  function glowSprite(col) {
    if (glowCv[col]) return glowCv[col];
    const c = mk(128, 128), g = c.getContext('2d'), n = parseInt(col.slice(1), 16), rgb = ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, 'rgba(' + rgb + ',0.75)'); gr.addColorStop(0.3, 'rgba(' + rgb + ',0.30)'); gr.addColorStop(0.65, 'rgba(' + rgb + ',0.09)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return (glowCv[col] = c);
  }
  /* Leuchtende Tiere (glow an der Art) und Deko (glow am Stück: [x, Höhe, Farbe]) – im Tiefsee-Becken immer, sonst nur nachts */
  function drawGlows(ctx, tank, t, k) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < V.fish.length; i++) {
      const f = V.fish[i], col = f.def.glow;
      if (!col || f.ghost || f.y < -30) continue;
      const le = f.lureE || 0, s = f.size(), R = Math.max(44, s * 0.78) * (0.94 + 0.06 * Math.sin(t * 2.1 + f.seed)) * (1 + 0.18 * le);
      ctx.globalAlpha = Math.min(1, k * (0.62 + 0.2 * Math.sin(t * 1.3 + f.seed * 3)) * (1 + 0.55 * le));      // Runde 14: beim Wedeln leuchtet die Laterne heller
      ctx.drawImage(glowSprite(col), f.x - R, f.y - R * 0.8, R * 2, R * 1.6);
    }
    for (let i = 0; i < tank.deco.length; i++) {
      const o = tank.deco[i], def = AA.DECO_BY[o.type];
      if (!def.glow || V.onGlass(o)) continue;
      const b = V.decoBox(o), R = b.w * def.glow[3] * (0.95 + 0.05 * Math.sin(t * 3 + o.x));
      ctx.globalAlpha = k * 0.85;
      ctx.drawImage(glowSprite(def.glow[2]), o.x + (o.flip ? -1 : 1) * (def.glow[0] - 0.5) * b.w - R, b.by - def.glow[1] * b.h - R, R * 2, R * 2);
    }
    ctx.restore();
  }
  function renderWorld(ctx) {
    const tank = AA.tank(), t = V.time, night = !!AA.state.settings.night;
    const wall = AA.WALL_BY[tank.wall] || AA.WALLS[0];
    if (!glassCv) glassCv = buildGlass();
    const T = V.texScale(), key = tank.wall + '|' + tank.floor + '|' + (tank.shape || '') + '|' + T;
    if (sceneKey !== key) {                          // Hintergrund + Kies einmal zusammensetzen (spart pro Bild große Blits)
      if (!sceneCv) sceneCv = mk(W * SS, H * SS);
      const bg = bgFor(tank.wall, T), sg = sceneCv.getContext('2d');
      sg.setTransform(1, 0, 0, 1, 0, 0); sg.drawImage(bg, 0, 0);
      sg.setTransform(SS, 0, 0, SS, 0, 0);
      AA.paintFloor(sg, tank.floor, G.fx, G.fTop, G.fw, tank.shape, T);
      sceneKey = AA.assets.get('floor/' + tank.floor) && (!wall.img || AA.assets.get(wall.img)) ? key : null;      // fehlt noch ein Bild (wird gerade geladen): gleich noch einmal
    }
    const flats = flatList(tank);
    curGround = groundCanvas(tank, flats);
    ctx.drawImage(curGround, 0, 0, W, H);              // Runde 13: Szene + Wege
    for (let i = 0; i < flats.length; i++) {
      const o = flats[i];
      if (o === V.dragDeco) { ctx.save(); ctx.globalAlpha = 0.85; drawFlat(ctx, o, AA.DECO_BY[o.type], V.decoBox(o)); ctx.restore(); }
      if (o === V.selDeco && !V.photoMode) drawSel(ctx, o, V.decoBox(o), t, 0);
    }
    if (wall.live && AA.liveBg) AA.liveBg(ctx, wall.live, t, tank);      // Runde 12: lebende Kulisse (js/extras.js)
    drawPanes(ctx, tank);
    if (!tank.deep) drawRays(ctx, t, night, wall.ray);      // in die Tiefsee kommt kein Sonnenlicht
    // Schwebeteilchen
    ctx.fillStyle = tank.deep ? 'rgba(210,235,255,0.55)' : 'rgba(255,255,255,0.4)';
    for (let i = 0; i < V.plank.length; i++) { const p = V.plank[i]; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 0.6, 0, TAU); ctx.fill(); }
    // Fisch-Schatten auf dem Kies
    for (let i = 0; i < V.fish.length; i++) {
      const f = V.fish[i], fy = AA.floorY(f.z, f.x), hgt = fy - f.y;
      if (hgt < 0 || f.y < -40 || (f.sk && f.sk.on && f.sk.mode !== 'floor')) continue;      // klebt an einer Scheibe: kein Schatten am Boden
      const s = f.size();
      ctx.fillStyle = 'rgba(40,30,50,' + (0.14 * Math.max(0.15, 1 - hgt / 420)).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(f.x, fy + 2, s * 0.34, Math.max(2, s * 0.05), 0, 0, TAU); ctx.fill();
    }
    // nach Tiefe sortiert zeichnen
    const items = [];
    for (let i = 0; i < tank.deco.length; i++) { const dd = AA.DECO_BY[tank.deco[i].type]; if (dd && dd.path && !dd.crawl) continue; items.push({ z: tank.deco[i].z + (tank.deco[i].l || 0), k: 0, o: tank.deco[i] }); }      // o.l = Ebene (Runde 10); Wege liegen schon im Boden-Bild
    for (let i = 0; i < tank.eggs.length; i++) items.push({ z: tank.eggs[i].z + 0.001, k: 1, o: tank.eggs[i] });
    const onGlass = [];                                // Saugwelse an der Frontscheibe liegen vor allem anderen
    for (let i = 0; i < V.fish.length; i++) { const f = V.fish[i]; if (f.sk && f.sk.on && f.sk.mode === 'glass') onGlass.push(f); else items.push({ z: f.z + 0.0005, k: 2, o: f }); }
    items.sort(function (a, b) { return a.z - b.z; });
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.k === 0) drawDeco(ctx, it.o, t); else if (it.k === 1) drawEgg(ctx, it.o, t);
      else if (V.tool === 'deco' && !V.photoMode) { ctx.save(); ctx.globalAlpha = 0.2; it.o.draw(ctx, t); ctx.restore(); }      // Deko-Modus: Fische kurz verblassen
      else it.o.draw(ctx, t);
    }
    drawFood(ctx);
    drawLive(ctx, t);
    drawBubbles(ctx);
    drawParts(ctx);
    drawGlassCrawlers(ctx, t);
    for (let i = 0; i < onGlass.length; i++) { if (V.tool === 'deco') { ctx.save(); ctx.globalAlpha = 0.2; onGlass[i].draw(ctx, t); ctx.restore(); } else onGlass[i].draw(ctx, t); }
    if (tank.deep) drawDeep(ctx, tank, t);
    else if (night) {
      ctx.fillStyle = 'rgba(8,22,70,0.5)'; ctx.fillRect(0, 0, W, H);
      const mg = ctx.createRadialGradient(W * 0.7, -40, 20, W * 0.7, -40, 620);
      mg.addColorStop(0, 'rgba(190,215,255,0.26)'); mg.addColorStop(1, 'rgba(190,215,255,0)');
      ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H);
    }
    if (tank.deep || night) drawGlows(ctx, tank, t, tank.deep ? 1 : 0.7);
    if (AA.lightFx) AA.lightFx(ctx, tank, t);          // Runde 12: Licht-Studio (js/extras.js)
    drawRips(ctx);
    ctx.drawImage(glassLayer(tank), 0, 0, W, H);      // Scheibe – bei Schmutz mit Trübung und Algen in einem Rutsch (Runde 14)
    if (!V.photoMode) {
      if (V.tool !== 'deco') for (let i = 0; i < V.fish.length; i++) V.fish[i].drawOverlay(ctx, t);
      else if (V.drawDecoMode) V.drawDecoMode(ctx, t);            // Raster, Seitenscheiben-Grenze (js/decorui.js)
      drawTexts(ctx);
      if (V.dropSpot) {                               // leuchtende Kante: hier landet das gezogene Stück
        const q = V.dropSpot;
        ctx.save(); ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,227,110,0.35)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(q.xa, q.y); ctx.lineTo(q.xb, q.y); ctx.stroke();
        ctx.strokeStyle = '#fff3a6'; ctx.lineWidth = 3.5; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -t * 24; ctx.beginPath(); ctx.moveTo(q.xa, q.y); ctx.lineTo(q.xb, q.y); ctx.stroke();
        ctx.restore();
      }
      drawSizeHandle(ctx);
      const p = V.pointer;
      if (V.tool !== 'hand' && p.inside) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.shadowColor = 'rgba(0,30,50,0.4)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
        if (V.tool === 'food') {
          const can = AA.assets.get('prop/foodcan');
          ctx.rotate(p.down ? 2.5 + Math.sin(t * 40) * 0.12 : 2.85);
          if (can) ctx.drawImage(can, -17, -30, 34, 34 * can.height / can.width);
        } else if (V.tool === 'sponge') {
          ctx.rotate(-0.5 + (p.down ? Math.sin(t * 34) * 0.22 : 0));
          drawBrush(ctx);
        } else {
          ctx.font = '40px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          if (p.down) ctx.scale(0.86, 0.86);
          ctx.fillText('👆', 0, 0);
        }
        ctx.restore();
      }
    }
  }
  /* der Raum um das Becken: Wand, Dielen, Unterschrank mit Namensschild */
  function drawRoom(ctx, k, tank) {
    const x0 = V.ox, y0 = V.oy, w = W * k, h = H * k, yb = y0 + h, fy = Math.min(H - 8, yb + 30 + 60 * (1 - k));
    const wg = ctx.createLinearGradient(0, 0, 0, fy);
    wg.addColorStop(0, '#31465f'); wg.addColorStop(1, '#263852');
    ctx.fillStyle = wg; ctx.fillRect(0, 0, W, fy);
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let x = 40; x < W; x += 80) ctx.fillRect(x, 0, 2, fy);                 // Tapeten-Streifen
    const lg = ctx.createRadialGradient(W / 2, y0 + h * 0.4, h * 0.3, W / 2, y0 + h * 0.4, h * 1.25);
    lg.addColorStop(0, 'rgba(120,220,255,0.20)'); lg.addColorStop(1, 'rgba(120,220,255,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, fy);                                // das Becken leuchtet in den Raum
    const fg = ctx.createLinearGradient(0, fy, 0, H);
    fg.addColorStop(0, '#5a4130'); fg.addColorStop(1, '#3b2a1f');
    ctx.fillStyle = fg; ctx.fillRect(0, fy, W, H - fy);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, fy, W, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(W / 2, fy + 5, w * 0.56, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7a5539'; rr(ctx, x0 - 16, yb - 2, w + 32, fy - yb + 4, 7); ctx.fill();          // Unterschrank
    ctx.fillStyle = '#93694a'; rr(ctx, x0 - 22, yb - 4, w + 44, 12, 5); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(x0 - 16, yb + 8, w + 32, 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W / 2, yb + 14); ctx.lineTo(W / 2, fy); ctx.stroke();
    const role = tank.role && AA.ROLES[tank.role], label = (role ? role.ico + ' ' : '') + tank.name;
    if (fy - yb > 34) {                                                         // Namensschild
      ctx.font = '700 15px ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = Math.min(w * 0.6, ctx.measureText(label).width + 26), py = yb + 25;
      ctx.fillStyle = '#e9d8a6'; rr(ctx, W / 2 - tw / 2, py - 12, tw, 24, 6); ctx.fill();
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#4a3520'; ctx.fillText(label, W / 2, py + 1, tw - 12);
      V.plate = { x: W / 2 - tw / 2, y: py - 12, w: tw, h: 24 };
    } else V.plate = null;
    ctx.fillStyle = '#18222f'; rr(ctx, x0 - 7, y0 - 7, w + 14, h + 14, 12); ctx.fill();                // Rahmen
  }
  V.render = function (ctx) {
    const k = V.kCur;
    if (V.photoMode || k > 0.999) { V.plate = null; renderWorld(ctx); return; }
    drawRoom(ctx, k, AA.tank());
    ctx.save();
    ctx.translate(V.ox, V.oy); ctx.scale(k, k);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    renderWorld(ctx);
    ctx.restore();
  };

  /* Foto: Becken ohne Bedienelemente als PNG */
  V.photo = function (canvas, done) {
    V.photoMode = true;
    const ctx = canvas.getContext('2d');
    V.render(ctx);
    V.photoMode = false;
    try {
      canvas.toBlob(function (blob) {
        if (!blob) { done(false); return; }
        const a = document.createElement('a'), d = new Date();
        const p = function (n) { return n < 10 ? '0' + n : '' + n; };
        a.download = 'Awesome-Aquarium-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '.png';
        a.href = URL.createObjectURL(blob);
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        done(true);
      }, 'image/png');
    } catch (e) { done(false); }
  };
})(window.AA);
