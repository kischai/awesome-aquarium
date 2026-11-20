'use strict';
/* Awesome Aquarium – Oberfläche für Runde 4: Tagesaufträge + Wochenkarte, Sammelbuch, Glitzer-Eier, dazu die Meldungen rund um
   Farbvarianten. Die Regeln dahinter stehen in js/meta.js, die Zahlen in js/data.js. */
(function (AA) {
  const $ = AA.$, esc = AA.esc, fmt = AA.fmt, UI = AA.ui, V = AA.view;
  const PEARL = '<span class="pearl" title="Perlen"></span>';
  function real(sec) { return sec / AA.speed(); }
  function longDur(sec) {                              // ab zwei Tagen in Tagen + Stunden, sonst wie überall
    if (sec < 2 * 86400) return AA.fmtDur(sec);
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600);
    return d + ' Tagen' + (h ? ' ' + h + ' Std' : '');
  }
  function head(title, extra) { return '<div class="m-head"><div class="m-title">' + title + '</div>' + (extra || '') + '<button class="x" data-act="close" title="Schließen">✕</button></div>'; }
  function coin() { return '<img class="ic" src="' + AA.assets.src('prop/coin') + '" alt="Münzen">'; }
  function rewardTxt(r) {
    const a = [];
    if (r.coins) a.push('+' + fmt(r.coins) + ' ' + coin());
    if (r.xp) a.push('+' + fmt(r.xp) + ' XP');
    if (r.pearls) a.push('+' + r.pearls + ' ' + PEARL);
    return a.join(' · ');
  }
  function rewardPlain(r) {
    const a = [];
    if (r.coins) a.push('+' + fmt(r.coins) + ' Münzen');
    if (r.xp) a.push('+' + fmt(r.xp) + ' XP');
    if (r.pearls) a.push('+' + r.pearls + (r.pearls === 1 ? ' Perle' : ' Perlen'));
    return a.join(', ');
  }
  function varChip(v, small) { const d = AA.VAR_BY[v]; return d ? '<span class="vchip' + (small ? ' sm' : '') + ' t' + d.tier + '" style="--vc:' + d.col + '">✨ ' + esc(d.name) + '</span>' : ''; }
  UI.varChip = varChip;

  /* ================= Tagesaufträge + Wochenkarte ================= */
  function questsHtml() {
    const s = AA.state, L = AA.questList(), W = AA.weekInfo();
    const rows = L.map(function (q) {
      const p = Math.round(q.cur / q.need * 100);
      let act;
      if (q.got) act = '<span class="done">✓ Abgeholt</span>';
      else if (q.done) act = '<button class="btn green" data-act="qclaim" data-id="' + q.i + '">Abholen</button>';
      else act = '<span class="prog">' + fmt(q.cur) + ' / ' + fmt(q.need) + '</span>';
      return '<div class="quest daily' + (q.done && !q.got ? ' ready' : '') + (q.got ? ' claimed' : '') + '"><div class="q-ico">' + q.def.ico + '</div><div class="q-main"><div class="q-title">' + esc(q.text) + '</div>' +
        '<div class="bar q"><i style="width:' + p + '%"></i></div></div><div class="q-act">' + act + '<small>' + rewardTxt(q) + '</small></div></div>';
    }).join('');
    const nGot = L.filter(function (q) { return q.got; }).length;
    const bonus = '<div class="q-bonus' + (s.quests && s.quests.bonus ? ' got' : '') + '">' + (s.quests && s.quests.bonus ? '✓ Alle drei geschafft: Perle kassiert und Stempel auf der Wochenkarte.' :
      'Alle drei abholen = <b>+' + AA.QUEST_BONUS.pearls + ' ' + PEARL + '</b> und ein <b>Stempel</b> für die Wochenkarte. (' + nGot + ' von ' + L.length + ')') + '</div>';
    // Wochenkarte: sieben Felder, gestempelte Tage, heute markiert
    let cells = '';
    for (let i = 0; i < 7; i++) cells += '<div class="stamp' + (W.days.indexOf(i) >= 0 ? ' on' : '') + (i === W.dayIdx ? ' today' : '') + (i < W.dayIdx && W.days.indexOf(i) < 0 ? ' miss' : '') + '"><span>' + (W.days.indexOf(i) >= 0 ? '⭐' : (i + 1)) + '</span></div>';
    const rew = W.rewards.map(function (r) {
      const ic = r.def.glitterBig ? '🥚✨✨' : (r.def.glitter ? '🥚✨' : '');
      const what = (ic ? ic + ' ' : '') + (r.def.glitterBig ? 'Großes Glitzer-Ei' : (r.def.glitter ? 'Glitzer-Ei' : '')) + (r.def.pearls ? ((r.def.glitter || r.def.glitterBig ? ' + ' : '') + r.def.pearls + ' ' + PEARL) : '');
      return '<div class="wk-rew' + (r.got ? ' got' : (r.ready ? ' ready' : '')) + '"><b>' + r.at + ' ⭐</b><span>' + what + '</span>' +
        (r.got ? '<i>✓</i>' : (r.ready ? '<button class="btn green sm" data-act="wclaim" data-id="' + r.at + '">Abholen</button>' : '<i>' + W.stamps + ' / ' + r.at + '</i>')) + '</div>';
    }).join('');
    const week = '<div class="weekcard"><div class="wk-top"><b>📅 Wochenkarte</b><small>Tag ' + (W.dayIdx + 1) + ' von 7 · neue Karte in <span id="wk-left">' + longDur(real(W.left)) + '</span></small></div><div class="stamps">' + cells + '</div><div class="wk-rews">' + rew + '</div>' +
      '<div class="wk-note">Im <b>Glitzer-Ei</b> steckt sicher eine Farbvariante – du suchst die Art aus, und bevorzugt schlüpft eine, die dir im Sammelbuch noch fehlt. Im großen mindestens „Sehr selten“.</div></div>';
    let gl = '';
    if (s.glitter > 0 || s.glitterBig > 0) {
      gl = '<div class="quest ready glit"><div class="q-ico">🥚</div><div class="q-main"><div class="q-title">✨ Du hast ' + (s.glitter ? s.glitter + (s.glitter === 1 ? ' Glitzer-Ei' : ' Glitzer-Eier') : '') + (s.glitter && s.glitterBig ? ' und ' : '') +
        (s.glitterBig ? s.glitterBig + (s.glitterBig === 1 ? ' großes Glitzer-Ei' : ' große Glitzer-Eier') : '') + '</div><div class="q-desc">Es kommt in das Becken, das du gerade ansiehst (' + AA.WATER[AA.tank().water].ico + ' ' + esc(AA.tank().name) + ').</div></div><div class="q-act">' +
        (s.glitterBig ? '<button class="btn violet" data-act="glit" data-id="big">Großes einlösen</button>' : '') + (s.glitter ? '<button class="btn green" data-act="glit" data-id="std"' + (s.glitterBig ? ' style="margin-top:6px"' : '') + '>Einlösen</button>' : '') + '</div></div>';
    }
    return head('📋 Tagesaufträge', '<div class="m-coins"><small>Neue Aufträge in <b id="q-left">' + AA.fmtShort(real(AA.dayLeft())) + '</b></small></div>') + '<div class="list">' + gl + rows + bonus + week + '</div>';
  }
  /* Kennung dessen, was der Dialog gerade zeigt – ändert sie sich im Hintergrund (Fortschritt, neuer Tag), wird neu aufgebaut */
  function questSig() {
    const s = AA.state, W = AA.weekInfo();
    return AA.questList().map(function (q) { return q.def.id + q.cur + (q.got ? 'g' : ''); }).join('|') + '#' + s.quests.day + '#' + W.stamps + '#' + W.start + '#' + s.week.got.join(',') + '#' + s.glitter + '#' + s.glitterBig + '#' + s.active + '#' + AA.speed();
  }
  UI.openQuests = function () {
    const l = $('#modal .list'), sc = UI.modalKind === 'quests' && l ? l.scrollTop : 0;
    UI._qSig = questSig();
    UI.open('quests', questsHtml(), 'mid');
    const l2 = $('#modal .list'); if (l2) l2.scrollTop = sc;
  };

  /* Glitzer-Ei: Art aussuchen */
  function glitterHtml(big) {
    const t = AA.tank(), sp = AA.glitterSpecies(t), full = AA.count(t) >= AA.cap(t), minTier = big ? 2 : 1;
    let body;
    if (full) body = '<p>„' + esc(t.name) + '“ ist voll – ein Ei braucht einen freien Platz. Wechsle in ein anderes Becken oder mach Platz.</p><div class="row end"><button class="btn grey" data-act="quests">Zurück</button></div>';
    else if (!sp.length) body = '<p>Für ' + AA.WATER[t.water].name + ' hast du noch keine Art im Sammelbuch. Wechsle in ein anderes Becken oder kauf hier erst einen Fisch.</p><div class="row end"><button class="btn grey" data-act="quests">Zurück</button></div>';
    else body = '<p>Welche Art soll schlüpfen? Das Ei kommt nach „' + esc(t.name) + '“ (' + AA.WATER[t.water].ico + ' ' + AA.WATER[t.water].name + ') und braucht so lange wie ein normales Ei der Art.' +
      (big ? ' <b>Großes Glitzer-Ei:</b> mindestens „Sehr selten“.' : '') + '</p><div class="pick sp">' + sp.map(function (f) {
        const have = (AA.state.book[f.id] || { v: {} }).v, cand = AA.variantsOf(f.id).filter(function (v) { return v.tier >= minTier; }), miss = cand.filter(function (v) { return !have[v.id]; }).length;
        return '<button class="pickfish" data-act="glitpick" data-id="' + f.id + '" data-big="' + (big ? 1 : 0) + '"><img src="' + AA.assets.thumb('fish/' + f.id + '_b') + '" alt=""><span>' + esc(f.name) + '</span><small>' + (miss ? miss + ' fehl' + (miss === 1 ? 't' : 'en') + ' noch' : 'alle entdeckt') + '</small></button>';
      }).join('') + '</div>';
    return head(big ? '🥚✨✨ Großes Glitzer-Ei' : '🥚✨ Glitzer-Ei') + '<div class="confirm">' + body + '</div>';
  }

  /* ================= Sammelbuch ================= */
  UI.bookTab = 'all'; UI.bookSp = null; UI.bookForm = ''; UI.bookSex = 'm';
  UI.bookQ = ''; UI.bookWhere = false;               // Runde 20g: Suche im Sammelbuch, Kasten „Wo bekomme ich das?“
  function bnorm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function bookFilter() {
    const g = $('#modal .grid.g-book'); if (!g || UI.bookSp) return;
    const words = bnorm(UI.bookQ).split(/\s+/).filter(Boolean);
    let n = 0;
    g.querySelectorAll('.bcard').forEach(function (c) { const ok = words.every(function (w) { return (c.dataset.q || '').indexOf(w) >= 0; }); c.classList.toggle('q-hide', !ok); if (ok) n++; });
    let none = g.querySelector('.q-none');
    if (words.length && !n) { if (!none) { none = document.createElement('div'); none.className = 'sec q-none'; g.appendChild(none); } none.textContent = '🔍 Keine Art gefunden.'; }
    else if (none) none.parentNode.removeChild(none);
  }
  /* „Wo bekomme ich das?“ – Weg zur Art (bzw. zur gewählten Farbvariante/Zuchtform) in Worten, dazu ein Knopf in den Shop */
  function whereBox(sp, v) {
    const s = AA.state, f = AA.FISH_BY[sp], t = AA.tank(), W = AA.WATER[AA.waterOf(f)], li = [];
    let go = null;
    if (v) {
      const F = AA.FORMS && AA.FORMS[sp], d = AA.VAR_BY[v];
      if (F) { let tot = 0; for (const k in F.roll) tot += F.roll[k]; li.push('✨ <b>' + esc(d.name) + '</b> ist eine Zuchtform: Sie schlüpft nur aus Eiern von ' + esc(f.name) + ' – jedes Ei würfelt seine Form (' + Math.round((F.roll[v] || 0) / tot * 100) + ' %).'); }
      else li.push('✨ <b>' + esc(d.name) + '</b> schlüpft nur aus Eiern: ' + esc(f.name) + ' züchten (♂ + ♀). Eltern mit dieser Farbe geben sie oft weiter, Farbfutter 🌈 verdoppelt die Chance, und das Glitzer-Ei von der Wochenkarte hilft auch.');
    }
    if (f.hybrid) li.push('🧬 Nur durch Kreuzen: <b>' + esc(AA.FISH_BY[f.hybrid[0]].name) + '</b> × <b>' + esc(AA.FISH_BY[f.hybrid[1]].name) + '</b> – ein erwachsenes ♂ der einen und ein ♀ der anderen Art im selben Becken, dann im Zuchtplaner kreuzen (ab Level ' + f.lvl + ').');
    else if (f.season) li.push('🎄 Gibt es nur in der Weihnachtszeit (1. Dezember bis 6. Januar): Shop → Weihnachten.');
    else if (f.special) { li.push('⭐ Shop → Specials, für <b>' + fmt(f.pearls) + ' Perlen</b>, ab Level ' + f.lvl + '.'); go = 'special'; }
    else { li.push('🛒 Shop → Fische, ab Level ' + f.lvl + ' für <b>' + fmt(AA.priceOf ? AA.priceOf(f) : f.price) + ' Münzen</b>' + (f.pearls ? ' oder ' + fmt(f.pearls) + ' Perlen' : '') + '.'); go = 'fish'; }
    if (f.sterile) li.push('🚫 Lässt sich nicht züchten – nur kaufen.');
    const why = AA.whyNot(f, t);
    li.push(W.ico + ' Lebt im ' + W.name + (f.ocean ? ', nur im Meeresbecken' : (f.deep === 1 ? ', nur im Tiefsee-Becken' : (f.big ? ', braucht ein großes Becken' : ''))) + ' – ' + (why ? 'passt <b>nicht</b> in „' + esc(t.name) + '“.' : 'passt in „' + esc(t.name) + '“.'));
    if (s.level < f.lvl) li.push('🔒 Du bist Level ' + s.level + ' – noch ' + (f.lvl - s.level) + (f.lvl - s.level === 1 ? ' Level.' : ' Level.'));
    const sets = (AA.THEMES || []).filter(function (T) { return (T.kind === 'region' || T.kind === 'coll') && AA.themeItems(T).indexOf(sp) >= 0; }).map(function (T) { return T.ico + ' ' + esc(T.name); });
    if (sets.length) li.push('🗺️ Gehört zu: ' + sets.join(', ') + '.');
    return '<div class="bwhere">' + li.map(function (x) { return '<div>' + x + '</div>'; }).join('') +
      (go ? '<div class="row"><button class="btn green sm" data-act="bookshop" data-id="' + go + '" data-q="' + esc(f.name) + '">🛒 Im Shop zeigen</button></div>' : '') + '</div>';
  }
  function dots(sp) {
    const b = AA.state.book[sp];
    return '<div class="vdots">' + AA.variantsOf(sp).map(function (v) { const st = b ? b.v[v.id] || 0 : 0; return '<i class="' + (st ? 'on' : '') + (st === 1 ? ' new' : '') + '" style="--vc:' + v.col + '" title="' + esc(v.name) + ' · ' + v.rare + (st ? '' : ' – noch nicht entdeckt') + '"></i>'; }).join('') + '</div>';
  }
  function bookGrid() {
    const s = AA.state, C = AA.bookCounts();
    const list = AA.FISH.filter(function (f) { return UI.bookTab === 'all' || (UI.bookTab === 'hyb' ? !!f.hybrid : (UI.bookTab === 'var' ? (s.book[f.id] && AA.keys(s.book[f.id].v) > 0) : AA.waterOf(f) === UI.bookTab)); });
    const cards = list.map(function (f) {
      const b = s.book[f.id], open = b ? (b.n === 1 ? 1 : 0) + Object.keys(b.v).filter(function (k) { return b.v[k] === 1; }).length : 0, full = AA.setComplete ? AA.setComplete(f.id) : (b && AA.keys(b.v) === AA.VARIANTS.length);
      return '<button class="bcard' + (b ? '' : ' unknown') + (open ? ' hasnew' : '') + (full ? ' full' : '') + '" data-act="booksp" data-id="' + f.id + '" data-q="' + esc(bnorm(f.name + ' ' + (f.hybrid ? 'hybrid' : ''))) + '">' +
        (open ? '<i class="ribbon">' + (open > 1 ? open + ' neu' : 'Neu') + '</i>' : '') + (full ? '<i class="crown" title="Set komplett: alle Farbvarianten entdeckt – jeder Fisch dieser Art ist ' + Math.round(((AA.SETBONUS || 1.1) - 1) * 100) + ' % mehr wert">👑</i>' : '') +
        '<div class="bpic' + (f.inv ? ' inv' : '') + '"><img src="' + AA.assets.thumb('fish/' + f.id + '_m', true) + '" alt=""></div><div class="bnm">' + (b ? esc(f.name) : '???') + '</div>' +
        (b ? dots(f.id) : '<div class="blvl">' + (f.hybrid ? '🧬 ' + esc(AA.FISH_BY[f.hybrid[0]].name) + ' × ' + esc(AA.FISH_BY[f.hybrid[1]].name) : AA.WATER[AA.waterOf(f)].ico + ' ab Level ' + f.lvl) + '</div>') + '</button>';
    }).join('');
    const TABS = [['all', 'Alle'], ['salt', '🌊 Meerwasser'], ['fresh', '🌿 Süßwasser'], ['var', '✨ Mit Varianten'], ['hyb', '🧬 Hybride'], ['sets', '🗺️ Themen-Sets'], ['titel', '🏅 Titel']];
    const ttl = AA.titleOf ? AA.titleOf() : null;
    const pS = Math.round(C.species / C.speciesMax * 100), pV = Math.round(C.vars / C.varsMax * 100);
    return head('📖 Sammelbuch', '<div class="m-coins book">' + (ttl ? '<span class="ttl" title="Dein Titel – wählbar im Reiter Titel">' + ttl.ico + ' ' + esc(ttl.name) + '</span>' : '') + '<span title="Arten entdeckt">🐟 <b>' + C.species + '</b> / ' + C.speciesMax + '</span><span title="Farbvarianten entdeckt">✨ <b>' + C.vars + '</b> / ' + C.varsMax + '</span></div>') +
      '<div class="bprog"><div><small>Arten</small><div class="bar q"><i style="width:' + pS + '%"></i><span>' + C.species + ' von ' + C.speciesMax + '</span></div></div>' +
      '<div><small>Farbvarianten</small><div class="bar xp"><i style="width:' + Math.max(pV, C.vars ? 2 : 0) + '%"></i><span>' + C.vars + ' von ' + C.varsMax + '</span></div></div>' +
      (C.open ? '<button class="btn green" data-act="bookall">Alle ' + C.open + ' Belohnungen abholen</button>' : '<div class="bhint">Neue Arten: kaufen. Farbvarianten: nur aus Eiern (Zucht, Glitzer-Ei) – nächstes Ei: ' + (Math.round(AA.variantChance() * 1000) / 10).toString().replace('.', ',') + ' %.</div>') + '</div>' +
      '<div class="tabs">' + TABS.map(function (tb) { return '<button class="tab' + (tb[0] === UI.bookTab ? ' active' : '') + '" data-act="booktab" data-id="' + tb[0] + '">' + tb[1] + '</button>'; }).join('') + '</div>' +
      (UI.bookTab !== 'titel' && UI.bookTab !== 'sets' ? '<div class="booksearch"><input id="book-q" type="search" placeholder="🔍 Art suchen …" value="' + esc(UI.bookQ) + '" autocomplete="off" spellcheck="false" aria-label="Im Sammelbuch suchen"></div>' : '') +
      (UI.bookTab === 'titel' && UI.lifeTitles ? '<div class="grid g-book titles"><div class="list">' + UI.lifeTitles() + '</div></div>' :
      UI.bookTab === 'sets' && UI.themesBook ? '<div class="grid g-book sets"><div class="list">' + UI.themesBook() + '</div></div>' :
      '<div class="grid g-book">' + (cards || '<div class="sec">' + (UI.bookTab === 'hyb' ? 'Hybride gibt es nur durch Kreuzen.' : 'Noch keine Farbvariante entdeckt. Züchte fleißig – jedes Ei ohne Mutation erhöht die Chance fürs nächste.') + '</div>') + '</div>');
  }
  function formTile(sp, v) {                           // eine Form der Art: normal ('') oder eine Variante
    const b = AA.state.book[sp], st = b ? (v ? b.v[v] || 0 : b.n) : 0, d = v ? AA.VAR_BY[v] : null, r = AA.bookReward(sp, v || undefined);
    const src = st ? AA.assets.variantSrc('fish/' + sp + '_m', v || undefined, 150) : AA.assets.src('fish/' + sp + '_m');
    return '<div class="ftile' + (st ? '' : ' unknown') + (UI.bookForm === (v || '') && st ? ' sel' : '') + (st === 1 ? ' hasnew' : '') + (d ? ' t' + d.tier : '') + '"' + (st ? ' data-act="bookform" data-id="' + (v || '') + '"' : '') + ' style="--vc:' + (d ? d.col : '#35c8d2') + '">' +
      '<div class="fpic"><img src="' + src + '" alt=""></div><div class="fnm">' + (d ? esc(d.name) : 'Normal') + '</div><div class="frare">' + (d ? d.rare : 'Grundform') + '</div>' +
      (st === 1 ? '<button class="btn green sm" data-act="bookclaim" data-id="' + (v || '') + '">Abholen</button><small>' + rewardTxt(r) + '</small>' :
        (st === 2 ? '<span class="fok">✓ Im Buch</span>' : '<span class="fno">' + (d ? 'Schlüpft nur aus Eiern' : (AA.FISH_BY[sp].hybrid ? 'Nur durch Kreuzen' : 'Im Shop kaufen')) + '</span><small>' + rewardTxt(r) + '</small>')) + '</div>';
  }
  function bookDetail(sp) {
    const s = AA.state, f = AA.FISH_BY[sp], b = s.book[sp], v = UI.bookForm && b && b.v[UI.bookForm] ? UI.bookForm : '';
    UI.bookForm = v;
    const d = v ? AA.VAR_BY[v] : null, W = AA.WATER[AA.waterOf(f)];
    const pics = [['b', 'Baby'], ['m', '♂ Männchen'], ['f', '♀ Weibchen']].map(function (x) {
      return '<div class="bbig' + (f.inv ? ' inv' : '') + '"><img' + (b ? '' : ' class="sil"') + ' src="' + (b ? AA.assets.variantSrc('fish/' + sp + '_' + x[0], v || undefined, 300) : AA.assets.src('fish/' + sp + '_' + x[0])) + '" alt=""><span>' + x[1] + '</span></div>';
    }).join('');
    let owned = 0, ownedV = 0;
    s.tanks.forEach(function (t) { t.fish.forEach(function (x) { if (x.sp === sp) { owned++; if (v && x.v === v) ownedV++; } }); });
    const hy = f.hybrid ? '🧬 Hybrid aus <b>' + esc(AA.FISH_BY[f.hybrid[0]].name) + '</b> × <b>' + esc(AA.FISH_BY[f.hybrid[1]].name) + '</b> – nur durch Kreuzen (Zuchtplaner, ab Level ' + f.lvl + '), unfruchtbar. ' : '';
    const info = !b ? (f.hybrid ? hy + 'Noch nie gezüchtet. ' + W.ico + ' ' + W.name + '.' : 'Diese Art hast du noch nie besessen. ' + W.ico + ' ' + W.name + ' · im Shop ab Level ' + f.lvl + '.') :
      (d ? '<b>' + esc(AA.speciesName(sp, v)) + '</b> – ' + esc(d.info) + ' Gerade in deinen Becken: ' + ownedV + '.' : esc(f.info) + ' ' + hy + W.ico + ' ' + W.name + ' · ab Level ' + f.lvl + ' · gerade in deinen Becken: ' + owned + '.') + (UI.lifeBookInfo ? UI.lifeBookInfo(sp) : '');
    const tiles = [''].concat(AA.variantsOf(sp).map(function (x) { return x.id; })).map(function (x) { return formTile(sp, x); }).join('');
    const idx = AA.FISH.indexOf(f), prev = AA.FISH[(idx - 1 + AA.FISH.length) % AA.FISH.length], next = AA.FISH[(idx + 1) % AA.FISH.length];
    return head('📖 ' + (b ? esc(f.name) : '???') + (d ? ' ' + varChip(v) : ''), '<div class="m-coins book"><button class="lnkbtn" data-act="booksp" data-id="' + prev.id + '" title="Vorherige Art">◀</button><small>' + (idx + 1) + ' / ' + AA.FISH.length + '</small><button class="lnkbtn" data-act="booksp" data-id="' + next.id + '" title="Nächste Art">▶</button></div>') +
      '<div class="bdetail"><div class="bstage' + (d ? ' t' + d.tier : '') + '">' + pics + '</div><div class="binfo">' + info + (UI.bookWhere ? whereBox(sp, v) : '') + '</div>' +
      '<div class="ftiles">' + tiles + '</div>' +
      '<div class="bfoot"><button class="btn grey" data-act="bookback">← Zur Übersicht</button><button class="btn blue" data-act="bookwhere">' + (UI.bookWhere ? '🧭 Weg ausblenden' : '🧭 Wo bekomme ich das?') + '</button><small>Farbvarianten schlüpfen nur aus Eiern. Beim Züchten: Grundchance ' + Math.round(AA.VAR.chance * 100) + ' % je Ei, mit jedem Ei ohne Mutation etwas mehr. ' +
      'Eltern geben ihre Variante oft weiter (ein Elternteil ' + Math.round(AA.VAR.inherit1 * 100) + ' %, beide gleich ' + Math.round(AA.VAR.inherit2 * 100) + ' %).</small></div></div>';
  }
  UI.openBook = function (sp) {
    if (sp !== undefined) { if (UI.bookSp !== sp) UI.bookForm = ''; UI.bookSp = sp; }
    const g = $('#modal .grid.g-book'), sc = UI.modalKind === 'book' && g ? g.scrollTop : (UI.bookScroll || 0);
    if (g) UI.bookScroll = g.scrollTop;
    UI.open('book', UI.bookSp ? bookDetail(UI.bookSp) : bookGrid(), 'store book');
    AA.assets.refreshImgs();                           // Vorschaubilder einsetzen (js/assets.js: As.thumb mit lazy)
    const g2 = $('#modal .grid.g-book'); if (g2) g2.scrollTop = UI.bookSp ? 0 : sc;
    bookFilter();
    const q = $('#book-q');
    if (q) q.addEventListener('input', function () { UI.bookQ = q.value; const g3 = $('#modal .grid.g-book'); if (g3) g3.scrollTop = 0; bookFilter(); });
  };

  /* ================= Klicks in den neuen Dialogen ================= */
  UI.extraClick = function (act, id, b) {
    const s = AA.state;
    if (act === 'quests') { UI.openQuests(); return true; }
    if (act === 'qclaim') {
      const r = AA.questClaim(+id);
      if (r) {
        AA.audio.play('coin');
        UI.openQuests();
        if (r.bonus) { AA.audio.play('chest'); UI.toast('🎉 <b>Alle drei Aufträge geschafft!</b> +' + r.pearls + ' Perle und Stempel Nr. ' + r.stamps + ' auf der Wochenkarte.', 'gold'); }
        else UI.toast('📋 Auftrag abgeholt: ' + rewardPlain(r), 'gold');
        AA.save(); UI.refresh();
      }
      return true;
    }
    if (act === 'wclaim') {
      const w = AA.weekClaim(+id);
      if (w) { AA.audio.play('level'); UI.openQuests(); UI.toast('📅 Wochenkarte: <b>' + esc(w.name) + '</b>' + (w.glitter || w.glitterBig ? ' – gleich einlösen!' : ''), 'big'); AA.save(); UI.refresh(); }
      return true;
    }
    if (act === 'glit') { UI.open('glitter', glitterHtml(id === 'big'), 'mid'); return true; }
    if (act === 'glitpick') {
      const r = AA.useGlitter(id, b.dataset.big === '1');
      if (typeof r === 'string') { UI.fail(r === 'none' ? 'unknown' : r); return true; }
      UI.close(); AA.save(); UI.refresh();
      return true;
    }
    if (act === 'book') { UI.bookSp = null; UI.openBook(); return true; }
    if (act === 'booktab') { UI.bookTab = id; UI.themeSel = null; UI.bookScroll = 0; const g = $('#modal .grid.g-book'); if (g) g.scrollTop = 0; UI.openBook(); return true; }
    if (act === 'booksp') { UI.openBook(id); return true; }
    if (act === 'bookback') { UI.bookSp = null; UI.openBook(); return true; }
    if (act === 'bookwhere') { UI.bookWhere = !UI.bookWhere; UI.openBook(); return true; }      // Runde 20g
    if (act === 'bookshop') { const Q = UI.shopQ; if (Q) { Q.q = (b && b.dataset.q) || ''; Q.buy = Q.miss = Q.fav = false; Q.water = ''; Q.sort = ''; } UI.close(); UI.openStore(id); return true; }
    if (act === 'bookform') { UI.bookForm = id; UI.openBook(); return true; }
    if (act === 'bookclaim') {
      const r = AA.bookClaim(UI.bookSp, id || undefined);
      if (r) { AA.audio.play(id ? 'chest' : 'coin'); UI.openBook(); UI.toast('📖 ' + esc(AA.speciesName(UI.bookSp, id || undefined)) + ': ' + rewardPlain(r), 'gold'); AA.save(); UI.refresh(); }
      return true;
    }
    if (act === 'bookall') {
      const r = AA.bookClaimAll();
      if (r.n) { AA.audio.play('chest'); UI.openBook(); UI.toast('📖 ' + r.n + ' Belohnungen abgeholt: ' + rewardPlain(r), 'gold'); AA.save(); UI.refresh(); }
      return true;
    }
    return false;
  };

  /* ================= Marken an den Knöpfen, Meldungen ================= */
  let lastDone = -1;                                   // so viele Aufträge waren beim letzten Blick erledigt (-1 = noch nicht geschaut / neue Liste)
  UI.metaRefresh = function () {
    const s = AA.state;
    if (!s || !s.quests || !$('#btn-quests')) return;
    const L = AA.questList(), qo = AA.questOpen(), bo = AA.bookCounts().open;
    const left = L.filter(function (q) { return !q.got; }).length;
    const qb = $('#quest-badge'), bb = $('#book-badge');
    qb.classList.toggle('hidden', qo === 0 && left === 0); qb.classList.toggle('todo', qo === 0); qb.textContent = qo > 0 ? qo : left;
    qb.title = qo > 0 ? 'Zum Abholen bereit' : 'Heute noch offen';
    bb.classList.toggle('hidden', bo === 0); bb.textContent = bo;
    $('#btn-quests').classList.toggle('ready', qo > 0);
    $('#btn-book').classList.toggle('ready', bo > 0);
    // gerade ein Auftrag fertig geworden? Einmal Bescheid sagen – sobald kein Dialog mehr offen ist
    const done = L.filter(function (q) { return q.done; }).length;
    if (lastDone < 0 || done < lastDone) lastDone = done;
    else if (done > lastDone && !AA.quiet && AA.ready && !UI.modalKind) {
      lastDone = done;
      const q = L.filter(function (x) { return x.done && !x.got; }).pop();
      if (q) { UI.toast('📋 Auftrag erledigt: <b>' + esc(q.text) + '</b> – Belohnung abholen (Taste A).', 'gold'); AA.audio.play('sparkle'); }
    }
    if (UI.modalKind === 'quests') {                   // offener Dialog: Fortschritt nachziehen, Restzeit weiterzählen
      if (questSig() !== UI._qSig) { lastDone = done; UI.openQuests(); }
      else { const a = $('#q-left'), b = $('#wk-left'); if (a) a.textContent = AA.fmtShort(real(AA.dayLeft())); if (b) b.textContent = longDur(real(AA.weekInfo().left)); }
    }
  };
  UI.metaInit = function () {
    $('#btn-quests').addEventListener('click', function () { AA.audio.play('click'); UI.openQuests(); });
    $('#btn-book').addEventListener('click', function () { AA.audio.play('click'); UI.bookSp = null; UI.openBook(); });
    AA.on('questsNew', function () { lastDone = -1; });
    AA.on('weekNew', function (late) {                 // neue Wochenkarte; was auf der alten erreicht, aber nicht abgeholt war, ist gutgeschrieben
      if (AA.quiet || !AA.ready) return;
      UI.toast('📅 Neue Wochenkarte!' + (late && late.length ? ' Von der alten noch gutgeschrieben: <b>' + late.map(esc).join(', ') + '</b>.' : ''), 'gold');
    });
    AA.on('bookNew', function (sp, v) {                // neue Art: kurzer Hinweis; neue Variante: das feiert schon die Schlüpf-Meldung (js/main.js)
      if (AA.quiet || !AA.ready || v) return;
      UI.toast('📖 Neu im Sammelbuch: <b>' + esc(AA.FISH_BY[sp].name) + '</b> – Belohnung abholen (Taste B).', 'gold');
    });
  };
})(window.AA);
