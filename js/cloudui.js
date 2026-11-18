'use strict';
/* Awesome Aquarium – Wolke, Oberfläche: Anmelden (Benutzername + Passwort), Name und Avatar, Profil, Freundes-Leiste, Besuch bei Freunden,
   Nachfragen beim Abgleich, Spielstand als Datei. Die Regeln dazu stehen in js/cloud.js.
   Ohne eingetragene Wolke (js/config.js leer) bleibt davon nur „Spielstand als Datei sichern / laden“ in den Einstellungen. */
(function (AA) {
  const UI = AA.ui, C = AA.cloud, $ = AA.$, esc = AA.esc;
  const AVATARS = ['clown', 'guppy', 'goldfish', 'koi', 'neon', 'skalar', 'betta', 'discus', 'puffer', 'seahorse', 'axolotl', 'bluetang'];
  let after = null, gate = { user: '', busy: false, invite: '', showInv: false, seenReg: false }, pick = null, barOpen = false, tickT = 0;

  function head(title) { return '<div class="m-head"><div class="m-title">' + title + '</div><button class="x" data-act="close" title="Schließen">✕</button></div>'; }
  function av(id, cls) {
    const k = 'fish/' + (AA.FISH_BY[id] ? id : 'clown') + '_b';
    return '<img class="av' + (cls ? ' ' + cls : '') + '" data-av="' + k + '" src="' + AA.assets.thumb(k) + '" alt="">';      // Vorschaubild (js/assets.js) – lädt sein kleines Päckchen selbst
  }
  /* Launch: Gesicht eines Spielers – sein Profilfoto (nur für ihn selbst und Freunde ladbar), sonst sein Fisch */
  function face(p, cls) {
    if (p && p.gold > 0) cls = (cls ? cls + ' ' : '') + 'gold';      // Runde 19: Goldrahmen – mindestens ein Themen-Set ausgestellt
    if (!p || !(p.photo > 0) || !p.user || !C.on) return av(p && p.avatar, cls);
    const url = C.photoUrl(p.user, p.photo), fk = 'fish/' + (AA.FISH_BY[p.avatar] ? p.avatar : 'clown') + '_b';
    return '<img class="av photo' + (url ? ' ready' : '') + (cls ? ' ' + cls : '') + '" data-ph="' + esc(p.user + ':' + p.photo) + '" src="' + (url || AA.assets.thumb(fk)) + '" alt="">';
  }
  UI.face = face;
  function fillPhotos() {
    const list = [];
    document.querySelectorAll('img.av[data-ph]').forEach(function (im) { const a = im.dataset.ph.split(':'); if (!C.photoUrl(a[0], +a[1])) list.push({ user: a[0], photo: +a[1] }); });
    if (list.length) C.photoUrls(list);
  }
  function applyPhotos() {
    document.querySelectorAll('img.av[data-ph]').forEach(function (im) {
      const a = im.dataset.ph.split(':'), u = C.photoUrl(a[0], +a[1]);
      if (u && im.getAttribute('src') !== u) { im.src = u; im.classList.add('ready'); }
    });
  }
  UI.fillPhotos = function () { applyPhotos(); fillPhotos(); };
  function me() { return C.profile ? { user: C.user && C.user.id, photo: C.profile.photo, avatar: C.profile.avatar, gold: AA.themeGoldCount && AA.state && !AA.visit ? AA.themeGoldCount() : 0 } : null; }
  function err(msg) { const e = $('#cl-err'); if (e) { e.innerHTML = msg || ''; e.classList.toggle('hidden', !msg); } if (msg) AA.audio.play('error'); }
  function busy(on, sel) { gate.busy = !!on; document.querySelectorAll('#modal ' + (sel || '.btn')).forEach(function (b) { b.disabled = !!on; }); }
  /* Fehlermeldungen von Supabase Auth in Klartext */
  function authMsg(e) {
    const c = (e && (e.code || e.error_code)) || '', m = String((e && e.message) || '');
    if (c === 'over_email_send_rate_limit' || c === 'over_request_rate_limit' || (e && e.status === 429)) return 'Das war zu schnell hintereinander. Warte eine Minute und versuch es dann nochmal.';
    if (c === 'invalid_credentials' || /invalid login credentials/i.test(m)) return 'Benutzername oder Passwort stimmt nicht.';
    if (c === 'user_already_exists' || /already registered/i.test(m)) return 'Den Benutzernamen gibt es schon – such dir einen anderen aus. (Ist es deiner? Dann tipp auf „Ich habe schon ein Konto“.)';
    if (c === 'same_password' || /different from the old/i.test(m)) return 'Das ist schon dein Passwort.';
    if (c === 'weak_password' || /password should (be at least|contain)|weak password/i.test(m)) return 'Das Passwort ist zu schwach – nimm mindestens 8 Zeichen.';
    if (c === 'no_session' || c === 'email_not_confirmed') return 'Das Konto ist angelegt, aber noch nicht freigeschaltet. Sag Damian Bescheid.';
    if (c === 'signup_disabled' || /signups? not allowed/i.test(m)) return 'Neue Konten sind gerade gesperrt. Frag Damian.';
    if (c === 'validation_failed' || c === 'email_address_invalid' || /invalid format|validate email/i.test(m)) return 'Diesen Benutzernamen kann ich so nicht nehmen – nur Buchstaben, Zahlen, - und _.';
    if (c === 'timeout' || /fetch|network|load failed/i.test(m) || (e && e.status === 0)) return 'Keine Verbindung. Bist du online?';
    if (e && e.status === 403 && m) return esc(m);                 // z. B. die Absage vom Einladungs-Hook (steht schon auf Deutsch drin)
    return 'Das hat nicht geklappt' + (m ? ' (' + esc(m) + ')' : '') + '. Versuch es gleich nochmal.';
  }
  /* etwas zeigen, sobald kein anderes Fenster offen ist */
  function whenFree(fn) { if (!UI.modalKind || UI.modalKind === 'cwait') fn(); else setTimeout(function () { whenFree(fn); }, 600); }
  function proceed() { const f = after; after = null; if (f) f(); }

  /* ---------- Start ---------- */
  UI.cloudBoot = function (next) {
    if (AA.visit) { visitUi(); C.startVisit(); return; }
    if (!C.on) { next(); return; }
    after = next;
    C.start();
    const m = C.meta();
    if (C.status === 'out' && !C.skipped()) UI.openLogin();
    else if (C.user && !(m && m.uid === C.user.id && m.profile)) {      // angemeldet, aber dieses Gerät kennt das Konto noch nicht (z. B. über den Link aus der Mail):
      waiting('Dein Aquarium wird gesucht …');                           // erst Profil und Spielstand klären, dann das Übliche
      setTimeout(function () { if (UI.modalKind === 'cwait' && after && !C.reloading) { UI.close(); proceed(); } }, 12000);
    } else proceed();
  };

  /* ---------- Anmelden: Benutzername + Passwort (seit 14.11.2026; vorher Code per Mail) ----------
     Ein echtes <form>, damit Handy und Browser anbieten, das Passwort zu speichern. Abgeschickt wird über das submit-Ereignis
     (Enter oder Knopf), die Seite lädt dabei nie neu. Neue Konten brauchen einmal einen Familien- oder Einladungscode. */
  UI.openLogin = function () {
    gate.busy = false;
    if (!gate.invite && C.inviteFromUrl) { gate.invite = C.inviteFromUrl(); if (gate.invite) gate.showInv = true; }      // Code aus dem Einladungs-Link
    if (/[?&]register\b/.test(location.search) && !gate.seenReg) { gate.showInv = true; gate.seenReg = true; }           // Startseite: „Mit Code registrieren“
    const reg = !!gate.showInv;
    UI.open('login', '<div class="hero cl-hero"><div class="logo">Awesome <br>Aquarium</div>' +
      '<form class="cl-box" id="cl-form" novalidate><b>' + (reg ? 'Willkommen! Leg dein Konto an.' : 'Melde dich an.') + '</b>' +
      '<small>' + (reg ? 'Such dir einen Benutzernamen und ein Passwort aus. Den Code brauchst du nur dieses eine Mal.'
        : 'Dann ist dein Aquarium gesichert, läuft auf Handy und Rechner – und du kannst deine Familie besuchen.') + '</small>' +
      '<input id="cl-user" class="cl-in" type="text" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="24" placeholder="Benutzername" value="' + esc(gate.user || '') + '">' +
      '<input id="cl-pass" class="cl-in" type="password" name="password" autocomplete="' + (reg ? 'new-password' : 'current-password') + '" maxlength="72" placeholder="' + (reg ? 'Passwort (mindestens 8 Zeichen)' : 'Passwort') + '">' +
      (reg ? '<div class="cl-invbox" id="cl-invbox"><small>🎟️ Familien- oder Einladungscode</small>' +
        '<input id="cl-inv" class="cl-in code inv" type="text" name="code" maxlength="9" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABCD-EFGH" value="' + esc(gate.invite ? C.fmtCode(gate.invite) : '') + '"></div>' : '') +
      '<div class="note warn hidden" id="cl-err"></div>' +
      '<button type="submit" class="btn green lg" id="cl-go">' + (reg ? 'Konto anlegen' : 'Anmelden') + '</button>' +
      '<div class="cl-links">' + (reg ? '<button type="button" class="lnk" data-act="lg-have">Ich habe schon ein Konto</button>'
        : '<button type="button" class="lnk" data-act="lg-inv" id="cl-invlink">Neu hier? Ich habe einen Code</button><button type="button" class="lnk" data-act="lg-forgot">Passwort vergessen?</button>') + '</div></form>' +
      '<button type="button" class="lnk light" data-act="lg-skip">Erstmal ohne Konto spielen</button></div>', 'small hero-m', !!after);
    const i = $(gate.user && !reg ? '#cl-pass' : '#cl-user'); if (i && !UI.touch) i.focus();
  };
  function keepUser() { const i = $('#cl-user'); if (i && i.value) gate.user = i.value; }
  function switchLogin(reg) { keepUser(); gate.showInv = reg; UI.openLogin(); }
  function note(msg) { const e = $('#cl-err'); if (e) { e.innerHTML = msg; e.classList.remove('hidden'); } }
  function readForm() { return { u: C.normUser(($('#cl-user') || {}).value), p: String(($('#cl-pass') || {}).value || '') }; }
  function login() {
    if (gate.busy) return;
    const f = readForm();
    if (!C.validUser(f.u)) { err('Den Benutzernamen gibt es so nicht. Er hat 3 bis 20 Zeichen: Buchstaben, Zahlen, - und _.'); return; }
    if (!f.p) { err('Gib dein Passwort ein.'); return; }
    gate.user = f.u; err(''); busy(true);
    C.signIn(f.u, f.p).then(function () { gate.busy = false; waiting('Angemeldet – dein Aquarium wird gesucht …'); },
      function (e) { busy(false); err(authMsg(e)); });
  }
  function register() {
    if (gate.busy) return;
    const f = readForm(), ii = $('#cl-inv'), inv = ii ? String(ii.value).replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '';
    if (!C.validUser(f.u)) { err('Benutzername: 3 bis 20 Zeichen – nur Buchstaben, Zahlen, - und _ (zum Beispiel oma-gerda).'); return; }
    if (f.p.length < 8) { err('Das Passwort braucht mindestens 8 Zeichen.'); return; }
    if (inv && inv.length !== 8) { err('Der Code hat 8 Zeichen, zum Beispiel ABCD-EFGH.'); return; }      // leer: entscheidet der Server (Hook)
    gate.user = f.u; gate.invite = inv; err(''); busy(true);
    C.signUp(f.u, f.p, inv || null).then(function () { gate.busy = false; waiting('Konto angelegt – gleich geht’s los …'); },
      function (e) { busy(false); err(authMsg(e)); });
  }
  function waiting(txt) { UI.open('cwait', '<div class="hero cl-hero"><div class="logo">Awesome <br>Aquarium</div><div class="cl-box"><b>' + txt + '</b><div class="cl-spin"></div></div></div>', 'small hero-m', true); }

  function savePassword() {
    const i = $('#cl-newpass'), p = String(i ? i.value : '');
    if (p.length < 8) { UI.toast('🔑 Das Passwort braucht mindestens 8 Zeichen.', 'warn'); return; }
    if (gate.busy) return; gate.busy = true;
    C.changePassword(p).then(function () { gate.busy = false; if (i) i.value = ''; UI.toast('🔑 Neues Passwort gespeichert.'); },
      function (e) { gate.busy = false; UI.toast('⚠️ ' + authMsg(e).replace(/<[^>]+>/g, ''), 'warn'); });
  }

  /* ---------- Name und Avatar ---------- */
  function avatarGrid(cur) {
    return '<div class="cl-avs">' + AVATARS.map(function (a) { return '<button class="cl-av' + (a === cur ? ' active' : '') + '" data-act="ob-av" data-id="' + a + '" title="' + esc(AA.FISH_BY[a] ? AA.FISH_BY[a].name : a) + '">' + av(a) + '</button>'; }).join('') + '</div>';
  }
  function openOnboard() {
    pick = pick || AA.pick(AVATARS);
    UI.open('onboard', '<div class="hero cl-hero"><div class="logo small">Willkommen!</div>' +
      '<div class="cl-box"><b>Wie sollen dich die anderen nennen?</b>' +
      '<input id="cl-name" class="cl-in" type="text" maxlength="20" autocomplete="nickname" placeholder="Dein Name" value="">' +
      '<b>Such dir einen Fisch als Bild aus:</b>' + avatarGrid(pick) +
      '<div class="note warn hidden" id="cl-err"></div>' +
      '<button class="btn green lg" data-act="ob-save">Los geht’s!</button></div></div>', 'small hero-m', true);
    const i = $('#cl-name'); if (i && !UI.touch) i.focus();
  }
  function saveProfile(first) {
    if (gate.busy) return;
    const i = $('#cl-name'), name = String(i ? i.value : '').replace(/\s+/g, ' ').trim();
    if (name.length < 2) { err('Dein Name braucht mindestens 2 Zeichen.'); return; }
    err(''); busy(true);
    C.saveProfile(name, pick || (C.profile && C.profile.avatar) || 'clown').then(function (r) {
      busy(false);
      if (!r || !r.ok) { err(r && r.error === 'name' ? 'Der Name muss 2 bis 20 Zeichen lang sein.' : (r && r.error === 'rude' ? 'Diesen Namen kann ich leider nicht nehmen – such dir einen anderen aus.' : 'Das hat nicht geklappt. Versuch es nochmal.')); return; }
      if (first) { gate.newCode = true; waiting('Fast fertig …'); if (r.friends_added > 0) setTimeout(function () { UI.toast('🎉 Du bist jetzt mit deiner Familie verbunden – schau oben rechts unter 👥.', 'gold'); }, 2500); }
      else { UI.toast('✅ Profil gespeichert.'); UI.openProfile(); refreshBar(); }
    }, function (e) { busy(false); err(authMsg(e)); });
  }

  /* ---------- Nachfragen beim Abgleich ---------- */
  function openAsk(q) {
    const s = AA.state, info = q.info || {}, nf = s.tanks.reduce(function (n, t) { return n + t.fish.length; }, 0), fishTxt = function (n) { return n === 1 ? '1 Fisch' : n + ' Fische'; };
    const here = 'Level ' + s.level + ' · ' + fishTxt(nf), there = 'Level ' + (info.level || '?') + (info.fish !== undefined && info.fish !== null ? ' · ' + fishTxt(info.fish) : '') + (info.updated_at ? ' · zuletzt ' + C.ago(info.updated_at) : '');
    let h;
    if (q.kind === 'update') {
      h = '<p><b>Es gibt eine neuere Version vom Spiel.</b> Dein Aquarium in der Wolke wurde schon damit gespeichert – lade die Seite neu, damit alles zusammenpasst.</p>' +
        '<div class="row end"><button class="btn green" data-act="ask-reload">🔄 Neu laden</button></div>';
    } else if (q.kind === 'foreign') {
      h = '<p><b>Auf diesem Gerät liegt schon ein Aquarium</b> (' + here + ') – es gehört zu einem anderen Konto oder wurde ohne Konto gespielt. Was soll mit <b>' + esc(C.profile.name) + '</b> passieren?</p>' +
        '<div class="cl-choice"><button class="btn green" data-act="ask-fresh">🌱 Neu anfangen<small>Das Aquarium hier bleibt als Sicherung im Browser.</small></button>' +
        '<button class="btn" data-act="ask-local">📱 Dieses Aquarium übernehmen<small>' + here + ' wird dein Aquarium.</small></button></div>';
    } else {
      h = '<p>' + (q.kind === 'conflict' ? '<b>Du hast auf einem anderen Gerät weitergespielt</b> – und hier gibt es auch Fortschritt, der noch nicht in der Wolke ist.'
        : '<b>In deinem Konto liegt schon ein Aquarium</b> – und auf diesem Gerät gibt es auch eins.') + ' Welches soll bleiben?</p>' +
        '<div class="cl-choice"><button class="btn green" data-act="ask-cloud">☁️ Das aus der Wolke<small>' + there + '</small></button>' +
        '<button class="btn" data-act="ask-local">📱 Das von diesem Gerät<small>' + here + '</small></button></div>' +
        '<p class="cl-fine">Das andere bleibt als Sicherung im Browser-Speicher dieses Geräts liegen.</p>';
    }
    UI.open('cask', head(q.kind === 'update' ? '🔄 Update' : '☁️ Zwei Aquarien') + '<div class="confirm cl-ask">' + h + '</div>', 'small', true);
    const x = $('#modal .x'); if (x) x.remove();
  }

  /* ---------- Profil und Freunde ---------- */
  function syncLine() {
    if (!C.user) return 'Nicht angemeldet.';
    if (C.status === 'offline') return '⚠️ Keine Verbindung – gespeichert wird solange auf diesem Gerät, hochgeladen sobald es wieder geht.';
    if (C.status === 'sync') return '☁️ Wird gerade gesichert …';
    if (C.pending) return '☁️ Wartet auf deine Entscheidung.';
    return '☁️ In der Wolke gesichert' + (C.syncedAt ? ' – ' + C.ago(C.syncedAt) : '') + '.';
  }
  function handle(f) { return f && f.username ? '<small class="cl-handle">@' + esc(f.username) + '</small>' : ''; }
  function friendRows() {
    if (!C.friends.length) return '<div class="cl-empty">Noch keine Freunde. Such jemanden über 🔍 – oder gib deinen Code weiter.</div>';
    const acc = C.friends.filter(function (f) { return f.status === 'accepted'; }), inc = C.friends.filter(function (f) { return f.status !== 'accepted' && f.incoming; }),
      out = C.friends.filter(function (f) { return f.status !== 'accepted' && !f.incoming; });
    return (acc.length ? rowsOf(acc) : '<div class="cl-empty">Noch keine Freunde – aber es läuft was. 😊</div>') +
      (inc.length ? '<b class="cl-sec">📨 Anfragen an dich</b>' + rowsOf(inc) : '') + (out.length ? '<b class="cl-sec">📤 Gesendet</b>' + rowsOf(out) : '');
  }
  function rowsOf(L) {
    return L.map(function (f) {
      const sub = f.status === 'accepted' ? ('Level ' + (f.level || 1) + ' · ' + (f.fish || 0) + ' 🐟' + (f.updated_at ? ' · ' + C.ago(f.updated_at) : '')) : (f.incoming ? 'möchte dein Freund sein' : 'Anfrage läuft – wartet auf Antwort');
      const btn = f.status === 'accepted' ? '<button class="btn sm green" data-act="fr-visit" data-id="' + f.id + '">👀 Besuchen</button><button class="btn sm grey" data-act="fr-remove" data-id="' + f.id + '" title="Freundschaft beenden">✕</button>'
        : (f.incoming ? '<button class="btn sm green" data-act="fr-accept" data-id="' + f.id + '">✔ Annehmen</button><button class="btn sm grey" data-act="fr-remove" data-id="' + f.id + '" title="Ablehnen">✕</button>'
          : '<button class="btn sm grey" data-act="fr-remove" data-id="' + f.id + '">Zurückziehen</button>');
      const more = '<button class="btn sm grey more" data-act="fr-more" data-id="' + f.id + '" title="Blockieren oder melden">⋯</button>';
      const extra = f.status === 'accepted' && UI.titleLine ? (UI.titleLine(f.title) + (UI.themeBadges ? UI.themeBadges(f.badges) : '')) : '';      // Runde 19: Titel und Abzeichen
      return '<div class="cl-friend' + (f.status !== 'accepted' ? ' pending' : '') + '">' + face(f) + '<div class="cl-fn"><b>' + esc(f.name) + '</b>' + (extra ? '<span class="cl-tb">' + extra + '</span>' : '') + handle(f) + '<small>' + sub + '</small></div><div class="row">' + btn + (f.status === 'accepted' || f.incoming ? more : '') + '</div></div>';
    }).join('');
  }
  UI.openProfile = function () {
    if (!C.on) return;
    if (!C.user) { after = null; UI.openLogin(); return; }
    if (!C.profile) { openOnboard(); return; }
    const p = C.profile, share = !!navigator.share;
    pick = p.avatar;
    UI.open('profile', head('👥 Profil &amp; Freunde') + '<div class="list settings cl-prof">' +
      '<div class="set col"><div class="cl-me">' + face(me(), 'big') + '<div class="cl-fn"><b>Dein Name</b><div class="row"><input id="cl-name" class="cl-in sm" type="text" maxlength="20" value="' + esc(p.name) + '"><button class="btn sm" data-act="pf-save">Speichern</button></div>' +
        (p.username ? '<small class="cl-handle">@' + esc(p.username) + ' – dein Benutzername, so findet man dich</small>' : '') + '</div></div>' +
      '<div class="cl-photo"><div><b>📸 Profilfoto</b><small>' + (p.photo ? 'Deine Freunde sehen dein Foto statt des Fischs.' : 'Lade ein Foto von dir hoch – das sehen nur du und deine Freunde.') + '</small></div>' +
      '<div class="row"><button class="btn sm green" data-act="ph-pick">' + (p.photo ? 'Anderes Foto' : 'Foto hochladen') + '</button>' + (p.photo ? '<button class="btn sm grey" data-act="ph-del">Entfernen</button>' : '') + '</div></div>' +
      '<small class="cl-sub">' + (p.photo ? 'Oder ein Fisch, wenn das Foto mal nicht lädt:' : 'Bis dahin dein Fisch:') + '</small>' +
      avatarGrid(p.avatar) + '<div class="note warn hidden" id="cl-err"></div></div>' +
      '<div class="set"><div><b>Dein Freundes-Code</b><small>Gib ihn deiner Familie – wer ihn eintippt, schickt dir eine Anfrage.</small></div>' +
      '<div class="row"><span class="cl-code" id="cl-mycode">' + esc(C.fmtCode(p.code)) + '</span><button class="btn sm" data-act="pf-copy">Kopieren</button>' + (share ? '<button class="btn sm" data-act="pf-share">Teilen</button>' : '') + '</div></div>' +
      '<div class="set col"><div><b>🎟️ Familie einladen</b><small>Neue Spieler brauchen einen Einladungscode. Wer sich mit deinem Code registriert, ist danach automatisch dein Freund.</small></div>' +
      '<div class="cl-invites" id="cl-invites"><div class="cl-empty">Einen Moment …</div></div>' +
      '<div class="row"><input id="cl-invnote" class="cl-in sm" type="text" maxlength="40" placeholder="Für wen? (z. B. Oma)"><button class="btn sm green" data-act="inv-new">Code erstellen</button></div></div>' +
      '<div class="set"><div><b>Freund hinzufügen</b><small>Nach @benutzername suchen – oder den Code von jemand anderem eintippen.</small></div>' +
      '<div class="row"><button class="btn sm green" data-act="fr-find">🔍 Suchen</button><input id="cl-fcode" class="cl-in sm code" type="text" maxlength="9" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABCD-EFGH"><button class="btn sm green" data-act="fr-add">Anfragen</button></div></div>' +
      '<div class="set col"><div><b>Freunde</b></div><div class="cl-friends" id="cl-friends">' + friendRows() + '</div></div>' +
      (p.username ? '<div class="set"><div><b>🔍 In der Suche auffindbar</b><small>' + (p.searchable !== false ? 'Andere können dich über @' + esc(p.username) + ' finden und dir eine Anfrage schicken.' : 'Aus: Dich findet niemand über die Suche – Freunde kommen nur noch über deinen Code.') + '</small></div>' +
        '<div class="row"><button class="btn sm ' + (p.searchable !== false ? 'green' : 'grey') + '" data-act="pf-search">' + (p.searchable !== false ? '✔ An' : 'Aus') + '</button></div></div>' : '') +
      (p.recovery !== undefined ? '<div class="set"><div><b>🔐 Rettungs-Code</b><small>' + (p.recovery ? 'Angelegt am ' + new Date(p.recovery).toLocaleDateString('de-DE') + '. Damit setzt du selbst ein neues Passwort, falls du es vergisst.' : '<b>Noch keiner!</b> Mit dem Code setzt du selbst ein neues Passwort, falls du es mal vergisst.') + '</small></div>' +
        '<div class="row"><button class="btn sm ' + (p.recovery ? '' : 'green') + '" data-act="rc-new">' + (p.recovery ? 'Neuen erstellen' : 'Jetzt erstellen') + '</button></div></div>' : '') +
      (p.username ? '<div class="set col"><div><b>🚫 Blockiert</b><small>Blockierte schicken dir keine Anfragen und finden dich nicht in der Suche.</small></div><div class="cl-blocks" id="cl-blocks"><div class="cl-empty">Einen Moment …</div></div></div>' : '') +
      '<div class="set"><div><b>Wolke</b><small id="cl-sync">' + syncLine() + '</small><small>Angemeldet als <b>' + esc(C.userName()) + '</b></small></div>' +
      '<div class="row"><button class="btn sm" data-act="pf-push">Jetzt sichern</button><button class="btn sm grey" data-act="pf-logout">Abmelden</button></div></div>' +
      '<div class="set"><div><b>🔑 Passwort ändern</b><small>Mindestens 8 Zeichen. Das alte brauchst du dafür nicht.</small></div><div class="row">' +
      '<input id="cl-newpass" class="cl-in sm" type="password" autocomplete="new-password" maxlength="72" placeholder="Neues Passwort"><button class="btn sm" data-act="pw-save">Ändern</button></div></div>' +
      fileRow() + '</div>', 'mid');
    C.loadFriends().catch(function () { /* die Liste von eben reicht */ });
    loadInvites();
    if (p.username) loadBlocks();
    UI.fillPhotos();
  };

  /* ---------- Launch: Einladungscodes ---------- */
  let invites = null;
  function inviteRows() {
    if (!invites) return '<div class="cl-empty">Einen Moment …</div>';
    if (!invites.length) return '<div class="cl-empty">Noch keine Codes. Erstell einen und schick ihn weiter.</div>';
    const day = function (t) { const d = new Date(t); return d.getDate() + '.' + (d.getMonth() + 1) + '.'; }, share = !!navigator.share;
    return invites.map(function (v) {
      const st = v.used ? '✅ benutzt' + (v.name ? ' von <b>' + esc(v.name) + '</b>' : '') : (v.expired ? '⌛ abgelaufen' : 'offen bis ' + day(v.expires_at));
      const btn = v.used || v.expired ? '' : (share ? '<button class="btn sm" data-act="inv-share" data-id="' + v.code + '">Teilen</button>' : '') +
        '<button class="btn sm" data-act="inv-copy" data-id="' + v.code + '">Kopieren</button><button class="btn sm grey" data-act="inv-del" data-id="' + v.code + '" title="Zurückziehen">✕</button>';
      return '<div class="cl-inv' + (v.used || v.expired ? ' done' : '') + '"><span class="cl-code sm">' + esc(C.fmtCode(v.code)) + '</span><div class="cl-fn"><b>' + (v.note ? esc(v.note) : 'Einladung') + '</b><small>' + st + '</small></div><div class="row">' + btn + '</div></div>';
    }).join('');
  }
  function loadInvites() {
    return C.myInvites().then(function (l) { invites = l; const b = $('#cl-invites'); if (b) b.innerHTML = inviteRows(); }, function () { const b = $('#cl-invites'); if (b) b.innerHTML = '<div class="cl-empty">Gerade keine Verbindung.</div>'; });
  }
  function inviteText(code) {
    const link = C.inviteLink(code);
    return 'Komm in mein Aquarium! 🐠 Dein Einladungscode für Awesome Aquarium: ' + C.fmtCode(code) + (link ? '\n' + link : '');
  }
  function newInvite() {
    const n = $('#cl-invnote');
    C.createInvite(n ? n.value : '').then(function (r) {
      if (r && r.ok) { AA.audio.play('sparkle'); if (n) n.value = ''; loadInvites().then(function () { UI.toast('🎟️ Neuer Code: <b>' + esc(C.fmtCode(r.code)) + '</b> – gilt 30 Tage.', 'gold'); }); return; }
      const why = { too_many: 'Du hast schon 5 offene Codes. Zieh einen zurück oder warte, bis jemand ihn benutzt.', too_many_today: 'Für heute sind es genug Codes – morgen geht es weiter.', no_profile: 'Leg erst dein Profil an.' };
      UI.toast('⚠️ ' + (why[r && r.error] || 'Das hat nicht geklappt.'), 'warn'); AA.audio.play('error');
    }, function () { UI.toast('⚠️ Keine Verbindung.', 'warn'); });
  }

  /* ---------- Launch: Profilfoto ---------- */
  let shot = null;
  function pickPhoto() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = function () { const f = inp.files && inp.files[0]; if (f) photoFrom(f); };
    inp.click();
  }
  function loadImage(f) {
    const viaImg = function () {
      return new Promise(function (ok, no) { const u = URL.createObjectURL(f), im = new Image(); im.onload = function () { ok(im); setTimeout(function () { URL.revokeObjectURL(u); }, 1000); }; im.onerror = function () { URL.revokeObjectURL(u); no(new Error('bild')); }; im.src = u; });
    };
    if (window.createImageBitmap) return createImageBitmap(f, { imageOrientation: 'from-image' }).catch(viaImg);
    return viaImg();
  }
  /* quadratisch zuschneiden (bei Hochformat etwas weiter oben – da ist meist das Gesicht), auf 256 × 256 verkleinern, JPEG */
  function photoFrom(f) {
    if (f.size > 30e6) { UI.toast('⚠️ Das Bild ist zu groß (höchstens 30 MB).', 'warn'); return; }
    loadImage(f).then(function (img) {
      const S = 256, w = img.width, h = img.height, s = Math.min(w, h), c = document.createElement('canvas');
      if (!w || !h) throw new Error('bild');
      c.width = S; c.height = S;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
      g.drawImage(img, (w - s) / 2, h > w ? (h - s) * 0.25 : (h - s) / 2, s, s, 0, 0, S, S);
      if (img.close) img.close();
      c.toBlob(function (b) {
        if (!b) { UI.toast('⚠️ Das Bild ließ sich nicht umwandeln.', 'warn'); return; }
        shot = b;
        UI.open('cphoto', head('📸 Dein Profilfoto') + '<div class="confirm cl-ask"><div class="cl-shot"><img src="' + c.toDataURL('image/jpeg', 0.86) + '" alt=""></div>' +
          '<p class="cl-fine">So sehen dich deine Freunde. Gespeichert wird nur dieses kleine Bild – und sehen dürfen es nur du und deine Freunde.</p>' +
          '<div class="row end"><button class="btn grey" data-act="ph-back">Zurück</button><button class="btn" data-act="ph-pick">Anderes Bild</button><button class="btn green" data-act="ph-up">Hochladen</button></div></div>', 'small');
      }, 'image/jpeg', 0.86);
    }).catch(function () { UI.toast('⚠️ Das ist kein Bild, das der Browser lesen kann. Probier ein JPG oder PNG.', 'warn'); AA.audio.play('error'); });
  }
  function uploadPhoto() {
    if (!shot) return;
    const b = shot; busy(true);
    C.uploadPhoto(b).then(function () {
      shot = null; AA.audio.play('sparkle'); UI.openProfile(); refreshBar(); UI.toast('📸 Foto gespeichert – deine Freunde sehen es jetzt.', 'gold');
    }, function (e) {
      busy(false);
      const m = String((e && e.message) || '');
      UI.toast('⚠️ Hochladen hat nicht geklappt' + (/size|large|groß/i.test(m) ? ' – das Bild ist zu groß.' : (/fetch|network|Zeit/i.test(m) ? ' – keine Verbindung.' : '.')), 'warn'); AA.audio.play('error');
    });
  }
  function removePhoto() {
    C.removePhoto().then(function () { UI.openProfile(); refreshBar(); UI.toast('🗑️ Foto entfernt – du bist wieder ein Fisch.'); }, function () { UI.toast('⚠️ Keine Verbindung.', 'warn'); });
  }
  function fileRow() {
    return '<div class="set"><div><b>Spielstand als Datei</b><small>Zum Aufheben oder Umziehen: als Datei sichern und woanders wieder einspielen.</small></div>' +
      '<div class="row"><button class="btn sm" data-act="pf-export">⬇️ Sichern</button><button class="btn sm grey" data-act="pf-import">⬆️ Einspielen</button></div></div>';
  }
  /* Zeile für die Einstellungen (js/ui.js) */
  UI.cloudSetting = function () {
    if (AA.visit) return '';
    let h = '';
    if (C.on) {
      h += '<div class="set"><div><b>Konto &amp; Freunde</b><small>' + (C.user ? (C.profile ? 'Angemeldet als <b>' + esc(C.profile.name) + '</b>. ' : '') + syncLine() : 'Mit Konto ist dein Aquarium gesichert und du kannst deine Familie besuchen.') + '</small></div>' +
        '<div class="row"><button class="btn" data-act="pf-open">' + (C.user ? '👥 Profil &amp; Freunde' : 'Anmelden') + '</button></div></div>';
    }
    return h + fileRow();
  };
  function addFriend() {
    const i = $('#cl-fcode'), code = String(i ? i.value : '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (code.length !== 8) { UI.toast('Der Code hat 8 Zeichen, zum Beispiel ABCD-EFGH.', 'warn'); AA.audio.play('error'); return; }
    C.addFriend(code).then(function (r) {
      if (r && !r.ok && r.error === 'self') { UI.toast('⚠️ Das ist dein eigener Code. 😄', 'warn'); AA.audio.play('error'); return; }
      if (reqResult(r) && i) i.value = '';
    }, function () { UI.toast('⚠️ Keine Verbindung.', 'warn'); });
  }
  function byId(id) { return C.friends.filter(function (f) { return String(f.id) === String(id); })[0]; }
  function visit(f) {
    if (!f || f.status !== 'accepted') return;
    if (AA.visit && AA.visit.user === f.user) return;
    waiting('Auf dem Weg zu ' + esc(f.name) + ' …');
    C.visit(f).then(function (r) {
      if (r && r.ok) return;
      UI.close();
      UI.toast(r && r.why === 'empty' ? '🫧 <b>' + esc(f.name) + '</b> hat noch kein Aquarium in der Wolke.' : (r && r.why === 'update' ? '🔄 ' + esc(f.name) + ' spielt schon mit einer neueren Version – lade die Seite neu.' : '⚠️ Der Besuch hat nicht geklappt.'), 'warn');
    }, function () { UI.close(); UI.toast('⚠️ Keine Verbindung – der Besuch muss warten.', 'warn'); });
  }

  /* ---------- Runde 20a: Freunde 2.0 – Anfragen, Suche nach @benutzername, Blockieren & Melden, Rettungs-Code ---------- */
  const WHY = { unknown: 'Diese Person gibt es nicht (mehr) – oder sie ist nicht auffindbar.', unknown_code: 'Diesen Code gibt es nicht. Stimmt jedes Zeichen?', self: 'Das bist du selbst. 😄',
    too_many: 'Du hast schon 20 offene Anfragen – warte, bis jemand antwortet.', too_many_today: 'Für heute sind es genug Anfragen – morgen geht es weiter.',
    full: 'Einer von euch hat schon 200 Freunde – mehr passen nicht in die Liste.', no_profile: 'Leg erst dein Profil an.' };
  function reqResult(r, back) {
    if (r && r.ok) {
      AA.audio.play('sparkle');
      UI.toast(r.status === 'accepted' ? '🎉 Du und <b>' + esc(r.name) + '</b> seid jetzt Freunde!' : (r.already ? 'Die Anfrage an <b>' + esc(r.name) + '</b> läuft schon.' : '📨 Anfrage an <b>' + esc(r.name) + '</b> geschickt.'), 'gold');
      return true;
    }
    UI.toast('⚠️ ' + (WHY[r && r.error] || 'Das hat nicht geklappt.'), 'warn'); AA.audio.play('error');
    return false;
  }
  /* Eingehende Anfragen: eigene Karte in der Leiste → diese Liste */
  function reqHtml() {
    const L = C.friends.filter(function (f) { return f.status === 'pending' && f.incoming; });
    return L.length ? rowsOf(L) : '<div class="cl-empty">Gerade keine offenen Anfragen. 👍</div>';
  }
  UI.openRequests = function () {
    if (!C.user) return;
    UI.open('freq', head('📨 Freundschafts-Anfragen') + '<div class="list cl-reqs"><div class="cl-friends" id="cl-reqlist">' + reqHtml() + '</div>' +
      '<p class="cl-fine">Kennst du jemanden nicht? Einfach ✕ – oder über ⋯ blockieren und melden.</p></div>', 'mid');
    UI.fillPhotos();
  };
  /* Freund finden: Suche nach @benutzername + Freundes-Code */
  let srch = { q: '', n: 0, t: 0, res: null, msg: '' };
  function srRow(u) {
    const f = C.friends.filter(function (x) { return x.user === u.user; })[0];
    const rel = f ? (f.status === 'accepted' ? 'friends' : (f.incoming ? 'in' : 'out')) : u.rel;
    const btn = rel === 'friends' ? '<span class="cl-tag ok">✔ Ihr seid Freunde</span>' : (rel === 'out' ? '<span class="cl-tag">📤 Anfrage läuft</span>'
      : (rel === 'in' && f ? '<button class="btn sm green" data-act="fr-accept" data-id="' + f.id + '">✔ Annehmen</button>' : '<button class="btn sm green" data-act="sr-add" data-id="' + esc(u.user) + '">＋ Hinzufügen</button>'));
    return '<div class="cl-friend">' + av(u.avatar) + '<div class="cl-fn"><b>' + esc(u.name) + '</b><small class="cl-handle">@' + esc(u.username) + '</small></div><div class="row">' + btn +
      '<button class="btn sm grey more" data-act="sr-more" data-id="' + esc(u.user) + '" title="Blockieren oder melden">⋯</button></div></div>';
  }
  function srHtml() {
    if (srch.msg) return '<div class="cl-empty">' + srch.msg + '</div>';
    if (!srch.res) return '<div class="cl-empty">' + (srch.q.length >= 3 ? 'Sucht …' : 'Tipp mindestens 3 Buchstaben.') + '</div>';
    if (!srch.res.length) return '<div class="cl-empty">Niemand gefunden. Stimmt die Schreibweise? (Manche lassen sich auch nicht finden – dann hilft nur der Code.)</div>';
    return srch.res.map(srRow).join('');
  }
  function srPaint() { const b = $('#cl-results'); if (b && UI.modalKind === 'fadd') { b.innerHTML = srHtml(); } }
  function srGo(now) {
    clearTimeout(srch.t);
    const i = $('#cl-search'), q = C.normUser(i ? i.value : '').replace(/^@+/, '');
    srch.q = q; srch.msg = ''; srch.res = null;
    if (q.length < 3) { srPaint(); return; }
    srPaint();
    srch.t = setTimeout(function () {
      const n = ++srch.n;
      C.searchUsers(q).then(function (r) {
        if (n !== srch.n) return;                       // inzwischen weitergetippt
        if (r && r.ok) srch.res = r.users || [];
        else srch.msg = r && r.error === 'slow' ? 'Puh, ganz schön viele Suchen – kurz durchatmen, in einer Minute geht es weiter.' : (r && r.error === 'short' ? 'Tipp mindestens 3 Buchstaben.' : 'Das hat nicht geklappt.');
        srPaint();
      }, function () { if (n === srch.n) { srch.msg = 'Gerade keine Verbindung.'; srPaint(); } });
    }, now ? 0 : 350);
  }
  UI.openFind = function () {
    if (!C.user) { after = null; UI.openLogin(); return; }
    if (!C.profile) { openOnboard(); return; }
    const p = C.profile, share = !!navigator.share;
    srch = { q: '', n: srch.n, t: 0, res: null, msg: '' };
    UI.open('fadd', head('＋ Freund finden') + '<div class="list settings cl-find">' +
      '<div class="set col"><div><b>🔍 Nach Benutzername suchen</b><small>Zum Beispiel findet <i>oma</i> auch @oma-rosi. Es erscheinen nur Name, @benutzername und Fisch.</small></div>' +
      '<input id="cl-search" class="cl-in" type="search" maxlength="30" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="@benutzername">' +
      '<div class="cl-friends cl-results" id="cl-results">' + srHtml() + '</div></div>' +
      '<div class="set"><div><b>Oder per Freundes-Code</b><small>Den Code findet jeder unter 👥 → Profil.</small></div>' +
      '<div class="row"><input id="cl-fcode" class="cl-in sm code" type="text" maxlength="9" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABCD-EFGH"><button class="btn sm green" data-act="fr-add">Anfragen</button></div></div>' +
      '<div class="set"><div><b>Dein Code</b><small>' + (p.username ? 'Oder sag einfach: Such mich als <b>@' + esc(p.username) + '</b>.' : 'Gib ihn weiter – wer ihn eintippt, schickt dir eine Anfrage.') + '</small></div>' +
      '<div class="row"><span class="cl-code sm">' + esc(C.fmtCode(p.code)) + '</span><button class="btn sm" data-act="pf-copy">Kopieren</button>' + (share ? '<button class="btn sm" data-act="pf-share">Teilen</button>' : '') + '</div></div>' +
      '</div>', 'mid');
    const i = $('#cl-search'); if (i && !UI.touch) i.focus();
  };
  function srAdd(user) {
    C.requestFriend(user).then(function (r) {
      if (reqResult(r) && srch.res) srch.res.forEach(function (u) { if (u.user === user) u.rel = r.status === 'accepted' ? 'friends' : 'out'; });
      srPaint();
    }, function () { UI.toast('⚠️ Keine Verbindung.', 'warn'); });
  }
  /* ⋯ Blockieren oder melden */
  let um = null;
  function userMenu(u, back) {
    if (!u || !u.user) return;
    um = { u: u, back: back };
    UI.open('umenu', head(esc(u.name)) + '<div class="confirm cl-ask">' + (u.username ? '<p class="cl-handle big">@' + esc(u.username) + '</p>' : '') +
      '<div class="cl-um">' + '<button class="btn" data-act="um-report" data-id="name">⚑ Namen melden</button>' + (u.photo > 0 ? '<button class="btn" data-act="um-report" data-id="photo">⚑ Foto melden</button>' : '') +
      '<button class="btn red" data-act="um-block">🚫 Blockieren</button><button class="btn grey" data-act="um-back">Zurück</button></div>' +
      '<p class="cl-fine">Blockieren: <b>' + esc(u.name) + '</b> kann dir keine Anfragen mehr schicken und findet dich nicht in der Suche – und umgekehrt. Eine Freundschaft endet dabei. Aufheben kannst du das unter 👥 → Profil. Melden geht an Damian.</p></div>', 'small');
  }
  function umBack() { const b = um && um.back; um = null; if (b === 'freq') UI.openRequests(); else if (b === 'fadd') { const keep = srch; UI.openFind(); srch = keep; const i = $('#cl-search'); if (i) i.value = keep.q; srPaint(); } else UI.openProfile(); }
  function umBlock() {
    if (!um) return; const u = um.u;
    C.blockUser(u.user).then(function (r) {
      if (r && r.ok) { AA.audio.play('pop'); if (srch.res) srch.res = srch.res.filter(function (x) { return x.user !== u.user; }); umBack(); UI.toast('🚫 <b>' + esc(u.name) + '</b> ist blockiert.'); }
      else UI.toast('⚠️ Das hat nicht geklappt.', 'warn');
    }, function () { UI.toast('⚠️ Keine Verbindung.', 'warn'); });
  }
  function umReport(why) {
    if (!um) return; const u = um.u;
    C.reportUser(u.user, why).then(function (r) {
      if (r && r.ok) { umBack(); UI.toast('⚑ Danke! Damian schaut sich das an.'); }
      else UI.toast('⚠️ ' + (r && r.error === 'too_many_today' ? 'Für heute sind es genug Meldungen.' : 'Das hat nicht geklappt.'), 'warn');
    }, function () { UI.toast('⚠️ Keine Verbindung.', 'warn'); });
  }
  /* Blockiert-Liste im Profil */
  function loadBlocks() {
    C.myBlocks().then(function (l) {
      const b = $('#cl-blocks'); if (!b) return;
      b.innerHTML = l.length ? l.map(function (u) { return '<div class="cl-friend pending">' + av(u.avatar) + '<div class="cl-fn"><b>' + esc(u.name) + '</b><small class="cl-handle">@' + esc(u.username) + '</small></div><div class="row"><button class="btn sm" data-act="bl-un" data-id="' + esc(u.user) + '">Freigeben</button></div></div>'; }).join('')
        : '<div class="cl-empty">Niemand. 😊</div>';
    }, function () { const b = $('#cl-blocks'); if (b) b.innerHTML = '<div class="cl-empty">Gerade keine Verbindung.</div>'; });
  }
  /* Rettungs-Code anzeigen (genau einmal) */
  let shownCode = '';
  function fmt12(c) { c = String(c || ''); return c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8, 12); }
  function showCode(code, renewed) {
    shownCode = fmt12(code);
    UI.open('rcode', head('🔐 Dein Rettungs-Code') + '<div class="confirm cl-ask"><p>Vergisst du mal dein Passwort, setzt du damit <b>selbst</b> ein neues – unter „Passwort vergessen?“ beim Anmelden.</p>' +
      '<div class="cl-rcode">' + esc(shownCode) + '</div><p class="cl-fine"><b>Fotografier ihn ab</b> oder schreib ihn auf – er wird nur dieses eine Mal angezeigt.' + (renewed ? ' Dein alter Code gilt nicht mehr.' : '') + '</p>' +
      '<div class="row end"><button class="btn" data-act="rc-copy">Kopieren</button><button class="btn green" data-act="close">Hab ihn notiert</button></div></div>', 'small', true);
  }
  /* nach Anmelden / erstem Profil: neuen Code zeigen – oder einmal je Gerät darauf hinweisen, dass es Rettungs-Codes gibt */
  function pendingCode() {
    const c = gate.newCode; gate.newCode = null;
    if (window.AA_NO_RCODE && c !== '' && typeof c !== 'string') return;      // Tests: kein Rettungs-Code-Fenster von allein (wie AA_NO_RITUAL)
    if (c === true) { whenFree(function () { makeCode(false); }); return; }
    if (c) { whenFree(function () { showCode(c, true); }); return; }
    const p = C.profile, key = 'aa-rc-hint-' + (C.user && C.user.id);
    if (p && p.recovery === null && C.user) {
      let seen = false; try { seen = !!localStorage.getItem(key); localStorage.setItem(key, '1'); } catch (e) { seen = true; }
      if (!seen) setTimeout(function () { UI.toast('🔐 Neu: Leg dir unter 👥 → Profil einen <b>Rettungs-Code</b> an – damit setzt du ein vergessenes Passwort selbst zurück.', 'big'); }, 4000);
    }
  }
  function makeCode(renew) {
    C.newRecoveryCode().then(function (r) {
      if (r && r.ok && r.code) showCode(r.code, renew);
      else if (renew) UI.toast('⚠️ ' + (r && r.error === 'too_many_today' ? 'Für heute sind es genug neue Codes.' : 'Das hat nicht geklappt.'), 'warn');
    }, function () { if (renew) UI.toast('⚠️ Keine Verbindung.', 'warn'); });
  }
  /* Passwort vergessen → Rettungs-Code */
  UI.openRecover = function () {
    gate.busy = false;
    UI.open('lrec', '<div class="hero cl-hero"><div class="logo">Awesome <br>Aquarium</div>' +
      '<form class="cl-box" id="cl-rform" novalidate><b>Passwort vergessen?</b><small>Mit deinem Rettungs-Code setzt du selbst ein neues. Keinen Code? Dann sag Damian Bescheid.</small>' +
      '<input id="cl-user" class="cl-in" type="text" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="24" placeholder="Benutzername" value="' + esc(gate.user || '') + '">' +
      '<input id="cl-rc" class="cl-in code" type="text" maxlength="14" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="Rettungs-Code XXXX-XXXX-XXXX">' +
      '<input id="cl-rpass" class="cl-in" type="password" name="password" autocomplete="new-password" maxlength="72" placeholder="Neues Passwort (mindestens 8 Zeichen)">' +
      '<div class="note warn hidden" id="cl-err"></div><button type="submit" class="btn green lg" id="cl-go">Neues Passwort setzen</button>' +
      '<div class="cl-links"><button type="button" class="lnk" data-act="lg-have">Zurück zum Anmelden</button></div></form></div>', 'small hero-m', !!after);
    const i = $(gate.user ? '#cl-rc' : '#cl-user'); if (i && !UI.touch) i.focus();
  };
  function recover() {
    if (gate.busy) return;
    const u = C.normUser(($('#cl-user') || {}).value), code = String(($('#cl-rc') || {}).value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(), pw = String(($('#cl-rpass') || {}).value || '');
    if (!C.validUser(u)) { err('Den Benutzernamen gibt es so nicht. Er hat 3 bis 20 Zeichen: Buchstaben, Zahlen, - und _.'); return; }
    if (code.length !== 12) { err('Der Rettungs-Code hat 12 Zeichen, zum Beispiel ABCD-EFGH-JKLM.'); return; }
    if (pw.length < 8) { err('Das neue Passwort braucht mindestens 8 Zeichen.'); return; }
    gate.user = u; err(''); busy(true);
    C.recoverPassword(u, code, pw).then(function (r) {
      if (r && r.ok && r.signed) { gate.busy = false; gate.newCode = r.code || null; waiting('Neues Passwort gesetzt – du wirst angemeldet …'); return; }
      if (r && r.ok) { busy(false); if (r.code) showCode(r.code, true); UI.toast('🔑 Neues Passwort gesetzt – melde dich jetzt damit an.', 'big'); return; }
      busy(false);
      err(r && r.error === 'slow' ? 'Zu viele Versuche. Warte eine Stunde und versuch es dann nochmal – oder frag Damian.' : (r && r.error === 'pass' ? 'Das neue Passwort braucht mindestens 8 Zeichen.' : 'Benutzername oder Rettungs-Code stimmt nicht.'));
    }, function (e) { busy(false); err(authMsg(e)); });
  }

  /* ---------- Spielstand als Datei ---------- */
  function exportFile() {
    const raw = AA.exportSave();
    if (!raw) { UI.toast('⚠️ Es gibt noch nichts zu sichern.', 'warn'); return; }
    const d = new Date(), p = function (n) { return n < 10 ? '0' + n : '' + n; };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    a.download = 'awesome-aquarium-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    UI.toast('⬇️ Spielstand gesichert (Downloads-Ordner).');
  }
  function importFile() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = function () {
      const f = inp.files && inp.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = function () { UI.importText(String(rd.result || '')); };
      rd.readAsText(f);
    };
    inp.click();
  }
  let importRaw = null;
  UI.importText = function (raw) {
    const info = AA.inspectSave(raw);
    if (!info.ok) {
      UI.toast('⚠️ ' + (info.why === 'newer' ? 'Diese Datei stammt aus einer neueren Version vom Spiel.' : 'Das ist kein Spielstand von Awesome Aquarium.'), 'warn'); AA.audio.play('error'); return;
    }
    importRaw = raw;
    UI.open('cimport', head('⬆️ Spielstand einspielen') + '<div class="confirm cl-ask"><p>In der Datei steckt ein Aquarium mit <b>Level ' + info.level + '</b>, ' + info.tanks + (info.tanks === 1 ? ' Becken' : ' Becken') + ' und ' + info.fish + ' Fischen' +
      (info.lastSeen ? ' (zuletzt gespielt ' + C.ago(info.lastSeen) + ')' : '') + '.</p><p>Soll es dein jetziges Aquarium (Level ' + AA.state.level + ') <b>ersetzen</b>? Das jetzige bleibt als Sicherung im Browser liegen.</p>' +
      '<div class="row end"><button class="btn grey" data-act="close">Abbrechen</button><button class="btn green" data-act="imp-ok">Einspielen</button></div></div>', 'small');
  };
  function importNow() {
    const r = AA.importSave(importRaw, 'import'); importRaw = null;
    if (!r.ok) { UI.toast('⚠️ Das Einspielen hat nicht geklappt' + (r.why === 'full' ? ' – der Browser-Speicher ist voll.' : '.'), 'warn'); return; }
    const m = C.meta && C.meta();
    if (m && C.user && m.uid === C.user.id) { m.dirty = true; try { localStorage.setItem('aa-cloud', JSON.stringify(m)); } catch (e) { /* egal */ } }   // der eingespielte Stand soll auch in die Wolke
    waiting('Spielstand wird eingespielt …');
    setTimeout(function () { location.reload(); }, 300);
  }

  /* ---------- Freundes-Leiste ---------- */
  function barHtml() {
    const here = AA.visit ? AA.visit.user : null;
    let h = '';
    const nIn = C.requests();      // Runde 20a: eingehende Anfragen als eine Karte ganz vorne, ausgehende stehen im Profil unter „Gesendet“
    if (!AA.visit && C.user && nIn) h += '<button class="fcard reqs" data-fb="reqs"><span class="fc-ico">📨</span><b>Anfragen (' + nIn + ')</b><small>antippen zum Antworten</small></button>';
    if (AA.visit) h += '<button class="fcard home" data-fb="home"><span class="fc-ico">🏠</span><b>Nach Hause</b><small>zu deinem Aquarium</small></button>';
    else if (C.profile) h += '<button class="fcard me" data-fb="profile">' + face(me()) + '<b>' + esc(C.profile.name) + '</b><small>Profil &amp; Code</small></button>';
    C.friends.forEach(function (f) {
      if (f.status === 'accepted') {
        h += '<button class="fcard' + (f.user === here ? ' here' : '') + '" data-fb="visit" data-id="' + f.id + '">' + face(f) + '<b>' + esc(f.name) + (UI.themeBadges ? UI.themeBadges(f.badges) : '') + '</b><small>Level ' + (f.level || 1) + ' · ' + (f.fish || 0) + ' 🐟</small>' +
          '<small class="ago">' + (f.user === here ? 'du bist hier' : (f.updated_at ? C.ago(f.updated_at) : 'noch kein Aquarium')) + '</small>' + (UI.giftBadge ? UI.giftBadge(f) : '') + '</button>';
      }
    });
    const test = UI.testCard ? UI.testCard(here) : '';      // Runde 10: Testfreund Testi (js/familyui.js)
    if (!AA.visit && C.user) h += '<button class="fcard add" data-fb="add"><span class="fc-ico">＋</span><b>Freund</b><small>hinzufügen</small></button>';
    if (!C.user) h = (AA.visit ? '<button class="fcard home" data-fb="home"><span class="fc-ico">🏠</span><b>Nach Hause</b><small>zu deinem Aquarium</small></button>' : '') + test +
      (C.on && !AA.visit ? '<button class="fcard add" data-fb="login"><span class="fc-ico">🔑</span><b>Anmelden</b><small>und Familie besuchen</small></button>' : '') +
      (!C.on && !AA.visit ? '<div class="fcard wait"><span class="fc-ico">☁️</span><b>Familie</b><small>kommt dazu, sobald das Spiel im Netz läuft</small></div>' : '');
    else h += test;
    return '<button class="fb-arrow" data-fb="left" title="zurück">◀</button><div class="fb-track" id="fb-track">' + h + '</div><button class="fb-arrow" data-fb="right" title="weiter">▶</button>';
  }
  function refreshBar() {
    const bar = $('#friends-bar'); if (!bar) return;
    const n = C.requests(), bd = $('#friends-badge');
    if (bd) { bd.textContent = n; bd.classList.toggle('hidden', !n); }
    const show = AA.visit ? true : barOpen;
    bar.classList.toggle('hidden', !show);
    $('#btn-friends').classList.toggle('active', barOpen && !AA.visit);
    if (!show) return;
    const tr = $('#fb-track'), x = tr ? tr.scrollLeft : 0;
    bar.innerHTML = barHtml();
    const t2 = $('#fb-track'); if (t2) { t2.scrollLeft = x; const over = t2.scrollWidth > t2.clientWidth + 4; bar.classList.toggle('scrolls', over); }
    UI.fillPhotos();
  }
  UI.toggleFriends = function (on) {
    barOpen = on === undefined ? !barOpen : !!on;
    refreshBar();
    if (barOpen && C.on && C.user && Date.now() - C.friendsAt > 20000) C.loadFriends().catch(function () { /* egal */ });
  };
  UI.refreshFriends = refreshBar;
  function onBar(e) {
    const b = e.target.closest('[data-fb]'); if (!b) return;
    const k = b.dataset.fb, id = b.dataset.id;
    AA.audio.play('click');
    if (k === 'left' || k === 'right') { const t = $('#fb-track'); if (t) t.scrollBy({ left: (k === 'left' ? -1 : 1) * 360, behavior: 'smooth' }); }
    else if (k === 'home') { waiting('Ab nach Hause …'); C.home(); }
    else if (k === 'profile') UI.openProfile();
    else if (k === 'add') UI.openFind();
    else if (k === 'reqs') UI.openRequests();
    else if (k === 'login') { after = null; UI.openLogin(); }
    else if (k === 'gift') { if (UI.giftFriend) UI.giftFriend(id === 'test' ? 'test' : byId(id)); }      // Runde 12: Geschenk (js/extrasui.js)
    else if (k === 'visit') visit(byId(id));
    else if (k === 'test') { if (AA.visit && AA.visit.user === AA.TEST.user) return; waiting('Testi macht die Tür auf …'); AA.visitTest(); }
    else if (k === 'accept') C.acceptFriend(+id).then(function (r) { if (r && r.ok) { AA.audio.play('sparkle'); UI.toast('🎉 Ihr seid jetzt Freunde!', 'gold'); } });
    else if (k === 'remove') C.removeFriend(+id);
  }

  /* ---------- Besuch ---------- */
  function visitUi() {
    const v = AA.visit;
    document.body.classList.add('visiting');
    $('#btn-friends').classList.add('hidden');
    const b = $('#visit-banner');
    b.innerHTML = face(v) + '<div class="vb-txt"><b>Du besuchst ' + esc(v.name) + '</b><small>Level ' + (v.level || AA.state.level) + ' · Stand ' + (v.at ? C.ago(v.at) : 'von eben') + ' · einmal am Tag darfst du helfen 🧽</small></div>' +
      (UI.visitHelpHtml ? UI.visitHelpHtml(v) : '') + '<button class="btn green" data-fb="home">🏠 Zurück nach Hause</button>';
    b.classList.remove('hidden');
    b.addEventListener('click', function (e) {
      if (e.target.closest('[data-fb="home"]')) { AA.audio.play('click'); waiting('Ab nach Hause …'); C.home(); return; }
      const hb = e.target.closest('[data-help]'); if (hb && UI.visitHelp) UI.visitHelp(hb.dataset.help, hb);      // Runde 12: füttern / putzen / schenken
    });
    refreshBar();
  }

  /* ---------- Klicks in Fenstern ---------- */
  const VISIT_OK = { close: 1, 'menu-go': 1 };
  UI.cloudClick = function (act, id, b) {
    if (AA.visit && !VISIT_OK[act]) return true;                 // zu Besuch: Fenster dürfen nichts verändern
    switch (act) {
      case 'menu-go': UI.close(); { const t = $('#' + id); if (t && (!AA.visit || id === 'btn-photo' || id === 'btn-light' || id === 'btn-sound')) t.click(); } return true;
      case 'lg-inv': switchLogin(true); return true;
      case 'lg-have': switchLogin(false); return true;
      case 'lg-forgot': keepUser(); UI.openRecover(); return true;
      case 'pw-save': savePassword(); return true;
      case 'inv-new': newInvite(); return true;
      case 'inv-copy': copy(inviteText(id)); return true;
      case 'inv-share': try { navigator.share({ title: 'Awesome Aquarium', text: inviteText(id) }).catch(function () { /* abgebrochen */ }); } catch (e) { copy(inviteText(id)); } return true;
      case 'inv-del': C.revokeInvite(id).then(function () { loadInvites(); }, function () { UI.toast('⚠️ Keine Verbindung.', 'warn'); }); return true;
      case 'ph-pick': pickPhoto(); return true;
      case 'ph-up': uploadPhoto(); return true;
      case 'ph-back': shot = null; UI.openProfile(); return true;
      case 'ph-del': removePhoto(); return true;
      case 'lg-skip': C.skip(true); UI.close(); UI.toast('👍 Du spielst ohne Konto. Anmelden kannst du dich jederzeit über 👥 oben rechts.', 'big'); proceed(); return true;
      case 'ob-av': pick = id; document.querySelectorAll('#modal .cl-av').forEach(function (x) { x.classList.toggle('active', x.dataset.id === id); }); return true;
      case 'ob-save': saveProfile(true); return true;
      case 'pf-open': UI.openProfile(); return true;
      case 'pf-save': saveProfile(false); return true;
      case 'pf-copy': copy(C.fmtCode(C.profile.code)); return true;
      case 'pf-share': try { navigator.share({ title: 'Awesome Aquarium', text: 'Mein Freundes-Code für Awesome Aquarium: ' + C.fmtCode(C.profile.code) + (location.protocol !== 'file:' ? '\n' + location.origin + location.pathname : '') }).catch(function () { /* abgebrochen */ }); } catch (e) { copy(C.fmtCode(C.profile.code)); } return true;
      case 'pf-push': AA.save(); C.push(true).then(function (ok) { UI.toast(ok ? '☁️ Gesichert.' : '⚠️ Gerade keine Verbindung – wird nachgeholt.', ok ? '' : 'warn'); const s = $('#cl-sync'); if (s) s.innerHTML = syncLine(); }); return true;
      case 'pf-logout': C.logout().then(function () { UI.close(); barOpen = false; gate.showInv = false; refreshBar(); UI.toast('👋 Abgemeldet. Dein Aquarium bleibt in der Wolke und auf diesem Gerät.', 'big'); }); return true;
      case 'pf-export': exportFile(); return true;
      case 'pf-import': importFile(); return true;
      case 'imp-ok': importNow(); return true;
      case 'fr-add': addFriend(); return true;
      case 'fr-accept': C.acceptFriend(+id).then(function (r) { if (r && r.ok) { AA.audio.play('sparkle'); UI.toast('🎉 Ihr seid jetzt Freunde!', 'gold'); } }); return true;
      case 'fr-remove': C.removeFriend(+id); return true;
      case 'fr-visit': visit(byId(id)); return true;
      case 'fr-find': UI.openFind(); return true;
      case 'fr-more': { const f = byId(id); if (f) userMenu({ user: f.user, name: f.name, username: f.username, photo: f.photo }, UI.modalKind); } return true;
      case 'sr-add': srAdd(id); return true;
      case 'sr-more': { const u = (srch.res || []).filter(function (x) { return x.user === id; })[0]; if (u) userMenu(u, 'fadd'); } return true;
      case 'um-block': umBlock(); return true;
      case 'um-report': umReport(id); return true;
      case 'um-back': umBack(); return true;
      case 'bl-un': C.unblockUser(id).then(function () { UI.toast('👍 Freigegeben.'); loadBlocks(); }, function () { UI.toast('⚠️ Keine Verbindung.', 'warn'); }); return true;
      case 'pf-search': C.setSearchable(!(C.profile && C.profile.searchable !== false)).then(function (r) { if (r && r.ok && UI.modalKind === 'profile') UI.openProfile(); }, function () { UI.toast('⚠️ Keine Verbindung.', 'warn'); }); return true;
      case 'rc-new': makeCode(!!(C.profile && C.profile.recovery)); return true;
      case 'rc-copy': copy(shownCode); return true;
      case 'ask-cloud': waiting('Dein Aquarium wird aus der Wolke geholt …'); C.resolve('cloud').then(function (ok) { if (!ok) { UI.close(); UI.toast('⚠️ Das Laden hat nicht geklappt – versuch es gleich nochmal über 👥.', 'warn'); } }); return true;
      case 'ask-local': UI.close(); C.resolve('local').then(function (ok) { UI.toast(ok ? '☁️ Das Aquarium von diesem Gerät ist jetzt in der Wolke.' : '⚠️ Gerade keine Verbindung – wird nachgeholt.', ok ? 'big' : 'warn'); }); proceed(); return true;
      case 'ask-fresh': waiting('Neues Aquarium wird eingerichtet …'); C.resolve('fresh'); return true;
      case 'ask-reload': C.resolve('reload'); return true;
      default: return false;
    }
  };
  function copy(txt) {
    const done = function () { UI.toast('📋 Kopiert: <b>' + esc(txt) + '</b>'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { fallback(); }); else fallback();
    function fallback() { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { UI.toast('Dein Code: <b>' + esc(txt) + '</b>', 'big'); } t.remove(); }
  }

  /* ---------- Menü ☰ (Handy): alles, was in der schlanken Leiste keinen Platz hat. Die Kacheln drücken einfach die echten Knöpfe. ---------- */
  const MENU = [['btn-quests', '📋', 'Aufträge', '#quest-badge'], ['btn-book', '📖', 'Sammelbuch', '#book-badge'], ['btn-office', '🏢', 'Büro', '#office-badge'], ['btn-tanks', '🗂️', 'Alle Becken', '#tanks-badge'],
    ['btn-medals', '🏅', 'Erfolge', '#medal-dot'], ['btn-gift', '🎁', 'Geschenk', '#gift-dot'], ['btn-hunt', '🧭', 'Schatzsuche', '#hunt-badge'], ['btn-photo', '📷', 'Foto', null],
    ['btn-login', '📅', 'Kalender', '#login-dot'], ['btn-rank', '🏆', 'Rangliste', null], ['btn-friends', '👥', 'Freunde', '#friends-badge'],
    ['btn-light', '🌙', 'Licht', null], ['btn-sound', '🔊', 'Ton', null], ['btn-settings', '⚙️', 'Einstellungen', null]];
  function mark(sel) {                                   // Punkt oder Zahl des echten Knopfs übernehmen
    const m = sel && $(sel); if (!m || m.classList.contains('hidden')) return '';
    if (m.classList.contains('todo')) return '';         // graue Zahl = nichts abzuholen
    return m.classList.contains('dot') ? '<i class="dot"></i>' : '<i class="badge">' + esc(m.textContent) + '</i>';
  }
  /* Im Menü steht nur, was gerade nicht als Knopf zu sehen ist (Handy: fast alles; Rechner mit enger Leiste: die seltenen Knöpfe) */
  function hiddenNow(id) { const b = $('#' + id); return !!b && (!b.offsetParent || getComputedStyle(b).display === 'none'); }
  UI.openMenu = function (all) {           // all (Taste Tab, Runde 20a): am Rechner, wo alles als Knopf da ist, trotzdem alle Kacheln
    const vis = AA.visit ? { 'btn-photo': 1, 'btn-light': 1, 'btn-sound': 1 } : null;
    let L = MENU.filter(function (m) { return vis ? vis[m[0]] && $('#' + m[0]) : hiddenNow(m[0]); });
    if (all && !vis && !L.length) L = MENU.filter(function (m) { return $('#' + m[0]); });
    UI.open('menu', head('☰ Menü') + '<div class="menu-grid">' + L.map(function (m) {
      return '<button class="menu-tile" data-act="menu-go" data-id="' + m[0] + '"><span>' + (m[0] === 'btn-sound' ? $('#btn-sound').textContent : m[1]) + '</span>' + m[2] + mark(m[3]) + '</button>';
    }).join('') + (UI.touch ? '' : '<button class="menu-tile" data-act="keys"><span>⌨️</span>Tasten</button>') + '</div>', 'mid');
  };
  function menuDot() {
    const d = $('#menu-dot'); if (!d) return;
    d.classList.toggle('hidden', AA.visit || !MENU.some(function (m) { return hiddenNow(m[0]) && mark(m[3]); }));
  }

  /* ---------- Verdrahten ---------- */
  UI.cloudInit = function () {
    UI.touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const bm = $('#btn-menu'), bf = $('#btn-friends'), bar = $('#friends-bar');
    if (bm) { bm.addEventListener('click', function () { AA.audio.play('click'); UI.openMenu(); }); setInterval(menuDot, 1000); }
    if (bf) bf.addEventListener('click', function () { AA.audio.play('click'); UI.toggleFriends(); });
    if (bar) bar.addEventListener('click', onBar);
    $('#modal').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      const k = UI.modalKind, id = e.target && e.target.id;
      if (k === 'login' || k === 'lrec') {
        const nx = k === 'lrec' ? (id === 'cl-user' ? $('#cl-rc') : (id === 'cl-rc' ? $('#cl-rpass') : null)) : (id === 'cl-user' ? $('#cl-pass') : (id === 'cl-pass' ? $('#cl-inv') : null));
        if (nx && !nx.value) { e.preventDefault(); nx.focus(); }
        return;
      }
      if (k === 'fadd' && id === 'cl-search') { e.preventDefault(); srGo(true); return; }
      if (k === 'fadd' && id === 'cl-fcode') { e.preventDefault(); UI.cloudClick('fr-add'); return; }
      const act = (k === 'onboard' ? 'ob-save' : (k === 'profile' ? (id === 'cl-fcode' ? 'fr-add' : (id === 'cl-name' ? 'pf-save' : (id === 'cl-invnote' ? 'inv-new' : (id === 'cl-newpass' ? 'pw-save' : null)))) : null));
      if (act) { e.preventDefault(); UI.cloudClick(act); }
    });
    $('#modal').addEventListener('submit', function (e) {   // Anmelde-Formular: Enter oder Knopf – nie die Seite neu laden
      e.preventDefault();
      if (e.target && e.target.id === 'cl-form' && UI.modalKind === 'login') { AA.audio.play('click'); if (gate.showInv) register(); else login(); }
      if (e.target && e.target.id === 'cl-rform' && UI.modalKind === 'lrec') { AA.audio.play('click'); recover(); }
    });
    $('#modal').addEventListener('input', function (e) {
      if (e.target.id === 'cl-user' || e.target.id === 'cl-pass') { const er = $('#cl-err'); if (er && !er.classList.contains('hidden')) err(''); }
      if (e.target.id === 'cl-fcode' || e.target.id === 'cl-inv') { const v = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8); e.target.value = v.length > 4 ? v.slice(0, 4) + '-' + v.slice(4) : v; }
      if (e.target.id === 'cl-rc') { const v = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12); e.target.value = v.replace(/(.{4})(?=.)/g, '$1-'); }
      if (e.target.id === 'cl-search') srGo(false);
      if (e.target.id === 'cl-rc' || e.target.id === 'cl-rpass') { const er = $('#cl-err'); if (er && !er.classList.contains('hidden')) err(''); }
    });
    AA.on('assets', function () { document.querySelectorAll('img.av[data-av]').forEach(function (im) { const s = AA.assets.thumb(im.dataset.av); if (im.getAttribute('src') !== s) im.src = s; }); });
    if (!C.on) return;
    AA.on('friends', function () {
      refreshBar(); const l = $('#cl-friends'); if (l && UI.modalKind === 'profile') { l.innerHTML = friendRows(); UI.fillPhotos(); }
      const q = $('#cl-reqlist'); if (q && UI.modalKind === 'freq') { q.innerHTML = reqHtml(); UI.fillPhotos(); }
      if (UI.modalKind === 'fadd') srPaint();
    });
    AA.on('photos', applyPhotos);
    AA.on('cloud', function () {
      const s = $('#cl-sync'); if (s) s.innerHTML = syncLine();
      const bf2 = $('#btn-friends'); if (bf2) { bf2.classList.toggle('warn', C.status === 'offline'); bf2.classList.toggle('out', !C.user); }
      refreshBar();
    });
    AA.on('cloudNeed', function () { whenFree(openOnboard); });
    AA.on('cloudAsk', function (q) { whenFree(function () { if (C.pending === q) openAsk(q); }); });
    AA.on('cloudReload', function () { if (UI.modalKind !== 'cwait') waiting('Dein Aquarium wird geladen …'); });
    AA.on('cloudNote', function (k) { if (k === 'saved') UI.toast('☁️ Dein Aquarium ist jetzt in deinem Konto gesichert.', 'big'); });
    AA.on('cloudLinked', function () { setTimeout(pendingCode, 400); if (UI.modalKind === 'cwait' && !C.reloading && !C.pending) UI.close(); if (!UI.modalKind) proceed(); else if (after) whenFree(function () { if (!C.reloading && !C.pending) proceed(); }); });
    setInterval(function () {                              // Freundesliste ab und zu auffrischen (neue Anfragen), solange das Spiel offen ist
      if (document.hidden || !C.user || !C.profile) return;
      if (++tickT % (barOpen || AA.visit ? 4 : 20) === 0) C.loadFriends().catch(function () { /* egal */ });
    }, 15000);
  };
})(window.AA);
