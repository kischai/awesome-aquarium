'use strict';
/* Awesome Aquarium – Runde 20a: Rückgängig für Deko (Strg/Cmd + Z), die letzten 10 Schritte.
   Vor jedem Deko-Schritt merkt sich das Spiel die Deko aller Becken und das Lager (als Text, klein). Geht der Schritt mit Münzen oder Perlen
   einher (Verkaufen, Kaufen, Duplizieren), wird beim Rückgängig genau diese Änderung wieder ausgeglichen – Münzen aus anderen Quellen bleiben.
   Ein Schritt = ein Aufruf einer der Deko-Funktionen unten, ein Zieh-Vorgang (verschieben, Größe am Anfasser) oder eine Reihe von Größen-
   Änderungen mit Mausrad/Tasten/Regler (fasst zusammen, was innerhalb von 0,7 s passiert). Nichts geändert = kein Schritt. */
(function (AA) {
  const MAX = 10, stack = [];
  let pend = null, touchT = 0;
  const LABEL = { move: 'verschoben', size: 'Größe', sell: 'verkauft', buy: 'gekauft', dup: 'dupliziert', store: 'ins Lager', unstore: 'aus dem Lager',
    turn: 'gedreht', layer: 'Ebene', color: 'Farbe', other: 'ins andere Becken', flip: 'gespiegelt', place: 'aufgestellt' };
  function S() { return AA.state; }
  function snapAll() {
    const s = S();
    return { deco: s.tanks.map(function (t) { return JSON.stringify(t.deco || []); }), store: JSON.stringify(s.storage || []), coins: s.coins || 0, pearls: s.pearls || 0, active: s.active };
  }
  function same(a, b) {
    if (a.store !== b.store || a.deco.length !== b.deco.length) return false;
    for (let i = 0; i < a.deco.length; i++) if (a.deco[i] !== b.deco[i]) return false;
    return true;
  }
  /* Schritt beginnen / abschließen. money = false: Münzen dabei nicht mitzählen (Ziehen dauert – da könnten andere Münzen dazukommen) */
  AA.undoBegin = function (label, money) {
    if (!S() || AA.visit || pend) return false;
    pend = { snap: snapAll(), label: label || 'step', money: money !== false };
    return true;
  };
  AA.undoCommit = function () {
    if (!pend) return;
    const p = pend; pend = null;
    const s = S(), now = snapAll();
    if (same(now, p.snap)) return;
    p.dc = p.money ? (s.coins || 0) - p.snap.coins : 0;
    p.dp = p.money ? (s.pearls || 0) - p.snap.pearls : 0;
    stack.push(p); if (stack.length > MAX) stack.shift();
    AA.emit('undoChanged', stack.length);
  };
  /* für Dinge, die in vielen kleinen Schritten passieren (Größe per Mausrad, Regler, + / −) */
  AA.undoTouch = function (label) {
    if (pend && !pend.touch) return;
    if (!pend) { if (!AA.undoBegin(label, false)) return; pend.touch = true; }
    clearTimeout(touchT); touchT = setTimeout(AA.undoCommit, 700);
  };
  AA.undoCount = function () { return stack.length; };
  AA.undoClear = function () { stack.length = 0; pend = null; AA.emit('undoChanged', 0); };

  /* Deko eines Beckens zurücksetzen – vorhandene Stücke behalten ihre Identität (die Ansicht hängt an ihnen) */
  function restoreTank(t, json) {
    const want = JSON.parse(json), have = {};
    (t.deco || []).forEach(function (o) { have[o.id] = o; });
    t.deco.length = 0;
    want.forEach(function (d) {
      const o = have[d.id];
      if (o) { Object.keys(o).forEach(function (k) { if (!(k in d)) delete o[k]; }); Object.assign(o, d); t.deco.push(o); }
      else t.deco.push(d);
    });
  }
  AA.undo = function () {
    if (pend) { clearTimeout(touchT); AA.undoCommit(); }
    const p = stack.pop(); if (!p || !S() || AA.visit) return null;
    const s = S();
    if (p.snap.active !== s.active && s.tanks[p.snap.active]) AA.switchTank(p.snap.active);
    p.snap.deco.forEach(function (json, i) { if (s.tanks[i] && JSON.stringify(s.tanks[i].deco || []) !== json) restoreTank(s.tanks[i], json); });
    s.storage = JSON.parse(p.snap.store);
    if (p.dc) s.coins = Math.max(0, (s.coins || 0) - p.dc);
    if (p.dp) s.pearls = Math.max(0, (s.pearls || 0) - p.dp);
    AA.emit('decoUndo', p);
    AA.emit('undoChanged', stack.length);
    AA.save();
    return { label: LABEL[p.label] || p.label, coins: -p.dc, pearls: -p.dp };
  };

  /* Deko-Funktionen einwickeln: jeder Aufruf von außen ist ein Schritt (innere Aufrufe gehören zum äußeren) */
  function wrap(obj, name, label) {
    const f = obj && obj[name]; if (typeof f !== 'function' || f.undoWrapped) return;
    const w = function () {
      const outer = AA.undoBegin(label);
      try { return f.apply(this, arguments); } finally { if (outer) AA.undoCommit(); }
    };
    w.undoWrapped = true; obj[name] = w;
  }
  AA.undoInit = function () {
    [['sellDeco', 'sell'], ['buyDeco', 'buy'], ['dupDeco', 'dup'], ['storeDeco', 'store'], ['unstore', 'unstore'], ['rotateDeco', 'turn'], ['layerDeco', 'layer'],
      ['setDecoColor', 'color'], ['moveDeco', 'other'], ['placeDeco', 'place']].forEach(function (x) { wrap(AA, x[0], x[1]); });
    if (AA.ui) wrap(AA.ui, 'decoKey', 'flip');
    if (AA.view && AA.view.resizeDeco) {
      const rs = AA.view.resizeDeco;
      AA.view.resizeDeco = function () { AA.undoTouch('size'); return rs.apply(this, arguments); };
    }
    AA.on('tankChanged', function () { if (pend && pend.touch) { clearTimeout(touchT); AA.undoCommit(); } });
  };
})(window.AA);
