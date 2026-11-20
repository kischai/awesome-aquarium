'use strict';
/* Awesome Aquarium – Runde 20e (20.11.2026): Afrika-Legenden – Regeln und Verhalten im Becken.
   Daten in js/data.js (Arten mit carry/carrySex, cavebrood, needCave, group, family, rockface, slip, playdead, cuckoo, guest, sterile) ·
   Regeln in Worten: docs/MECHANIK.md § 11p.
   - Maulbrüter: Die Mama (carrySex 'f') trägt das Ei im Maul, bis es schlüpft (gemalt wie beim Pyjama-Kardinalbarsch, js/tankview.js) –
     auch das Hybrid-Ei einer Kreuzung, wenn die Mama eine Maulbrüterin ist.
   - Kuckuckswels: Laicht in seinem Becken eine Maulbrüterin, schmuggelt er mit Chance AA.AFRICA.cuckoo ein eigenes Ei dazu.
     Es sieht aus wie die anderen, schlüpft aber etwas früher – Überraschungs-Baby. Vorher schleicht er sich an die Balz heran.
   - Prachtbarsch: laicht nur, wenn eine Höhle im Becken steht (Deko mit cave) · Höhlenbrüter legen ihr Ei an eine Höhle bzw. einen Fels.
   - Blutpapagei: unfruchtbar (gibt es nur im Shop).
   - Gruppen (Tropheus 6, Demasoni 5): darunter traurig und langsameres Wachstum, ab der Gruppe zufrieden und schneller (Werte wie Schwärme).
   - Großfamilie (Prinzessin von Burundi): erwachsene Tiere über das Paar hinaus helfen (höchstens 3) – je Helfer schlüpfen die Eier 15 %
     und wachsen die Babys 10 % schneller; im Becken schwimmen die Großen zu Eiern und Babys und passen auf.
   - Schlankcichlide klebt seitlich (Bauch zum Stein) an Felsen oder kopfüber in einer Höhle · Calvus flitzt hinter einem Fels durch ·
     Schläfer stellt sich tot: legt sich auf den Rücken, kleine Fische kommen gucken, dann schnappt er zu – nur ein Schreck. */
(function (AA) {
  const S = function () { return AA.state; };
  AA.AFRICA = { cuckoo: 0.35, cuckooHatch: 0.8, help: { hatch: 0.15, grow: 0.1, max: 3 } };

  /* ================= Regeln ================= */
  AA.hasCave = function (t) { return t.deco.some(function (o) { const d = AA.DECO_BY[o.type]; return !!(d && d.cave); }); };

  /* Paarung: Blutpapagei unfruchtbar, Prachtbarsch braucht eine Höhle */
  const mate0 = AA.mateStatus;
  AA.mateStatus = function (sp, t) {
    const st = mate0(sp, t), def = AA.FISH_BY[sp];
    t = t || AA.tank();
    if (def && def.sterile) { st.ok = false; st.why = 'barren'; }
    else if (def && def.needCave && !AA.hasCave(t) && st.why !== 'nomale' && st.why !== 'nofemale') { st.ok = false; st.why = 'cave'; }
    return st;
  };

  /* Gruppen-Fische: so viele Artgenossen im Becken (Babys zählen mit, wie beim Schwarm) */
  AA.groupState = function (f, t) {
    const def = AA.FISH_BY[f.sp];
    if (!def || !def.group) return null;
    t = t || AA.tankOf(f) || AA.tank();
    let n = 0; t.fish.forEach(function (g) { if (g.sp === f.sp) n++; });
    return { n: n, need: def.group, ok: n >= def.group, lonely: n < def.group };
  };
  /* Großfamilie: Helfer = erwachsene, gesunde Tiere über das Elternpaar hinaus */
  AA.famHelpers = function (t, sp) {
    let n = 0; t.fish.forEach(function (g) { if (g.sp === sp && g.adult && !g.sick) n++; });
    return Math.max(0, Math.min(AA.AFRICA.help.max, n - 2));
  };
  const prep0 = AA.growPrep, mult0 = AA.growMult;
  AA.growPrep = function (t) {
    const gp = prep0(t), g = {}, fam = {};
    t.fish.forEach(function (f) {
      const d = AA.FISH_BY[f.sp]; if (!d) return;
      if (d.group) g[f.sp] = (g[f.sp] || 0) + 1;
      if (d.family && !(f.sp in fam)) fam[f.sp] = AA.famHelpers(t, f.sp);
    });
    gp.group = g; gp.fam = fam;
    return gp;
  };
  AA.growMult = function (gp, f) {
    let k = mult0(gp, f);
    const d = AA.FISH_BY[f.sp];
    if (d && d.group && gp.group) k *= (gp.group[f.sp] || 0) >= d.group ? AA.SCHOOL.grow : AA.SCHOOL.lonelyGrow;
    if (d && d.family && gp.fam && !f.adult) k *= 1 + AA.AFRICA.help.grow * (gp.fam[f.sp] || 0);
    return k;
  };
  AA.eggK = function (t, e) {                         // js/state.js (AA.advance): Brut-Tempo je Ei – Helfer der Großfamilie
    const d = AA.FISH_BY[e.sp];
    return d && d.family ? 1 + AA.AFRICA.help.hatch * AA.famHelpers(t, e.sp) : 1;
  };

  /* Eier: Höhlenbrüter legen an eine Höhle (sonst an einen Fels) */
  const spot0 = AA.eggSpot;
  AA.eggSpot = function (t, sp, egg) {
    spot0(t, sp, egg);
    const def = AA.FISH_BY[sp];
    if (!def || egg.carry || !def.cavebrood) return;
    const deco = t.deco.filter(function (o) { const d = AA.DECO_BY[o.type]; return d && !d.crawl && !o.on; });
    const caves = deco.filter(function (o) { const d = AA.DECO_BY[o.type]; return d.cave || d.hide; });
    const L = caves.length ? caves : deco.filter(function (o) { return AA.DECO_BY[o.type].cat === 'rock'; });
    if (!L.length) return;
    const o = AA.pick(L), d = AA.DECO_BY[o.type], w = d.w * (AA.decoScale ? AA.decoScale(o) : 1) * AA.depthScale(o.z);
    egg.x = AA.clamp(o.x + (d.hide ? (o.flip ? -1 : 1) * d.hide[0] * w : 0) + AA.rand(-0.15, 0.15) * w, 80, AA.W - 80);
    egg.z = AA.clamp(o.z + AA.rand(0.02, 0.05), 0.05, 1);
  };
  /* Nach dem Legen (js/state.js finishMate, auch beim Nachrechnen): wer trägt das Ei? Und schmuggelt der Kuckuckswels? */
  AA.on('eggMade', function (egg, a, b, t, m) {
    if (!egg || !a || !b || !t || !m) return;
    const hd = AA.FISH_BY[m.cross ? b.sp : m.sp];
    if (hd && hd.carry) {
      if (!egg.carry) { egg.carry = hd.carry; egg.host = b.sp; }       // gekreuzt: die Mama trägt das Hybrid-Ei
      egg.cid = (hd.carrySex === 'f' ? b : a).id;
    }
    if (m.cross || !hd || hd.carry !== 'mouth' || hd.carrySex !== 'f' || AA.count(t) >= AA.cap(t)) return;
    if (!t.fish.some(function (g) { return g.sp === 'cuckoocat' && g.adult && !g.sick; }) || Math.random() >= AA.AFRICA.cuckoo) return;
    const cd = AA.FISH_BY.cuckoocat, h = Math.max(20, Math.round(Math.min(cd.hatch, egg.total || cd.hatch) * AA.AFRICA.cuckooHatch));
    t.eggs.push({ id: AA.uid(), sp: 'cuckoocat', x: egg.x, z: egg.z, hatch: h, total: h, bred: 1, cuckoo: m.sp, carry: egg.carry, host: m.sp, cid: egg.cid, pa: egg.pa });
    const s = S(); if (s && s.stats) s.stats.eggs++;
  });

  /* ================= Verhalten im Becken ================= */
  const Fish = AA.Fish, V = AA.view;
  if (!Fish || !V) return;
  ['rock', 'slip', 'pdgo', 'pdead', 'psnap', 'nanny', 'sneak'].forEach(function (k) { AA.FISH_BEH[k] = 1; });
  const POSE = { rock: 1, pdead: 1, psnap: 1 };
  function rocks(tank, minH) {                        // Felsen, an denen man kleben bzw. hinter denen man durchflitzen kann
    return tank.deco.filter(function (o) {
      const d = AA.DECO_BY[o.type];
      if (!d || d.cat !== 'rock' || d.wood || d.crawl || d.trophy || d.flat || (d.w || 0) < 80 || o.r) return false;
      return !minH || V.decoBox(o).h >= minH;
    });
  }
  function endPose(f) { f.poseRotT = 0; f.poseFlipT = 1; f.poseHold = null; f.eyeShutHold = false; }

  /* Schlankcichlide: seitlich an der Felswand (Bauch zum Stein, kriecht langsam auf und ab) oder kopfüber unter der Decke einer Höhle */
  function rockFace(f, dt, tank, s, h) {
    if (f.state !== 'rock') {
      f.rkT = (f.rkT === undefined ? AA.rand(3, 10) : f.rkT) - dt;
      if (f.rkT > 0 || f.busy() || f.state !== 'wander') return null;
      f.rkT = AA.rand(8, 20);
      const caves = V.hideouts(), rs = rocks(tank, s * 1.15);
      if (!rs.length && !caves.length) return null;
      f.rk = { o: rs.length ? AA.pick(rs) : null, side: Math.random() < 0.5 ? -1 : 1, v: AA.rand(0.3, 0.65), up: Math.random() < 0.5, t: AA.rand(10, 20), step: 0 };
      if (caves.length && (!rs.length || Math.random() < 0.33)) { f.rk.cave = AA.pick(caves); f.rk.o = null; }
      f.state = 'rock';
    }
    const R = f.rk;
    R.t -= dt;
    if (!R || R.t <= 0 || (R.o && tank.deco.indexOf(R.o) < 0)) { f.state = 'wander'; f.wait = 0.2; endPose(f); return null; }
    if (R.cave) {
      const q = R.cave, tx = q.x + Math.sin(V.time * 0.45 + f.seed) * 12, ty = q.y - h * 0.75;
      const near = Math.hypot(tx - f.x, ty - f.y) < 26 + s * 0.1;
      f.poseRotT = 0; f.poseFlipT = near ? -1 : 1; f.poseHold = near ? 'rock' : null;
      return { tx: tx, ty: ty, b: near ? 0.5 : 1, r: 4, z: Math.min(1, q.z + 0.015) };
    }
    R.step -= dt;
    if (R.step <= 0) { R.step = AA.rand(1.1, 2.3); if (Math.random() < 0.4) R.up = !R.up; R.v += (R.up ? 1 : -1) * AA.rand(0.05, 0.12); }
    const b = V.decoBox(R.o), vmin = Math.min(0.6, (s * 0.5 + 8) / b.h), vmax = 0.82;
    if (R.v < vmin) { R.v = vmin; R.up = true; } else if (R.v > vmax) { R.v = vmax; R.up = false; }
    const ex = V.decoEdge(R.o, R.v, R.side);
    if (ex === null) { R.v = (vmin + vmax) / 2; return { tx: f.x, ty: f.y, b: 0.6, r: 6 }; }
    const tx = ex + R.side * h * 0.4, ty = b.by - R.v * b.h, near = Math.hypot(tx - f.x, ty - f.y) < Math.max(36, s * 0.5);
    f.poseRotT = near ? (R.side < 0 ? -Math.PI / 2 : Math.PI / 2) : 0; f.poseFlipT = 1; f.poseHold = near ? 'rock' : null;
    return { tx: tx, ty: ty, b: near ? 0.32 : 1, r: 3, z: Math.min(1, R.o.z + 0.03), face: R.side < 0 ? (R.up ? 1 : -1) : (R.up ? -1 : 1) };
  }

  /* Calvus: an die Felskante, hinter dem Fels durch die Spalte, auf der anderen Seite wieder heraus */
  function slipThrough(f, dt, tank, s, h) {
    if (f.state !== 'slip') {
      f.slT = (f.slT === undefined ? AA.rand(5, 14) : f.slT) - dt;
      if (f.slT > 0 || f.busy() || f.state !== 'wander') return null;
      f.slT = AA.rand(14, 30);
      const rs = rocks(tank, h * 1.2).filter(function (o) { return V.decoBox(o).w > s * 1.1; });
      if (!rs.length) return null;
      const o = AA.pick(rs), b = V.decoBox(o);
      f.sl = { o: o, from: f.x < b.cx ? -1 : 1, k: 0, v: AA.rand(0.22, 0.5), t: 10 + Math.abs(f.x - b.cx) / 25 };      // Anweg: langsame Calvus brauchen von ganz außen ~20 s
      f.state = 'slip';
    }
    const L = f.sl;
    L.t -= dt;
    if (tank.deco.indexOf(L.o) < 0 || L.t <= 0) { f.state = 'wander'; f.wait = 0.2; return null; }
    const b = V.decoBox(L.o), y = Math.max(b.y + h * 0.5, b.by - L.v * b.h);
    const pts = [[L.from < 0 ? b.x - s * 0.35 : b.x + b.w + s * 0.35, L.o.z + 0.03], [b.cx, Math.max(0.01, L.o.z - 0.06)], [L.from < 0 ? b.x + b.w + s * 0.55 : b.x - s * 0.55, L.o.z + 0.03]];
    const tyOf = function (q) { return Math.min(y, AA.floorY(q[1], q[0]) - h * 0.5 - 2); };      // hinter dem Fels liegt der Grund höher – sonst wäre das Ziel unerreichbar
    const p = pts[L.k], d = Math.hypot(p[0] - f.x, tyOf(p) - f.y);
    if (d < (L.dm || 1e9) - 3) { L.dm = d; L.st = 0; } else L.st = (L.st || 0) + dt;      // kommt er noch näher? (Fels-Ausweichen kann ihn knapp davor halten)
    if (d < 18 + s * 0.2 || (L.st > 1.2 && d < 40 + s * 0.4)) {
      L.k++; L.t = Math.max(L.t, 9); L.dm = 1e9; L.st = 0;                 // jede Etappe bekommt ihre eigene Zeit (weiter Anweg frisst sonst die Spalte auf)
      if (L.k > 2) { f.state = 'wander'; f.wait = 0.3; return null; }
      f.z = f.zT = pts[L.k][1];                       // an der Kante: hinter bzw. vor den Fels wechseln (dort sieht man den Sprung nicht)
      if (L.k === 2) f.say('💨', 1.1);
    }
    const q = pts[L.k];
    return { tx: q[0], ty: tyOf(q), b: L.k === 1 ? 1.9 : 1.15, r: 4, z: q[1] };
  }

  /* Schläfer: hinlegen (auf den Rücken, Augen zu, Flossen still) – kleine Fische kommen gucken – zack, umdrehen und zuschnappen */
  function playDead(f, dt, tank, s, h) {
    if (f.state !== 'pdgo' && f.state !== 'pdead' && f.state !== 'psnap') {
      f.pdT = (f.pdT === undefined ? AA.rand(20, 60) : f.pdT) - dt;
      if (f.pdT > 0 || f.busy() || f.state !== 'wander' || !f.d.adult) return null;
      f.pdT = AA.rand(50, 120);
      const prey = V.fish.filter(function (g) { return g !== f && !g.ghost && g.size() < s * 0.9 && g.def.hab !== 'lurk' && !g.def.still; });
      if (!prey.length) return null;
      const q = f.frontSpot(V, f.x, 320);              // vorn und frei (nicht hinter Deko) – das soll man sehen
      f.pd = { x: q.x, z: q.z, t: AA.rand(7, 11), lure: 0.8, go: 14 };
      f.state = 'pdgo';
    }
    const P = f.pd, y = AA.floorY(P.z, P.x) - h * 0.45;
    if (f.state === 'pdgo') {
      P.go -= dt;
      if (Math.hypot(P.x - f.x, y - f.y) < 16 || P.go <= 0) { f.state = 'pdead'; f.say('😵', 1.8); }
      return { tx: P.x, ty: y, b: 0.75, r: 5, z: P.z };
    }
    if (f.state === 'pdead') {
      P.t -= dt; P.lure -= dt;
      f.poseFlipT = -1; f.poseRotT = f.dir * 0.12; f.poseHold = 'dead'; f.eyeShutHold = true; f.poseK = 2.2;
      if (P.lure <= 0) {                              // kleine Fische kommen gucken
        P.lure = AA.rand(1.1, 1.8);
        const cand = V.fish.filter(function (g) {
          return g !== f && !g.ghost && !g.busy() && g.size() < s * 0.9 && (g.state === 'wander' || g.state === 'school') && g.def.hab !== 'lurk' && !g.def.still && !g.def.cleaner && Math.hypot(g.x - f.x, g.y - f.y) < 720;
        });
        for (let i = 0; i < 2 && cand.length; i++) {
          const g = cand.splice(Math.floor(Math.random() * cand.length), 1)[0], side = g.x < f.x ? -1 : 1;
          g.state = 'curious'; g.timer = AA.rand(2.6, 4.2); g.peek = f;
          g.tx = f.x + side * (s * 0.5 + g.size() * 0.4) + AA.rand(-12, 12); g.ty = f.y - h * AA.rand(0.3, 1.1); g.zT = f.z;
          if (Math.random() < 0.6) g.say(Math.random() < 0.5 ? '👀' : '❓', 1.3);
        }
      }
      if (P.t <= 0) { f.state = 'psnap'; P.t = 1.2; P.hit = null; }
      return { tx: P.x, ty: y, b: 0.3, r: 4, z: P.z };
    }
    P.t -= dt;                                        // psnap
    endPose(f); f.poseK = 14;
    if (!P.hit) {
      let best = null, bd = s * 2.4;
      V.fish.forEach(function (g) { if (g.peek === f && !g.ghost) { const q = Math.hypot(g.x - f.x, g.y - f.y); if (q < bd) { bd = q; best = g; } } });
      P.hit = best || 'none'; f.snapT = 0.35; f.chomp = 1;
      if (best) {
        f.say('😜', 1.6); best.say('😱', 1.4);
        V.fish.forEach(function (g) { if (g.peek === f) { g.peek = null; g.shoo(f.x); } });
        if (AA.audio && !AA.quiet) AA.audio.play('snap');
      } else f.say('🥱', 1.4);
    }
    if (P.t <= 0) { f.state = 'wander'; f.wait = 0.3; f.poseK = 0; return null; }
    const g = P.hit !== 'none' ? P.hit : null;
    return g && !g.ghost ? { tx: g.x, ty: g.y, b: 3.2, r: 6, z: f.z } : { tx: f.x, ty: f.y - 30, b: 1.4, r: 6 };
  }

  /* Prinzessin von Burundi: die Großen schwimmen zu den Eiern und Babys ihrer Art und passen auf */
  function nanny(f, dt, tank, s, h) {
    if (!f.d.adult) return null;
    if (f.state !== 'nanny') {
      f.nnT = (f.nnT === undefined ? AA.rand(4, 10) : f.nnT) - dt;
      if (f.nnT > 0 || f.busy() || f.state !== 'wander') return null;
      f.nnT = AA.rand(9, 20);
      if (AA.famHelpers(tank, f.d.sp) < 1) return null;
      const eggs = tank.eggs.filter(function (e) { return e.sp === f.d.sp; }), kids = V.fish.filter(function (g) { return g.d.sp === f.d.sp && !g.d.adult && !g.ghost; });
      if (!eggs.length && !kids.length) return null;
      const egg = eggs.length && (!kids.length || Math.random() < 0.6) ? AA.pick(eggs) : null;
      f.nn = { egg: egg, kid: egg ? null : AA.pick(kids), t: AA.rand(6, 11), off: AA.rand(-1, 1) };
      f.state = 'nanny';
      if (Math.random() < 0.5) f.say('🛡️', 1.3);
    }
    const N = f.nn; N.t -= dt;
    let px, py, pz;
    if (N.egg && tank.eggs.indexOf(N.egg) >= 0) { const p = V.eggPos(N.egg); px = p.x; py = p.y - h * 0.9 - 12; pz = N.egg.z; }
    else if (N.kid && V.fish.indexOf(N.kid) >= 0 && !N.kid.ghost) { px = N.kid.x; py = N.kid.y - h * 0.9; pz = N.kid.z; }
    else N.t = 0;
    if (N.t <= 0) { f.state = 'wander'; f.wait = 0.3; return null; }
    return { tx: px + N.off * s * 0.6 + Math.sin(V.time * 0.8 + f.seed) * 18, ty: py, b: 0.9, r: 8, z: pz };
  }

  /* Kuckuckswels: balzt eine Maulbrüterin, schleicht er sich heran (danach liegt vielleicht ein Ei mehr in ihrem Maul) */
  function sneak(f, dt, tank) {
    if (!f.d.adult) return null;
    const ms = tank.matings || [];
    let mom = null;
    for (let i = 0; i < ms.length && !mom; i++) {
      const hd = AA.FISH_BY[ms[i].sp];
      if (!ms[i].cross && hd && hd.carry === 'mouth' && hd.carrySex === 'f') { const q = V.byId[ms[i].b]; if (q && !q.ghost) mom = q; }
    }
    if (!mom) { if (f.state === 'sneak') { f.state = 'wander'; f.wait = 0.3; } return null; }
    if (f.state !== 'sneak') { if (f.busy() || (f.state !== 'wander' && f.state !== 'curious')) return null; f.state = 'sneak'; f.say('🤫', 1.8); }
    const ms2 = mom.size();
    return { tx: mom.x - mom.dir * ms2 * 0.35, ty: mom.y + ms2 * mom.ar() * 0.35, b: 1.3, r: 10, z: mom.z };
  }

  const behave0 = Fish.prototype.behave;
  Fish.prototype.behave = function (dt, V2, tank, night) {
    const o = behave0.call(this, dt, V2, tank, night);
    if (o || this.state === 'beg') return o;
    const def = this.def;
    if (!(def.cuckoo || def.playdead || def.rockface || def.slip || def.family) || this.d.sick || this.ghost) return null;
    const s = this.size(), h = s * this.ar();
    let r = null;
    if (def.cuckoo) r = sneak(this, dt, tank);
    if (!r && def.playdead && !night) r = playDead(this, dt, tank, s, h);
    if (!r && def.rockface && !night) r = rockFace(this, dt, tank, s, h);
    if (!r && def.slip && !night) r = slipThrough(this, dt, tank, s, h);
    if (!r && def.family && !night) r = nanny(this, dt, tank, s, h);
    return r;
  };
  const update0 = Fish.prototype.update;
  Fish.prototype.update = function (dt, V2, tank) {
    update0.call(this, dt, V2, tank);
    if (!POSE[this.state] && (this.poseHold || this.poseRotT || (this.poseFlipT !== undefined && this.poseFlipT !== 1))) endPose(this);
    if (this.poseRotT === undefined && !this.poseRot && this.poseFlipT === undefined) return;
    const k = Math.min(1, dt * (this.poseK || 4.5));
    this.poseRot = (this.poseRot || 0) + ((this.poseRotT || 0) - (this.poseRot || 0)) * k;
    if (Math.abs(this.poseRot) < 0.002 && !this.poseRotT) this.poseRot = 0;
    const pf = this.poseFlip === undefined ? 1 : this.poseFlip, tf = this.poseFlipT === undefined ? 1 : this.poseFlipT;
    this.poseFlip = pf + (tf - pf) * k;
    if (this.poseFlip > 0.998 && tf === 1) this.poseFlip = 1;
    if (this.eyeShutHold) this.eyeShut = true;
  };
})(window.AA);
