'use strict';
/* Awesome Aquarium – Runde 11: Soundtrack. Ein Song, dann 10 Minuten Ruhe, dann der nächste (gemischt, ohne Wiederholung, bis alle durch sind).
   Die Liste kommt aus js/musiclist.js (AA.MUSIC_LIST, erzeugt von tools/music_import.py), die Dateien liegen in assets/music/.
   An/Aus: Einstellungen → Musik oder Taste M. Gespeichert in s.settings.music. Browser spielen Ton erst nach dem ersten Klick/Tippen –
   der erste Song startet deshalb mit der ersten Berührung. */
(function (AA) {
  const M = AA.music = { gap: 600, vol: 0.42, fade: 2.2, el: null, cur: -1, order: [], next: 0, playing: false, unlocked: false, timer: null, dueAt: 0 };
  function list() { return AA.MUSIC_LIST || []; }
  function on() { return !!(AA.state && AA.state.settings.music !== false) && list().length > 0 && !AA.devNoMusic; }
  function shuffle() {
    const n = list().length, a = []; for (let i = 0; i < n; i++) a.push(i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; }
    if (a.length > 1 && a[0] === M.cur) { const x = a[0]; a[0] = a[1]; a[1] = x; }      // nicht zweimal hintereinander derselbe
    return a;
  }
  function element() {
    if (M.el) return M.el;
    const el = M.el = new Audio();
    el.preload = 'none';
    el.addEventListener('ended', function () { M.playing = false; AA.emit('music'); schedule(M.gap); });
    el.addEventListener('error', function () { M.playing = false; AA.emit('music'); schedule(30); });      // Datei fehlt: kurz warten, dann der nächste
    return el;
  }
  let fadeRaf = 0;
  function fadeTo(target, sec, done) {
    const el = element(), v0 = el.volume, t0 = performance.now();
    cancelAnimationFrame(fadeRaf);
    const step = function (now) {
      const k = Math.min(1, (now - t0) / (sec * 1000));
      el.volume = Math.max(0, Math.min(1, v0 + (target - v0) * k));
      if (k < 1) fadeRaf = requestAnimationFrame(step); else if (done) done();
    };
    fadeRaf = requestAnimationFrame(step);
  }
  function schedule(sec) {
    clearTimeout(M.timer);
    M.dueAt = Date.now() + sec * 1000;
    M.timer = setTimeout(tryPlay, sec * 1000);
    AA.emit('music');
  }
  function tryPlay() {
    if (!on() || M.playing) return;
    if (document.hidden || !M.unlocked) { M.dueAt = Date.now(); return; }      // gleich, sobald das Fenster wieder da ist bzw. nach dem ersten Tippen
    M.order = M.order.filter(function (i) { return i < list().length; });      // Liste geändert? Dann nur gültige Plätze
    if (!M.order.length) M.order = shuffle();
    M.cur = M.order.shift();
    const song = list()[M.cur], el = element();
    if (!song) return;
    el.src = song.f; el.volume = 0;
    const p = el.play();
    M.playing = true; M.dueAt = 0;
    if (p && p.then) p.then(function () { fadeTo(M.vol, M.fade); }, function () { M.playing = false; M.dueAt = Date.now(); M.unlocked = false; });      // abgelehnt: beim nächsten Tippen nochmal
    else fadeTo(M.vol, M.fade);
    AA.emit('music');
  }
  /* Taste M / Schalter in den Einstellungen */
  M.set = function (want) {
    const s = AA.state; if (!s) return;
    s.settings.music = !!want; AA.save();
    if (!want) M.stop(); else { M.unlocked = true; if (!M.playing) tryPlay(); }
    AA.emit('music');
  };
  M.toggle = function () { M.set(!(AA.state && AA.state.settings.music !== false)); return AA.state.settings.music; };
  M.stop = function () {
    clearTimeout(M.timer); M.dueAt = 0;
    if (M.el && M.playing) { const el = M.el; fadeTo(0, 0.8, function () { el.pause(); }); }
    M.playing = false;
  };
  M.skip = function () {                                // „Jetzt einen Song“ – spielt sofort den nächsten
    if (!list().length) return false;
    if (M.el && M.playing) { M.el.pause(); M.playing = false; }
    M.unlocked = true; clearTimeout(M.timer);
    if (AA.state && AA.state.settings.music === false) { AA.state.settings.music = true; AA.save(); }
    tryPlay(); return true;
  };
  M.title = function () { const s = list()[M.cur]; return M.playing && s ? s.t : ''; };
  M.waitLeft = function () { return M.playing || !M.dueAt ? 0 : Math.max(0, Math.round((M.dueAt - Date.now()) / 1000)); };
  /* Start: erster Song mit der ersten Berührung, dann im Takt */
  M.init = function () {
    const unlock = function () {
      if (M.unlocked) return;
      M.unlocked = true;
      if (on() && !M.playing && (!M.dueAt || M.dueAt <= Date.now() + 1000)) tryPlay();
    };
    ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) { window.addEventListener(ev, unlock, { capture: true, passive: true }); });
    document.addEventListener('visibilitychange', function () {
      if (!M.el) { if (!document.hidden && M.dueAt && M.dueAt <= Date.now()) tryPlay(); return; }
      if (document.hidden) { if (M.playing) M.el.pause(); }
      else if (M.playing) { const p = M.el.play(); if (p && p.catch) p.catch(function () { /* egal */ }); }
      else if (M.dueAt && M.dueAt <= Date.now()) tryPlay();
    });
    M.dueAt = Date.now();                                // der erste Song ist gleich fällig
  };
})(window.AA);
