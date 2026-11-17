'use strict';
/* Awesome Aquarium – Runde 19: Themen-Sets (Oberfläche). Regeln in js/themes.js, Effekte in js/themefx.js, Daten in js/data.js.
     • Sammelbuch → Reiter „🗺️ Themen-Sets“: Übersicht (Regionen, Sammlungen, Krabbler-Alben, Meister, Familie) und Detail je Set
       (Tiere mit 📖 entdeckt · 🥚 selbst gezüchtet · 🏠 gerade ausgestellt, wo es sie gibt, Stufen mit Belohnung, Anheften, Effekt, Gold-Kulisse)
     • Titel-Reiter: Titel aus den Themen-Sets zum Tragen · Shop: Schildchen „🗺️ fehlt für …“ · Shop → Aquarien: Becken-Effekt wählen
     • Feier mit Konfetti, wenn eine Stufe geschafft ist · „Fast geschafft“-Hinweis (je Set und Stufe einmal) · angeheftetes Ziel als Chip links oben
     • Abzeichen (bis zu 3) und Goldrahmen: Freundesliste, Freundes-Leiste, Rangliste */
(function (AA) {
  const $ = AA.$, esc = AA.esc, UI = AA.ui;
  const PEARL = '<span class="pearl" title="Perlen"></span>';
  const STAGE = { 1: { ico: '⭐', name: 'Entdeckt' }, 2: { ico: '🥚', name: 'Gezüchtet' }, 4: { ico: '🏆', name: 'Ausgestellt' } };
  const KINDS = [['region', '🗺️ Regionen', 'Die Arten eines Biotops, nach Level in Kapitel geteilt.'], ['coll', '📚 Sammlungen', 'Quer durch alle Becken: Tiere mit etwas gemeinsam.'],
    ['crawl', '🦀 Krabbler-Alben', 'Für Krabbler zählt: einmal besessen = entdeckt. Alle sechs Alben ausgestellt → jeden Tag ein Gänsemarsch.'],
    ['master', '👑 Meister', 'Die großen Sammelbuch-Titel.'], ['family', '👨‍👩‍👧 Familie', 'Nur zusammen mit deinen Freunden (👥) zu schaffen.']];
  UI.themeSel = null;
  const S = function () { return AA.state; };
  const bits = function (T) { return (S().themes[T.id] | 0); };

  /* ---------- kleine Bausteine ---------- */
  function itemDef(id) { return AA.FISH_BY[id] || AA.DECO_BY[id]; }
  function itemName(id) { const d = itemDef(id); return d ? d.name : id; }
  function thumb(id) { return AA.assets.thumb(AA.FISH_BY[id] ? 'fish/' + id + '_m' : 'deco/' + id, true); }
  function where(id) {
    const f = AA.FISH_BY[id], d = f || AA.DECO_BY[id]; if (!d) return '';
    const w = AA.WATER[AA.waterOf(d)];
    if (d.season) return '🎄 nur im Winter';
    if (f && f.special) return '⭐ Specials · Lvl ' + d.lvl;
    return w.ico + ' ' + (f ? '' : 'Krabbler · ') + 'ab Lvl ' + d.lvl;
  }
  function next(T) { const b = bits(T); return AA.themeStages(T).filter(function (x) { return !(b & x); })[0] || 0; }
  function stars(T) {
    const b = bits(T);
    return '<span class="ts-stars">' + AA.themeStages(T).map(function (x) { return '<i class="' + (b & x ? 'on' : '') + '" title="' + STAGE[x].name + '">' + STAGE[x].ico + '</i>'; }).join('') + '</span>';
  }
  function rewardTxt(T, bit) {
    if (bit === 1) {
      if (T.kind === 'family' && T.id === 'fam_book') return '🛡️ Familienwappen (Abzeichen) + ' + T.pearls + ' ' + PEARL;
      const ti = T.titleId ? AA.titleById(T.titleId) : null, pe = AA.themePearls(T);
      return (T.title ? '🏅 Titel „' + esc(T.title) + '“' : (ti ? '🏅 Titel „' + esc(ti.name) + '“ (+' + ti.pearls + ' ' + PEARL + ')' : '')) + (pe ? ' + ' + pe + ' ' + PEARL : '');
    }
    if (bit === 2) return T.fx ? '✨ Becken-Effekt „' + esc(AA.THEME_FX[T.fx]) + '“' : '–';
    if (T.kind === 'region') return '🖼️ Gold-Kulisse „' + esc(AA.WALL_BY['gold_' + T.id].name) + '“ + Goldrahmen + Abzeichen';
    return '🏆 Pokal mit Set-Zeichen + Goldrahmen + Abzeichen';
  }
  function needTxt(T, bit, p) {
    if (T.kind === 'master') return 'Alle ' + p.n + ' im Sammelbuch';
    if (T.kind === 'family') return T.info;
    if (bit === 1) return T.kind === 'crawl' ? 'Alle ' + p.n + ' einmal besessen' : 'Alle ' + p.n + ' im Sammelbuch';
    if (bit === 2) return (p.need[2] < p.n ? p.need[2] + ' von ' + p.n : 'Alle ' + p.n) + ' selbst ausgebrütet (eigenes Ei geschlüpft)';
    return 'Alle ' + p.n + ' gleichzeitig ' + (T.kind === 'crawl' ? 'in deinen Becken' : 'erwachsen in deinen Becken');
  }
  function bar(v, n, cls) { const q = n ? Math.min(100, Math.round(v / n * 100)) : 0; return '<div class="bar q' + (cls ? ' ' + cls : '') + '"><i style="width:' + q + '%"></i><span>' + v + ' / ' + n + '</span></div>'; }
  function visible(T) {                                // Winterwunderland: in der Saison – oder wenn schon etwas davon da ist
    if (!T.season) return true;
    if (AA.seasonNow().xmas || bits(T)) return true;
    return AA.themeItems(T).some(function (id) { return AA.themeHas(id); });
  }

  /* ---------- Übersicht ---------- */
  function card(T, sm) {
    const p = AA.themeProgress(T, sm), nx = next(T), pin = S().pin === T.id;
    let line;
    if (!nx) line = '<div class="ts-done">✓ komplett</div>';
    else if (T.kind === 'family' && p.fam && !p.fam.online) line = '<div class="ts-sub">👥 erst anmelden &amp; Familie hinzufügen</div>' + bar(p.found, p.n);
    else line = '<div class="ts-sub">' + STAGE[nx].ico + ' ' + STAGE[nx].name + '</div>' + bar(AA.themeValue(p, nx), p.need[nx] !== undefined ? p.need[nx] : p.n);
    return '<button class="tset' + (!nx ? ' done' : '') + (pin ? ' pinned' : '') + '" data-act="tsetsel" data-id="' + T.id + '">' + (pin ? '<i class="ts-pin">📌</i>' : '') +
      '<div class="ts-ico">' + T.ico + '</div><div class="ts-main"><div class="ts-nm">' + esc(T.name) + '</div>' + stars(T) + line + '</div></button>';
  }
  function overview() {
    const s = S(), sm = AA.themeShownMap();
    let h = '<div class="sec ts-intro">🗺️ <b>Themen-Sets:</b> Tiere nach Thema sammeln – in drei Stufen. ⭐ <b>Entdeckt</b>: alle im Sammelbuch → Titel und Perlen. ' +
      '🥚 <b>Gezüchtet</b>: selbst aus dem eigenen Ei geschlüpft → ein Becken-Effekt. 🏆 <b>Ausgestellt</b>: alle gleichzeitig erwachsen in deinen Becken → Gold-Kulisse oder Pokal, Goldrahmen und ein Abzeichen.</div>';
    const own = badgeChoices();
    if (own.length) h += '<div class="ts-badges"><b>🎖️ Deine Abzeichen</b> <small>(bis zu 3 – sehen deine Freunde)</small><div class="row">' + own.map(function (T) {
      const on = s.badges.indexOf(T.id) >= 0;
      return '<button class="ts-bdg' + (on ? ' on' : '') + '" data-act="tbadge" data-id="' + T.id + '" title="' + esc(T.name) + '">' + T.ico + '</button>';
    }).join('') + '</div></div>';
    KINDS.forEach(function (K) {
      const L = AA.THEMES.filter(function (T) { return T.kind === K[0] && visible(T); });
      if (!L.length) return;
      const done = L.filter(function (T) { return !next(T); }).length;
      h += '<div class="sec ts-kind"><b>' + K[1] + '</b> <small>' + done + ' von ' + L.length + ' komplett · ' + K[2] + '</small></div><div class="ts-grid">' + L.map(function (T) { return card(T, sm); }).join('') + '</div>';
      if (K[0] === 'crawl') h += '<div class="wk-note">' + (AA.themeParade() ? '🐌 <b>Gänsemarsch freigespielt!</b> Einmal am Tag laufen deine Krabbler hintereinander durchs Becken. <button class="btn sm green" data-act="tparade">▶ Jetzt starten</button>'
        : '🐌 Sind alle sechs Krabbler-Alben ausgestellt, laufen deine Krabbler einmal am Tag im Gänsemarsch durchs Becken.') + '</div>';
    });
    return h;
  }
  function badgeChoices() {
    const s = S();
    return AA.THEMES.filter(function (T) { return ((s.themes[T.id] | 0) & 4) || (T.id === 'fam_book' && ((s.themes[T.id] | 0) & 1)); });
  }

  /* ---------- Detail eines Sets ---------- */
  function detail(T) {
    const s = S(), sm = AA.themeShownMap(), p = AA.themeProgress(T, sm), b = bits(T), lv = AA.themeLevels(T), pin = s.pin === T.id;
    let h = '<div class="ts-head"><button class="btn sm" data-act="tsetback">‹ Alle Sets</button><div class="ts-ttl"><span class="ts-big">' + T.ico + '</span><div><b>' + esc(T.name) + '</b>' +
      '<small>' + (T.kind === 'region' ? esc(AA.BIOTOPE_BY[T.bio].name) + ' · ' : '') + (lv && T.kind !== 'master' && T.kind !== 'family' ? 'Level ' + lv[0] + (lv[1] > lv[0] ? '–' + lv[1] : '') + ' · ' : '') +
      (p.n ? p.n + (T.kind === 'family' ? '' : ' Tiere') : '') + (T.season ? ' · 🎄 Winter' : '') + '</small></div></div>' + stars(T) + '</div>';
    if (T.kind === 'master' || T.kind === 'family') h += '<div class="ts-info">' + esc(T.info || '') + '</div>';
    h += '<div class="ts-stages">' + AA.themeStages(T).map(function (bit) {
      const ok = b & bit, v = AA.themeValue(p, bit), n = p.need[bit] !== undefined ? p.need[bit] : p.n;
      return '<div class="ts-stage' + (ok ? ' ok' : '') + '"><div class="ts-sico">' + STAGE[bit].ico + '</div><div class="ts-main"><b>' + STAGE[bit].name + '</b><small>' + needTxt(T, bit, p) + '</small>' +
        (ok ? '' : bar(Math.min(v, n), n)) + '<small class="ts-rw">' + (ok ? '✓ ' : '🎁 ') + rewardTxt(T, bit) + '</small></div></div>';
    }).join('') + '</div>';
    const btns = [];
    if (T.kind !== 'master' && T.kind !== 'family' && next(T)) btns.push('<button class="btn sm' + (pin ? '' : ' green') + '" data-act="tpin" data-id="' + T.id + '">' + (pin ? '📌 Ziel lösen' : '📌 Als Ziel anheften') + '</button>');
    if (T.fx && (b & 2)) btns.push('<button class="btn sm' + (AA.tank().fx === T.fx ? '' : ' green') + '" data-act="tfx" data-id="' + (AA.tank().fx === T.fx ? '' : T.fx) + '">' + (AA.tank().fx === T.fx ? '✨ Effekt ausschalten' : '✨ „' + esc(AA.THEME_FX[T.fx]) + '“ in dieses Becken') + '</button>');
    if (T.kind === 'region' && (b & 4) && AA.tank().wall !== 'gold_' + T.id) btns.push('<button class="btn sm green" data-act="twall" data-id="gold_' + T.id + '">🖼️ Gold-Kulisse aufhängen</button>');
    if (T.kind === 'master') btns.push('<button class="btn sm" data-act="booktab" data-id="titel">🏅 Zum Titel-Reiter</button>');
    if (T.kind === 'family' && !(AA.cloud && AA.cloud.on && AA.cloud.user)) btns.push('<button class="btn sm green" data-act="tprofile">👥 Familie &amp; Freunde</button>');
    if (btns.length) h += '<div class="ts-btns">' + btns.join('') + '</div>';
    if (T.kind === 'family') return h + familyList(T, p);
    if (T.kind === 'master') return h;
    h += '<div class="ts-legend">📖 entdeckt · 🥚 selbst gezüchtet · 🏠 gerade ' + (T.kind === 'crawl' ? 'in einem Becken' : 'erwachsen in einem Becken') + '</div><div class="ts-items">';
    AA.themeItems(T).forEach(function (id) {
      const f = AA.themeHas(id), br = AA.themeBred(id), sh = !!sm[id], crawl = AA.themeIsCritter(id);
      h += '<div class="ts-item' + (f ? '' : ' unknown') + '"><div class="ts-pic"><img src="' + thumb(id) + '" alt=""></div><div class="ts-inm">' + esc(itemName(id)) + '</div>' +
        '<div class="ts-st"><i class="' + (f ? 'on' : '') + '" title="' + (crawl ? 'Einmal besessen' : 'Im Sammelbuch') + '">📖</i>' + (crawl ? '' : '<i class="' + (br ? 'on' : '') + '" title="Selbst ausgebrütet">🥚</i>') +
        '<i class="' + (sh ? 'on' : '') + '" title="Gerade ausgestellt">🏠</i></div><div class="ts-where">' + where(id) + '</div></div>';
    });
    return h + '</div>';
  }
  function familyList(T, p) {
    const f = p.fam || {};
    if (T.id !== 'fam_book') return '<div class="ts-info">Zählt alles, was du seit dem Start der Familien-Funktion verschenkt bzw. bei anderen erledigt hast' + (f.online ? '.' : ' – sobald du angemeldet bist.') + '</div>';
    if (!f.online) return '<div class="ts-info">Melde dich an und füge deine Familie hinzu (👥) – dann zählt, was ihr zusammen entdeckt habt.</div>';
    const miss = (f.miss || []).slice(0, 60);
    return '<div class="ts-info">Ihr seid <b>' + f.members + '</b> in der Familie. Jede Art muss bei mindestens <b>zwei</b> von euch im Sammelbuch stehen. Es fehlen noch <b>' + (f.miss || []).length + '</b>:</div>' +
      '<div class="ts-items">' + miss.map(function (m) {
        return '<div class="ts-item' + (AA.themeHas(m.id) ? '' : ' unknown') + '"><div class="ts-pic"><img src="' + thumb(m.id) + '" alt=""></div><div class="ts-inm">' + esc(itemName(m.id)) + '</div><div class="ts-where">' + m.n + ' von 2 · ' + where(m.id) + '</div></div>';
      }).join('') + '</div>';
  }
  UI.themesBook = function () {
    const T = UI.themeSel && AA.THEME_BY[UI.themeSel];
    return T ? detail(T) : overview();
  };

  /* ---------- Titel-Reiter: Titel aus den Themen-Sets ---------- */
  const lt0 = UI.lifeTitles;
  if (lt0) UI.lifeTitles = function () {
    const s = S(), got = AA.SET_TITLES.filter(function (x) { return s.titles[x.id]; }), left = AA.SET_TITLES.length - got.length;
    const rows = got.map(function (x) {
      const on = s.title === x.id;
      return '<div class="quest title ready' + (on ? ' worn' : '') + '"><div class="q-ico">' + x.ico + '</div><div class="q-main"><div class="q-title">' + esc(x.name) + (on ? ' <small class="o-kind">dein Titel</small>' : '') + '</div>' +
        '<div class="q-desc">' + esc(x.info) + '</div></div><div class="q-act">' + (on ? '<button class="btn" disabled>✓ Getragen</button>' : '<button class="btn green" data-act="titlesel" data-id="' + x.id + '">Tragen</button>') + '</div></div>';
    }).join('');
    return lt0() + '<div class="sec">🗺️ <b>Titel aus den Themen-Sets</b> – ' + (got.length ? got.length + ' geholt' : 'noch keiner') + (left ? ', ' + left + ' warten noch' : ', alle geholt! 🎉') +
      ' <button class="lnk" data-act="booktab" data-id="sets">→ Themen-Sets</button></div>' + rows;
  };

  /* ---------- Shop: Schildchen und Becken-Effekt ---------- */
  UI.themeTag = function (id) {
    if (!AA.state || !AA.themeFor) return '';
    const r = AA.themeFor(id); if (!r) return '';
    return '<span class="tag-set" title="Fehlt dir noch für das Themen-Set „' + esc(r.T.name) + '“ (' + r.have + ' von ' + r.n + ' entdeckt)">🗺️ ' + esc(r.T.name) + ' ' + r.have + '/' + r.n + '</span>';
  };
  UI.themeFxCard = function () {
    const t = AA.tank(), own = AA.themeFxOwned(), cur = t.fx || '';
    let h = '<div class="card wide lightstudio themefx"><div class="pic emoji">✨</div><div class="nm">Becken-Effekt <small class="tagline">für „' + esc(t.name) + '“</small></div>' +
      '<div class="info">Freigespielt mit der Stufe 🥚 <b>Gezüchtet</b> der Themen-Sets (Sammelbuch → 🗺️ Themen-Sets). Je Becken ein Effekt – nur zum Anschauen.</div><div class="ls-grid">';
    h += '<button class="ls-btn' + (!cur ? ' on' : '') + '" data-act="tfx" data-id="">🚫 Aus</button>';
    AA.THEMES.forEach(function (T) {
      if (!T.fx) return;
      const ok = own.indexOf(T.fx) >= 0;
      h += '<button class="ls-btn' + (cur === T.fx ? ' on' : '') + (ok ? '' : ' locked') + '" data-act="tfx" data-id="' + T.fx + '" title="' + (ok ? esc(AA.THEME_FX[T.fx]) : 'Themen-Set „' + esc(T.name) + '“ züchten') + '"' + (ok ? '' : ' disabled') + '>' +
        (ok ? T.ico + ' ' : '🔒 ') + esc(AA.THEME_FX[T.fx]) + '</button>';
    });
    return h + '</div></div>';
  };

  /* ---------- Feiern ---------- */
  function confetti(n) {
    const box = $('#stage'); if (!box || AA.quiet) return;
    const el = document.createElement('div'); el.className = 'confetti';
    const cols = ['#ffd23f', '#ff6b9a', '#4dd6ff', '#7cf08a', '#c79bff', '#ff9f43'];
    let h = '';
    for (let i = 0; i < (n || 46); i++) {
      h += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;background:' + cols[i % cols.length] + ';animation-delay:' + (Math.random() * 0.6).toFixed(2) + 's;animation-duration:' + (1.8 + Math.random() * 1.4).toFixed(2) + 's;--r:' + Math.round(Math.random() * 720 - 360) + 'deg;--x:' + Math.round(Math.random() * 160 - 80) + 'px"></i>';
    }
    el.innerHTML = h; box.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3600);
  }
  UI.confetti = confetti;
  function winText(r) {
    const T = AA.THEME_BY[r.id]; if (!T) return '';
    const li = [];
    if (r.title) { const ti = AA.titleById(r.title); if (ti) li.push('🏅 Titel „' + esc(ti.name) + '“'); }
    if (r.pearls) li.push('+' + r.pearls + ' Perlen');
    if (r.fx) li.push('✨ Effekt „' + esc(AA.THEME_FX[r.fx]) + '“ (Shop → Aquarien)');
    if (r.wall) li.push('🖼️ ' + esc(AA.WALL_BY[r.wall].name) + ' (Shop → Aussehen)');
    if (r.trophy) li.push('🏆 Pokal im Deko-Lager');
    if (r.bit === 4 || r.id === 'fam_book') li.push('🎖️ Abzeichen');
    return T.ico + ' <b>' + STAGE[r.bit].name + ': ' + esc(T.name) + '!</b>' + (li.length ? ' – ' + li.join(' · ') : '');
  }
  let winQ = [], winT = 0;
  AA.on('theme', function (r) {
    winQ.push(r);
    if (winT) return;
    winT = setTimeout(function () {
      winT = 0;
      const L = winQ.splice(0, winQ.length);
      if (!L.length || !AA.state) return;
      confetti(L.some(function (r) { return r.bit === 4; }) ? 70 : 46);
      AA.audio.play(L.some(function (r) { return r.bit === 4; }) ? 'level' : 'win');
      L.slice(0, 3).forEach(function (r) { UI.toast(winText(r), 'big'); });
      if (L.length > 3) UI.toast('… und ' + (L.length - 3) + ' weitere Stufen – siehe Sammelbuch → 🗺️ Themen-Sets.', 'gold');
      AA.save(); UI.refresh();
      if (UI.modalKind === 'book' && UI.bookTab === 'sets') UI.openBook();
      syncPin();
    }, 120);
  });

  /* ---------- „Fast geschafft“: je Set und Stufe einmal, höchstens ein Hinweis auf einmal ---------- */
  let hintT = 0, booted = 0;
  function hint() {
    hintT = 0;
    const s = S(); if (!s || AA.visit || !s.themeTold) return;
    const L = AA.themeNear().filter(function (n) { return !s.themeTold[n.T.id + ':' + n.bit]; });
    if (!L.length) return;
    L.sort(function (a, b) { return a.left - b.left; });
    const n = L[0], st = STAGE[n.bit];
    s.themeTold[n.T.id + ':' + n.bit] = 1;
    const names = n.miss.slice(0, 2).map(function (id) { return '<b>' + esc(itemName(id)) + '</b>'; }).join(' und ');
    UI.toast(n.T.ico + ' Fast geschafft: „' + esc(n.T.name) + '“ (' + st.ico + ' ' + st.name + ') – es fehl' + (n.miss.length === 1 ? 't' : 'en') + ' nur noch ' + names + '.', 'gold');
    AA.save();
  }
  function hintSoon() { if (!booted || hintT) return; hintT = setTimeout(hint, 900); }
  ['bookNew', 'hatched', 'matured', 'fishAdded', 'decoAdded', 'storage', 'theme'].forEach(function (ev) { AA.on(ev, hintSoon); });

  /* ---------- angeheftetes Ziel: Chip links oben ---------- */
  function syncPin() {
    const stage = $('#stage'), s = AA.state;
    if (!stage || !s) return;
    let el = $('#theme-pin');
    const T = s.pin && AA.THEME_BY[s.pin], nx = T ? next(T) : 0, on = !!(T && nx && !AA.visit);
    if (!el) {
      if (!on) return;
      el = document.createElement('button'); el.id = 'theme-pin';
      el.addEventListener('click', function (e) { e.stopPropagation(); const s2 = AA.state; if (!s2 || !s2.pin) return; UI.bookSp = null; UI.bookTab = 'sets'; UI.themeSel = s2.pin; UI.bookScroll = 0; UI.openBook(); });
      stage.appendChild(el);
    }
    el.classList.toggle('hidden', !on);
    if (!on) { if (T && !nx) { delete s.pin; AA.save(); } return; }
    const p = AA.themeProgress(T), v = AA.themeValue(p, nx), n = p.need[nx], html = '<i>📌</i><span class="tp-ico">' + T.ico + '</span><span class="tp-txt"><b>' + esc(T.name) + '</b><small>' + STAGE[nx].ico + ' ' + STAGE[nx].name + ' ' + v + '/' + n + '</small></span>';
    if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; el.title = 'Dein Ziel – antippen für Details'; }
  }
  UI.syncThemePin = syncPin;

  /* ---------- Abzeichen, Titel, Goldrahmen für Freundesliste & Co. ---------- */
  UI.themeBadges = function (list) {
    if (!Array.isArray(list) || !list.length) return '';
    return '<span class="pbdg">' + list.slice(0, 3).map(function (id) { const T = AA.THEME_BY[id]; return T ? '<i title="' + esc(T.name) + '">' + T.ico + '</i>' : ''; }).join('') + '</span>';
  };
  UI.titleLine = function (id) { const ti = AA.titleById(id); return ti ? '<span class="ptitle">' + ti.ico + ' ' + esc(ti.name) + '</span>' : ''; };
  UI.myPublic = function () { const s = AA.state; return s ? { title: s.title || null, badges: (s.badges || []).slice(), gold: AA.themeGoldCount ? AA.themeGoldCount() : 0 } : {}; };

  /* ---------- Klicks ---------- */
  UI.themeClick = function (act, id) {
    const s = AA.state;
    if (act === 'tsetsel') { UI.themeSel = id; UI.bookScroll = 0; const g = $('#modal .grid.g-book'); if (g) g.scrollTop = 0; UI.openBook(); const g2 = $('#modal .grid.g-book'); if (g2) g2.scrollTop = 0; return true; }
    if (act === 'tsetback') { UI.themeSel = null; UI.openBook(); return true; }
    if (act === 'tpin') { if (s.pin === id) delete s.pin; else s.pin = id; AA.save(); syncPin(); UI.openBook(); return true; }
    if (act === 'tfx') {
      if (!AA.setTankFx(id || null)) { UI.fail('locked'); return true; }
      AA.audio.play('sparkle'); AA.save();
      UI.toast(id ? '✨ „' + esc(AA.THEME_FX[id]) + '“ läuft jetzt in „' + esc(AA.tank().name) + '“.' : '✨ Kein Effekt mehr in „' + esc(AA.tank().name) + '“.');
      if (UI.modalKind === 'book') UI.openBook(); else if (UI.modalKind === 'store' && UI.openStore) UI.openStore();
      return true;
    }
    if (act === 'twall') { const r = AA.setWall(id); if (typeof r === 'string') UI.fail(r); else { AA.audio.play('sparkle'); AA.save(); UI.toast('🖼️ „' + esc(AA.WALL_BY[id].name) + '“ hängt jetzt in „' + esc(AA.tank().name) + '“.'); UI.openBook(); } return true; }
    if (act === 'tbadge') {
      const L = s.badges.slice(), i = L.indexOf(id);
      if (i >= 0) L.splice(i, 1); else if (L.length >= 3) { UI.toast('Höchstens drei Abzeichen – nimm erst eins ab.', 'warn'); return true; } else L.push(id);
      AA.setBadges(L); AA.save(); UI.openBook(); return true;
    }
    if (act === 'tparade') {
      if (!AA.themeParade()) return true;
      UI.close();
      if (!AA.startParade()) UI.toast('🐌 Für den Gänsemarsch braucht es mindestens zwei Krabbler auf dem Kies in diesem Becken.', 'warn');
      return true;
    }
    if (act === 'tprofile') { UI.close(); if (UI.openProfile) UI.openProfile(); return true; }
    return false;
  };

  /* ---------- Start ---------- */
  UI.themesInit = function () {
    syncPin();
    setInterval(syncPin, 2500);
    setTimeout(function () { booted = 1; hint(); }, 25000);      // nach dem Laden höchstens ein Hinweis – und nicht gleich
  };
})(window.AA);
