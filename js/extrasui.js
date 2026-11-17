'use strict';
/* Awesome Aquarium – Runde 12, Oberfläche: Licht-Studio (Shop → Aquarien), Pokal-Meldungen, Becken-Hilfe im Besuch, Geschenke.
   Was ohne Netz geht, läuft mit Testi; mit der Familie über js/cloud.js (help_friend, my_helps, send_gift, my_gifts, today_done).
   Merkzettel auf diesem Gerät (localStorage „aa-r12“): wem heute schon geholfen / geschenkt wurde, Belohnungen aus Besuchen (werden zu
   Hause gutgeschrieben – im Besuch ist der Spielstand des Freundes geladen und wird nicht gespeichert). */
(function (AA) {
  const UI = AA.ui, LS = 'aa-r12';
  const esc = AA.esc, fmt = function (n) { return AA.fmt ? AA.fmt(n) : String(n); };
  const HELP = { coins: 150, xp: 40 };
  function $(s) { return document.querySelector(s); }
  function store() { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { return {}; } }
  function keep(o) { try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) { /* voll: egal */ } }
  function today() { return AA.today ? AA.today() : new Date().toISOString().slice(0, 10); }
  function dayList(st, k) { const d = today(); if (!st[k] || st[k].day !== d) st[k] = { day: d, ids: [] }; return st[k].ids; }

  /* ================= Pokale ================= */
  AA.on('trophy', function (id, why) {
    const d = AA.DECO_BY[id]; if (!d) return;
    if (d.theme) { AA.save(); return; }                // Runde 19: Pokal eines Themen-Sets – das feiert js/themesui.js
    if (UI.toast) UI.toast('🏆 <b>Neuer Pokal: ' + esc(d.name) + '</b> – ' + esc(why || '') + '. Er liegt im Deko-Lager – stell ihn ins Becken und gib ein bisschen an. 😎', 'gold');
    AA.audio.play('sparkle'); AA.save();
  });

  /* ================= Licht-Studio (Shop → Aquarien) ================= */
  UI.lightCard = function () {
    const s = AA.state, t = AA.tank(), cur = t.light || 'natur';
    let h = '<div class="card wide lightstudio"><div class="pic emoji">💡</div><div class="nm">Licht-Studio <small class="tagline">für „' + esc(t.name) + '“</small></div>' +
      '<div class="info">Lichtfarbe für dieses Becken – einmal gekauft, in jedem Becken nutzbar. Zählt in die Schönheits-Note (bis +4).</div><div class="ls-grid">';
    AA.LIGHTS.forEach(function (L) {
      const own = AA.lightOwned(L.id), on = cur === L.id;
      h += '<button class="ls-btn' + (on ? ' on' : '') + (own ? '' : ' buy') + '" data-act="r12-light" data-id="' + L.id + '" title="' + esc(L.info) + '"' + (!own && s.coins < L.price ? ' disabled' : '') + '>' +
        '<span class="ls-ico">' + L.ico + '</span><b>' + esc(L.name) + '</b><small>' + (on ? '✓ an' : (own ? 'einschalten' : '🪙 ' + fmt(L.price))) + '</small></button>';
    });
    const rOwn = !!s.raysOwned, rOn = !!t.rays;
    h += '<button class="ls-btn' + (rOn ? ' on' : '') + (rOwn ? '' : ' buy') + '" data-act="r12-rays" data-id="' + (rOn ? 0 : 1) + '"' + (!rOwn && s.coins < AA.RAYS.price ? ' disabled' : '') + ' title="Kräftigere, bewegte Lichtstrahlen von oben">' +
      '<span class="ls-ico">🔦</span><b>Lichtstrahlen</b><small>' + (rOn ? '✓ an – ausschalten' : (rOwn ? 'einschalten' : '🪙 ' + fmt(AA.RAYS.price))) + '</small></button>';
    return h + '</div></div>';
  };

  /* ================= Geschenke ================= */
  function giftPool() {
    const lvl = AA.state.level;
    return AA.DECO.filter(function (d) { return !d.crawl && !d.trophy && !d.fixed && !d.unique && !d.daily && !d.prestige && d.price > 0 && d.price <= 140 && d.lvl <= lvl; });
  }
  AA.rollGift = function () {
    const r = Math.random();
    if (r < 0.06) {                                   // ganz selten: ein Ei
      const pool = AA.FISH.filter(function (f) { return !f.hybrid && !f.special && !f.ocean && !f.deep && f.lvl <= AA.state.level; });
      if (pool.length) return { kind: 'egg', item: AA.pick(pool).id, amount: 1 };
    }
    if (r < 0.34) { const p = giftPool(); if (p.length) return { kind: 'deco', item: AA.pick(p).id, amount: 1 }; }
    return { kind: 'food', item: null, amount: 8 + Math.floor(Math.random() * 13) };
  };
  function giftText(g) {
    if (g.kind === 'food') return g.amount + ' Prisen Futter 🍽️';
    if (g.kind === 'deco') return (AA.DECO_BY[g.item] ? AA.DECO_BY[g.item].name : 'ein Deko-Stück') + ' (liegt im Lager) 🪸';
    return 'ein Ei: ' + (AA.FISH_BY[g.item] ? AA.FISH_BY[g.item].name : 'Überraschung') + ' 🥚';
  }
  /* Geschenk einbuchen (zu Hause): Futter, Deko ins Lager, Ei in ein passendes Becken mit Platz (sonst Münzen) */
  AA.applyGift = function (g) {
    const s = AA.state;
    if (g.kind === 'food') { AA.addFood(Math.max(1, Math.min(50, g.amount | 0))); return giftText(g); }
    if (g.kind === 'deco' && AA.DECO_BY[g.item] && !AA.DECO_BY[g.item].trophy) { s.storage = s.storage || []; s.storage.push({ type: g.item }); AA.emit('storage'); return giftText(g); }
    if (g.kind === 'egg' && AA.FISH_BY[g.item]) {
      const def = AA.FISH_BY[g.item];
      for (let i = 0; i < s.tanks.length; i++) {
        const t = s.tanks[i];
        if (!AA.livesIn(def, t) || AA.count(t) >= AA.cap(t)) continue;
        t.eggs.push({ id: AA.uid(), sp: def.id, x: 640 + AA.rand(-200, 200), z: AA.rand(0.3, 0.8), hatch: def.hatch, total: def.hatch, gift: 1 });
        AA.emit('tankChanged');
        return giftText(g) + ' – liegt in „' + esc(t.name) + '“';
      }
      AA.addCoins(Math.round(def.price * 0.6), false);
      return 'ein Ei (' + esc(def.name) + ') – leider war kein Platz, dafür gibt es ' + fmt(Math.round(def.price * 0.6)) + ' Münzen';
    }
    AA.addFood(10); return '10 Prisen Futter 🍽️';
  };
  UI.giftBadge = function (f) {
    const id = f === 'test' ? 'test' : (f && f.user);
    if (!id || AA.visit) return '';
    const done = dayList(store(), 'gifted').indexOf(id) >= 0 || (AA.cloud && AA.cloud.done && (AA.cloud.done.gifted || []).indexOf(id) >= 0);
    return '<span class="fc-gift' + (done ? ' done' : '') + '" data-fb="gift" data-id="' + (f === 'test' ? 'test' : f.id) + '" title="' + (done ? 'Heute schon beschenkt' : 'Gratis-Geschenk schicken (einmal am Tag)') + '">' + (done ? '✓🎁' : '🎁') + '</span>';
  };
  UI.giftFriend = function (f) {
    if (!f) return;
    const st = store(), list = dayList(st, 'gifted'), id = f === 'test' ? 'test' : f.user, name = f === 'test' ? AA.TEST.name : f.name;
    if (list.indexOf(id) >= 0) { UI.toast('🎁 ' + esc(name) + ' hat heute schon ein Geschenk von dir. Morgen wieder!'); return; }
    const g = AA.rollGift();
    const done = function () {
      list.push(id); keep(st);
      AA.audio.play('chest');
      UI.toast('🎁 Geschenk an <b>' + esc(name) + '</b> ist unterwegs: ' + esc(giftText(g).replace(' (liegt im Lager)', '')) + (f === 'test' ? ' – Testi freut sich riesig. 🥰' : ''), 'love');
      if (UI.refreshFriends) UI.refreshFriends();
    };
    if (f === 'test') { done(); return; }
    const C = AA.cloud;
    if (!C || !C.user) { UI.toast('⚠️ Zum Schenken bitte anmelden (👥 Freunde).', 'warn'); return; }
    C.sendGift(f.user, g.kind, g.item, g.amount).then(function (r) {
      if (r && r.ok) done();
      else if (r && r.error === 'already') { list.push(id); keep(st); UI.toast('🎁 ' + esc(name) + ' hat heute schon ein Geschenk von dir.'); if (UI.refreshFriends) UI.refreshFriends(); }
      else UI.toast('⚠️ Das Geschenk kam nicht an.', 'warn');
    }, function () { UI.toast('⚠️ Keine Verbindung – das Geschenk muss warten.', 'warn'); });
  };

  /* ================= Becken-Hilfe (im Besuch) ================= */
  function visitId(v) { return v && (v.test ? 'test' : v.user); }
  UI.visitHelpHtml = function (v) {
    const id = visitId(v), helped = dayList(store(), 'helped').indexOf(id) >= 0, gifted = dayList(store(), 'gifted').indexOf(id) >= 0;
    if (helped) return '<span class="vb-help done">✓ Heute schon geholfen</span>' + (gifted ? '' : '<button class="btn violet sm" data-help="gift">🎁 Schenken</button>');
    return '<button class="btn blue sm" data-help="feed" title="Einmal am Tag: die Fische füttern">🍽️ Füttern</button><button class="btn blue sm" data-help="clean" title="Einmal am Tag: das Becken putzen">🧽 Putzen</button>' +
      (gifted ? '' : '<button class="btn violet sm" data-help="gift">🎁 Schenken</button>');
  };
  function helpFx(kind) {
    const V = AA.view, t = AA.tank();
    if (kind === 'feed') {
      for (let k = 0; k < 3; k++) {
        const x = 320 + k * 320 + AA.rand(-40, 40);
        for (let i = 0; i < 9; i++) V.food.push({ x: AA.clamp(x + AA.rand(-34, 34), 60, AA.W - 60), y: AA.G.top - 12 + AA.rand(-8, 8), vy: AA.rand(24, 38), ph: Math.random() * Math.PI * 2, rot: Math.random() * Math.PI * 2, col: AA.pick(['#e2772b', '#c9541e', '#f0a43a', '#d9483b']), s: AA.rand(3.4, 5.4), z: AA.rand(0.2, 1), landed: 0 });
      }
      AA.audio.play('splash');
    } else {
      for (let i = 0; i < 6; i++) setTimeout(function () { if (V.scrubFx) V.scrubFx(AA.rand(200, AA.W - 200), AA.rand(200, 520)); }, i * 120);
      t.dirt = 0; AA.audio.play('sparkle');
    }
  }
  UI.visitHelp = function (kind, btn) {
    const v = AA.visit; if (!v) return;
    if (kind === 'gift') { UI.giftFriend(v.test ? 'test' : { user: v.user, name: v.name }); setTimeout(redrawBanner, 50); return; }
    const st = store(), list = dayList(st, 'helped'), id = visitId(v);
    if (list.indexOf(id) >= 0) return;
    const ok = function () {
      list.push(id);
      st.pending = (st.pending || []).concat([{ who: v.name, kind: kind, coins: HELP.coins, xp: HELP.xp }]);
      keep(st);
      helpFx(kind);
      UI.toast((kind === 'feed' ? '🍽️ Du hast die Fische von <b>' : '🧽 Du hast das Becken von <b>') + esc(v.name) + '</b> ' + (kind === 'feed' ? 'gefüttert' : 'geputzt') + '! Dafür gibt es <b>+' + HELP.coins + ' Münzen</b> und +' + HELP.xp + ' XP – die bekommst du zu Hause.' + (v.test ? '' : ' ' + esc(v.name) + ' sieht es beim nächsten Start.'), 'gold');
      redrawBanner();
    };
    if (v.test) { ok(); return; }
    const C = AA.cloud;
    if (!C || !C.user) { UI.toast('⚠️ Zum Helpen bitte anmelden.', 'warn'); return; }
    if (btn) btn.disabled = true;
    C.helpFriend(v.user, kind).then(function (r) {
      if (r && r.ok) ok();
      else if (r && r.error === 'already') { list.push(id); keep(st); UI.toast('Du hast ' + esc(v.name) + ' heute schon geholfen. Morgen wieder! 😊'); redrawBanner(); }
      else { if (btn) btn.disabled = false; UI.toast('⚠️ Das hat nicht geklappt.', 'warn'); }
    }, function () { if (btn) btn.disabled = false; UI.toast('⚠️ Keine Verbindung.', 'warn'); });
  };
  function redrawBanner() {
    const b = $('#visit-banner'), v = AA.visit; if (!b || !v) return;
    const old = b.querySelectorAll('[data-help], .vb-help'); old.forEach(function (e) { e.remove(); });
    const home = b.querySelector('[data-fb="home"]'); if (!home) return;
    const tmp = document.createElement('div'); tmp.innerHTML = UI.visitHelpHtml(v);
    while (tmp.firstChild) b.insertBefore(tmp.firstChild, home);
  }

  /* ================= Zu Hause: Belohnungen, Testi, Hilfen und Geschenke der Familie ================= */
  function applyHelp(h) {                              // ein Freund (oder Testi) hat bei dir geholfen
    const s = AA.state, t = s.tanks[s.active] || s.tanks[0];
    AA.lastHelp = h;                                   // für Tests
    if (h.kind === 'clean') t.dirt = Math.max(0, (t.dirt || 0) - 0.6);
    else t.fish.forEach(function (f) { f.hunger = Math.max(f.hunger, 0.95); f.starve = 0; });
    UI.toast((h.kind === 'clean' ? '🧽 <b>' + esc(h.name) + '</b> hat dein Becken geputzt!' : '🍽️ <b>' + esc(h.name) + '</b> hat deine Fische gefüttert!') + ' Wie lieb. 💛', 'love');
  }
  let cloudAt = 0, busy = false;
  function homeTick() {
    const s = AA.state;
    if (!AA.ready || AA.visit || !s || !s.intro || AA.frozen) return;
    const st = store(), d = today();
    if (st.pending && st.pending.length) {                                    // Belohnungen aus Besuchen
      let c = 0, x = 0; const who = [];
      st.pending.forEach(function (p) { c += p.coins | 0; x += p.xp | 0; if (who.indexOf(p.who) < 0) who.push(p.who); });
      st.pending = []; keep(st);
      if (c) AA.addCoins(c, false); if (x) AA.addXP(x);
      UI.toast('💛 Danke fürs Helfen bei ' + who.map(esc).join(', ') + ': <b>+' + fmt(c) + ' Münzen</b>, +' + x + ' XP.', 'gold');
      AA.save();
    }
    if ((window.AA_NO_RITUAL && !window.AA_R12_AUTO) || window.AA_NO_R12) return;      // Tests: nichts von allein aufpoppen lassen (wie beim Login-Kalender)
    if (AA.testOn && AA.testOn() && st.testDay !== d) {                      // Testi kommt einmal am Tag vorbei und bringt etwas mit
      st.testDay = d; keep(st);
      setTimeout(function () {
        if (AA.visit) return;
        applyHelp({ kind: Math.random() < 0.5 ? 'clean' : 'feed', name: AA.TEST.name });
        setTimeout(function () { const g = AA.rollGift(), txt = AA.applyGift(g); UI.toast('🎁 <b>' + esc(AA.TEST.name) + '</b> hat dir ein Geschenk geschickt: ' + txt + '.', 'gold'); AA.audio.play('chest'); AA.save(); }, 2600);
        AA.save();
      }, 2500);
    }
    const C = AA.cloud;
    if (C && C.on && C.user && !busy && Date.now() - cloudAt > 10 * 60 * 1000) {      // Familie: alle 10 Minuten nachsehen
      cloudAt = Date.now(); busy = true;
      Promise.all([C.myHelps().catch(function () { return []; }), C.myGifts().catch(function () { return []; }), C.todayDone().catch(function () { return null; })]).then(function (r) {
        busy = false;
        r[0].forEach(applyHelp);
        r[1].forEach(function (g) { const txt = AA.applyGift(g); UI.toast('🎁 <b>' + esc(g.name) + '</b> hat dir ein Geschenk geschickt: ' + txt + '.', 'gold'); });
        if (r[0].length || r[1].length) { AA.audio.play('chest'); AA.save(); }
        if (UI.refreshFriends) UI.refreshFriends();
      }, function () { busy = false; });
    }
    AA.weeklyTrophy(); AA.bioTrophy();
  }
  setInterval(homeTick, 4000);

  /* ================= Neuigkeiten (einmal nach dem Update) ================= */
  UI.r12News = function (li) {
    li.push('🦦 <b>Fünf besondere Tiere</b> – nur für Perlen: Wasserfrosch, Tauch-Hamster (mit Brille und Flossen!), Fischotter, Pinguin und Seehund. Shop → ⭐ Specials.');
    li.push('🦵 <b>Beine, die sich bewegen:</b> Axolotl, Otter & Co. paddeln mit ihren Beinen, der Hamster strampelt mit den Flossen, der Pinguin rudert mit den Flügeln.');
    li.push('🦈 <b>Peitschen-Schwänze:</b> Rochen haben jetzt lange Schwänze, die wie eine Peitsche schlagen – der Fuchshai und die Süßwasser-Rochen sind neu gezeichnet.');
    li.push('🏖️ <b>Adria-Biotop:</b> Krka-Wasserfälle fürs Süßwasser, Felsküste mit Neptungras fürs Meer – dazu Drachenkopf, Petermännchen (immer grimmig), Brasse, Mittelmeer-Muräne und Hornhecht.');
    li.push('🌿 <b>13 neue Pflanzen</b>, darunter drei Riesentange fürs Meeresbecken – und der Kies wölbt sich jetzt in kleinen Dünen um alles, was drinsteht.');
    li.push('🥚 <b>Eier</b> sehen jetzt richtig aus (man sieht das Kleine wachsen), lassen sich verschieben und zeigen beim Antippen alles: Eltern, Gene, Klasse, Countdown.');
    li.push('🎞️ <b>Lebende Kulissen:</b> Offener Ozean mit Wal, Riffkante mit Schwarm, Versunkene Stadt, Dämmerungsbucht mit Quallen, Polarmeer. 🖼️ Gekaufte Hintergründe gehören dir – in jedem Becken.');
    li.push('💡 <b>Licht-Studio</b> (Shop → Aquarien): Mondlicht-Blau, Sonnenuntergang, Disco 🪩 und Lichtstrahlen – zählt in die Schönheit. 🏆 <b>Pokale</b> für die Wochen-Rangliste, volle 7-Tage-Serien und Gold-Biotope.');
    li.push('🧽 <b>Becken-Hilfe & 🎁 Geschenke:</b> Bei Besuchen einmal am Tag füttern oder putzen, jedem Freund täglich ein Gratis-Geschenk. Testi macht schon mit – die Familie, sobald das Spiel im Netz ist.');
  };

  /* ================= Klicks ================= */
  UI.r12Click = function (act, id) {
    if (act === 'r12-light') {
      const L = AA.LIGHT_BY[id], had = AA.lightOwned(id), r = AA.setLight(id);
      if (r === true) { if (!had) { AA.audio.play('chest'); UI.toast(L.ico + ' <b>' + esc(L.name) + '</b> gekauft – in jedem Becken nutzbar.', 'gold'); } else UI.toast(L.ico + ' ' + esc(L.name) + ' ist an.'); AA.save(); }
      else if (r === 'coins') UI.toast('🪙 Dafür fehlen noch Münzen.', 'warn');
      if (UI.modalKind === 'store' && UI.openStore) UI.openStore();
      return true;
    }
    if (act === 'r12-rays') {
      const r = AA.setRays(id === '1');
      if (r === true) { UI.toast(id === '1' ? '🔦 Lichtstrahlen an.' : 'Lichtstrahlen aus.'); AA.save(); }
      else if (r === 'coins') UI.toast('🪙 Dafür fehlen noch Münzen.', 'warn');
      if (UI.modalKind === 'store' && UI.openStore) UI.openStore();
      return true;
    }
    return false;
  };
})(window.AA);
