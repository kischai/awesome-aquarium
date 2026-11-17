'use strict';
/* Awesome Aquarium – Runde 18: Weihnachten (Oberfläche)
   Adventskalender: In der Weihnachtszeit (AA.season().advent, 15. November bis 6. Januar) sitzt am linken Rand ein Knopf „Advent“. Er öffnet das
   Fenster „Bald verfügbar – Adventskalender“: das Higgsfield-Visual (assets/ui/advent, kommt erst beim Öffnen) zu 40 % sichtbar, darauf die 24 Türchen
   genau auf den gemalten Türen, nummeriert von 1 bis 24 und gemischt wie bei einem echten Kalender. Die Türchen tun noch nichts.
   Der Rest von Weihnachten steht in js/data.js (Arten, Deko, AA.season), js/state.js (Mistelzweig, Aufräumen), js/ui.js (Reiter „Weihnachten“),
   js/fish.js (Mütze, Heiligenschein, Purzelbaum) und js/tankview.js (Schneemann, Schneekugel, Lichterkette). */
(function (AA) {
  const UI = AA.ui, $ = AA.$;
  /* Lage der gemalten Türen im Visual (1344 × 752 Pixel): Spalten und Zeilen von–bis, gemessen am Bild */
  const W = 1344, H = 752;
  const COLS = [[356, 451], [463, 558], [571, 666], [678, 773], [786, 880], [893, 988]];
  const ROWS = [[274, 362], [378, 466], [481, 569], [585, 674]];
  const NUMS = [2, 4, 14, 11, 10, 17, 18, 9, 8, 1, 5, 15, 16, 24, 12, 3, 22, 20, 21, 7, 6, 19, 13, 23];      // fest gemischt – Zeile für Zeile
  AA.ADVENT = { cols: COLS, rows: ROWS, nums: NUMS };
  const pct = function (v) { return (v * 100).toFixed(3) + '%'; };

  function html() {
    let doors = '', k = 0;
    ROWS.forEach(function (r) {
      COLS.forEach(function (c) {
        doors += '<button class="adv-door" data-act="advdoor" data-id="' + NUMS[k] + '" title="Türchen ' + NUMS[k] + ' – bald" style="left:' + pct(c[0] / W) + ';top:' + pct(r[0] / H) +
          ';width:' + pct((c[1] - c[0] + 1) / W) + ';height:' + pct((r[1] - r[0] + 1) / H) + '"><span>' + NUMS[k] + '</span></button>';
        k++;
      });
    });
    return '<div class="m-head"><div class="m-title">🎄 Bald verfügbar – Adventskalender</div><div style="flex:1"></div><button class="x" data-act="close" title="Schließen">✕</button></div>' +
      '<div class="adv-wrap"><img class="adv-img" src="' + AA.assets.src('ui/advent') + '" alt="">' + doors + '</div>' +
      '<div class="adv-note">Bald öffnest du hier jeden Tag ein Türchen.</div>';
  }
  UI.openAdvent = function () {
    UI.open('advent', html(), 'advent');
    AA.assets.refreshImgs();                           // im Netz: Platzhalter, bis das Päckchen u-advent da ist (setzt sich dann von selbst ein)
    if (AA.audio) AA.audio.play('sparkle');
  };
  /* Knopf am linken Rand: nur in der Weihnachtszeit, nicht beim Besuch bei Freunden */
  function syncBtn() {
    const stage = $('#stage');
    if (!stage || !AA.state) return;
    let b = $('#advent-btn');
    const on = AA.seasonNow().advent && !AA.visit;
    if (!b) {
      if (!on) return;
      b = document.createElement('button');
      b.id = 'advent-btn'; b.title = 'Adventskalender – bald verfügbar';
      b.innerHTML = '<span class="soon">bald</span><img alt="" src="' + AA.assets.src('prop/advent_btn') + '"><b>Advent</b>';
      b.addEventListener('click', function (e) { e.stopPropagation(); UI.openAdvent(); });
      stage.appendChild(b);
    }
    b.classList.toggle('hidden', !on);
  }
  UI.xmasInit = function () {
    syncBtn();
    setInterval(syncBtn, 2000);                        // Weihnachtszeit beginnt/endet, Besuch bei Freunden an/aus
  };
})(window.AA);
