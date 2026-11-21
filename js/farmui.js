'use strict';
/* Awesome Aquarium – Oberfläche für Runde 6: Zuchtplaner, Büro-Reiter Verträge / Zucht / Personal, Zuchtstation und Meeresbecken im Shop,
   Kaviar- und Vertrags-Knopf auf der Fisch-Karte, Becken umbenennen. Regeln in js/farm.js. */
(function (AA) {
  const $ = AA.$, esc = AA.esc, fmt = AA.fmt, UI = AA.ui, V = AA.view;
  function real(sec) { return sec / AA.speed(); }
  function head(title, extra) { return '<div class="m-head"><div class="m-title">' + title + '</div>' + (extra || '') + '<button class="x" data-act="close" title="Schließen">✕</button></div>'; }
  function coin() { return '<img class="ic" src="' + AA.assets.src('prop/coin') + '" alt="Münzen">'; }
  function pc(x) { const v = x * 100; return (v > 0 && v < 1 ? '<1' : (v > 99 && v < 100 ? '>99' : Math.round(v))) + ' %'; }
  function dur(sec) { sec = Math.max(0, sec); if (sec >= 86400) { const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600); return d + (d === 1 ? ' Tag' : ' Tage') + (h ? ' ' + h + ' Std' : ''); } return AA.fmtDur(sec); }
  function fishImg(f, px) { const key = AA.spriteKey(f); return f.v ? AA.assets.variantSrc(key, f.v, px || 120) : AA.assets.src(key); }
  const FAIL = { level: 'Dafür ist dein Level noch zu niedrig.', coins: 'Dafür reichen die Münzen nicht.', rep: 'Dafür ist deine Firmenstufe noch zu niedrig.', max: 'Mehr als ' + AA.CONTRACTS.max + ' Verträge gleichzeitig gehen nicht.',
    nofish: 'Kein passender Fisch da (erwachsen und gesund).', done: 'Für diese Woche ist schon alles geliefert.', ocean: 'Das Meeresbecken bekommt keine Aufgabe.', owned: 'Hast du schon.' };
  function fail(r) { UI.toast('⚠️ ' + (FAIL[r] || 'Gerade nicht möglich'), 'warn'); AA.audio.play('fail'); }

  /* ================= Becken umbenennen ================= */
  UI.renameTank = function () {
    const t = AA.tank();
    UI.open('rename', head('✏️ Becken umbenennen') + '<div class="confirm"><p>Wie soll dieses Becken heißen?</p><input id="tank-rename" class="txt" maxlength="22" value="' + esc(t.name) + '" spellcheck="false">' +
      '<div class="row end"><button class="btn grey" data-act="close">Abbrechen</button><button class="btn green" data-act="renameyes">Speichern</button></div></div>', 'small');
    const inp = $('#tank-rename'); if (!inp) return;
    inp.focus(); inp.select();
    inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') renameYes(); if (e.key === 'Escape') UI.close(); });
  };
  function renameYes() {
    const inp = $('#tank-rename'); if (!inp) return;
    if (AA.renameTank(AA.tank(), inp.value)) { AA.audio.play('click'); UI.close(); UI.toast('✏️ Das Becken heißt jetzt „' + esc(AA.tank().name) + '“.'); AA.save(); UI.refresh(); }
    else fail('unknown');
  }

  /* ================= Zuchtplaner ================= */
  UI.plan = null;
  function parentRow(f, sel, act) {
    const vd = f.v && AA.VAR_BY[f.v];
    return '<button class="prow' + (sel ? ' on' : '') + '" data-act="' + act + '" data-id="' + f.id + '"><img src="' + fishImg(f, 96) + '" alt=""><span class="p-nm">' + esc(f.name) + (f.msea ? ' <small>Meerlachs</small>' : '') +
      (vd ? ' ' + UI.varChip(f.v, true) : '') + '</span><span class="p-g">' + UI.clsChip(f) + '<span class="genes">' + UI.genesTxt(f) + '</span></span></button>';
  }
  function plannerHtml() {
    const P = UI.plan, t = AA.tank(), st = AA.mateStatus(P.sp, t), def = AA.FISH_BY[P.sp];
    const a = st.males.find(function (x) { return x.id === P.a; }) || null, b = st.females.find(function (x) { return x.id === P.b; }) || null;
    const byG = function (x, y) { return AA.geneSum(y) - AA.geneSum(x); };
    let h = head('🧬 Zuchtplaner · ' + esc(def.name), '<div class="m-coins"><span title="Münzen">' + coin() + ' <b>' + fmt(AA.state.coins) + '</b></span></div>');
    h += (UI.lifePlanTop ? UI.lifePlanTop(P.sp) : '');   // Umschalter Reinzucht / Kreuzen (js/lifeui.js)
    h += '<div class="planner"><div class="p-col"><div class="p-h">♂ Vater wählen</div>' + st.males.slice().sort(byG).map(function (f) { return parentRow(f, a === f, 'plan-m'); }).join('') + '</div>' +
      '<div class="p-col"><div class="p-h">♀ Mutter wählen</div>' + st.females.slice().sort(byG).map(function (f) { return parentRow(f, b === f, 'plan-f'); }).join('') + '</div>';
    h += '<div class="p-fc">';
    if (a && b) {
      const F = AA.breedForecast(a, b);
      h += '<div class="p-h">Prognose für das Ei</div><div class="fc-cls">' + AA.CLASSES.slice().reverse().map(function (c) {
        const p = F.cls[c.id] || 0;
        return '<div class="fc-row' + (p < 0.0005 ? ' zero' : '') + '"><b class="cls" style="--cc:' + c.col + '">' + c.id + '</b><span class="fc-bar"><i style="width:' + Math.round(p * 100) + '%;background:' + c.col + '"></i></span><span class="fc-p">' + pc(p) + '</span></div>';
      }).join('') + '</div>';
      h += '<div class="fc-genes">' + ['c', 's', 'v'].map(function (k) { return '<span title="' + AA.GENE_NAMES[k][0] + '">' + AA.GENE_NAMES[k][1] + ' ⌀ ' + F.genes[k].mean.toFixed(1).replace('.', ',') + ' <small>(bis ' + F.genes[k].max + ')</small></span>'; }).join('') + '</div>';
      const vs = F.vars.filter(function (x) { return x.p >= 0.001; });
      const FM = AA.FORMS[P.sp];                        // Karpfen, Kaiserbuntbarsch (Runde 20e): Zuchtformen statt Farbvarianten
      h += '<div class="p-h">' + (FM ? 'Zuchtform' : 'Farbvariante') + '</div><div class="fc-vars">' + (FM ? '<span class="fc-v"><span class="vchip sm t1" style="--vc:' + FM.col + '">' + esc(FM.plain) + '</span> ' + pc(F.plain) + '</span>' : '') +
        vs.map(function (x) { return '<span class="fc-v">' + UI.varChip(x.v, true) + ' ' + pc(x.p) + '</span>'; }).join('') + (FM ? '' : '<span class="fc-v plain">normale Farbe ' + pc(F.plain) + '</span>') + '</div>' +
        (F.color ? '<div class="fc-color">🌈 Farbfutter wirkt – ' + (FM ? 'seltene Zuchtformen 3× so oft' : 'mindestens ' + Math.round(AA.FOOD2.color.min * 100) + ' % auf eine Farbvariante') + '</div>' : '');
      h += '<div class="wk-note">Jede Balz bringt ' + (F.eggs > 1 ? 'gleich ' + F.eggs + ' Eier' : 'ein Ei') + ' – danach ruhen sich die beiden ' + AA.fmtDur(real(AA.mateCooldown(AA.tank(), P.sp, false))) + ' aus, alle anderen Paare dürfen weiter. Die Werte oben gelten für jedes Ei.</div>' +
        '<button class="btn green big" data-act="plan-go">❤ Paaren · ' + fmt(F.cost) + ' ' + coin() + '</button>';
    } else h += '<div class="wk-note">Wähle links einen Vater und eine Mutter – dann siehst du hier, was aus dem Ei wird.</div>';
    h += '</div></div>';
    return h;
  }
  UI.openPlanner = function (d) {
    const sp = d.sp, st = AA.mateStatus(sp);
    if (!st.ok) return false;
    UI.plan = { sp: sp, a: null, b: null };
    const mine = st.males.indexOf(d) >= 0 ? 'm' : (st.females.indexOf(d) >= 0 ? 'f' : '');
    const best = function (list, me) { let o = null, sc = -1; list.forEach(function (x) { const s2 = AA.geneSum(x) + (me && me.v && x.v === me.v ? 1.5 : 0); if (s2 > sc) { sc = s2; o = x; } }); return o; };
    if (mine === 'm') { UI.plan.a = d.id; UI.plan.b = best(st.females, d).id; }
    else if (mine === 'f') { UI.plan.b = d.id; UI.plan.a = best(st.males, d).id; }
    else { const bp = AA.bestPair(sp); if (bp) { UI.plan.a = bp.a.id; UI.plan.b = bp.b.id; } }
    UI.open('planner', plannerHtml(), 'store planner-m');
    return true;
  };
  function planGo() {
    const P = UI.plan; if (!P) return;
    const t = AA.tank(), a = t.fish.find(function (x) { return x.id === P.a; }), b = t.fish.find(function (x) { return x.id === P.b; });
    if (!a || !b) { fail('unknown'); return; }
    const st = AA.startMate(P.sp, null, a, b);
    if (st.ok) { AA.state.stats.planned++; UI.close(); UI.toast('❤ ' + esc(a.name) + ' &amp; ' + esc(b.name) + ' turteln …', 'love'); AA.save(); }
    else fail(st.why);
    UI.updateCard();
  }

  /* ================= Büro: Verträge, Zucht, Personal ================= */
  function contractWhat(c) { return c.n + '× ' + esc(AA.FISH_BY[c.sp].name) + ' pro Woche · ' + c.weeks + ' Wochen'; }
  function vertragHtml() {
    const s = AA.state, K = AA.CONTRACTS, c = s.contracts;
    if (s.level < K.lvl) return '<div class="wk-note">📜 Lieferverträge gibt es ab <b>Level ' + K.lvl + '</b>: jede Woche eine feste Menge an einen Stammkunden, zum festen Preis.</div>';
    const act = c.act.map(function (x) {
      const cand = AA.contractCandidates(x), left = x.due - s.clock, open = x.n - x.got, hot = open > 0 && left < 86400 * 2;
      return '<div class="quest order' + (open > 0 && cand.length ? ' ready' : '') + '"><div class="o-pic"><img src="' + AA.assets.thumb('fish/' + x.sp + '_m') + '" alt=""></div><div class="q-main">' +
        '<div class="q-title">📜 ' + esc(x.name) + ' <small class="o-kind">Woche ' + (x.week + 1) + ' von ' + x.weeks + '</small></div>' +
        '<div class="q-desc">' + contractWhat(x) + ' – erwachsen und gesund, Klasse egal' + (x.miss ? ' · <b class="dn">' + x.miss + '× zu spät</b>' : '') + '</div>' +
        '<div class="o-prog"><div class="bar q"><i style="width:' + Math.round(x.got / x.n * 100) + '%"></i><span>' + x.got + ' / ' + x.n + ' diese Woche</span></div>' +
        '<span class="o-due' + (hot ? ' hot' : '') + '" data-due="' + x.due + '">⏳ ' + dur(real(left)) + '</span></div></div>' +
        '<div class="q-act"><div class="o-pay">je <b>' + fmt(x.pay) + '</b> ' + coin() + '</div>' +
        (open <= 0 ? '<button class="btn" disabled>✓ Woche erfüllt</button>' : (function () { const all = AA.contractCandidates(x, true).length, kept = all - cand.length;      // Auswahl statt Automatik (js/fishlist.js)
          return all ? '<button class="btn green" data-act="cdel" data-id="' + x.id + '">📦 Auswählen (' + all + (all === 1 ? ' passt' : ' passen') + (kept ? ', ' + kept + ' 🔒' : '') + ')</button>' : '<button class="btn" disabled>Kein passender Fisch</button>'; })()) +
        (open > 0 ? '<small class="o-fine">fehlt etwas: −' + fmt(Math.round(x.pay * K.penalty)) + ' je Fisch</small>' : '') + '</div></div>';
    }).join('');
    const offers = c.offers.map(function (x) {
      const def = AA.FISH_BY[x.sp], total = x.pay * x.n * x.weeks;
      return '<div class="quest order offer"><div class="o-pic"><img src="' + AA.assets.thumb('fish/' + x.sp + '_m') + '" alt=""></div><div class="q-main">' +
        '<div class="q-title">🤝 ' + esc(x.name) + ' <small class="o-kind">Angebot</small></div>' +
        '<div class="q-desc">' + contractWhat(x) + '</div><div class="q-desc"><small>Festpreis ' + fmt(x.pay) + ' statt Liste ' + fmt(def.sell) + ' · zusammen ' + fmt(total) + ' Münzen + 10 % Bonus, wenn du nie zu spät bist</small></div></div>' +
        '<div class="q-act"><div class="o-pay">je <b>' + fmt(x.pay) + '</b> ' + coin() + '</div><button class="btn violet" data-act="csign" data-id="' + x.id + '"' + (c.act.length >= K.max ? ' disabled' : '') + '>✍️ Unterschreiben</button></div></div>';
    }).join('');
    return (act ? '<div class="sec">Laufende Verträge (' + c.act.length + ' von ' + K.max + ')</div>' + act : '<div class="wk-note">Noch kein Vertrag. Unterschreib unten ein Angebot – dann hast du einen Stammkunden mit festem Preis.</div>') +
      '<div class="sec">Angebote von heute</div>' + (offers || '<div class="wk-note">Heute gibt es keine Angebote mehr. Morgen kommen neue.</div>') +
      '<div class="wk-note">Eine Vertrags-Woche dauert ' + K.week + ' Spieltage. Liefern kannst du jederzeit in der Woche (aus allen Becken, schwächste Gene zuerst). Am Wochenende wird abgerechnet: ' +
      'alles da = +' + K.weekRep + ' Ruf; fehlt etwas, zahlst du ' + Math.round(K.penalty * 100) + ' % des Stückpreises je fehlendem Fisch und verlierst ' + K.failRep + ' Ruf. Vertrag ohne Verspätung beendet: +' + K.doneRep + ' Ruf und 10 % Bonus.</div>';
  }
  function personalHtml() {
    const s = AA.state, rl = AA.repLevel().i;
    const cards = Object.keys(AA.STAFF).map(function (k) {
      const P = AA.STAFF[k], on = s.staff[k], lock = rl < P.rep;
      return '<div class="quest order staff' + (on ? ' ready' : '') + '"><div class="o-pic emoji">' + P.ico + '</div><div class="q-main"><div class="q-title">' + P.name + (on ? ' <small class="o-kind">angestellt</small>' : '') + '</div><div class="q-desc">' + P.info + '</div></div>' +
        '<div class="q-act"><div class="o-pay"><b>' + fmt(P.wage) + '</b> ' + coin() + ' pro Tag</div>' +
        (on ? '<button class="btn grey" data-act="fire" data-id="' + k + '">Kündigen</button>' : (lock ? '<button class="btn" disabled>🔒 Ab „' + esc(AA.REP_LEVELS[P.rep].name) + '“</button>' :
          '<button class="btn green" data-act="hire" data-id="' + k + '"' + (s.coins < P.wage ? ' disabled' : '') + '>Einstellen</button>')) + '</div></div>';
    }).join('');
    const w = AA.wagesPerDay();
    return '<div class="sec">Dein Team' + (w ? ' – Löhne: <b>' + fmt(w) + '</b> Münzen pro Spieltag' : '') + '</div>' + cards +
      '<div class="wk-note">Der Lohn wird bei jedem Tageswechsel abgebucht (der erste gleich beim Einstellen) – auch für Tage, an denen du nicht gespielt hast. Reicht das Geld nicht, kündigt die Person. ' +
      'Der Zuchtmeister paart nur, wenn die Kasse mindestens das Dreifache der Gebühr hergibt, und lässt immer einen Platz im Becken frei.</div>';
  }
  function zuchtHtml() {
    const s = AA.state, t = AA.tank();
    const tanks = s.tanks.map(function (tk, i) {
      const R = tk.role && AA.ROLES[tk.role], young = tk.fish.filter(function (f) { return !f.adult; }).length;
      return '<div class="zrow' + (i === s.active ? ' on' : '') + '"><span class="z-ico">' + AA.tankIco(tk) + '</span><span class="z-nm">' + esc(tk.name) + '</span>' +
        '<span class="z-role">' + (R ? R.ico + ' ' + R.name : '–') + '</span><span>🥚 ' + tk.eggs.length + '</span><span>🍼 ' + young + '</span><span>🐟 ' + (tk.fish.length - young) + '</span>' +
        (i === s.active ? '<span class="z-here">hier</span>' : '<button class="lnk" data-act="gotank" data-id="' + i + '">ansehen</button>') + '</div>';
    }).join('');
    const seen = {}, pairs = [];
    t.fish.forEach(function (f) {
      if (seen[f.sp]) return; seen[f.sp] = 1;
      const st = AA.mateStatus(f.sp, t); if (!st.males.length || !st.females.length) return;
      const bp = AA.bestPair(f.sp, t); if (!bp) return;
      pairs.push({ sp: f.sp, st: st, bp: bp, F: AA.breedForecast(bp.a, bp.b) });
    });
    pairs.sort(function (x, y) { return (y.F.cls.S + y.F.cls.A * 0.3) - (x.F.cls.S + x.F.cls.A * 0.3); });
    const rows = pairs.map(function (p) {
      const def = AA.FISH_BY[p.sp], why = p.st.ok ? '' : (p.st.why === 'cd' ? 'wieder in ' + dur(real(p.st.cd)) : ({ busy: 'Balz läuft', dirty: 'Becken zu schmutzig', full: 'Becken voll', coins: 'zu wenig Münzen', spawn: 'laicht nur im Süßwasser', cave: 'braucht eine Höhle', barren: 'unfruchtbar' }[p.st.why] || 'gerade nicht'));
      return '<div class="quest order' + (p.st.ok ? ' ready' : '') + '"><div class="o-pic"><img src="' + fishImg(p.bp.a) + '" alt=""></div><div class="q-main"><div class="q-title">' + esc(def.name) + '</div>' +
        '<div class="q-desc">Bestes Paar: <b>' + esc(p.bp.a.name) + '</b> ' + UI.clsChip(p.bp.a) + ' × <b>' + esc(p.bp.b.name) + '</b> ' + UI.clsChip(p.bp.b) + '</div>' +
        '<div class="q-desc"><small>Chance auf Klasse S ' + pc(p.F.cls.S) + ' · A ' + pc(p.F.cls.A) + (p.F.vars.length && p.F.vars[0].p >= 0.05 ? ' · ' + esc(AA.VAR_BY[p.F.vars[0].v].name) + ' ' + pc(p.F.vars[0].p) : '') + '</small></div></div>' +
        '<div class="q-act">' + (p.st.ok ? '<button class="btn green" data-act="zplan" data-id="' + p.sp + '">🧬 Planen</button>' : '<button class="btn" disabled>' + why + '</button>') + '</div></div>';
    }).join('');
    const cav = AA.caviarReady();
    return '<div class="sec">Deine Becken</div><div class="zlist">' + tanks + '</div>' +
      (cav ? '<div class="q-bonus">🥄 ' + cav + ' Stör-Weibchen ' + (cav === 1 ? 'ist' : 'sind') + ' bereit für die Kaviar-Ernte. <button class="btn gold" data-act="caviarall">Alle ernten</button></div>' : '') +
      '<div class="sec">Paare in „' + esc(t.name) + '“</div>' + (rows || '<div class="wk-note">In diesem Becken gibt es gerade kein erwachsenes, sattes Paar (♂ + ♀ derselben Art).</div>') +
      (UI.lifeZucht ? UI.lifeZucht() : '') +
      '<div class="wk-note">Babys erben je Gen den Mittelwert der Eltern, mit etwas Glück einen Punkt mehr. 🥚 Brutbecken und 🍼 Aufzuchtbecken richtest du im Shop unter „Aquarien“ ein – Eier legen im einen, groß werden im anderen.</div>';
  }
  UI.farmHtml = function (tab) { return tab === 'vertrag' ? vertragHtml() : (tab === 'personal' ? personalHtml() : (tab === 'zucht' ? zuchtHtml() : null)); };
  UI.farmSig = function () {
    const s = AA.state, c = s.contracts;
    return '|' + c.act.map(function (x) { return x.id + ':' + x.got + ':' + x.week + ':' + AA.contractCandidates(x).length; }).join(',') + '|' + c.offers.length + '|' + JSON.stringify(s.staff) + '|' + s.active +
      (UI.officeTab === 'zucht' ? '|' + (UI.lifeZuchtSig ? UI.lifeZuchtSig() : '') + s.tanks.map(function (t) { return (t.role || '') + t.eggs.length + '.' + t.fish.length + 'm' + (t.matings ? t.matings.length : 0); }).join(',') + AA.caviarReady() : '');
  };

  /* ================= Shop → Aquarien: Zuchtstation, Meeresbecken ================= */
  UI.farmTankCards = function () {
    const s = AA.state, t = AA.tank();
    let h = '';
    if (!AA.wide(t)) {
      h += '<div class="card wide"><div class="pic emoji">🧪</div><div class="nm">Zuchtstation <small class="tagline">Aufgabe für „' + esc(t.name) + '“</small></div><div class="info">' +
        Object.keys(AA.ROLES).map(function (k) { const R = AA.ROLES[k]; return R.ico + ' <b>' + R.name + ':</b> ' + R.info; }).join('<br>') + '</div><div class="two">' +
        Object.keys(AA.ROLES).map(function (k) {
          const R = AA.ROLES[k], st = AA.roleStatus(k, t);
          if (st === 'owned') return '<button class="buy active" disabled>✓ ' + R.ico + ' ' + R.name + '</button>';
          if (st === 'level') return '<button class="buy locked" disabled>🔒 Ab Level ' + R.lvl + '</button>';
          return '<button class="buy' + (st === 'coins' ? ' poor' : '') + '" data-act="role" data-id="' + k + '"' + (st === 'coins' ? ' disabled' : '') + '>' + R.ico + ' ' + R.name + ' · ' + coin() + ' ' + fmt(R.price) + '</button>';
        }).join('') + '</div>' + (t.role ? '<button class="lnk" data-act="roleclear">Aufgabe wieder entfernen (kein Geld zurück)</button>' : '') + '</div>';
    }
    const os = AA.oceanStatus(), O = AA.OCEAN, onx = AA.oceanNext(), on = AA.oceanCount(), oNum = ['', 'Zweites ', 'Drittes '][on] || '';
    h += '<div class="card wide"><div class="pic emoji">🦈</div><div class="nm">' + oNum + 'Meeresbecken <small class="tagline">für die ganz Großen' + (on ? ' · du hast ' + on + ' von ' + O.max : '') + '</small></div>' +
      '<div class="info">Ein riesiges Meerwasser-Becken für ' + O.cap + ' Bewohner. Nur hier ziehen Adlerrochen, Katzenhai, Riffhai, Schwertfisch und Meeresschildkröte ein – alle anderen Meerwasser-Tiere dürfen natürlich auch rein. Bis zu ' + O.max + ' Meeresbecken.</div>' +
      (os === 'owned' ? '<button class="buy active" disabled>✓ Alle ' + O.max + ' gekauft</button>' : (os === 'level' ? '<button class="buy locked" disabled>🔒 Ab Level ' + onx.lvl + '</button>' :
        '<button class="buy' + (os === 'coins' ? ' poor' : '') + '" data-act="buyocean"' + (os === 'coins' ? ' disabled' : '') + '>🦈 ' + oNum + 'Meeresbecken · ' + coin() + ' ' + fmt(onx.price) + '</button>')) + '</div>';
    return h;
  };

  /* ================= Fisch-Karte: Kaviar, Vertrag ================= */
  UI.cardFarm = function (d) {
    const row = $('#c-farm-row'); if (!row) return;
    const cv = AA.caviarStatus(d), bc = $('#c-caviar'), bk = $('#c-contract');
    let show = false;
    if (cv && d.sex === 'f') {
      show = true; bc.classList.remove('hidden'); bc.disabled = !cv.ok;
      bc.innerHTML = cv.ok ? '🥄 Kaviar ernten · ' + fmt(cv.coins) : (cv.why === 'young' ? '🥄 Kaviar: erst erwachsen' : (cv.why === 'wait' ? '🥄 Kaviar in ' + AA.fmtShort(real(cv.wait)) : (cv.why === 'sick' ? '🥄 Kaviar: krank' : '🥄 Kaviar: hungrig')));
      bc.title = cv.C.name + ': alle ' + AA.fmtDur(real(AA.FISH_BY[d.sp].pause)) + ', der Fisch bleibt. Mehr Münzen bei höherer Güteklasse.';
    } else bc.classList.add('hidden');
    let best = null;
    AA.state.contracts.act.forEach(function (c) { if (c.got < c.n && AA.contractFits(c, d) && (!best || c.pay > best.pay)) best = c; });
    if (best) { show = true; bk.classList.remove('hidden'); bk.textContent = '📜 ' + best.name + ' · ' + fmt(best.pay); bk.dataset.id = best.id; bk.title = 'Vertrag: ' + best.got + ' von ' + best.n + ' diese Woche geliefert'; }
    else bk.classList.add('hidden');
    row.classList.toggle('hidden', !show);
    const sub = $('#c-sub'); if (sub && d.msea && sub.textContent.indexOf('Meerlachs') < 0) sub.textContent = sub.textContent.replace('Lachs', 'Meerlachs');
    if (sub && d.sp === 'salmon' && !d.adult && AA.tank().water === 'salt' && sub.textContent.indexOf('🌊') < 0) sub.textContent += ' · 🌊 ' + Math.min(100, Math.round((d.sea || 0) / (AA.FISH_BY.salmon.grow * AA.SALMON.sea) * 100)) + ' % Meer';
  };
  function contractDeliver(cid, f) {
    const fv = f && V.byId[f.id], pos = fv ? { x: fv.x, y: fv.y } : null;
    const r = AA.contractDeliver(cid, f);
    if (typeof r === 'string') { fail(r); return null; }
    if (pos) UI.coinFly(pos.x, pos.y, r.pay);
    AA.audio.play('coin');
    UI.toast('📜 ' + esc(r.fish.name) + ' geht an <b>' + esc(r.contract.name) + '</b>: +' + fmt(r.pay) + ' Münzen (' + r.contract.got + ' / ' + r.contract.n + ')' + (r.weekDone ? '<br><small>Diese Woche ist erfüllt ✓</small>' : ''), r.weekDone ? 'big' : 'gold');
    AA.save(); UI.refresh();
    return r;
  }

  /* ================= Klicks ================= */
  UI.farmClick = function (act, id, b) {
    const s = AA.state, f = V.sel;
    if (act === 'renametank') { UI.renameTank(); return true; }
    if (act === 'renameyes') { renameYes(); return true; }
    if (act === 'plan-m' || act === 'plan-f') { if (UI.plan) { UI.plan[act === 'plan-m' ? 'a' : 'b'] = id; AA.audio.play('click'); const l = $('#modal .planner'), sc = l ? l.scrollTop : 0; UI.open('planner', plannerHtml(), 'store planner-m'); const l2 = $('#modal .planner'); if (l2) l2.scrollTop = sc; } return true; }
    if (act === 'plan-go') { planGo(); return true; }
    if (act === 'zplan') { const d = AA.tank().fish.find(function (x) { return x.sp === id; }); if (d && !UI.openPlanner({ sp: id })) fail('unknown'); return true; }
    if (act === 'caviar' && f) {
      const r = AA.harvestCaviar(f.d);
      if (r && r.ok) { AA.audio.play('coin'); UI.coinFly(f.x, f.y, r.coins); V.floatText(f.x, f.y - 40, '🥄 +' + fmt(r.coins), '#ffe36e'); UI.toast('🥄 ' + r.C.name + ' von ' + esc(f.d.name) + ': +' + fmt(r.coins) + ' Münzen', 'gold'); AA.save(); UI.refresh(); }
      else fail('unknown');
      return true;
    }
    if (act === 'caviarall') {
      let n = 0, sum = 0;
      s.tanks.forEach(function (t) { t.fish.forEach(function (x) { const r = AA.harvestCaviar(x); if (r && r.ok) { n++; sum += r.coins; } }); });
      if (n) { AA.audio.play('chest'); UI.toast('🥄 ' + n + '× Kaviar geerntet: +' + fmt(sum) + ' Münzen', 'big'); AA.save(); UI.refresh(); if (UI.modalKind === 'office') UI.openOffice(); }
      return true;
    }
    if (act === 'cdeliver' && f) { contractDeliver(b.dataset.id, f.d); return true; }
    if (act === 'cdel') { contractDeliver(id); if (UI.modalKind === 'office') UI.openOffice(); return true; }
    if (act === 'csign') { const r = AA.contractSign(id); if (typeof r === 'string') fail(r); else { AA.audio.play('buy'); UI.toast('✍️ Vertrag mit <b>' + esc(r.name) + '</b>: ' + r.n + '× ' + esc(AA.FISH_BY[r.sp].name) + ' pro Woche, ' + r.weeks + ' Wochen.', 'gold'); AA.save(); UI.openOffice(); } return true; }
    if (act === 'hire') { const r = AA.hire(id); if (r !== true) fail(r); else { AA.audio.play('buy'); UI.toast(AA.STAFF[id].ico + ' <b>' + AA.STAFF[id].name + '</b> fängt sofort an (' + AA.STAFF[id].wage + ' Münzen pro Tag).', 'gold'); AA.save(); UI.openOffice(); } return true; }
    if (act === 'fire') { if (AA.fire(id)) { UI.toast(AA.STAFF[id].ico + ' ' + AA.STAFF[id].name + ' ist entlassen.'); AA.save(); UI.openOffice(); } return true; }
    if (act === 'role') { const r = AA.setRole(id); if (r !== true) fail(r); else { AA.audio.play('buy'); UI.toast(AA.ROLES[id].ico + ' „' + esc(AA.tank().name) + '“ ist jetzt ein <b>' + AA.ROLES[id].name + '</b>.', 'gold'); AA.save(); UI.openStore(); } return true; }
    if (act === 'roleclear') { if (AA.clearRole()) { AA.save(); UI.openStore(); } return true; }
    if (act === 'buyocean') { const r = AA.buyOcean(); if (r !== true) fail(r); else { AA.audio.play('level'); UI.close(); UI.toast('🦈 Dein <b>Meeresbecken</b> ist da! Jetzt können die ganz Großen einziehen.', 'big'); } return true; }
    return false;
  };

  /* ================= Meldungen ================= */
  UI.farmRefresh = function () {
    if (AA.farmNews && AA.farmNews.length && AA.ready && !AA.quiet) { const list = AA.farmNews.splice(0); list.slice(0, 4).forEach(function (m, i) { setTimeout(function () { UI.toast(esc(m), 'warn'); }, 600 + i * 900); }); }
  };
  UI.farmInit = function () {
    const lab = $('#tank-label');
    if (lab) { lab.title = 'Klicken: Becken umbenennen'; lab.style.cursor = 'pointer'; lab.addEventListener('click', function (e) { if (e.target && e.target.closest && e.target.closest('#tank-count')) return; AA.audio.play('click'); UI.renameTank(); }); }
    const live = function () { return !AA.quiet && AA.ready; };
    AA.on('contractMiss', function (c, missing, fine) { if (live()) { UI.toast('📜 <b>' + esc(c.name) + '</b>: ' + missing + ' von ' + c.n + ' ' + esc(AA.FISH_BY[c.sp].name) + ' fehlten – Strafe ' + fmt(fine) + ' Münzen, −' + AA.CONTRACTS.failRep + ' Ruf.', 'warn'); AA.audio.play('fail'); } });
    AA.on('contractDone', function (c, bonus) { if (live()) { UI.toast('🏆 Vertrag mit <b>' + esc(c.name) + '</b> erfüllt: +' + fmt(bonus) + ' Münzen Bonus, +' + AA.CONTRACTS.doneRep + ' Ruf.', 'big'); AA.audio.play('chest'); } });
    AA.on('contractOffers', function () { if (live() && AA.state.contracts.offers.length && AA.state.contracts.act.length < AA.CONTRACTS.max) UI.toast('🤝 Neue Vertrags-Angebote im Büro (Reiter Verträge).'); });
    AA.on('staffQuit', function () { UI.farmRefresh(); });
    AA.on('staffWork', function (who, r) {
      if (!live()) return;
      if (who === 'seller') UI.toast('🧑‍💼 Verkäufer: ' + esc(r.fish.name) + ' an ' + esc(r.order.name) + ' geliefert, +' + fmt(r.pay) + ' Münzen.');
      else if (who === 'master') UI.toast('🧑‍🔬 Zuchtmeister: ' + esc(r.a.name) + ' &amp; ' + esc(r.b.name) + ' turteln' + (r.tank !== AA.tank() ? ' in „' + esc(r.tank.name) + '“' : '') + '.', 'love');
    });
  };
})(window.AA);
