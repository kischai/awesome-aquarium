'use strict';
/* Awesome Aquarium – Runde 11: Profil (Name, Fisch-Bild, „Über mich“), Umzug zu vieler Krabbler ins Lager, einmaliges Geschenk für Damian.
   Oberfläche: js/socialui.js. Mit Konto spiegelt js/cloud.js Name, Bild und „Über mich“ ins Profil in der Wolke.
   Regeln in Worten: docs/MECHANIK.md § 6i. */
(function (AA) {
  const B = AA.BAL;
  function S() { return AA.state; }

  AA.PROFILE = { nameMax: 20, bioMax: 160 };
  /* Fische, die man als Profilbild nehmen kann (dieselben wie beim Konto-Anlegen in js/cloudui.js) */
  AA.AVATARS = ['clown', 'guppy', 'goldfish', 'koi', 'neon', 'skalar', 'betta', 'discus', 'puffer', 'seahorse', 'axolotl', 'bluetang'];
  function cleanName(v) { return String(v || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, AA.PROFILE.nameMax); }
  function cleanBio(v) { return String(v || '').replace(/[\u0000-\u0009\u000b-\u001f<>]/g, '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim().slice(0, AA.PROFILE.bioMax); }
  AA.cleanName = cleanName; AA.cleanBio = cleanBio;

  /* ---------- Geschenke nur für Damians Spielstand (erkannt am Anlege-Zeitpunkt), jedes genau einmal ----------
     Runde 11: 1.000.000 Münzen und das höchste Level · Runde 14: 2.000.000 Münzen und 1.000.000 Perlen – sonst bleibt der Stand, wie er ist.
     Rechnet erst alles aus und übernimmt es dann in einem Rutsch: Ein Geschenk kann das Laden nie stören (nicht bei einem Freund zu Besuch). */
  AA.GIFTS = [{ id: 'r11-damian', created: 1794340217986, coins: 1000000, maxLevel: true },
    { id: 'r14-damian', created: 1794340217986, coins: 2000000, pearls: 1000000 }];
  function giveGifts(s) {
    if (AA.loadingGuest) return;                      // zu Besuch bei einem Freund: dessen Stand nur ansehen, nichts schenken
    s.gifts = s.gifts && typeof s.gifts === 'object' ? s.gifts : {};
    AA.GIFTS.forEach(function (g) {
      if (s.gifts[g.id] || +s.created !== g.created) return;
      let nw;
      try {
        nw = { coins: Math.max(0, Math.round(+s.coins || 0)) + (g.coins || 0), pearls: Math.max(0, Math.round(+s.pearls || 0)) + (g.pearls || 0), xp: s.xp, level: s.level, lv: 0 };
        if (g.maxLevel) {
          const top = AA.LEVELS[AA.MAX_LEVEL - 1];
          if (nw.xp < top) nw.xp = top;
          const nl = AA.levelFor(nw.xp);
          while (nw.level < nl) { nw.level++; nw.pearls++; nw.lv++; }   // wie beim normalen Aufstieg: jedes Level eine Perle
        }
        if (!isFinite(nw.coins) || !isFinite(nw.pearls) || !isFinite(nw.xp)) return;
      } catch (e) { return; }                          // lieber kein Geschenk als ein kaputter Spielstand
      s.gifts[g.id] = Date.now();
      s.coins = nw.coins; s.pearls = nw.pearls; s.xp = nw.xp; s.level = nw.level;
      s.news = s.news || {};
      if (g.maxLevel) s.news.gift = { coins: g.coins, level: s.level, pearls: nw.lv };
      else s.news.bonus = { coins: g.coins || 0, pearls: g.pearls || 0 };
    });
  }

  /* ---------- Runde 11: Krabbler-Grenze. Was über der Grenze lebt, zieht ins Lager (nichts geht verloren). ---------- */
  function moveCrawlers(s) {
    let moved = 0;
    s.storage = Array.isArray(s.storage) ? s.storage : [];
    s.tanks.forEach(function (t) {
      const max = AA.crawlMax(t);
      let n = AA.decoCount(t, true);
      for (let i = t.deco.length - 1; i >= 0 && n > max; i--) {
        const o = t.deco[i], def = AA.DECO_BY[o.type];
        if (!def || !def.crawl) continue;
        if (s.storage.length >= B.maxStore) break;
        t.deco.splice(i, 1);
        const it = { type: o.type }; if (o.flip) it.f = 1;
        s.storage.push(it); n--; moved++;
      }
    });
    return moved;
  }

  AA.socialFix = function (s) {
    const p = s.profile && typeof s.profile === 'object' ? s.profile : {};
    s.profile = { name: cleanName(p.name), avatar: AA.AVATARS.indexOf(p.avatar) >= 0 ? p.avatar : '', bio: cleanBio(p.bio) };
    if (s.settings.music === undefined) s.settings.music = true;
    if (s.r11 && s.r11.crawl) {
      const n = moveCrawlers(s);
      if (n) { s.news = s.news || {}; s.news.crawlMoved = n; }
      delete s.r11.crawl;
    }
    if (s.r11 && !Object.keys(s.r11).length) delete s.r11;
    if (s.created) giveGifts(s);
    return s;
  };

  /* ---------- Wer bin ich? Mit Konto zählt das Profil in der Wolke, sonst das im Spielstand. ---------- */
  AA.me = function () {
    const C = AA.cloud, p = (S() && S().profile) || {};
    const cp = C && C.user && C.profile ? C.profile : null;
    return { name: (cp && cp.name) || p.name || 'Du', avatar: (cp && cp.avatar) || p.avatar || 'clown', bio: (cp && cp.bio !== undefined && cp.bio !== null ? cp.bio : p.bio) || '', user: cp ? (cp.username || '') : '' };
  };
  /* Profil speichern: lokal immer, in der Wolke, wenn angemeldet. Gibt { ok, why } zurück (why: name). */
  AA.saveMyProfile = function (name, avatar, bio) {
    const s = S(); name = cleanName(name); bio = cleanBio(bio);
    if (name && name.length < 2) return { ok: false, why: 'name' };
    s.profile = { name: name, avatar: AA.AVATARS.indexOf(avatar) >= 0 ? avatar : (s.profile.avatar || ''), bio: bio };
    AA.save();
    const C = AA.cloud;
    if (C && C.user && C.profile && C.saveProfile) C.saveProfile(name || C.profile.name, s.profile.avatar || C.profile.avatar, bio).catch(function () { /* beim nächsten Mal */ });
    AA.emit('profile');
    return { ok: true };
  };
})(window.AA);
