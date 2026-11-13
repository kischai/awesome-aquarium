'use strict';
/* Awesome Aquarium – Runde 9: neue Tiere und ihre Eigenheiten (Regeln).
     • Tiefsee-Becken: ein stockdunkles Meerwasser-Becken nur für Tiefsee-Tiere (AA.DEEP; deep an der Art) – dort leuchten sie selbst
     • Großes Becken: Bodenhaie brauchen 125 Gallonen (big an der Art) · Meeresriesen wie bisher nur ins Meeresbecken (ocean)
     • Algenbremsen unter den Fischen: Graskarpfen −50 %, Putzerfische −10 % (algae an der Art, je Art einmal)
     • Putzerfische: putzen andere Fische und machen Kranke gesund (cleaner) – auch während du weg bist
     • Prestige-Deko: funkelt und bringt mehr Ruf je erledigtem Auftrag (prestige am Stück, AA.PRESTIGE)
   Wo eine Art leben darf, steht in AA.whyNot / AA.livesIn (js/data.js). Verhalten (Saugwels, Kongowels, Steinfisch, Putzerfisch): js/fish.js;
   Darstellung (Dunkelheit, Leuchten, Scheibe): js/tankview.js; Oberfläche: js/wildui.js; Regeln in Worten: docs/MECHANIK.md § 6f. */
(function (AA) {
  function S() { return AA.state; }

  /* ---------- Tiefsee-Becken ---------- */
  AA.hasDeep = function () { return S().tanks.some(function (t) { return t.deep; }); };
  AA.deepStatus = function () { const s = S(); return AA.hasDeep() ? 'owned' : (s.level < AA.DEEP.lvl ? 'level' : (s.coins < AA.DEEP.price ? 'coins' : 'ok')); };
  AA.buyDeep = function () {
    const s = S(), st = AA.deepStatus(), D = AA.DEEP;
    if (st !== 'ok') return st;
    AA.addCoins(-D.price);
    const t = AA.newTank(s.tanks.length, 'salt');
    t.deep = true; t.size = AA.SIZES.length - 1; t.name = D.name;
    if (AA.WALL_BY[D.wall]) { if (s.walls.indexOf(D.wall) < 0) s.walls.push(D.wall); t.wall = D.wall; }      // die Tiefsee-Kulisse gehört zum Becken dazu
    if (AA.FLOOR_BY[D.floor] && s.level >= AA.FLOOR_BY[D.floor].lvl) t.floor = D.floor; else t.floor = 'black';
    s.tanks.push(t); s.active = s.tanks.length - 1;
    AA.emit('tankChanged');
    return true;
  };

  /* ---------- Algenbremsen unter den Fischen ----------
     Jede Art mit `algae` bremst das Veralgen um ihren Anteil – einmal je Art, egal wie viele davon im Becken schwimmen. Verschiedene Arten
     multiplizieren sich (zwei Putzerfisch-Arten: 0,9 × 0,9 = 19 % weniger). Das kommt zur Putzkolonne der Krabbler dazu. */
  AA.fishAlgae = function (t) {
    const seen = {}; let k = 1;
    for (let i = 0; i < t.fish.length; i++) { const sp = t.fish[i].sp, d = AA.FISH_BY[sp]; if (d.algae && !seen[sp]) { seen[sp] = 1; k *= 1 - d.algae; } }
    return k;
  };
  /* Für die Anzeige: wie stark bremsen Krabbler und Fische zusammen? (0…1) */
  AA.algaeBrake = function (t) { return 1 - (1 - AA.cleanPower(t)) * AA.fishAlgae(t); };
  AA.cleanerCount = function (t) { let n = 0; t.fish.forEach(function (f) { if (AA.FISH_BY[f.sp].cleaner) n++; }); return n; };

  /* ---------- Prestige-Deko ----------
     Je verschiedenem Prestige-Stück (in irgendeinem Becken) gibt es PRESTIGE.rep mehr Ruf für erledigte Kundenaufträge, höchstens PRESTIGE.max Stücke zählen. */
  AA.PRESTIGE = { rep: 0.05, max: 5 };
  AA.prestigeCount = function () {
    const seen = {}; let n = 0;
    S().tanks.forEach(function (t) { t.deco.forEach(function (o) { const d = AA.DECO_BY[o.type]; if (d && d.prestige && !seen[o.type]) { seen[o.type] = 1; n++; } }); });
    return Math.min(AA.PRESTIGE.max, n);
  };
  AA.prestigeMult = function () { return 1 + AA.PRESTIGE.rep * AA.prestigeCount(); };

  /* ---------- Aufräumen beim Laden ----------
     Tiere, die vor Runde 9 in einem Becken eingezogen sind, bleiben dort wohnen – die neuen Regeln (großes Becken, Tiefsee) gelten erst beim
     Kaufen und Umsetzen. Dass es höchstens ein Tiefsee-Becken gibt, prüft AA.farmFix (js/farm.js). */
  AA.wildFix = function (o) { return o; };
})(window.AA);
