'use strict';
/* Awesome Aquarium – Bilder laden.
   Die Bilder liegen als Data-URLs in vielen kleinen Päckchen unter js/pack/ (erzeugt von tools/bundle.py; dadurch läuft alles per Doppelklick,
   inkl. Foto-Modus). Seit Runde 7 wird beim Start nur geladen, was in deinen Becken wirklich vorkommt (plus Grundausstattung) – der Rest kommt
   danach still im Hintergrund, Päckchen für Päckchen. Braucht das Spiel etwas früher (z. B. ein eben gekaufter Fisch), wird dieses Päckchen vorgezogen.
     js/pack/index.js   Inhaltsverzeichnis: window.AA_PACK = { "<päckchen>": ["<bild>", …] }
     f-<art>            ♂, ♀, Baby und die „traurig“-Pflaster einer Fischart
     d-<deko>           ein Deko-Stück (mit Scheiben-Ansicht und großer Fassung), w-<id> Hintergrundbild, k-<id> Boden, core = Münze, Futterdose, Minispiel-Dinge
   Schalter für Tests: window.AA_EAGER = 1 lädt wie früher alles vor dem Start. Ohne Päckchen (kein js/pack) kommen die Bilder direkt aus assets/. */
(function (AA) {
  const As = AA.assets = { img: {}, tint: {}, done: {}, wait: {}, complete: false, stats: { first: 0, firstMs: 0, allMs: 0 } };
  const PACK = window.AA_PACK || null, GROUP = {};
  if (PACK) for (const g in PACK) PACK[g].forEach(function (k) { GROUP[k] = g; });
  As.PROPS = ['hook', 'bomb', 'umbrella', 'monsterplant', 'catpaw', 'poison', 'coin', 'foodcan'];
  /* Im Netz (http/https) werden nur die Päckchen ausgeliefert, der Ordner assets/ nicht: Ein Bild, dessen Päckchen noch unterwegs ist, bekommt
     dort einen durchsichtigen Platzhalter mit seinem Namen hinten dran; As.refreshImgs setzt das echte Bild ein, sobald das Päckchen da ist.
     Per Doppelklick (file://) bleibt es beim direkten Griff nach assets/<bild>.png. */
  const HOSTED = location.protocol !== 'file:', BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', PV = window.AA_PACK_V || {};
  As.hosted = HOSTED;
  As.src = function (key) {
    const u = window.AA_BUNDLE && window.AA_BUNDLE[key];
    if (u) return u;
    if (!HOSTED || !PACK || !GROUP[key]) return 'assets/' + key + '.png';
    As.want(key);
    return BLANK + '#' + key;
  };
  As.refreshImgs = function () {
    if (!HOSTED || !window.AA_BUNDLE) return;
    document.querySelectorAll('img[src^="' + BLANK + '#"]').forEach(function (im) { const u = window.AA_BUNDLE[im.getAttribute('src').slice(BLANK.length + 1)]; if (u) im.src = u; });
  };
  As.groupOf = function (key) { return GROUP[key] || null; };
  /* alle Bilder, die das Spiel laut js/data.js braucht (plus hd/ und sad/ aus den Päckchen) – auch für die Tests: fehlt eins davon? */
  As.keys = function () {
    const k = [];
    AA.FISH.forEach(function (f) {
      k.push('fish/' + f.id + '_m', 'fish/' + f.id + '_f', 'fish/' + f.id + '_b');   // ♂, ♀ (mit Wimpern), Baby
      if (f.suck) k.push('fish/' + f.id + '_n', 'fish/' + f.id + '_o', 'fish/' + f.id + '_u');   // Saugwels: ♂/♀ ohne Mund (klebt am Boden / an der Seitenscheibe), Unterseite (an der Frontscheibe)
    });
    AA.DECO.forEach(function (d) { k.push('deco/' + d.id); if (d.glass) k.push('deco/' + d.id + '_glass'); });   // _glass = Bauchansicht an der Scheibe
    AA.WALLS.forEach(function (w) { if (w.img) k.push(w.img); });
    k.push('deco/chest_closed');
    AA.FLOORS.forEach(function (f) { k.push('floor/' + f.id); });
    As.PROPS.forEach(function (p) { k.push('prop/' + p); });
    for (const key in GROUP) if (key.indexOf('hd/') === 0 || key.indexOf('sad/') === 0) k.push(key);
    return k;
  };
  function decode(key) {
    return new Promise(function (res) {
      const im = new Image();
      im.onload = function () { As.img[key] = im; res(); };
      im.onerror = function () { As.img[key] = null; res(); };
      im.src = As.src(key);
    });
  }
  /* ein Päckchen laden (Skript einhängen, dann seine Bilder dekodieren); mehrfaches Anfordern teilt sich dasselbe Versprechen */
  As.loadGroup = function (g) {
    if (As.wait[g]) return As.wait[g];
    return (As.wait[g] = new Promise(function (res) {
      const fin = function () { Promise.all(PACK[g].map(decode)).then(function () { As.done[g] = true; for (const k in As.tint) if (As.tint[k] === null) delete As.tint[k]; As.refreshImgs(); res(); if (AA.emit) AA.emit('assets', g); }); };
      const sc = document.createElement('script');
      sc.src = 'js/pack/' + g + '.js' + (HOSTED && PV[g] ? '?v=' + PV[g] : '');      // im Netz mit Kurz-Prüfsumme: so darf der Browser Päckchen ewig aufheben und lädt nach einem Update trotzdem frisch
      sc.onload = fin; sc.onerror = fin;
      document.head.appendChild(sc);
    }));
  };
  As.loadGroups = function (list, onProgress) {
    let done = 0; const n = list.length || 1;
    return Promise.all(list.map(function (g) { return As.loadGroup(g).then(function () { done++; if (onProgress) onProgress(done / n); }); }));
  };
  /* Bild wird gleich gebraucht: sein Päckchen vorziehen (kehrt sofort zurück) */
  As.want = function (key) { const g = GROUP[key]; if (g && !As.wait[g]) As.loadGroup(g); return !!(g && As.done[g]); };
  /* was der aktuelle Spielstand zum Start braucht */
  As.needed = function () {
    const need = { core: 1 }, s = AA.state, add = function (key) { const g = GROUP[key]; if (g) need[g] = 1; };
    ['floor/sand', 'deco/chest', 'deco/seaweed', 'deco/rock_grey', 'fish/clown_m', 'fish/auriga_m', 'fish/guppy_m'].forEach(add);      // Grundausstattung + Schatzsuche
    if (s) s.tanks.forEach(function (t) {
      t.fish.forEach(function (f) { add('fish/' + f.sp + '_m'); });
      t.eggs.forEach(function (e) { add('fish/' + e.sp + '_m'); });
      t.deco.forEach(function (o) { add('deco/' + o.type); });
      add('floor/' + t.floor); const w = AA.WALL_BY[t.wall]; if (w && w.img) add(w.img);
    });
    return Object.keys(need).filter(function (g) { return PACK[g]; });
  };
  As.load = function (onProgress) {
    const t0 = performance.now();
    if (!PACK) {                                       // ohne Päckchen: alles direkt aus assets/
      const k = As.keys();
      let d = 0; return Promise.all(k.map(function (key) { return decode(key).then(function () { d++; if (onProgress) onProgress(d / k.length); }); })).then(function () { As.complete = true; });
    }
    const all = Object.keys(PACK), first = window.AA_EAGER ? all : As.needed();
    As.stats.first = first.length; As.stats.groups = all.length;
    return As.loadGroups(first, onProgress).then(function () {
      As.stats.firstMs = Math.round(performance.now() - t0);
      const rest = all.filter(function (g) { return !As.wait[g]; });
      const nav = navigator.connection || {};
      if (HOSTED && nav.saveData && !window.AA_EAGER) return;      // Datensparmodus: nichts auf Vorrat laden – jedes Päckchen kommt erst, wenn es gebraucht wird
      let i = 0;
      const next = function () {                       // der Rest: nacheinander, mit kleinen Pausen, damit das Spiel flüssig bleibt
        while (i < rest.length && As.wait[rest[i]]) i++;
        if (i >= rest.length) { Promise.all(all.map(As.loadGroup)).then(function () { As.complete = true; As.stats.allMs = Math.round(performance.now() - t0); if (AA.emit) AA.emit('assetsDone'); }); return; }
        const batch = rest.slice(i, i + 3); i += 3;
        As.loadGroups(batch).then(function () { setTimeout(next, 30); });
      };
      setTimeout(next, window.AA_EAGER ? 0 : (HOSTED ? 5000 : 400));      // im Netz erst das Spiel in Ruhe starten lassen
    });
  };
  As.get = function (key) { const im = As.img[key]; if (im) return im; if (im === undefined && PACK && !As.complete) As.want(key); return null; };
  /* kränklich-grün eingefärbte Fassung eines Sprites (für kranke Fische), einmal berechnet und gemerkt */
  As.tinted = function (key) {
    if (As.tint[key]) return As.tint[key];
    const im = As.get(key);
    if (!im) return null;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(120,168,72,0.45)'; g.fillRect(0, 0, c.width, c.height);
    return (As.tint[key] = c);
  };
})(window.AA);
