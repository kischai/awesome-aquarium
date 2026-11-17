'use strict';
/* Awesome Aquarium – Runde 10, Oberfläche Familie: 🏆 Rangliste (Level · Sammelbuch · Schönheit), 📅 Tägliches Ritual (Login-Kalender,
   öffnet sich einmal am Tag von allein), Testfreund „Testi“ in der Freundes-Leiste und der Schalter dafür in den Einstellungen.
   Regeln: js/family.js */
(function (AA) {
  const UI = AA.ui, $ = AA.$, esc = AA.esc, fmt = AA.fmt;
  let rankTab = 'level', autoDay = '';

  function av(id) {
    const k = 'fish/' + (AA.FISH_BY[id] ? id : 'clown') + '_b';
    return '<img class="av" data-av="' + k + '" src="' + AA.assets.thumb(k) + '" alt="">';      // Vorschaubild (js/assets.js)
  }
  function head(title) { return '<div class="m-head"><div class="m-title">' + title + '</div><button class="x" data-act="close" title="Schließen">✕</button></div>'; }

  /* ---------- Rangliste ---------- */
  const COLS = { level: ['⭐', 'Level', function (v) { return 'Level ' + v; }], species: ['📖', 'Sammelbuch', function (v) { return v + ' Arten'; }], beauty: ['🌟', 'Schönheit', function (v) { return v + ' / 100'; }] };
  function people() {
    const C = AA.cloud, me = AA.myRankStats(), out = [];
    const my = AA.me ? AA.me() : { name: 'Du', avatar: 'clown' };      // Runde 11: auch ohne Konto mit eigenem Namen und Bild
    const pub = UI.myPublic ? UI.myPublic() : {};      // Runde 19: Titel, Abzeichen, Goldrahmen
    out.push({ me: true, name: my.name, avatar: my.avatar, user: C && C.user && C.profile ? C.user.id : null, photo: C && C.profile ? C.profile.photo || 0 : 0, level: me.level, species: me.species, beauty: me.beauty, title: pub.title, badges: pub.badges, gold: pub.gold });
    if (C && C.friends) C.friends.forEach(function (f) {
      if (f.status !== 'accepted') return;
      out.push({ name: f.name, avatar: f.avatar, user: f.user, photo: f.photo || 0, level: f.level || 1, species: f.species === undefined || f.species === null ? null : f.species, beauty: f.beauty === undefined || f.beauty === null ? null : f.beauty, title: f.title || null, badges: f.badges || [], gold: f.gold | 0 });
    });
    if (AA.testOn()) { const t = AA.testStats(); out.push({ test: true, name: AA.TEST.name + ' 🧪', avatar: AA.TEST.avatar, level: t.level, species: t.species, beauty: t.beauty }); }
    return out;
  }
  UI.rankPeople = people;                             // Runde 12: für die Wochen-Pokale (js/extras.js)
  UI.openRank = function (tab) {
    if (tab) rankTab = tab;
    const P = people(), k = rankTab, col = COLS[k];
    const rows = P.filter(function (p) { return p[k] !== null && p[k] !== undefined; }).sort(function (a, b) { return b[k] - a[k] || (a.me ? -1 : 1); });
    let place = 0, prev = null;
    const html = rows.map(function (p, i) {
      if (p[k] !== prev) { place = i + 1; prev = p[k]; }
      const medal = place === 1 ? '🥇' : (place === 2 ? '🥈' : (place === 3 ? '🥉' : place + '.'));
      return '<div class="rk-row' + (p.me ? ' me' : '') + '"><span class="rk-pl">' + medal + '</span>' + (UI.face ? UI.face(p) : av(p.avatar)) + '<b class="rk-nm">' + esc(p.name) + (p.me ? ' <small>(du)</small>' : '') + (UI.themeBadges ? UI.themeBadges(p.badges) : '') + (UI.titleLine && p.title ? '<small class="rk-ttl">' + UI.titleLine(p.title) + '</small>' : '') + '</b><span class="rk-v">' + col[2](p[k]) + '</span></div>';
    }).join('');
    const miss = P.filter(function (p) { return p[k] === null || p[k] === undefined; });
    const tabs = Object.keys(COLS).map(function (c) { return '<button class="tab' + (c === k ? ' active' : '') + '" data-act="rk-tab" data-id="' + c + '">' + COLS[c][0] + ' ' + COLS[c][1] + '</button>'; }).join('');
    const lead = rows[0], meRow = rows.filter(function (p) { return p.me; })[0];
    let note = '';
    if (lead && meRow && lead !== meRow && lead[k] > meRow[k]) note = '<div class="note">Bis Platz 1 (' + esc(lead.name) + ') fehlen dir noch <b>' + (lead[k] - meRow[k]) + '</b>' + (k === 'level' ? ' Level' : (k === 'species' ? ' Arten' : ' Punkte')) + '. Du schaffst das. 💪</div>';
    else if (meRow && lead === meRow && rows.length > 1) note = '<div class="note gold">👑 Du führst! Wer den Thron will, muss erst an dir vorbei.</div>';
    const C = AA.cloud;
    const foot = !C || !C.on ? '<div class="note">Deine Familie erscheint hier, sobald das Spiel im Netz läuft und ihr befreundet seid (👥 Freunde).</div>'
      : (!C.user ? '<div class="note">Melde dich an (👥 Freunde), dann siehst du hier deine Familie.</div>' : '') +
        (miss.length ? '<div class="note">' + miss.map(function (p) { return esc(p.name); }).join(', ') + ': noch keine Werte – erscheinen, sobald sie ihr Spiel aktualisiert haben.</div>' : '');
    UI.open('rank', head('🏆 Rangliste der Familie') + '<div class="tabs">' + tabs + '</div><div class="list rk-list">' + note + html + foot +
      (k === 'beauty' ? '<div class="note">Die Schönheit zählt dein schönstes Becken. Wie sie zustande kommt: im ✏️ Deko-Modus oben auf die Note tippen.</div>' : '') + '</div>', 'mid');
    if (UI.fillPhotos) UI.fillPhotos();                // Launch: Profilfotos nachladen
  };

  /* ---------- Tägliches Ritual ---------- */
  function rewardTxt(day) {
    const r = AA.loginReward(day);
    if (r.k === 'coins') return '<b>' + fmt(r.n) + '</b><small>Münzen</small>';
    if (r.k === 'food') return '<b>' + r.n + '</b><small>Prisen Futter</small>';
    if (r.k === 'pearls') return '<b>' + r.n + '</b><small>' + (r.n === 1 ? 'Perle' : 'Perlen') + '</small>';
    if (r.k === 'color') return '<b>' + r.n + '×</b><small>Farbfutter</small>';
    return '<b>Seltener</b><small>Fisch</small>';
  }
  UI.openLogin7 = function (fresh) {
    const inf = AA.loginInfo();
    const tiles = AA.LOGIN.map(function (R, i) {
      const d = i + 1, got = inf.done ? d <= inf.day : d < inf.day, now = !inf.done && d === inf.day;
      return '<div class="lg7-day' + (got ? ' got' : '') + (now ? ' now' : '') + (d === 7 ? ' big' : '') + '"><span class="lg7-n">Tag ' + d + '</span><span class="lg7-ico">' + (got ? '✅' : R.ico) + '</span>' + rewardTxt(d) + '</div>';
    }).join('');
    const msg = inf.done
      ? '<div class="note">Für heute abgeholt. Morgen geht es weiter mit <b>Tag ' + (inf.day % 7 + 1) + '</b> – Serie: ' + inf.streak + (inf.streak === 1 ? ' Tag' : ' Tage') + ' (Rekord ' + inf.best + ').</div>'
      : (inf.broken ? '<div class="note warn">Gestern verpasst – die Serie fängt wieder bei Tag 1 an. Halb so wild: Heute ist der beste Tag für einen Neustart.</div>' : '') +
        '<button class="btn green lg" data-act="lg7-claim">🎁 Tag ' + inf.day + ' abholen</button>';
    UI.open('login7', head('📅 Tägliches Ritual') + '<div class="lg7"><p class="lg7-sub">Schau sieben Tage am Stück vorbei – am siebten wartet ein <b>seltener Fisch</b>. Lässt du einen Tag aus, geht es wieder bei Tag 1 los.</p>' +
      '<div class="lg7-grid">' + tiles + '</div>' + msg + '</div>', 'mid' + (fresh ? ' lg7-fresh' : ''));
  };
  function claim() {
    const r = AA.loginClaim();
    if (!r) { UI.openLogin7(); return; }
    AA.audio.play(r.k === 'fish' ? 'level' : 'sparkle');
    AA.save();
    let txt;
    if (r.k === 'coins') txt = '+' + fmt(r.n) + ' Münzen';
    else if (r.k === 'food') txt = '+' + r.n + ' Prisen Futter';
    else if (r.k === 'pearls') txt = '+' + r.n + (r.n === 1 ? ' Perle' : ' Perlen');
    else if (r.k === 'color') txt = '+' + r.n + '× Farbfutter 🌈';
    else if (r.glitter) txt = 'Ein großes Glitzer-Ei ✨🥚 – in keinem Becken war Platz. Ausbrüten kannst du es im Sammelbuch, sobald Platz ist.';
    else { const f = r.fish, V = AA.VAR_BY[f.v]; txt = 'Ein seltener Fisch: <b>' + esc(AA.speciesName(f.sp, f.v)) + '</b>' + (V ? ' (' + V.rare + ')' : '') + ' ist in „' + esc(AA.state.tanks[r.tank].name) + '“ eingezogen!'; }
    UI.close();
    UI.toast('📅 Tag ' + r.day + ': ' + txt, 'gold');
    UI.refresh();
  }
  /* einmal am Tag von allein aufgehen – aber erst, wenn sonst nichts offen ist (Intro, Neuigkeiten, Anmelden …) */
  function autoOpen() {
    if (AA.visit || !AA.state || !AA.state.intro || UI.modalKind || document.hidden || window.AA_NO_RITUAL) return;      // AA_NO_RITUAL: nur für Tests
    const today = AA.today();
    if (autoDay === today) return;
    autoDay = today;
    if (!AA.loginInfo().done) UI.openLogin7(true);
  }
  function dot() { const d = $('#login-dot'); if (d) d.classList.toggle('hidden', AA.visit || !AA.state || AA.loginInfo().done); }

  /* ---------- Testfreund in der Freundes-Leiste ---------- */
  UI.testCard = function (here) {
    if (!AA.testOn()) return '';
    const t = AA.testStats();
    return '<button class="fcard test' + (here === AA.TEST.user ? ' here' : '') + '" data-fb="test">' + av(AA.TEST.avatar) + '<b>' + esc(AA.TEST.name) + ' 🧪</b><small>Level ' + t.level + ' · ' + t.fish + ' 🐟</small>' +
      '<small class="ago">' + (here === AA.TEST.user ? 'du bist hier' : 'Testfreund') + '</small>' + (UI.giftBadge ? UI.giftBadge('test') : '') + '</button>';
  };
  UI.familySetting = function () {
    const on = AA.testOn();
    return '<div class="set"><div><b>Testfreund Testi 🧪</b><small>Ein Probe-Freund mit eigenem Aquarium – zum Besuchen und für die Rangliste. Wohnt nur auf diesem Gerät.</small></div>' +
      '<div class="row"><button class="btn ' + (on ? 'grey' : 'green') + '" data-act="test-toggle">' + (on ? 'Ausblenden' : 'Einblenden') + '</button></div></div>';
  };

  /* ---------- Klicks ---------- */
  UI.familyClick = function (act, id) {
    if (act === 'rk-tab') { UI.openRank(id); return true; }
    switch (act) {
      case 'lg7-claim': claim(); return true;
      case 'decomode': UI.close(); if (UI.decoMode) UI.decoMode(true); return true;
      case 'test-toggle': AA.state.settings.testFriend = !AA.testOn(); AA.save(); UI.openSettings(); if (UI.refreshFriends) UI.refreshFriends(); return true;
    }
    return false;
  };

  UI.familyInit = function () {
    const br = $('#btn-rank'), bl = $('#btn-login');
    if (br) br.addEventListener('click', function () { AA.audio.play('click'); UI.openRank(); });
    if (bl) bl.addEventListener('click', function () { AA.audio.play('click'); UI.openLogin7(); });
    if (AA.visit) { if (bl) bl.classList.add('hidden'); return; }
    setInterval(function () { autoOpen(); dot(); }, 1500);
    dot();
  };
})(window.AA);
