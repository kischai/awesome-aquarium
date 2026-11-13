'use strict';
/* Awesome Aquarium – Runde 11: Feinschliff für Touchscreens.
   • erkennt Finger-Geräte (body.touchdev) – auch Laptops mit Touchscreen, sobald der erste Finger kommt
   • Hinweise mit Fingern statt Maus (AA.say), größere Trefferzonen für Fische und den Größen-Anfasser (js/main.js, js/tankview.js)
   • Antippen zeigt die Erklärung eines Symbols (sonst nur als Maus-Tooltip sichtbar)
   • kein Seiten-Zoom durch Zwei-Finger- oder Doppel-Tippen (iOS ignoriert user-scalable=no), kurzes Vibrieren bei schönen Momenten (Android)
   • die Bühne passt sich den sicheren Rändern an (Notch, Home-Strich: js/main.js liest --sat/--sab/--sal/--sar) */
(function (AA) {
  const T = AA.touch = { on: false, last: 0 };
  function set(on) {
    if (T.on === on) return;
    T.on = on;
    document.body.classList.toggle('touchdev', on);
    if (AA.ui) AA.ui.touch = on;
    if (AA.emit) AA.emit('touchMode', on);
  }
  T.init = function () {
    set(!!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints > 0 && !(window.matchMedia && window.matchMedia('(hover: hover)').matches)));
    window.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch' || e.pointerType === 'pen') { T.last = Date.now(); set(true); } }, { capture: true, passive: true });
    /* iOS: kein Zoomen der ganzen Seite mit zwei Fingern oder Doppel-Tippen */
    ['gesturestart', 'gesturechange'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false }); });
    document.addEventListener('dblclick', function (e) { if (T.on && !(e.target && e.target.closest && e.target.closest('input, textarea'))) e.preventDefault(); }, { passive: false });
    /* Antippen eines Symbols mit Erklärung (title) zeigt die Erklärung als kleine Blase */
    document.addEventListener('click', function (e) {
      if (!T.on || Date.now() - T.last > 1500) return;
      const el = e.target && e.target.closest ? e.target.closest('[title]') : null;
      if (!el || !el.title || el.closest('[data-act], button, a, input, textarea, select, label')) return;
      tip(el, el.title);
    }, true);
  };
  let tipEl = null, tipT = 0;
  function tip(el, txt) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.id = 'tap-tip'; document.body.appendChild(tipEl); }
    tipEl.textContent = txt;
    const r = el.getBoundingClientRect();
    tipEl.style.left = Math.round(Math.min(window.innerWidth - 12, Math.max(12, r.left + r.width / 2))) + 'px';
    tipEl.style.top = Math.round(r.top) + 'px';
    tipEl.classList.remove('show'); void tipEl.offsetWidth; tipEl.classList.add('show');
    clearTimeout(tipT); tipT = setTimeout(function () { tipEl.classList.remove('show'); }, 2800);
  }
  /* Text für Maus oder Finger */
  AA.say = function (mouse, finger) { return T.on ? finger : mouse; };
  /* kurzes Vibrieren (nur Geräte, die das können; mit Ton aus bleibt es auch still) */
  AA.haptic = function (ms) {
    if (!T.on || !navigator.vibrate || !(AA.state && AA.state.settings.sound)) return;
    try { navigator.vibrate(ms); } catch (e) { /* egal */ }
  };
  T.wire = function () {
    AA.on('levelup', function () { AA.haptic([18, 50, 18]); });
    AA.on('eggLaid', function () { AA.haptic(14); });
    AA.on('hatched', function (b, e, t) { if (t === AA.tank()) AA.haptic(10); });
  };
})(window.AA);
