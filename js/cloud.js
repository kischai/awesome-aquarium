'use strict';
/* Awesome Aquarium – Wolke: Konto, Cloud-Spielstand, Freunde und Besuche (Regeln und Netz; die Oberfläche dazu: js/cloudui.js).
   Läuft nur, wenn in js/config.js ein Supabase-Projekt eingetragen ist – sonst bleibt alles wie bisher rein lokal (AA.cloud.on = false).

   Grundsätze
     • Lokal zuerst: Das Spiel speichert wie immer im Browser (AA.save, alle 10 s). Die Wolke bekommt davon alle 2 Minuten und beim
       Verlassen der Seite eine Kopie. Ohne Netz spielt man einfach weiter; hochgeladen wird, sobald es wieder geht.
     • Wer hat den neueren Stand? Die Datenbank zählt je Spielstand eine Nummer hoch (rev). Dieses Gerät merkt sich, auf welcher Nummer
       es aufbaut (meta.rev) und ob es seitdem etwas geändert hat (meta.dirty):
         rev gleich                        -> alles in Ordnung, hochladen
         rev anders, hier nichts geändert  -> auf einem anderen Gerät wurde weitergespielt: Stand von dort laden
         rev anders, hier auch geändert    -> nachfragen, welcher Stand bleiben soll (nichts wird still überschrieben)
     • Der Abgleich beim Start passiert VOR dem Laden des Spielstands (C.before) – noch während „Wasser wird eingelassen“.
     • Besuch bei Freunden: Der Stand des Freundes wird geladen, in sessionStorage gelegt und die Seite neu gestartet. Im Besuch
       wird nichts gespeichert und nichts hochgeladen (AA.visit, siehe AA.save); die Datenbank würde es ohnehin ablehnen (RLS).
   Im Browser-Speicher: aa-auth (Anmeldung, von supabase-js), aa-cloud (meta), aa-cloud-skip (ohne Konto spielen), sessionStorage aa-visit. */
(function (AA) {
  const CFG = window.AA_CLOUD || {};
  const C = AA.cloud = {
    on: !!(CFG.url && CFG.key),
    user: null, profile: null, friends: [], friendsAt: 0,
    status: 'off',                 // off | out (abgemeldet) | in (angemeldet, alles gut) | sync (lädt hoch) | offline (kein Netz / Fehler)
    syncedAt: 0, pending: null, err: null, remote: null
  };
  const META = 'aa-cloud', VISIT = 'aa-visit', SKIP = 'aa-cloud-skip', AUTH = 'aa-auth', DEV = 'aa-device';
  const PUSH_GAP = 120000, CHECK_GAP = 60000;
  let sb = null, libP = null, meta = null, pushing = null, lastPush = 0, lastCheck = 0, lastTry = 0, started = false, signing = null;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function readMeta() {
    try { meta = JSON.parse(lsGet(META) || 'null'); } catch (e) { meta = null; }
    if (!meta || typeof meta !== 'object') meta = { uid: null, rev: null, dirty: false };
    return meta;
  }
  function writeMeta() { lsSet(META, JSON.stringify(meta)); }
  /* Zufallskennung dieses Browsers. Damit erkennt das Gerät seinen EIGENEN Upload wieder, wenn die Antwort darauf nicht mehr ankam
     (Seite geschlossen, während hochgeladen wurde) – das ist dann kein „auf einem anderen Gerät weitergespielt“. */
  function device() {
    let d = lsGet(DEV);
    if (!d) { d = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); lsSet(DEV, d); }
    return d;
  }
  /* Steht in der Wolke derselbe Stand, auf dem dieses Gerät aufbaut? (Der eigene, unbestätigte Upload zählt als „derselbe“.) */
  function same(info) {
    if (info.rev === meta.rev) return true;
    if (info.device && info.device === device() && meta.uid === (C.user && C.user.id)) { meta.rev = info.rev; meta.dirty = true; writeMeta(); return true; }
    return false;
  }
  function emit(name, a) { if (AA.emit) AA.emit(name || 'cloud', a); }
  function setStatus(s, err) { C.status = s; C.err = err || null; emit('cloud'); }
  C.linked = function () { return !!(C.user && meta && meta.uid === C.user.id); };
  C.skipped = function () { return lsGet(SKIP) === '1'; };
  C.skip = function (on) { lsSet(SKIP, on ? '1' : null); };
  C.meta = function () { return meta; };

  /* ---------- Bibliothek und Verbindung ---------- */
  function lib() {
    if (libP) return libP;
    libP = new Promise(function (res, rej) {
      if (window.supabase && window.supabase.createClient) { res(); return; }
      const sc = document.createElement('script');
      sc.src = 'js/vendor/supabase.js';
      sc.onload = function () { res(); };
      sc.onerror = function () { libP = null; rej(new Error('Bibliothek nicht geladen')); };
      document.head.appendChild(sc);
    }).then(function () {
      sb = window.supabase.createClient(CFG.url, CFG.key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: location.protocol !== 'file:', flowType: 'implicit', storageKey: AUTH }
      });
      sb.auth.onAuthStateChange(function (ev, ses) { setTimeout(function () { onAuth(ev, ses); }, 0); });   // nie direkt im Rückruf weitermachen (supabase-js sperrt sich sonst selbst aus)
      return sb;
    });
    return libP;
  }
  function timeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { const e = new Error('Zeitüberschreitung'); e.code = 'timeout'; rej(e); }, ms); })]); }
  function rpc(fn, args, ms) {
    return lib().then(function () { return timeout(sb.rpc(fn, args || {}), ms || 15000); }).then(function (r) {
      if (r.error) { const e = new Error(r.error.message || fn); e.code = r.error.code; e.status = r.status; throw e; }
      return r.data;
    });
  }
  C.rpc = rpc;

  /* ---------- Vor dem Laden des Spielstands: liegt in der Wolke etwas Neueres? ---------- */
  C.before = function (go) {
    let done = false;
    const fin = function () { if (!done) { done = true; go(); } };
    if (!C.on) { fin(); return; }
    readMeta();
    if (!lsGet(AUTH) && location.hash.indexOf('access_token=') < 0) { C.status = 'out'; fin(); return; }   // hier war noch nie jemand angemeldet: nicht warten
    const t = setTimeout(fin, 6000);                           // kein Netz oder zäh: mit dem lokalen Stand starten, der Abgleich kommt später
    lib().then(function () { return sb.auth.getSession(); }).then(function (r) {
      const ses = r && r.data && r.data.session;
      if (!ses) { C.status = 'out'; return null; }
      C.user = ses.user; C.status = 'in';
      if (meta.uid !== C.user.id) return null;                 // dieses Gerät gehört (noch) nicht zu diesem Konto: wird nach dem Start geklärt (link)
      return rpc('aquarium_info', {}, 5000).then(function (info) {
        C.remote = info; lastCheck = Date.now();
        if (!info || same(info)) return null;
        if (info.version > AA.SAVE_V) { C.pending = { kind: 'update' }; return null; }
        if (meta.dirty) { C.pending = { kind: 'conflict', info: info }; return null; }
        if (done) return null;                                 // das Spiel läuft schon: C.check holt es nach
        return rpc('load_aquarium', {}, 12000).then(function (a) { if (a && a.state && !done) adopt(a); });
      });
    }).catch(function (e) { C.err = e; }).then(function () { clearTimeout(t); fin(); });
  };
  /* Stand aus der Wolke wird der Stand dieses Geräts (der Aufrufer lädt danach den Spielstand bzw. die Seite neu) */
  function adopt(a, keepOld) {
    if (keepOld) { const cur = lsGet(AA.SAVE_KEY); if (cur) lsSet(AA.SAVE_KEY + '-vor-wolke', cur); }
    AA.frozen = true;                                          // das laufende Spiel darf jetzt nicht mehr dazwischenschreiben
    if (!lsSet(AA.SAVE_KEY, JSON.stringify(a.state))) { AA.frozen = false; return false; }
    meta = { uid: C.user.id, rev: a.rev, dirty: false, profile: C.profile || (meta && meta.uid === C.user.id ? meta.profile : null) || null }; writeMeta();
    if (!AA.state) AA.frozen = false;                          // vor dem Start (C.before): danach wird ganz normal geladen
    return true;
  }
  function download(keepOld) {
    return rpc('load_aquarium', {}, 20000).then(function (a) {
      if (!a || !a.state) return false;
      if (a.version > AA.SAVE_V) { ask({ kind: 'update' }); return false; }
      if (!adopt(a, keepOld)) return false;
      C.reloading = true; emit('cloudReload');
      setTimeout(function () { location.reload(); }, 60);
      return true;
    });
  }

  /* ---------- Nach dem Start ---------- */
  C.start = function () {
    if (!C.on || started) return;
    started = true;
    readMeta();
    document.addEventListener('visibilitychange', function () { if (document.hidden) C.push(); else C.check(); });
    window.addEventListener('pagehide', function () { C.push(); });
    window.addEventListener('online', function () { if (C.status === 'offline') C.check(true); });
    setInterval(function () {
      if (document.hidden || AA.visit || !C.user) return;
      if (C.status === 'offline' && Date.now() - lastTry > 30000) { C.check(true); return; }      // kein Netz gehabt: alle 30 s nachsehen, ob es wieder geht
      if (!C.linked() || !C.profile || C.pending || pushing) return;
      if (meta.dirty && Date.now() - lastPush > PUSH_GAP) C.push();
    }, 5000);
    lib().then(function () { return sb.auth.getSession(); }).then(function (r) {
      const ses = r && r.data && r.data.session;
      if (ses) return signedIn(ses.user);
      C.user = null; setStatus('out');
    }).catch(function (e) { setStatus(C.user ? 'offline' : 'out', e); });
  };
  function onAuth(ev, ses) {
    if (ev === 'SIGNED_OUT') { C.user = null; C.profile = null; C.friends = []; C.pending = null; setStatus('out'); emit('friends'); return; }
    if ((ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION') && ses && ses.user && started && (!C.user || C.user.id !== ses.user.id || !C.profile)) signedIn(ses.user);
  }
  function signedIn(user) {
    if (signing && signing.id === user.id) return signing.p;
    C.user = user; C.status = 'in'; lastTry = Date.now();
    if (!C.profile && meta && meta.uid === user.id && meta.profile) C.profile = meta.profile;   // ohne Netz: das zuletzt bekannte Profil
    const p = rpc('my_profile').then(function (pr) {
      C.profile = pr || null; emit('cloud');
      if (!pr) { emit('cloudNeed', 'profile'); return null; }   // erst Name und Avatar (js/cloudui.js), dann geht es mit C.link weiter
      if (meta.uid === user.id) { meta.profile = pr; writeMeta(); }
      return C.link();
    }).then(function () { return C.profile ? C.loadFriends() : null; })
      .catch(function (e) { setStatus('offline', e); emit('cloudLinked'); })
      .then(function () { signing = null; });
    signing = { id: user.id, p: p };
    return p;
  }
  /* Dieses Gerät und das Konto zusammenbringen: wessen Stand gilt? */
  C.link = function () {
    if (AA.visit || !C.user || !C.profile) return Promise.resolve();
    if (C.pending) { emit('cloudAsk', C.pending); emit('cloudLinked'); return Promise.resolve(); }
    return rpc('aquarium_info').then(function (info) {
      C.remote = info; lastCheck = Date.now();
      const played = !!(AA.state && AA.state.intro);
      if (meta.uid === C.user.id) {
        if (!info) { meta.dirty = true; writeMeta(); return C.push(); }
        if (info.version > AA.SAVE_V) return ask({ kind: 'update' });
        if (same(info)) { setStatus('in'); return null; }
        if (!meta.dirty) return download();
        return ask({ kind: 'conflict', info: info });
      }
      if (!info) {                                             // im Konto liegt noch nichts
        if (meta.uid && played) return ask({ kind: 'foreign' });   // hier liegt der Stand eines ANDEREN Kontos
        meta = { uid: C.user.id, rev: null, dirty: true, profile: C.profile }; writeMeta();
        return C.push().then(function (ok) { if (ok && played) emit('cloudNote', 'saved'); });
      }
      if (info.version > AA.SAVE_V) return ask({ kind: 'update' });
      if (!played) return download();                          // frisches Gerät: Stand aus der Wolke holen
      return ask({ kind: 'choose', info: info });              // hier ein Spielstand, dort ein Spielstand: fragen
    }).catch(function (e) { setStatus('offline', e); }).then(function () { emit('cloudLinked'); });   // fertig (oder es steht eine Nachfrage / ein Neuladen an)
  };
  function ask(q) { C.pending = q; emit('cloudAsk', q); return null; }
  /* Antwort auf eine Nachfrage: 'cloud' = Stand aus der Wolke nehmen, 'local' = den von diesem Gerät, 'fresh' = neu anfangen, 'reload' */
  C.resolve = function (choice) {
    const q = C.pending; C.pending = null;
    if (!q) return Promise.resolve(false);
    if (choice === 'reload' || q.kind === 'update') { location.reload(); return Promise.resolve(true); }
    if (choice === 'cloud') return download(true);
    if (choice === 'fresh') {                                  // der fremde Stand bleibt als Sicherung liegen, dieses Konto fängt neu an
      const cur = lsGet(AA.SAVE_KEY); if (cur) lsSet(AA.SAVE_KEY + '-vor-wolke', cur);
      AA.frozen = true; lsSet(AA.SAVE_KEY, null);
      meta = { uid: C.user.id, rev: null, dirty: false, profile: C.profile }; writeMeta();
      C.reloading = true; emit('cloudReload'); setTimeout(function () { location.reload(); }, 60);
      return Promise.resolve(true);
    }
    // 'local': der Stand dieses Geräts gewinnt. Was in der Wolke lag, bleibt vorher als Sicherung im Browser liegen („…-aus-wolke“).
    const keep = q.info ? rpc('load_aquarium', {}, 15000).then(function (a) { if (a && a.state) lsSet(AA.SAVE_KEY + '-aus-wolke', JSON.stringify(a.state)); }).catch(function () { /* dann ohne */ }) : Promise.resolve();
    return keep.then(function () {
      meta = { uid: C.user.id, rev: q.info ? q.info.rev : null, dirty: true, profile: C.profile }; writeMeta();
      return C.push(true);
    });
  };

  /* ---------- Hochladen ---------- */
  C.saved = function () { if (meta && C.user && meta.uid === C.user.id && !meta.dirty) { meta.dirty = true; writeMeta(); } };
  C.push = function (force, again) {
    if (!C.on || !started || AA.visit || AA.frozen || !AA.state || !C.user || !C.profile || !meta || meta.uid !== C.user.id) return Promise.resolve(false);
    if (C.pending && !force) return Promise.resolve(false);
    if (!meta.dirty && !force) return Promise.resolve(true);
    if (pushing) return pushing;
    const rev = meta.rev;
    meta.dirty = false;                                        // was ab jetzt lokal gespeichert wird, zählt wieder als neu
    AA.state.lastSeen = Date.now();
    setStatus('sync');
    pushing = rpc('save_aquarium', { p_state: AA.state, p_version: AA.SAVE_V, p_rev: rev, p_force: !!force, p_device: device() }, 30000).then(function (r) {
      pushing = null; lastPush = Date.now();
      if (r && r.ok) { meta.rev = r.rev; writeMeta(); C.syncedAt = Date.now(); setStatus('in'); return true; }
      meta.dirty = true; writeMeta(); setStatus('in');
      if (r && r.error === 'old_client') ask({ kind: 'update' });
      else if (r && r.error === 'conflict') {
        if (r.device && r.device === device() && !again) { meta.rev = r.rev; writeMeta(); return C.push(force, true); }   // unser eigener Upload von eben (z. B. zweiter Tab): einfach darauf aufbauen
        ask({ kind: 'conflict', info: r });
      }
      return false;
    }, function (e) { pushing = null; lastPush = Date.now(); meta.dirty = true; writeMeta(); setStatus('offline', e); return false; });
    return pushing;
  };
  /* Zurück im Tab (oder wieder Netz): hat inzwischen ein anderes Gerät gespeichert? */
  C.check = function (now) {
    if (!started || AA.visit || !C.user || C.pending || pushing) return Promise.resolve();
    if (C.status === 'offline' && (now || Date.now() - lastTry > 30000)) return signedIn(C.user);      // beim Start gab es kein Netz: Anmeldung, Profil und Abgleich nachholen
    if (!C.linked() || !C.profile) return Promise.resolve();
    if (!now && Date.now() - lastCheck < CHECK_GAP) return Promise.resolve();
    lastCheck = Date.now();
    const dirty = meta.dirty;                                  // Stand von JETZT: was das Spiel während der Abfrage speichert, zählt nicht als „hier geändert“
    return rpc('aquarium_info', {}, 8000).then(function (info) {
      C.remote = info;
      if (C.status === 'offline') setStatus('in');
      if (!info) return C.push();
      if (info.version > AA.SAVE_V) return ask({ kind: 'update' });
      if (same(info)) return meta.dirty && Date.now() - lastPush > PUSH_GAP ? C.push() : null;
      if (!dirty) return download();
      return ask({ kind: 'conflict', info: info });
    }).catch(function (e) { setStatus('offline', e); });
  };

  /* ---------- Anmelden mit Benutzername + Passwort (seit 14.11.2026) ----------
     Supabase braucht intern eine Mail-Adresse; wir bauen sie aus dem Benutzernamen: aq.<name>@venariai.com. An diese Adressen wird
     nie etwas geschickt („Confirm email“ ist im Projekt aus). Erlaubt: 3–20 Zeichen a–z, 0–9, - und _ (ä→ae, ö→oe, ü→ue, ß→ss,
     Leerzeichen→-). Neue Konten nur mit Einladungs- oder Familien-Code (prüft der Auth-Hook in der Datenbank). */
  const USER_DOMAIN = (window.AA_CLOUD && window.AA_CLOUD.userDomain) || 'venariai.com';
  C.normUser = function (s) {
    return String(s || '').trim().toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/\s+/g, '-');
  };
  C.validUser = function (u) { return /^[a-z0-9][a-z0-9_-]{2,19}$/.test(u); };
  function userMail(u) { return 'aq.' + u + '@' + USER_DOMAIN; }
  C.userName = function () {
    const m = /^aq\.([^@]+)@/.exec(String((C.user && C.user.email) || ''));
    return m ? m[1] : String((C.user && C.user.email) || '');
  };
  C.signIn = function (user, pass) {
    return lib().then(function () { return timeout(sb.auth.signInWithPassword({ email: userMail(C.normUser(user)), password: String(pass || '') }), 20000); })
      .then(function (r) { if (r.error) throw r.error; C.skip(false); return r.data && r.data.session; });
  };
  C.signUp = function (user, pass, invite) {
    const u = C.normUser(user);
    return lib().then(function () { return timeout(sb.auth.signUp({ email: userMail(u), password: String(pass || ''), options: { data: { invite: invite || null, username: u } } }), 20000); })
      .then(function (r) {
        if (r.error) throw r.error;
        if (!(r.data && r.data.session)) { const e = new Error('Konto angelegt, aber nicht freigeschaltet'); e.code = 'no_session'; throw e; }
        C.skip(false); return r.data.session;
      });
  };
  C.changePassword = function (pass) {
    return lib().then(function () { return timeout(sb.auth.updateUser({ password: String(pass || '') }), 20000); })
      .then(function (r) { if (r.error) throw r.error; return true; });
  };

  C.logout = function () {
    return C.push().catch(function () { return false; }).then(function () { return lib(); }).then(function () { return sb.auth.signOut({ scope: 'local' }); })
      .then(function () { C.user = null; C.profile = null; C.friends = []; Object.keys(photoCache).forEach(function (k) { delete photoCache[k]; }); setStatus('out'); emit('friends'); return true; });
  };
  C.saveProfile = function (name, avatar) {
    return rpc('save_profile', { p_name: name, p_avatar: avatar }).then(function (r) {
      if (r && r.ok) { const first = !C.profile; setProfile(r.profile); if (first) { C.link(); C.loadFriends(); } }
      return r;
    });
  };
  function setProfile(pr) { C.profile = pr; if (meta && C.user && meta.uid === C.user.id) { meta.profile = pr; writeMeta(); } emit('cloud'); }

  /* ---------- Launch: Einladungscodes (supabase/migrations/20261113120000_invites_photos.sql) ----------
     Neue Konten gibt es nur mit Code. Jeder Spieler erzeugt selbst welche (höchstens 5 offene, 30 Tage gültig); wer mit einem Code
     kommt, ist nach dem Anlegen seines Profils automatisch mit dem Einladenden befreundet. Link zum Weitergeben: <seite>/?invite=ABCD-EFGH */
  C.inviteFromUrl = function () {
    try {
      const v = new URLSearchParams(location.search).get('invite') || new URLSearchParams(location.hash.replace(/^#/, '')).get('invite') || '';
      const c = String(v).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      return c.length === 8 ? c : '';
    } catch (e) { return ''; }
  };
  C.createInvite = function (note) { return rpc('create_invite', { p_note: note || null }); };
  C.myInvites = function () { return rpc('my_invites', {}, 10000).then(function (l) { return Array.isArray(l) ? l : []; }); };
  C.revokeInvite = function (code) { return rpc('revoke_invite', { p_code: code }); };
  C.inviteLink = function (code) {
    if (location.protocol === 'file:') return '';
    return location.origin + location.pathname.replace(/[^/]*$/, '') + '?invite=' + C.fmtCode(code);      // die Startseite (Landingpage) nimmt den Code mit
  };

  /* ---------- Launch: Profilfotos ----------
     Liegen PRIVAT im Speicher-Eimer „avatars“ unter <nutzer-id>/<version>.jpg. Sehen dürfen sie nur der Besitzer und angenommene Freunde
     (RLS auf storage.objects); das Spiel holt dafür kurzlebige, signierte Links (1 Stunde) und merkt sie sich. */
  const PHOTO_TTL = 3600, photoCache = {};
  C.photoPath = function (uid, ver) { return uid + '/' + ver + '.jpg'; };
  C.photoUrl = function (uid, ver) { const c = photoCache[uid + ':' + ver]; return (c && c.url) || null; };
  C.photoUrls = function (list) {
    const now = Date.now(), need = [];
    (list || []).forEach(function (p) {
      if (!p || !p.user || !(p.photo > 0)) return;
      const k = p.user + ':' + p.photo, c = photoCache[k];
      if (c && (c.wait || (now - c.at < (c.url ? (PHOTO_TTL - 300) * 1000 : 60000)))) return;      // frisch genug (oder gerade erst nicht gefunden)
      if (need.some(function (q) { return q.user === p.user && q.photo === p.photo; })) return;
      need.push(p);
    });
    if (!need.length || !C.on || !C.user) return Promise.resolve(false);
    need.forEach(function (p) { photoCache[p.user + ':' + p.photo] = { wait: true }; });
    return lib().then(function () {
      return timeout(sb.storage.from('avatars').createSignedUrls(need.map(function (p) { return C.photoPath(p.user, p.photo); }), PHOTO_TTL), 15000);
    }).then(function (r) {
      const arr = (r && r.data) || [];
      need.forEach(function (p) {
        const e = arr.filter(function (x) { return x && x.path === C.photoPath(p.user, p.photo); })[0];
        photoCache[p.user + ':' + p.photo] = { url: (e && e.signedUrl) || null, at: Date.now() };
      });
      emit('photos'); return true;
    }, function () { need.forEach(function (p) { delete photoCache[p.user + ':' + p.photo]; }); return false; });
  };
  /* Foto hochladen (schon verkleinert: JPEG, 256 × 256). Neue Version = neuer Dateiname – so zeigt kein Zwischenspeicher das alte Bild. */
  C.uploadPhoto = function (blob) {
    if (!C.user || !C.profile) return Promise.reject(new Error('Nicht angemeldet.'));
    const uid = C.user.id, old = C.profile.photo || 0, ver = Math.max(old + 1, Math.floor(Date.now() / 1000) - 1700000000);
    return lib().then(function () { return cleanPhotos(uid, old); }).then(function () { return blob.arrayBuffer(); })
      .then(function (buf) { return timeout(sb.storage.from('avatars').upload(C.photoPath(uid, ver), buf, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' }), 30000); })
      .then(function (r) { if (r.error) throw r.error; return rpc('set_photo', { p_ver: ver }); })
      .then(function (r) {
        if (!r || !r.ok) throw new Error((r && r.error) || 'Foto');
        photoCache[uid + ':' + ver] = { url: URL.createObjectURL(blob), at: Date.now() + 864e5 };      // sofort zeigen, ohne Umweg über das Netz
        setProfile(r.profile); emit('photos');
        if (old > 0) sb.storage.from('avatars').remove([C.photoPath(uid, old)]).catch(function () { /* räumt das nächste Mal auf */ });
        return r.profile;
      });
  };
  C.removePhoto = function () {
    if (!C.user || !C.profile) return Promise.resolve(null);
    const uid = C.user.id, old = C.profile.photo || 0;
    return rpc('set_photo', { p_ver: 0 }).then(function (r) {
      if (!r || !r.ok) throw new Error((r && r.error) || 'Foto');
      setProfile(r.profile); emit('photos');
      return cleanPhotos(uid, 0).then(function () { return r.profile; });
    });
  };
  /* Alte Fotos im eigenen Ordner wegräumen (außer der Version keep) – im Eimer dürfen höchstens 3 liegen */
  function cleanPhotos(uid, keep) {
    return timeout(sb.storage.from('avatars').list(uid, { limit: 20 }), 10000).then(function (r) {
      const names = ((r && r.data) || []).map(function (o) { return o && o.name; }).filter(function (n) { return n && n !== keep + '.jpg'; });
      if (!names.length) return null;
      return timeout(sb.storage.from('avatars').remove(names.map(function (n) { return uid + '/' + n; })), 10000);
    }).catch(function () { return null; });
  }

  /* ---------- Freunde ---------- */
  C.loadFriends = function () {
    if (!C.user || !C.profile) return Promise.resolve([]);
    return rpc('my_friends').then(function (l) { C.friends = Array.isArray(l) ? l : []; C.friendsAt = Date.now(); emit('friends'); C.loadCounts(); return C.friends; });
  };
  /* Runde 19: wie oft habe ich verschenkt / bei anderen geholfen? (Familien-Sets, js/themes.js) – alte Datenbank ohne die Funktion: einfach nichts */
  C.loadCounts = function () {
    if (!C.user) return Promise.resolve(null);
    return rpc('my_social_counts', {}, 8000).then(function (r) {
      C.counts = r && typeof r === 'object' ? { gifts: Math.max(0, r.gifts | 0), helps: Math.max(0, r.helps | 0) } : null; emit('counts'); return C.counts;
    }).catch(function () { return null; });
  };
  C.requests = function () { return C.friends.filter(function (f) { return f.status === 'pending' && f.incoming; }).length; };
  C.addFriend = function (code) { return rpc('add_friend', { p_code: code }).then(function (r) { C.loadFriends().catch(function () { /* egal */ }); return r; }); };
  C.acceptFriend = function (id) { return rpc('accept_friend', { p_id: id }).then(function (r) { return C.loadFriends().then(function () { return r; }); }); };
  C.removeFriend = function (id) { return rpc('remove_friend', { p_id: id }).then(function (r) { return C.loadFriends().then(function () { return r; }); }); };
  /* Runde 12: Becken-Hilfe und Geschenke (supabase/migrations/20261112130000_help_gifts.sql) */
  C.helpFriend = function (user, kind) { return rpc('help_friend', { p_user: user, p_kind: kind }).then(function (r) { C.loadCounts(); return r; }); };
  C.myHelps = function () { return rpc('my_helps', {}, 10000).then(function (l) { return Array.isArray(l) ? l : []; }); };
  C.todayDone = function () { return rpc('today_done', {}, 8000).then(function (r) { C.done = r || { helped: [], gifted: [] }; C.doneDay = new Date().toISOString().slice(0, 10); return C.done; }); };
  C.sendGift = function (user, kind, item, amount) { return rpc('send_gift', { p_user: user, p_kind: kind, p_item: item || null, p_amount: amount || 1 }).then(function (r) { C.loadCounts(); return r; }); };
  C.myGifts = function () { return rpc('my_gifts', {}, 10000).then(function (l) { return Array.isArray(l) ? l : []; }); };

  /* ---------- Besuch ---------- */
  C.visitData = function () {
    try { const o = JSON.parse(sessionStorage.getItem(VISIT) || 'null'); return o && typeof o.raw === 'string' ? o : null; } catch (e) { return null; }
  };
  C.clearVisit = function () { try { sessionStorage.removeItem(VISIT); } catch (e) { /* egal */ } };
  C.visit = function (f) {
    return rpc('load_aquarium', { p_user: f.user }, 20000).then(function (a) {
      if (!a || !a.state) return { ok: false, why: 'empty' };
      if (a.version > AA.SAVE_V) return { ok: false, why: 'update' };
      const pack = JSON.stringify({ user: f.user, name: f.name, avatar: f.avatar, photo: f.photo || 0, at: a.updated_at, level: a.level, fish: a.fish, raw: JSON.stringify(a.state) });
      const go = function () {
        try { sessionStorage.setItem(VISIT, pack); } catch (e) { return { ok: false, why: 'storage' }; }
        AA.frozen = true; C.reloading = true; emit('cloudReload');
        setTimeout(function () { location.reload(); }, 60);
        return { ok: true };
      };
      if (AA.visit) return go();                               // von Freund zu Freund
      AA.save();                                               // vorher den eigenen Stand sichern – lokal und, wenn es klappt, in der Wolke
      return timeout(C.push(), 8000).catch(function () { return false; }).then(go);
    });
  };
  C.home = function () { C.clearVisit(); C.reloading = true; emit('cloudReload'); setTimeout(function () { location.reload(); }, 60); };
  /* Im Besuch: nur die Anmeldung und die Freundesliste, kein Abgleich */
  C.startVisit = function () {
    if (!C.on || started) return;
    started = true; readMeta();
    lib().then(function () { return sb.auth.getSession(); }).then(function (r) {
      const ses = r && r.data && r.data.session;
      if (!ses) { setStatus('out'); return null; }
      C.user = ses.user; C.status = 'in';
      return rpc('my_profile').then(function (pr) { C.profile = pr || null; emit('cloud'); return C.loadFriends(); });
    }).catch(function (e) { setStatus('offline', e); });
  };

  /* ---------- Sicherheits-Probe (für die Konsole): versucht mit dem angemeldeten Konto, an den Regeln vorbei zu schreiben ----------
     AA.cloud.attack('<user-id eines Freundes>')  ->  Liste { test, blocked, detail }. Alles muss blocked: true sein. */
  C.attack = function (victim) {
    const out = [], add = function (test, blocked, detail) { out.push({ test: test, blocked: !!blocked, detail: detail }); };
    const none = function (r) { return !!r.error || !r.data || r.data.length === 0; };
    const bogus = { v: AA.SAVE_V, level: 99, tanks: [], hacked: true };
    return lib().then(function () {
      if (!C.user) throw new Error('nicht angemeldet');
      return sb.from('aquariums').update({ state: bogus }).eq('user_id', victim).select('user_id');
    }).then(function (r) { add('fremden Spielstand überschreiben', none(r), r.error ? r.error.code + ' ' + r.error.message : (r.data || []).length + ' Zeilen');
      return sb.from('aquariums').delete().eq('user_id', victim).select('user_id');
    }).then(function (r) { add('fremden Spielstand löschen', none(r), r.error ? r.error.code : (r.data || []).length + ' Zeilen');
      return sb.from('aquariums').insert({ user_id: victim, state: bogus, version: AA.SAVE_V }).select('user_id');
    }).then(function (r) { add('Spielstand für jemand anderen anlegen', !!r.error, r.error ? r.error.code : 'angelegt!');
      return sb.from('profiles').update({ display_name: 'Gehackt' }).eq('id', victim).select('id');
    }).then(function (r) { add('fremdes Profil umbenennen', none(r), r.error ? r.error.code : (r.data || []).length + ' Zeilen');
      return sb.from('profiles').update({ friend_code: 'AAAAAAAA' }).eq('id', C.user.id).select('id');
    }).then(function (r) { add('eigenen Freundes-Code selbst festlegen', !!r.error, r.error ? r.error.code : 'geändert!');
      return sb.from('friendships').insert({ requester: C.user.id, addressee: victim, status: 'accepted' }).select('id');
    }).then(function (r) { add('Freundschaft direkt eintragen', !!r.error, r.error ? r.error.code : 'eingetragen!');
      return sb.from('friendships').update({ status: 'accepted' }).eq('requester', C.user.id).select('id');
    }).then(function (r) { add('eigene Anfrage selbst annehmen', !!r.error, r.error ? r.error.code : 'geändert!');
      return sb.from('aquariums').update({ rev: 1 }).eq('user_id', C.user.id).select('user_id');
    }).then(function (r) { add('Zähler rev selbst setzen', !!r.error, r.error ? r.error.code : 'geändert!');
      return sb.from('profiles').select('id');
    }).then(function (r) { const n = (r.data || []).length, max = 1 + C.friends.length; add('alle Profile auslesen', !!r.error || n <= max, r.error ? r.error.code : n + ' sichtbar (ich + ' + C.friends.length + ' Freunde/Anfragen)');
      if (window.console && console.table) console.table(out);
      return out;
    });
  };

  /* ---------- Anzeige ---------- */
  C.ago = function (t) {
    const ms = typeof t === 'number' ? t : Date.parse(t); if (!ms) return '';
    const s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 90) return 'gerade eben';
    if (s < 3600) return 'vor ' + Math.round(s / 60) + ' Min';
    if (s < 86400 * 2) return 'vor ' + Math.round(s / 3600) + ' Std';
    return 'vor ' + Math.round(s / 86400) + ' Tagen';
  };
  C.fmtCode = function (c) { c = String(c || ''); return c.length === 8 ? c.slice(0, 4) + '-' + c.slice(4) : c; };
})(window.AA);
