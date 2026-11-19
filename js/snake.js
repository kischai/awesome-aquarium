/* Runde 20c: Seeschlangen – das Schlangen-Rig (rig.kind 'snake', Art-Flag def.snake).
   Der Kopf (die Schnauzenspitze H) schwimmt einem Zielpunkt hinterher wie ein lenkender Fisch: nur vorwärts, mit begrenztem Wendekreis.
   Der Zielpunkt liegt sonst vor der Körpermitte (dort, wo bei einem geraden Tier die Schnauze wäre) – die ganze übrige Spiel-Logik
   (Futter, Ziele, Balz, Grenzen) arbeitet weiter mit der Mitte. Der Weg des Kopfes wird als Spur gespeichert (alle paar Pixel ein Punkt);
   der Körper liegt Streifen für Streifen auf dieser Spur (Pfad-Verfolgung), darüber läuft eine Welle, die zum Schwanz hin wächst.
   So schlängelt sie sich durch Kurven, wendet in einem Bogen und kann sich am Boden zusammenringeln (der Kopf zieht eine flache
   Ellipse – von der Seite gesehen ein Ring –, der Körper folgt ihm).
   Bild: Kopf rechts, wie bei allen Fischen. Es wird einmal „gerade gezogen“: jede Spalte so verschoben, dass die Körpermitte auf einer
   Zeile liegt (das Bild selbst ist leicht gewellt). Der Kopf ab rig.neck und der Ruderschwanz (die letzten TAILW der Breite) sind starre
   Teile. Im Kopf-Rahmen liegt das ganze Bild an seinem Platz – Lider, Schmollmund, Tränen und die Wimpern des ♀ passen also wie sonst.
   Zeigt ein Stück nach links, wird es umgeklappt (mit etwas Spiel, damit es senkrecht nicht flattert): der Rücken bleibt oben.
   Verhalten (aus Fish.behave): alle 1–2 Minuten Luft holen (Kopf kurz aus dem Wasser, Kringel, Blasen beim Abtauchen), Züngeln,
   ab und zu ein Spurt, zusammengeringelt ruhen – am liebsten neben einem Felsen, nachts sowieso. Eier legen sie ganz normal. */
(function (AA) {
  'use strict';
  const TAU = Math.PI * 2, G = AA.G;
  const N = 36;                    // Körperstreifen zwischen Hals und Ruderschwanz
  const TAILW = 0.065;             // Ruderschwanz: die letzten 6,5 % der Bildbreite, ein starres Teil
  const LEN = 1.15;                // so viel Spur (× Körperlänge) wird gehalten
  const M = N + 3;                 // Punkte: [0] Schnauze, [1 … N+1] Hals bis Schwanzansatz, [N+2] Schwanzspitze
  const pcache = new WeakMap();
  const AS = new Float32Array(M), RAW = new Float32Array(2 * M), SP = new Float32Array(2 * M);
  const OWN = { breathe: 1, coil: 1, visit: 1, crevice: 1, dive: 1 };      // eigene Zustände der Schlangen (behave liefert dann ihr Ziel)

  function wrap(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }

  /* Bild vorbereiten: Körpermitte je Spalte (aus der Deckkraft, geglättet), daraus das gerade gezogene Bild; dazu Dicke und Schnauzenspitze */
  function prep(img) {
    let p = pcache.get(img);
    if (p) return p;
    const W = img.width, H = img.height;
    if (!W || !H) return null;
    const c0 = document.createElement('canvas'); c0.width = W; c0.height = H;
    const g0 = c0.getContext('2d'); g0.drawImage(img, 0, 0);
    let px = null;
    try { px = g0.getImageData(0, 0, W, H).data; } catch (e) { px = null; }
    const mid = new Float32Array(W), thick = new Float32Array(W);
    let last = H / 2, tipX = W - 1, tipY = H / 2;
    for (let x = 0; x < W; x++) {
      let t = -1, b = -1;
      if (px) for (let y = 0; y < H; y++) if (px[(y * W + x) * 4 + 3] > 128) { if (t < 0) t = y; b = y; }
      if (t >= 0) { mid[x] = (t + b) / 2; thick[x] = b - t; last = mid[x]; tipX = x; tipY = mid[x]; }
      else mid[x] = last;
    }
    const R = Math.max(3, Math.round(W / 110)), sm = new Float32Array(W);
    for (let x = 0; x < W; x++) { let s = 0, n = 0; for (let k = -R; k <= R; k++) { const q = x + k; if (q >= 0 && q < W) { s += mid[q]; n++; } } sm[x] = s / n; }
    let up = 0, dn = 0;
    for (let x = 0; x < W; x++) { up = Math.max(up, sm[x]); dn = Math.max(dn, H - sm[x]); }
    const cS = Math.ceil(up) + 1, Hs = cS + Math.ceil(dn) + 1;
    const can = document.createElement('canvas'); can.width = W; can.height = Hs;
    const g = can.getContext('2d');
    for (let x = 0; x < W; x++) g.drawImage(c0, x, 0, 1, H, x, Math.round(cS - sm[x]), 1, H);
    const arr = [];
    for (let x = Math.round(W * 0.15); x < W * 0.78; x++) if (thick[x] > 0) arr.push(thick[x]);
    arr.sort(function (a, b) { return a - b; });
    p = { can: can, cS: cS, Hs: Hs, mid: sm, W: W, H: H, band: arr.length ? arr[arr.length >> 1] : H * 0.5, tipX: tipX, tipY: tipY };
    pcache.set(img, p);
    return p;
  }

  /* Kopf-Stück ab kurz vor dem Hals, links weich ausgeblendet – so geht er bei jeder Biegung ohne Kante in den Körper über */
  function headCan(pr, img, neckX) {
    const key = Math.round(neckX), hc = pr.hc || (pr.hc = {});
    if (hc[key]) return hc[key];
    const F = 10, x0 = Math.max(0, key - F), w = pr.W - x0, c = document.createElement('canvas'); c.width = w; c.height = pr.H;
    const g = c.getContext('2d');
    g.drawImage(img, x0, 0, w, pr.H, 0, 0, w, pr.H);
    g.globalCompositeOperation = 'destination-in';
    const gr = g.createLinearGradient(0, 0, key - x0, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = gr; g.fillRect(0, 0, w, pr.H);
    return (hc[key] = { can: c, x0: x0 });
  }

  /* ---------- Zustand und Spur ---------- */
  function st(f) {
    let sn = f.sn;
    if (!sn) {
      const d0 = f.dir > 0 ? 1 : -1;
      sn = f.sn = { tr: [], th: d0 > 0 ? 0 : Math.PI, turn: 0, fl: new Int8Array(N + 1).fill(d0), hf: d0, D: null,
        airW: AA.rand(30, 75), coilW: AA.rand(25, 70), sprW: AA.rand(10, 30), sprT: 0, tongW: AA.rand(2, 7), tong: 0,
        br: null, cl: null, P: null, box: null, band: f.size() * 0.03 };
    }
    return sn;
  }
  function stepOf(s) { return Math.max(2.5, s / 64); }
  function reset(f, sn, hx, hy) {
    const s = f.size(), step = stepOf(s), n = Math.ceil(s * LEN / step) + 2, d0 = f.dir > 0 ? 1 : -1;
    sn.tr.length = 0;
    for (let i = 0; i < n; i++) sn.tr.push({ x: hx - d0 * i * step, y: hy });
    sn.th = d0 > 0 ? 0 : Math.PI; sn.turn = 0; sn.fl.fill(d0); sn.hf = d0;
  }
  function keep(sn, s) {                             // neuer Spurpunkt vorn, sobald der Kopf weit genug ist; hinten kappen bzw. gerade verlängern
    const tr = sn.tr, step = stepOf(s), h = tr[0], need = s * LEN;
    if (Math.hypot(h.x - tr[1].x, h.y - tr[1].y) >= step) tr.splice(1, 0, { x: h.x, y: h.y });
    let L = 0;
    for (let i = 1; i < tr.length; i++) {
      L += Math.hypot(tr[i].x - tr[i - 1].x, tr[i].y - tr[i - 1].y);
      if (L > need + step * 2 && i < tr.length - 1) { tr.length = i + 1; return; }
    }
    if (L < need) {
      const b = tr[tr.length - 1], a = tr[tr.length - 2];
      let ux = b.x - a.x, uy = b.y - a.y;
      const ul = Math.hypot(ux, uy);
      if (ul < 1e-3) { ux = -Math.cos(sn.th); uy = -Math.sin(sn.th); } else { ux /= ul; uy /= ul; }
      tr.push({ x: b.x + ux * (need - L + step), y: b.y + uy * (need - L + step) });
    }
  }
  function retract(sn, d) {                          // Kopf ein Stück zurück auf seiner eigenen Spur (der Körper rutscht mit)
    const tr = sn.tr;
    while (d > 0 && tr.length > 2) {
      const a = tr[0], b = tr[1], l = Math.hypot(b.x - a.x, b.y - a.y);
      if (l <= d) { a.x = b.x; a.y = b.y; tr.splice(1, 1); d -= l; }
      else { a.x += (b.x - a.x) * d / l; a.y += (b.y - a.y) * d / l; d = 0; }
    }
    const a = tr[0], b = tr[1];
    if (b && Math.hypot(a.x - b.x, a.y - b.y) > 0.01) sn.th = Math.atan2(a.y - b.y, a.x - b.x);
  }
  /* Punkte auf der Spur in den (aufsteigenden) Abständen AS[k] ab der Schnauze */
  function sample(tr, out) {
    let i = 1, acc = 0, seg = Math.hypot(tr[1].x - tr[0].x, tr[1].y - tr[0].y);
    for (let k = 0; k < M; k++) {
      const a = AS[k];
      while (acc + seg < a && i < tr.length - 1) { acc += seg; i++; seg = Math.hypot(tr[i].x - tr[i - 1].x, tr[i].y - tr[i - 1].y); }
      const p = tr[i - 1], q = tr[i], u = seg > 1e-6 ? Math.min(1, Math.max(0, (a - acc) / seg)) : 0;
      out[2 * k] = p.x + (q.x - p.x) * u; out[2 * k + 1] = p.y + (q.y - p.y) * u;
    }
  }
  function smooth(a) {                               // zweimal [1 2 1] / 4 über die Körperpunkte; Schnauze und Schwanzspitze bleiben
    for (let pass = 0; pass < 2; pass++) {
      let px = a[2], py = a[3];
      for (let k = 1; k < M - 1; k++) {
        const cx = a[2 * k], cy = a[2 * k + 1];
        a[2 * k] = (px + 2 * cx + a[2 * k + 2]) / 4; a[2 * k + 1] = (py + 2 * cy + a[2 * k + 3]) / 4;
        px = cx; py = cy;
      }
    }
  }
  function arcs(s, rig) {
    const aN = (1 - (rig.neck || 0.8)) * s, aT = (1 - TAILW) * s;
    AS[0] = 0;
    for (let k = 0; k <= N; k++) AS[k + 1] = aN + (aT - aN) * k / N;
    AS[M - 1] = s * 0.995;
  }
  /* Welle quer zur Spur: wächst vom Hals zum Schwanz, läuft nach hinten */
  function wave(src, out, s, rig, phase, A) {
    const nk = 1 - (rig.neck || 0.8);
    out[0] = src[0]; out[1] = src[1];
    for (let k = 1; k < M; k++) {
      const u = AS[k] / s, e = Math.pow(Math.max(0, (u - nk) / (1 - nk)), 1.15) * 0.88 + 0.12;
      const k1 = Math.min(M - 1, k + 1);
      let dx = src[2 * (k - 1)] - src[2 * k1], dy = src[2 * (k - 1) + 1] - src[2 * k1 + 1];
      const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const w = A * e * Math.sin(phase - u * TAU * 1.2);
      out[2 * k] = src[2 * k] - dy * w; out[2 * k + 1] = src[2 * k + 1] + dx * w;
    }
  }
  function headFlip(sn, ux) { let v = sn.hf; if (v > 0 && ux < -0.22) v = -1; else if (v < 0 && ux > 0.22) v = 1; sn.hf = v; return v; }
  /* Umklappen der Körperstreifen: wer deutlich nach links/rechts zeigt, entscheidet selbst; (fast) senkrechte Stücke übernehmen den
     Nachbarn zum Kopf hin – so gibt es pro Kurve genau eine Drehstelle statt einzelner verdrehter Streifen */
  function flips(sn, P, hf) {
    let prev = hf;
    for (let k = 0; k <= N; k++) {
      const i = k + 1, ux = P[2 * i] - P[2 * (i + 1)], l = Math.hypot(ux, P[2 * i + 1] - P[2 * (i + 1) + 1]) || 1, c = ux / l;
      prev = c < -0.22 ? -1 : (c > 0.22 ? 1 : prev);
      sn.fl[k] = prev;
    }
  }

  /* ---------- Zeichnen ---------- */
  function tongue(ctx, s, h, pr, sc, tg, t) {
    const k = Math.sin(Math.PI * AA.clamp(1 - tg / 0.32, 0, 1));        // 0,3 s: raus und wieder rein
    if (k <= 0.03) return;
    const x = pr.tipX * sc - s / 2 - s * 0.008, y = pr.tipY * sc - h / 2 + pr.band * sc * 0.14;
    const L = s * 0.075 * k, fk = s * 0.03 * k, wob = Math.sin(t * 55) * 0.35, ex = x + L, ey = y + Math.sin(t * 41) * s * 0.004;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey);
    ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(-0.5 + wob) * fk, ey + Math.sin(-0.5 + wob) * fk);
    ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(0.5 - wob) * fk, ey + Math.sin(0.5 - wob) * fk);
    ctx.strokeStyle = '#3a0d1a'; ctx.lineWidth = Math.max(2.8, s * 0.012); ctx.stroke();
    ctx.strokeStyle = '#ff4f6d'; ctx.lineWidth = Math.max(1.5, s * 0.0065); ctx.stroke();
    ctx.restore();
  }
  /* P: die Punkte (Welt- oder Bildkoordinaten); sn = Zustand (null in der Galerie: nie umklappen); opt: chomp, tong, t, face(ctx, s, h) */
  function render(ctx, img, pr, s, P, sn, rig, opt) {
    const W = pr.W, H = pr.H, sc = s / W, h = H * sc, neckX = (rig.neck || 0.8) * W, tailX = TAILW * W, segW = (neckX - tailX) / N;
    const bh = pr.band * sc * 0.5, cy = pr.cS * sc, hs = pr.Hs * sc, can = pr.can;
    let ux, uy, l, fv;
    // Kopf-Richtung zuerst (sie gibt beim Umklappen den Ton an)
    let hx = P[0] - P[2], hy = P[1] - P[3], hl = Math.hypot(hx, hy) || 1; hx /= hl; hy /= hl;
    { const nx = P[2] - P[4], ny = P[3] - P[5], nl = Math.hypot(nx, ny) || 1;      // etwas zur Halsrichtung hin: kein harter Knick hinter dem Kopf
      hx += 0.35 * nx / nl; hy += 0.35 * ny / nl; hl = Math.hypot(hx, hy) || 1; hx /= hl; hy /= hl; }
    const hfv = sn ? headFlip(sn, hx) : 1;
    if (sn) flips(sn, P, hfv);
    // Ruderschwanz (starr), zuerst – er liegt unter dem Körper
    ux = P[2 * (N + 1)] - P[2 * (N + 2)]; uy = P[2 * (N + 1) + 1] - P[2 * (N + 2) + 1]; l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
    fv = sn ? sn.fl[N] : 1;
    ctx.save(); ctx.transform(ux, uy, -uy * fv, ux * fv, P[2 * (N + 1)], P[2 * (N + 1) + 1]);
    ctx.drawImage(can, 0, 0, tailX + 2, pr.Hs, -tailX * sc, -cy, (tailX + 2) * sc, hs);
    ctx.restore();
    // Körper vom Schwanz zum Hals: jeder Streifen von Punkt k+2 (hinten) nach k+1 (vorn), etwas überlappend (außen in Kurven mehr)
    for (let k = N - 1; k >= 0; k--) {
      const ax = P[2 * (k + 1)], ay = P[2 * (k + 1) + 1], bx = P[2 * (k + 2)], by = P[2 * (k + 2) + 1];
      ux = ax - bx; uy = ay - by; l = Math.hypot(ux, uy);
      if (l < 0.01) continue;
      ux /= l; uy /= l;
      fv = sn ? sn.fl[k] : 1;
      let bend = 0;
      if (k > 0) { const qx = P[2 * k] - ax, qy = P[2 * k + 1] - ay, ql = Math.hypot(qx, qy) || 1; bend = Math.abs(Math.asin(AA.clamp((ux * qy - uy * qx) / ql, -1, 1))); }
      const ov = 0.8 + bh * Math.min(bend, 0.5), so = Math.min(segW, ov * segW / l), sx = neckX - (k + 1) * segW;
      ctx.save(); ctx.transform(ux, uy, -uy * fv, ux * fv, (ax + bx) / 2, (ay + by) / 2);
      ctx.drawImage(can, Math.max(0, sx - so), 0, Math.min(W, sx + segW + so) - Math.max(0, sx - so), pr.Hs, -l / 2 - ov, -cy, l + 2 * ov, hs);
      ctx.restore();
    }
    // Kopf (starr): am Hals angesetzt, zur Schnauze ausgerichtet; im Rahmen des ganzen Bildes (wie ein normaler Fisch)
    ux = hx; uy = hy; fv = hfv;
    ctx.save(); ctx.transform(ux, uy, -uy * fv, ux * fv, P[2], P[3]);
    if (opt.chomp > 0) { const c = Math.sin(opt.chomp * Math.PI); ctx.scale(1 + c * 0.05, 1 - c * 0.04); }
    ctx.translate(-(neckX * sc - s / 2), -(pr.mid[Math.min(W - 1, Math.round(neckX))] * sc - h / 2));
    if (opt.tong > 0) tongue(ctx, s, h, pr, sc, opt.tong, opt.t || 0);
    const hp = headCan(pr, img, neckX);
    ctx.drawImage(hp.can, 0, 0, W - hp.x0, H, -s / 2 + hp.x0 * sc, -h / 2, (W - hp.x0) * sc, h);
    if (opt.face) opt.face(ctx, s, h);
    ctx.restore();
  }

  function drawSnake(f, ctx, t, img) {
    const sn = st(f), pr = prep(img), rig = f.rig();
    if (!pr || sn.tr.length < 2) return false;
    const s = f.size(), d = f.d;
    if (!sn.P) sn.P = new Float32Array(2 * M);
    arcs(s, rig);
    sample(sn.tr, RAW);
    smooth(RAW);
    const amp = AA.clamp(f.amp, 0.12, 1.4) * (f.state === 'coil' && sn.cl && sn.cl.ph !== 'go' ? 0 : 1) * (d.sick ? 0.5 : 1);
    wave(RAW, sn.P, s, rig, f.phase * 0.8, s * 0.042 * amp);
    const P = sn.P, bh = pr.band * (s / pr.W) * 0.5;
    sn.band = bh;
    // nicht in den Kies, nicht über die Wasserlinie (nur der Kopf darf beim Luftholen hinaus)
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let k = 1; k < M; k++) {
      const x = P[2 * k];
      let y = P[2 * k + 1];
      const fy = AA.floorY(f.z, x) - bh * 0.55;
      if (y > fy) y = fy;
      if (k > 3 && f.state !== 'leave' && y < G.top + bh * 0.4) y = G.top + bh * 0.4;
      P[2 * k + 1] = y;
    }
    for (let k = 0; k < M; k++) { const x = P[2 * k], y = P[2 * k + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const hm = bh * 1.5;
    sn.box = [x0 - hm, y0 - hm, x1 + hm, y1 + hm];
    const key = f.key(), sad = f.sad(), shut = f.eyeShut || d.sick;
    render(ctx, img, pr, s, P, sn, rig, {
      chomp: f.chomp, tong: sn.tong, t: t,
      face: function (c, w, h) {
        if (sad) AA.drawSad(c, key, w, h, d.sick, t + f.seed, d.hunger <= 0.02 || d.sick, d.v);
        if (shut) AA.drawBlink(c, rig, w, h, d.v);
      }
    });
    return true;
  }

  /* Galerie, Laden, Steckbrief: gerade ausgestreckt, sanfte Welle; der Kopf sitzt genau da, wo er im Bild sitzt (Blinzeln passt) */
  AA.drawSnakeSprite = function (ctx, img, w, h, phase, rig, amp) {
    const pr = prep(img);
    if (!pr) { ctx.drawImage(img, -w / 2, -h / 2, w, h); return; }
    const s = w, sc = s / pr.W, y0 = pr.mid[Math.min(pr.W - 1, Math.round((rig.neck || 0.8) * pr.W))] * sc - pr.H * sc / 2;
    arcs(s, rig);
    for (let k = 0; k < M; k++) { RAW[2 * k] = s / 2 - AS[k]; RAW[2 * k + 1] = y0; }
    wave(RAW, SP, s, rig, phase * 0.8, s * 0.028 * AA.clamp(amp === undefined ? 0.6 : amp, 0, 1.2));
    render(ctx, img, pr, s, SP, null, rig, {});
  };

  /* ---------- Bewegung: der Kopf lenkt, die Spur wächst ---------- */
  function step(f, dt, V) {
    const sn = st(f), s = f.size();
    if (!(s > 1) || !(dt > 0)) return;
    if (!OWN[f.state]) { sn.D = null; sn.br = null; sn.cl = null; sn.ride = null; sn.back = 0; sn.vi = null; sn.cv = null; sn.dv = null; }
    const off = s * 0.49;
    let Dx = f.x + f.dir * off, Dy = f.y;
    if (f.def.surface && (f.state === 'wander' || f.state === 'nibble')) Dy = G.top + s * 0.03;   // Gelbbauch: liegt lang an der Oberfläche (der Körper-Mittelpunkt f.y hängt am Bildformat, nicht an der Schlange)
    if (sn.D) { Dx = sn.D.x; Dy = sn.D.y; }
    if (f.state === 'leave') { Dx = f.x; Dy = f.y - s * 0.3; }
    if (sn.ride && sn.tr.length > 1) {               // Einringeln: der Kopf fährt die Ringel-Linie ab, der Körper folgt
      const r = sn.ride, H = sn.tr[0], l0 = r.l;
      r.l = Math.max(0, r.l - r.v * dt);
      const q = onPath(r.pts, r.l, { x: 0, y: 0 }), p = onPath(r.pts, l0 + 0.5, { x: 0, y: 0 });
      H.x = q.x; H.y = q.y;
      if (Math.hypot(q.x - p.x, q.y - p.y) > 0.01) sn.th = Math.atan2(q.y - p.y, q.x - p.x);
      keep(sn, s);
      if (r.l <= 0) { sn.ride = null; sn.th = sn.cl && sn.cl.sg < 0 ? Math.PI : 0; }
      if (sn.tong > 0) sn.tong -= dt;
      return;
    }
    if (sn.back > 0 && sn.tr.length > 2) {          // nach dem Luftholen: Kopf erst zurück unter Wasser – dann ist Platz für den Bogen nach unten
      const d = Math.min(sn.back, s * 0.4 * dt);
      sn.back -= d; retract(sn, d); keep(sn, s);
      return;
    }
    if (sn.tr.length < 2 || Math.hypot(sn.tr[0].x - Dx, sn.tr[0].y - Dy) > s * 1.7) reset(f, sn, Dx, Dy);
    const H = sn.tr[0], dx = Dx - H.x, dy = Dy - H.y, dist = Math.hypot(dx, dy);
    const vc = Math.hypot(f.vx, f.vy), rMin = s * (f.def.surface && f.state === 'wander' ? 0.1 : 0.15);   // Gelbbauch: engere Wende an der Oberfläche (taucht dabei nicht so tief ab)
    let v = Math.min(dist * 2.6, 45 + vc * 1.7 + (f.state === 'flee' ? 160 : 0) + (f.state === 'leave' || f.state === 'enter' ? 420 : 0));
    if (dist < Math.max(1.5, s * 0.03)) v = 0;      // angekommen: stillhalten (sonst kreist der Kopf in Mini-Schleifen um den Punkt)
    if (v > 0) {
      const want = Math.atan2(dy, dx);
      let da = wrap(want - sn.th);
      if (Math.abs(da) > 2.5) {                      // Ziel (fast) genau hinter dem Kopf: Wende – Richtung festhalten, lieber dorthin, wo Platz ist
        if (!sn.turn) { const down = Math.cos(sn.th) >= 0 ? 1 : -1, mid = (G.top + AA.floorY(f.z, H.x)) / 2; sn.turn = H.y < mid ? down : -down; }
        da = sn.turn * Math.abs(da);
      } else if (Math.abs(da) < 1.4) sn.turn = 0;
      let om = v / rMin;
      if (dist < rMin * 2.5) om = Math.max(om, Math.abs(da) * 1.6);        // nah am Ziel: darf sich (langsam) auf der Stelle umsehen
      om = Math.min(om, 7);
      sn.th = wrap(sn.th + AA.clamp(da, -om * dt, om * dt));
      if (dist < rMin * 2.5 && Math.cos(wrap(want - sn.th)) < 0) v *= 0.15;   // dicht dahinter: erst drehen, dann schwimmen
      H.x += Math.cos(sn.th) * v * dt; H.y += Math.sin(sn.th) * v * dt;
    }
    if (f.state !== 'leave') {                       // im Wasser bleiben – nur beim Luftholen darf die Schnauze hinaus
      const lim = AA.xLimits(f.z), m = s * 0.02;
      H.x = AA.clamp(H.x, lim[0] + m, lim[1] - m);
      H.y = AA.clamp(H.y, f.state === 'breathe' ? G.top - s * 0.075 : G.top + s * (f.def.surface ? -0.015 : 0.02), AA.floorY(f.z, H.x) - s * 0.03);
    }
    keep(sn, s);
    // Züngeln: alle paar Sekunden, öfter beim Fressen und Erkunden
    if (sn.tong > 0) sn.tong -= dt;
    else if (!f.eyeShut && !f.d.sick && f.state !== 'leave' && f.state !== 'flee') {
      sn.tongW -= dt;
      if (sn.tongW <= 0) { sn.tong = 0.32; sn.tongW = AA.rand(4, 12) * (f.state === 'food' || f.state === 'curious' ? 0.35 : 1); }
    }
  }

  /* ---------- Verhalten ---------- */
  function endState(f, sn) { f.state = 'wander'; f.wait = 0.3; f.tx = f.x; f.ty = f.y; sn.D = null; sn.br = null; sn.cl = null; return null; }
  function startBreathe(f, sn, s) {
    const lim = AA.xLimits(f.z), m = s * 0.3, H = sn.tr[0];
    f.state = 'breathe';
    sn.br = { ph: 'up', t: 0, x: AA.clamp(H.x + f.dir * AA.rand(30, 140), lim[0] + m, lim[1] - m), hold: AA.rand(1.1, 1.8), rip: 0, bub: 0 };
    sn.airW = AA.rand(60, 120);
  }
  function breathe(f, sn, dt, V, s) {
    const b = sn.br, H = sn.tr[0];
    if (!b || !H) return endState(f, sn);
    b.t += dt;
    if (b.ph === 'up') {                             // hinauf: Kopf voran zur Oberfläche, der Körper hängt schräg nach unten
      sn.D = { x: b.x, y: G.top - s * 0.01 };
      if (H.y < G.top + s * 0.025 && Math.abs(H.x - b.x) < s * 0.3) { b.ph = 'air'; b.t = 0; V.ripple(H.x, G.top + 2); AA.audio.play('bubble'); f.say('😮‍💨', 1.3); }
      else if (b.t > 16) return endState(f, sn);
      return { tx: b.x - f.dir * s * 0.25, ty: G.top + s * 0.2, b: 1.6, r: 8 };
    }
    if (b.ph === 'air') {                            // Schnauze kurz aus dem Wasser, kleine Kringel
      sn.D = { x: H.x + Math.cos(sn.th) * 2, y: G.top - s * 0.1 };
      b.rip -= dt;
      if (b.rip <= 0) { b.rip = 0.45; V.ripple(H.x, G.top + 2); }
      if (b.t > b.hold) { b.ph = 'back'; b.t = 0; sn.back = s * 0.18; }
      return { tx: f.x, ty: f.y, b: 1, r: 10 };
    }
    if (b.ph === 'back') {                           // Kopf zurück unter Wasser (in step)
      sn.D = null;
      if (!(sn.back > 0) || b.t > 1.5) { sn.back = 0; b.ph = 'down'; b.t = 0; b.bub = 0; }
      return { tx: f.x, ty: f.y, b: 1, r: 10 };
    }
    sn.D = null;                                     // abtauchen, ein paar Blasen
    b.bub -= dt;
    if (b.t < 1.1 && b.bub <= 0) { b.bub = 0.09; V.addBubble(H.x, H.y, AA.rand(2, 4.5)); }
    if (b.t > 2.4) return endState(f, sn);
    return { tx: b.x + f.dir * s * 0.55, ty: G.top + s * 0.7, b: 1.4, r: 10 };
  }
  function startCoil(f, sn, V, tank, s) {
    let best = null, bd = 1e9;
    for (let i = 0; i < tank.deco.length; i++) {      // ein Felsen in der Nähe (sonst andere große Deko)
      const o = tank.deco[i], dd = AA.DECO_BY[o.type];
      if (!dd || dd.crawl || dd.path || dd.flat) continue;
      const rock = dd.cat === 'rock';
      if (!rock && (dd.w || 0) < 90) continue;
      const q = Math.abs(o.x - f.x) * (rock ? 1 : 1.7);
      if (q < bd) { bd = q; best = o; }
    }
    let x, z;
    if (best) { const b = V.decoBox(best), side = best.x > AA.W / 2 ? -1 : 1; x = b.cx + side * (b.w * 0.5 + s * 0.17); z = AA.clamp(best.z + 0.05, 0.02, 1); }
    else { x = f.x + AA.rand(-160, 160); z = f.z; }
    const lim = AA.xLimits(z), m = s * 0.28;
    f.state = 'coil';
    sn.cl = { ph: 'go', t: 0, x: AA.clamp(x, lim[0] + m, lim[1] - m), z: z, sg: best ? (best.x > AA.W / 2 ? -1 : 1) : (f.dir > 0 ? 1 : -1), neck: 0.8, pts: null, rest: 0, hx: 0, hy: 0 };
    sn.coilW = AA.rand(70, 150);
  }
  /* Ringel-Form, vom Kopf aus: der Kopf liegt vorn auf dem obersten Ring und schaut hinaus; dahinter windet sich der Körper in flachen
     Ringen (von der Seite gesehen Ellipsen) nach unten und außen – oben der kleinere, unten auf dem Boden der große Ring. Zum Einringeln
     schwimmt der Kopf diese Linie von hinten nach vorn ab (unten außen hinein, dann im Kreis nach oben) – der Körper folgt ihm wie immer.
     Liefert eine dichte Linie (x, y, l = Länge ab dem Kopf). */
  function coilPath(c, s, bh) {
    const sg = c.sg, R0 = s * 0.11, R1 = s * 0.17, q = 0.5, rise = bh * 1.35, need = s * 1.06, hl = s * (1 - c.neck) + s * 0.02;
    const raw = [];
    let l = 0, px = 0, py = 0;
    const add = function (x, y) { if (raw.length) l += Math.hypot(x - px, y - py); raw.push({ x: x, y: y, l: l }); px = x; py = y; };
    for (let i = 0; i <= 8; i++) add(sg * hl * (1 - i / 8), R0 * q - bh * 0.3 * (1 - i / 8));       // Kopf, leicht angehoben, vorn am obersten Ring
    let ph = Math.PI / 2, yc = 0, ry = R0 * q;
    while (l < need && ph < Math.PI / 2 + TAU * 3) {
      ph += 0.05;
      const u = Math.min(1, (ph - Math.PI / 2) / (TAU * 1.3)), rx = R0 + (R1 - R0) * u;
      ry = rx * q; yc = rise * (ph - Math.PI / 2) / TAU;
      add(sg * rx * Math.cos(ph), yc + ry * Math.sin(ph));
    }
    const floor = AA.floorY(c.z, c.x), dy = floor - bh * 0.95 - ry - yc;     // unten auf den Boden
    for (let i = 0; i < raw.length; i++) { raw[i].x += c.x; raw[i].y += dy; }
    return raw;
  }
  function onPath(pts, l, o) {
    let i = 1;
    while (i < pts.length - 1 && pts[i].l < l) i++;
    const a = pts[i - 1], b = pts[i], u = b.l > a.l ? AA.clamp((l - a.l) / (b.l - a.l), 0, 1) : 0;
    o.x = a.x + (b.x - a.x) * u; o.y = a.y + (b.y - a.y) * u;
    return o;
  }
  function coil(f, sn, dt, V, night, s) {
    const c = sn.cl, H = sn.tr[0];
    if (!c || !H) return endState(f, sn);
    c.t += dt;
    const bh = sn.band || s * 0.03, floor = AA.floorY(c.z, c.x);
    if (!c.pts) {
      c.neck = f.rig().neck || 0.8; c.pts = coilPath(c, s, bh); c.L = c.pts[c.pts.length - 1].l;
      const e = onPath(c.pts, c.L, { x: 0, y: 0 }), e2 = onPath(c.pts, c.L - 4, { x: 0, y: 0 }), ex = e2.x - e.x, ey = e2.y - e.y, el = Math.hypot(ex, ey) || 1;
      c.E = e; c.P = { x: e.x - ex / el * s * 0.14, y: Math.min(e.y - ey / el * s * 0.14, floor - bh * 1.2) };      // davor anschwimmen: dann kommt der Kopf schon in Fahrtrichtung an
    }
    if (c.ph === 'go' || c.ph === 'in') {            // hin zum Einstieg (unten außen am großen Ring), zuletzt in Fahrtrichtung
      const T = c.ph === 'go' ? c.P : c.E;
      sn.D = { x: T.x, y: T.y };
      if (c.ph === 'go' && (Math.hypot(H.x - T.x, H.y - T.y) < s * 0.05 || c.t > 20)) { c.ph = 'in'; c.t = 0; }
      else if (c.ph === 'in' && (Math.hypot(H.x - T.x, H.y - T.y) < s * 0.1 || c.t > 4)) {
        // los geht's: von der Kopfstelle ein gerades Stück zum Einstieg anhängen – kein Sprung, kein Kringeln um den Punkt
        const pts = c.pts.slice(), d = Math.hypot(H.x - T.x, H.y - T.y), n = Math.max(1, Math.ceil(d / 3));
        for (let i = 1; i <= n; i++) pts.push({ x: T.x + (H.x - T.x) * i / n, y: T.y + (H.y - T.y) * i / n, l: c.L + d * i / n });
        c.ph = 'wind'; c.t = 0; sn.ride = { pts: pts, l: c.L + d, v: s * 0.24 };
      }
      return { tx: T.x - f.dir * s * 0.3, ty: T.y, b: c.ph === 'go' ? 1.5 : 1.1, r: 6, z: c.z };
    }
    if (c.ph === 'wind') {                           // einringeln: der Kopf fährt die Linie ab (in step)
      sn.D = null;
      if (!sn.ride) { c.ph = 'rest'; c.t = 0; c.rest = night ? AA.rand(55, 100) : AA.rand(18, 42); c.hx = H.x; c.hy = H.y; }
      return { tx: c.x, ty: floor - s * 0.1, b: 1, r: 4, z: c.z };
    }
    f.resting = true;                                // ruhen (nachts bis zum Morgen)
    sn.D = { x: c.hx, y: c.hy };
    c.rest -= dt;
    if ((c.rest <= 0 && !night) || c.rest < -150) {  // aufwachen und geradeaus davon – der Körper wickelt sich hinter dem Kopf ab
      const lim = AA.xLimits(f.z);
      endState(f, sn);
      f.wait = 4.5; f.dir = c.sg; f.face = c.sg; f.turnT = 0.8; f.vx = c.sg * 12; f.vy = 0; f.x = H.x - c.sg * s * 0.45; f.y = H.y;
      f.tx = AA.clamp(H.x + c.sg * s * 0.7, lim[0] + s * 0.5, lim[1] - s * 0.5); f.ty = H.y - s * 0.3;
      return null;
    }
    return { tx: c.x, ty: floor - s * 0.1, b: 1, r: 4, z: c.z };
  }
  /* Belcher: schwimmt an einen Fisch heran, schaut ihm ins Gesicht und züngelt (der Fisch guckt verdutzt) */
  function startVisit(f, sn, V, s) {
    let best = null, bd = 1e9;                         // Runde 20f: der nächste Fisch im ganzen Becken (vorher nur im Umkreis von 520 px)
    for (let i = 0; i < V.fish.length; i++) {
      const o = V.fish[i];
      if (o === f || o.ghost || o.def.snake || o.def.venom || o.state === 'hide' || o.state === 'den' || o.state === 'enter' || o.state === 'leave') continue;
      const q = Math.hypot(o.x - sn.tr[0].x, o.y - sn.tr[0].y);
      if (q < bd) { bd = q; best = o; }
    }
    sn.nosyW = AA.rand(18, 40);
    if (!best) return false;
    f.state = 'visit'; sn.vi = { o: best, t: 0, at: 0, hold: AA.rand(2.2, 3.6) };
    return true;
  }
  function visit(f, sn, dt, V, s) {
    const v = sn.vi, H = sn.tr[0];
    if (!v || !H || V.fish.indexOf(v.o) < 0 || v.o.ghost) return endState(f, sn);
    const o = v.o, os = o.size(), fx = o.x + o.dir * (os * 0.5 + s * 0.05), fy = o.y;
    v.t += dt;
    sn.D = { x: fx, y: fy };
    if (Math.hypot(H.x - fx, H.y - fy) < s * 0.07) {
      if (!v.at) { f.say('👀', 1.4); o.say('😳', 1.2); }
      v.at += dt; sn.tongW = Math.min(sn.tongW, 0.5);
      if (v.at > v.hold) return endState(f, sn);
    }
    if (v.t > 14) return endState(f, sn);
    return { tx: fx - Math.cos(sn.th) * s * 0.45, ty: fy - Math.sin(sn.th) * s * 0.45, b: 1.5, r: 8, z: o.z };
  }
  /* Dubois: steckt den Kopf in einen Felsen (sie schwimmt dafür hinter ihn), zieht ihn wieder heraus – manchmal mit Snack */
  function startCrevice(f, sn, V, tank, s) {
    let best = null, bd = 1e9;
    for (let i = 0; i < tank.deco.length; i++) {        // ein Felsen, hoch genug, dass der Kopf dahinter verschwindet (sonst andere große Deko)
      const o = tank.deco[i], dd = AA.DECO_BY[o.type];
      if (!dd || dd.crawl || dd.path || dd.flat) continue;
      const rock = dd.cat === 'rock';
      if (!rock && (dd.w || 0) < 90) continue;
      const b = V.decoBox(o);
      if (b.h < s * 0.14 || b.w < s * 0.2) continue;
      const q = Math.abs(o.x - f.x) * (rock ? 1 : 1.8);
      if (q < bd) { bd = q; best = o; }
    }
    sn.crevW = AA.rand(25, 55);
    if (!best) return false;
    const b = V.decoBox(best), side = sn.tr[0].x < b.cx ? -1 : 1, y = b.by - b.h * 0.42;
    f.state = 'crevice';
    sn.cv = { o: best, ph: 'go', t: 0, z: AA.clamp(best.z - 0.08, 0.01, 1),
      P: { x: b.cx + side * (b.w * 0.5 + s * 0.16), y: y }, I: { x: b.cx + side * b.w * 0.08, y: y }, hold: AA.rand(3, 5) };
    return true;
  }
  function crevice(f, sn, dt, V, tank, s) {
    const c = sn.cv, H = sn.tr[0];
    if (!c || !H || tank.deco.indexOf(c.o) < 0) return endState(f, sn);
    c.t += dt;
    if (c.ph === 'go') {                             // davor, auf Höhe der Spalte (dahinter, damit der Fels den Kopf verdeckt)
      sn.D = c.P;
      if ((Math.hypot(H.x - c.P.x, H.y - c.P.y) < s * 0.06 && Math.abs(f.z - c.z) < 0.05) || c.t > 18) { c.ph = 'in'; c.t = 0; }
      return { tx: c.P.x - Math.cos(sn.th) * s * 0.45, ty: c.P.y, b: 1.3, r: 6, z: c.z };
    }
    if (c.ph === 'in') {                             // Kopf hinein und eine Weile suchen
      sn.D = c.I;
      if (Math.hypot(H.x - c.I.x, H.y - c.I.y) < s * 0.05) c.at = (c.at || 0) + dt;
      if ((c.at || 0) > c.hold || c.t > c.hold + 4) {
        c.ph = 'out'; c.t = 0; sn.back = s * 0.3;
        if (Math.random() < 0.35 && f.d.hunger < 0.99) { f.d.hunger = Math.min(1, f.d.hunger + 0.12); f.chomp = 1; f.say('😋', 1.3); }
      }
      return { tx: c.I.x - Math.cos(sn.th) * s * 0.45, ty: c.I.y, b: 1, r: 4, z: c.z };
    }
    sn.D = null;                                     // wieder heraus (rückwärts auf der eigenen Spur, in step)
    if (!(sn.back > 0) || c.t > 2) { sn.back = 0; return endState(f, sn); }
    return { tx: f.x, ty: f.y, b: 1, r: 6, z: c.z };
  }
  /* Gelbbauch: treibt an der Oberfläche; ab und zu taucht sie ein Stück ab (der Auftrieb holt sie wieder hoch) */
  function dive(f, sn, dt, V, s) {
    const d = sn.dv, H = sn.tr[0];
    if (!d || !H) return endState(f, sn);
    d.t += dt;
    if (d.t > d.T) return endState(f, sn);
    sn.D = { x: AA.clamp(d.x, AA.xLimits(f.z)[0] + s * 0.1, AA.xLimits(f.z)[1] - s * 0.1), y: d.y };
    return { tx: d.x - f.dir * s * 0.45, ty: d.y, b: 1.6, r: 10 };
  }
  function behave(f, dt, V, tank, night) {
    const sn = st(f), d = f.d, s = f.size(), P = V.pointer;
    if (!sn.tr.length) return null;
    const begging = V.tool === 'food' && P.inside && P.y < G.top + 280 && d.hunger < 0.92;
    if (f.ghost || d.sick || begging || V.photoMode) { if (OWN[f.state]) endState(f, sn); return null; }
    if (f.state === 'visit') return visit(f, sn, dt, V, s);
    if (f.state === 'crevice') return crevice(f, sn, dt, V, tank, s);
    if (f.state === 'dive') return dive(f, sn, dt, V, s);
    if (f.def.surface) {                             // Gelbbauch: kein Luftholen (sie ist ja oben), kein Einringeln, kein Spurt
      if (f.state !== 'wander') return null;
      sn.diveW = (sn.diveW === undefined ? AA.rand(20, 45) : sn.diveW) - dt;
      if (sn.diveW <= 0 && !night) {
        sn.diveW = AA.rand(30, 70);
        const bot = AA.floorY(f.z, f.x);
        f.state = 'dive'; sn.dv = { t: 0, T: AA.rand(3.5, 6), x: f.x + f.dir * AA.rand(160, 320), y: G.top + (bot - G.top) * AA.rand(0.35, 0.65) };
        return dive(f, sn, dt, V, s);
      }
      return null;
    }
    if (f.state === 'breathe') return breathe(f, sn, dt, V, s);
    sn.airW -= dt;
    if (f.state === 'coil') return coil(f, sn, dt, V, night, s);
    if (f.state !== 'wander') return null;
    if (f.def.nosy && !night) {
      sn.nosyW = (sn.nosyW === undefined ? AA.rand(12, 30) : sn.nosyW) - dt;
      if (sn.nosyW <= 0 && sn.airW > 8 && startVisit(f, sn, V, s)) return visit(f, sn, dt, V, s);
    }
    if (f.def.crevice && !night) {
      sn.crevW = (sn.crevW === undefined ? AA.rand(15, 35) : sn.crevW) - dt;
      if (sn.crevW <= 0 && sn.airW > 10 && startCrevice(f, sn, V, tank, s)) return crevice(f, sn, dt, V, tank, s);
    }
    sn.coilW -= dt; sn.sprW -= dt;
    if (sn.airW <= 0) { startBreathe(f, sn, s); return breathe(f, sn, dt, V, s); }
    if (night && sn.coilW > 8) sn.coilW = AA.rand(2, 8);
    if (sn.coilW <= 0 && d.hunger > 0.35) { startCoil(f, sn, V, tank, s); return coil(f, sn, dt, V, night, s); }
    if (sn.sprT > 0) { sn.sprT -= dt; return { tx: f.tx, ty: f.ty, b: 2.8, r: 8 }; }
    if (sn.sprW <= 0) {                              // Spurt: weit weg, flott
      sn.sprW = AA.rand(14, 36);
      if (!night) {
        const lim = AA.xLimits(f.z), m = s * 0.5, dr = f.x < (lim[0] + lim[1]) / 2 ? 1 : -1;
        sn.sprT = AA.rand(1.4, 2.6);
        f.tx = AA.clamp(f.x + dr * AA.rand(280, 520), lim[0] + m, lim[1] - m);
        f.ty = AA.clamp(f.y + AA.rand(-110, 110), G.top + s * 0.25, AA.floorY(f.z, f.x) - s * 0.15);
        f.wait = sn.sprT + 0.6;
      }
    }
    return null;
  }

  /* ---------- Treffer: am wirklichen Körper ---------- */
  function hit(f, x, y) {
    const sn = f.sn, P = sn && sn.P, b = sn && sn.box;
    if (!P || !b) return null;
    if (x < b[0] - 14 || x > b[2] + 14 || y < b[1] - 14 || y > b[3] + 14) return false;
    for (let k = 0; k < M; k++) if (Math.hypot(x - P[2 * k], y - P[2 * k + 1]) < Math.max(14, sn.band * (k < 2 ? 2.2 : 1.3) + 7)) return true;
    return false;
  }
  function gap(f, x, y) {
    const sn = f.sn, P = sn && sn.P;
    if (!P) return null;
    let best = 1e9;
    for (let k = 0; k < M; k++) best = Math.min(best, Math.hypot(x - P[2 * k], y - P[2 * k + 1]) - sn.band * (k < 2 ? 1.6 : 0.8));
    return best;
  }

  /* ---------- an den Fisch anschließen ---------- */
  const F = AA.Fish.prototype, up0 = F.update, bh0 = F.behave, hit0 = F.hit, gap0 = F.gap, mo0 = F.mouth, df0 = F.drawFish;
  F.update = function (dt, V, tank) {
    up0.call(this, dt, V, tank);
    if (!this.def.snake) return;
    if (this.state === 'leave') this.leaveT = (this.leaveT || 0) + dt;
    if (this.dead && this.state === 'leave' && this.sn && this.sn.tr.length && this.sn.tr[0].y + this.size() > -30 && this.leaveT < 8) this.dead = false;   // verkauft: erst weg, wenn auch der Schwanz draußen ist
    if (!this.dead) step(this, dt, V);
  };
  F.behave = function (dt, V, tank, night) {
    if (this.def.snake) { const o = behave(this, dt, V, tank, night); if (o) return o; }
    return bh0.call(this, dt, V, tank, night);
  };
  F.hit = function (x, y) { if (this.def.snake) { const r = hit(this, x, y); if (r !== null) return r; } return hit0.call(this, x, y); };
  F.gap = function (x, y) { if (this.def.snake) { const r = gap(this, x, y); if (r !== null) return r; } return gap0.call(this, x, y); };
  F.mouth = function () { if (this.def.snake && this.sn && this.sn.tr.length) { const H = this.sn.tr[0]; return { x: H.x, y: H.y }; } return mo0.call(this); };
  F.drawFish = function (ctx, t) {
    if (this.def.snake) { const img = this.img(); if (img && drawSnake(this, ctx, t, img)) return; }
    return df0.call(this, ctx, t);
  };
  AA.snakeInfo = function (f) { return f.sn ? { head: f.sn.tr[0] || null, box: f.sn.box, band: f.sn.band, turn: f.sn.turn, state: f.state, cl: f.sn.cl, br: f.sn.br } : null; };   // für Tests
})(window.AA);
