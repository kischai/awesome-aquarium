'use strict';
/* Awesome Aquarium – ein Fisch im Becken: Verhalten (schwimmen, fressen, flüchten, balzen, verstecken, Tricks)
   und Animation (Flossenschlag, Wenden, Neigen, Wachsen, Blinzeln). Die Spieldaten selbst liegen in fish.d. */
(function (AA) {
  const G = AA.G, TAU = Math.PI * 2, B = AA.BAL;
  const NO_RIG = { tail: 0.22, mouth: [0.93, 0.62] };

  function Fish(d) {
    this.d = d; this.def = AA.FISH_BY[d.sp];
    this.z = AA.rand(0.1, 1); this.zT = this.z;
    this.ph = AA.phase(d); this.scale = AA.PHASE_SCALE[this.ph];
    const lim = AA.xLimits(this.z);
    this.x = AA.rand(lim[0] + 80, lim[1] - 80);
    this.y = AA.rand(G.top + 50, AA.floorY(this.z) - 90);
    this.vx = 0; this.vy = 0;
    this.dir = Math.random() < 0.5 ? 1 : -1; this.face = this.dir;
    this.tilt = 0; this.spin = 0; this.phase = Math.random() * TAU; this.amp = 0.5;
    this.tx = this.x; this.ty = this.y; this.wait = AA.rand(0, 1.5);
    this.state = 'wander'; this.timer = 0;
    this.seed = Math.random() * 100;
    this.pop = 0; this.chomp = 0; this.emote = null; this.emoteT = 0;
    this.ghost = false; this.dead = false;
    this.hideT = AA.rand(25, 110); this.heartT = 0; this.bubT = AA.rand(3, 12); this.moodT = AA.rand(2, 9);
    this.eyeShut = false; this.blinkT = AA.rand(1, 6);
    this.tr = null; this.trickI = 0; this.holdId = -1;
    this.twT = AA.rand(0, 1.2);                       // bis zum nächsten Funkeln (nur Farbvarianten)
    // Runde 8 – Verhalten: Höhle (Lauerer), Anemone (Clownfisch), Putzerstation, Pflanze (Seepferdchen), Gründeln (Bodenfische)
    this.denT = AA.rand(6, 26); this.outT = Math.random() < 0.5 ? AA.rand(6, 24) : 0; this.denIdx = Math.floor(this.seed * 7);   // Lauerer: die Hälfte ist beim Start gerade unterwegs
    this.nestT = AA.rand(3, 9); this.defT = AA.rand(2, 6); this.ppT = 0;
    this.cleanT = AA.rand(40, 160); this.hitchT = AA.rand(4, 14); this.digT = AA.rand(1.5, 4); this.gapeT = AA.rand(0.5, 2);
    this.faceLock = 0; this.resting = false;
    // Runde 9 – Saugwels (sk = wo er gerade klebt), Putzerfisch (Kunde), Steinfisch (sein Platz)
    this.sk = null; this.skT = AA.rand(3, 9);
    this.tendT = AA.rand(4, 12); this.client = null; this.tended = 0;
    this.post = null; this.postT = AA.rand(200, 480);
  }
  /* Farbvarianten funkeln ab und zu – je seltener, desto öfter. Farbe passend zur Variante. */
  const TW = { albino: ['#ffffff', 1.5], gold: ['#ffe07a', 1.15], amethyst: ['#dcc0ff', 1.15], night: ['#bcd4ff', 0.9], rainbow: [null, 0.6] };
  const RB = ['#ff6b6b', '#ffb347', '#ffe66b', '#7be38a', '#6bc6ff', '#c58bff'];

  Fish.prototype.key = function () {
    const k = AA.spriteKey(this.d), sk = this.sk;
    if (sk && sk.on && k.charAt(k.length - 1) !== 'b') {            // Saugwels klebt: am Boden und an der Seitenscheibe ohne Mund (_n ♂ / _o ♀), an der Frontscheibe die Unterseite (_u)
      const alt = k.slice(0, -1) + (sk.mode === 'glass' ? 'u' : (this.d.sex === 'f' ? 'o' : 'n'));
      if (AA.assets.get(alt)) return alt;
    }
    return k;
  };
  Fish.prototype.img = function () { const k = this.key(), v = this.d.v; return this.d.sick ? AA.assets.tinted(k, v) : AA.assets.variant(k, v); };   // v = Farbvariante (oder nichts)
  Fish.prototype.rig = function () { return AA.RIG[this.key().slice(5)] || NO_RIG; };
  Fish.prototype.ar = function () { const im = AA.assets.get(this.key()); return im ? im.height / im.width : 0.62; };
  Fish.prototype.size = function () {
    const p = this.pop, r = this.rig();
    return this.def.len * this.scale * (r.ws || 1) * AA.sizeMult(this.d) * AA.depthScale(this.z) * AA.fishK() * (1 - 0.3 * p * p + 0.16 * Math.sin(p * Math.PI));   // sizeMult: Gen „Größe“
  };
  /* Runde 14: in den größten Becken sind die Fische (nur die Fische) etwas kleiner – das Becken wirkt größer und voll nicht so wuselig.
     Größtes normales Becken (125 Gallonen) × 0,86, Meeres- und Tiefsee-Becken × 0,9 (dort ist ohnehin schon alles auf 78 %). */
  AA.FISH_BIG = { regular: 0.86, wide: 0.9 };
  AA.fishK = function () {
    const t = AA.tank();
    if (!t) return 1;
    return AA.wide(t) ? AA.FISH_BIG.wide : (t.size >= AA.BIG_SIZE ? AA.FISH_BIG.regular : 1);
  };
  Fish.prototype.reach = function () { const r = this.rig(); return r.tx ? (r.tx - 1) * (r.tail || 0) : 0; };   // Runde 12: verlängerter Rochenschwanz ragt so weit (× Größe) über das Bild hinaus
  Fish.prototype.mouth = function () {
    const s = this.size(), r = this.rig(), m = r.mouth || NO_RIG.mouth, dir = r.kind === 'front' ? 1 : this.dir;
    return { x: this.x + dir * (m[0] - 0.5) * s, y: this.y + ((this.def.inv ? 1 - m[1] : m[1]) - 0.5) * s * this.ar() };      // Kongowels: liegt auf dem Rücken, das Maul ist oben
  };
  Fish.prototype.hit = function (x, y) {
    const s = this.size(), rx = Math.max(24, s * 0.54), ry = Math.max(20, s * this.ar() * 0.56);
    const dx = (x - this.x) / rx, dy = (y - this.y) / ry;
    return dx * dx + dy * dy <= 1;
  };
  Fish.prototype.gap = function (x, y) { return Math.hypot(x - this.x, y - this.y) - this.size() * 0.3; };      // Runde 20c: Abstand für Finger-Treffer (Schlange: zum Körper)
  Fish.prototype.say = function (e, dur) { this.emote = e; this.emoteT = dur || 1.2; };
  Fish.prototype.busy = function () { return this.ghost || this.state === 'enter' || this.state === 'trick' || this.state === 'mate'; };

  Fish.prototype.enterFromTop = function () {
    this.z = AA.rand(0.4, 0.95); this.zT = this.z;
    this.x = AA.rand(220, AA.W - 220); this.y = -60;
    this.vx = AA.rand(-30, 30); this.vy = 330;
    this.state = 'enter'; this.timer = 1.9; this.tx = this.x; this.ty = AA.rand(220, AA.floorY(this.z) - 140);
  };
  Fish.prototype.leave = function () { this.ghost = true; this.state = 'leave'; this.emote = null; this.tr = null; };

  /* ---------- Tricks ---------- */
  const TRICK_DUR = { zig: 1.7, zag: 1.7, loop: 2.0, dive: 2.3, eight: 3.0, spiral: 2.7 };
  function zz(u, sign) {                             // Zickzack: vier schräge Stücke
    const k = u * 4, i = Math.floor(k), f = k - i;
    return sign * 58 * (i % 2 === 0 ? f : 1 - f);
  }
  Fish.prototype.startTrick = function (id, free) {      // free (Runde 18): von selbst, z. B. der Purzelbaum des Eisbären – zählt nicht als Trick
    if (!TRICK_DUR[id]) return false;
    // genug Platz schaffen: Startpunkt in die Beckenmitte der Höhe ziehen
    const y0 = AA.clamp(this.y, G.top + 150, AA.floorY(this.z) - 150);
    this.tr = { id: id, t: 0, dur: TRICK_DUR[id], x0: this.x, y0: y0, ys: this.y, dir: this.dir, free: !!free };
    this.state = 'trick'; this.vx = this.vy = 0;
    if (!free) this.say('⭐', 0.8);
    return true;
  };
  Fish.prototype.runTrick = function (dt) {
    const tr = this.tr; tr.t += dt;
    const u = Math.min(1, tr.t / tr.dur), d = tr.dir, e = AA.ease(Math.min(1, tr.t / 0.35));
    const y0 = AA.lerp(tr.ys, tr.y0, e);
    let x = tr.x0, y = y0, spin = 0, tilt = 0, dir = d;
    if (tr.id === 'zig' || tr.id === 'zag') {
      const sg = tr.id === 'zig' ? -1 : 1;
      x = tr.x0 + d * 190 * u; y = y0 + zz(u, sg);
      tilt = (Math.floor(u * 4) % 2 === 0 ? 1 : -1) * sg * 0.55;
    } else if (tr.id === 'loop') {
      const a = AA.ease(u) * TAU, R = 62;
      x = tr.x0 + d * (R * Math.sin(a) + 40 * u); y = y0 - R * (1 - Math.cos(a)); spin = -a;
    } else if (tr.id === 'dive') {
      const D = AA.clamp(AA.floorY(this.z) - y0 - 46, 40, 190);
      x = tr.x0 + d * 150 * u; y = y0 + D * Math.sin(Math.PI * u);
      tilt = Math.cos(Math.PI * u) * 0.95;
    } else if (tr.id === 'eight') {
      const a = u * TAU;
      x = tr.x0 + d * 96 * Math.sin(a); y = y0 + 44 * Math.sin(2 * a);
      dir = Math.cos(a) * d >= 0 ? 1 : -1;
      tilt = AA.clamp(Math.cos(2 * a) * 0.5 * (Math.cos(a) >= 0 ? 1 : -1), -0.6, 0.6);
    } else if (tr.id === 'spiral') {
      const a = u * TAU * 3, R = 74 * (1 - u * 0.85);
      x = tr.x0 + d * R * Math.sin(a); y = y0 - R * (1 - Math.cos(a)) + 40 * u; spin = -a;
    }
    const lim = AA.xLimits(this.z), s = this.size();
    this.x = AA.clamp(x, lim[0] + s * 0.4, lim[1] - s * 0.4);
    this.y = AA.clamp(y, G.top + s * 0.3, AA.floorY(this.z, this.x) - s * this.ar() * 0.45);
    this.dir = dir; this.spin = spin; this.tilt += (tilt - this.tilt) * Math.min(1, dt * 12);
    this.phase += dt * 16; this.amp += (1.3 - this.amp) * Math.min(1, dt * 6);
    this.face += (this.dir - this.face) * Math.min(1, dt * 12);
    if (u >= 1) {
      this.spin = 0; this.tr = null; this.state = 'wander'; this.wait = 0.6; this.tx = this.x; this.ty = this.y;
      if (tr.free) { AA.view.addBubble(this.x, this.y - s * 0.2, 4); return; }
      AA.trickDone(this.d);
      AA.view.puff('star', this.x, this.y - s * 0.3, 3);
      AA.view.floatText(this.x, this.y - s * this.ar() * 0.5 - 22, AA.TRICK_BY[tr.id].name + '!', '#fff3a6');
      AA.audio.play('sparkle');
    }
  };
  /* nächsten gelernten Vorführ-Trick wählen – bei jedem Klopfen ein anderer */
  Fish.prototype.nextTrick = function () {
    const list = this.d.tricks.filter(function (id) { return TRICK_DUR[id]; });
    if (!list.length) return null;
    return list[this.trickI++ % list.length];
  };

  Fish.prototype.onKnock = function (kx, ky) {
    if (this.busy() || this.d.sick) return;
    const V = AA.view;
    if (this.def.school && V.schools && V.schools[this.d.sp]) V.schools[this.d.sp].alarm = V.time + 4;   // Schwarm rückt zusammen
    if (this.def.hab === 'lurk' && Math.hypot(this.x - kx, this.y - ky) < 420) { this.outT = 0; this.denT = AA.rand(8, 16); this.state = 'den'; this.say('❗', 0.8); return; }
    if (this.host && Math.hypot(this.x - kx, this.y - ky) < 420) { this.state = 'nestle'; this.nestTime = AA.rand(3, 5); this.say('❗', 0.8); return; }
    const dx = this.x - kx, dy = this.y - ky, dist = Math.hypot(dx, dy) || 1;
    if (dist < 340 && this.d.tricks.length) {         // trainierte Fische in der Nähe führen einen Trick vor
      const id = this.nextTrick();
      if (id && this.startTrick(id)) return;
    }
    if (this.def.flash && dist < 380) { this.flashT = 1.5; this.say('❗', 0.9); AA.audio.play('splash'); return; }      // Runde 20b: Fliegender Knurrhahn klappt die Flügelflossen auf
    if (this.def.spines && dist < 300) { this.flashT = 1.5; this.say('⚠️', 1.1); return; }      // Runde 20b: Kaninchenfisch stellt die Giftstacheln auf
    if (this.def.still) { if (dist < 320) this.say('😒', 1.3); return; }      // Steinfisch: lässt sich von Klopfen nicht aus der Ruhe bringen
    if (dist < 300) {
      const k = 1 - dist / 300, sp = 230 + 280 * k;
      this.vx = dx / dist * sp; this.vy = dy / dist * sp * 0.7;
      this.state = 'flee'; this.timer = 0.55 + 0.6 * k; this.amp = 1.5;
      this.scared = Math.random() < (this.d.adult ? 0.25 : 0.5);   // danach ab ins Versteck, wenn es eins gibt
      this.say('❗', 0.9);
    } else if (Math.random() < 0.65) {
      this.state = 'curious'; this.timer = AA.rand(2.5, 5);
      this.tx = kx + AA.rand(-80, 80); this.ty = ky + AA.rand(-60, 60);
      this.say('❓', 1.1);
    }
  };

  /* Runde 13: Grundfische, die nur am Boden chillen (def.front: Steinfisch, Petermännchen, Drachenkopf, Seeteufel, Blobfisch) liegen immer
     im vordersten Streifen, den man über der unteren Leiste noch ganz sieht (V.frontBand), und nie hinter Deko (V.coverAt). Aus ~20 Plätzen
     gewinnt der freieste; dazu: nicht auf einen anderen Grundfisch legen, lieber in der Nähe bleiben. */
  Fish.prototype.frontSpot = function (V, nearX, spread) {
    const s = this.size(), h = s * this.ar(), band = V.frontBand(), me = this;
    let best = null, bestP = Infinity;
    for (let k = 0; k < 28; k++) {                  // Runde 14: mehr Kandidaten, Deckung zählt doppelt, kurze Wege zählen mehr
      const z = AA.rand(band[0], band[1]), lim = AA.xLimits(z), m = s * 0.55 + 10;
      const raw = nearX !== undefined && k < 18 ? nearX + AA.rand(-spread, spread) : AA.rand(lim[0] + m, lim[1] - m);
      const x = AA.clamp(raw, lim[0] + m, lim[1] - m);
      let pen = V.coverAt(x, z, s * 0.9, h * 0.9) * 20;
      for (let i = 0; i < V.fish.length; i++) {
        const f = V.fish[i];
        if (f === me || !f.def.front) continue;
        const fx = f.post ? f.post.x : f.tx, fz = f.post ? f.post.z : (f.zT !== undefined ? f.zT : f.z);
        if (Math.abs(fx - x) < (s + f.size()) * 0.55 && Math.abs(fz - z) < 0.08) pen += 3;
      }
      pen += (band[1] - z) * 3;                        // lieber ganz vorn: dort steht am seltensten etwas davor
      if (nearX !== undefined) pen += Math.abs(x - nearX) / 300;
      if (pen < bestP) { bestP = pen; best = { x: x, z: z }; }
    }
    return best;
  };
  Fish.prototype.pickTarget = function (V, night) {
    if (this.def.still) {                             // Steinfisch: sitzt auf seinem Platz am Boden; nur alle paar Minuten rückt er ein Stück weiter
      const s0 = this.size(), h0 = s0 * this.ar();
      if (this.def.front) {                           // Runde 13: immer vorn und frei – verdeckt (postBad) oder Zeit um: neuer Platz
        if (!this.post || this.postT <= 0 || this.postBad) this.post = this.frontSpot(V, this.post ? this.post.x : this.x, this.post ? 220 : 420);
        this.postBad = false;
      } else if (!this.post) this.post = { x: AA.clamp(this.x, 130, AA.W - 130), z: AA.rand(0.3, 0.9) };
      else if (this.postT <= 0) this.post = { x: AA.clamp(this.post.x + AA.rand(-170, 170), 130, AA.W - 130), z: AA.clamp(this.post.z + AA.rand(-0.25, 0.25), 0.2, 0.95) };
      if (this.postT <= 0) this.postT = AA.rand(240, 600);      // 4 bis 10 Minuten am selben Fleck
      this.zT = this.post.z; this.tx = this.post.x; this.ty = AA.floorY(this.post.z, this.post.x) - h0 * 0.5;
      return;
    }
    if (this.def.front) {                             // Runde 13: Drachenkopf, Seeteufel & Co. – kurze Wege, aber immer vorn und frei
      const s1 = this.size(), h1 = s1 * this.ar(), q = this.frontSpot(V, this.x, 260), bot1 = AA.floorY(q.z, q.x) - h1 * 0.5;
      this.zT = q.z; this.tx = q.x;
      this.ty = night || this.d.sick || Math.random() < 0.94 ? AA.rand(bot1 - 6, bot1) : AA.rand(bot1 - 70, bot1 - 30);
      return;
    }
    let z = AA.clamp(this.z + AA.rand(-0.35, 0.35), 0.05, 1);
    const s = this.size(), h = s * this.ar();
    const lim = AA.xLimits(z);
    let x, y;
    if (Math.random() < 0.7) x = this.x + (Math.random() < 0.5 ? -1 : 1) * AA.rand(160, 520);
    else x = AA.rand(lim[0], lim[1]);
    let top = G.top + h * 0.5, bot = AA.floorY(z) - h * 0.5;
    const hab = this.def.hab;
    if (this.def.surface) {                           // Runde 20b: Galeere, Blauer Drache – treiben an der Oberfläche, die Strömung schiebt sie quer übers Becken
      if (!this.cur) this.cur = Math.random() < 0.5 ? -1 : 1;
      if (this.def.snake) {                           // Runde 20f: Gelbbauch – lange Bahnen an der Oberfläche, gewendet wird nur am Beckenrand
        const rs0 = s * (0.5 + this.reach());
        x = this.x + this.cur * AA.rand(220, 560);
        if (x < lim[0] + rs0 || x > lim[1] - rs0) { this.cur = -this.cur; x = this.x + this.cur * AA.rand(220, 560); }
      } else {
        x = this.x + this.cur * AA.rand(180, 420);
        if (x < lim[0] + s || x > lim[1] - s) { this.cur = -this.cur; x = this.x + this.cur * AA.rand(160, 360); }
      }
      y = top - h * 0.1;
    }
    else if (night || this.d.sick) y = AA.rand(bot - 110, bot);
    else if (hab === 'bottom') y = Math.random() < 0.94 ? AA.rand(bot - 6, bot) : AA.rand(bot - 110, bot - 40);              // Bodenbewohner: fast immer direkt auf dem Grund
    else if (hab === 'lurk') y = this.outT > 0 && !night ? (Math.random() < 0.45 ? AA.rand(bot - 30, bot) : AA.rand(top + (bot - top) * 0.3, bot - 30))   // auf Ausflug: auch quer durchs freie Wasser
      : (Math.random() < 0.9 ? AA.rand(bot - 20, bot) : AA.rand(bot - 140, bot));
    else if (hab === 'open') y = AA.rand(top, top + (bot - top) * 0.55);                                                     // Freiwasser: obere Hälfte
    else if (this.def.inv) y = Math.random() < 0.7 ? AA.rand(top, top + (bot - top) * 0.28) : AA.rand(top, bot);              // Kongowels: hängt am liebsten kopfüber unter der Oberfläche
    else y = Math.random() < 0.4 ? this.y + AA.rand(-130, 130) : AA.rand(top, bot);
    if ((hab === 'lurk' && !(this.outT > 0)) || hab === 'bottom') { if (Math.random() < 0.6) x = this.x + (Math.random() < 0.5 ? -1 : 1) * AA.rand(60, 240); }   // kurze Wege
    if (this.isLeader) { x = this.x + (Math.random() < 0.75 ? this.dir : -this.dir) * AA.rand(260, 620); if (hab !== 'bottom') y = AA.rand(top + 40, bot - 70); }   // Schwarm-Anführer: weite, ruhige Bahnen
    if (this.def.snake && !this.def.surface && !night) x = this.x + (Math.random() < 0.72 ? this.dir : -this.dir) * AA.rand(220, 560);   // (Gelbbauch: treibt wie Galeere & Co. mit der Strömung, wendet nur am Rand – Runde 20f)   // Runde 20c: Seeschlange – lange Wege, meist geradeaus weiter (jede Wende ist ein großer Bogen)
    if (this.def.snake && this.def.crevice && !night) y = AA.rand(Math.max(top, bot - 150), bot - 10);         // Dubois: Bodenjägerin, dicht über dem Grund
    let homed = false;
    if (this.def.home && !night && Math.random() < 0.75) {       // Lieblingsplatz (Clownfisch: Anemone): meistens dort in der Nähe
      const hs = V.homes(this.def.home);
      if (hs.length) { const q = hs[Math.floor(this.seed) % hs.length]; z = AA.clamp(q.z + AA.rand(-0.06, 0.06), 0.05, 1); x = q.x + AA.rand(-q.w * 0.7, q.w * 0.7); y = q.y - AA.rand(-6, 70); top = G.top + h * 0.5; bot = AA.floorY(z) - h * 0.5; homed = true; }
    }
    if (!homed && hab !== 'lurk' && !this.def.school && Math.random() < 0.3) {       // Schwarmtrieb: ab und zu zu einem Artgenossen (echte Schwarmfische: js/tankview.js V.schools)
      const sp = this.d.sp, me = this, pals = V.fish.filter(function (f) { return f !== me && f.d.sp === sp && !f.ghost; });
      if (pals.length) {
        const m = AA.pick(pals);
        z = AA.clamp(m.z + AA.rand(-0.1, 0.1), 0.05, 1);
        top = G.top + h * 0.5; bot = AA.floorY(z) - h * 0.5;
        x = m.x + AA.rand(-100, 100); y = m.y + AA.rand(-55, 55);
      }
    }
    this.zT = z;
    const rs = s * (0.5 + this.reach());
    this.tx = AA.clamp(x, lim[0] + rs, lim[1] - rs);
    const up = AA.lift(this.tx);                       // Boden-Form: über einem Hügel liegt der Grund höher
    if (up) { bot -= up; if (hab === 'bottom' || hab === 'lurk' || night || this.d.sick) y -= up; }
    this.ty = AA.clamp(y, top, Math.max(top, bot));
  };

  /* ---------- Runde 8: besonderes Verhalten ----------
     Gibt ein Ziel { tx, ty, b (Tempo-Faktor), r (Ankunfts-Radius), z, face } zurück – oder null (dann normales Umherschwimmen). */
  const BEH = AA.FISH_BEH = { den: 1, nestle: 1, patrol: 1, defend: 1, school: 1, clean: 1, hitch: 1, beg: 1, suck: 1, tend: 1 };      // Runde 20e: js/africa.js trägt eigene Zustände nach
  Fish.prototype.shoo = function (cx) {               // ein Clownfisch verjagt diesen Fisch von seiner Anemone
    if (this.busy() || this.state === 'hunt' || this.state === 'food') return;
    const dir = this.x < cx ? -1 : 1;
    this.vx = dir * 280; this.vy = AA.rand(-90, 40); this.state = 'flee'; this.timer = 0.7; this.amp = 1.5; this.say('😳', 0.9);
  };
  Fish.prototype.behave = function (dt, V, tank, night) {
    const d = this.d, def = this.def, s = this.size(), h = s * this.ar(), P = V.pointer, W = AA.W;
    // 1) Betteln: Futter-Werkzeug in der Hand und über dem Wasser – alle, die nicht am Grund leben, kommen nach oben
    if (V.tool === 'food' && P.inside && P.y < G.top + 280 && d.hunger < 0.92 && !d.sick && def.hab !== 'bottom' && def.hab !== 'lurk' && !this.ghost) {
      if (this.state !== 'beg' && Math.random() < 0.3) this.say('😋', 1.2);
      this.state = 'beg';
      return { tx: AA.clamp(P.x + ((this.seed * 13) % 9 - 4) * 16, 60, W - 60), ty: G.top + h * 0.5 + 14 + (this.seed * 7) % 4 * 14, b: 1.7, r: 10, z: AA.clamp(0.55 + ((this.seed * 3) % 5 - 2) * 0.08, 0.1, 1) };
    }
    // 1b) Saugwels (Runde 9): klebt am Boden, an einer Seitenscheibe oder an der Frontscheibe
    if (def.suck && !d.sick && !this.ghost) { const o = this.suckle(dt, V, tank, night, s); if (o) return o; }
    // 1c) Putzerfisch (Runde 9): schwimmt zu anderen Fischen und putzt sie – Kranke zuerst
    if (def.cleaner && !d.sick && !night && this.ph >= 2) { const o = this.tend(dt, V, s); if (o) return o; }
    // 2) Putzerstation (Putzergarnele im Becken): ab und zu anstellen und putzen lassen – Kranke sofort
    if (V.doctors && V.doctors.length && def.rig !== 'none' && !def.cleaner && !def.still && !(this.sk && this.sk.on)) {
      this.cleanT -= dt;
      if (d.sick && this.cleanT > 4) this.cleanT = 4;
      if (this.state === 'clean') {
        const o = this.station;
        this.cleanWay -= dt;                             // kommt er nicht hin (Gedränge, zu langsam), gibt er nach einer Weile auf
        if (!o || tank.deco.indexOf(o) < 0 || this.cleanWay <= 0) { this.state = 'wander'; this.cleanT = AA.rand(60, 140); return null; }
        const b = V.decoBox(o), side = this.cleanSide, tx = o.x + side * (b.w * 0.42 + s * 0.38), ty = AA.floorY(o.z, o.x) - b.h * 0.55 - h * 0.15;
        if (Math.hypot(tx - this.x, ty - this.y) < 14) {
          this.cleanHold -= dt; V.service[o.id] = V.time + 0.5;
          if (Math.random() < dt * 6) V.twinkle(this.x + AA.rand(-0.3, 0.3) * s, this.y + AA.rand(-0.3, 0.3) * h, '#bff8ff', 11);
          if (this.cleanHold <= 0) { const healed = AA.cleaned(d); this.say(healed ? '💚' : '✨', 1.5); AA.audio.play('sparkle'); this.state = 'wander'; this.cleanT = AA.rand(150, 320); return null; }
        }
        return { tx: tx, ty: ty, b: 1.3, r: 3, z: AA.clamp(o.z + 0.02, 0.02, 1), face: -side };
      }
      if (this.cleanT <= 0 && !this.busy() && def.hab === 'lurk' && !d.sick && Math.random() < 0.6) this.cleanT = AA.rand(150, 320);   // Höhlenbewohner kommen nur selten
      if (this.cleanT <= 0 && !this.busy()) {
        this.station = AA.pick(V.doctors); this.cleanSide = this.x < this.station.x ? -1 : 1; this.cleanHold = 2.8; this.cleanWay = 16; this.state = 'clean';
        return { tx: this.station.x, ty: this.y, b: 1.2, r: 6 };
      }
    }
    // 3) Lauerer (Muräne, Aal, Zitteraal, Wels): tagsüber abwechselnd in der Höhle hinter der Deko (nur der Kopf schaut raus) und auf Ausflug durchs Becken
    //    – etwa halb und halb (AA.LURK); nachts sind sie die ganze Zeit unterwegs
    if (def.hab === 'lurk' && !night && !d.sick) {
      if (this.outT > 0) { this.outT -= dt; if (this.outT <= 0) this.denT = AA.rand(AA.LURK.den[0], AA.LURK.den[1]); return null; }   // Ausflug: schwimmt frei herum
      this.denT -= dt;
      if (this.denT <= 0) { this.outT = AA.rand(AA.LURK.out[0], AA.LURK.out[1]); this.wait = 0; return null; }
      this.state = 'den';
      const hs = V.hideouts();
      if (hs.length) {
        const q = hs[this.denIdx % hs.length], out = q.x < W / 2 ? 1 : -1;      // Runde 14: fester Platz (vorher wanderte das Ziel ±5 px: Anfahren/Stoppen = Zucken)
        return { tx: q.x - out * s * 0.22, ty: q.y, b: 1.2, r: 12, z: Math.max(0.01, q.z - 0.02), face: out };
      }
      const left = (this.denIdx % 2) === 0;                                // keine Höhle: in eine hintere Ecke
      return { tx: left ? 70 + s * 0.3 : W - 70 - s * 0.3, ty: AA.floorY(0.12, left ? 80 : W - 80) - h * 0.5, b: 1, r: 10, z: 0.12, face: left ? 1 : -1 };
    }
    // Runde 20b: Titan-Drückerfisch verteidigt sein Revier – ein größeres Deko-Stück in seiner Nähe – und scheucht andere Fische weg (wie der Clownfisch)
    if (def.biter && d.adult && !night && !d.sick) {
      const me = this;
      if (this.revier && tank.deco.indexOf(this.revier) < 0) this.revier = null;
      if (!this.revier) {
        let bd = 1e9;
        for (let i = 0; i < tank.deco.length; i++) { const o = tank.deco[i], dd = AA.DECO_BY[o.type]; if (!dd || dd.crawl || dd.path || dd.flat || (dd.w || 0) < 90) continue; const q = Math.abs(o.x - this.x); if (q < bd) { bd = q; this.revier = o; } }
      }
      const o = this.revier;
      if (o) {
        const b = V.decoBox(o), cy = b.y + b.h * 0.5;
        if (this.state === 'defend') {
          const g = this.defTarget; this.defTime -= dt;
          if (g && !g.ghost && !g.dead && this.defTime > 0) {
            if (Math.hypot(g.x - this.x, g.y - this.y) < s * 0.6 + g.size() * 0.45) { g.shoo(b.cx); this.defTime = Math.min(this.defTime, 0.25); }
            return { tx: g.x, ty: g.y, b: 2.6, r: 2, z: g.z };
          }
          this.state = 'wander';
        }
        this.defT -= dt;
        if (this.defT <= 0) {
          this.defT = AA.rand(4, 9);
          if (Math.hypot(this.x - b.cx, this.y - cy) < 420) {
            const R = Math.max(150, b.w * 0.8), intr = V.fish.find(function (g) { return g !== me && !g.def.biter && !g.def.venom && !g.ghost && !g.busy() && g.state !== 'hunt' && Math.hypot(g.x - b.cx, g.y - cy) < R && Math.abs(g.z - o.z) < 0.4; });
            if (intr) { this.state = 'defend'; this.defTarget = intr; this.defTime = 1.6; this.say('😤', 1.2); return { tx: intr.x, ty: intr.y, b: 2.6, r: 2, z: intr.z }; }
          }
        }
      }
    }
    // 4) Clownfisch mit Anemone: wohnt darin, kuschelt sich hinein, verjagt Eindringlinge
    if (def.home && this.host && !d.sick) {
      const o = this.host;
      if (tank.deco.indexOf(o) < 0) { this.host = null; return null; }
      const b = V.decoBox(o);
      this.defT -= dt; this.nestT -= dt;
      if (this.state === 'defend') {
        const g = this.defTarget; this.defTime -= dt;
        if (!g || g.ghost || g.dead || this.defTime <= 0) { this.state = 'patrol'; }
        else {
          if (Math.hypot(g.x - this.x, g.y - this.y) < s * 0.6 + g.size() * 0.45) { g.shoo(b.cx); this.defTime = Math.min(this.defTime, 0.25); }
          return { tx: g.x, ty: g.y, b: 2.6, r: 2, z: g.z };
        }
      }
      if (!night && this.defT <= 0 && this.state !== 'nestle') {
        this.defT = AA.rand(1, 2);
        const me = this, intr = V.fish.find(function (g) { return g !== me && !g.def.home && !g.ghost && !g.busy() && g.state !== 'hunt' && Math.abs(g.x - b.cx) < b.w * 0.7 && g.y > b.y - 50 && g.y < b.by && Math.abs(g.z - o.z) < 0.4; });
        if (intr) { this.state = 'defend'; this.defTarget = intr; this.defTime = 1.4; this.defT = AA.rand(6, 10); this.say('😤', 1.2); return { tx: intr.x, ty: intr.y, b: 2.6, r: 2 }; }
      }
      if (this.state === 'nestle') {
        this.nestTime -= dt;
        if (this.nestTime > 0 || night) {
          V.nestle[o.id] = V.time + 0.4;
          return { tx: b.cx + Math.sin(V.time * 1.6 + this.seed) * b.w * 0.13, ty: b.y + b.h * 0.42 + Math.sin(V.time * 2.3 + this.seed) * 5, b: 1.1, r: 3, z: Math.max(0.01, o.z - 0.015) };
        }
        this.state = 'patrol'; this.nestT = AA.rand(6, 14);
      }
      if (this.nestT <= 0 || night) { this.state = 'nestle'; this.nestTime = AA.rand(3, 6); }
      this.state = this.state === 'nestle' ? 'nestle' : 'patrol';
      this.ppT -= dt;
      if (this.ppT <= 0 || !this.pp) { this.ppT = AA.rand(1.2, 3); this.pp = { x: b.cx + AA.rand(-0.42, 0.42) * b.w, y: b.y + AA.rand(-0.2, 0.3) * b.h - 6, z: AA.clamp(o.z + AA.rand(0.02, 0.07), 0.02, 1) }; }
      return { tx: this.pp.x, ty: this.pp.y, b: 0.8, r: 6, z: this.pp.z };
    }
    // 5) Schwarm: ab 6 Tieren derselben Art folgen alle einem Anführer in lockerer Formation
    const S = def.school && V.schools && V.schools[d.sp];
    if (S && S.leader !== this && !d.sick && !night) {
      const L = S.leader, i = this.schoolIdx || 1, tight = S.alarm > V.time ? 0.55 : 1, ls = L.size();
      const a = i * 2.39996 + V.time * 0.12, r = (0.7 + 0.32 * Math.sqrt(i)) * ls * tight;
      const tx = L.x - L.dir * ls * 0.4 + Math.cos(a) * r * 1.3, ty = def.hab === 'bottom' ? L.y + Math.sin(a) * 5 : L.y + Math.sin(a) * r * 0.5;
      this.state = 'school';
      const dd = Math.hypot(tx - this.x, ty - this.y);
      return { tx: tx, ty: ty, b: dd > 140 ? 2.1 : (tight < 1 ? 1.9 : 1.35), r: 5, z: AA.clamp(L.z + ((i % 3) - 1) * 0.07, 0.04, 1), face: dd < 40 ? L.dir : 0 };
    }
    // 6) Seepferdchen: hält sich mit dem Schwanz an einer Pflanze fest und wiegt sich mit ihr
    if (this.rig().kind === 'up' && V.plants && V.plants.length && !d.sick) {
      if (this.state !== 'hitch') {
        this.hitchT -= dt;
        if (this.hitchT <= 0 && !this.busy() && this.state !== 'food' && this.state !== 'flee') { const mist = this.d.sp === 'xmashorse' ? V.plants.filter(function (o) { const pd = AA.DECO_BY[o.type]; return pd && pd.mistle; }) : [];
          this.hitchO = mist.length && Math.random() < 0.75 ? AA.pick(mist) : AA.pick(V.plants); /* Runde 18: am liebsten an der Mistelzweig-Alge */ this.hitchTime = AA.rand(10, 24); this.hitchSide = Math.random() < 0.5 ? -1 : 1; this.state = 'hitch'; }
      }
      if (this.state === 'hitch') {
        const o = this.hitchO; this.hitchTime -= dt;
        if (!o || tank.deco.indexOf(o) < 0 || this.hitchTime <= 0) { this.state = 'wander'; this.hitchT = AA.rand(8, 22); return null; }
        const b = V.decoBox(o), sw = Math.sin(V.time * 1.25 + (o.x * 0.013) % 6.283) * b.w * 0.06;
        return { tx: b.cx + this.hitchSide * b.w * 0.1 + sw, ty: b.by - b.h * 0.42, b: 1, r: 4, z: AA.clamp(o.z + 0.02, 0.02, 1), face: -this.hitchSide };
      }
    }
    return null;
  };

  /* ---------- Runde 9: Saugwels ----------
     Ab und zu saugt er sich fest: am Boden (liegt flach auf dem Kies), an einer Seitenscheibe (senkrecht, Bauch zum Glas) oder an der
     Frontscheibe (dann sieht man ihn von unten, mit Saugmaul). Dort kriecht er langsam weiter und raspelt Algen ab. Futter, Klopfen,
     Balz oder Krankheit lösen ihn sofort. this.sk = { mode, on (klebt schon), t (wie lange noch), … } */
  AA.SUCK = { every: [6, 16], floor: [10, 22], wall: [12, 26], glass: [12, 26] };
  AA.wallX = function (side, z) { const d = AA.view.depthPx() * (1 - z) * 0.9 + 7; return side < 0 ? d : AA.W - d; };      // wo die Seitenscheibe in dieser Tiefe steht
  Fish.prototype.suckle = function (dt, V, tank, night, s) {
    const d = this.d, W = AA.W, K = AA.SUCK;
    let sk = this.sk;
    if (!sk) {
      if (this.ph < 2) return null;                    // Babys (rundes Baby-Bild) saugen sich noch nirgends fest
      this.skT -= dt;
      if (this.skT > 0 || this.busy()) return null;
      const r = Math.random(), canGlass = !night && !!AA.assets.get('fish/' + d.sp + '_u');
      const mode = night ? 'floor' : (V.suckMode || (r < 0.4 ? 'floor' : (r < 0.7 || !canGlass ? 'wall' : 'glass')));
      sk = this.sk = { mode: mode, on: false, t: AA.rand(K[mode][0], K[mode][1]) * (night ? 2 : 1), way: 16, step: 0, rot: 0 };
      if (mode === 'floor') { sk.z = AA.clamp(this.z + AA.rand(-0.3, 0.3), 0.08, 1); sk.x = AA.clamp(this.x + AA.rand(-260, 260), 100, W - 100); }
      else if (mode === 'wall') {
        sk.side = (this.x < W / 2 ? -1 : 1) * (Math.random() < 0.25 ? -1 : 1); sk.z = AA.clamp(this.z + AA.rand(-0.2, 0.2), 0.12, 0.95);
        sk.up = Math.random() < 0.7; sk.y = AA.rand(G.top + 110 + s * 0.5, AA.floorY(sk.z) - 40 - s * 0.55);
      } else { sk.x = AA.clamp(this.x + AA.rand(-220, 220), 120, W - 120); sk.y = AA.rand(G.top + 110, AA.floorY(1) - 120); sk.ang = this.dir > 0 ? 0 : Math.PI; }
    }
    this.state = 'suck';
    const h = s * this.ar();
    let tx, ty, z, b = 1.1, r = 6, face = 0;
    if (sk.mode === 'floor') { z = sk.z; tx = sk.x; ty = AA.floorY(z, tx) - h * 0.5 + 2; }
    else if (sk.mode === 'wall') {
      z = sk.z; const wx = AA.wallX(sk.side, z);
      tx = wx - sk.side * (sk.on ? h * 0.5 : s * 0.5 + 2); ty = sk.y;
      face = sk.on ? (sk.up ? sk.side : -sk.side) : sk.side;         // am Glas: Kopf nach oben bzw. unten (das Bild wird um 90° gedreht)
    } else { z = 1; tx = sk.x; ty = sk.y; }
    const dist = Math.hypot(tx - this.x, ty - this.y);
    if (!sk.on) {
      sk.way -= dt;
      if (sk.way <= 0) { this.sk = null; this.skT = AA.rand(4, 9); return null; }      // kommt nicht hin: nächstes Mal
      if (dist < (sk.mode === 'floor' ? 10 : 16) && Math.abs(this.z - z) < 0.12) {
        sk.on = true; this.vx = this.vy = 0;
        if (sk.mode === 'wall') { this.dir = sk.up ? sk.side : -sk.side; this.face = this.dir; }
        if (sk.mode === 'glass') { sk.ang = this.dir > 0 ? 0 : Math.PI; }
      }
      return { tx: tx, ty: ty, b: b, r: 3, z: z, face: face };
    }
    // klebt: Zeit läuft, ab und zu ein Stück weiterkriechen
    sk.t -= dt; sk.step -= dt; sk.rot = Math.min(1, sk.rot + dt * 3.2);
    if (sk.t <= 0) {                                   // lässt los
      this.sk = null; this.skT = AA.rand(K.every[0], K.every[1]); this.state = 'wander'; this.wait = 0.3; this.tx = this.x; this.ty = this.y;
      if (sk.mode === 'wall') { this.x -= sk.side * (s * 0.5 - h * 0.5); this.dir = -sk.side; }
      return null;
    }
    this.gapeT -= dt;
    if (this.gapeT <= 0) { this.gapeT = AA.rand(0.9, 1.8); this.chomp = Math.max(this.chomp, 0.35); }      // raspelt
    if (sk.step <= 0) {
      sk.step = AA.rand(3, 8);
      if (sk.mode === 'floor') sk.x = AA.clamp(sk.x + AA.rand(-46, 46), 90, W - 90);
      else if (sk.mode === 'wall') {
        const lo = G.top + 70 + s * 0.5, hi = AA.floorY(sk.z) - 30 - s * 0.55;
        if (sk.y <= lo + 20) sk.up = false; else if (sk.y >= hi - 20) sk.up = true; else if (Math.random() < 0.25) sk.up = !sk.up;
        sk.y = AA.clamp(sk.y + (sk.up ? -1 : 1) * AA.rand(40, 130), lo, Math.max(lo, hi));
        this.dir = sk.up ? sk.side : -sk.side;
      } else { sk.x = AA.clamp(sk.x + AA.rand(-230, 230), 110, W - 110); sk.y = AA.clamp(sk.y + AA.rand(-150, 150), G.top + 100, AA.floorY(1) - 110); }
    }
    if (sk.mode === 'glass') {
      if (dist > 4) { const a = Math.atan2(ty - this.y, tx - this.x); let df = a - sk.ang; df = Math.atan2(Math.sin(df), Math.cos(df)); sk.ang += AA.clamp(df, -1.6 * dt, 1.6 * dt); if (Math.abs(df) > 0.6) b = 0.02; }
      if (dist > 4 && V.wipeAt) V.wipeAt(this.x + Math.cos(sk.ang) * s * 0.36, this.y + Math.sin(sk.ang) * s * 0.36);      // frisst eine saubere Spur in die Algen
    }
    return { tx: tx, ty: ty, b: Math.min(b, 0.3), r: 2, z: z, face: face };
  };
  /* ---------- Runde 9: Putzerfisch ----------
     Sucht sich alle paar Sekunden einen Kunden (Kranke zuerst), schwimmt hin und wuselt ein paar Sekunden an ihm entlang. Der Kunde hält
     dabei fast still. Danach ist er „geputzt“ (AA.cleaned: Kranke werden gesund – wie an der Putzerstation der Garnele). */
  Fish.prototype.tend = function (dt, V, s) {
    if (this.state === 'tend') {
      const g = this.client; this.tendWay -= dt;
      if (!g || g.ghost || g.dead || V.fish.indexOf(g) < 0 || g.busy() || this.tendWay <= 0) { this.client = null; this.state = 'wander'; this.tendT = AA.rand(5, 12); return null; }
      const gs = g.size(), gh = gs * g.ar(), a = V.time * 2.6 + this.seed;
      const tx = g.x + Math.cos(a) * gs * 0.36, ty = g.y + Math.sin(a * 1.3) * gh * 0.34;
      if (Math.hypot(g.x - this.x, g.y - this.y) < gs * 0.6 + s * 0.5 + 12) {
        this.tendHold -= dt; g.tended = V.time + 0.5;
        if (Math.random() < dt * 5) V.twinkle(this.x + AA.rand(-0.4, 0.4) * s, this.y + AA.rand(-0.3, 0.3) * s, '#bff8ff', 10);
        if (this.tendHold <= 0) {
          const healed = AA.cleaned(g.d, this.d.name); g.say(healed ? '💚' : '✨', 1.5); if (healed) AA.emit('recovered', g.d, AA.tank());
          AA.audio.play('sparkle'); this.client = null; this.state = 'wander'; this.tendT = AA.rand(AA.TEND.every[0], AA.TEND.every[1]); return null;
        }
      }
      return { tx: tx, ty: ty, b: 2.0, r: 3, z: AA.clamp(g.z + 0.012, 0.02, 1) };
    }
    this.tendT -= dt;
    const me = this, sick = V.fish.filter(function (g) { return g !== me && g.d.sick && !g.ghost; });
    if (sick.length && this.tendT > 2) this.tendT = 2;                 // ein Kranker im Becken: gleich hin
    if (this.tendT > 0 || this.busy()) return null;
    const pool = sick.length ? sick : V.fish.filter(function (g) { return g !== me && !g.ghost && !g.busy() && !g.def.cleaner && g.state !== 'hunt' && !(g.sk && g.sk.on) && g.state !== 'den' && !(g.tended > V.time); });
    if (!pool.length) { this.tendT = AA.rand(6, 12); return null; }
    this.client = AA.pick(pool); this.tendHold = AA.rand(AA.TEND.stay[0], AA.TEND.stay[1]); this.tendWay = 18; this.state = 'tend';
    return { tx: this.client.x, ty: this.client.y, b: 2.0, r: 3 };
  };
  AA.TEND = { every: [16, 36], stay: [2.8, 4.6] };

  Fish.prototype.update = function (dt, V, tank) {
    const d = this.d, def = this.def, night = !!AA.state.settings.night;
    const ph = AA.phase(d);
    if (ph !== this.ph) { this.ph = ph; this.pop = 1; }               // neue Wachstumsphase: kurzer „Plopp“
    this.scale += (AA.PHASE_SCALE[ph] - this.scale) * Math.min(1, dt * 5);
    if (this.pop > 0) this.pop = Math.max(0, this.pop - dt * 1.5);
    if (this.chomp > 0) this.chomp = Math.max(0, this.chomp - dt * 4);
    if (this.emoteT > 0) { this.emoteT -= dt; if (this.emoteT <= 0) this.emote = null; }
    if (d.v && !this.ghost) {                        // Farbvariante: ein Funkeln irgendwo auf dem Körper
      this.twT -= dt;
      if (this.twT <= 0) {
        const tw = TW[d.v] || TW.gold, sz = this.size(), ar = this.ar();
        this.twT = tw[1] * AA.rand(0.6, 1.4);
        if (this.y > -20) V.twinkle(this.x + AA.rand(-0.42, 0.42) * sz, this.y + AA.rand(-0.42, 0.42) * sz * ar, tw[0] || AA.pick(RB), AA.clamp(sz * 0.11, 7, 15));
      }
    }
    this.blinkT -= dt;                               // blinzeln; nachts schlafen sie mit geschlossenen Augen
    if (this.blinkT <= 0) {
      if (this.eyeShut) { this.eyeShut = false; this.blinkT = night ? AA.rand(0.5, 1.4) : (Math.random() < 0.18 ? 0.2 : AA.rand(2.2, 6.5)); }
      else { this.eyeShut = true; this.blinkT = night ? AA.rand(3, 8) : 0.13; }
    }

    if (this.state === 'leave') {                    // verkauft: ab nach oben
      this.vy += (-460 - this.vy) * Math.min(1, dt * 3); this.vx *= (1 - Math.min(1, dt * 2));
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.amp = 1.4; this.phase += dt * 22; this.spin = 0;
      this.tilt += (-0.95 - this.tilt) * Math.min(1, dt * 6);
      this.face += (this.dir - this.face) * Math.min(1, dt * 10);
      if (this.y < -140) this.dead = true;
      return;
    }
    if (this.state === 'enter') {                    // gekauft: plumpst ins Wasser
      this.timer -= dt;
      this.vy += (70 - this.vy) * Math.min(1, dt * 1.5);
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.phase += dt * 14; this.amp = 1.1;
      this.tilt += (0.5 - this.tilt) * Math.min(1, dt * 5);
      if (Math.random() < dt * 16) V.addBubble(this.x + AA.rand(-16, 16), this.y - 8, AA.rand(2, 5));
      if (this.timer <= 0 || this.y > this.ty) { this.state = 'wander'; this.wait = 0.4; this.tx = this.x; this.ty = this.y; }
      return;
    }
    if (this.state === 'trick' && this.tr) { this.runTrick(dt); return; }
    if (def.somersault && d.adult && !night && this.state === 'wander' && !this.ghost && !V.photoMode) {      // Runde 18: Eisbär – ab und zu ein Purzelbaum, ganz von allein
      this.sumT = (this.sumT === undefined ? AA.rand(15, 45) : this.sumT) - dt;
      if (this.sumT <= 0) { this.sumT = AA.rand(35, 80); if (!d.sick && d.hunger > 0.3 && this.startTrick('loop', true)) return; }
    }

    if (this.flashT > 0) this.flashT -= dt;          // Runde 20b: Knurrhahn – Flügel auf (1,5 s)
    if (this.snapT > 0) this.snapT -= dt;
    if (def.yawn && !V.photoMode) {                   // Runde 20b: Gelber Angler gähnt ab und zu riesig (Augen halb zu)
      if (this.yawnT > 0) { this.yawnT -= dt; this.eyeShut = this.yawnT > 0.2; }
      this.yawnW = (this.yawnW === undefined ? AA.rand(15, 40) : this.yawnW) - dt;
      if (this.yawnW <= 0 && this.state === 'wander') { this.yawnW = AA.rand(30, 70); this.yawnT = 1.6; this.say('🥱', 1.6); }
    }
    if ((def.biter || def.id === 'bluedragon') && d.adult && !d.sick && !night && !this.ghost && !V.photoMode && this.state === 'wander') {
      this.seekW = (this.seekW === undefined ? AA.rand(def.biter ? 40 : 20, def.biter ? 90 : 60) : this.seekW) - dt;
      if (this.seekW <= 0) {
        if (def.biter) { if (AA.state.settings.bite !== false && AA.biteTarget && AA.biteTarget()) { this.state = 'bite'; this.timer = 7; } else this.seekW = 12; }
        else { const mw = AA.seaPartner ? AA.seaPartner(this, 'manowar') : null; if (mw) { this.state = 'nibble'; this.timer = 25; this.partner = mw; } else this.seekW = AA.rand(30, 60); }
      }
    }
    const hungry = d.hunger < B.hungryBelow, starving = d.hunger <= 0.001;
    const s = this.size(), h = s * this.ar();
    const speed = def.speed * (d.adult ? 1 : 1.15) * (night && def.hab !== 'lurk' ? 0.4 : 1) * (d.sick ? 0.4 : (starving ? 0.65 : 1)) * (this.isLeader ? 0.82 : 1) * (this.tended > V.time ? 0.22 : 1);   // Lauerer sind nachtaktiv; wer gerade geputzt wird, hält still
    if (def.still) this.postT -= dt;
    let burst = 1;
    const mating = AA.matingOf(tank, d.id);          // Runde 11: mehrere Paare können gleichzeitig balzen
    const hunt = null;                               // Runde 11: Räuber jagen keine Fische mehr

    if (this.state === 'flee') {
      this.timer -= dt; this.near = false;
      const k = 1 - Math.min(1, dt * 1.7);
      this.vx *= k; this.vy *= k;
      if (this.timer <= 0) {
        this.state = 'wander'; this.wait = 0; this.pickTarget(V, night);
        if (this.scared) {                           // Schreck: zum nächsten Versteck flüchten
          this.scared = false;
          const hs = V.hideouts(), me = this;
          if (hs.length) {
            hs.sort(function (a, b) { return Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y); });
            this.state = 'hide'; this.timer = AA.rand(3, 6); this.tx = hs[0].x + AA.rand(-14, 14); this.ty = hs[0].y + AA.rand(-8, 8); this.zT = hs[0].z;
          }
        }
      }
    } else {
      let tx = this.tx, ty = this.ty, arriveR = 6, partner = null;
      const P = V.pointer;
      if (mating) {                                  // Balz-Tanz: die beiden umkreisen sich über der Beckenmitte, Herzchen steigen auf
        const isA = mating.a === d.id;
        partner = V.byId[isA ? mating.b : mating.a];
        const ms = tank.matings, k = ms.indexOf(mating), n = ms.length;          // jedes Paar tanzt an seinem eigenen Platz
        const cx = AA.clamp(AA.W / 2 + (k - (n - 1) / 2) * 240, 190, AA.W - 190), cy = AA.floorY(0.55) - 170 - (k % 2) * 40;
        const a = V.time * 2.3 + (isA ? 0 : Math.PI);
        tx = cx + Math.cos(a) * (s * 0.55 + 26); ty = cy + Math.sin(a) * 30;
        this.zT = 0.55; burst = 2.2; this.state = 'mate'; arriveR = 1;
        this.heartT -= dt;
        if (this.heartT <= 0 && Math.abs(this.x - cx) < 150) { this.heartT = 0.4; if (isA) V.puff('heart', cx + AA.rand(-20, 20), cy - 30, 1); }
      } else if (hunt && V.byId[hunt.a] && V.byId[hunt.b]) {
        const isP = hunt.a === d.id, o = V.byId[isP ? hunt.b : hunt.a];
        if (isP) { tx = o.x; ty = o.y; this.zT = o.z; burst = 2.4; arriveR = 1; }          // Räuber: hinterher
        else {                                         // Beute: weg vom Räuber, an den Wänden entlang ausweichen
          const dx = this.x - o.x, dy = this.y - o.y, dd = Math.hypot(dx, dy) || 1;
          tx = this.x + dx / dd * 240; ty = this.y + dy / dd * 150;
          if (tx < 110 || tx > AA.W - 110) { tx = AA.clamp(tx, 110, AA.W - 110); ty = this.y + (this.y < 330 ? 190 : -190); }
          ty = AA.clamp(ty, G.top + 70, AA.floorY(this.z, this.x) - 70);
          burst = 2.0; arriveR = 1;
          if (Math.random() < dt * 5) V.addBubble(this.x, this.y - 6, AA.rand(2, 4));
        }
        this.state = 'hunt';
      } else {
        if (this.state === 'mate' || this.state === 'hunt') { this.state = 'wander'; this.wait = 0.5; this.tx = this.x; this.ty = this.y; tx = this.x; ty = this.y; }
        let best = null, bd = 1e9;
        this.faceLock = 0; this.resting = false;
        const wantLive = def.pred && d.hunger < 0.95 && V.live && V.live.length;
        const wantColor = V.food.length && d.adult && !def.sterile && (d.colorN | 0) < AA.FOOD2.color.eggs && V.food.some(function (fl) { return fl.kind === 'color' && !fl.eaten; });   // Runde 21a: Farbfutter auch satt
        if ((hungry || d.sick || d.hunger < 0.97 || wantLive || wantColor) && (V.food.length || wantLive)) {   // Futter suchen
          const m = this.mouth(), floorY = AA.floorY(this.z, this.x);
          for (let i = 0; i < V.food.length; i++) {
            const fl = V.food[i];
            if (fl.eaten) continue;
            const k = fl.kind;                       // Spezialfutter (js/life.js): Medizin für Kranke, Farb-/Turbofutter auch ohne großen Hunger
            if (k === 'color' ? (!d.adult || def.sterile || (d.colorN | 0) >= AA.FOOD2.color.eggs)      // Runde 21a: Farbfutter ist ein Leckerli – Erwachsene fressen es auch satt; Babys und Volle lassen es liegen
              : (k === 'med' ? !d.sick : (k === 'turbo' ? d.hunger >= 0.97 : !hungry))) continue;
            if (def.hab === 'bottom' && !fl.landed && floorY - fl.y > 150 && d.hunger > 0.05) continue;   // Bodenfische warten, bis es herabsinkt
            if (def.hab === 'lurk' && !night && Math.abs(fl.x - this.x) > 380) continue;                  // Lauerer: nur was nah an der Höhle ist
            if (def.still && d.hunger > 0.3 && Math.hypot(fl.x - this.x, fl.y - this.y) > 340) continue;         // Steinfisch: nur was ihm fast vors Maul fällt – erst mit richtig Hunger rafft er sich auf
            const dd = Math.hypot(fl.x - m.x, fl.y - m.y);
            if (dd < bd) { bd = dd; best = fl; }
          }
          if (wantLive) for (let i = 0; i < V.live.length; i++) {          // Räuber: Futterfische jagen
            const lv = V.live[i]; if (lv.eaten) continue;
            const dd = Math.hypot(lv.x - m.x, lv.y - m.y) * 0.8;
            if (dd < bd) { bd = dd; best = lv; }
          }
          if (best) {
            // Flocke am Boden, an die das Maul nicht ganz herankommt (der Fisch liegt schon auf dem Kies auf): trotzdem schnappen
            const onFloor = best.landed && Math.abs(best.x - m.x) < 12 + s * 0.08 && this.y > AA.floorY(this.z, this.x) - h * 0.5 - 8 && Math.abs(best.y - m.y) < h * 0.9 + 30;
            if (bd < 14 + s * 0.07 || onFloor || (best.live && bd < 22 + s * 0.12)) {
              best.eaten = true; this.chomp = 1;
              const kind = best.live ? 'live' : best.kind; best = null;
              const rec = kind === 'live' ? false : AA.bite(d);
              const fx = kind ? AA.foodEffect(d, kind) : null;
              AA.audio.play(kind === 'live' ? 'chomp' : 'eat');
              if (fx === 'healed' || rec) { this.say('💚', 1.6); AA.emit('recovered', d, tank); }
              else if (fx === 'color') { this.say('🌈', 1.4); V.twinkle(this.x, this.y - h * 0.4, '#ffe066', 14); }
              else if (fx === 'turbo') { this.say('⚡', 1.4); }
              else if (fx === 'live') { this.say('😋', 1.4); V.puff('spark', m.x, m.y, 3); }
              if (Math.random() < 0.3) V.addBubble(m.x, m.y, 2);
              this.state = 'food';
            } else {
              // Anflugseite festhalten: Sie wechselt nur, wenn die Flocke deutlich auf der anderen Seite liegt – sonst pendelt der Fisch
              // (Ziel hängt von der Blickrichtung ab, die Blickrichtung vom Ziel) und dreht sich mehrmals pro Sekunde um.
              if (this.foodT !== best) { this.foodT = best; this.foodDir = best.x >= this.x ? 1 : -1; }
              else if (Math.abs(best.x - this.x) > s * 0.75) this.foodDir = best.x >= this.x ? 1 : -1;
              const rg = this.rig(), mm = rg.mouth || NO_RIG.mouth, dirM = rg.kind === 'front' ? 1 : this.foodDir;
              tx = best.x - dirM * (mm[0] - 0.5) * s; ty = best.y - (m.y - this.y);
              burst = d.sick ? 1.6 : 2.3; this.state = 'food'; arriveR = 2;
              if (def.lure && !d.sick && bd < 230) { burst = 7; if (!(this.snapT > 0)) this.snapT = 0.35; }      // Runde 20f: Gelber Angler – Futter vorm Maul: blitzschnell zuschnappen
            }
          }
        }
        if (!best && this.state === 'food') { this.state = 'wander'; this.wait = 0; this.pickTarget(V, night); tx = this.tx; ty = this.ty; }
        // „Folge der Hand“: mit dem Klopf-Werkzeug die Maustaste halten
        if (this.state !== 'food' && V.tool === 'tap' && P.down && d.tricks.indexOf('follow') >= 0 && !d.sick && Math.hypot(P.x - this.x, P.y - this.y) < 520) {
          tx = P.x - this.dir * s * 0.5; ty = P.y; burst = 2.4; arriveR = 3; this.state = 'follow';
          if (this.holdId !== V.holdId && Math.hypot(P.x - this.x, P.y - this.y) < s * 0.8 + 30) { this.holdId = V.holdId; AA.trickDone(d); V.puff('star', this.x, this.y - h * 0.5, 2); }
        } else if (this.state === 'follow') { this.state = 'wander'; this.wait = 0.3; this.tx = this.x; this.ty = this.y; tx = this.x; ty = this.y; }
        if (this.state === 'bite' || this.state === 'nibble') {      // Runde 20b: Titan-Drückerfisch beißt den Zeiger · Blauer Drache knabbert an der Galeere
          const bite = this.state === 'bite', g = bite ? (AA.biteTarget ? AA.biteTarget() : null) : (this.partner && V.fish.indexOf(this.partner) >= 0 ? this.partner : null);
          this.timer -= dt;
          if (!g || this.timer <= 0 || (bite && AA.state.settings.bite === false)) { this.state = 'wander'; this.wait = 0.3; this.seekW = AA.rand(50, 100); this.partner = null; this.biteDir = 0; tx = this.x; ty = this.y; this.tx = tx; this.ty = ty; }
          else {
            const m = this.mouth(), gx = g.x, gy = bite ? g.y : g.y + g.size() * g.ar() * 0.12, mm = this.rig().mouth || NO_RIG.mouth;
            // Anflugseite festhalten (wie beim Futter): sonst steht er mit der Körpermitte auf dem Ziel und dreht sich hin und her, das Maul kommt nie an
            if (!this.biteDir || (Math.abs(gx - this.x) > s * 0.9 && (gx >= this.x ? 1 : -1) !== this.biteDir)) this.biteDir = gx >= this.x ? 1 : -1;
            tx = gx - this.biteDir * (mm[0] - 0.5) * s; ty = gy - (m.y - this.y); burst = bite ? 3.4 : 1.6; arriveR = 3; this.zT = bite ? 1 : g.z;
            if (Math.hypot(gx - m.x, gy - m.y) < (bite ? 18 : 26) + s * 0.06) {
              this.chomp = 1; this.state = 'wander'; this.wait = 0.8; this.partner = null; this.biteDir = 0;
              if (bite) { this.seekW = AA.rand(180, 300); if (AA.titanBite) AA.titanBite(this, gx, gy); }      // höchstens alle 3–5 Minuten
              else { this.seekW = AA.rand(45, 90); d.hunger = Math.max(d.hunger, 0.97); this.say('😋', 1.4); V.puff('spark', gx, gy, 3); AA.audio.play('eat'); }
            }
          }
        }
        if (this.state === 'curious') { this.timer -= dt; if (this.timer <= 0) { this.state = 'wander'; this.wait = 0; } }
        if (this.state === 'hide') { burst = 1.5; this.timer -= dt; if (this.timer <= 0) { this.state = 'wander'; this.wait = 0; this.hideT = AA.rand(AA.HIDE.every[0], AA.HIDE.every[1]); } }
        if (this.state !== 'food' && this.state !== 'follow' && this.state !== 'curious' && this.state !== 'hide' && this.state !== 'bite' && this.state !== 'nibble') {
          const o = this.behave(dt, V, tank, night);   // Runde 8: Höhle, Anemone, Schwarm, Putzerstation, Pflanze, Betteln
          if (o) { tx = o.tx; ty = o.ty; burst = o.b || 1; arriveR = o.r || 6; if (o.z !== undefined) this.zT = o.z; if (o.face) this.faceLock = o.face; }
          else if (BEH[this.state]) { this.state = 'wander'; this.wait = 0.2; this.tx = this.x; this.ty = this.y; tx = this.x; ty = this.y; }
        }
        if (this.state === 'wander') {
          this.hideT -= dt;
          if (def.hab === 'open' || def.hab === 'lurk' || this.host || this.isLeader || def.still || def.suck || def.cleaner || def.front || def.snake) this.hideT = 30;      // Runde 20f: Seeschlangen verstecken sich nicht (eigene Spalten-/Ringel-Verhalten)   // Freiwasser-Arten, Lauerer (eigene Höhle), Clownfische (Anemone), Schwarm-Anführer; Grundfische vorn (Runde 13)
          if (this.hideT <= 0) {                     // ab und zu kurz ins Versteck (Baumstamm & Co.) – die meiste Zeit schwimmen sie frei herum (AA.HIDE)
            this.hideT = AA.rand(AA.HIDE.every[0], AA.HIDE.every[1]);
            const hs = V.hideouts();
            if (hs.length) {
              const sp = d.sp, favs = hs.filter(function (q) { return q.fav === sp; });
              const q = favs.length && Math.random() < 0.8 ? AA.pick(favs) : AA.pick(hs);
              this.state = 'hide'; this.timer = AA.rand(AA.HIDE.stay[0], AA.HIDE.stay[1]);
              this.tx = tx = q.x + AA.rand(-14, 14); this.ty = ty = q.y + AA.rand(-8, 8); this.zT = q.z;
            }
          }
        }
      }
      if (this.dodgeT > 0) { this.dodgeT -= dt; if (this.state === 'wander') burst = Math.max(burst, 3); }      // Runde 14: verdeckter Grundfisch zieht flott um (sonst kriecht er ewig hinter Steinen entlang)
      const dx = tx - this.x, dy = ty - this.y, dist = Math.hypot(dx, dy);
      if (def.still && this.state === 'wander' && dist > 120) burst = Math.max(burst, 3);      // Runde 20b: Steinfisch & Gelber Angler – weit weg vom Platz (z. B. nach dem Laden): zügig hin
      this.near = dist < Math.max(arriveR + 14, s * 0.1);      // (fast) am Ziel
      let dvx = 0, dvy = 0;
      if (dist > arriveR) {
        let sp = Math.min(speed * burst, dist * 2.4 + 8);
        if (def.hop && def.hab === 'bottom' && this.state !== 'flee') {            // Runde 20b: hüpft ruckartig – kurzer Satz, dann Pause
          const hp = (V.time * 1.25 + this.seed) % 1, on = hp < 0.24;
          sp *= on ? 3.4 : 0.06;
          dvy = on ? -Math.sin(hp / 0.24 * Math.PI) * 55 : 0;
        }
        dvx = dx / dist * sp; dvy += dy / dist * sp;
      }
      if (def.surface && (this.state === 'wander' || this.state === 'nibble')) {       // Runde 20b: Galeere & Blauer Drache haben Auftrieb – sie steigen immer wieder nach oben
        const want = G.top + h * 0.4;
        if (this.y > want + 4) dvy = Math.min(dvy, -Math.min(70, (this.y - want) * 0.9));
      }
      if (!def.venom && V.venoms && V.venoms.length && (this.state === 'wander' || this.state === 'school' || this.state === 'curious' || this.state === 'patrol')) {      // Runde 20b: Gift-Tieren (Quallen & Co.) weicht man aus – nur beim Umherschwimmen, nicht beim Fressen, Beißen, Balzen
        for (let i = 0; i < V.venoms.length; i++) {
          const o = V.venoms[i];
          if (o === this || Math.abs(o.z - this.z) > 0.3) continue;
          const ox = this.x - o.x, oy = this.y - o.y, r = o.size() * 0.55 + s * 0.4 + 26, dd = Math.hypot(ox, oy);
          if (dd < r && dd > 0.01) { const kk = (1 - dd / r) * Math.max(60, speed * 2.4); dvx += ox / dd * kk; dvy += oy / dd * kk; }
        }
      }
      if (dist <= arriveR && this.state === 'wander') {      // am Ziel: kurz warten, dann das nächste Ziel (Runde 20f: hing seit 20b als „else“ an der Gift-Abfrage – Fische wählten unterwegs dauernd neue Ziele und blieben neben Quallen stehen)
        this.wait -= dt;
        if (def.hab === 'bottom' && !d.sick) {          // Bodenfisch rastet auf dem Kies und gründelt ab und zu im Sand
          this.resting = true; this.digT -= dt;
          if (this.digT <= 0 && !def.still && this.y > AA.floorY(this.z, this.x) - h * 0.5 - 12) { this.digT = AA.rand(1.8, 4.5); const m = this.mouth(); V.puff('dust', m.x + this.dir * 4, AA.floorY(this.z, m.x) - 3, 5); this.chomp = Math.max(this.chomp, 0.5); this.tilt += 0.18; }
        }
        if (def.front && !d.sick) {                      // Runde 13: liegt er verdeckt (neue Deko davor) oder zu weit hinten? Dann gleich umziehen
          this.coverT = (this.coverT || 0) - dt;
          if (this.coverT <= 0) {
            this.coverT = 2.5;
            if (V.coverAt(this.x, this.z, s * 0.9, h * 0.9) > 0.3 || this.z < V.frontBand()[0] - 0.04) { this.postBad = true; this.wait = 0; this.dodgeT = 12; }
          }
        }
        if (this.wait <= 0) { this.pickTarget(V, night); const amb = def.id === 'monkfish' || def.id === 'angler'; this.wait = AA.rand(0.2, 2.6) * (d.sick ? 2.5 : 1) * (def.still ? 12 : (def.hab === 'lurk' ? (this.outT > 0 ? 1.2 : 3) : (def.hab === 'bottom' ? (amb ? 6 : 2.8) : (def.snake ? 2.2 : 1)))); }
      } else if (this.state === 'den' && dist <= arriveR) {
        this.resting = true;                           // Runde 14: Muräne & Co. liegen entspannt in der Höhle – kein Schnappen, kein Wippen, kaum Wellen
      } else if (this.state === 'nestle' && dist <= arriveR) {
        this.gapeT -= dt;
        if (this.gapeT <= 0) { this.gapeT = AA.rand(1.2, 2.2); if (def.hab === 'lurk') this.chomp = Math.max(this.chomp, 0.4); }
      }
      const k = Math.min(1, dt * (def.hop ? 9 : (burst > 1 ? 4.2 : 2.3)));
      this.vx += (dvx - this.vx) * k; this.vy += (dvy - this.vy) * k;
      if (partner && Math.abs(this.x - partner.x) < s * 2) this.lookAt = partner.x; else this.lookAt = null;
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.sk && this.state !== 'suck') {            // Futter, Schreck, Balz …: der Saugwels lässt los
      if (this.sk.on && this.sk.mode === 'wall') this.dir = -this.sk.side;
      this.sk = null; this.skT = AA.rand(AA.SUCK.every[0], AA.SUCK.every[1]);
    }

    // im Becken bleiben
    this.z += (this.zT - this.z) * Math.min(1, dt * (this.state === 'den' || this.state === 'nestle' || this.state === 'school' || this.state === 'suck' ? 2.5 : 0.7));
    const wallOn = this.sk && this.sk.mode === 'wall';      // auf dem Weg an die Seitenscheibe bzw. daran: bis ans Glas heran
    const lim = wallOn ? [AA.wallX(-1, this.z), AA.wallX(1, this.z)] : AA.xLimits(this.z), mx = wallOn ? (this.sk.on ? h * 0.42 : s * 0.46) : s * 0.42;
    if (this.x < lim[0] + mx) { this.x = lim[0] + mx; if (this.vx < 0) this.vx *= -0.4; }
    if (this.x > lim[1] - mx) { this.x = lim[1] - mx; if (this.vx > 0) this.vx *= -0.4; }
    const vert = wallOn && this.sk.on ? s : h;        // senkrecht an der Scheibe: die Länge zählt
    const top = G.top + vert * 0.4, bot = AA.floorY(this.z, this.x) - vert * 0.5;
    if (this.y < top) { this.y = top; if (this.vy < 0) this.vy *= -0.3; }
    if (this.y > bot) { this.y = bot; if (this.vy > 0) this.vy *= -0.3; }

    // Blickrichtung, Neigung, Flossenschlag
    const sp2 = Math.hypot(this.vx, this.vy);
    if (this.state === 'mate' && this.lookAt !== null && this.lookAt !== undefined) this.dir = this.lookAt > this.x ? 1 : -1;
    else if (this.state === 'food' && this.foodDir) this.dir = this.foodDir;      // beim Fressen: Blick zur Flocke, kein Hin-und-her
    else if ((this.state === 'bite' || this.state === 'nibble') && this.biteDir) this.dir = this.biteDir;      // Runde 20b: Biss / Knabbern – Blick zum Ziel
    else if (this.faceLock && (this.near || Math.hypot(this.vx, this.vy) < 5)) this.dir = this.faceLock;   // angekommen: in der Höhle Kopf nach draußen, im Schwarm wie der Anführer.
    // (Früher galt das schon unter Tempo 40 – Zitteraal und Wels sind nie schneller und schwammen deshalb rückwärts in ihre Höhle.)
    else if (this.sk && this.sk.on) { /* klebt: die Richtung gibt das Festsaugen vor */ }
    else if (this.rig().kind === 'ribbon' && this.state !== 'food' && this.state !== 'den') {       // Runde 20b: Geistermesserfisch – kurze Strecken rückwärts, ohne Wende
      const nd = this.vx > 0 ? 1 : -1, rev = Math.abs(this.vx) > 7 && nd !== this.dir;
      this.revT = rev ? (this.revT || 0) + dt : 0;
      if (rev && (this.revT > 2.2 || Math.abs(this.vx) > 80)) { this.dir = nd; this.turnT = 0.45; this.revT = 0; }
    }
    else if (Math.abs(this.vx) > (this.turnT > 0 ? 40 : 7)) { const nd = this.vx > 0 ? 1 : -1; if (nd !== this.dir) { this.dir = nd; this.turnT = 0.45; } }
    if (this.turnT > 0) this.turnT -= dt;            // nach einer Wende kurz träge – kein Zappeln bei kleinen Geschwindigkeiten
    this.face += (this.dir - this.face) * Math.min(1, dt * 9);
    let tl = AA.clamp(Math.atan2(this.vy, Math.abs(this.vx) + 24) * 0.8, -0.5, 0.5);
    if (this.sk && this.sk.on) tl = 0;
    if (this.poseHold) tl = 0;                       // Runde 20e: in der Fels-Pose gibt die Pose die Lage vor
    if (starving) tl += 0.14;
    if (d.sick) tl += 0.22;
    this.tilt += (tl - this.tilt) * Math.min(1, dt * 5);
    this.spin = 0;
    const k2 = Math.min(4, sp2 / def.speed);
    const denRest = this.state === 'den' && this.resting;
    this.phase += dt * (denRest ? 1.2 : (3.0 + k2 * 5.0) * (d.adult ? 1 : 1.3) * (d.sick ? 0.6 : 1));
    const at = denRest || this.poseHold === 'dead' ? (this.poseHold === 'dead' ? 0.02 : 0.1) : ((this.resting && sp2 < 12) || (this.sk && this.sk.on) ? (def.still ? 0.06 : 0.22) : AA.clamp(0.4 + 0.45 * k2, 0.4, 1.5));      // tot gestellt: Flossen still
    this.amp += (at - this.amp) * Math.min(1, dt * 6);

    // Stimmung & Blasen
    this.moodT -= dt;
    if (this.moodT <= 0) {
      this.moodT = AA.rand(6, 14);
      if (!this.emote && !this.ghost) {
        if (d.sick) this.say('🤒', 2.2);
        else if (d.hunger < 0.25) this.say('🍽️', 1.8);
        else if (this.lonely && Math.random() < 0.7) this.say('😢', 1.8);
        else if (night && Math.random() < 0.6 && this.def.hab !== 'lurk') this.say('💤', 2);
      }
    }
    this.bubT -= dt;
    if (this.bubT <= 0) { this.bubT = AA.rand(5, 16); const m = this.mouth(); V.addBubble(m.x, m.y, AA.rand(1.5, 2.8)); }
    // Runde 14: Anglerfisch & Co. wedeln ab und zu mit ihrer Angel (Teil mit occ in rigs.js): alle 10–24 s für 2–3,5 s, weich ein- und ausgeblendet
    if (this.lureFish === undefined) { const lr = this.rig(); this.lureFish = !!(lr.limbs && lr.limbs.some(function (L) { return L.occ; })); this.lureW = AA.rand(3, 12); }
    if (this.lureFish) {
      this.lureW -= dt;
      if (this.lureW <= 0 && !(this.lureD > 0)) { this.lureL = this.lureD = AA.rand(2.2, 3.5); this.lureW = AA.rand(10, 24); }
      if (this.lureD > 0) { this.lureD -= dt; this.lureE = Math.pow(Math.sin(Math.PI * AA.clamp(1 - this.lureD / this.lureL, 0, 1)), 0.7); } else this.lureE = 0;
    }
  };

  Fish.prototype.draw = function (ctx, t) {
    AA.lureK = this.lureE || 0; AA.lureT = t + this.seed * 7;     // Runde 14: Angel-Wedeln (AA.drawLimbed liest das für Teile mit occ)
    AA.ribbonDir = this.vx * this.dir < -5 ? -1 : 1;              // Runde 20b: schwimmt der Geistermesserfisch rückwärts, läuft die Flossenwelle andersherum
    this.drawFish(ctx, t);
    AA.lureK = 0; AA.ribbonDir = 1;
  };
  Fish.prototype.drawFish = function (ctx, t) {
    const img = this.img(), s = this.size(), ar = this.ar(), w = s, h = s * ar, rig = this.rig(), sk = this.sk, on = !!(sk && sk.on);
    const bob = this.state === 'trick' || on || this.poseHold || (this.def.still && this.resting) || (this.state === 'den' && this.resting) ? 0 : Math.sin(t * 1.4 + this.seed) * 2.2;      // poseHold: Runde 20e (Fels-Pose, tot stellen)      // Runde 14: Muräne in der Höhle wippt nicht
    ctx.save();
    ctx.translate(this.x, this.y + bob);
    if (this.def.alpha) ctx.globalAlpha *= this.def.alpha;      // Runde 20b: Würfel- und Irukandji-Qualle sind fast durchsichtig
    if (!img) { ctx.fillStyle = '#ff9a3c'; ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); ctx.fill(); ctx.restore(); return; }
    if (on && sk.mode === 'glass') {                  // Saugwels an der Frontscheibe: Unterseite, Kopf in Kriechrichtung (das Bild schaut nach rechts)
      ctx.rotate(sk.ang);
      ctx.fillStyle = 'rgba(20,40,60,0.08)'; ctx.beginPath(); ctx.ellipse(2, 4, w * 0.44, h * 0.36, 0, 0, TAU); ctx.fill();
      if (this.chomp > 0) { const c = Math.sin(this.chomp * Math.PI); ctx.scale(1 + c * 0.03, 1 - c * 0.03); }
      AA.drawBody(ctx, img, w, h, this.phase, rig, this.amp);
      ctx.restore(); return;
    }
    if (this.poseRot) ctx.rotate(this.poseRot);      // Runde 20e: Schlankcichlide klebt seitlich am Fels (Drehung in Weltkoordinaten, vor dem Spiegeln)
    if (this.poseFlip !== undefined && this.poseFlip < 0.999) ctx.scale(1, this.poseFlip);      // … kopfüber unter der Decke · Schläfer liegt auf dem Rücken
    if (rig.kind === 'front') {                      // Kalmar: schaut immer nach vorn, neigt sich nur leicht in Schwimmrichtung
      ctx.rotate(AA.clamp(this.vx * 0.0022, -0.3, 0.3) + this.spin * this.dir + Math.sin(t * 1.1 + this.seed) * 0.03);
      if (this.chomp > 0) { const c = Math.sin(this.chomp * Math.PI); ctx.scale(1 + c * 0.07, 1 - c * 0.06); }
      AA.drawBody(ctx, img, w, h, this.phase, rig, this.amp);
      if (this.def.rainbow) drawRainbow(ctx, w, h, t + this.seed);      // Runde 20b: Rippenqualle – Lichtwellen über die Kämme
    } else {
      let fx = this.face;
      if (Math.abs(fx) < 0.12) fx = fx < 0 ? -0.12 : 0.12;
      if (sk && sk.mode === 'wall' && sk.rot) ctx.rotate((sk.side < 0 ? 1 : -1) * sk.rot * Math.PI / 2);      // an der Seitenscheibe: senkrecht, Bauch zum Glas
      ctx.scale(fx, 1 + (1 - Math.abs(fx)) * 0.05);
      if (this.def.inv) ctx.scale(1, -1);             // Rückenschwimmender Kongowels: immer Bauch nach oben
      if (rig.kind === 'up')                         // Seepferdchen: bleibt aufrecht, lehnt sich beim Schwimmen nur etwas nach vorn
        ctx.rotate(this.tilt * 0.3 + this.spin + AA.clamp(Math.abs(this.vx) * 0.004, 0, 0.2) + Math.sin(t * 1.2 + this.seed) * 0.04);
      else if (rig.kind === 'flap' || rig.kind === 'eel' || rig.kind === 'ribbon')
        ctx.rotate(this.tilt * 0.8 + this.spin);
      else ctx.rotate(this.tilt + this.spin + Math.sin(this.phase + 2.4) * 0.035 * this.amp + (this.def.sway ? Math.sin(t * 0.8 + this.seed) * 0.09 : 0));      // sway: Seedrache wiegt sich wie Tang
      if (this.chomp > 0) { const c = Math.sin(this.chomp * Math.PI); ctx.scale(1 + c * 0.09, 1 - c * 0.07); }
      const fl = this.flashT > 0 ? Math.sin(Math.PI * Math.min(1, (1.5 - this.flashT) / 1.5)) : 0;
      if (fl > 0) ctx.scale(1 + fl * 0.05, 1 + fl * (this.def.spines ? 0.12 : 0.3));      // Runde 20b: Knurrhahn – die Flügelflossen gehen auf · Kaninchenfisch – Stacheln hoch
      if (this.yawnT > 0) { const e = Math.sin(Math.PI * (1 - this.yawnT / 1.6)); ctx.scale(1 - e * 0.04, 1 + e * 0.11); }      // Runde 20b: Gelber Angler gähnt
      if (this.snapT > 0) { const e = Math.sin(Math.PI * (1 - this.snapT / 0.35)); ctx.scale(1 + e * 0.07, 1 + e * 0.13); }      // Runde 20f: schnappt zu (Maul auf)
      AA.drawBody(ctx, img, w, h, this.phase, rig, this.amp);
      if (fl > 0 && this.def.flash) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, 0, h * 0.1, 0, 0, w * 0.6);
        g.addColorStop(0, 'rgba(90,190,255,' + (0.45 * fl).toFixed(3) + ')'); g.addColorStop(1, 'rgba(90,190,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.6, h * 0.62, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    if (this.sad()) AA.drawSad(ctx, this.key(), w, h, this.d.sick, t + this.seed, this.d.hunger <= 0.02 || this.d.sick, this.d.v);   // Schmollmund, hängendes Lid, Tränen
    if (this.eyeShut || this.d.sick) AA.drawBlink(ctx, rig, w, h, this.d.v);       // Babys haben keine Augen-Daten: ihr Lach-Auge ist schon zu
    if (this.def.halo) drawHalo(ctx, this.key(), w, h, t + this.seed);              // Runde 18: Engel-Kaiserfisch
    if (this.d.sp === 'clown' && AA.seasonNow().hats) drawHat(ctx, this.key(), w, h);      // Runde 18: Weihnachtsmütze (1. Dezember bis 6. Januar)
    ctx.restore();
  };
  /* Runde 18: Weihnachtsmütze und Heiligenschein sind eigene Bilder (prop/santahat, prop/halo) über dem Kopf – darum passen sie zu jeder Farbvariante.
     HAT: [x, y] = Mitte der Krempen-Unterkante im Fischbild (Anteil von Breite/Höhe), Breite (Anteil der Fischbreite), Neigung in Grad (im Uhrzeigersinn).
     HALO: [x, y] = Mitte des Rings, Breite; der Ring schwebt langsam auf und ab (etwa 3,2 Sekunden) und leuchtet nachts stärker. */
  const HAT = { 'fish/clown_m': [0.835, 0.339, 0.33, 14], 'fish/clown_f': [0.835, 0.339, 0.33, 14], 'fish/clown_b': [0.585, 0.089, 0.37, 8] };
  const HALO = { 'fish/halofish_m': [0.76, -0.07, 0.33], 'fish/halofish_f': [0.76, -0.07, 0.33], 'fish/halofish_b': [0.62, -0.11, 0.45] };
  AA.HAT = HAT; AA.HALO = HALO;
  function drawHat(ctx, key, w, h) {
    const p = HAT[key], im = p && AA.assets.get('prop/santahat');
    if (!im) return;
    const hw = p[2] * w, hh = hw * im.height / im.width;
    ctx.save(); ctx.translate(-w / 2 + p[0] * w, -h / 2 + p[1] * h); ctx.rotate(p[3] * Math.PI / 180);
    ctx.drawImage(im, -0.64 * hw, -0.93 * hh, hw, hh);
    ctx.restore();
  }
  function drawHalo(ctx, key, w, h, t) {
    const p = HALO[key], im = p && AA.assets.get('prop/halo');
    if (!im) return;
    const hw = p[2] * w, hh = hw * im.height / im.width, x = -w / 2 + p[0] * w, y = -h / 2 + p[1] * h + Math.sin(t * TAU / 3.2) * h * 0.035;
    const night = !!(AA.state && AA.state.settings.night), k = (night ? 0.7 : 0.35) * (0.8 + 0.2 * Math.sin(t * 2.1));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, hw * 0.1, x, y, hw * 0.75);
    g.addColorStop(0, 'rgba(255,236,150,' + k.toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, hw * 0.75, hw * 0.42, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.drawImage(im, x - hw / 2, y - hh / 2, hw, hh);
  }
  /* Runde 20b: Rippenqualle – über acht Kämme (Meridiane des Eis) wandern bunte Lichtpunkte von oben nach unten */
  function drawRainbow(ctx, w, h, t) {
    const rx = w * 0.4, ry = h * 0.36, cy = -h * 0.04;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) {
      const f = -0.86 + i * (1.72 / 7);
      for (let j = 0; j < 3; j++) {
        const q = ((t * 0.45 + i * 0.11 + j / 3) % 1), v = q * 2 - 1, x = f * rx * Math.sqrt(Math.max(0, 1 - v * v)), y = cy + v * ry;
        ctx.globalAlpha = 0.55 * Math.sin(q * Math.PI);
        ctx.fillStyle = 'hsl(' + Math.round((t * 90 + i * 45 + j * 120) % 360) + ',100%,68%)';
        ctx.beginPath(); ctx.arc(x, y, w * 0.035, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  /* traurig schaut ein Fisch, wenn er hungrig (unter einem Viertel) oder krank ist – oder das Becken völlig veralgt */
  Fish.prototype.sad = function () { const d = this.d; if (this.def.grim) return false; return d.sick || d.hunger < 0.25 || AA.tank().dirt > 0.75 || this.lonely; };      // grim: Steinfisch und Blobfisch schauen immer gleich   // lonely: Schwarmfisch ohne Schwarm

  /* Dinge, die über allem liegen sollen: Auswahlring, Name, Sprechblasen, Hunger-Anzeige */
  /* Namen, Hunger-Balken, Sprechblasen: bleiben auch im klein gezeichneten Becken lesbar (um den Fisch herum vergrößert) */
  Fish.prototype.drawOverlay = function (ctx, t) {
    const u = AA.view.txtK || 1;                     // Schrift-Maßstab: im Meeresbecken sind nur die Tiere kleiner, nicht die Anzeigen
    if (u === 1) { this.drawOverlay0(ctx, t); return; }
    ctx.save(); ctx.translate(this.x, this.y); ctx.scale(u, u); ctx.translate(-this.x, -this.y);
    this.drawOverlay0(ctx, t);
    ctx.restore();
  };
  Fish.prototype.drawOverlay0 = function (ctx, t) {
    const s = this.size(), ar = this.ar(), V = AA.view, d = this.d;
    if (this.ghost) return;
    const bx = this.def.snake && this.sn && this.sn.box;            // Runde 20c: Seeschlange – Anzeigen am wirklichen Körper (er liegt nicht um die Mitte)
    const cx = bx ? (bx[0] + bx[2]) / 2 : this.x, cy = bx ? (bx[1] + bx[3]) / 2 : this.y, hx = bx ? (bx[2] - bx[0]) / 2 : s / 2, hy = bx ? (bx[3] - bx[1]) / 2 : s * ar / 2;
    let below = cy + hy + 9;
    if (V.tool === 'food' || d.hunger < 0.5 || V.sel === this) {         // Hunger-Anzeige unter dem Fisch
      const bw = 36, bh = 7, x = cx - bw / 2, y = below;
      ctx.save();
      ctx.fillStyle = 'rgba(10,50,80,0.6)'; AA.roundRect(ctx, x - 1.5, y - 1.5, bw + 3, bh + 3, 5); ctx.fill();
      ctx.fillStyle = d.hunger > 0.5 ? '#5fd66d' : (d.hunger > 0.25 ? '#ffb02e' : '#ff4d4d');
      if (d.hunger > 0.02) { AA.roundRect(ctx, x, y, Math.max(4, bw * d.hunger), bh, 3.5); ctx.fill(); }
      ctx.restore();
      below += 15;
    }
    if (V.sel === this) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 3; ctx.setLineDash([9, 7]); ctx.lineDashOffset = -t * 22;
      ctx.beginPath(); ctx.ellipse(cx, cy, hx * 1.24 + 6, hy * 1.24 + 6, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '800 15px ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const label = (d.v ? '✨ ' : '') + d.name, tw = ctx.measureText(label).width + 18, ly = Math.max(below + 10, cy + hy * 1.24 + 22);
      ctx.fillStyle = 'rgba(10,50,80,0.78)';
      AA.roundRect(ctx, cx - tw / 2, ly - 12, tw, 24, 12); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(label, cx, ly + 1);
      ctx.restore();
    }
    if (this.emote) {
      const hd = bx && this.sn.tr[0], ex = hd ? hd.x : this.x;          // Schlange: die Sprechblase gehört zum Kopf
      const a = Math.min(1, this.emoteT * 4), by = (hd ? hd.y - this.sn.band * 1.6 : this.y - s * ar * 0.5) - 26 - Math.sin(t * 6) * 2;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      ctx.beginPath(); ctx.arc(ex, by, 16, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(ex - 5, by + 13); ctx.lineTo(ex, by + 23); ctx.lineTo(ex + 6, by + 13); ctx.fill();
      ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.emote, ex, by + 1);
      ctx.restore();
    }
  };

  AA.Fish = Fish;
})(window.AA);
