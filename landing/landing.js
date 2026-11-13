'use strict';
/* Awesome Aquarium – Startseite: Einladungscode aus dem Link (?invite=ABCD-EFGH) ins Spiel mitnehmen; wer schon angemeldet war,
   bekommt „Weiterspielen“. Sonst passiert hier nichts – kein Tracking, keine Cookies. */
(function () {
  function code() {
    try {
      const v = new URLSearchParams(location.search).get('invite') || '';
      const c = v.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      return c.length === 8 ? c : '';
    } catch (e) { return ''; }
  }
  const c = code(), $ = function (id) { return document.getElementById(id); };
  if (c) {
    const pretty = c.slice(0, 4) + '-' + c.slice(4);
    ['cta-invite', 'cta-invite2'].forEach(function (id) { const a = $(id); if (a) a.href = 'spiel.html?register=1&invite=' + pretty; });
    const n = $('invite-note'), k = $('invite-code');
    if (n && k) { k.textContent = pretty; n.hidden = false; }
    const a = $('cta-invite'); if (a) a.textContent = '🎟️ Jetzt registrieren';
  }
  let known = false;
  try { known = !!localStorage.getItem('aa-auth') || !!localStorage.getItem('awesome-aquarium-save-v2'); } catch (e) { /* privat-Modus */ }
  if (known && !c) {
    const p = $('cta-play'); if (p) p.textContent = 'Weiterspielen';
    const t = $('top-login'); if (t) t.textContent = 'Zum Aquarium';
  }
})();
