'use strict';
/* Awesome Aquarium – Runde 10: Einrichten wie ein Profi (Regeln, ohne Grafik).
     • Deko-Lager (s.storage): Stücke einlagern statt verkaufen und später in jedes Becken wieder einsetzen – Größe, Farbe, Drehung und
       Spiegelung bleiben erhalten. Krabbler dürfen auch in die Kiste, beim Auspacken zählt dann wieder ihr Wasser.
     • Deko-Modus: Raster, Drehen (o.r in Grad, ±45), Spiegeln, Ebene vor/zurück (o.l: verschiebt nur die Zeichen-Reihenfolge, nicht den
       Platz im Becken) und Duplizieren (kostet den Kaufpreis – die Kopie ist ein neuer Kauf).
     • Deko-Farben (o.c): Steine in den Farben ALLER Steine, die es im Spiel gibt (aus den Bildern ausgelesen, AA.STONE_PAL); Holz in fünf
       Holztönen; alles andere in vier Farbtönen. Umgefärbt wird beim Zeichnen (Canvas) – es braucht keine neuen Bilder.
     • Seitenscheiben: kein Stück ragt mehr in die Seitenscheiben (AA.decoClampX rechnet mit der Tiefe und der Drehung).
     • Schönheits-Note 0–100 je Becken (AA.beauty); die beste zählt in der Familien-Rangliste (s.beauty).
   Oberfläche: js/decorui.js · Regeln in Worten: docs/MECHANIK.md § 6g */
(function (AA) {
  const B = AA.BAL;
  function S() { return AA.state; }
  B.maxStore = 300;                                   // so viele Stücke passen ins Lager (Runde 14: vorher 150)
  AA.ROT = { step: 15, max: 45 };                     // Drehen in 15°-Schritten, höchstens ±45°
  AA.GRID = { x: 16, z: 0.05 };                       // Raster im Deko-Modus: 16 Pixel quer, 5 % Tiefe

  /* ---------- Holz oder Stein? ---------- */
  ['driftwood', 'log', 'stump', 'woodslice', 'jetty', 'rootarch'].forEach(function (id) { if (AA.DECO_BY[id]) AA.DECO_BY[id].wood = true; });
  ['moai', 'columns', 'crystals'].forEach(function (id) { if (AA.DECO_BY[id]) AA.DECO_BY[id].stone = true; });

  /* ---------- Farben ----------
     Steine: die Farbtöne aller Steine im Spiel (dunkel → hell), Runde 10 aus den Bildern ausgelesen (k-means über die deckenden Pixel). */
  AA.STONE_PAL = [
    { id: 'grey', name: 'Grauer Fels', cols: ['#68505f', '#6e5565', '#806575', '#947788', '#b99dac'] },
    { id: 'brown', name: 'Felshaufen', cols: ['#4f3733', '#573d39', '#624540', '#694c46', '#8a6d66'] },
    { id: 'bluegrey', name: 'Steinbrücke', cols: ['#5c6074', '#70758b', '#858ba0', '#8c92a7', '#aaaec1'] },
    { id: 'slate', name: 'Schiefer', cols: ['#333b49', '#39404e', '#485162', '#626c80', '#838da1'] },
    { id: 'sand', name: 'Tafelfels', cols: ['#a47153', '#b27e5b', '#ba8760', '#c8966b', '#e2b589'] },
    { id: 'taupe', name: 'Stufenfels', cols: ['#604c4a', '#6e5856', '#806967', '#8b7472', '#a38c89'] },
    { id: 'basalt', name: 'Basalt', cols: ['#433943', '#4b3f49', '#544651', '#685964', '#877682'] },
    { id: 'lava', name: 'Lavastein', cols: ['#30262e', '#463a43', '#54464f', '#61525c', '#6d5e67'] },
    { id: 'moai', name: 'Steinkopf', cols: ['#5a4645', '#695554', '#876e6f', '#a38888', '#c1a6a4'] },
    { id: 'amethyst', name: 'Amethyst', cols: ['#794093', '#8b43ad', '#a558cb', '#b76cdb', '#d19ee7'] },
    { id: 'marble', name: 'Atlantis-Marmor', cols: ['#9d8d8a', '#b3a3a0', '#cbbcb6', '#e2d7d3', '#f3ece9'] }
  ];
  AA.WOOD_PAL = [
    { id: 'silver', name: 'Silberholz', cols: ['#3f4146', '#55575d', '#6f7178', '#8d8f95', '#b9bbbf'] },
    { id: 'bog', name: 'Moorkien', cols: ['#22160f', '#2f1f16', '#3f2b1e', '#523a28', '#6f5038'] },
    { id: 'mahogany', name: 'Mahagoni', cols: ['#3d1712', '#55211a', '#6e2d22', '#87392b', '#ad5a43'] },
    { id: 'birch', name: 'Birke', cols: ['#7a6248', '#977c5d', '#b39874', '#ccb38d', '#e6d3b0'] }
  ];
  AA.HUE_PAL = [{ id: 'h60', name: 'Farbton 1', deg: 60 }, { id: 'h140', name: 'Farbton 2', deg: 140 }, { id: 'h210', name: 'Farbton 3', deg: 210 }, { id: 'h290', name: 'Farbton 4', deg: 290 }];
  const PAL_BY = {};
  AA.STONE_PAL.forEach(function (p) { p.kind = 'map'; PAL_BY[p.id] = p; });
  AA.WOOD_PAL.forEach(function (p) { p.kind = 'map'; PAL_BY[p.id] = p; });
  AA.HUE_PAL.forEach(function (p) { p.kind = 'hue'; PAL_BY[p.id] = p; });
  AA.PAL_BY = PAL_BY;
  /* Welche Farben ein Stück haben kann: 'stone' | 'wood' | 'hue' | null (Tiere, Schatzkiste, Blubber-Muschel: nie) */
  AA.decoPalKind = function (def) {
    if (!def || def.crawl || def.daily || def.fixed || def.alive || def.noColor) return null;
    if (def.wood) return 'wood';
    if (def.stone || def.cat === 'rock') return 'stone';
    return 'hue';
  };
  AA.decoPals = function (def) {
    const k = AA.decoPalKind(def);
    return k === 'stone' ? AA.STONE_PAL : (k === 'wood' ? AA.WOOD_PAL : (k === 'hue' ? AA.HUE_PAL : []));
  };
  AA.decoPalOk = function (def, c) { return !!c && AA.decoPals(def).some(function (p) { return p.id === c; }); };

  function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function hsv(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : (mx === g ? (b - r) / d + 2 : (r - g) / d + 4);
    h *= 60; if (h < 0) h += 360;
    return [h, mx ? d / mx : 0, mx / 255];
  }
  function fromHsv(h, s, v, out) {
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    out[0] = (r + m) * 255; out[1] = (g + m) * 255; out[2] = (b + m) * 255;
  }
  function hueDist(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
  /* Verlaufs-Abbildung: die Helligkeit jedes Stein- (oder Holz-)Pixels wird auf die Farbtöne der Ziel-Palette gelegt. Moos, Lava-Risse,
     Kristalle, Korallen-Flecken (andere, kräftige Farben) bleiben, wie sie sind. */
  function mapPixels(d, cols) {
    const n = d.length / 4, hist = new Float32Array(36);
    for (let i = 0; i < n; i++) {
      const a = d[i * 4 + 3]; if (a < 128) continue;
      const q = hsv(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      if (q[1] >= 0.06 && q[1] <= 0.62) hist[Math.floor(q[0] / 10) % 36] += 1;
    }
    let main = -1, best = 0;
    for (let k = 0; k < 36; k++) { const v = hist[k] + 0.5 * (hist[(k + 35) % 36] + hist[(k + 1) % 36]); if (v > best) { best = v; main = k * 10 + 5; } }
    const mask = new Uint8Array(n), lum = new Float32Array(n), lh = new Float32Array(256);
    for (let i = 0; i < n; i++) {
      const a = d[i * 4 + 3]; if (!a) continue;
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], q = hsv(r, g, b);
      if (q[1] < 0.16 || (main >= 0 && hueDist(q[0], main) < 38 && q[1] < 0.66)) {
        mask[i] = 1; const L = 0.299 * r + 0.587 * g + 0.114 * b; lum[i] = L; lh[Math.min(255, L | 0)] += a / 255;
      }
    }
    let tot = 0; for (let k = 0; k < 256; k++) tot += lh[k];
    let lo = 0, hi = 255, acc = 0;
    for (let k = 0; k < 256; k++) { acc += lh[k]; if (acc >= tot * 0.02) { lo = k; break; } }
    acc = 0; for (let k = 255; k >= 0; k--) { acc += lh[k]; if (acc >= tot * 0.02) { hi = k; break; } }
    if (hi - lo < 8) hi = lo + 8;
    const C = cols.map(hex), m = C.length - 1;
    for (let i = 0; i < n; i++) {
      if (!mask[i]) continue;
      const t = Math.max(0, Math.min(1, (lum[i] - lo) / (hi - lo))) * m, j = Math.min(m - 1, Math.floor(t)), f = t - j;
      d[i * 4] = C[j][0] + (C[j + 1][0] - C[j][0]) * f; d[i * 4 + 1] = C[j][1] + (C[j + 1][1] - C[j][1]) * f; d[i * 4 + 2] = C[j][2] + (C[j + 1][2] - C[j][2]) * f;
    }
  }
  function huePixels(d, deg) {
    const out = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const q = hsv(d[i], d[i + 1], d[i + 2]);
      if (q[1] < 0.08) continue;
      fromHsv((q[0] + deg) % 360, q[1], q[2], out);
      d[i] = out[0]; d[i + 1] = out[1]; d[i + 2] = out[2];
    }
  }
  const tintCache = {};
  /* Umgefärbte Fassung eines Bildes (Canvas, gemerkt). key = Bild-Schlüssel (deco/…, hd/…), c = Paletten-Kennung. null = geht nicht. */
  AA.tinted = function (img, key, c) {
    const p = PAL_BY[c];
    if (!img || !p) return null;
    const k = key + '|' + c;
    if (tintCache[k] !== undefined) return tintCache[k];
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h) return null;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    let id;
    try { id = cx.getImageData(0, 0, w, h); } catch (e) { tintCache[k] = null; return null; }       // fremde Quelle: dann eben im Original
    if (p.kind === 'hue') huePixels(id.data, p.deg); else mapPixels(id.data, p.cols);
    cx.putImageData(id, 0, 0);
    tintCache[k] = cv;
    return cv;
  };
  /* Bild eines Stücks in seiner Farbe (für die Oberfläche): kleine Vorschau als data-URL */
  const thumbCache = {};
  AA.decoThumb = function (type, c, size) {
    const key = 'deco/' + type, img = AA.assets.get(key);
    if (!c || !PAL_BY[c]) return AA.assets.src(key);
    const k = type + '|' + c + '|' + (size || 96);
    if (thumbCache[k]) return thumbCache[k];
    if (!img) return AA.assets.src(key);
    const t = AA.tinted(img, key, c);
    if (!t) return AA.assets.src(key);
    const sz = size || 96, sc = Math.min(1, sz / Math.max(t.width, t.height)), cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(t.width * sc)); cv.height = Math.max(1, Math.round(t.height * sc));
    cv.getContext('2d').drawImage(t, 0, 0, cv.width, cv.height);
    try { thumbCache[k] = cv.toDataURL('image/png'); } catch (e) { return AA.assets.src(key); }
    return thumbCache[k];
  };
  /* Farbtupfer für die Auswahl: die mittlere kräftige Farbe des umgefärbten Bildes (für Steine einfach der mittlere Ton der Palette) */
  const swatchCache = {};
  AA.decoSwatch = function (type, c) {
    const p = PAL_BY[c];
    if (!p) return null;
    if (p.kind === 'map') return p.cols[3] || p.cols[p.cols.length - 1];
    const k = type + '|' + c;
    if (swatchCache[k]) return swatchCache[k];
    const img = AA.assets.get('deco/' + type), t = img && AA.tinted(img, 'deco/' + type, c);
    if (!t) return '#888';
    const cv = document.createElement('canvas'); cv.width = 24; cv.height = 24;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(t, 0, 0, 24, 24);
    let r = 0, g = 0, b = 0, n = 0;
    try {
      const d = cx.getImageData(0, 0, 24, 24).data;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; const q = hsv(d[i], d[i + 1], d[i + 2]); const wgt = 0.2 + q[1]; r += d[i] * wgt; g += d[i + 1] * wgt; b += d[i + 2] * wgt; n += wgt; }
    } catch (e) { return '#888'; }
    if (!n) return '#888';
    swatchCache[k] = 'rgb(' + Math.round(r / n) + ',' + Math.round(g / n) + ',' + Math.round(b / n) + ')';
    return swatchCache[k];
  };
  AA.setDecoColor = function (o, c) {
    const def = AA.DECO_BY[o.type];
    if (!c) delete o.c; else if (AA.decoPalOk(def, c)) o.c = c; else return false;
    AA.emit('decoChanged', o);
    return true;
  };

  /* ---------- Drehen, Spiegeln, Ebenen ---------- */
  AA.decoCanTurn = function (def) { return !!def && !def.crawl && !def.daily && !def.fixed && !def.path; };      // Wege liegen flach: drehen ginge nur im Raum
  AA.rotateDeco = function (o, dir) {
    const def = AA.DECO_BY[o.type];
    if (!AA.decoCanTurn(def)) return false;
    const r = AA.clamp(Math.round(((o.r || 0) + dir * AA.ROT.step) / 5) * 5, -AA.ROT.max, AA.ROT.max);
    if (r === (o.r || 0)) return false;
    if (r) o.r = r; else delete o.r;
    AA.unstackFrom(AA.tank(), o);                     // auf einer schiefen Fläche steht nichts mehr
    AA.decoClampX(o);
    AA.emit('decoChanged', o);
    return true;
  };
  /* Ebene: o.l verschiebt nur die Reihenfolge beim Zeichnen (vor/hinter Stücke, die sich mit diesem überschneiden). */
  AA.decoKey = function (o) { return o.z + (o.l || 0); };
  AA.layerDeco = function (o, dir) {
    const V = AA.view, t = AA.tank(), def = AA.DECO_BY[o.type];
    if (!V || !AA.decoCanTurn(def)) return 'no';
    const b = V.decoBox(o), me = AA.decoKey(o);
    let pick = null;
    for (let i = 0; i < t.deco.length; i++) {
      const q = t.deco[i], qd = AA.DECO_BY[q.type];
      if (q === o || qd.crawl) continue;
      const c = V.decoBox(q);
      if (c.x > b.x + b.w || c.x + c.w < b.x || c.y > b.by || c.by < b.y) continue;      // überschneidet sich nicht
      const k = AA.decoKey(q);
      if (dir > 0 && k >= me && (pick === null || k < pick)) pick = k;
      if (dir < 0 && k <= me && (pick === null || k > pick)) pick = k;
    }
    if (pick === null) return dir > 0 ? 'front' : 'back';
    const want = pick + dir * 0.0006, l = Math.round((want - o.z) * 100000) / 100000;
    if (Math.abs(l) > 0.6) return dir > 0 ? 'front' : 'back';
    if (Math.abs(l) < 0.00001) delete o.l; else o.l = l;
    AA.emit('decoChanged', o);
    return true;
  };

  /* ---------- Seitenscheiben ----------
     Halbe Breite links/rechts vom Fußpunkt (Pixel, mit Tiefe, Größe und Drehung um den Fußpunkt). */
  AA.decoExtent = function (o) {
    const def = AA.DECO_BY[o.type], img = AA.assets.get('deco/' + o.type);
    const sc = AA.depthScale(o.z) * AA.decoScale(o), w = def.w * sc, h = w * (img ? img.height / img.width : 0.8), hw = w / 2;
    const r = (o.r || 0) * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
    return { l: hw * c + Math.max(0, -h * sn), r: hw * c + Math.max(0, h * sn), w: w, h: h };
  };
  const clamp0 = AA.decoClampX;
  AA.decoClampX = function (o) {
    const def = AA.DECO_BY[o.type];
    if (!def || def.crawl || !AA.wallX || !AA.view || !AA.view.depthPx) return clamp0(o);
    const e = AA.decoExtent(o), L = AA.wallX(-1, o.z) + 3 + e.l, R = AA.wallX(1, o.z) - 3 - e.r;
    o.x = L <= R ? AA.clamp(o.x, L, R) : (L + R) / 2;
  };
  /* alle Stücke des Beckens an die Scheiben anpassen (beim Wechsel ins Becken – die Tiefe hängt an der Beckengröße) */
  AA.clampTankDeco = function (t) {
    t = t || AA.tank();
    if (t !== AA.tank()) return;
    for (let i = 0; i < t.deco.length; i++) { const o = t.deco[i]; if (!o.on && !AA.DECO_BY[o.type].crawl) AA.decoClampX(o); }
  };

  /* ---------- Duplizieren: ein neuer Kauf desselben Stücks, gleich eingestellt, direkt daneben ---------- */
  AA.dupPrice = function (o) { const def = AA.DECO_BY[o.type]; return def ? def.price : 0; };
  AA.dupStatus = function (o) {
    const s = S(), t = AA.tank(), def = AA.DECO_BY[o.type];
    if (!def || def.daily || def.unique || def.fixed || def.trophy) return 'unique';      // Pokale lassen sich nicht vervielfältigen
    if (s.level < def.lvl) return 'level';
    if (!AA.decoFits(def, t)) return 'water';
    if (!AA.decoRoom(t, def)) return def.crawl ? 'crawlfull' : 'decofull';
    if (s.coins < def.price) return 'coins';
    return 'ok';
  };
  AA.dupDeco = function (o) {
    const s = S(), t = AA.tank(), def = AA.DECO_BY[o.type], st = AA.dupStatus(o);
    if (st !== 'ok') return st;
    AA.addCoins(-def.price, false);
    s.stats.decoBought++; s.stats.spentDeco += def.price;
    const e = def.crawl ? { w: def.w } : AA.decoExtent(o), side = o.x > AA.W / 2 ? -1 : 1;
    const c = { id: AA.uid(), type: o.type, x: o.x + side * Math.max(40, e.w * 0.7), z: AA.clamp(o.z + 0.04, 0, 1), flip: !!o.flip };
    if (o.s !== undefined) c.s = o.s;
    if (o.c) c.c = o.c;
    if (o.r) c.r = o.r;
    if (def.crawl) { c.x = AA.clamp(c.x, 60, AA.W - 60); }
    t.deco.push(c);
    AA.decoClampX(c);
    AA.emit('decoAdded', c, t);
    AA.checkMedals();
    return c;
  };

  /* ---------- Lager ---------- */
  function cleanItem(it) {
    const def = it && AA.DECO_BY[it.type];
    if (!def || def.daily || def.fixed) return null;
    const o = { type: it.type };
    if (it.s !== undefined) { const r = AA.decoRange(def), v = +it.s; if (r && v > 0 && isFinite(v) && Math.abs(v - 1) >= 0.005) o.s = AA.clamp(Math.round(v * 100) / 100, r[0], r[1]); }
    if (it.c && AA.decoPalOk(def, it.c)) o.c = it.c;
    if (it.r && AA.decoCanTurn(def)) o.r = AA.clamp(Math.round(+it.r || 0), -AA.ROT.max, AA.ROT.max) || undefined;
    if (o.r === undefined) delete o.r;
    if (it.f) o.f = 1;
    return o;
  }
  AA.decorFix = function (s) {
    s.storage = (Array.isArray(s.storage) ? s.storage : []).map(cleanItem).filter(Boolean).slice(0, B.maxStore);
    s.tanks.forEach(function (t) {
      t.deco.forEach(function (o) {
        const def = AA.DECO_BY[o.type];
        if (o.c !== undefined && !AA.decoPalOk(def, o.c)) delete o.c;
        if (o.r !== undefined) { const r = AA.clamp(Math.round(+o.r || 0), -AA.ROT.max, AA.ROT.max); if (r && AA.decoCanTurn(def)) o.r = r; else delete o.r; }
        if (o.l !== undefined) { const l = +o.l; if (l && isFinite(l) && Math.abs(l) <= 0.6) o.l = l; else delete o.l; }
      });
    });
    if (s.beauty !== undefined && !(s.beauty >= 0 && s.beauty <= 100)) delete s.beauty;
  };
  AA.storeCount = function () { return S().storage.length; };
  AA.storeDeco = function (o) {
    const s = S(), t = AA.tank(), i = t.deco.indexOf(o), def = AA.DECO_BY[o.type];
    if (i < 0 || !def || def.daily || def.fixed) return 'unknown';
    if (s.storage.length >= B.maxStore) return 'storefull';
    AA.unstackFrom(t, o);
    t.deco.splice(i, 1);
    const it = cleanItem({ type: o.type, s: o.s, c: o.c, r: o.r, f: o.flip ? 1 : 0 });
    s.storage.push(it);
    AA.emit('decoRemoved', o);
    AA.emit('storage');
    return true;
  };
  /* Gruppen fürs Lager-Regal: gleiches Stück in gleicher Farbe liegt auf einem Stapel (n = Anzahl, i = Index des obersten) */
  AA.storeGroups = function () {
    const g = {}, out = [];
    S().storage.forEach(function (it, i) {
      const k = it.type + '|' + (it.c || '');
      if (!g[k]) { g[k] = { key: k, type: it.type, c: it.c || '', n: 0, i: i }; out.push(g[k]); }
      g[k].n++; g[k].i = i;
    });
    return out;
  };
  AA.unstoreStatus = function (i, t) {
    const it = S().storage[i], def = it && AA.DECO_BY[it.type];
    t = t || AA.tank();
    if (!def) return 'unknown';
    if (!AA.decoFits(def, t)) return 'water';
    if (!AA.decoRoom(t, def)) return def.crawl ? 'crawlfull' : 'decofull';
    return 'ok';
  };
  /* Stück i aus dem Lager ins aktive Becken: an (x, z) oder – ohne Angabe – an einen freien Platz */
  AA.unstore = function (i, x, z) {
    const s = S(), t = AA.tank(), st = AA.unstoreStatus(i, t);
    if (st !== 'ok') return st;
    const it = s.storage.splice(i, 1)[0], def = AA.DECO_BY[it.type];
    let o;
    if (x === undefined) { o = AA.placeDeco(it.type, t); if (!o) { s.storage.splice(i, 0, it); return 'decofull'; } }
    else { o = { id: AA.uid(), type: it.type, x: x, z: AA.clamp(z, 0, 1), flip: false }; t.deco.push(o); }
    o.flip = !!it.f;
    if (it.s !== undefined) o.s = it.s;
    if (it.c) o.c = it.c;
    if (it.r) o.r = it.r;
    if (def.crawl) o.x = AA.clamp(o.x, 60, AA.W - 60); else AA.decoClampX(o);
    if (x !== undefined) AA.emit('decoAdded', o, t);
    AA.emit('storage');
    return o;
  };

  /* ---------- Schönheits-Note ----------
     0–100 Punkte, beim Einrichten live im Deko-Modus zu sehen. Was zählt (höchstens):
       Vielfalt 20 (verschiedene Deko-Stücke, voll ab 8) · Pflanzen & Korallen 15 (voll ab 5) · Steine & Holz 10 (voll ab 3)
       Prestige-Stück 10 · Verteilung 10 (links/Mitte/rechts je 2, vorn und hinten je 2) · Fischarten 10 (voll ab 6)
       Besatz 5 (voll ab 60 % belegt) · Sauberkeit 10 · eigene Kulisse und eigener Boden 5 · Biotop 5 */
  AA.BEAUTY = { types: 8, plants: 5, rocks: 3, species: 6, fill: 0.6 };
  AA.BEAUTY_WORDS = [[90, 'Traumbecken', '🌟'], [75, 'Wunderschön', '💎'], [60, 'Sehr hübsch', '✨'], [40, 'Gemütlich', '🙂'], [20, 'Ausbaufähig', '🌱'], [0, 'Noch ziemlich kahl', '🪨']];
  AA.beauty = function (t) {
    const K = AA.BEAUTY, types = {}, sp = {};
    let plants = 0, rocks = 0, prestige = 0, n = 0, thirds = [0, 0, 0], back = 0, front = 0;
    t.deco.forEach(function (o) {
      const def = AA.DECO_BY[o.type];
      if (!def || def.crawl) return;
      n++; types[o.type] = 1;
      if (def.cat === 'plant') plants++;
      if (def.cat === 'rock') rocks++;
      if (def.prestige) prestige++;
      thirds[Math.max(0, Math.min(2, Math.floor(o.x / (AA.W / 3))))] = 1;
      if (o.z < 0.45) back = 1; else front = 1;
    });
    t.fish.forEach(function (f) { sp[f.sp] = 1; });
    const nt = Object.keys(types).length, ns = Object.keys(sp).length, cap = AA.cap(t) || 1;
    const bio = AA.bioTier ? AA.bioTier(t) : null;
    const p = {
      vielfalt: 20 * Math.min(1, nt / K.types),
      pflanzen: 15 * Math.min(1, plants / K.plants),
      steine: 10 * Math.min(1, rocks / K.rocks),
      prestige: prestige ? 10 : 0,
      verteilung: (thirds[0] + thirds[1] + thirds[2]) * 2 + (n ? (back + front) * 2 : 0),
      fischarten: 10 * Math.min(1, ns / K.species),
      besatz: 5 * Math.min(1, (t.fish.length / cap) / K.fill),
      sauber: 10 * (1 - AA.clamp(t.dirt || 0, 0, 1)),
      kulisse: (t.floor !== 'sand' ? 2.5 : 0) + (t.wall !== 'aqua' ? 2.5 : 0),
      biotop: bio ? 5 : 0
    };
    if (AA.beautyExtra) { const x = AA.beautyExtra(t); p.licht = x.licht; p.pokale = x.pokale; }      // Runde 12: Licht-Studio und Pokale (js/extras.js)
    let sum = 0; for (const k in p) { p[k] = Math.round(p[k] * 10) / 10; sum += p[k]; }
    return { score: Math.max(0, Math.min(100, Math.round(sum))), parts: p };
  };
  AA.beautyWord = function (v) { for (let i = 0; i < AA.BEAUTY_WORDS.length; i++) if (v >= AA.BEAUTY_WORDS[i][0]) return AA.BEAUTY_WORDS[i]; return AA.BEAUTY_WORDS[AA.BEAUTY_WORDS.length - 1]; };
  AA.beautyBest = function (s) {
    s = s || S();
    let best = 0, idx = 0;
    s.tanks.forEach(function (t, i) { const b = AA.beauty(t).score; if (b > best) { best = b; idx = i; } });
    return { score: best, tank: idx };
  };
  /* bei jedem Speichern die beste Note mitschreiben – so sieht die Familie sie in der Rangliste (die Wolke liest s.beauty) */
  const save0 = AA.save;
  AA.save = function () {
    const s = AA.state;
    if (s && !AA.visit && !AA.frozen) { try { s.beauty = AA.beautyBest(s).score; } catch (e) { /* egal */ } }
    return save0.apply(this, arguments);
  };

  /* Cheats zum Ausprobieren (Konsole) */
  AA.cheat = AA.cheat || {};
  AA.cheat.store = function (type, n) { for (let i = 0; i < (n || 1); i++) S().storage.push({ type: type || 'rock_grey' }); AA.emit('storage'); return S().storage.length; };
})(window.AA);
