'use strict';
/* Awesome Aquarium – Farbvarianten (Mutationen): umgefärbte Fassungen der Fisch-Sprites.
   Es gibt dafür KEINE eigenen Bilder: Die Variante wird beim ersten Gebrauch aus dem normalen Sprite berechnet und gemerkt –
   Form, Kontur und Gesicht bleiben pixelgenau die des Originals, nur die Farben ändern sich.
     • Augen und Mund bleiben, wie sie sind (Albino: rote Iris). Wo sie liegen, weiß das Spiel aus js/rigs.js (Augen der Erwachsenen)
       und js/varmask.js (Mund, Augenscheibe der Babys – erzeugt von tools/sad.py).
     • Das Pflaster „trauriges Gesicht“ (sad/<sprite>) wird mit derselben Regel umgefärbt, damit es weiter genau passt.
     • Fast schwarze Arten (Black Molly) werden vorher aufgehellt, sonst sähe man von Gold oder Amethyst nichts.
   Aufruf: AA.assets.variant('fish/clown_m', 'gold') -> Canvas (oder das normale Bild, wenn keine Variante angegeben ist). */
(function (AA) {
  const As = AA.assets;
  const store = new Map(), info = new Map(), thumbs = new Map();
  /* Merkspeicher: Ein volles Becken (40 Tiere) braucht im schlimmsten Fall 4 Bilder je Tier (Körper, krank getönt, trauriges Pflaster, dessen
     getönte Fassung) = 160. Darunter würde bei jedem Bild neu umgefärbt (gemessen: 257 statt 20 ms je Bild) – darum 200. */
  const MAX = 200, MAX_INFO = 48, MAX_THUMB = 400;
  function lruGet(m, k) { const v = m.get(k); if (v !== undefined) { m.delete(k); m.set(k, v); } return v; }
  function lruPut(m, k, v, max) { m.set(k, v); if (m.size > max) m.delete(m.keys().next().value); return v; }

  function sm(a, b, x) { x = (x - a) / (b - a); x = x < 0 ? 0 : (x > 1 ? 1 : x); return x * x * (3 - 2 * x); }
  function hue2(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 0.5) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }
  const O = [0, 0, 0];
  function hsl(h, s, l) {                              // h in Grad, s/l 0…1 -> O[0..2] (0…255)
    h = ((h % 360) + 360) % 360 / 360; s = s < 0 ? 0 : (s > 1 ? 1 : s); l = l < 0 ? 0 : (l > 1 ? 1 : l);
    if (s === 0) { O[0] = O[1] = O[2] = l * 255; return; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    O[0] = hue2(p, q, h + 1 / 3) * 255; O[1] = hue2(p, q, h) * 255; O[2] = hue2(p, q, h - 1 / 3) * 255;
  }
  function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  function unrle(a, W, H, flipSum) {                  // Maske aus js/varmask.js auspacken; flipSum: Zeile y landet bei flipSum - y
    const m = new Uint8Array(W * H);
    if (!a) return m;
    let k = 2;
    for (let r = 0; r < a[1]; r++) {
      let y = a[0] + r; if (flipSum !== undefined) y = flipSum - y;
      const n = a[k++];
      for (let j = 0; j < n; j++) { const x = a[k++], len = a[k++]; if (y >= 0 && y < H) m.fill(1, y * W + Math.max(0, x), y * W + Math.min(W, x + len)); }
    }
    return m;
  }
  function pixels(im) {
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
    return { c: c, g: g, d: g.getImageData(0, 0, c.width, c.height) };
  }
  /* Was man über ein Sprite wissen muss, um es umzufärben: Größe, Augen, Mund, Aufhell-Kurve */
  function spriteInfo(id) {
    let I = lruGet(info, id);
    if (I) return I;
    const im = As.get('fish/' + id);
    if (!im) return null;
    const W = im.width, H = im.height, rig = (AA.RIG && AA.RIG[id]) || {}, vm = (AA.VMASK && AA.VMASK[id]) || {};
    const px = pixels(im).d.data;
    I = { W: W, H: H, eyes: (rig.eyes || []).map(function (e) { return [e[0] * W, e[1] * H, e[2] * W]; }), baby: !rig.eyes };
    I.eye = unrle(vm.e, W, H);                        // Babys: Augenscheibe. Erwachsene: Kreise aus dem Rig
    I.eyes.forEach(function (e) { disc(I.eye, W, H, e[0], e[1], e[2] * 1.09); });   // 1,09 = so groß malt auch das Lid (tools/sad.py)
    I.mouth = unrle(vm.m, W, H);
    // Pflaster „traurig“: dort ist der Mund gespiegelt (Erwachsene), das Lid reicht etwas über das Auge hinaus, die Baby-Augenscheibe ist umgedreht
    I.eyeS = new Uint8Array(W * H);
    if (vm.e) { const s = vm.e[0] * 2 + vm.e[1] - 1; I.eyeS = unrle(vm.e, W, H, s); }
    I.eyes.forEach(function (e) { disc(I.eyeS, W, H, e[0], e[1], e[2] * 1.09); });
    I.mouthS = vm.m && vm.fy !== undefined ? unrle(vm.mf || vm.m, W, H, vm.fy) : new Uint8Array(W * H);
    const lc = /^#[0-9a-f]{6}$/i.test(rig.lid || '') ? parseInt(rig.lid.slice(1), 16) : -1;
    I.lid = lc < 0 ? null : [(lc >> 16) & 255, (lc >> 8) & 255, lc & 255];
    // Helligkeit des Körpers (Median): bei fast schwarzen Arten vorher aufhellen
    const hist = new Uint32Array(64); let n = 0;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      const i = y * W + x, p = i * 4;
      if (px[p + 3] < 200 || I.eye[i] || I.mouth[i]) continue;
      const mx = Math.max(px[p], px[p + 1], px[p + 2]), mn = Math.min(px[p], px[p + 1], px[p + 2]);
      hist[Math.min(63, Math.floor((mx + mn) / 510 * 64))]++; n++;
    }
    let acc = 0, med = 0.5;
    for (let b = 0; b < 64; b++) { acc += hist[b]; if (acc >= n / 2) { med = (b + 0.5) / 64; break; } }
    // fast schwarze Arten vor dem Umfärben heller, sehr blasse (Axolotl, Kalmar) kräftiger machen – gleichmäßig verschoben, damit kein Rauschen aufblüht
    I.lift = med < 0.28 ? 0.42 - med : (med > 0.7 ? 0.56 - med : 0);
    // Sternennacht: feste Sternchen auf dem Körper (aus dem Namen des Sprites gewürfelt, also immer dieselben)
    const rnd = AA.rng(strHash(id)), want = Math.max(7, Math.round(W * H / 4300)); I.stars = [];
    for (let k = 0; k < want * 12 && I.stars.length < want; k++) {
      const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H), i = y * W + x, r = (1.3 + rnd() * rnd() * 2.4) * Math.max(0.6, W / 400);
      if (px[i * 4 + 3] < 250 || I.eye[i] || I.mouth[i]) continue;
      let ok = true;
      for (let q = 0; q < I.stars.length; q++) if (Math.hypot(I.stars[q][0] - x, I.stars[q][1] - y) < 13 * Math.max(0.6, W / 400)) { ok = false; break; }
      if (ok) I.stars.push([x, y, r, rnd() < 0.38]);
    }
    return lruPut(info, id, I, MAX_INFO);
  }
  function disc(m, W, H, cx, cy, r) {
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) { const dx = Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy))); m.fill(1, y * W + Math.max(0, Math.round(cx - dx)), y * W + Math.min(W, Math.round(cx + dx) + 1)); }
  }

  /* ---------- die eigentliche Farb-Regel: ein Pixel (r, g, b) an der Stelle (x, y) des ganzen Sprites ---------- */
  function mapPixel(v, r, g, b, x, y, I, keepDark) {  // keepDark: dunkle Linien bleiben (geschlossenes Baby-Auge)
    const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, ch = mx - mn;
    let l = (mx + mn) / 2;
    if (I.lift > 0 && v !== 'night') l += I.lift * (1 - sm(0.5, 0.95, l));
    else if (I.lift < 0 && v !== 'night' && v !== 'albino') l += I.lift * sm(0.2, 0.45, l) * (1 - sm(0.93, 0.99, l)) * sm(0.04, 0.14, ch);
    // wie stark wird umgefärbt? Alles Farbige ganz; Grau je nach Helligkeit; fast Weißes und fast Schwarzes bleibt
    const wC = sm(0.08, 0.22, ch), wL = sm(0.06, 0.16, l) * (1 - sm(0.88, 0.96, l));
    let w = wC > wL ? wC : wL;
    const u = x / I.W, vv = y / I.H;
    let h, s, lt;
    if (v === 'gold') {
      h = 30 + 20 * sm(0.15, 0.75, l); s = 0.9; lt = l * 0.94 + 0.04;
      const band = Math.max(0, 1 - Math.abs(u + 0.5 * vv - 0.66) / 0.05) + 0.7 * Math.max(0, 1 - Math.abs(u + 0.5 * vv - 0.79) / 0.02);
      lt += (1 - lt) * 0.5 * Math.min(1, band);
    } else if (v === 'amethyst') {
      h = 264 + 20 * sm(0.2, 0.8, l); s = 0.6 + 0.2 * (1 - l); lt = l * 0.9 + 0.06;
      const band = Math.max(0, 1 - Math.abs(u + 0.5 * vv - 0.66) / 0.045);
      lt += (1 - lt) * 0.38 * band; if (band > 0) h += 22 * band;
    } else if (v === 'rainbow') {
      h = 285 * (1 - u) + 30 * (vv - 0.5); s = 0.88; lt = 0.5 + (l - 0.5) * 0.72;
    } else if (v === 'night') {                        // dunkles Nachtblau; helle Zeichnung bleibt hell (Mondlicht)
      const k = sm(0.7, 0.9, l) * (1 - sm(0.08, 0.25, ch));          // nur Weißes bleibt hell, blasse Farben werden dunkel
      h = 232; s = 0.5 - 0.25 * k; lt = (0.07 + 0.2 * l) * (1 - k) + (0.2 + 0.78 * l) * k;
    } else if (v === 'cwild') {                        // Karpfen-Formen: Wildkarpfen = gedecktes Olivbraun
      h = 44 + 10 * sm(0.3, 0.8, l); s = 0.4; lt = l * 0.8 + 0.02;
    } else if (v === 'czeil') {                        // Zeilkarpfen: blass, silbrig-ledern
      h = 204; s = 0.16; lt = 0.3 + 0.64 * l;
    } else if (v === 'cblack') {                       // Schwarzer Karpfen: tiefschwarz mit Samtglanz
      h = 236; s = 0.14; lt = 0.045 + 0.2 * l;
      const band = Math.max(0, 1 - Math.abs(u + 0.5 * vv - 0.66) / 0.06);
      lt += (1 - lt) * 0.16 * band;
    } else {                                           // albino: fast alles Pigment weg, auch das Schwarze – cremeweiß mit rosa Schatten
      h = 12; lt = 0.6 + 0.39 * Math.pow(l, 0.6); s = 0.1 + 1.1 * (0.99 - lt); if (s > 0.5) s = 0.5;
      if (keepDark) w *= sm(0.22, 0.4, l); else { const wd = 1 - sm(0.9, 0.98, l); if (wd > w) w = wd; }
    }
    hsl(h, s, lt);
    O[0] = r + (O[0] - r) * w; O[1] = g + (O[1] - g) * w; O[2] = b + (O[2] - b) * w;
  }
  /* im Auge bleibt alles, wie es ist. Nur Albinos: rote Iris, zartrosa Lid (lid = Pixel gehört zum gemalten Lid des traurigen Gesichts);
     bei Albino-Babys wird die geschlossene Augenscheibe wie der Körper blass, der dunkle Bogen bleibt. */
  function eyePixel(v, r, g, b, x, y, I, lid) {
    O[0] = r; O[1] = g; O[2] = b;
    if (v !== 'albino') return;
    if (I.baby) { mapPixel(v, r, g, b, x, y, I, true); return; }
    const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, k = sm(0.1, 0.3, mx - mn);
    if (k <= 0) return;
    if (lid && I.lid && Math.abs(r - I.lid[0]) + Math.abs(g - I.lid[1]) + Math.abs(b - I.lid[2]) < 60) { O[0] = 244; O[1] = 176; O[2] = 186; return; }
    hsl(352, 0.8, AA.clamp((mx + mn) / 2, 0.36, 0.62));
    O[0] = r + (O[0] - r) * k; O[1] = g + (O[1] - g) * k; O[2] = b + (O[2] - b) * k;
  }
  /* der Mund bleibt rot. Nur beim Albino wird er etwas heller, damit er zum blassen Gesicht passt und nirgends eine harte Kante steht */
  function mouthPixel(v, r, g, b) {
    O[0] = r; O[1] = g; O[2] = b;
    if (v !== 'albino') return;
    const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, d = mx - mn;
    if (mx > 0.86 && d < 0.12) return;                 // Zähne bleiben weiß
    let h = 0;
    if (d > 0) { if (mx === r / 255) h = ((g - b) / 255 / d) % 6; else if (mx === g / 255) h = (b - r) / 255 / d + 2; else h = (r - g) / 255 / d + 4; h *= 60; }
    const s0 = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    hsl(h > 20 && h < 320 ? 355 : h, Math.max(0.45, s0 * 0.8), 0.24 + 0.76 * l);     // blaue oder lila Mäuler werden beim Albino rosa
  }
  function paintStars(d, W, H, I, ox, oy, skip) {       // skip(i) = Pixel bleibt, wie er ist (Auge/Mund)
    for (let k = 0; k < I.stars.length; k++) {
      const st = I.stars[k], cx = st[0] - ox, cy = st[1] - oy, r = st[2], R = st[3] ? r * 2.6 : r + 1;
      for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(H - 1, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(W - 1, Math.ceil(cx + R)); x++) {
        const i = y * W + x, p = i * 4;
        if (d[p + 3] < 8 || skip(i, x, y)) continue;
        const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
        let a = AA.clamp(r + 0.5 - Math.hypot(dx, dy), 0, 1);
        if (st[3]) a = Math.max(a, AA.clamp(1.1 - Math.min(dx, dy) * 1.1, 0, 1) * AA.clamp(1 - Math.max(dx, dy) / R, 0, 1));   // die größeren funkeln als kleines Kreuz
        if (a <= 0) continue;
        d[p] += (255 - d[p]) * a; d[p + 1] += (250 - d[p + 1]) * a; d[p + 2] += (214 - d[p + 2]) * a;
      }
    }
  }

  function recolorSprite(id, v, im) {
    const I = spriteInfo(id); if (!I) return null;
    const P = pixels(im), d = P.d.data, W = I.W, H = I.H;
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
      const p = i * 4;
      if (d[p + 3] === 0) continue;
      if (I.mouth[i]) mouthPixel(v, d[p], d[p + 1], d[p + 2]);
      else if (I.eye[i]) eyePixel(v, d[p], d[p + 1], d[p + 2], x, y, I, false);
      else mapPixel(v, d[p], d[p + 1], d[p + 2], x, y, I, false);
      d[p] = O[0]; d[p + 1] = O[1]; d[p + 2] = O[2];
    }
    if (v === 'night') paintStars(d, W, H, I, 0, 0, function (i) { return I.eye[i] || I.mouth[i]; });
    P.g.putImageData(P.d, 0, 0);
    return P.c;
  }
  function recolorPatch(id, v, im) {
    const I = spriteInfo(id), m = AA.SAD && AA.SAD[id], base = As.get('fish/' + id);
    if (!I || !m || !base) return im;
    const B = pixels(base).d.data, P = pixels(im), d = P.d.data, W = im.width, H = im.height;
    const ox = Math.round(m.r[0] * I.W), oy = Math.round(m.r[1] * I.H);
    const keep = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, p = i * 4, gx = x + ox, gy = y + oy;
      if (d[p + 3] === 0 || gx >= I.W || gy >= I.H) continue;
      const gi = gy * I.W + gx, q = gi * 4;
      const same = Math.abs(d[p] - B[q]) + Math.abs(d[p + 1] - B[q + 1]) + Math.abs(d[p + 2] - B[q + 2]) <= 30;   // am Rand des Pflasters: unverändertes Original
      if (I.mouthS[gi] || (same && I.mouth[gi])) { keep[i] = 1; mouthPixel(v, d[p], d[p + 1], d[p + 2]); }
      else if (I.eyeS[gi] || (same && I.eye[gi])) { keep[i] = 1; eyePixel(v, d[p], d[p + 1], d[p + 2], gx, gy, I, !same); }
      else mapPixel(v, d[p], d[p + 1], d[p + 2], gx, gy, I, false);
      d[p] = O[0]; d[p + 1] = O[1]; d[p + 2] = O[2];
    }
    if (v === 'night') paintStars(d, W, H, I, ox, oy, function (i) { return keep[i]; });
    P.g.putImageData(P.d, 0, 0);
    return P.c;
  }

  /* key = 'fish/<sprite>' oder 'sad/<sprite>'; v = Kennung der Variante (AA.VARIANTS) oder nichts */
  As.variant = function (key, v) {
    if (!v || !AA.VAR_BY[v]) return As.get(key);
    const ck = key + '|' + v;
    let c = lruGet(store, ck);
    if (c !== undefined) return c;
    const im = As.get(key);
    if (!im) return null;
    try { c = key.indexOf('sad/') === 0 ? recolorPatch(key.slice(4), v, im) : recolorSprite(key.slice(key.indexOf('/') + 1), v, im); }
    catch (e) { c = im; }                             // im Zweifel das normale Bild (z. B. wenn der Browser das Auslesen verweigert)
    return lruPut(store, ck, c || im, MAX);
  };
  /* kränklich-grüne Fassung – jetzt auch für Varianten */
  const plainTinted = As.tinted;
  As.tinted = function (key, v) {
    if (!v || !AA.VAR_BY[v]) return plainTinted(key);
    const ck = key + '|' + v + '|sick';
    let c = lruGet(store, ck);
    if (c !== undefined) return c;
    const im = As.variant(key, v);
    if (!im) return null;
    c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d');
    g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(120,168,72,0.45)'; g.fillRect(0, 0, c.width, c.height);
    return lruPut(store, ck, c, MAX);
  };
  /* kleines Vorschaubild als Data-URL (für <img> in Karte, Buch und Dialogen) */
  As.variantSrc = function (key, v, maxW) {
    if (!v || !AA.VAR_BY[v]) return As.src(key);
    maxW = maxW || 220;
    const ck = key + '|' + v + '|' + maxW;
    let u = lruGet(thumbs, ck);
    if (u) return u;
    const im = As.variant(key, v);
    if (!im) return As.src(key);
    const sc = Math.min(1, maxW / im.width), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(im.width * sc)); c.height = Math.max(1, Math.round(im.height * sc));
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, c.width, c.height);
    try { u = c.toDataURL('image/png'); } catch (e) { u = As.src(key); }
    return lruPut(thumbs, ck, u, MAX_THUMB);
  };
  As.variantStats = function () { return { canvases: store.size, infos: info.size, thumbs: thumbs.size }; };
  As.VAR_MAX = MAX;                                   // Runde 14: damit V.prewarm (js/tankview.js) den Merkspeicher nicht überfüllt
})(window.AA);
