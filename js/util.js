'use strict';
/* Awesome Aquarium – kleine Helfer */
window.AA = window.AA || {};
(function (AA) {
  AA.W = 1280; AA.H = 720;
  AA.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  AA.lerp = function (a, b, t) { return a + (b - a) * t; };
  AA.rand = function (a, b) { return a + Math.random() * (b - a); };
  AA.randi = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  AA.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  AA.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
  AA.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0; let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  AA.fmt = function (n) { return Math.round(n).toLocaleString('de-DE'); };
  AA.fmtDur = function (s) {
    s = Math.max(0, Math.ceil(s));
    if (s < 60) return s + ' Sek';
    if (s < 3600) { const m = Math.floor(s / 60), r = s % 60; return r ? m + ' Min ' + r + ' Sek' : m + ' Min'; }
    const h = Math.floor(s / 3600), m2 = Math.floor((s % 3600) / 60);
    return m2 ? h + ' Std ' + m2 + ' Min' : h + ' Std';
  };
  AA.fmtShort = function (s) {
    s = Math.max(0, Math.ceil(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    const p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return h ? h + ':' + p(m) + ':' + p(r) : m + ':' + p(r);
  };
  AA.ease = function (t) { t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t); };
  AA.keys = function (o) { return Object.keys(o || {}).length; };
  AA.esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  AA.$ = function (s) { return document.querySelector(s); };
  // Mini-Eventbus
  const handlers = {};
  AA.on = function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); };
  AA.emit = function (ev, a, b, c, d, e) { const hs = handlers[ev]; if (hs) for (let i = 0; i < hs.length; i++) hs[i](a, b, c, d, e); };      // Runde 20e: fünftes Argument (eggMade)
})(window.AA);
