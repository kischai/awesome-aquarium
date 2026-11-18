'use strict';
/* Awesome Aquarium – Runde 20a: Bedienung
   • „?“ öffnet den Spickzettel mit allen Tasten (auch in den Einstellungen und im Menü ☰)
   • Enter drückt in jedem Dialog den Hauptknopf (der mit data-primary – sonst der einzige grüne unten rechts)
   • Strg/Cmd + Z: letzten Deko-Schritt rückgängig (js/undo.js)
   • Handy: lange auf einen Knopf drücken zeigt, wie er heißt (sein title) – ohne ihn auszulösen */
(function (AA) {
  const UI = AA.ui, $ = AA.$, esc = AA.esc;
  const KEYS = [
    ['Werkzeuge', [['1', 'Auswahl / Hand'], ['2', 'Füttern'], ['3', 'Putzen'], ['4', 'Tricks / ans Glas klopfen'], ['5', 'Deko-Modus'], ['H', 'Alle Becken füttern']]],
    ['Fenster', [['S', 'Shop'], ['B', 'Sammelbuch'], ['A', 'Aufträge'], ['K', 'Büro'], ['U', 'Alle Becken'], ['E', 'Erfolge'], ['G', 'Tagesgeschenk'], ['T', 'Schatzsuche'],
      ['C', 'Kalender (7 Tage)'], ['Z', 'Rangliste'], ['R', 'Freunde-Leiste'], [',', 'Einstellungen'], ['Tab', 'Menü ☰'], ['?', 'dieser Spickzettel']]],
    ['Becken', [['← →', 'voriges / nächstes Becken'], ['F', 'Foto'], ['L', 'Licht an/aus'], ['M', 'Musik an/aus'], ['N', 'Ton an/aus']]],
    ['Deko-Modus', [['Q  E', 'drehen'], ['X', 'spiegeln'], ['+  −', 'größer / kleiner'], ['Strg/⌘ + Z', 'rückgängig (letzte 10 Schritte)']]],
    ['In Fenstern', [['Enter', 'Hauptknopf (Kaufen, OK …)'], ['Esc', 'schließen']]]
  ];
  UI.openKeys = function () {
    UI.open('keys', '<div class="m-head"><div class="m-title">⌨️ Tastenkürzel</div><button class="x" data-act="close" title="Schließen">✕</button></div><div class="list keys-sheet">' +
      [[0, 2], [1], [3, 4]].map(function (col) {                // drei Spalten: Werkzeuge + Becken · Fenster · Deko + Fenster-Tasten
        return '<div class="ks-col">' + col.map(function (i) {
          const g = KEYS[i];
          return '<div class="ks-grp"><b>' + g[0] + '</b>' + g[1].map(function (k) { return '<div class="ks-row"><kbd>' + esc(k[0]) + '</kbd><span>' + esc(k[1]) + '</span></div>'; }).join('') + '</div>';
        }).join('') + '</div>';
      }).join('') + '<p class="ks-fine">Auf dem Handy: lange auf einen Knopf drücken zeigt, wie er heißt.</p></div>', 'mid');
  };

  /* Enter im Dialog: data-primary hat Vorrang; sonst genau ein grüner Knopf unten rechts in einem Bestätigungs-Fenster */
  UI.modalEnter = function (e) {
    const m = $('#modal'); if (!m || !UI.modalKind) return false;
    let b = m.querySelector('[data-primary]:not([disabled])');
    if (!b) {
      const L = Array.prototype.filter.call(m.querySelectorAll('.row.end .btn.green, .row.end .btn.gold'), function (x) { return !x.disabled && x.offsetParent; });
      if (L.length === 1) b = L[0];
    }
    if (!b) return false;
    e.preventDefault(); b.click();
    return true;
  };

  /* Deko rückgängig – mit kurzer Rückmeldung */
  UI.decoUndo = function () {
    const r = AA.undo ? AA.undo() : null;
    if (!r) { UI.toast('↩️ Nichts mehr zum Rückgängigmachen.'); return false; }
    AA.audio.play('pop');
    const V = AA.view; if (V) { V.selectDeco(null); if (V.syncStack) V.syncStack(); }
    const money = r.coins ? ' (' + (r.coins > 0 ? '+' : '−') + AA.fmt(Math.abs(r.coins)) + ' Münzen)' : '';
    UI.toast('↩️ Rückgängig: ' + esc(r.label) + money + (AA.undoCount() ? ' · noch ' + AA.undoCount() + '× möglich' : ''));
    if (UI.refresh) UI.refresh();
    return true;
  };

  /* Handy: Langdruck zeigt den Namen eines Knopfs (title) als Blase und schluckt den Klick */
  function longPress() {
    let t = 0, tip = null, eat = false, sx = 0, sy = 0;
    function hide() { if (tip) { tip.remove(); tip = null; } }
    document.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      const b = e.target.closest && e.target.closest('button[title], [data-tip]');
      if (!b || b.closest('#modal input')) return;
      const txt = b.getAttribute('data-tip') || b.getAttribute('title'); if (!txt) return;
      sx = e.clientX; sy = e.clientY; eat = false; clearTimeout(t);
      t = setTimeout(function () {
        hide(); eat = true;
        tip = document.createElement('div'); tip.className = 'lp-tip'; tip.textContent = txt.replace(/\s*\(([^()]{1,12})\)\s*$/, '');   // Taste in Klammern weglassen
        document.body.appendChild(tip);
        const r = b.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
        tip.style.left = Math.max(6, Math.min(innerWidth - w - 6, r.left + r.width / 2 - w / 2)) + 'px';
        tip.style.top = (r.top - h - 8 > 4 ? r.top - h - 8 : r.bottom + 8) + 'px';
        if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) { /* egal */ }
      }, 480);
    }, true);
    document.addEventListener('pointermove', function (e) { if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) { clearTimeout(t); t = 0; } }, true);
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      document.addEventListener(ev, function () { clearTimeout(t); t = 0; if (tip) setTimeout(hide, 1400); }, true);
    });
    document.addEventListener('click', function (e) { if (eat) { eat = false; e.preventDefault(); e.stopPropagation(); } }, true);
    document.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest('button[title], [data-tip]') && matchMedia('(pointer: coarse)').matches) e.preventDefault(); }, true);
  }

  UI.keysInit = function () {
    longPress();
  };
})(window.AA);
