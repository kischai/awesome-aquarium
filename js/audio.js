'use strict';
/* Awesome Aquarium – Klang. Zwei Quellen:
     • Synthese per WebAudio (keine Dateien nötig) – jeder Ton ist so immer da.
     • Aufnahmen aus js/snd.js (Runde 8: Wasser-Platscher klein/groß und das Klopfen an die Scheibe; gebaut aus Higgsfield-Aufnahmen plus eigenen
       Wasser-Schichten, siehe docs/PROMPTS.md § Klang). Sie ersetzen einzelne Töne, solange „Klang: Neu“ gewählt ist.
   A.mode = 'rec' (neu: Aufnahmen + feinere Synthese) oder 'classic' (genau die Töne bis Runde 7). A.amb = leises Blubbern im Hintergrund. */
(function (AA) {
  const A = AA.audio = { ctx: null, on: true, master: null, mode: 'rec', amb: true, buf: {}, last: null };
  const rnd = Math.random;
  function decodeAll() {                               // die Aufnahmen einmal dekodieren (klein: zusammen ~45 KB MP3)
    const SND = window.AA_SND;
    if (!SND || A.decoding) return;
    A.decoding = true;
    Object.keys(SND).forEach(function (k) {
      try {
        const b = atob(SND[k].split(',')[1]), u = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
        const p = A.ctx.decodeAudioData(u.buffer, function (buf) { A.buf[k] = buf; }, function () { /* dann bleibt die Synthese */ });
        if (p && p.catch) p.catch(function () { /* egal */ });
      } catch (e) { /* egal */ }
    });
  }
  function ctx() {
    if (!A.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      A.ctx = new C();
      A.master = A.ctx.createGain(); A.master.gain.value = 0.45; A.master.connect(A.ctx.destination);
      decodeAll();
    }
    if (A.ctx.state === 'suspended') A.ctx.resume();
    return A.ctx;
  }
  function tone(type, f0, f1, dur, vol, delay) {
    const c = ctx(); if (!c) return;
    const t = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(A.master); o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol, freq, q, delay) {
    const c = ctx(); if (!c) return;
    const t = c.currentTime + (delay || 0);
    const n = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (rnd() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(A.master); s.start(t);
  }
  /* Rauschen, dessen Höhen wegsacken – Wasser, das aufspritzt und wieder zusammenfällt */
  function sweep(dur, vol, f0, f1, tau, delay) {
    const c = ctx(); if (!c) return;
    const t = c.currentTime + (delay || 0);
    const n = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.7);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.setTargetAtTime(0.0001, t + 0.006, tau);
    s.connect(f); f.connect(g); g.connect(A.master); s.start(t); s.stop(t + dur);
  }
  /* eine Luftblase: kurzer Sinus, der nach oben wegzieht */
  function blub(f, vol, delay, dur) { tone('sine', f, f * (1.4 + rnd() * 0.5), dur || (0.04 + rnd() * 0.05), vol, delay); }
  /* Aufnahme abspielen; false, wenn sie (noch) nicht da ist – dann springt die Synthese ein */
  function sample(name, vol, rate, delay) {
    const c = ctx(), b = A.buf[name];
    if (!c || !b) return false;
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = b; s.playbackRate.value = rate || 1; g.gain.value = vol;
    s.connect(g); g.connect(A.master); s.start(c.currentTime + (delay || 0));
    return true;
  }

  /* ---------- die Töne bis Runde 7 („Klassisch“) ---------- */
  const S = {
    pop: function () { tone('sine', 420, 980, 0.09, 0.22); },
    bubble: function () { tone('sine', 300 + rnd() * 200, 900 + rnd() * 300, 0.12, 0.08); },
    coin: function () { tone('triangle', 1318, 1318, 0.09, 0.2); tone('triangle', 1976, 1976, 0.24, 0.2, 0.08); },
    knock: function () { tone('sine', 190, 90, 0.13, 0.5); noise(0.05, 0.3, 1800, 1.2); },
    splash: function () { noise(0.35, 0.28, 900, 0.7); tone('sine', 500, 200, 0.2, 0.08); },
    eat: function () { tone('square', 700, 380, 0.05, 0.05); },
    click: function () { tone('triangle', 880, 660, 0.05, 0.1); },
    error: function () { tone('sawtooth', 180, 140, 0.16, 0.1); },
    level: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone('triangle', f, f, 0.24, 0.2, i * 0.11); }); },
    heart: function () { tone('sine', 660, 990, 0.18, 0.14); tone('sine', 880, 1320, 0.22, 0.1, 0.12); },
    sparkle: function () { [1568, 2093, 2637].forEach(function (f, i) { tone('sine', f, f, 0.14, 0.09, i * 0.06); }); },
    wipe: function () { noise(0.12, 0.07, 2600, 0.8); },
    buy: function () { tone('triangle', 660, 880, 0.1, 0.18); tone('triangle', 990, 1320, 0.14, 0.16, 0.09); },
    hatch: function () { noise(0.06, 0.2, 3000, 2); tone('sine', 880, 1760, 0.18, 0.14, 0.05); },
    tick: function () { tone('square', 660, 660, 0.07, 0.07); },
    go: function () { tone('triangle', 880, 1320, 0.22, 0.18); },
    hit: function () { tone('sawtooth', 220, 70, 0.28, 0.2); noise(0.14, 0.3, 500, 0.8); },
    boom: function () { noise(0.5, 0.5, 180, 0.6); tone('sine', 120, 40, 0.4, 0.4); },
    snap: function () { noise(0.05, 0.25, 2200, 1.5); tone('triangle', 520, 260, 0.08, 0.12); },
    ink: function () { noise(0.4, 0.2, 320, 0.7); },
    chest: function () { tone('triangle', 392, 392, 0.1, 0.16); tone('triangle', 523, 523, 0.1, 0.16, 0.09); tone('triangle', 784, 784, 0.3, 0.18, 0.18); },
    fail: function () { tone('triangle', 392, 370, 0.2, 0.16); tone('triangle', 311, 294, 0.24, 0.16, 0.18); tone('triangle', 233, 196, 0.4, 0.16, 0.38); },
    win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone('triangle', f, f, 0.2, 0.18, i * 0.09); }); },
    chomp: function () { noise(0.05, 0.25, 2200, 1.5); tone('triangle', 520, 260, 0.08, 0.12); }      // früher gab es keinen eigenen Ton: wie „snap“
  };
  /* ---------- Runde 8 („Neu“): Aufnahmen, wo es welche gibt – sonst feinere Synthese ---------- */
  const N = {
    /* Fisch fällt ins Wasser: o.big = großes Tier (tiefer, länger). Zwei kleine Fassungen wechseln sich ab, die Tonhöhe schwankt leicht. */
    splash: function (o) {
      const big = !!(o && o.big);
      if (sample(big ? 'splash_big' : (rnd() < 0.5 ? 'splash' : 'splash2'), big ? 0.95 : 0.8, (big ? 0.94 : 1) * (0.94 + rnd() * 0.12))) return;
      sweep(big ? 0.7 : 0.4, big ? 0.5 : 0.36, big ? 5000 : 6500, big ? 420 : 700, big ? 0.14 : 0.075);
      tone('sine', big ? 210 : 300, big ? 95 : 130, big ? 0.2 : 0.13, big ? 0.4 : 0.3);
      for (let i = 0; i < (big ? 8 : 5); i++) blub(380 + rnd() * 700, 0.05 + rnd() * 0.08, 0.07 + rnd() * (big ? 0.7 : 0.45));
    },
    knock: function () { if (!sample('knock', 0.9, 0.95 + rnd() * 0.1)) S.knock(); },
    /* ein Bissen: winziges „Plipp“, jedes Mal etwas anders gestimmt (früher immer derselbe Piep) */
    eat: function () { const f = 560 + rnd() * 320; tone('triangle', f, f * 0.55, 0.045, 0.06); if (rnd() < 0.35) blub(700 + rnd() * 500, 0.02, 0.04, 0.03); },
    /* Raubfisch schnappt zu: tiefer „Schlupp“ + Wasserwirbel + zwei Blasen */
    chomp: function () { tone('sine', 420, 120, 0.11, 0.4); sweep(0.18, 0.2, 3000, 500, 0.05); blub(300, 0.12, 0.13, 0.06); blub(480, 0.08, 0.2, 0.05); },
    /* Futter rieselt: viele winzige Körnchen */
    sprinkle: function () { for (let i = 0; i < 14; i++) noise(0.007 + rnd() * 0.008, 0.04 + rnd() * 0.07, 3000 + rnd() * 3500, 1.5, i * 0.013 + rnd() * 0.01); },
    /* Blasen steigen auf (Hintergrund, Putzerstation, „Alle füttern“) */
    bubbles: function (o) { const n = (o && o.n) || 3, v = (o && o.vol) || 0.05; let t = 0; for (let i = 0; i < n; i++) { blub(320 + rnd() * 440, v * (0.6 + rnd() * 0.5), t, 0.05 + rnd() * 0.05); t += 0.05 + rnd() * 0.09; } },
    bubble: function () { blub(300 + rnd() * 260, 0.08, 0, 0.1); },
    /* Ei: erst knackt die Schale (zwei kurze Risse), dann das helle „Da bin ich“ */
    hatch: function () { noise(0.025, 0.22, 3400, 3); noise(0.03, 0.18, 2600, 3, 0.05); tone('sine', 880, 1760, 0.18, 0.14, 0.1); },
    /* Schwamm auf Glas: kurzes Quietschen im Rauschen */
    wipe: function () { noise(0.12, 0.07, 2600, 0.8); if (rnd() < 0.5) tone('sine', 1500 + rnd() * 500, 1900 + rnd() * 500, 0.06, 0.012, 0.02); }
  };
  A.names = function () { return Object.keys(S).concat(Object.keys(N).filter(function (k) { return !S[k]; })); };
  /* derselbe Ton höchstens alle 70 ms – sonst stapeln sich bei hohem Tempo zwanzig gleiche Töne in einem Bild (z. B. wenn alle Fische gleichzeitig erwachsen werden) */
  const lastPlay = {};
  A.play = function (name, opt) {
    if (!A.on) return;
    const now = Date.now();
    if (now - (lastPlay[name] || 0) < (name === 'eat' ? 90 : 70)) return;
    lastPlay[name] = now;
    A.last = name;
    try { const f = (A.mode !== 'classic' && N[name]) || S[name]; if (f) f(opt); } catch (e) { /* Ton ist nie kritisch */ }
  };
  /* leises Blubbern im Hintergrund: alle paar Sekunden steigen ein paar Blasen auf (nur wenn schon ein Klang-Kontext läuft und das Fenster sichtbar ist) */
  function ambTick() {
    setTimeout(ambTick, 2600 + rnd() * 5400);
    if (!A.on || !A.amb || !A.ctx || A.ctx.state !== 'running' || document.hidden) return;
    try { N.bubbles({ n: 1 + Math.floor(rnd() * 3), vol: 0.016 + rnd() * 0.016 }); } catch (e) { /* egal */ }
  }
  setTimeout(ambTick, 4000);
  A.unlock = function () { try { ctx(); } catch (e) { /* egal */ } };
})(window.AA);
