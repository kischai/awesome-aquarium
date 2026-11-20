'use strict';
/* Awesome Aquarium – Oberfläche für Runde 9: Schildchen an den neuen Arten (Shop, Fisch-Karte), Tiefsee-Becken im Shop,
   Prestige-Deko, Hinweis „Was ist neu“. Regeln in js/wild.js und js/data.js (AA.whyNot). */
(function (AA) {
  const $ = AA.$, esc = AA.esc, fmt = AA.fmt, UI = AA.ui;
  function coin() { return '<img class="ic" src="' + AA.assets.src('prop/coin') + '" alt="Münzen">'; }
  function pct(x) { return Math.round(x * 100); }
  const big = function () { return AA.SIZES[AA.BIG_SIZE].gal; };      // Runde 20f: ab 125 Gallonen (es gibt jetzt größere Stufen)

  /* Eigenheiten einer Art: [Kurztext, Erklärung] – dieselbe Liste für die Schildchen im Shop und die Marken auf der Fisch-Karte */
  function traits(f) {
    const a = [];
    if (f.suck) a.push(['🪟 Saugwels', 'Saugt sich fest: am Boden, an den Seitenscheiben und an der Frontscheibe – dort sieht man ihn von unten, mit Saugmaul.']);
    if (f.inv) a.push(['🙃 Rückenschwimmer', 'Schwimmt immer auf dem Rücken – das ist kein Fehler, das macht er wirklich so.']);
    if (f.still) a.push(['🪨 Rührt sich kaum', 'Liegt an seinem Platz am Boden und wartet. Wechselt nur selten die Stelle und frisst, was vorbeikommt.']);
    if (f.grim) a.push(['😠 Guckt immer grimmig', 'Egal ob satt und zufrieden oder nicht: Der Blick bleibt.']);
    if (f.cleaner) a.push(['🩺 Putzerfisch', 'Putzt andere Fische – Kranke werden dabei gesund.']);
    if (f.algae) a.push(['🧽 −' + pct(f.algae) + ' % Algen', 'Solange mindestens einer im Becken lebt, veralgt es ' + pct(f.algae) + ' % langsamer (zählt je Art einmal, kommt zur Putzkolonne der Krabbler dazu).']);
    if (f.glow) a.push(['✨ Leuchtet', 'Leuchtet im Dunkeln: nachts und im Tiefsee-Becken.']);
    if (f.ocean) a.push(['🦈 Meeresbecken', 'Meeresriese: lebt nur im Meeresbecken.']);
    else if (f.deep === 1) a.push(['🌌 Tiefsee', 'Tiefsee-Tier: lebt nur im Tiefsee-Becken.']);
    else if (f.big) a.push(['📐 Großes Becken', 'Braucht Platz: erst ab ' + big() + ' Gallonen oder im Meeresbecken.']);
    if (f.deep === 2) a.push(['🌌 Auch Tiefsee', 'Darf auch ins Tiefsee-Becken.']);
    /* Runde 20e: Afrika */
    if (f.carry === 'mouth' && f.carrySex === 'f') a.push(['👄 Maulbrüter', 'Die Mama trägt das Ei im Maul, bis das Baby schlüpft.']);
    if (f.needCave) a.push(['🕳️ Höhlenbrüter', 'Laicht nur, wenn eine Höhle im Becken steht: Ton-Laichhöhle oder Kokosnuss (Shop → Deko).']);
    else if (f.cavebrood) a.push(['🪨 Höhlenbrüter', 'Legt sein Ei an eine Höhle oder an einen Fels.']);
    if (f.group) a.push(['👥 Gruppe ab ' + f.group, 'Erst ab ' + f.group + ' Tieren dieser Art im Becken glücklich: darunter traurig und es wächst langsamer, ab ' + f.group + ' schneller.']);
    if (f.family) a.push(['👨‍👩‍👧 Großfamilie', 'Jedes erwachsene Tier über das Elternpaar hinaus hilft (höchstens 3): Je Helfer schlüpfen die Eier 15 % und wachsen die Babys 10 % schneller.']);
    if (f.rockface) a.push(['🧗 Felskletterer', 'Klebt seitlich am Fels – der Bauch zeigt immer zum Stein – oder kopfüber unter der Decke einer Höhle.']);
    if (f.slip) a.push(['💨 Spaltenflitzer', 'Flitzt durch Felsspalten: hinter dem Stein durch und auf der anderen Seite wieder heraus.']);
    if (f.playdead) a.push(['😵 Stellt sich tot', 'Legt sich ab und zu auf den Grund. Kommen kleine Fische gucken, schnappt er zu – nur ein Schreck, keiner wird gefressen.']);
    if (f.cuckoo) a.push(['🤫 Kuckuck', 'Balzt im selben Becken eine Maulbrüterin (Elektrischer Gelber, Kaiserbuntbarsch & Co.), schmuggelt er manchmal sein Ei dazu (35 %) – es schlüpft sogar etwas früher.']);
    if (f.guest) a.push(['🌎 Gast aus Mittelamerika', 'Echte Zuchtform aus Mittelamerika-Buntbarschen – gehört als Gast zum Afrika-Set.']);
    if (f.sterile) a.push(['🚫 Unfruchtbar', 'Lässt sich nicht züchten – gibt es nur im Shop.']);
    return a;
  }
  UI.wildTags = function (f) { return traits(f).map(function (x) { return '<span class="tag-wild" title="' + esc(x[1]) + '">' + x[0] + '</span>'; }).join(''); };
  /* Marken auf der Fisch-Karte (js/lifeui.js ruft das mit seiner chip-Funktion auf) */
  UI.wildChips = function (d, def, t, chip) {
    traits(def).forEach(function (x) { if (x[0].indexOf('Meeresbecken') < 0 && x[0].indexOf('Tiefsee') < 0 && x[0].indexOf('Großes Becken') < 0) chip(x[0], esc(x[1]), def.algae && x[0].indexOf('Algen') > 0 ? 'ok' : ''); });
  };

  /* Krabbler-Reiter: was die Fische zum Sauberhalten beitragen */
  UI.wildCrewNote = function (t) {
    const seen = {}, parts = [];
    t.fish.forEach(function (f) { const d = AA.FISH_BY[f.sp]; if (d.algae && !seen[f.sp]) { seen[f.sp] = 1; parts.push(esc(d.name) + ' −' + pct(d.algae) + ' %'); } });
    if (!parts.length) return '';
    return '<br><b>🐟 Algenfresser unter den Fischen:</b> ' + parts.join(', ') + ' – zusammen mit der Putzkolonne veralgt „' + esc(t.name) + '“ gerade <b>' + pct(AA.algaeBrake(t)) + ' %</b> langsamer.';
  };

  /* ================= Shop → Aquarien: Tiefsee-Becken ================= */
  UI.wildTankCards = function () {
    const st = AA.deepStatus(), D = AA.DEEP, nx = AA.deepNext(), dn = AA.deepCount(), num = dn ? 'Zweites ' : '';
    const only = AA.FISH.filter(function (f) { return f.deep === 1 && !f.hybrid; }), also = AA.FISH.filter(function (f) { return f.deep === 2 && !f.hybrid; });
    return '<div class="card wide deepcard"><div class="pic emoji">🌌</div><div class="nm">' + num + 'Tiefsee-Becken <small class="tagline">stockdunkel – hier leuchten die Bewohner selbst' + (dn ? ' · du hast ' + dn + ' von ' + D.max : '') + '</small></div>' +
      '<div class="info">Ein riesiges, finsteres Meerwasser-Becken für ' + D.cap + ' Bewohner. Nur hier leben die ' + only.length + ' Tiefsee-Arten – vom Laternenfisch bis zum Quastenflosser. ' +
      'Mit hinein dürfen ' + also.map(function (f) { return esc(f.name); }).join(', ') + '. Alle anderen bleiben draußen: zu dunkel, zu kalt.</div>' +
      (st === 'owned' ? '<button class="buy active" disabled>✓ Beide gekauft</button>' : (st === 'level' ? '<button class="buy locked" disabled>🔒 Ab Level ' + nx.lvl + '</button>' :
        '<button class="buy' + (st === 'coins' ? ' poor' : '') + '" data-act="buydeep"' + (st === 'coins' ? ' disabled' : '') + '>🌌 ' + num + 'Tiefsee-Becken · ' + coin() + ' ' + fmt(nx.price) + '</button>')) + '</div>';
  };

  /* ================= Deko: Prestige ================= */
  UI.wildDecoTags = function (d) {
    return (d.prestige ? '<span class="tag-prestige" title="Prestige-Stück: funkelt und bringt ' + pct(AA.PRESTIGE.rep) + ' % mehr Ruf je erledigtem Kundenauftrag. Jedes verschiedene Stück zählt einmal, höchstens ' + AA.PRESTIGE.max + '.">💎 Prestige · +' + pct(AA.PRESTIGE.rep) + ' % Ruf</span>' : '') +
      (d.glow ? '<span title="Leuchtet im Dunkeln: nachts und im Tiefsee-Becken">💡 Leuchtet</span>' : '');
  };
  UI.wildDecoTop = function () {
    const n = AA.prestigeCount();
    return ' <b>💎 Prestige-Stücke</b> (ganz unten, ab Level 30) funkeln und bringen mehr Ruf je Kundenauftrag' + (n ? ' – du hast ' + n + ' von ' + AA.PRESTIGE.max + ': <b>+' + pct(AA.PRESTIGE.rep * n) + ' % Ruf</b>' : '') + '.';
  };

  /* ================= Klicks ================= */
  UI.wildClick = function (act) {
    if (act === 'buydeep') {
      const r = AA.buyDeep();
      if (r !== true) UI.fail(r);
      else { AA.audio.play('level'); AA.save(); UI.close(); UI.toast('🌌 Dein <b>Tiefsee-Becken</b> ist da. Licht aus – jetzt können die Leuchtfische einziehen.', 'big'); }
      return true;
    }
    return false;
  };

  /* ================= Was ist neu (Runde 9) ================= */
  UI.wildNews = function (li) {
    const n = function (k) { return AA.FISH.filter(k).length; };
    li.push('🪟 <b>Saugwelse:</b> ' + n(function (f) { return f.suck; }) + ' Welse saugen sich jetzt fest – am Boden, an den Seitenscheiben und an der Frontscheibe. Dort siehst du sie von unten, mit Saugmaul. Der Kongowels schwimmt dafür immer auf dem Rücken.');
    li.push('🌌 <b>Tiefsee-Becken</b> ab Level ' + AA.DEEP.lvl + ' (Shop → Aquarien): stockdunkel, die Bewohner leuchten selbst. ' + n(function (f) { return f.deep === 1; }) + ' Arten leben nur dort – der Quastenflosser ist der letzte Fisch im Spiel.');
    li.push('🦈 <b>Haie, Mondfisch, Manta & Co.:</b> Die ganz Großen ziehen nur ins Meeresbecken, die kleinen Bodenhaie brauchen das größte Becken (' + big() + ' Gallonen).');
    li.push('🦑 <b>Tintenfische:</b> Sepia, Blauer Kalmar und Dumbo-Oktopus – dazu drei neue Kreuzungen (Büro → Zucht): Galaxie-Kalmar, Pracht-Sepia und Saphir-Sepia. Aus dem Amazonas kommen zwei Süßwasser-Rochen.');
    li.push('🩺 <b>Putzerfische</b> putzen andere Fische gesund und bremsen die Algen um 10 %. Im Süßwasser frisst der <b>Graskarpfen</b> das Grünzeug weg: 50 % weniger Algen.');
    li.push('🪨 <b>Der Steinfisch</b> liegt an seinem Platz, rührt sich kaum und guckt immer grimmig. Die <b>Scholle</b> (bei den Krabblern) liegt flach auf dem Kies und braucht kein Futter.');
    li.push('🦀 <b>Elf neue Krabbler</b> – Schlangenstern, Diadem-Seeigel, Winkerkrabbe, Boxerkrabbe, Feuergarnele … – und <b>zehn neue Deko-Stücke</b>. Fünf davon sind 💎 <b>Prestige</b>: Sie funkeln und bringen mehr Ruf.');
    li.push('🐟 <b>Ruhiger im Becken:</b> Fische verstecken sich deutlich seltener und kürzer, der Zitteraal schwimmt wieder vorwärts, und die zweigeteilten Böden sind nicht mehr verzerrt.');
  };
})(window.AA);
