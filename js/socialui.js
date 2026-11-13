'use strict';
/* Awesome Aquarium – Runde 11, Oberfläche: Profil in den Einstellungen (Name, Fisch-Bild, „Über mich“), Musik-Schalter,
   Neuigkeiten der Runde 11 und das Geschenk. Regeln: js/social.js, js/music.js */
(function (AA) {
  const UI = AA.ui, $ = AA.$, esc = AA.esc, fmt = AA.fmt, M = AA.music;
  let pick = null;

  function av(id, cls) {
    const k = 'fish/' + (AA.FISH_BY[id] ? id : 'clown') + '_b';
    AA.assets.want(k);
    return '<img class="av' + (cls ? ' ' + cls : '') + '" data-av="' + k + '" src="' + AA.assets.src(k) + '" alt="">';
  }

  /* ---------- Profil ---------- */
  UI.profileSetting = function () {
    if (UI.modalKind !== 'settings') pick = null;     // frisch geöffnet: das gespeicherte Bild
    const me = AA.me(), p = AA.state.profile || {}, cloud = !!(AA.cloud && AA.cloud.user && AA.cloud.profile);
    pick = pick && AA.AVATARS.indexOf(pick) >= 0 ? pick : (me.avatar || 'clown');
    const name = cloud ? me.name : (p.name || ''), bio = me.bio || '';
    return '<div class="set col pf11"><div class="pf11-top">' + av(pick, 'big pf11-pic') + '<div><b>Dein Profil</b><small>' +
      (cloud ? 'Name, Bild und „Über mich“ sehen deine Freunde' + (me.user ? ' – du bist <b>@' + esc(me.user) + '</b>' : '') + '.' : 'Name, Bild und „Über mich“ – sobald du angemeldet bist, sehen das auch deine Freunde.') + '</small></div></div>' +
      '<input id="pf11-name" class="cl-in sm pf11-name" type="text" maxlength="' + AA.PROFILE.nameMax + '" autocomplete="nickname" placeholder="Dein Name" value="' + esc(name) + '">' +
      '<div class="cl-avs pf11-avs">' + AA.AVATARS.map(function (a) { return '<button class="cl-av' + (a === pick ? ' active' : '') + '" data-act="pf11-av" data-id="' + a + '" title="' + esc(AA.FISH_BY[a] ? AA.FISH_BY[a].name : a) + '">' + av(a) + '</button>'; }).join('') + '</div>' +
      '<div class="pf11-bio"><textarea id="pf11-bio" class="cl-in sm" maxlength="' + AA.PROFILE.bioMax + '" rows="3" placeholder="Über mich – z. B. Lieblingsfisch, was du gerade züchtest …">' + esc(bio) + '</textarea><small id="pf11-left">' + bio.length + ' / ' + AA.PROFILE.bioMax + '</small></div>' +
      '<div class="note warn hidden" id="pf11-err"></div>' +
      '<div class="row end"><button class="btn green" data-act="pf11-save">💾 Profil speichern</button></div></div>';
  };
  function saveProfile() {
    const n = $('#pf11-name'), b = $('#pf11-bio'), e = $('#pf11-err');
    const r = AA.saveMyProfile(n ? n.value : '', pick, b ? b.value : '');
    if (!r.ok) { if (e) { e.textContent = 'Dein Name braucht mindestens 2 Zeichen (oder lass das Feld leer).'; e.classList.remove('hidden'); } AA.audio.play('error'); return; }
    AA.audio.play('click');
    UI.openSettings();                                 // erst neu zeichnen (das Öffnen räumt die Meldungen weg), dann melden
    UI.toast('✅ Profil gespeichert.');
  }

  /* ---------- Musik ---------- */
  function mmss(sec) { const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function musicLine() {
    const n = (AA.MUSIC_LIST || []).length, on = AA.state.settings.music !== false;
    if (!n) return 'Der Aquarium-Soundtrack kommt mit dem nächsten Update.';
    if (!on) return n + ' Songs – gerade aus.';
    if (M.playing) return '♪ Läuft: <b>' + esc(M.title()) + '</b>';
    const w = M.waitLeft();
    return w > 0 ? 'Nächster Song in <b>' + mmss(w) + '</b>.' : (M.unlocked ? 'Gleich geht es los.' : 'Startet mit dem ersten Tippen ins Spiel.');
  }
  UI.musicSetting = function () {
    const n = (AA.MUSIC_LIST || []).length, on = AA.state.settings.music !== false;
    return '<div class="set"><div><b>Musik</b><small>Ein Song, dann 10 Minuten Ruhe, dann der nächste' + (n ? ' (' + n + ' Songs)' : '') + '. Taste M schaltet um.</small><small id="mus-line">' + musicLine() + '</small></div>' +
      '<div class="row"><button class="seg' + (on ? ' active' : '') + '" data-act="mus-set" data-id="1">An</button><button class="seg' + (!on ? ' active' : '') + '" data-act="mus-set" data-id="0">Aus</button>' +
      (n ? '<button class="seg" data-act="mus-skip" title="Sofort einen Song spielen">▶</button>' : '') + '</div></div>';
  };

  /* ---------- Neuigkeiten ---------- */
  /* Runde 14: Extra-Geschenk für Damians Stand (js/social.js) */
  UI.r14News = function (li, b) {
    li.push('🎁 <b>Extra-Geschenk für dich:</b> ' + fmt(b.coins) + ' Münzen und ' + fmt(b.pearls) + ' Perlen. Sonst bleibt dein Spielstand genau, wie er ist.');
  };
  UI.r11News = function (li, n) {
    if (n.gift) li.push('🎁 <b>Geschenk für dich:</b> ' + fmt(n.gift.coins) + ' Münzen und Level ' + n.gift.level + ' – das höchste, das es gibt' + (n.gift.pearls ? ' (dazu ' + n.gift.pearls + ' Perlen für die Aufstiege)' : '') + '.');
    if (n.v11) {
      li.push('❤ <b>Paarung neu:</b> Die Pause nach der Balz gilt jetzt <b>je Fisch</b> – mehrere Paare dürfen gleichzeitig balzen, und jede Balz bringt sicher ein Ei.');
      li.push('🦐 <b>Krabbler-Grenze:</b> höchstens ' + AA.BAL.maxCrawl + ' pro Becken, im Meeres- und Tiefsee-Becken ' + AA.BAL.maxCrawlBig + '. Dafür putzt jeder mehr.' + (n.crawlMoved ? ' ' + n.crawlMoved + (n.crawlMoved === 1 ? ' Krabbler ist' : ' Krabbler sind') + ' ins 📦 Lager gezogen.' : ''));
      li.push('🪸 <b>Mehr Platz für Deko</b> in großen Becken: bis zu ' + AA.BAL.decoBySize[AA.BAL.decoBySize.length - 1] + ' Stücke, im Meeresbecken ' + AA.BAL.decoOcean + '.');
      li.push('🕊️ <b>Alle vertragen sich:</b> Räuber fressen keine Fische mehr. Und die Zeit läuft immer in Echtzeit.');
      li.push('🙂 <b>Profil</b> in den Einstellungen: Name, Fisch-Bild und ein Satz über dich.' + ((AA.MUSIC_LIST || []).length ? ' 🎵 Dazu läuft jetzt ab und zu Musik (Taste M).' : ''));
    }
  };

  /* ---------- Klicks ---------- */
  UI.socialClick = function (act, id) {
    if (act === 'pf11-av') { pick = id; document.querySelectorAll('#modal .pf11-avs .cl-av').forEach(function (b) { b.classList.toggle('active', b.dataset.id === id); }); const im = $('#modal .pf11-pic'); if (im) { const k = 'fish/' + id + '_b'; AA.assets.want(k); im.src = AA.assets.src(k); im.dataset.av = k; } AA.audio.play('click'); return true; }
    if (act === 'pf11-save') { saveProfile(); return true; }
    if (act === 'mus-set') { M.set(id === '1'); AA.audio.play('click'); if (UI.modalKind === 'settings') UI.openSettings(); return true; }
    if (act === 'mus-skip') { M.skip(); if (UI.modalKind === 'settings') setTimeout(function () { if (UI.modalKind === 'settings') UI.openSettings(); }, 120); return true; }
    return false;
  };

  UI.socialInit = function () {
    if (AA.touch) { AA.touch.init(); AA.touch.wire(); }
    M.init();
    AA.on('music', function () { const el = $('#mus-line'); if (el) el.innerHTML = musicLine(); });
    setInterval(function () { const el = $('#mus-line'); if (el && UI.modalKind === 'settings') el.innerHTML = musicLine(); }, 1000);
    document.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'pf11-bio') { const l = $('#pf11-left'); if (l) l.textContent = e.target.value.length + ' / ' + AA.PROFILE.bioMax; }
    });
  };
})(window.AA);
