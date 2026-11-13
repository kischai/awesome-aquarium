'use strict';
/* Awesome Aquarium – Rahmen für die Minispiele (Training, Schatzsuche): eigene Zeichenfläche im Dialog,
   Eingabe, gemeinsame Zeichen-Helfer. Ein Minispiel ist ein Objekt mit update(dt), render(ctx), down(p), move(p), abort(). */
(function (AA) {
  const TAU = Math.PI * 2;
  const M = AA.mini = { cur: null, cv: null, ctx: null, W: 960, H: 540, R: 1, t: 0 };
  M.FONT = 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", system-ui, sans-serif';

  function pos(e) { const r = M.cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * M.W, y: (e.clientY - r.top) / r.height * M.H }; }
  M.open = function (game, title, sub) {
    AA.ui.open('mini', '<div class="m-head"><div class="m-title">' + title + '</div><div class="m-sub" id="mini-sub">' + (sub || '') + '</div><button class="x" data-act="close" title="Abbrechen">✕</button></div>' +
      '<div class="mini-wrap"><canvas id="mini-cv"></canvas><div id="mini-msg" class="hidden"></div></div>', 'mini', true);
    M.cv = AA.$('#mini-cv'); M.ctx = M.cv.getContext('2d');
    M.R = AA.clamp(window.devicePixelRatio || 1, 1, 2);
    M.cv.width = Math.round(M.W * M.R); M.cv.height = Math.round(M.H * M.R);
    M.cv.addEventListener('pointerdown', function (e) { if (e.button !== undefined && e.button !== 0) return; AA.audio.unlock(); if (M.cur && M.cur.down) M.cur.down(pos(e)); e.preventDefault(); });
    M.cv.addEventListener('pointermove', function (e) { if (M.cur && M.cur.move) M.cur.move(pos(e)); });
    M.cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    M.cur = game; M.t = 0;
  };
  M.frame = function (dt) {
    if (!M.cur || !M.cv || !M.cv.isConnected) return;
    M.t += dt;
    M.cur.update(dt);
    if (!M.cur) return;
    M.ctx.setTransform(M.R, 0, 0, M.R, 0, 0);
    M.cur.render(M.ctx);
  };
  /* Ergebnis-Karte über der Zeichenfläche */
  M.result = function (html) { const el = AA.$('#mini-msg'); if (!el) return; el.innerHTML = html; el.classList.remove('hidden'); };
  /* wird vom Dialog aufgerufen, wenn er geschlossen wird (X-Knopf oder „Fertig“) */
  M.closed = function () { const g = M.cur; M.cur = null; M.cv = null; M.ctx = null; if (g && g.abort) g.abort(); };

  /* ---------- Zeichen-Helfer ---------- */
  M.text = function (ctx, str, x, y, size, fill, align, stroke) {
    ctx.save();
    ctx.font = '900 ' + size + 'px ' + M.FONT; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.22); ctx.strokeStyle = stroke || 'rgba(8,45,72,0.9)';
    ctx.strokeText(str, x, y); ctx.fillStyle = fill || '#fff'; ctx.fillText(str, x, y);
    ctx.restore();
  };
  M.pill = function (ctx, str, x, y, bg, size) {
    ctx.save();
    size = size || 14;
    ctx.font = '800 ' + size + 'px ' + M.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(str).width + size * 1.4, h = size * 1.75;
    x = AA.clamp(x, w / 2 + 6, M.W - w / 2 - 6);
    ctx.fillStyle = bg || 'rgba(8,50,78,0.86)';
    AA.roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(str, x, y + 1);
    ctx.restore();
  };
  M.sprite = function (ctx, key, cx, cy, w, alpha) {
    const im = AA.assets.get(key); if (!im) return 0;
    const h = w * im.height / im.width;
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h);
    if (alpha !== undefined) ctx.globalAlpha = 1;
    return h;
  };
  /* Kulisse: Wasser + Kies-Streifen, der mit scroll nach links wandert */
  let bgCv = null, bgKey = '';
  M.scene = function (ctx, tank, scroll, floorTop) {
    const key = tank.wall;
    if (bgKey !== key) {
      bgCv = document.createElement('canvas'); bgCv.width = M.W; bgCv.height = M.H;
      AA.paintWater(bgCv.getContext('2d'), AA.WALL_BY[tank.wall] || AA.WALLS[0], M.W, M.H, floorTop + 10, 23);
      bgKey = key;
    }
    ctx.drawImage(bgCv, 0, 0, M.W, M.H);
    // nur das Mittelstück des Kies-Sprites kacheln (die Enden laufen schräg aus)
    const im = AA.assets.get('floor/' + tank.floor) || AA.assets.get('floor/sand');
    if (!im) return;
    // Kacheln abwechselnd gespiegelt aneinandersetzen – so passen die Kanten nahtlos zusammen
    const cs = im.width * AA.FLOOR_CROP[0], cw = im.width * AA.FLOOR_CROP[1], fw = 1040, fh = fw * im.height / cw;
    const first = Math.floor(scroll / fw);
    for (let k = first; k * fw - scroll < M.W; k++) {
      const x = k * fw - scroll;
      if (k % 2 === 0) ctx.drawImage(im, cs, 0, cw, im.height, x, floorTop, fw + 1, fh);
      else { ctx.save(); ctx.translate(x + fw, floorTop); ctx.scale(-1, 1); ctx.drawImage(im, cs, 0, cw, im.height, -1, 0, fw + 1, fh); ctx.restore(); }
    }
  };
  M.fish = function (ctx, key, x, y, w, phase, amp, tilt, blink, v) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt || 0);
    AA.drawFishSprite(ctx, key, w, phase, amp, blink, v);
    ctx.restore();
  };
  M.TAU = TAU;
})(window.AA);
