'use strict';
/* Awesome Aquarium – Spieldaten (v2).
   Alles hier ist bewusst als Daten gehalten: neue Fische, Deko, Böden oder Balance-Werte
   lassen sich einfach in diesen Listen ergänzen. Woher welche Regel kommt, steht in docs/MECHANIK.md. */
(function (AA) {
  /* ---------- Level: Start-XP je Level (Index 0 = Level 1) ----------
     Bis Level 31 wie im Vorbild (jedes Level ca. 15 % mehr XP als das vorige). Runde 16: danach nur noch +5 % je Level – mit +15 % lief
     der XP-Bedarf den Fischen davon, ab Level 35 dauerte jedes Level einen halben Tag und mehr (gemessen mit dem Test-Spieler).
     Vorher: Level 39 bei 147.915 XP, Level 55 bei 1.429.000 XP. */
  AA.LEVELS = [0, 105, 225, 360, 520, 700, 915, 1160, 1435, 1760, 2130, 2560, 3050, 3620, 4275, 5030, 5895, 6895, 8050, 9380,
    10910, 12675, 14710, 17055, 19755, 22865, 26450, 30580, 35340, 40825, 47140,
    53770, 60730, 68040, 75715, 83775, 92240, 101125, 110455, 120250, 130535, 141335, 152675, 164585, 177090, 190220,
    204005, 218480, 233680, 249640, 266395, 283990, 302465, 321860, 342225];
  AA.MAX_LEVEL = AA.LEVELS.length;
  AA.levelFor = function (xp) { let l = 1; while (l < AA.MAX_LEVEL && xp >= AA.LEVELS[l]) l++; return l; };

  AA.BAL = {
    startCoins: 50, startFood: 20,
    hungerSeconds: 8 * 3600,     // satt -> Hunger-Anzeige leer
    sickSeconds: 4 * 3600,       // so lange mit leerem Magen, dann wird der Fisch krank
    biteFill: 0.25,              // ein Bissen füllt ein Viertel der Anzeige
    hungryBelow: 0.8,            // darunter geht ein Fisch auf Futtersuche
    flakes: 4, maxFlakes: 60,    // Flocken pro Prise / höchstens gleichzeitig im Wasser
    shakeXpChance: 0.7,          // eine Prise bringt in 70 % der Fälle 1 XP; dazu 1 XP je Bissen
    dirtSeconds: 24 * 3600,      // bei 10 Fischen von blitzblank bis ganz veralgt
    cleanStep: 0.1, cleanXp: 10, // ein Bürstenstrich: 10 % Schmutz weg, 10 XP
    mateChance: 1,               // Runde 11: jede Balz bringt ein Ei; die Pause gilt je Fisch – wie lang: f.pause (Runde 15, AA.TEMPO)
    mateDirtMax: 0.3, mateHungerMin: 0.5, mateDance: 5.5,
    babyValue: 0.3, sickValue: 0.7,
    gift: 20,                    // Tagesgeschenk: 20 Prisen Futter
    hunts: 2, huntSeconds: 45,   // Schatzsuche: zweimal pro Tag, 45 Sekunden
    trainTries: 3,
    feederKeep: 0.75,            // der Futterautomat hält die Fische mindestens so satt
    maxDeco: 36,                 // Deko-Teile pro Becken (Grundwert) – Runde 11: wächst mit der Größe, nie darunter (AA.decoMax)
    decoBySize: [36, 42, 48, 54, 60, 66], decoOcean: 72, decoDeep: 60,      // Runde 14: je Größe +20 % (vorher 30/35/40/45, Meer 60, Tiefsee 50); Runde 20f: 150/175 Gal. 60/66
    crawlBySize: [5, 5, 5, 5, 6, 7],   // Runde 20f: Krabbler je Größe (150 Gal. 6, 175 Gal. 7)
    maxCrawl: 5, maxCrawlBig: 8, // Krabbler pro Becken; Meeres- und Tiefsee-Becken 8 (Runde 11, vorher 10 überall)
    cleanMax: 0.6                // so stark können sie das Veralgen höchstens bremsen
  };

  /* ---------- Wasser: jedes Becken ist Meerwasser oder Süßwasser ----------
     Fische und Krabbler leben nur in ihrem Wasser (water: 'fresh' an der Art, sonst Meerwasser); Deko darf überall stehen.
     Das erste Becken ist Meerwasser. Das erste Süßwasser-Becken ist ein Sonderangebot (AA.FRESH_TANK): früh und günstig, zählt nicht
     in der Becken-Leiter des Vorbilds mit – der Guppy (Level 4) ist dort der erste Bewohner. */
  AA.WATER = {
    salt: { name: 'Meerwasser', ico: '🌊', only: 'Nur Meerwasser', need: 'braucht ein Meerwasser-Becken' },
    fresh: { name: 'Süßwasser', ico: '🌿', only: 'Nur Süßwasser', need: 'braucht ein Süßwasser-Becken' },
    both: { name: 'Süß- und Meerwasser', ico: '🌊🌿', only: 'Beide Wasser', need: '' }
  };
  AA.waterOf = function (def) { return (def && def.water) || 'salt'; };
  /* Darf diese Art / dieser Krabbler in das Becken? AA.whyNot nennt den Grund, wenn nicht:
       'ocean' = Meeresriese, nur Meeresbecken · 'deep' = Tiefsee-Tier, nur Tiefsee-Becken · 'nodeep' = kein Tiefsee-Tier (ins Tiefsee-Becken dürfen nur die)
       'big' = braucht das große Becken (125 Gallonen) oder das Meeresbecken · 'water' = falsches Wasser.  Krabbler sind nur ans Wasser gebunden. */
  AA.whyNot = function (def, t) {
    if (!def.crawl) {
      if (def.ocean && !t.ocean) return 'ocean';
      if (def.deep === 1 && !t.deep) return 'deep';
      if (t.deep && !def.deep) return 'nodeep';
      if (def.big && !t.ocean && t.size < AA.BIG_SIZE) return 'big';
    }
    else if (def.deep === 1 && !t.deep) return 'deep';                // Tiefsee-Krabbler (Runde 10): nur ins Tiefsee-Becken
    const w = AA.waterOf(def);
    return w === 'both' || w === t.water ? null : 'water';
  };
  AA.livesIn = function (def, t) { return !AA.whyNot(def, t); };
  AA.wide = function (t) { return !!(t.ocean || t.deep); };      // Meeres- und Tiefsee-Becken: füllen den ganzen Bildschirm, feste Größe
  AA.tankIco = function (t) { return t.ocean ? '🦈' : (t.deep ? '🌌' : AA.WATER[t.water].ico); };
  AA.FRESH_TANK = { price: [150, 200, 300, 400], lvl: [4, 6, 9, 12] };      // die Stufen 150/175 Gallonen rechnet AA.tankReq (Runde 20f)

  /* ---------- Fische ----------
     lvl/price/sell/hours stammen aus der Arten-Tabelle des Vorbilds – bei Arten, die es dort nicht gibt, aus der jeweils freien Stufe
     dieser Tabelle (Kalmar, Riffhai und Schildkröte: eigene Werte). Genaue Zuordnung: docs/MECHANIK.md.
     hours = Stunden bis erwachsen im Vorbild – seit Runde 15 nur noch Herkunft: die echten Zeiten kommen aus AA.TEMPO (nach Level, siehe unten).
     Paarung kostet den halben Kaufpreis.
     len   = Breite des erwachsenen Sprites im Becken in Pixeln, speed = Schwimmtempo. */
  AA.FISH = [
    { id: 'auriga', name: 'Auriga-Falterfisch', lvl: 1, price: 14, sell: 16, hours: 8, len: 108, speed: 46, egg: '#ffd23f',
      info: 'Gelb-weiß mit schwarzer Augenbinde. Der perfekte Einsteiger.' },
    { id: 'clown', name: 'Clownfisch', home: ['anemone'], lvl: 1, price: 16, sell: 18, hours: 6, len: 104, speed: 46, egg: '#ff8a1f',
      info: 'Der Klassiker. Kuschelt am liebsten in der Anemone.' },
    { id: 'flameback', name: 'Flammenrücken-Zwergkaiser', lvl: 2, price: 19, sell: 22, hours: 10, len: 100, speed: 50, egg: '#2a3bff',
      info: 'Blauer Körper, feuriger Rücken – klein, aber oho.' },
    { id: 'lemonpeel', name: 'Zitronen-Zwergkaiser', lvl: 2, price: 27, sell: 31, hours: 10, len: 104, speed: 50, egg: '#ffe600',
      info: 'Knallgelb mit braunem Fleck ums Auge. Gute Laune auf Flossen.' },
    { id: 'gramma', name: 'Königs-Feenbarsch', lvl: 3, price: 23, sell: 27, hours: 16, len: 104, speed: 54, egg: '#c026d3',
      info: 'Vorne lila, hinten gold. Liebt Höhlen und Verstecke.' },
    { id: 'guppy', name: 'Guppy', lvl: 4, water: 'fresh', price: 28, sell: 32, hours: 16, len: 92, speed: 52, egg: '#ff6a2a',
      info: 'Klein, bunt und mit einem Fächerschwanz wie eine Flagge.' },
    { id: 'platy', name: 'Platy', lvl: 4, water: 'fresh', price: 26, sell: 30, hours: 14, len: 92, speed: 50, egg: '#ff4a1a',
      info: 'Knallrot mit schwarzen Flossen. Friedlich, robust – der ideale Start ins Süßwasser.' },
    { id: 'chromis', name: 'Grüner Chromis', lvl: 4, price: 27, sell: 31, hours: 14, len: 94, speed: 60, egg: '#59d9c0',
      info: 'Schimmert zwischen Mint und Himmelblau. Genügsam – perfekt für den Anfang.' },
    { id: 'neon', name: 'Neonsalmler', lvl: 5, water: 'fresh', price: 30, sell: 36, hours: 18, len: 84, speed: 62, egg: '#19b5ff',
      info: 'Leuchtet wie eine Reklame: blauer Streifen, rotes Heck.' },
    { id: 'blenny', name: 'Zweifarben-Schleimfisch', lvl: 5, price: 30, sell: 35, hours: 16, len: 110, speed: 42, egg: '#ff8a1f',
      info: 'Vorn dunkelviolett, hinten orange, obendrauf zwei Antennen. Guckt gern aus Höhlen.' },
    { id: 'yellowtang', name: 'Gelber Segelflosser', lvl: 6, price: 34, sell: 39, hours: 12, len: 110, speed: 54, egg: '#ffe21a',
      info: 'Zitronengelb von Kopf bis Flosse – gute Laune zum Schwimmen.' },
    { id: 'damsel', name: 'Gelbschwanz-Demoiselle', lvl: 6, price: 33, sell: 39, hours: 18, len: 96, speed: 60, egg: '#2563eb',
      info: 'Flinker blauer Flitzer mit gelbem Schwanz.' },
    { id: 'danio', name: 'Zebrabärbling', lvl: 6, water: 'fresh', price: 32, sell: 37, hours: 16, len: 90, speed: 66, egg: '#2b4bd6',
      info: 'Blau-weiß gestreifter Flitzer, der nie stillhält.' },
    { id: 'mandarin', name: 'Mandarinfisch', lvl: 7, price: 35, sell: 40, hours: 19, len: 108, speed: 36, egg: '#16b8a6',
      info: 'Wildes Muster in Blau, Orange und Türkis – ein echtes Sammlerstück.' },
    { id: 'molly', name: 'Black Molly', lvl: 7, water: 'fresh', price: 36, sell: 41, hours: 18, len: 100, speed: 46, egg: '#3a3a44',
      info: 'Samtschwarz von Kopf bis Schwanz – der Smoking unter den Fischen.' },
    { id: 'firefish', name: 'Feuer-Schwertgrundel', lvl: 8, price: 38, sell: 44, hours: 20, len: 112, speed: 58, egg: '#ff5a2a',
      info: 'Vorne weiß, hinten Feuer – und eine Antenne obendrauf.' },
    { id: 'swordtail', name: 'Schwertträger', lvl: 8, water: 'fresh', price: 39, sell: 45, hours: 20, len: 126, speed: 56, egg: '#b5d936',
      info: 'Trägt sein gelbes Schwert stolz am Schwanz spazieren.' },
    { id: 'hawkfish', name: 'Langnasen-Büschelbarsch', lvl: 9, price: 40, sell: 46, hours: 24, len: 116, speed: 44, egg: '#ff5a5a',
      info: 'Rot kariert mit spitzer Schnauze. Sitzt gern auf Korallen.' },
    { id: 'cory', name: 'Panda-Panzerwels', hab: 'bottom', lvl: 9, water: 'fresh', price: 41, sell: 47, hours: 22, len: 96, speed: 38, egg: '#f3c9b8',
      info: 'Gründelt mit seinen Barteln über den Boden. Augenmaske wie ein Panda.' },
    { id: 'skalar', name: 'Skalar', lvl: 10, water: 'fresh', price: 43, sell: 49, hours: 20, len: 86, speed: 36, egg: '#cfd3dc',
      info: 'Hoch wie ein Segel, gestreift wie ein Zebra. Der Klassiker aus dem Süßwasser.' },
    { id: 'banggai', name: 'Banggai-Kardinalbarsch', lvl: 11, price: 49, sell: 56, hours: 12, len: 100, speed: 38, egg: '#9aa0ad',
      info: 'Silber mit schwarzen Bändern und gepunkteten Flossen. Sehr elegant.' },
    { id: 'ancistrus', name: 'Antennenwels', hab: 'bottom', lvl: 11, water: 'fresh', price: 47, sell: 54, hours: 24, len: 118, speed: 30, egg: '#8a4a1c',
      info: 'Brauner Brummer mit Geweih auf der Nase. Raspelt am liebsten an Holz und Algen.' },
    { id: 'goldfish', name: 'Goldfisch', lvl: 12, water: 'fresh', price: 49, sell: 56, hours: 20, len: 112, speed: 34, egg: '#ffa31a',
      info: 'Rund, orange, gemütlich. Frisst für drei.' },
    { id: 'betta', name: 'Kampffisch', lvl: 13, water: 'fresh', price: 53, sell: 62, hours: 24, len: 128, speed: 32, egg: '#e11d48',
      info: 'Schleierflossen wie ein Ballkleid. Ein kleiner Angeber.' },
    { id: 'discus', name: 'Diskus', lvl: 14, water: 'fresh', price: 62, sell: 75, hours: 36, len: 108, speed: 32, egg: '#ff4a1f',
      info: 'Rund wie eine Scheibe, mit türkisen Wellen. Der König des Amazonas.' },
    { id: 'copperband', name: 'Kupferstreifen-Pinzettfisch', lvl: 16, price: 70, sell: 81, hours: 28, len: 116, speed: 46, egg: '#ff8a1f',
      info: 'Orange Streifen und eine Pinzetten-Schnauze, die in jede Ritze passt.' },
    { id: 'tigerbarb', name: 'Sumatrabarbe', lvl: 16, water: 'fresh', price: 72, sell: 83, hours: 26, len: 100, speed: 62, egg: '#ffb21a',
      info: 'Gold mit vier schwarzen Binden – frech, flink und gern in der Gruppe.' },
    { id: 'ram', name: 'Schmetterlingsbuntbarsch', lvl: 17, water: 'fresh', price: 78, sell: 90, hours: 28, len: 100, speed: 40, egg: '#58b9ff',
      info: 'Gelb, blau, rot gesäumt: ein kleiner Buntbarsch wie aus dem Malkasten.' },
    { id: 'foxface', name: 'Fuchsgesicht', lvl: 17, price: 76, sell: 87, hours: 28, len: 124, speed: 48, egg: '#ffe21a',
      info: 'Zitronengelb mit schwarz-weißer Fuchsmaske und Stachelkamm auf dem Rücken.' },
    { id: 'bluetang', name: 'Paletten-Doktorfisch', lvl: 18, price: 81, sell: 94, hours: 28, len: 124, speed: 56, egg: '#1d4ed8',
      info: 'Königsblau mit schwarzer Palette auf der Flanke und gelbem Schwanz.' },
    { id: 'clownloach', name: 'Prachtschmerle', hab: 'bottom', lvl: 19, water: 'fresh', price: 88, sell: 101, hours: 30, len: 122, speed: 52, egg: '#ff8a00',
      info: 'Orange mit schwarzen Keilen. Legt sich zum Schlafen gern einfach auf die Seite.' },
    { id: 'tuskfish', name: 'Harlekin-Lippfisch', lvl: 20, price: 92, sell: 106, hours: 32, len: 124, speed: 50, egg: '#ff6a00',
      info: 'Orange-blau gestreift – und ja, die Zähne sind wirklich blau.' },
    { id: 'parrotfish', name: 'Papageifisch', lvl: 21, price: 99, sell: 114, hours: 32, len: 134, speed: 48, egg: '#19e0b0',
      info: 'Türkis und pink, mit Schnabel. Knabbert an Korallen und macht daraus Sand.' },
    { id: 'pantodon', name: 'Afrikanischer Schmetterlingsfisch', lvl: 22, water: 'fresh', price: 112, sell: 129, hours: 32, len: 118, speed: 30, egg: '#8a7a3a',
      info: 'Treibt wie ein Blatt unter der Oberfläche – mit Flossen wie Flügeln.' },
    { id: 'butterfly', name: 'Sattelfleck-Schmetterlingsfisch', lvl: 22, price: 110, sell: 126, hours: 32, len: 118, speed: 46, egg: '#ffb21a',
      info: 'Blaugrau mit schwarzem Sattel und orangefarbenem Kinn – ein Juwel fürs Riff.' },
    { id: 'wrasse', name: 'Lippfisch', lvl: 23, price: 125, sell: 142, hours: 28, len: 132, speed: 64, egg: '#1fd6b2',
      info: 'Schlank, türkis-pink gestreift und immer in Eile.' },
    { id: 'koi', name: 'Koi', lvl: 24, water: 'fresh', price: 139, sell: 159, hours: 36, len: 136, speed: 40, egg: '#ff5a2a',
      info: 'Weiß mit roten Flecken und Barteln. Bringt angeblich Glück.' },
    { id: 'boxfish', name: 'Kofferfisch', lvl: 25, price: 150, sell: 172, hours: 34, len: 112, speed: 30, egg: '#ffd21f',
      info: 'Ein gelber Würfel mit Punkten. Schwimmt wie ein kleiner Hubschrauber.' },
    { id: 'emperor', name: 'Imperator-Kaiserfisch', lvl: 26, price: 160, sell: 183, hours: 36, len: 130, speed: 44, egg: '#2447d6',
      info: 'Blau-gelb gestreift mit dunkler Maske. Majestät persönlich.' },
    { id: 'axolotl', name: 'Axolotl', hab: 'bottom', lvl: 26, water: 'fresh', price: 165, sell: 189, hours: 40, len: 138, speed: 26, egg: '#ff9ec4',
      info: 'Rosa Lurch mit Kiemenbüscheln und Dauerlächeln. Kein Fisch, aber alle lieben ihn.' },
    { id: 'trigger', name: 'Clown-Drückerfisch', lvl: 27, price: 173, sell: 200, hours: 48, len: 130, speed: 44, egg: '#3b3b3b',
      info: 'Schwarz mit weißen Tupfen und gelbem Maul – unverwechselbar.' },
    { id: 'moorish', name: 'Halfterfisch', lvl: 28, price: 184, sell: 212, hours: 48, len: 124, speed: 46, egg: '#f5c400',
      info: 'Elegante Streifen und eine lange Rückenfahne.' },
    { id: 'piranha', name: 'Roter Piranha', lvl: 29, water: 'fresh', price: 230, sell: 262, hours: 44, len: 122, speed: 54, egg: '#e02424',
      info: 'Roter Bauch, viele Zähne, schlechter Ruf – dabei eher schreckhaft.' },
    { id: 'picasso', name: 'Picasso-Drückerfisch', lvl: 30, price: 260, sell: 295, hours: 42, len: 126, speed: 44, egg: '#f1d39b',
      info: 'Sieht aus wie gemalt: blaue Lippe, gelbe Wange, brauner Keil.' },
    { id: 'lion', name: 'Rotfeuerfisch', lvl: 31, price: 280, sell: 319, hours: 48, len: 130, speed: 28, egg: '#c8452b',
      info: 'Majestätisch gestreift und gefächert. Der König des Riffs.' },
    { id: 'aal', name: 'Aal', hab: 'lurk', lvl: 32, water: 'fresh', price: 340, sell: 386, hours: 48, len: 220, speed: 36, egg: '#9aa82c',
      info: 'Oliv oben, gelb unten, lang wie ein Schnürsenkel. Schlängelt sich durchs ganze Becken.' },
    { id: 'seahorse', name: 'Seepferdchen', lvl: 33, price: 412, sell: 466, hours: 32, len: 62, speed: 27, egg: '#ffc21a',
      info: 'Schwimmt aufrecht und ganz gemächlich – mit Krönchen und Ringelschwanz.' },
    { id: 'squid', name: 'Kalmar', lvl: 34, price: 450, sell: 510, hours: 36, len: 78, speed: 40, egg: '#c79cf0',
      info: 'Lila, neugierig, viele Arme. Schwebt wie ein kleines Raumschiff.' },
    { id: 'jellyfish', name: 'Qualle', hab: 'open', lvl: 35, price: 655, sell: 736, hours: 32, len: 84, speed: 30, egg: '#ff8fd8',
      info: 'Rosa Schirm, wehende Tentakel. Pulsiert tiefenentspannt durchs Becken.' },
    { id: 'snakehead', name: 'Regenbogen-Schlangenkopf', lvl: 36, water: 'fresh', price: 720, sell: 812, hours: 52, len: 178, speed: 42, egg: '#ff6a1f',
      info: 'Raubfisch mit Schlangenkopf – orange getupft, blau gesäumt, immer auf der Lauer.' },
    { id: 'powderblue', name: 'Weißkehl-Doktorfisch', lvl: 37, price: 819, sell: 917, hours: 32, len: 128, speed: 54, egg: '#3aa0ff',
      info: 'Puderblau mit schwarzer Maske und gelber Rückenflosse.' },
    { id: 'eel', name: 'Schneeflocken-Muräne', hab: 'lurk', lvl: 38, price: 1153, sell: 1291, hours: 32, len: 236, speed: 34, egg: '#f2e6c8',
      info: 'Schlängelt sich wie ein Band durchs Wasser. Guckt streng, ist aber lieb.' },
    { id: 'flameangel', name: 'Flammen-Zwergkaiser', lvl: 39, price: 997, sell: 1114, hours: 32, len: 108, speed: 50, egg: '#ff2a1a',
      info: 'Feuerrot mit schwarzen Streifen und blauem Saum. Ein echter Hingucker.' },
    { id: 'angler', name: 'Anglerfisch', lvl: 40, price: 1500, sell: 1696, hours: 72, len: 150, speed: 26, egg: '#6b7280',
      info: 'Aus der Tiefsee, mit eigener Laterne. Das Prunkstück jeder Sammlung.' },
    { id: 'ray', name: 'Adlerrochen', ocean: true, lvl: 41, price: 1700, sell: 1919, hours: 72, len: 190, speed: 40, egg: '#2447d6',
      info: 'Gleitet mit Flügelschlägen durchs Becken wie ein Vogel durch die Luft.' },
    { id: 'arowana', name: 'Arowana', lvl: 42, water: 'fresh', price: 1900, sell: 2140, hours: 72, len: 196, speed: 44, egg: '#ff5a1a',
      info: 'Der Drachenfisch: Schuppen wie Münzen, zwei Barteln, majestätischer Auftritt.' },
    { id: 'catshark', name: 'Katzenhai', hab: 'bottom', ocean: true, lvl: 43, price: 2100, sell: 2365, hours: 72, len: 210, speed: 40, egg: '#c9a77a',
      info: 'Kleiner, getupfter Hai, der am liebsten dicht über dem Boden streift.' },
    { id: 'shark', name: 'Schwarzspitzen-Riffhai', ocean: true, lvl: 45, price: 2600, sell: 2930, hours: 72, len: 226, speed: 52, egg: '#9aa9be',
      info: 'Der Chef im Becken – grinst aber die ganze Zeit.' },
    /* ---------- Runde 6: Zucht- und Speisefische (eigene Werte, an die Nachbarn in der Tabelle angelehnt) ----------
       hab = Lebensraum (bottom = am Grund, lurk = am Grund und gern versteckt, open = Freiwasser), home = hält sich bei dieser Deko auf,
       ocean = nur im Meeresbecken, water 'both' = lebt in beiden Wassern, caviar = Weibchen geben Kaviar (AA.CAVIAR). */
    { id: 'carp', name: 'Karpfen', lvl: 6, water: 'fresh', price: 34, sell: 39, hours: 16, len: 132, speed: 38, egg: '#c9a227',
      info: 'Schuppenkarpfen – die Grundform. Aus seinen Eiern schlüpfen sechs Zuchtformen, vom Wildkarpfen bis zum Schwarzen Karpfen.' },
    { id: 'tench', name: 'Schleie', lvl: 7, water: 'fresh', price: 38, sell: 44, hours: 18, len: 118, speed: 34, egg: '#8a8f2a', hab: 'bottom',
      info: 'Olivgrün mit goldenem Bauch und roten Augen. Gründelt gemütlich am Boden.' },
    { id: 'trout', name: 'Regenbogenforelle', lvl: 12, water: 'fresh', price: 58, sell: 67, hours: 22, len: 140, speed: 60, egg: '#ff5fa2', hab: 'open',
      info: 'Silbern mit pinkem Band. Steht am liebsten mitten in der Strömung.' },
    { id: 'dorade', name: 'Dorade', lvl: 15, price: 66, sell: 76, hours: 24, len: 124, speed: 48, egg: '#ffd21f',
      info: 'Goldbrasse: silbern, mit goldenem Band zwischen den Augen.' },
    { id: 'pike', name: 'Hecht', lvl: 18, water: 'fresh', price: 84, sell: 97, hours: 28, len: 178, speed: 50, egg: '#8fa32a',
      info: 'Entenschnabel, Tarnflecken und ein Blitzstart. Der Räuber im Süßwasser.' },
    { id: 'salmon', name: 'Lachs', lvl: 22, water: 'both', price: 115, sell: 132, hours: 32, len: 160, speed: 62, egg: '#ff7a3c', hab: 'open',
      info: 'Wanderfisch: laicht nur im Süßwasser (gleich 3 Eier!), wird aber im Meerwasser zum wertvollen Meerlachs.' },
    { id: 'wels', name: 'Wels (Waller)', lvl: 27, water: 'fresh', price: 190, sell: 217, hours: 40, len: 210, speed: 30, egg: '#6b5a2a', hab: 'lurk',
      info: 'Breites Maul, lange Barteln. Liegt tagsüber im Versteck und wird riesig.' },
    { id: 'sturgeon', name: 'Stör', lvl: 28, water: 'fresh', price: 210, sell: 240, hours: 44, len: 216, speed: 34, egg: '#3a3a3a', hab: 'bottom', caviar: 'sturgeon',
      info: 'Ein Urzeitfisch mit Knochenplatten. Erwachsene Weibchen geben Kaviar – ernten statt verkaufen!' },
    { id: 'redtail', name: 'Rotflossen-Antennenwels', lvl: 29, water: 'fresh', price: 235, sell: 268, hours: 44, len: 170, speed: 40, egg: '#ff4a1a', hab: 'bottom',
      info: 'Dunkler Rücken, weißer Bauch, knallroter Schwanz – und Antennen wie ein Funkmast.' },
    { id: 'eleel', name: 'Zitteraal', lvl: 32, water: 'fresh', price: 345, sell: 392, hours: 48, len: 226, speed: 32, egg: '#ffc21a', hab: 'lurk',
      info: 'Steht unter Strom – bis zu 600 Volt. Lauert am Grund und kommt nur zum Fressen raus.' },
    { id: 'monkfish', name: 'Seeteufel', lvl: 36, price: 700, sell: 790, hours: 50, len: 150, speed: 24, egg: '#c98a4a', hab: 'bottom', front: true,
      info: 'Liegt platt am Boden und wedelt mit seiner Angel. Hässlich? Er findet sich super.' },
    { id: 'beluga', name: 'Beluga-Stör', lvl: 44, water: 'fresh', price: 2300, sell: 2590, hours: 80, len: 240, speed: 30, egg: '#22262e', hab: 'bottom', caviar: 'beluga',
      info: 'Der größte Stör. Sein Kaviar ist der teuerste der Welt – die Weibchen sind Gold wert.' },
    { id: 'swordfish', name: 'Schwertfisch', lvl: 47, price: 3100, sell: 3490, hours: 84, len: 250, speed: 66, egg: '#2a3bd6', hab: 'open', ocean: true,
      info: 'Pfeilschnell, mit Schwert auf der Nase. Braucht das große Meeresbecken.' },
    { id: 'arapaima', name: 'Arapaima', lvl: 48, water: 'fresh', price: 3400, sell: 3830, hours: 90, len: 240, speed: 34, egg: '#c22b2b',
      info: 'Einer der größten Süßwasserfische der Welt. Vorn oliv, hinten feuerrot.' },
    { id: 'turtle', name: 'Meeresschildkröte', ocean: true, lvl: 50, price: 4000, sell: 4500, hours: 96, len: 176, speed: 26, egg: '#9bd61a',
      info: 'Paddelt gemütlich und wird steinalt. Ein Prachtstück fürs Meeresbecken.' },
    /* ---------- Runde 9: 48 neue Arten (eigene Werte, an die Nachbarn in der Tabelle angelehnt) ----------
       suck   = Saugwels: klebt am Boden, an den Seitenscheiben und an der Frontscheibe (js/fish.js „suck“; Bilder _n/_o = ohne Mund, _u = Unterseite)
       inv    = schwimmt immer auf dem Rücken · still = bleibt an seinem Platz am Boden · grim = schaut immer gleich (kein „traurig“-Gesicht)
       cleaner = Putzerfisch: putzt andere Fische (macht Kranke gesund) · algae = bremst das Veralgen um diesen Anteil (je Art einmal, AA.fishAlgae)
       big    = braucht das große Becken (125 Gallonen) oder das Meeresbecken · ocean = nur Meeresbecken
       deep   = 1: nur im Tiefsee-Becken · 2: darf zusätzlich ins Tiefsee-Becken · glow = Leuchtfarbe im Dunkeln */
    // Süßwasser – Saugwelse
    { id: 'oto', name: 'Ohrgitter-Harnischwels', lvl: 5, water: 'fresh', price: 31, sell: 36, hours: 16, len: 84, speed: 34, egg: '#b9a441', hab: 'bottom', suck: true,
      info: 'Der kleine Otocinclus: klebt mit dem Saugmaul an Scheiben, Blättern und Steinen und raspelt Algen.' },
    { id: 'whiptail', name: 'Hexenwels', lvl: 8, water: 'fresh', price: 39, sell: 45, hours: 20, len: 150, speed: 26, egg: '#c9a06a', hab: 'bottom', suck: true,
      info: 'Lang, flach, sandfarben – liegt wie ein Zweig am Boden und hat eine Peitsche am Schwanz.' },
    { id: 'sturisoma', name: 'Störwels', lvl: 13, water: 'fresh', price: 54, sell: 62, hours: 24, len: 164, speed: 26, egg: '#e0a83c', hab: 'bottom', suck: true,
      info: 'Dünn wie ein Stöckchen, mit Sichelflosse und langen Fäden. Hängt am liebsten senkrecht an der Scheibe.' },
    { id: 'zebrapleco', name: 'Zebra-Harnischwels (L46)', lvl: 14, water: 'fresh', price: 64, sell: 76, hours: 30, len: 100, speed: 28, egg: '#dfe3ea', hab: 'bottom', suck: true,
      info: 'Schwarz-weiß gestreift wie ein Zebra. Kommt nur im Rio Xingu vor – der Star unter den L-Welsen.' },
    { id: 'upsidedown', name: 'Rückenschwimmender Kongowels', lvl: 15, water: 'fresh', price: 68, sell: 78, hours: 24, len: 96, speed: 40, egg: '#b98a5a', inv: true,
      info: 'Schwimmt sein Leben lang auf dem Rücken – deshalb ist bei ihm der Bauch dunkel und der Rücken hell. Hängt gern unter der Oberfläche.' },
    { id: 'grasscarp', name: 'Graskarpfen', lvl: 16, water: 'fresh', price: 74, sell: 85, hours: 26, len: 156, speed: 40, egg: '#8fae3c', algae: 0.5,
      info: 'Der Rasenmäher: frisst Algen und Pflanzen weg. Mit einem Graskarpfen veralgt das Becken nur halb so schnell.' },
    { id: 'goldnugget', name: 'Golden Nugget (L18)', lvl: 18, water: 'fresh', price: 83, sell: 96, hours: 28, len: 116, speed: 28, egg: '#ffd21f', hab: 'bottom', suck: true,
      info: 'Tiefschwarz mit gelben Punkten und goldenen Flossensäumen. Ein Schmuckstück aus dem Xingu.' },
    { id: 'gibbiceps', name: 'Wabenschilderwels', lvl: 20, water: 'fresh', price: 94, sell: 108, hours: 32, len: 156, speed: 28, egg: '#b8651f', hab: 'bottom', suck: true,
      info: 'Wabenmuster und ein Segel auf dem Rücken. Wird groß und saugt sich überall fest.' },
    { id: 'greenphantom', name: 'Grüner Phantomwels (L200)', lvl: 24, water: 'fresh', price: 140, sell: 160, hours: 36, len: 122, speed: 28, egg: '#9bd61a', hab: 'bottom', suck: true,
      info: 'Limettengrün von der Nase bis zum Schwanz – den übersieht keiner.' },
    { id: 'bluephantom', name: 'Blauer Phantomwels (L128)', lvl: 27, water: 'fresh', price: 178, sell: 204, hours: 40, len: 122, speed: 28, egg: '#2f6fd6', hab: 'bottom', suck: true,
      info: 'Stahlblau mit hellen Tupfen. Der seltene Bruder des Grünen Phantoms.' },
    { id: 'reticulatus', name: 'Netz-Stechrochen', lvl: 30, water: 'fresh', price: 255, sell: 290, hours: 44, len: 220, speed: 30, egg: '#a8894a', hab: 'bottom',
      info: 'Potamotrygon reticulata aus dem Amazonas: eine runde Scheibe mit Netzmuster, die über den Sand gleitet.' },
    { id: 'royalpleco', name: 'Königs-Harnischwels (L190)', lvl: 31, water: 'fresh', price: 285, sell: 325, hours: 46, len: 150, speed: 26, egg: '#9aa0a8', hab: 'bottom', suck: true,
      info: 'Grau mit Linien wie Holzmaserung und roten Augen. Raspelt wirklich Holz.' },
    { id: 'scarletpleco', name: 'Scharlachroter Kaktuswels (L25)', lvl: 35, water: 'fresh', price: 640, sell: 720, hours: 48, len: 160, speed: 28, egg: '#ff3a1a', hab: 'bottom', suck: true,
      info: 'Schwarzer Panzer, feuerrote Flossen. Der teuerste Saugwels im Regal.' },
    { id: 'leopoldi', name: 'Leopoldi-Rochen', lvl: 40, water: 'fresh', price: 1550, sell: 1750, hours: 72, len: 250, speed: 30, egg: '#1c1c22', hab: 'bottom',
      info: 'Potamotrygon leopoldi, der „Schwarze Diamant“ aus dem Rio Xingu: tiefschwarz mit weißen Punkten. Der König der Süßwasserrochen.' },
    // Meerwasser – normale Becken
    { id: 'neongoby', name: 'Neon-Putzergrundel', lvl: 9, price: 42, sell: 48, hours: 20, len: 76, speed: 44, egg: '#19b5ff', cleaner: true, algae: 0.1,
      info: 'Winzig, schwarz, mit leuchtend blauem Streifen. Putzt andere Fische – und zupft nebenbei Algen (10 % weniger Schmutz).' },
    { id: 'cleanerwrasse', name: 'Putzerlippfisch', lvl: 12, price: 52, sell: 60, hours: 22, len: 100, speed: 58, egg: '#3aa0ff', cleaner: true, algae: 0.1,
      info: 'Der Arzt am Riff: schwimmt zu den anderen Fischen und putzt sie – Kranke werden gesund. Dazu 10 % weniger Algen.' },
    { id: 'stonefish', name: 'Steinfisch', lvl: 28, price: 200, sell: 228, hours: 44, len: 130, speed: 16, egg: '#8a7a6a', hab: 'bottom', still: true, grim: true, front: true,
      info: 'Sieht aus wie ein bewachsener Stein und bewegt sich fast nie. Schaut immer grimmig – auch wenn er bestens gelaunt ist.' },
    { id: 'sepia', name: 'Sepia', lvl: 32, price: 360, sell: 408, hours: 36, len: 92, speed: 34, egg: '#c9a06a',
      info: 'Der Gewöhnliche Tintenfisch: gestreifter Mantel, wellender Flossensaum, zehn Arme. Lässt sich mit dem Kalmar kreuzen.' },
    { id: 'bambooshark', name: 'Bambushai', lvl: 33, price: 430, sell: 486, hours: 50, len: 200, speed: 36, egg: '#b98a5a', hab: 'bottom', big: true,
      info: 'Braun gebänderter Bodenhai mit Barteln. Friedlich – braucht aber das große Becken.' },
    { id: 'johndory', name: 'St. Petersfisch', lvl: 34, price: 480, sell: 542, hours: 44, len: 128, speed: 30, egg: '#b9a441',
      info: 'Hoch wie ein Teller, mit Stachelkamm und dem dunklen „Daumenabdruck“ auf der Flanke.' },
    { id: 'bluesquid', name: 'Blauer Kalmar', lvl: 37, price: 850, sell: 950, hours: 36, len: 78, speed: 40, egg: '#5aa8ff', deep: 2, glow: '#6ab8ff',
      info: 'Der Kalmar in Ozeanblau. Fühlt sich auch im Tiefsee-Becken wohl – und ist ein Elternteil für Hybride.' },
    { id: 'epaulette', name: 'Epaulettenhai', lvl: 38, price: 1100, sell: 1232, hours: 56, len: 196, speed: 34, egg: '#d9c09a', hab: 'bottom', big: true,
      info: 'Läuft auf seinen Flossen über den Grund. Der große schwarze Fleck ist seine „Schulterklappe“. Braucht das große Becken.' },
    { id: 'hornshark', name: 'Port-Jackson-Stierkopfhai', lvl: 41, price: 1750, sell: 1970, hours: 64, len: 190, speed: 34, egg: '#a89a8a', hab: 'bottom', big: true,
      info: 'Eckiger Kopf, Geschirr-Muster, zwei Stacheln vor den Rückenflossen. Der urigste der kleinen Haie – fürs große Becken.' },
    // Meeresbecken
    { id: 'barracuda', name: 'Barrakuda', ocean: true, lvl: 43, price: 2150, sell: 2420, hours: 72, len: 260, speed: 62, egg: '#c9d3dc', hab: 'open',
      info: 'Silberner Pfeil mit Unterbiss. Steht reglos im Freiwasser – und ist dann plötzlich woanders.' },
    { id: 'sawfish', name: 'Sägerochen', ocean: true, lvl: 44, price: 2350, sell: 2640, hours: 80, len: 300, speed: 36, egg: '#b8a878', hab: 'bottom',
      info: 'Halb Hai, halb Rochen – mit einer Säge voller Zähne vor der Nase. Nur fürs Meeresbecken.' },
    { id: 'tuna', name: 'Blauflossen-Thunfisch', ocean: true, lvl: 45, price: 2650, sell: 2985, hours: 76, len: 250, speed: 70, egg: '#2a3bd6', hab: 'open',
      info: 'Ein Torpedo aus Muskeln. Der schnellste Dauerschwimmer im Meeresbecken.' },
    { id: 'hammerhead', name: 'Hammerhai', ocean: true, lvl: 46, price: 2850, sell: 3210, hours: 84, len: 270, speed: 50, egg: '#a8a08a',
      info: 'Der Kopf wie ein Hammer, die Augen ganz außen. Sieht damit fast alles.' },
    { id: 'napoleon', name: 'Napoleon-Lippfisch', ocean: true, lvl: 46, price: 2900, sell: 3260, hours: 84, len: 240, speed: 30, egg: '#19b8a8',
      info: 'Riesiger blaugrüner Lippfisch mit Buckel auf der Stirn und dicken Lippen. Sanft wie ein Hund.' },
    { id: 'goliath', name: 'Goliath-Zackenbarsch', ocean: true, lvl: 47, price: 3150, sell: 3540, hours: 88, len: 260, speed: 26, egg: '#a8894a',
      info: 'Ein Koloss mit Riesenmaul – wird so schwer wie ein Klavier. Nur fürs Meeresbecken.' },
    { id: 'mola', name: 'Mondfisch', ocean: true, lvl: 48, price: 3450, sell: 3880, hours: 90, len: 210, speed: 22, egg: '#9ab8d6', hab: 'open',
      info: 'Ein schwimmender Kopf: der schwerste Knochenfisch der Welt. Rudert gemütlich mit Rücken- und Afterflosse.' },
    { id: 'thresher', name: 'Fuchshai', ocean: true, lvl: 48, price: 3500, sell: 3940, hours: 90, len: 380, speed: 54, egg: '#7a6ad6', hab: 'open',
      info: 'Der Schwanz ist so lang wie der ganze Hai – damit betäubt er seine Beute.' },
    { id: 'tigershark', name: 'Tigerhai', ocean: true, lvl: 49, price: 3700, sell: 4160, hours: 92, len: 300, speed: 48, egg: '#7a9a9a',
      info: 'Breite Schnauze, Tigerstreifen, riesiger Appetit. Frisst angeblich sogar Nummernschilder.' },
    { id: 'manta', name: 'Mantarochen', ocean: true, lvl: 50, price: 4100, sell: 4600, hours: 96, len: 330, speed: 38, egg: '#22262e', hab: 'open',
      info: 'Fliegt mit sieben Metern Spannweite durchs Wasser. Frisst nur Plankton – ein sanfter Riese.' },
    { id: 'greatwhite', name: 'Weißer Hai', ocean: true, lvl: 51, price: 4600, sell: 5170, hours: 100, len: 330, speed: 52, egg: '#8a96a6',
      info: 'Der berühmteste Hai der Welt. Hier grinst er nur – solange er satt ist.' },
    { id: 'whaleshark', name: 'Walhai', ocean: true, lvl: 52, price: 5200, sell: 5850, hours: 110, len: 430, speed: 30, egg: '#6a8ab8', hab: 'open',
      info: 'Der größte Fisch der Welt: gepunktet, riesig, völlig harmlos. Der König des Meeresbeckens.' },
    // Tiefsee-Becken
    { id: 'lanternfish', name: 'Laternenfisch', deep: 1, lvl: 36, price: 690, sell: 776, hours: 30, len: 84, speed: 50, egg: '#3a5ad6', glow: '#7df2ff',
      info: 'Klein, mit Reihen von Leuchtpunkten am Bauch. Im Schwarm funkelt die ganze Tiefsee.' },
    { id: 'hatchetfish', name: 'Tiefsee-Beilfisch', deep: 1, lvl: 38, price: 1050, sell: 1180, hours: 34, len: 84, speed: 34, egg: '#c9d6e6', glow: '#a8d8ff',
      info: 'Dünn wie eine Klinge, silbern wie ein Spiegel. Schaut mit Röhrenaugen immer nach oben.' },
    { id: 'blobfish', name: 'Blobfisch', deep: 1, lvl: 39, price: 1020, sell: 1146, hours: 40, len: 118, speed: 16, egg: '#f2b8c6', hab: 'bottom', grim: true, front: true,
      info: 'Der berühmteste Schmoller der Tiefsee. Guckt immer so – es geht ihm gut, wirklich.' },
    { id: 'viperfish', name: 'Viperfisch', deep: 1, lvl: 41, price: 1720, sell: 1936, hours: 60, len: 150, speed: 44, egg: '#2a3a5a', glow: '#8ad8ff',
      info: 'Zähne so lang, dass das Maul nicht zugeht. Lockt Beute mit einem Lämpchen an der Rückenflosse.' },
    { id: 'gulper', name: 'Pelikanaal', deep: 1, lvl: 43, price: 2120, sell: 2386, hours: 66, len: 240, speed: 30, egg: '#22222a', glow: '#ff7ab8',
      info: 'Ein Maul wie ein Kescher an einem Faden von Körper. Am Schwanzende glimmt ein rosa Licht.' },
    { id: 'dumbo', name: 'Dumbo-Oktopus', deep: 1, lvl: 44, price: 2400, sell: 2700, hours: 60, len: 96, speed: 24, egg: '#ff9a7a', glow: '#ffb49a',
      info: 'Flattert mit seinen Ohren-Flossen durch die Dunkelheit. Der niedlichste Bewohner der Tiefsee.' },
    { id: 'barreleye', name: 'Gespensterfisch', deep: 1, lvl: 45, price: 2620, sell: 2950, hours: 70, len: 120, speed: 26, egg: '#6a5a3a', glow: '#8aff9a',
      info: 'Der Kopf ist durchsichtig wie eine Glaskuppel – man sieht ihm beim Gucken zu.' },
    { id: 'fangtooth', name: 'Fangzahnfisch', deep: 1, lvl: 47, price: 3120, sell: 3510, hours: 80, len: 124, speed: 36, egg: '#3a2a22',
      info: 'Im Verhältnis zur Körpergröße die längsten Zähne im ganzen Ozean. Sieht gefährlicher aus, als er ist.' },
    { id: 'dragonfish', name: 'Schwarzer Drachenfisch', deep: 1, lvl: 49, price: 3680, sell: 4140, hours: 86, len: 230, speed: 40, egg: '#1a1a22', glow: '#5af0e0',
      info: 'Schwarz wie die Tiefe, mit Leuchtangel am Kinn und roten Suchscheinwerfern unter den Augen.' },
    { id: 'chimaera', name: 'Seekatze (Chimäre)', deep: 1, lvl: 50, price: 4050, sell: 4560, hours: 92, len: 220, speed: 34, egg: '#b8a8d6', glow: '#c8b8ff',
      info: 'Der Geisterhai: Hasenkopf, Flügelflossen, Rattenschwanz. Älter als die Dinosaurier.' },
    { id: 'frilledshark', name: 'Kragenhai', deep: 1, lvl: 52, price: 5100, sell: 5740, hours: 104, len: 280, speed: 32, egg: '#6a4a3a',
      info: 'Ein Hai wie ein Aal, mit Rüschenkragen aus Kiemen. Ein lebendes Fossil aus 1000 Metern Tiefe.' },
    { id: 'oarfish', name: 'Riemenfisch', deep: 1, lvl: 53, price: 5800, sell: 6520, hours: 112, len: 430, speed: 30, egg: '#d6dce6', hab: 'open', glow: '#ff8a8a',
      info: 'Der längste Knochenfisch der Welt: ein silbernes Band mit roter Krone. Um ihn ranken sich die Seeschlangen-Legenden.' },
    { id: 'coelacanth', name: 'Quastenflosser', deep: 1, lvl: 55, price: 9500, sell: 10700, hours: 144, len: 300, speed: 22, egg: '#2a4a8a', glow: '#9ab8ff',
      info: 'Galt 66 Millionen Jahre als ausgestorben – bis 1938 einer im Netz lag. Der ultimative letzte Fisch: Wer ihn hat, hat alles.' },
    /* ---------- Runde 12: Adria – fünf Fische der Felsküste (Meerwasser, normale Becken) ---------- */
    { id: 'bream', name: 'Zweibinden-Brasse', lvl: 14, price: 60, sell: 70, hours: 24, len: 128, speed: 50, egg: '#d8dce2',
      info: 'Silbern mit zwei schwarzen Bändern – eins hinter dem Kopf, eins am Schwanz. Zieht in kleinen Trupps über die Felsküsten der Adria.' },
    { id: 'weever', name: 'Petermännchen', lvl: 19, price: 104, sell: 120, hours: 30, len: 120, speed: 18, egg: '#e8c46a', hab: 'bottom', still: true, grim: true, front: true,
      info: 'Gräbt sich an Adria-Stränden in den Sand, nur die Augen schauen raus – und die gucken grundsätzlich grimmig. Chillt am liebsten am Boden.' },
    { id: 'scorpionfish', name: 'Großer Drachenkopf', lvl: 21, price: 122, sell: 140, hours: 32, len: 120, speed: 22, egg: '#e8452a', hab: 'bottom', front: true,
      info: 'Knallrot mit Flecken und Hautlappen über den Augen. Lauert reglos zwischen den Steinen der Adria – die Rückenstacheln sind giftig.' },
    { id: 'garfish', name: 'Hornhecht', lvl: 24, price: 140, sell: 160, hours: 30, len: 240, speed: 64, egg: '#2ab0a8', hab: 'open',
      info: 'Lang wie ein Bleistift, mit einem Schnabel voller Zähnchen. Seine Gräten sind grün – kein Witz, das macht ein Farbstoff.' },
    { id: 'medmoray', name: 'Mittelmeer-Muräne', lvl: 33, price: 420, sell: 475, hours: 38, len: 250, speed: 30, egg: '#5a3a1e', hab: 'lurk',
      info: 'Dunkelbraun mit gelben Tupfen – schon die alten Römer hielten sie in Teichen. Wohnt in Felsspalten und schaut mit offenem Maul heraus.' },
    /* ---------- Runde 12: besondere Tiere – gibt es nur für Perlen (pearlOnly), ab einem Level ---------- */
    { id: 'frog', name: 'Wasserfrosch', lvl: 15, water: 'fresh', special: true, pearlOnly: true, pearls: 12, price: 120, sell: 136, hours: 30, len: 120, speed: 32, egg: '#7ad63a',
      info: 'Paddelt mit kräftigen Beinstößen durchs Becken. Als Baby ist er eine kleine Kaulquappe mit ersten Beinchen.' },
    { id: 'hamster', name: 'Tauch-Hamster', lvl: 20, water: 'both', special: true, pearlOnly: true, pearls: 15, price: 170, sell: 192, hours: 36, len: 110, speed: 30, egg: '#ffb04a',
      info: 'Mit Taucherbrille, Schnorchel und Flossen. Keiner weiß, wie er ins Becken gekommen ist – aber er strampelt fröhlich mit.' },
    { id: 'otter', name: 'Fischotter', lvl: 25, water: 'fresh', special: true, pearlOnly: true, pearls: 20, price: 230, sell: 260, hours: 48, len: 150, speed: 44, egg: '#8a5a30',
      info: 'Verspielt, flink und immer neugierig. Rudert mit allen vier Pfoten und dreht Kringel durchs Wasser.' },
    { id: 'penguin', name: 'Pinguin', lvl: 30, water: 'salt', special: true, pearlOnly: true, pearls: 25, price: 300, sell: 340, hours: 56, len: 140, speed: 52, egg: '#eef2f6',
      info: 'An Land watschelt er, unter Wasser fliegt er – die Flügel sind seine Paddel.' },
    { id: 'seal', name: 'Seehund', lvl: 35, water: 'salt', special: true, pearlOnly: true, pearls: 30, price: 420, sell: 475, hours: 64, len: 190, speed: 40, egg: '#b8bcc4',
      info: 'Kulleraugen, Schnurrhaare, Speckröllchen. Paddelt mit den Vorderflossen und lässt sich gern treiben.' },
    /* ---------- Runde 20b: Bestell-Tiere und Quallen (eigene Werte, an die Nachbarn in der Tabelle angelehnt) ----------
       biter  = greift alle paar Minuten den Mauszeiger an (Handy: den letzten Fingertipp), abschaltbar in ⚙️ (settings.bite)
       venom  = giftig: andere Fische halten Abstand (js/fish.js) · jelly = Qualle (Puls-Rig „front“) · surface = treibt an der Oberfläche
       hop    = hüpft ruckartig über den Boden · sway = wiegt sich beim Schweben wie eine Pflanze · flash = klappt beim Klopfen die Flügel auf
       alpha  = halb durchsichtig · find = kommt erst ins Sammelbuch, wenn man das Tier im Becken antippt · rainbow = Regenbogen-Lichtwellen
       spines = stellt beim Klopfen die Stacheln auf · yawn = gähnt ab und zu */
    { id: 'flamegoby', name: 'Flammen-Garnelengrundel', lvl: 14, price: 64, sell: 74, hours: 24, len: 74, speed: 30, egg: '#ff5a1a', hab: 'bottom', hop: true,
      info: 'Klein, rot getupft und mit einer riesigen Rückenflosse wie eine Fahne. Hüpft ruckartig über den Boden – ein Flummi mit Flosse.' },
    { id: 'pyjama', name: 'Pyjama-Kardinalbarsch', carry: 'mouth', lvl: 16, price: 72, sell: 83, hours: 26, len: 78, speed: 20, egg: '#e8d820', school: true,
      info: 'Gelbes Gesicht, rote Augen, hinten getupft wie ein Schlafanzug. Schwebt fast reglos im Grüppchen – und die Väter brüten die Eier im Maul aus.' },
    { id: 'moonjelly', name: 'Mondqualle', lvl: 18, price: 84, sell: 97, hours: 28, len: 96, speed: 18, egg: '#c8a8f0', hab: 'open', jelly: true,
      info: 'Der Klassiker unter den Quallen: vier Ringe im Schirm, ein Saum aus feinen Fäden. Pulsiert gemütlich und ist völlig harmlos.' },
    { id: 'rabbitfish', name: 'Streifen-Kaninchenfisch', lvl: 20, price: 95, sell: 109, hours: 30, len: 124, speed: 44, egg: '#ffd84a', algae: 0.15, venom: true, spines: true,
      info: 'Goldene Längslinien und großer Appetit auf Algen: Das Becken veralgt 15 % langsamer. Bei Gefahr stellt er die giftigen Rückenstacheln auf.' },
    { id: 'ghostknife', name: 'Geistermesserfisch', lvl: 22, water: 'fresh', price: 114, sell: 131, hours: 32, len: 168, speed: 30, egg: '#22222e', hab: 'lurk',
      info: 'Schwarz wie die Nacht, mit weißer Nase und zwei Ringeln am Schwanz. Über seine lange Bauchflosse läuft eine Welle – so schwimmt er vorwärts UND rückwärts, ohne sich umzudrehen. Tagsüber versteckt, nachts unterwegs.' },
    { id: 'compass', name: 'Kompassqualle', lvl: 24, price: 142, sell: 163, hours: 34, len: 86, speed: 20, egg: '#c8783a', hab: 'open', jelly: true, venom: true,
      info: 'Braune Strahlen auf dem Schirm wie die Nadel eines Kompasses. Treibt im Sommer an der Adria – nicht anfassen, das brennt!' },
    { id: 'cowfish', name: 'Langhorn-Kofferfisch', lvl: 27, price: 176, sell: 203, hours: 40, len: 112, speed: 28, egg: '#ffd21f',
      info: 'Ein Kofferfisch mit Hörnern vorn und hinten – wie eine kleine Kuh. Schwirrt wie ein Hubschrauber durchs Becken; die Babys sind fast kugelrund.' },
    { id: 'gurnard', name: 'Fliegender Knurrhahn', lvl: 29, price: 240, sell: 274, hours: 42, len: 136, speed: 24, egg: '#3a8ad6', hab: 'bottom', flash: true,
      info: '„Läuft“ mit seinen Flossenfingern über den Boden. Klopfst du ans Glas, klappt er die riesigen blauen Flügelflossen auf – Schreck lass nach!' },
    // Runde 20c: Seeschlangen – eigenes Schlangen-Rig (js/snake.js): der Körper folgt dem Weg des Kopfes; Luftholen, Züngeln, Spurt, Einringeln
    { id: 'snake_laticauda', name: 'Gebänderte Seeschlange', lvl: 30, price: 265, sell: 302, hours: 44, len: 360, speed: 28, egg: '#3a6fd0', snake: true,
      info: 'Blau-schwarz geringelt, mit gelber Schnauze. Taucht alle ein, zwei Minuten zum Luftholen auf, züngelt neugierig und ruht am liebsten zusammengeringelt neben einem Felsen.' },
    { id: 'snake_belcher', name: 'Belcher-Seeschlange', lvl: 35, price: 660, sell: 742, hours: 46, len: 360, speed: 26, egg: '#e8d27a', snake: true, nosy: true,
      info: 'Hellgelb mit dunklen Bändern, die Ruhe selbst – und furchtbar neugierig: Immer wieder schlängelt sie sich an einen Fisch heran und züngelt ihn freundlich an.' },
    { id: 'snake_dubois', name: 'Dubois-Seeschlange', lvl: 39, price: 1060, sell: 1190, hours: 50, len: 360, speed: 28, egg: '#7a4a2a', snake: true, crevice: true,
      info: 'Braun-cremig gefleckt, eine Bodenjägerin: Sie schwimmt dicht über dem Grund und steckt den Kopf in jede Felsspalte – vielleicht versteckt sich da ja ein Snack.' },
    { id: 'snake_platurus', name: 'Gelbbauch-Seeschlange', lvl: 43, price: 2180, sell: 2450, hours: 54, len: 360, speed: 16, egg: '#ffd21f', snake: true, surface: true,
      info: 'Oben schwarz, unten knallgelb, der Ruderschwanz gefleckt – die einzige echte Hochsee-Schlange. Sie treibt faul an der Oberfläche und lässt sich von der Strömung schieben.' },
    // Runde 20d: Paris – fünf Fische von der französischen Speisekarte (Petersfisch, Seeteufel, Dorade, Seezunge, Steinbutt gibt es schon)
    { id: 'sardine', name: 'Sardine', lvl: 7, price: 36, sell: 42, hours: 16, len: 92, speed: 52, egg: '#7ab0d6', school: true,
      info: 'Silber-blau und nie allein: Sardinen schwimmen nur im Schwarm. In Frankreich kommen sie in die schönsten Dosen.' },
    { id: 'seabass', name: 'Wolfsbarsch (Loup de mer)', lvl: 11, price: 48, sell: 55, hours: 20, len: 132, speed: 46, egg: '#b8c4cc',
      info: 'Der Klassiker auf jeder Pariser Karte: „Loup de mer“. Silbern, schnell und immer ein bisschen hungrig.' },
    { id: 'redmullet', name: 'Rotbarbe (Rouget)', lvl: 13, price: 55, sell: 63, hours: 22, len: 118, speed: 34, egg: '#ff6a5a', hab: 'bottom',
      info: 'Rosa-rot mit zwei langen Barteln am Kinn. Gründelt damit im Sand nach Leckereien – überall, wo sie war, staubt es.' },
    { id: 'redgurnard', name: 'Roter Knurrhahn (Grondin)', lvl: 17, price: 78, sell: 90, hours: 26, len: 122, speed: 22, egg: '#ff4a2a', hab: 'bottom',
      info: 'Pflicht für jede echte Bouillabaisse. Er „läuft“ auf seinen Flossenfingern über den Grund und knurrt dabei leise.' },
    { id: 'zander', name: 'Zander (Sandre)', lvl: 19, water: 'fresh', price: 90, sell: 104, hours: 28, len: 140, speed: 40, egg: '#c8c890', eyeshine: '#d8ffb0',
      info: 'Ein Raubfisch aus der Seine mit großen Glasaugen. Nachts leuchten sie im Licht – damit sieht er auch im Trüben alles.' },
    { id: 'titan', name: 'Titan-Drückerfisch', lvl: 31, price: 290, sell: 330, hours: 48, len: 140, speed: 46, egg: '#9a9a2a', biter: true,
      info: 'Der Rambo des Riffs. Alle paar Minuten schießt er auf deinen Mauszeiger zu und beißt rein – Autsch! (Abschaltbar in ⚙️.) Manchmal lässt er Schmerzensgeld fallen.' },
    { id: 'yellowangler', name: 'Gelber Anglerfisch', lure: true, lvl: 33, price: 430, sell: 486, hours: 36, len: 116, speed: 14, egg: '#ffd21f', hab: 'bottom', still: true, front: true, yawn: true,
      info: 'Warzig, knallgelb und tiefenentspannt: chillt nur am Boden und wedelt mit seiner rosa Angel. Fällt Futter in die Nähe – schnapp! Schneller, als man gucken kann.' },
    { id: 'boxjelly', name: 'Würfelqualle', lvl: 36, price: 730, sell: 820, hours: 32, len: 66, speed: 36, egg: '#a8d8ff', hab: 'open', jelly: true, venom: true, alpha: 0.78,
      info: 'Die Seewespe: eckiger, fast unsichtbarer Schirm. Als einzige Qualle kann sie richtig steuern – sie hat sogar Augen. Die anderen Fische halten lieber Abstand.' },
    { id: 'irukandji', name: 'Irukandji-Qualle', lvl: 40, price: 1520, sell: 1715, hours: 50, len: 30, speed: 16, egg: '#ffc8e0', hab: 'open', jelly: true, venom: true, alpha: 0.55, find: true,
      info: 'Nicht größer als ein Fingernagel und fast unsichtbar. Ins Sammelbuch kommt sie erst, wenn du sie im Becken gefunden und angetippt hast!' },
    { id: 'seadragon', name: 'Seedrache (Fetzenfisch)', carry: 'tail', lvl: 42, price: 1950, sell: 2195, hours: 72, len: 150, speed: 14, egg: '#e8c43a', sway: true,
      info: 'Blatt-Lappen wie Tang am ganzen Körper: Er schwebt im Zeitlupentempo und wiegt sich wie eine Pflanze. Bei ihm tragen die Väter die Eier am Schwanz.' },
    { id: 'combjelly', name: 'Rippenqualle', lvl: 44, price: 2350, sell: 2645, hours: 72, len: 80, speed: 18, egg: '#d8c8ff', hab: 'open', jelly: true, rainbow: true, glow: '#c8b8ff', deep: 2,
      info: 'Gar keine echte Qualle: Über ihre acht Wimpernkämme laufen Regenbogen-Lichtwellen. Sie nesselt nicht – gucken lohnt sich trotzdem.' },
    { id: 'manowar', name: 'Portugiesische Galeere', lvl: 46, price: 2880, sell: 3240, hours: 72, len: 92, speed: 12, egg: '#c86ad8', hab: 'open', jelly: true, venom: true, surface: true,
      info: 'Treibt mit einem lila Gas-Segel an der Wasseroberfläche und lässt sich von der Strömung quer übers Becken schieben. Die blauen Fäden darunter sind meterlang – und gefährlich.' },
    { id: 'bluedragon', name: 'Blauer Drache', lvl: 48, price: 3420, sell: 3850, hours: 84, len: 76, speed: 12, egg: '#2a5ad6', hab: 'open', inv: true, surface: true, venom: true,
      info: 'Eine winzige Meeresschnecke, silber-blau mit Finger-Fransen. Treibt bauchoben an der Oberfläche und knabbert am liebsten an der Portugiesischen Galeere – dann ist er satt.' },
    { id: 'lionsmane', name: 'Löwenmähnen-Qualle', lvl: 52, price: 5300, pearls: 50, sell: 5960, hours: 110, len: 170, speed: 12, egg: '#ff7a1a', hab: 'open', jelly: true, venom: true, big: true,
      info: 'Legendär: die größte Qualle der Welt. Ihre Tentakel-Mähne reicht durchs halbe Becken – gibt es für Münzen oder Perlen und braucht ein großes Becken.' },
    /* ---------- Runde 20e (20.11.2026): Afrika-Legenden – Malawisee, Tanganjikasee, Kongo und Westafrika. Verhalten: js/africa.js (docs/MECHANIK.md § 11p)
       carry: 'mouth' + carrySex: 'f' = die Mama brütet die Eier im Maul aus · cavebrood = legt die Eier an eine Höhle/Felsspalte · needCave = laicht nur mit Höhle im Becken
       group = erst ab so vielen Artgenossen glücklich (sonst traurig, wächst langsamer) · family = Großfamilie: erwachsene Geschwister helfen bei der Brut
       rockface = klebt seitlich oder kopfüber an Felsen · slip = flitzt durch Felsspalten · playdead = stellt sich tot · cuckoo = Brutparasit ---------- */
    { id: 'kribensis', name: 'Prachtbarsch (Kribensis)', lvl: 8, water: 'fresh', price: 40, sell: 46, hours: 20, len: 98, speed: 40, egg: '#ff7aa8', cavebrood: true, needCave: true,
      info: 'Rosa Bauch, gelb gesäumte Flossen – aus Westafrika. Ein Höhlenbrüter: Zum Laichen braucht er eine Ton-Laichhöhle oder eine Kokosnuss im Becken.' },
    { id: 'yellowlab', name: 'Elektrischer Gelber', lvl: 10, water: 'fresh', price: 44, sell: 50, hours: 20, len: 104, speed: 42, egg: '#ffd400', carry: 'mouth', carrySex: 'f',
      info: 'Knallgelb mit schwarzen Flossenkanten – der Anfänger-Liebling aus dem Malawisee. Die Mama brütet die Eier im Maul aus.' },
    { id: 'congotetra', name: 'Kongosalmler', lvl: 12, water: 'fresh', price: 50, sell: 57, hours: 22, len: 104, speed: 56, egg: '#7ac8ff',
      info: 'Schillert wie ein Regenbogen und trägt lange Schleierflossen. Ein Schwarmfisch aus dem Kongo – ab 6 schwimmen sie zusammen.' },
    { id: 'demasoni', name: 'Demasoni', lvl: 15, water: 'fresh', price: 66, sell: 76, hours: 24, len: 92, speed: 44, egg: '#2a7de1', carry: 'mouth', carrySex: 'f', group: 5,
      info: 'Klein, frech, blau-schwarz gestreift – aus dem Malawisee. Nur in der Gruppe ab 5 zufrieden: Dann verteilt sich das Gezanke auf alle.' },
    { id: 'lemoncichlid', name: 'Zitronenbuntbarsch', lvl: 17, water: 'fresh', price: 76, sell: 87, hours: 26, len: 104, speed: 42, egg: '#ffb000', cavebrood: true,
      info: 'Knallgelb bis orange wie eine reife Zitrone. Wohnt im Tanganjikasee zwischen Steinen und legt seine Eier in eine kleine Höhle.' },
    { id: 'peacock', name: 'Kaiserbuntbarsch', lvl: 19, water: 'fresh', price: 90, sell: 103, hours: 30, len: 116, speed: 44, egg: '#ff5a2a', carry: 'mouth', carrySex: 'f', forms: 'peacock',
      info: 'Aulonocara aus dem Malawisee: Männchen leuchten blau und rot. Aus seinen Eiern schlüpfen viele Zuchtformen – Sunshine, Rubin, OB und Drachenblut.' },
    { id: 'julie', name: 'Schlankcichlide', lvl: 20, water: 'fresh', price: 96, sell: 110, hours: 30, len: 108, speed: 34, egg: '#e8c020', cavebrood: true, rockface: true,
      info: 'Julidochromis regani: gelb mit schwarzen Längsstreifen. Klebt an Felsen gern seitlich oder kopfüber – der Bauch zeigt immer zum Stein.' },
    { id: 'burundi', name: 'Prinzessin von Burundi', lvl: 21, water: 'fresh', price: 118, sell: 135, hours: 32, len: 112, speed: 38, egg: '#f2d6b0', cavebrood: true, family: true,
      info: 'Zartbeige, mit weißen Fahnen am Leierschwanz. Lebt in Großfamilien: Erwachsene Geschwister bleiben da und passen auf – mit Helfern schlüpfen und wachsen die Babys schneller.' },
    { id: 'tropheus', name: 'Brabantbuntbarsch (Tropheus)', lvl: 23, water: 'fresh', price: 126, sell: 144, hours: 30, len: 108, speed: 44, egg: '#ff3b1f', carry: 'mouth', carrySex: 'f', group: 6,
      info: 'Tropheus moorii: schwarz mit leuchtend rotem Bauchband. Nur in der Gruppe ab 6 glücklich – allein wird er traurig und wächst langsamer.' },
    { id: 'venustus', name: 'Giraffenbuntbarsch', lvl: 25, water: 'fresh', price: 150, sell: 172, hours: 34, len: 140, speed: 40, egg: '#e8b830', carry: 'mouth', carrySex: 'f',
      info: 'Gelb mit braunen Giraffen-Flecken, das Männchen trägt ein blaues Gesicht. Ein ruhiger Riese aus dem Malawisee.' },
    { id: 'livingstoni', name: 'Schläfer', lvl: 26, water: 'fresh', price: 165, sell: 189, hours: 38, len: 140, speed: 34, egg: '#c89a6a', carry: 'mouth', carrySex: 'f', playdead: true,
      info: 'Nimbochromis livingstonii: legt sich auf den Grund und stellt sich tot. Kommen kleine Fische gucken, schnappt er zu – im Spiel nur ein großer Schreck.' },
    { id: 'calvus', name: 'Calvus', lvl: 28, water: 'fresh', price: 205, sell: 234, hours: 42, len: 112, speed: 30, egg: '#3a3a4a', cavebrood: true, slip: true,
      info: 'Altolamprologus calvus: schmal wie ein Blatt, schwarz mit weißen Perlpunkten. Damit flitzt er durch Felsspalten, in die sonst keiner passt.' },
    { id: 'cuckoocat', name: 'Kuckuckswels', lvl: 30, water: 'fresh', price: 255, sell: 290, hours: 44, len: 112, speed: 40, egg: '#e8dcc0', hab: 'bottom', cuckoo: true,
      info: 'Getupfter Wels aus dem Tanganjikasee mit frechem Trick: Laicht ein Maulbrüter-Buntbarsch, schmuggelt er sein Ei dazwischen. Die Buntbarsch-Mama brütet es mit aus – Überraschungs-Baby!' },
    { id: 'frontosa', name: 'Frontosa', lvl: 37, water: 'fresh', price: 860, pearls: 16, sell: 965, hours: 48, len: 176, speed: 26, egg: '#dde4ff', carry: 'mouth', carrySex: 'f',
      info: 'Legende aus dem Tanganjikasee: weiß mit schwarzen Binden und dickem Stirnbuckel. Schwimmt langsam und majestätisch – gibt es für Münzen oder Perlen.' },
    /* Gäste im Afrika-Set: echte Zuchtformen aus Mittelamerika-Buntbarschen (Runde 20e) */
    { id: 'bloodparrot', name: 'Blutpapagei', lvl: 22, water: 'fresh', price: 112, sell: 129, hours: 32, len: 112, speed: 30, egg: '#ff7a1a', guest: true, sterile: true,
      info: 'Gast im Afrika-Set: eine echte Zuchtform aus Mittelamerika-Buntbarschen – rund, orange, mit kleinem Papageien-Mund. Fast immer unfruchtbar, darum gibt es ihn nur zu kaufen.' },
    { id: 'flowerhorn', name: 'Flowerhorn', lvl: 32, water: 'fresh', price: 340, sell: 386, hours: 46, len: 150, speed: 34, egg: '#ff3a5a', guest: true,
      info: 'Gast im Afrika-Set: eine echte Zuchtform aus Mittelamerika-Buntbarschen, mit pinkrotem Stirnbuckel, Perlpunkten und schwarzen „Blumen“-Flecken. In Asien ein Glücksbringer.' },
    /* ---------- Runde 18: Weihnachten – im Shop nur in der Weihnachtszeit (season: 'xmas', Reiter „Weihnachten“, AA.season); wer sie hat, behält sie ---------- */
    { id: 'xmashorse', name: 'Weihnachts-Seepferdchen', season: 'xmas', lvl: 10, price: 80, sell: 92, hours: 20, len: 60, speed: 27, egg: '#ff2a3a',
      info: 'Rot-weiß geringelt wie eine Zuckerstange, mit Weihnachtsmütze. Hält sich am liebsten an der Mistelzweig-Alge fest.' },
    { id: 'halofish', name: 'Engel-Kaiserfisch', season: 'xmas', halo: true, lvl: 15, price: 95, sell: 108, hours: 24, len: 118, speed: 40, egg: '#ffe7a8',
      info: 'Perlweiß mit goldenen Flossen. Über ihm schwebt ein Heiligenschein – nachts leuchtet er.' },
    { id: 'candyeel', name: 'Zuckerstangen-Aal', season: 'xmas', hab: 'lurk', lvl: 20, price: 120, sell: 137, hours: 30, len: 210, speed: 34, egg: '#ff4a5a',
      info: 'Rot-weiß gestreift, der Schwanz endet im Zuckerstangen-Haken. Wohnt am liebsten im Lebkuchenhaus-Wrack.' },
    { id: 'reindeer', name: 'Tauch-Rentier', season: 'xmas', lvl: 10, water: 'both', special: true, pearlOnly: true, pearls: 12, price: 120, sell: 136, hours: 30, len: 150, speed: 34, egg: '#a0622d',
      info: 'Mit Taucherbrille und Schnorchel. Paddelt mit allen vier Beinen – das Geweih wippt mit.' },
    { id: 'polarbear', name: 'Eisbär', season: 'xmas', somersault: true, lvl: 18, water: 'salt', special: true, pearlOnly: true, pearls: 18, price: 200, sell: 226, hours: 40, len: 170, speed: 36, egg: '#eef3f8',
      info: 'Mit rot-weißem Schal. Paddelt gemütlich mit allen vier Tatzen und schlägt ab und zu von selbst einen Purzelbaum.' }
  ];
  /* ---------- Runde 8: Hybride – nur durch Kreuzen zweier verwandter Arten (AA.startCross, js/life.js), nicht im Shop, unfruchtbar.
     Werte aus den Eltern: Level = höheres Eltern-Level + 2, Verkauf = (beide Verkaufspreise) × 1,6, Wachstum = Mittel × 1,1 … ---------- */
  AA.HYBRIDS = [
    { id: 'swordplaty', a: 'platy', b: 'swordtail', name: 'Schwertplaty', egg: '#ff6a1a', info: 'Platy × Schwertträger: der runde Körper des Platys, das Schwert des Schwertträgers. In der Natur kreuzen sich die beiden tatsächlich.' },
    { id: 'koicarp', a: 'carp', b: 'koi', name: 'Koi-Karpfen', egg: '#e8902a', info: 'Karpfen × Koi: kräftig wie ein Wildkarpfen, gefleckt wie ein Koi, mit langen Schleierflossen.' },
    { id: 'bester', a: 'beluga', b: 'sturgeon', name: 'Bester', egg: '#5a4a6a', info: 'Beluga × Stör: Die Zuchtform gibt es wirklich. Weibchen liefern Bester-Kaviar – fast so wertvoll wie Beluga, aber öfter.' },
    { id: 'flamelemon', a: 'flameangel', b: 'lemonpeel', name: 'Flammen-Zitronenkaiser', egg: '#ff9a1a', info: 'Flammen- × Zitronen-Zwergkaiser: vorn Zitrone, hinten Feuer. Solche Mischlinge werden am Riff ab und zu entdeckt – heiß begehrt.' },
    { id: 'salmontrout', a: 'salmon', b: 'trout', name: 'Lachsforelle', egg: '#ff8a8a', info: 'Lachs × Regenbogenforelle: silbern, mit lachsrosa Band. Schnell, robust und richtig was wert.' },
    /* Runde 9: Tintenfisch-Hybride */
    { id: 'galaxysquid', a: 'squid', b: 'bluesquid', name: 'Galaxie-Kalmar', egg: '#6a4ad6', glow: '#b48aff', info: 'Kalmar × Blauer Kalmar: violett-blauer Verlauf mit Sternenstaub auf dem Mantel. Leuchtet im Tiefsee-Becken wie ein Nachthimmel.' },
    { id: 'prachtsepia', a: 'sepia', b: 'squid', name: 'Prachtsepia', egg: '#ff4ab8', info: 'Sepia × Kalmar: Bänder in Violett, Magenta und Gelb wie bei der echten Prachtsepia – ein wandelndes Feuerwerk.' },
    { id: 'saphirsepia', a: 'sepia', b: 'bluesquid', name: 'Saphir-Sepia', egg: '#2a7ad6', info: 'Sepia × Blauer Kalmar: die Streifen der Sepia in tiefem Saphirblau mit türkisem Flossensaum.' },
    /* Runde 20e: Afrika – erfundene Spiel-Hybride */
    { id: 'sunkaiser', a: 'yellowlab', b: 'peacock', name: 'Sonnen-Kaiser', egg: '#ffb020', info: 'Elektrischer Gelber × Kaiserbuntbarsch: gelb wie die Sonne, mit blauem Kaiser-Gesicht, orangem Schulterfleck und Eiflecken auf der Flosse. Gibt es nur im Spiel.' },
    { id: 'zebraprincess', a: 'demasoni', b: 'burundi', name: 'Zebra-Prinzessin', egg: '#3a6ad6', info: 'Demasoni × Prinzessin von Burundi: der elegante Leierschwanz der Prinzessin im blau-schwarzen Zebra-Look. Gibt es nur im Spiel – in der Natur leben die beiden in verschiedenen Seen.' }
  ];
  (function () {
    const by = {}; AA.FISH.forEach(function (f) { by[f.id] = f; });
    AA.HYBRIDS.forEach(function (h) {
      const A = by[h.a], Bp = by[h.b], wa = A.water || 'salt', wb = Bp.water || 'salt';
      const water = wa === wb ? wa : (wa === 'both' ? wb : wa);       // Lachs (beide) × Forelle (Süß) = Süßwasser
      const f = { id: h.id, name: h.name, hybrid: [h.a, h.b], lvl: Math.max(A.lvl, Bp.lvl) + 2, price: Math.round((A.price + Bp.price) * 1.5), sell: Math.round((A.sell + Bp.sell) * 1.6),
        hours: Math.round((A.hours + Bp.hours) / 2 * 1.1), len: Math.round((A.len + Bp.len) / 2 * 1.04), speed: Math.round((A.speed + Bp.speed) / 2), egg: h.egg, info: h.info };
      if (water !== 'salt') f.water = water;
      if (A.hab || Bp.hab) f.hab = A.hab || Bp.hab;
      if (h.id === 'bester') f.caviar = 'bester';
      if (A.deep === 2 && Bp.deep === 2) f.deep = 2;      // beide Eltern tiefseetauglich: der Hybrid auch
      if (h.glow) f.glow = h.glow;
      AA.FISH.push(f);
    });
  })();
  /* ---------- Spieltempo (Runde 15, 14.11.2026) ----------
     Wie lange ein Fisch braucht, hängt nur an seinem Level: Level 1 = 2 Min, jedes Level ca. +15 %, Blobfisch (Level 39) = 7 Std,
     Quastenflosser (Level 55) = 72 Std – dazwischen gleichmäßig hochgerechnet (zwei Abschnitte, damit beide Ankerpunkte genau stimmen).
     Ei = halbe Reifezeit. Paarungspause = 1,5 × Reifezeit = Ei + Großwerden: die Eltern dürfen wieder, sobald ihr letztes Junges erwachsen ist –
     Runde 16: aber nie länger als pauseMax (24 Std). Das betrifft die Fische ab Level 45 (vorher bis zu 108 Std beim Quastenflosser).
     xp = Erfahrung, wenn ein Fisch erwachsen wird: wächst mit der Wartezeit, aber langsamer (6 × (Reifezeit ÷ 2 Min)^0,75) – am Anfang
     levelt man schnell, später braucht ein Level mehr Fische. Gerundet auf 5 Sek (unter 10 Min), 30 Sek (unter 1 Std), 5 Min, 15 Min. */
  AA.TEMPO = { base: 120, l39: 7 * 3600, l55: 72 * 3600, pause: 1.5, pauseMax: 24 * 3600, xp: 6, xpExp: 0.75 };
  AA.tempoRound = function (s) { const q = s < 600 ? 5 : (s < 3600 ? 30 : (s < 36000 ? 300 : 900)); return Math.max(q, Math.round(s / q) * q); };
  AA.growFor = function (lvl) {
    const T = AA.TEMPO, L = AA.clamp(lvl | 0, 1, 55);
    return AA.tempoRound(L <= 39 ? T.base * Math.pow(T.l39 / T.base, (L - 1) / 38) : T.l39 * Math.pow(T.l55 / T.l39, (L - 39) / 16));
  };
  AA.FISH_BY = {};
  AA.FISH.forEach(function (f) {
    f.grow = AA.growFor(f.lvl);                      // Sekunden bis erwachsen
    f.phaseLen = f.grow / 4;                         // eine Wachstumsphase
    f.mate = Math.round(f.price / 2);                // Paarungs-Gebühr
    f.hatch = AA.tempoRound(f.grow / 2);             // Brutzeit
    f.pause = Math.min(AA.TEMPO.pauseMax, AA.tempoRound(f.grow * AA.TEMPO.pause));      // Paarungspause je Fisch (AA.mateCooldown), höchstens 24 Std
    f.xp = Math.round(AA.TEMPO.xp * Math.pow(f.grow / AA.TEMPO.base, AA.TEMPO.xpExp));   // Erfahrung fürs Großziehen
    f.trainBonus = AA.clamp(Math.round(f.sell / 60), 1, 5);   // voll trainiert: 1–5 Münzen mehr
    AA.FISH_BY[f.id] = f;
  });
  /* ---------- Farbvarianten (Mutationen) ----------
     Schlüpfen nur aus Eiern (Zucht oder Glitzer-Ei von der Wochenkarte). w = Gewicht beim Auswürfeln (zusammen 100), pearls/xp = Belohnung im Sammelbuch für die erste
     Entdeckung je Art. Die Bilder werden aus dem normalen Sprite umgefärbt (js/variants.js) – es gibt keine eigenen Dateien.
     AA.VAR: chance = Grundchance je Ei, pity = Aufschlag je Ei ohne Mutation (Pech-Schutz, bis pityMax),
     inherit1 / inherit2 = Chance, dass ein bzw. zwei Eltern derselben Variante sie weitergeben. */
  AA.VARIANTS = [
    { id: 'albino', name: 'Albino', rare: 'Selten', tier: 1, w: 36, pearls: 1, xp: 100, col: '#ffe3e6', info: 'Fast ohne Farbstoff – blass, mit roten Augen.' },
    { id: 'gold', name: 'Gold', rare: 'Sehr selten', tier: 2, w: 26, pearls: 2, xp: 200, col: '#ffc531', info: 'Von der Flosse bis zur Nase in Gold getaucht.' },
    { id: 'amethyst', name: 'Amethyst', rare: 'Sehr selten', tier: 2, w: 22, pearls: 2, xp: 200, col: '#a865f5', info: 'Schimmert violett wie ein Edelstein.' },
    { id: 'night', name: 'Sternennacht', rare: 'Episch', tier: 3, w: 12, pearls: 3, xp: 400, col: '#27325e', info: 'Nachtblau mit kleinen Sternen auf den Schuppen.' },
    { id: 'rainbow', name: 'Regenbogen', rare: 'Legendär', tier: 4, w: 4, pearls: 5, xp: 1000, col: 'linear-gradient(90deg,#b05cff,#3f8cff,#39c96b,#ffd83a,#ff8a2a,#ff4b4b)', info: 'Alle Farben auf einmal. Den hat fast niemand.' }
  ];
  /* Karpfen: statt der üblichen fünf Farben hat er eigene Zuchtformen. Jedes Karpfen-Ei würfelt (AA.CARP.roll, Gewichte zusammen 100; '' = Schuppenkarpfen). */
  AA.CARP_FORMS = [
    { id: 'cwild', name: 'Wildkarpfen', rare: 'Häufig', tier: 1, w: 25, pearls: 1, xp: 60, col: '#7d7a3c', only: 'carp', info: 'Die schlanke Urform: olivbraun und robust.' },
    { id: 'czeil', name: 'Zeilkarpfen', rare: 'Selten', tier: 1, w: 18, pearls: 1, xp: 100, col: '#b9c3c9', only: 'carp', info: 'Fast nackt, nur eine Zeile Schuppen an der Seite. Hier silbrig-blass.' },
    { id: 'cblack', name: 'Schwarzer Karpfen', rare: 'Legendär', tier: 4, w: 3, pearls: 5, xp: 1000, col: '#16181d', only: 'carp', info: 'Tiefschwarz mit Samtglanz. Der teuerste Karpfen überhaupt.' }
  ];
  AA.CARP = { roll: { '': 40, cwild: 25, czeil: 18, albino: 9, rainbow: 5, cblack: 3 }, names: { '': 'Schuppenkarpfen', albino: 'Albino-Karpfen', rainbow: 'Regenbogenkarpfen' } };
  /* Runde 20e: Kaiserbuntbarsch – eigene Zuchtformen wie beim Karpfen (Bilder umgefärbt in js/variants.js) */
  AA.PEACOCK_FORMS = [
    { id: 'psun', name: 'Sunshine', rare: 'Häufig', tier: 1, w: 24, pearls: 1, xp: 80, col: '#ffcf2a', only: 'peacock', info: 'Goldgelber Körper, blaues Gesicht – die beliebteste Zuchtform.' },
    { id: 'prubin', name: 'Rubin', rare: 'Selten', tier: 2, w: 16, pearls: 2, xp: 160, col: '#c8143c', only: 'peacock', info: 'Tief rubinrot, das Gesicht schimmert violett.' },
    { id: 'pob', name: 'OB (Orange Blotch)', rare: 'Sehr selten', tier: 2, w: 10, pearls: 2, xp: 240, col: 'linear-gradient(90deg,#ff8a2a 55%,#1f2a44 55%,#1f2a44 75%,#3a7bff 75%)', only: 'peacock', info: 'Orange mit blauen und schwarzen Klecksen – jeder sieht ein bisschen anders aus.' },
    { id: 'pdragon', name: 'Drachenblut', rare: 'Episch', tier: 3, w: 4, pearls: 3, xp: 500, col: '#ff8fa0', only: 'peacock', info: 'Rosa-weiß mit feurig rotem Körper – eine moderne Zuchtform.' }
  ];
  /* Arten mit eigenen Zuchtformen: jedes Ei würfelt seine Form (roll, Gewichte; '' = Grundform) · list = Reihenfolge im Sammelbuch · plain = Name der Grundform */
  AA.FORMS = {
    carp: { roll: AA.CARP.roll, list: ['cwild', 'czeil', 'albino', 'rainbow', 'cblack'], plain: 'Schuppenkarpfen', col: '#c9a227' },
    peacock: { roll: { '': 40, psun: 24, prubin: 16, pob: 10, pdragon: 4, albino: 4, rainbow: 2 }, list: ['psun', 'prubin', 'pob', 'pdragon', 'albino', 'rainbow'], plain: 'Rot-Blau', col: '#ff5a2a' }
  };
  AA.VAR_BY = {};
  AA.VARIANTS.forEach(function (v) { AA.VAR_BY[v.id] = v; });
  AA.CARP_FORMS.forEach(function (v) { AA.VAR_BY[v.id] = v; });
  AA.PEACOCK_FORMS.forEach(function (v) { AA.VAR_BY[v.id] = v; });
  /* die Varianten, die es bei dieser Art gibt (Reihenfolge = Reihenfolge im Sammelbuch) */
  AA.variantsOf = function (sp) { const F = AA.FORMS[sp]; return F ? F.list.map(function (id) { return AA.VAR_BY[id]; }) : AA.VARIANTS; };
  AA.varFits = function (sp, v) { return AA.variantsOf(sp).some(function (x) { return x.id === v; }); };
  AA.VAR = { chance: 0.01, pity: 0.001, pityMax: 0.05, inherit1: 0.3, inherit2: 0.75 };      // Runde 15: vorher 4 % / 0,4 % / 20 % – beim neuen Tempo gäb’s sonst alle ~40 Min eine je Paar
  AA.speciesName = function (sp, v) { const d = AA.FISH_BY[sp]; if (sp === 'carp' && v && AA.VAR_BY[v]) return AA.CARP.names[v] || AA.VAR_BY[v].name; return (d ? d.name : sp) + (v && AA.VAR_BY[v] ? ' (' + AA.VAR_BY[v].name + ')' : ''); };

  /* Größe je Wachstumsphase (Anteil der Erwachsenen-Breite): Phase 1+2 Baby-Bild, Phase 3+4 schon das große Bild */
  AA.PHASE_SCALE = [0.5, 0.62, 0.7, 0.85, 1];

  /* ---------- Tricks (Reihenfolge wie im Vorbild) ---------- */
  AA.TRICKS = [
    { id: 'zig', name: 'Zick' }, { id: 'zag', name: 'Zack' }, { id: 'loop', name: 'Looping' }, { id: 'dive', name: 'Sturzflug' },
    { id: 'eight', name: 'Achter' }, { id: 'spiral', name: 'Spirale' }, { id: 'follow', name: 'Folge der Hand' }
  ];
  AA.TRICK_BY = {};
  AA.TRICKS.forEach(function (t, i) { t.idx = i; AA.TRICK_BY[t.id] = t; });

  /* ---------- Deko ----------
     w = Breite im Becken (Pixel), cat = Gruppe im Shop, sway = wiegt sich, hide = Versteck [x-Versatz, Höhe] (Anteile),
     sink = wie tief es im Kies sitzt, bubbles = Blasenquelle [x, Höhe, Abstand in Sekunden], alive = atmet, fav = Lieblingsplatz einer Art,
     size = eigene Größen-Spanne [kleinste, größte] statt der Spanne der Gruppe (AA.DECO_SIZE weiter unten); size: false = feste Größe */
  AA.DECO = [
    { id: 'seaweed_brown', name: 'Braunalge', cat: 'plant', lvl: 1, price: 8, w: 96, home: 'salt', sway: 0.07, sink: 5 },
    { id: 'rock_grey', name: 'Grauer Fels', cat: 'rock', lvl: 1, price: 10, w: 124, sink: 7 },
    { id: 'rocks_brown', name: 'Felshaufen', cat: 'rock', lvl: 1, price: 14, w: 150, sink: 7 },
    { id: 'ludwigia', name: 'Rote Ludwigie', cat: 'plant', lvl: 2, price: 12, w: 96, home: 'fresh', sway: 0.06, sink: 5 },
    { id: 'anemone', name: 'Rote Anemone', cat: 'plant', lvl: 3, price: 20, w: 118, home: 'salt', sway: 0.04, sink: 6, hide: [0, 0.62], fav: 'clown', host: true },
    { id: 'bubbleanemone', name: 'Blasenanemone', cat: 'plant', lvl: 9, price: 65, w: 126, home: 'salt', sway: 0.05, sink: 6, hide: [0, 0.6], fav: 'clown', host: true },
    { id: 'conch', name: 'Fechterschnecken-Haus', cat: 'prop', lvl: 3, price: 18, w: 104, sink: 5 },
    { id: 'braincoral', name: 'Hirnkoralle', cat: 'plant', lvl: 4, price: 24, w: 120, sink: 6 },
    { id: 'driftwood', name: 'Treibholz', cat: 'rock', lvl: 5, price: 30, w: 210, sink: 9, hide: [0.2, 0.26], size: [0.5, 2.5] },
    { id: 'tubesponge', name: 'Röhrenschwamm', cat: 'plant', lvl: 5, price: 28, w: 112, sink: 6 },
    { id: 'seaweed_lime', name: 'Limetten-Seegras', cat: 'plant', lvl: 6, price: 22, w: 84, home: 'salt', sway: 0.1, sink: 5 },
    { id: 'bottle', name: 'Flaschenpost', cat: 'prop', lvl: 6, price: 30, w: 86, sink: 5 },
    { id: 'seaweed_pink', name: 'Rosa Seegras', cat: 'plant', lvl: 7, price: 26, w: 84, home: 'salt', sway: 0.1, sink: 5 },
    { id: 'mushrooms', name: 'Pilzkorallen', cat: 'plant', lvl: 7, price: 30, w: 106, sway: 0.02, sink: 6 },
    { id: 'log', name: 'Hohler Baumstamm', cat: 'rock', lvl: 8, price: 45, w: 230, sink: 10, hide: [0.3, 0.42], size: [0.5, 2.3] },
    { id: 'cupcoral', name: 'Blaue Kelchkoralle', cat: 'plant', lvl: 8, price: 36, w: 126, sink: 6 },
    { id: 'coral_purple', name: 'Lila Fingerkoralle', cat: 'plant', lvl: 9, price: 40, w: 124, sink: 6 },
    { id: 'arch', name: 'Felsbogen', cat: 'rock', lvl: 9, price: 60, w: 230, sink: 8, hide: [0, 0.3], size: [0.5, 2.3] },
    { id: 'kelp', name: 'Riesentang', cat: 'plant', lvl: 10, price: 42, w: 128, home: 'salt', sway: 0.075, sink: 5, size: [0.5, 2.8] },
    { id: 'seafan', name: 'Rote Gorgonie', cat: 'plant', lvl: 10, price: 44, w: 150, home: 'salt', sway: 0.02, sink: 6 },
    { id: 'coral_plate', name: 'Grüne Tellerkoralle', cat: 'plant', lvl: 11, price: 48, w: 150, sink: 6 },
    { id: 'barrel', name: 'Altes Fass', cat: 'prop', lvl: 11, price: 65, w: 164, sink: 8, hide: [0.2, 0.45] },
    { id: 'coral_lilac', name: 'Fliederkoralle', cat: 'plant', lvl: 12, price: 55, w: 160, sway: 0.015, sink: 6 },
    { id: 'amphora', name: 'Amphore', cat: 'prop', lvl: 13, price: 70, w: 176, sink: 9, hide: [0.33, 0.55] },
    { id: 'staghorn', name: 'Geweihkoralle', cat: 'plant', lvl: 14, price: 62, w: 156, sink: 6 },
    { id: 'anchor', name: 'Anker', cat: 'prop', lvl: 14, price: 85, w: 116, sink: 8 },
    { id: 'castle', name: 'Ritterburg', cat: 'prop', lvl: 15, price: 90, w: 180, sink: 8, hide: [0, 0.16] },
    { id: 'leathercoral', name: 'Pilzlederkoralle', cat: 'plant', lvl: 16, price: 80, w: 148, sway: 0.015, sink: 6 },
    { id: 'lavarock', name: 'Lavastein mit Höhle', cat: 'rock', lvl: 16, price: 100, w: 196, sink: 8, hide: [0, 0.3], size: [0.5, 2.7] },
    { id: 'helmet', name: 'Taucherhelm', cat: 'prop', lvl: 17, price: 120, w: 116, sink: 8, hide: [0.12, 0.56] },
    { id: 'flowerpot', name: 'Margeriten-Koralle', cat: 'plant', lvl: 18, price: 95, w: 150, sway: 0.012, sink: 6 },
    { id: 'octopus', name: 'Oktopus', cat: 'prop', lvl: 19, price: 150, w: 170, sink: 8, alive: true, bubbles: [0.5, 0.86, 2.4], size: false },
    { id: 'birdnest', name: 'Vogelnest-Koralle', cat: 'plant', lvl: 20, price: 110, w: 156, sink: 6 },
    { id: 'crystals', name: 'Amethyst-Kristalle', cat: 'rock', lvl: 21, price: 180, w: 128, sink: 7 },
    { id: 'wreck', name: 'Bootswrack', cat: 'prop', lvl: 22, price: 220, w: 300, sink: 12, hide: [0.12, 0.3], size: [0.6, 1.8] },
    { id: 'columns', name: 'Säulen-Ruine', cat: 'prop', lvl: 24, price: 260, w: 220, sink: 9, hide: [0, 0.3] },
    { id: 'moai', name: 'Steinkopf', cat: 'prop', lvl: 26, price: 300, w: 112, sink: 8 },
    { id: 'volcano', name: 'Blubber-Vulkan', cat: 'prop', lvl: 28, price: 380, w: 210, sink: 9, bubbles: [0.5, 0.97, 0.4] },
    { id: 'diver', name: 'Taucher', cat: 'prop', lvl: 30, price: 450, w: 92, sink: 7, bubbles: [0.5, 0.98, 0.7] },
    /* ----- Runde 3: Plattformen (tops = flache Oberseiten [von, bis, Höhe] als Anteile des Bildes – darauf lässt sich andere Deko stellen),
       hohe Pflanzen und Süßwasser-Grün. home = wo das Stück in der Natur hingehört (nur ein Schildchen im Shop; erlaubt ist es überall). ----- */
    { id: 'slate', name: 'Schieferplatte', cat: 'rock', lvl: 3, price: 20, w: 190, sink: 4, size: [0.5, 2.8], tops: [[0.07, 0.925, 0.961]] },
    { id: 'vallisneria', name: 'Vallisnerie', cat: 'plant', lvl: 4, price: 18, w: 100, sway: 0.09, sink: 5, home: 'fresh', size: [0.5, 2.0] },
    { id: 'mossball', name: 'Mooskugeln', cat: 'plant', lvl: 5, price: 16, w: 110, sink: 4, home: 'fresh' },
    { id: 'stump', name: 'Baumstumpf', cat: 'rock', lvl: 5, price: 32, w: 160, sink: 7, tops: [[0.264, 0.73, 0.981]] },
    { id: 'cabomba', name: 'Cabomba', cat: 'plant', lvl: 6, price: 24, w: 104, sway: 0.08, sink: 5, home: 'fresh', size: [0.5, 2.0] },
    { id: 'tablerock', name: 'Tafelfels', cat: 'rock', lvl: 7, price: 48, w: 170, sink: 6, tops: [[0.175, 0.828, 0.98]] },
    { id: 'anubias', name: 'Anubias auf Stein', cat: 'plant', lvl: 7, price: 28, w: 120, sway: 0.012, sink: 5, home: 'fresh' },
    { id: 'amazonsword', name: 'Amazonas-Schwertpflanze', cat: 'plant', lvl: 8, price: 34, w: 150, sway: 0.05, sink: 5, home: 'fresh', size: [0.5, 2.6] },
    { id: 'woodslice', name: 'Baumscheiben-Tisch', cat: 'rock', lvl: 9, price: 55, w: 170, sink: 5, hide: [0, 0.3], tops: [[0.025, 0.972, 0.992]] },
    { id: 'javafern', name: 'Javafarn auf Wurzel', cat: 'plant', lvl: 10, price: 40, w: 130, sway: 0.04, sink: 5, home: 'fresh' },
    { id: 'bamboo', name: 'Bambus', cat: 'plant', lvl: 11, price: 46, w: 96, sway: 0.025, sink: 5, home: 'fresh', size: [0.5, 2.2] },
    { id: 'steprock', name: 'Stufenfels', cat: 'rock', lvl: 12, price: 75, w: 200, sink: 6, size: [0.5, 2.7], tops: [[0.095, 0.389, 0.48], [0.481, 0.907, 0.98]] },
    { id: 'seawhip', name: 'Seepeitsche', cat: 'plant', lvl: 13, price: 58, w: 100, sway: 0.06, sink: 5, home: 'salt', size: [0.5, 2.0] },
    { id: 'jetty', name: 'Alter Holzsteg', cat: 'rock', lvl: 13, price: 85, w: 210, sink: 6, hide: [0, 0.3], size: [0.5, 2.5], tops: [[0.024, 0.974, 0.811]] },
    { id: 'plateau', name: 'Felsplateau', cat: 'rock', lvl: 15, price: 110, w: 260, sink: 7, size: [0.5, 2.0], tops: [[0.202, 0.814, 0.978]] },
    { id: 'lotus', name: 'Seerose', cat: 'plant', lvl: 17, price: 90, w: 130, sway: 0.035, sink: 5, home: 'fresh', size: [0.5, 1.7] },
    { id: 'basalt', name: 'Basaltsäulen', cat: 'rock', lvl: 18, price: 130, w: 160, sink: 6, tops: [[0.026, 0.159, 0.622], [0.202, 0.355, 0.849], [0.398, 0.596, 0.987], [0.639, 0.77, 0.449], [0.815, 0.974, 0.622]] },
    { id: 'bonsai', name: 'Bonsai-Baum', cat: 'plant', lvl: 21, price: 170, w: 180, sink: 6, home: 'fresh', size: [0.5, 2.6] },
    { id: 'rootarch', name: 'Mangroven-Wurzelbogen', cat: 'rock', lvl: 23, price: 190, w: 200, sink: 7, hide: [0, 0.3], size: [0.5, 2.7], tops: [[0.136, 0.864, 0.983]] },
    /* ----- Runde 9: fünf einfache Stücke und fünf Prestige-Stücke. prestige = funkelt und bringt mehr Ruf je Auftrag (AA.PRESTIGE in js/wild.js),
       glow = leuchtet im Dunkeln [x, Höhe (Anteile), Farbe, Radius als Vielfaches der Breite]. ----- */
    { id: 'boot', name: 'Alter Stiefel', cat: 'prop', lvl: 3, price: 18, w: 104, sink: 6, info: 'Hat mal einem Angler gehört. Jetzt wohnt Seegras drin.' },
    { id: 'gnome', name: 'Tauch-Zwerg', cat: 'prop', lvl: 4, price: 26, w: 84, sink: 6, info: 'Gartenzwerg mit Schnorchel. Winkt jedem Fisch.' },
    { id: 'sign', name: 'Angeln-verboten-Schild', cat: 'prop', text: true, lvl: 6, price: 30, w: 96, sink: 7, info: 'Die Fische haben es selbst aufgestellt.' },
    { id: 'lantern', name: 'Schiffslaterne', cat: 'prop', lvl: 12, price: 60, w: 80, sink: 6, glow: [0.5, 0.42, '#ffc060', 1.5], info: 'Brennt auch unter Wasser – nachts und in der Tiefsee leuchtet sie warm.' },
    { id: 'skull', name: 'Piraten-Schädel', cat: 'prop', lvl: 16, price: 85, w: 128, sink: 7, info: 'Grinst mit Goldzahn. Garantiert harmlos.' },
    { id: 'treasure', name: 'Königsschatz', cat: 'prop', lvl: 30, price: 4000, w: 196, sink: 8, prestige: true, info: 'Ein Berg aus Gold mit Krone obendrauf.' },
    { id: 'poseidon', name: 'Goldener Poseidon', cat: 'prop', lvl: 34, price: 6000, w: 156, sink: 8, prestige: true, size: [0.6, 2.0], info: 'Der Chef persönlich, in Gold gegossen.' },
    { id: 'atlantis', name: 'Tor von Atlantis', cat: 'prop', lvl: 38, price: 9000, w: 300, sink: 9, prestige: true, hide: [0, 0.3], size: [0.6, 1.8], info: 'Marmor, Gold und Kristalle. Fische schwimmen mitten hindurch.' },
    { id: 'galleon', name: 'Goldene Galeone', cat: 'prop', lvl: 42, price: 14000, w: 340, sink: 12, prestige: true, hide: [0.1, 0.2], size: [0.6, 1.5], info: 'Gesunkenes Piratenschiff, bis unter die Planken voll Gold.' },
    { id: 'jadedragon', name: 'Jade-Drache', cat: 'prop', lvl: 46, price: 20000, w: 240, sink: 8, prestige: true, size: [0.6, 2.0], glow: [0.11, 0.5, '#eafff4', 0.5], info: 'Aus einem Stück Jade geschnitzt. Die Perle in seiner Klaue leuchtet im Dunkeln.' },
    { id: 'bubbleclam', name: 'Blubber-Muschel', cat: 'special', lvl: 32, price: 400, w: 150, sink: 8, bubbles: [0.5, 0.42, 0.5], daily: true, unique: true,
      info: 'Ersetzt die Schatzkiste in Aquarium 1: täglich mehr Münzen und eine Perle.' },
    { id: 'chest', name: 'Schatzkiste', cat: 'special', lvl: 1, price: 0, w: 126, sink: 7, daily: true, fixed: true },

    /* ----- Krabbler: wuseln von allein über den Kies (eigener Reiter im Shop, zählen nicht als Deko).
       crawl = [Gangart, Tempo in Pixeln pro Sekunde]; clean = bremst das Veralgen um diesen Anteil; eats = räumt liegen gebliebenes Futter weg;
       sym = von vorn/oben gezeichnet, wird nicht gespiegelt. Level der ersten fünf wie im Vorbild, alles andere sind eigene Werte. ----- */
    { id: 'seaslug', name: 'Meeresschnecke', cat: 'critter', job: 'glass', clean: 0.04, lvl: 2, price: 14, w: 66, sink: 2, crawl: ['snail', 4.5], glass: true,
      info: 'Eine knallbunte Nacktschnecke. Kriecht gemächlich und sieht dabei fabelhaft aus.' },
    { id: 'starfish', name: 'Rosa Seestern', cat: 'critter', lvl: 4, price: 16, w: 62, sink: 2, crawl: ['star', 2.2], glass: true, sym: true,
      info: 'Wandert im Zeitlupentempo über den Kies.' },
    { id: 'turbosnail', name: 'Turboschnecke', cat: 'critter', job: 'glass', lvl: 6, price: 24, w: 62, sink: 2, crawl: ['snail', 6], glass: true, clean: 0.10,
      info: 'Frisst Algen: Das Becken veralgt 10 % langsamer.' },
    { id: 'urchin', name: 'Lila Seeigel', cat: 'critter', job: 'algae', lvl: 8, price: 30, w: 66, sink: 2, crawl: ['urchin', 1.6], glass: true, sym: true, clean: 0.07,
      info: 'Stachelige Kugel mit Appetit auf Algen: 7 % weniger Schmutz.' },
    { id: 'crab', name: 'Mini-Krabbe', cat: 'critter', job: 'food', lvl: 10, price: 38, w: 72, sink: 2, crawl: ['crab', 30], sym: true, eats: true,
      info: 'Flitzt seitwärts und räumt Futter weg, das am Boden liegen bleibt.' },
    { id: 'starfish_blue', name: 'Blauer Seestern', cat: 'critter', lvl: 12, price: 44, w: 68, sink: 2, crawl: ['star', 2.2], glass: true, sym: true,
      info: 'Kobaltblau und sehr, sehr gelassen.' },
    { id: 'hermit', name: 'Einsiedlerkrebs', cat: 'critter', job: 'food', lvl: 13, price: 52, w: 72, sink: 2, crawl: ['walk', 11], clean: 0.05, eats: true,
      info: 'Trägt sein Haus spazieren, knabbert Algen (5 %) und Futterreste.' },
    { id: 'applesnail', name: 'Apfelschnecke', cat: 'critter', job: 'glass', lvl: 15, price: 60, w: 64, sink: 2, crawl: ['snail', 5], glass: true, clean: 0.08, water: 'fresh',
      info: 'Goldgelbes Kugelhaus, großer Algenhunger: 8 % weniger Schmutz.' },
    { id: 'shrimp', name: 'Kamelgarnele', cat: 'critter', job: 'algae', clean: 0.06, lvl: 16, price: 68, w: 78, sink: 2, crawl: ['walk', 17], eats: true,
      info: 'Rot-weiß geringelt, mit Buckel. Stakst umher und sammelt Futterreste.' },
    { id: 'urchin_pink', name: 'Rosa Kugel-Seeigel', cat: 'critter', job: 'algae', lvl: 18, price: 80, w: 62, sink: 2, crawl: ['urchin', 1.6], glass: true, sym: true, clean: 0.07,
      info: 'Kurze Stacheln, großer Putzeinsatz: 7 % weniger Schmutz.' },
    { id: 'cherryshrimp', name: 'Rote Zwerggarnele', cat: 'critter', job: 'algae', clean: 0.05, lvl: 5, price: 18, w: 60, sink: 2, crawl: ['walk', 15], eats: true, water: 'fresh',
      info: 'Kirschrot und immer beschäftigt: sammelt Futterreste vom Boden.' },
    { id: 'nerite', name: 'Zebra-Rennschnecke', cat: 'critter', job: 'glass', lvl: 7, price: 26, w: 62, sink: 2, crawl: ['snail', 6], glass: true, clean: 0.10, water: 'fresh',
      info: 'Raspelt Algen von Scheibe und Stein: 10 % weniger Schmutz.' },
    { id: 'lobster', name: 'Languste', cat: 'critter', job: 'food', lvl: 23, price: 140, w: 132, sink: 2, crawl: ['walk', 13], eats: true,
      info: 'Lange Fühler, keine Scheren. Stakst würdevoll umher und räumt Futterreste weg.' },
    { id: 'hummer', name: 'Hummer', cat: 'critter', job: 'food', lvl: 20, price: 110, w: 138, sink: 2, crawl: ['walk', 11], eats: true,
      info: 'Blau gepanzert, mit zwei dicken Scheren. Räumt Futterreste weg und lässt sich von niemandem hetzen.' },
    { id: 'cleanershrimp', name: 'Putzergarnele', cat: 'critter', lvl: 14, price: 95, w: 82, sink: 2, crawl: ['walk', 16], eats: true, job: 'doctor',
      info: 'Betreibt eine Putzerstation: Fische stellen sich an und lassen sich putzen – das macht kranke Fische gesund und alle zufrieden.' },
    { id: 'starfish_orange', name: 'Knotiger Seestern', cat: 'critter', lvl: 20, price: 90, w: 74, sink: 2, crawl: ['star', 2.2], glass: true, sym: true,
      info: 'Orange mit Schoko-Knubbeln – sieht aus wie ein Keks.' },
    /* ----- Runde 9: zehn neue Krabbler und die Scholle (glide = gleitet ein Stück über den Kies und liegt dann lange flach und still) ----- */
    { id: 'starfish_red', name: 'Roter Kissenstern', cat: 'critter', lvl: 9, price: 34, w: 70, sink: 2, crawl: ['star', 2.2], glass: true, sym: true,
      info: 'Dick gepolstert und knallrot. Hat es nie eilig.' },
    { id: 'amano', name: 'Amano-Garnele', cat: 'critter', job: 'algae', clean: 0.08, lvl: 10, price: 40, w: 74, sink: 2, crawl: ['walk', 16], eats: true, water: 'fresh',
      info: 'Die fleißigste Algenfresserin im Süßwasser: 8 % weniger Schmutz, Futterreste nimmt sie auch mit.' },
    { id: 'fiddler', name: 'Winkerkrabbe', cat: 'critter', job: 'food', lvl: 11, price: 46, w: 80, sink: 2, crawl: ['crab', 26], sym: true, eats: true,
      info: 'Eine Schere ist riesig – damit winkt sie. Mit der kleinen räumt sie Futterreste weg.' },
    { id: 'scholle', name: 'Scholle', cat: 'critter', lvl: 12, price: 48, w: 124, sink: 4, crawl: ['glide', 14], flat: true,
      info: 'Plattfisch: liegt flach auf dem Kies, beide Augen oben. Braucht kein Futter und klettert nirgends hoch.' },
    // Runde 14: drei weitere Plattfische – gleiten wie die Scholle über den Kies (kein Heilbutt)
    { id: 'sole', name: 'Seezunge', cat: 'critter', lvl: 14, price: 56, w: 130, sink: 3, crawl: ['glide', 12], flat: true,
      info: 'Lang und schmal wie eine Zunge, mit einem Flossensaum rundherum. Liegt tagsüber im Sand und gleitet nachts los.' },
    { id: 'turbot', name: 'Steinbutt', cat: 'critter', lvl: 20, price: 90, w: 128, sink: 3, crawl: ['glide', 11], flat: true,
      info: 'Fast rund, gesprenkelt wie Kies und mit kleinen Knochenhöckern – der König der Plattfische.' },
    { id: 'torpedo', name: 'Zitterrochen', cat: 'critter', lvl: 24, price: 120, w: 120, sink: 3, crawl: ['glide', 10], flat: true, zap: true,
      info: 'Fünf blaue Augenflecken und eine eingebaute Batterie: Ab und zu blitzt es – ein kleiner Stromstoß ⚡ (für die Fische harmlos).' },
    { id: 'brittlestar', name: 'Schlangenstern', cat: 'critter', job: 'food', lvl: 14, price: 58, w: 96, sink: 2, crawl: ['star', 5], glass: true, sym: true, eats: true,
      info: 'Fünf Schlangenarme und für einen Seestern richtig flott. Sammelt Futterreste ein.' },
    { id: 'urchin_diadem', name: 'Diadem-Seeigel', cat: 'critter', job: 'algae', lvl: 17, price: 76, w: 100, sink: 2, crawl: ['urchin', 1.6], glass: true, sym: true, clean: 0.08,
      info: 'Lange schwarze Stacheln, blaue Leuchtpunkte. Raspelt Algen weg: 8 % weniger Schmutz.' },
    { id: 'bandedshrimp', name: 'Scherengarnele', cat: 'critter', job: 'doctor', lvl: 18, price: 105, w: 96, sink: 2, crawl: ['walk', 14], eats: true,
      info: 'Rot-weiß geringelt, mit langen Scheren. Betreibt eine Putzerstation für die Fische.' },
    { id: 'pompomcrab', name: 'Boxerkrabbe', cat: 'critter', job: 'food', lvl: 19, price: 88, w: 76, sink: 2, crawl: ['crab', 22], sym: true, eats: true,
      info: 'Trägt in jeder Schere eine kleine Anemone wie Puschel. Räumt Futterreste weg.' },
    { id: 'urchin_pencil', name: 'Griffel-Seeigel', cat: 'critter', job: 'algae', lvl: 21, price: 96, w: 86, sink: 2, crawl: ['urchin', 1.6], glass: true, sym: true, clean: 0.07,
      info: 'Dicke rote Stacheln wie Buntstifte. 7 % weniger Schmutz.' },
    { id: 'harlequin', name: 'Harlekin-Garnele', cat: 'critter', lvl: 22, price: 120, w: 84, sink: 2, crawl: ['walk', 10],
      info: 'Weiß mit rosa-blauen Tupfen und Scheren wie Blütenblätter. Tut nichts – außer umwerfend auszusehen.' },
    { id: 'fireshrimp', name: 'Feuergarnele', cat: 'critter', job: 'doctor', lvl: 25, price: 160, w: 86, sink: 2, crawl: ['walk', 15], eats: true,
      info: 'Blutrot mit weißen Punkten. Die edelste Putzerstation, die es gibt.' },
    /* ----- Runde 20b: Gift-Krabbler. harpoon = schießt ab und zu den Rüssel raus · punch = schlägt zurück, wenn man ans Glas klopft (Glas-Riss) ·
       octo = Kraken-Rig (Mantel atmet, Arme wellen sich, Ringe pulsieren und blitzen beim Klopfen) ----- */
    { id: 'cone', name: 'Kegelschnecke', cat: 'critter', lvl: 20, price: 100, w: 78, sink: 2, crawl: ['snail', 4], venom: true, harpoon: true,
      info: 'Ein Schneckenhaus wie ein Kunstwerk – und ein Rüssel mit Giftharpune. Kriecht gemütlich herum und schießt ab und zu die Harpune raus.' },
    { id: 'escargot', name: 'Escargot', cat: 'critter', lvl: 10, price: 90, w: 96, sink: 2, crawl: ['snail', 5], water: 'both',      // Runde 20f: auch ins Süßwasser (Paris – Seine)
      info: 'Eine Weinbergschnecke mit Tauchflasche auf dem Häuschen und dem Atemregler im Mund – so traut sie sich auch unter Wasser, im Meer wie in der Seine. Die Augen oben auf den Stielen haben alles im Blick.' },
    // Runde 20f: Krabbler-Paket – große runde Augen, kein Mund. Neue Gangarten: stilt (Stelzen), dancer (Spanische Tänzerin), clam (Riesenmuschel), skip (Schlammspringer)
    { id: 'seacucumber', name: 'Seegurke', cat: 'critter', lvl: 9, price: 55, w: 100, sink: 2, crawl: ['snail', 2.6], job: 'food', eats: true,
      info: 'Der Staubsauger des Riffs: kriecht im Schneckentempo über den Grund und räumt die Futterreste weg.' },
    { id: 'tigershrimp', name: 'Blaue Tigergarnele', cat: 'critter', lvl: 11, price: 70, w: 80, sink: 2, crawl: ['walk', 15], job: 'algae', clean: 0.06, eats: true, water: 'fresh',
      info: 'Kobaltblau mit schwarzen Tigerstreifen – und nebenbei putzt sie die Algen weg.' },
    { id: 'decorator', name: 'Dekorateurkrabbe', cat: 'critter', lvl: 15, price: 90, w: 110, sink: 2, crawl: ['crab', 14], job: 'food', eats: true,
      info: 'Tarnt sich mit allem, was sie findet: Schwamm, Tang, Anemone und ein Schneckenhaus auf dem Rücken.' },
    { id: 'horseshoe', name: 'Pfeilschwanzkrebs', cat: 'critter', lvl: 21, price: 130, w: 120, sink: 2, crawl: ['walk', 7], job: 'food', eats: true,
      info: 'Ein lebendes Fossil: seit 450 Millionen Jahren fast unverändert – älter als die Dinosaurier. Und er hat blaues Blut.' },
    { id: 'spanishdancer', name: 'Spanische Tänzerin', cat: 'critter', lvl: 24, price: 160, w: 120, sink: 2, crawl: ['dancer', 7],
      info: 'Eine Nacktschnecke im roten Flamenco-Rock. Gleitet wellend über den Boden – und ab und zu tanzt sie frei durchs Wasser.' },
    { id: 'giantclam', name: 'Riesenmuschel', cat: 'critter', lvl: 28, price: 240, w: 140, sink: 2, crawl: ['clam', 0], sym: true, job: 'algae', clean: 0.05,
      info: 'Bewegt sich keinen Millimeter und filtert dafür das Wasser – ihr Mantel schimmert in allen Blautönen. Antippen: Sie klappt zu.' },
    { id: 'spidercrab', name: 'Japanische Riesenkrabbe', cat: 'critter', lvl: 33, price: 210, w: 190, sink: 2, crawl: ['legs', 8], legs: 'spidercrab', sym: true, job: 'food', eats: true,      // 19.11.2026: Bein-Rig (js/legrig.js)
      info: 'Die größte Krabbe der Welt – bis fast vier Meter Beinspannweite. Setzt ihre langen Stelzenbeine Schritt für Schritt, ganz langsam und bedächtig.' },
    { id: 'mantis', name: 'Fangschreckenkrebs', cat: 'critter', lvl: 34, price: 150, w: 106, sink: 2, crawl: ['walk', 13], punch: true,
      info: 'Pfauenbunt, mit Augen, die sich unabhängig drehen – und dem schnellsten Schlag im Tierreich. Klopf bloß nicht ans Glas: Er schlägt zurück!' },
    { id: 'bluering', name: 'Blauring-Krake', cat: 'critter', lvl: 38, price: 180, w: 110, sink: 2, crawl: ['octo', 6], sym: true, venom: true,
      info: 'Klein, gelb und voller blauer Ringe, die sanft pulsieren – klopfst du in ihrer Nähe, blitzen sie hell auf. Krabbelt mit wellenden Armen über den Boden.' },
    /* Runde 10: 30 Steine, 10 Wurzeln und Äste, 3 Steinköpfe, 3 Schätze im Atlantis-Stil, das Ufo, 5 Korallen, 2 pinke Anemonen, 6 Krabbler */
    { id: 'pebbles3', name: 'Kiesel-Trio', cat: 'rock', lvl: 2, price: 12, w: 110, sink: 5, info: 'Drei glatte Flusskiesel, die sich aneinanderkuscheln.' },
    { id: 'heartstone', name: 'Herzstein', cat: 'rock', lvl: 3, price: 18, w: 100, sink: 6, info: 'Ein Stein in Herzform. Kitschig? Ja. Schön? Auch ja.' },
    { id: 'dome', name: 'Felskuppe', cat: 'rock', lvl: 3, price: 20, w: 170, sink: 6, info: 'Ein runder, flacher Hügel aus Stein.' },
    { id: 'roundboulder', name: 'Rundbrocken', cat: 'rock', lvl: 4, price: 22, w: 150, sink: 7, info: 'Ein dicker, runder Felsbrocken mit einem kleinen Riss.' },
    { id: 'twigbush', name: 'Zweigbusch', cat: 'rock', lvl: 4, price: 26, w: 190, sink: 5, wood: true, size: [0.5, 2.8], info: 'Ganz feines Geäst – ein kahler Busch unter Wasser.' },
    { id: 'spire', name: 'Felsnadel', cat: 'rock', lvl: 5, price: 28, w: 100, sink: 6, info: 'Spitz, schmal und hoch – mit zwei Moospolstern.' },
    { id: 'pyramid', name: 'Pyramidenfels', cat: 'rock', lvl: 5, price: 30, w: 140, sink: 7, info: 'Fast eine Pyramide. Die Natur kann auch Geometrie.' },
    { id: 'cairn', name: 'Steinmännchen', cat: 'rock', lvl: 6, price: 34, w: 90, sink: 5, info: 'Fünf Steine, sorgfältig gestapelt. Bloß nicht anstupsen.' },
    { id: 'stepstone', name: 'Trittstein', cat: 'rock', lvl: 6, price: 36, w: 170, sink: 5, tops: [[0.119,0.881,0.969]], info: 'Flach und breit – oben passt prima noch etwas drauf.' },
    { id: 'forkbranch', name: 'Ast-Gabel', cat: 'rock', lvl: 6, price: 36, w: 140, sink: 6, wood: true, size: [0.5, 2.6], info: 'Ein Ast, der sich nicht entscheiden konnte: links oder rechts?' },
    { id: 'pebblepile', name: 'Kieselhaufen', cat: 'rock', lvl: 7, price: 38, w: 160, sink: 5, info: 'Viele kleine Kiesel in zwei Steinfarben auf einem Haufen.' },
    { id: 'jagged', name: 'Zackenfels', cat: 'rock', lvl: 8, price: 44, w: 170, sink: 7, info: 'Drei scharfe Spitzen aus dunklem Schiefer.' },
    { id: 'longbranch', name: 'Langer Treibast', cat: 'rock', lvl: 8, price: 50, w: 280, sink: 5, wood: true, size: [0.5, 1.9], tops: [[0.03,0.935,0.963]], info: 'Lang, gerade und oben flach – eine Bank für kleine Deko.' },
    { id: 'crevice', name: 'Felsspalte', cat: 'rock', lvl: 9, price: 52, w: 170, sink: 7, hide: [0, 0.2], info: 'Zwei Platten lehnen aneinander – unten ein schmaler Spalt zum Verstecken.' },
    { id: 'tiltslabs', name: 'Schräge Platten', cat: 'rock', lvl: 10, price: 56, w: 180, sink: 6, info: 'Drei Schieferplatten, umgekippt wie Dominosteine.' },
    { id: 'miniarch', name: 'Mini-Bogen', cat: 'rock', lvl: 10, price: 60, w: 170, sink: 7, hide: [0, 0.22], info: 'Ein kleiner Steinbogen mit Moos – passt auch ins kleine Becken.' },
    { id: 'limeslab', name: 'Kalkplatte', cat: 'rock', lvl: 11, price: 64, w: 220, sink: 5, size: [0.5, 2.4], tops: [[0.061,0.941,0.965]], info: 'Heller Kalkstein mit versteinerten Muscheln.' },
    { id: 'spiderwood', name: 'Spinnenwurzel', cat: 'rock', lvl: 11, price: 70, w: 230, sink: 6, wood: true, size: [0.5, 2.3], info: 'Viele dünne Äste aus einem Knoten – sieht aus wie eine umgedrehte Baumkrone.' },
    { id: 'rocktooth', name: 'Felszahn', cat: 'rock', lvl: 12, price: 68, w: 90, sink: 6, info: 'Ein einzelner, hoher Zahn aus Schiefer.' },
    { id: 'balance', name: 'Wackelstein', cat: 'rock', lvl: 13, price: 74, w: 110, sink: 6, size: [0.5, 2.9], info: 'Liegt nur auf einem Punkt auf – und fällt trotzdem nie um.' },
    { id: 'bogwood', name: 'Moorkien', cat: 'rock', lvl: 13, price: 84, w: 220, sink: 6, wood: true, hide: [0, 0.18], size: [0.5, 2.4], info: 'Dunkles, knorriges Moorholz mit einer Höhle darunter.' },
    { id: 'ridge', name: 'Felsrippe', cat: 'rock', lvl: 14, price: 82, w: 250, sink: 5, size: [0.5, 2.1], tops: [[0.135,0.873,0.964]], info: 'Eine lange, flache Felsrippe – oben ist Platz für mehr.' },
    { id: 'talawa', name: 'Talawa-Röhre', cat: 'rock', lvl: 14, price: 90, w: 100, sink: 6, wood: true, hide: [0, 0.45], size: [0.5, 2.2], info: 'Eine hohle Holzröhre voller Löcher – drinnen wohnt es sich gut.' },
    { id: 'cave', name: 'Felshöhle', cat: 'rock', lvl: 15, price: 95, w: 200, sink: 7, hide: [0, 0.22], size: [0.5, 2.7], info: 'Ein runder Fels mit einer großen, dunklen Höhle.' },
    { id: 'seiryu', name: 'Seiryu-Stein', cat: 'rock', lvl: 16, price: 104, w: 110, sink: 6, info: 'Der Klassiker aus dem Aquascaping: scharfkantig, mit hellen Adern.' },
    { id: 'dragonstone', name: 'Drachenstein', cat: 'rock', lvl: 17, price: 112, w: 170, sink: 6, info: 'Ohko-Stein voller Löcher und Falten – wie Drachenhaut.' },
    { id: 'deadtree', name: 'Kahle Baumkrone', cat: 'rock', lvl: 17, price: 115, w: 170, sink: 6, wood: true, size: [0.5, 2.2], info: 'Ein kleiner Baum ohne Blätter – ein Bonsai für die Tiefe.' },
    { id: 'mushroomrock', name: 'Pilzfelsen', cat: 'rock', lvl: 18, price: 120, w: 160, sink: 6, tops: [[0.159,0.838,0.982]], info: 'Ein Felsen wie ein Pilz: dünner Stiel, breiter, flacher Hut.' },
    { id: 'turtlerock', name: 'Schildkrötenfels', cat: 'rock', lvl: 19, price: 128, w: 180, sink: 6, info: 'Die Oberseite ist in Sechsecke gesprungen – wie ein Panzer.' },
    { id: 'mangroveroots', name: 'Mangroven-Stelzwurzeln', cat: 'rock', lvl: 19, price: 135, w: 230, sink: 7, wood: true, hide: [0, 0.2], size: [0.5, 2.3], info: 'Bögen über Bögen – Fische schwimmen mitten hindurch.' },
    { id: 'holestone', name: 'Lochstein', cat: 'rock', lvl: 20, price: 140, w: 190, sink: 6, hide: [0.05, 0.4], size: [0.5, 2.8], info: 'Kalkstein mit Löchern und Tunneln quer durch.' },
    { id: 'terrace', name: 'Steinterrasse', cat: 'rock', lvl: 21, price: 150, w: 230, sink: 6, size: [0.5, 2.3], tops: [[0.06,0.229,0.363], [0.32,0.486,0.679], [0.573,0.925,0.979]], info: 'Drei Stufen aus Schiefer – jede Stufe ist eine Stellfläche.' },
    { id: 'overhang', name: 'Überhang', cat: 'rock', lvl: 22, price: 160, w: 210, sink: 7, hide: [0.12, 0.2], size: [0.5, 2.5], info: 'Ein Felsdach mit Moos – darunter ist es schön schattig.' },
    { id: 'liverock', name: 'Lebendgestein', cat: 'rock', lvl: 23, price: 172, w: 170, sink: 6, home: 'salt', info: 'Riffgestein mit rosa Kalkalgen und kleinen Polypen.' },
    { id: 'rockgate', name: 'Felstor', cat: 'rock', lvl: 24, price: 185, w: 210, sink: 7, hide: [0, 0.3], size: [0.5, 2.5], info: 'Zwei Säulen, ein Deckstein – ein Tor für die ganze Schule.' },
    { id: 'pillarstump', name: 'Säulenstümpfe', cat: 'rock', lvl: 25, price: 200, w: 200, sink: 6, size: [0.5, 2.7], tops: [[0.022,0.166,0.624], [0.209,0.357,0.825], [0.402,0.594,0.985], [0.638,0.766,0.624], [0.809,0.975,0.737]], info: 'Fünf kurze Basaltsäulen – jede ist eine kleine Bühne.' },
    { id: 'rootcave', name: 'Wurzelhöhle', cat: 'rock', lvl: 26, price: 210, w: 220, sink: 7, wood: true, hide: [0, 0.22], size: [0.5, 2.4], info: 'Ein Wurzelgewirr mit einer großen Höhle darunter.' },
    { id: 'lavatwin', name: 'Lava-Zwillinge', cat: 'rock', lvl: 27, price: 230, w: 180, sink: 7, glow: [0.42, 0.55, '#ff8a3d', 0.7], info: 'Zwei Lavabrocken – die Risse glühen noch.' },
    { id: 'geode', name: 'Achat-Geode', cat: 'rock', lvl: 30, price: 280, w: 140, sink: 6, glow: [0.5, 0.36, '#d6a8ff', 0.6], info: 'Außen grauer Stein, innen ein Schatz aus Amethyst.' },
    { id: 'moai_reef', name: 'Bewachsener Steinkopf', cat: 'prop', lvl: 29, price: 380, w: 120, sink: 8, stone: true, info: 'Steht schon so lange im Meer, dass ihm Korallen wachsen.' },
    { id: 'moai_fallen', name: 'Umgekippter Steinkopf', cat: 'prop', lvl: 31, price: 420, w: 220, sink: 8, stone: true, info: 'Hat sich hingelegt. Steht so schnell nicht wieder auf.' },
    { id: 'ufo', name: 'Abgestürztes Ufo', cat: 'prop', lvl: 33, price: 2500, w: 200, sink: 9, glow: [0.42, 0.3, '#8cf0d6', 0.9], bubbles: [0.78, 0.15, 0.8], info: 'Notlandung im Aquarium. Die Lichter blinken noch.' },
    { id: 'hippocampus', name: 'Goldenes Seeross', cat: 'prop', lvl: 36, price: 7500, w: 130, sink: 8, prestige: true, info: 'Halb Pferd, halb Fisch, ganz aus Gold – das Reittier des Meeresgottes.' },
    { id: 'shellthrone', name: 'Muschel-Thron', cat: 'prop', lvl: 40, price: 11000, w: 170, sink: 8, prestige: true, info: 'Ein Thron aus einer goldenen Muschel. Wer setzt sich als Erstes?' },
    { id: 'tholos', name: 'Kuppeltempel', cat: 'prop', lvl: 44, price: 16000, w: 200, sink: 9, prestige: true, hide: [0, 0.32], size: [0.6, 1.9], info: 'Ein runder Tempel aus Marmor und Gold – Fische schwimmen zwischen den Säulen.' },
    { id: 'zoanthus', name: 'Krustenanemonen', cat: 'plant', lvl: 5, price: 30, w: 130, sink: 6, home: 'salt', info: 'Ein Teppich aus kleinen Blüten-Polypen: orange Mitte, grüner Kranz.' },
    { id: 'anemone_pink', name: 'Rosa Anemone', cat: 'plant', lvl: 6, price: 45, w: 130, sink: 6, home: 'salt', sway: 0.05, hide: [0, 0.6], fav: 'clown', host: true, info: 'Lange rosa Tentakel – passt genau zu Rosa Kies und Pink Lava. Clownfische lieben sie.' },
    { id: 'bubblecoral', name: 'Blasenkoralle', cat: 'plant', lvl: 9, price: 66, w: 130, sink: 6, home: 'salt', info: 'Lauter pralle, weiße Blasen – wie Trauben aus Perlmutt.' },
    { id: 'torchcoral', name: 'Fackelkoralle', cat: 'plant', lvl: 12, price: 90, w: 140, sink: 6, home: 'salt', sway: 0.04, info: 'Lange Tentakel mit leuchtenden Spitzen, die im Wasser wehen.' },
    { id: 'anemone_carpet', name: 'Pinke Teppichanemone', cat: 'plant', lvl: 14, price: 95, w: 160, sink: 5, home: 'salt', hide: [0, 0.4], fav: 'clown', host: true, info: 'Flach, breit und knallpink – ein Bett für Clownfische.' },
    { id: 'pillarcoral', name: 'Säulenkoralle', cat: 'plant', lvl: 15, price: 105, w: 110, sink: 6, home: 'salt', size: [0.5, 2.9], info: 'Hohe Säulen mit flauschigen Polypen.' },
    { id: 'seapen', name: 'Seefeder', cat: 'plant', lvl: 19, price: 130, w: 80, sink: 5, home: 'salt', sway: 0.06, size: [0.5, 2.2], info: 'Sieht aus wie eine Schreibfeder – nur in Orange und lebendig.' },
    { id: 'ramshorn', name: 'Rote Posthornschnecke', cat: 'critter', lvl: 4, price: 16, w: 60, sink: 2, job: 'glass', clean: 0.06, crawl: ['snail', 4.5], glass: true, water: 'fresh', info: 'Rot wie eine Kirsche, rund wie ein Schneckenhaus aus dem Bilderbuch. Putzt die Scheibe.' },
    { id: 'panthercrab', name: 'Pantherkrabbe', cat: 'critter', lvl: 12, price: 58, w: 78, sink: 2, job: 'food', crawl: ['crab', 24], sym: true, eats: true, water: 'fresh', info: 'Süßwasser-Krabbe im Leopardenlook. Räumt Futterreste weg.' },
    { id: 'crayfish_blue', name: 'Blauer Floridakrebs', cat: 'critter', lvl: 17, price: 96, w: 104, sink: 2, job: 'food', crawl: ['walk', 12], eats: true, water: 'fresh', info: 'Knallblau und neugierig. Frisst alles, was zu Boden sinkt.' },
    { id: 'isopod', name: 'Riesenassel', cat: 'critter', lvl: 37, price: 160, w: 100, sink: 2, job: 'food', crawl: ['walk', 9], eats: true, deep: 1, info: 'Ein Panzer-Staubsauger aus der Tiefsee. Nur fürs Tiefsee-Becken.' },
    { id: 'seapig', name: 'Seeschwein', cat: 'critter', lvl: 39, price: 175, w: 84, sink: 2, job: 'algae', clean: 0.07, crawl: ['walk', 6], deep: 1, info: 'Eine Seegurke mit Beinchen. Grast den Boden ab. Nur fürs Tiefsee-Becken.' },
    { id: 'yeticrab', name: 'Yetikrabbe', cat: 'critter', lvl: 41, price: 190, w: 80, sink: 2, job: 'food', crawl: ['crab', 18], sym: true, eats: true, deep: 1, info: 'Haarige Arme wie ein Yeti. Lebt an heißen Quellen – nur im Tiefsee-Becken.' },
    /* ---------- Runde 12: zehn hohe Pflanzen (6 Süß-, 4 Meerwasser), drei Tange fürs Meeresbecken, Steckmuschel, Pokale ---------- */
    { id: 'ulva', name: 'Meersalat', cat: 'plant', lvl: 6, price: 26, w: 110, sink: 5, home: 'salt', sway: 0.08, size: [0.5, 2.2], info: 'Dünne, gewellte Blätter in Hellgrün – sieht wirklich aus wie Salat.' },
    { id: 'rotala', name: 'Rotala', cat: 'plant', lvl: 7, price: 34, w: 96, sink: 5, home: 'fresh', sway: 0.07, size: [0.5, 2.2], info: 'Unten grün, oben rosa-rot – je höher sie wächst, desto röter wird sie.' },
    { id: 'posidonia', name: 'Neptungras', cat: 'plant', lvl: 8, price: 30, w: 104, sink: 5, home: 'salt', sway: 0.09, size: [0.5, 2.4], info: 'Das Seegras der Adria: lange Bänder, die im Wasser wehen. Seine Wiesen sind die Kinderstube des Mittelmeers.' },
    { id: 'ambulia', name: 'Ambulie', cat: 'plant', lvl: 9, price: 38, w: 96, sink: 5, home: 'fresh', sway: 0.08, size: [0.5, 2.2], info: 'Weiche, gefiederte Quirle – wie lauter kleine Flaschenbürsten übereinander.' },
    { id: 'caulerpa', name: 'Federalge', cat: 'plant', lvl: 10, price: 36, w: 100, sink: 5, home: 'salt', sway: 0.06, size: [0.5, 2.2], info: 'Fiederblättchen wie bei einem Farn, knallgrün. Wächst an langen Ausläufern.' },
    { id: 'hygrophila', name: 'Wasserfreund', cat: 'plant', lvl: 11, price: 44, w: 100, sink: 5, home: 'fresh', sway: 0.07, size: [0.5, 2.2], info: 'Kräftige Stängel mit langen Blättern – die jüngsten Spitzen schimmern bronze.' },
    { id: 'halimeda', name: 'Kaktusalge', cat: 'plant', lvl: 12, price: 48, w: 100, sink: 5, home: 'salt', sway: 0.03, size: [0.5, 2.0], info: 'Kleine grüne Kalk-Münzen, aneinandergereiht wie ein Kaktus.' },
    { id: 'cryptobal', name: 'Riesen-Wasserkelch', cat: 'plant', lvl: 16, price: 70, w: 104, sink: 5, home: 'fresh', sway: 0.07, size: [0.5, 2.0], info: 'Meterlange, gewellte Bänder in Oliv und Bronze – ein Vorhang für den Hintergrund.' },
    { id: 'redkelp', name: 'Rottang', cat: 'plant', lvl: 16, price: 90, w: 130, sink: 5, home: 'salt', sway: 0.06, size: [0.5, 2.3], info: 'Krause, rote Wedel – ein Farbklecks zwischen all dem Grün.' },
    { id: 'tigerlotus', name: 'Roter Tigerlotus', cat: 'plant', lvl: 18, price: 95, w: 120, sink: 5, home: 'fresh', sway: 0.04, size: [0.5, 2.0], info: 'Weinrote, gefleckte Blätter auf langen Stielen – das oberste liegt fast flach im Wasser.' },
    { id: 'bullkelp', name: 'Bullkelp', cat: 'plant', lvl: 20, price: 120, w: 120, sink: 5, home: 'salt', sway: 0.06, size: [0.5, 1.3], info: 'Ein langer Stiel, oben eine goldene Schwimmblase mit wehenden Bändern. Im Meeresbecken wird er richtig hoch.' },
    { id: 'aponogeton', name: 'Gitterpflanze', cat: 'plant', lvl: 22, price: 120, w: 110, sink: 5, home: 'fresh', sway: 0.05, size: [0.5, 2.2], info: 'Blätter wie feine Spitze: nur Adern, dazwischen Löcher. Eine Rarität aus Madagaskar.' },
    { id: 'kelpforest', name: 'Kelpwald', cat: 'plant', lvl: 24, price: 160, w: 140, sink: 5, home: 'salt', sway: 0.05, size: [0.5, 1.4], info: 'Drei Riesentang-Stämme mit unzähligen Blättern – ein Stück Kelpwald für dein Meeresbecken.' },
    { id: 'pinna', name: 'Steckmuschel', cat: 'prop', lvl: 9, price: 60, w: 110, sink: 9, info: 'Die größte Muschel des Mittelmeers steckt mit der Spitze im Sand. In der Adria streng geschützt – hier darf sie stehen.' },
    // Runde 20d: Paris – Wahrzeichen und Straßen-Deko (Eiffelturm funkelt nachts zu jeder vollen Stunde, Laterne und Métro leuchten nachts)
    { id: 'frenchsign', name: 'Schild „Beware of the French!“', cat: 'prop', text: true, lvl: 5, price: 150, w: 130, sink: 6,
      info: '„Frogs and snails, beware of the French!“ – Frösche und Schnecken, Vorsicht vor den Franzosen! Auf Französisch: « Grenouilles et escargots : attention aux Français ! »' },
    { id: 'montmartre', name: 'Laterne vom Montmartre', cat: 'prop', lvl: 8, price: 220, w: 58, sink: 5, size: [0.6, 1.8], glow: [0.5, 0.86, '#ffd27a', 1.7],
      info: 'Eine alte Gaslaterne vom Künstlerhügel. Nachts leuchtet sie warm.' },
    { id: 'cafe', name: 'Café-Tisch', cat: 'prop', lvl: 10, price: 300, w: 160, sink: 5, info: 'Croissant und Espresso – bitte nicht vom Seeteufel klauen lassen.' },
    { id: 'frogbaguette', name: 'Frosch mit Baguette', cat: 'prop', lvl: 11, price: 420, w: 106, sink: 5, wobble: true, info: 'Eine Froschstatue mit Baguette. Sie wackelt – vor Freude über das frische Brot.' },
    { id: 'morris', name: 'Litfaßsäule', cat: 'prop', text: true, lvl: 12, price: 380, w: 74, sink: 5, size: [0.6, 1.8], info: 'Mit Plakaten fürs Kabarett. Welche Vorstellung schauen wir uns an?' },
    { id: 'metro', name: 'Métro-Eingang', cat: 'prop', lvl: 14, price: 520, w: 140, sink: 5, size: [0.6, 1.8], hide: [0, 0.3],
      glows: [[0.12, 0.92, '#ffb347', 0.5], [0.88, 0.92, '#ffb347', 0.5]], info: 'Jugendstil-Bogen mit zwei Laternen. Nachts gehen sie an – nächster Zug nach Pigalle.' },
    { id: 'winebarrel', name: 'Bordeaux-Fass', cat: 'prop', lvl: 16, price: 650, w: 170, sink: 7, hide: [0.2, 0.42], info: 'Ein Fass mit Flasche – die Fische verstecken sich gern darin.' },
    { id: 'pontneuf', name: 'Pont Neuf', cat: 'prop', lvl: 18, price: 900, w: 300, sink: 6, size: [0.5, 1.6], hide: [0, 0.2], info: 'Die älteste Brücke von Paris – unter den Bögen schwimmt es sich wie auf der Seine.' },
    { id: 'louvre', name: 'Louvre-Pyramide', cat: 'prop', lvl: 20, price: 1200, w: 200, sink: 7, size: [0.5, 2.0], info: 'Glas und Stahl vor dem größten Museum der Welt.' },
    { id: 'arc', name: 'Triumphbogen', cat: 'prop', lvl: 22, price: 1500, w: 200, sink: 8, size: [0.5, 2.0], hide: [0, 0.3], info: 'Mitten auf dem Kreisverkehr – durch den Bogen passt jeder Fisch.' },
    { id: 'eiffel', name: 'Eiffelturm', cat: 'prop', lvl: 24, price: 1800, w: 150, sink: 6, size: [0.5, 2.2], sparkle: true, glow: [0.5, 0.42, '#ffcf6a', 0.95],
      info: 'Nachts goldgelb beleuchtet – und zu jeder vollen Stunde glitzert er fünf Minuten lang, wie das Original.' },
    { id: 'monalisa', name: 'Mona Lisa', cat: 'prop', text: true, lvl: 26, price: 2000, w: 104, sink: 5, size: [0.6, 2.0], info: 'Im Goldrahmen auf der Staffelei. Ihr Lächeln folgt dir durchs ganze Becken.' },
    { id: 'notredame', name: 'Notre-Dame', cat: 'prop', lvl: 28, price: 2400, w: 180, sink: 7, size: [0.5, 2.0], info: 'Die Kathedrale mit der großen Rosette – frisch renoviert und jetzt unter Wasser.' },
    // Runde 20f: verrückte Gegenstände im Wasser (OceanGape mit Titan-Heck, Rakija-Blasen, Handy-Display, Flügel mit Noten)
    { id: 'cart', name: 'Einkaufswagen', cat: 'prop', lvl: 8, price: 160, w: 160, sink: 5, hide: [0, 0.35], info: 'Irgendwer hat ihn nicht zurückgebracht. Der Euro steckt bestimmt noch drin.' },
    { id: 'bicycle', name: 'Fahrrad mit Körbchen', cat: 'prop', lvl: 10, price: 220, w: 200, sink: 5, info: 'Da ist wohl jemand mit dem Rad in den See gefahren. Das Körbchen ist jetzt ein Fischbett.' },
    { id: 'rakija', name: 'Rakija-Flasche', cat: 'prop', text: true, lvl: 12, price: 250, w: 70, sink: 5, size: [0.6, 2.0], bubbles: [0.5, 0.96, 1.5],
      info: 'Hausgemachter Šljivovica mit Pflaumen auf dem Etikett. Aus dem Korken steigen ständig Bläschen – Živjeli!' },
    { id: 'brickphone', name: 'Unkaputtbares Handy', cat: 'prop', text: true, lvl: 14, price: 300, w: 70, sink: 5, size: [0.6, 2.0], screen: [0.2, 0.245, 0.8, 0.425],
      info: 'Der Knochen aus den 2000ern: übersteht alles, sogar das Aquarium. Ab und zu leuchtet das Display auf – Snake läuft noch.' },
    { id: 'yugo', name: 'Versunkener Yugo', cat: 'prop', lvl: 18, price: 600, w: 220, sink: 7, size: [0.5, 1.8], hide: [0, 0.32], info: 'Der Kult-Kleinwagen vom Balkan. Fährt nicht mehr – dafür wohnen jetzt Fische drin.' },
    { id: 'sofa', name: 'Samt-Sofa', cat: 'prop', lvl: 20, price: 650, w: 210, sink: 6, size: [0.5, 1.8], info: 'Rotes Samtsofa mit Muschel-Kissen und Goldrahmen – die perfekte Couch für eine Unterwasser-Siesta.' },
    { id: 'phonebox', name: 'Rote Telefonzelle', cat: 'prop', lvl: 22, price: 700, w: 110, sink: 6, size: [0.5, 1.8], glows: [[0.5, 0.94, '#ffe9a8', 0.4], [0.5, 0.55, '#fff2c8', 0.75]],
      info: 'Very British. Nachts brennt drinnen noch Licht – angerufen hat aber schon lange keiner mehr.' },
    { id: 'plane', name: 'Flugzeugwrack', cat: 'prop', lvl: 26, price: 950, w: 270, sink: 8, size: [0.5, 1.6], hide: [0.05, 0.22], info: 'Eine alte Propellermaschine, sanft notgewassert. Unter den Tragflächen verstecken sich gern kleine Fische.' },
    { id: 'piano', name: 'Konzertflügel', cat: 'prop', lvl: 30, price: 1100, w: 200, sink: 7, size: [0.5, 1.6], notes: true, info: 'Spielt nur noch Wassermusik: Ab und zu steigen ein paar Noten auf.' },
    { id: 'oceangape', name: 'OceanGape', cat: 'prop', text: true, lvl: 32, price: 1200, w: 230, sink: 6, size: [0.5, 1.6], bubbles: [0.03, 0.41, 1.8],
      info: 'Ein Tauchboot mit Gamecontroller-Steuerung, weißem Heckkonus und vier Propellern. Fährt nirgendwo mehr hin – dafür wohnen jetzt Seepocken drauf.' },
    { id: 'capsule', name: 'Raumkapsel', cat: 'prop', lvl: 36, price: 1500, w: 170, sink: 6, size: [0.5, 1.8], glow: [0.5, 0.4, '#bfe8ff', 0.55],
      info: 'Eine Landekapsel wie aus der Apollo-Zeit – sie hat „Wasserlandung“ etwas zu wörtlich genommen. Nachts leuchtet das Bullauge.' },
    { id: 'titanic', name: 'Titanic-Wrack', cat: 'prop', text: true, lvl: 38, price: 1800, w: 340, sink: 8, size: [0.5, 1.6], hide: [-0.4, 0.45], bubbles: [0.61, 0.78, 2.6],      // 19.11.2026 (Damian, selbst gezeichnet: tools/redo20g/titanic.py)
      info: 'Der Bug der Titanic, so wie er seit 1912 in fast 4.000 Metern Tiefe liegt: Rost-Zapfen am schwarzen Rumpf, die Bugreling, der umgestürzte Vormast. Aus dem Loch des ersten Schornsteins steigen ab und zu Blasen – und im abgerissenen Ende verstecken sich gern die Fische.' },
    // Runde 20f: Höhlen und Moos (cave = Höhle für Höhlenbrüter, siehe 20e)
    { id: 'coconut', name: 'Kokosnuss-Höhle', cat: 'rock', lvl: 4, price: 45, w: 130, sink: 5, hide: [0, 0.3], cave: true, info: 'Der Klassiker: eine halbe Kokosnuss mit Eingang. Höhlenbrüter lieben sie.' },
    { id: 'claycave', name: 'Ton-Laichhöhle', cat: 'rock', lvl: 6, price: 60, w: 170, sink: 5, hide: [0.2, 0.32], cave: true, info: 'Eine Tonröhre und ein kleiner Tonbogen – Höhlen zum Verstecken und Laichen für Buntbarsche und Welse.' },
    { id: 'mosstree', name: 'Moosbaum', cat: 'plant', lvl: 12, price: 140, w: 150, sink: 5, home: 'fresh', sway: 0.015, size: [0.5, 1.8], info: 'Ein Bonsai aus Wurzelholz mit Javamoos-Krone – ein kleiner Baum unter Wasser.' },
    // Runde 20e: Afrika (selbst gezeichnet: tools/redo20e/deco.py)
    { id: 'shellpile', name: 'Muschel-Haufen', cat: 'rock', lvl: 12, price: 70, w: 160, sink: 5, hide: [0, 0.26], size: [0.5, 2.4],
      info: 'Leere Schneckenhäuser aus dem Tanganjikasee, zu einem Hügel aufgetürmt. Dort unten gibt es ganze Felder davon – kleine Buntbarsche wohnen darin.' },
    { id: 'limestone', name: 'Kalkfelsen (Lochgestein)', cat: 'rock', lvl: 14, price: 90, w: 170, sink: 6, hide: [0.22, 0.42], size: [0.5, 2.4],
      info: 'Heller Kalkstein voller Löcher und Grübchen – so sieht es im Malawi- und Tanganjikasee unter Wasser aus. Buntbarsche kleben an seinen Wänden und verstecken sich in den Löchern.' },
    { id: 'trophy_bronze', name: 'Bronzepokal', cat: 'prop', lvl: 1, price: 0, w: 86, sink: 4, trophy: 3, info: 'Platz 3 in der Wochen-Rangliste. Gibt es nicht zu kaufen – nur zu gewinnen.' },
    { id: 'trophy_silver', name: 'Silberpokal', cat: 'prop', lvl: 1, price: 0, w: 90, sink: 4, trophy: 2, info: 'Platz 2 in der Wochen-Rangliste. Gibt es nicht zu kaufen – nur zu gewinnen.' },
    { id: 'trophy_gold', name: 'Goldpokal', cat: 'prop', lvl: 1, price: 0, w: 96, sink: 4, trophy: 1, info: 'Platz 1 in der Wochen-Rangliste! Gibt es nicht zu kaufen – nur zu gewinnen.' },
    { id: 'trophy_star', name: 'Sternenpokal', cat: 'prop', lvl: 1, price: 0, w: 92, sink: 4, trophy: 4, info: 'Für eine volle 7-Tage-Serie im Login-Kalender. Gibt es nicht zu kaufen – nur zu verdienen.' },
    { id: 'trophy_fish', name: 'Goldfisch-Statue', cat: 'prop', lvl: 1, price: 0, w: 100, sink: 4, trophy: 5, info: 'Für ein Becken mit Gold-Biotop (alle vier Punkte). Gibt es nicht zu kaufen – nur zu verdienen.' },
    // Runde 13: kleine Deko
    { id: 'scallop', name: 'Jakobsmuschel', cat: 'prop', lvl: 2, price: 12, w: 66, sink: 4, info: 'Eine kleine Muschel, aufgestellt wie ein Fächer.' },
    { id: 'airstone', name: 'Sprudelstein', cat: 'prop', lvl: 3, price: 18, w: 68, sink: 3, bubbles: [0.5, 0.85, 0.12], info: 'Ein poröser Stein, aus dem ständig feine Luftperlen aufsteigen – wie im echten Aquarium.' },
    { id: 'teapot', name: 'Versunkene Teekanne', cat: 'prop', lvl: 4, price: 24, w: 78, sink: 4, info: 'Feines Porzellan mit blauen Blumen – irgendwer hat hier unten seinen Tee vergessen.' },
    { id: 'seaglass', name: 'Meerglas', cat: 'prop', lvl: 5, price: 22, w: 70, sink: 3, info: 'Rund geschliffene Glasscherben vom Strand, in Türkis, Mint und Bernstein.' },
    { id: 'coins', name: 'Goldmünzen-Häufchen', cat: 'prop', lvl: 6, price: 30, w: 76, sink: 4, info: 'Ein kleiner Haufen Gold. Ob da noch mehr vergraben liegt?' },
    { id: 'ammonite', name: 'Ammonit', cat: 'rock', lvl: 8, price: 28, w: 70, sink: 4, size: [0.5, 3], info: 'Ein versteinertes Schneckenhaus aus der Urzeit – über 65 Millionen Jahre alt.' },
    { id: 'lighthouse', name: 'Mini-Leuchtturm', cat: 'prop', lvl: 10, price: 45, w: 62, sink: 4, info: 'Rot-weiß gestreift – zeigt den Fischen den Heimweg.' },
    { id: 'cannon', name: 'Schiffskanone', cat: 'prop', lvl: 12, price: 50, w: 92, sink: 4, info: 'Alt und rostig – sie stammt von einem gesunkenen Piratenschiff.' },
    { id: 'stonelantern', name: 'Steinlaterne', cat: 'prop', lvl: 14, price: 55, w: 62, sink: 4, stone: true, info: 'Eine japanische Gartenlaterne aus Granit – passt perfekt auf den Zen-Kies.' },
    { id: 'frogking', name: 'Froschkönig', cat: 'prop', lvl: 15, price: 60, w: 64, sink: 4, stone: true, info: 'Ein Frosch aus Stein mit goldener Krone. Küssen auf eigene Gefahr.' },
    // Runde 13: Wege – liegen flach im Kies (von oben gemalt, auf den Blickwinkel des Bodens gestaucht), Fische schwimmen darüber
    // Runde 13: Treppen – jede Stufe ist eine Stellfläche
    { id: 'stairs_stone', name: 'Felstreppe', cat: 'rock', stairs: true, lvl: 11, price: 70, w: 230, sink: 5, size: [0.5, 2.3], tops: [[0.058, 0.175, 0.254], [0.232, 0.29, 0.49], [0.343, 0.495, 0.739], [0.56, 0.932, 0.973]], info: 'Vier grobe Steinplatten als Treppe – jede Stufe ist eine Stellfläche.' },
    { id: 'stairs_wood', name: 'Holztreppe', cat: 'rock', stairs: true, lvl: 16, price: 85, w: 220, sink: 5, wood: true, size: [0.5, 2.4], tops: [[0.017, 0.136, 0.196], [0.168, 0.32, 0.392], [0.354, 0.535, 0.592], [0.567, 0.836, 0.781], [0.868, 0.973, 0.997]], info: 'Alte Holzstufen mit Pfosten – auf jede Stufe und sogar auf den Pfosten passt etwas.' },
    { id: 'stairs_marble', name: 'Tempeltreppe', cat: 'rock', stairs: true, lvl: 22, price: 140, w: 240, sink: 4, size: [0.5, 2.2], tops: [[0.017, 0.116, 0.213], [0.148, 0.244, 0.407], [0.276, 0.373, 0.601], [0.405, 0.498, 0.798], [0.53, 0.976, 0.996]], info: 'Fünf Marmorstufen mit Goldkante, wie vor einem griechischen Tempel.' },
    // Runde 18: Weihnachten (season: 'xmas' = nur im Reiter „Weihnachten“, solange Weihnachtszeit ist). lights = Lichterkette, globe = Schneekugel
    // [x, y, Radius] im Bild, shine = funkelt ab und zu (1 = selten, 2 = öfter), mistle = Mistelzweig (Brut- und Pausen-Faktor), wave = Schneemann-Schulter
    { id: 'baubles', name: 'Christbaumkugeln', cat: 'prop', season: 'xmas', lvl: 1, price: 15, w: 80, sink: 5, shine: 1, info: 'Vier Kugeln in Rot, Gold, Blau und Silber – sie glänzen ab und zu auf.' },
    { id: 'giftbox', name: 'Geschenk', cat: 'prop', season: 'xmas', lvl: 1, price: 20, w: 56, sink: 5, info: 'Rot mit weißen Punkten und goldener Schleife. Was wohl drin ist?' },
    { id: 'firtree', name: 'Tannenbaum', cat: 'plant', season: 'xmas', lvl: 2, price: 35, w: 120, sink: 6, sway: 0.02, info: 'Eine verschneite Tanne. Wiegt sich ganz leicht im Wasser.' },
    { id: 'xmassign', name: 'Merry-Christmas-Schild', cat: 'prop', season: 'xmas', lvl: 2, price: 30, w: 100, sink: 7, wood: true, info: 'Ein Holzschild mit Schnee und Stechpalme.' },
    { id: 'giftpile', name: 'Geschenke-Haufen', cat: 'prop', season: 'xmas', lvl: 3, price: 45, w: 100, sink: 6, info: 'Drei Geschenke übereinander – rot, grün und blau.' },
    { id: 'snowmoss', name: 'Schnee-Mooskugeln', cat: 'plant', season: 'xmas', lvl: 4, price: 25, w: 110, sink: 4, info: 'Drei Mooskugeln mit Schneemützen.' },
    { id: 'firlit', name: 'Geschmückter Tannenbaum', cat: 'prop', season: 'xmas', lvl: 5, price: 90, w: 120, sink: 6, glow: [0.5, 0.45, '#ffd27a', 1.2],
      lights: [[0.64, 0.232], [0.562, 0.259], [0.413, 0.261], [0.351, 0.266], [0.459, 0.275], [0.61, 0.28], [0.371, 0.281], [0.608, 0.296], [0.37, 0.296], [0.496, 0.303], [0.492, 0.319], [0.481, 0.342], [0.702, 0.372], [0.627, 0.407], [0.538, 0.429], [0.405, 0.441], [0.44, 0.451], [0.343, 0.462], [0.706, 0.468], [0.272, 0.483], [0.695, 0.492], [0.571, 0.493], [0.418, 0.499], [0.755, 0.559], [0.247, 0.579], [0.664, 0.581], [0.242, 0.59], [0.341, 0.593], [0.551, 0.595], [0.442, 0.6], [0.757, 0.682], [0.661, 0.698], [0.818, 0.705], [0.135, 0.707], [0.304, 0.708], [0.559, 0.715], [0.166, 0.716], [0.252, 0.717], [0.672, 0.717], [0.393, 0.72], [0.164, 0.731], [0.665, 0.735], [0.321, 0.74], [0.493, 0.744], [0.149, 0.757]],
      info: 'Mit Kugeln, Stern und Lichterkette. Die Lichter funkeln der Reihe nach, nachts leuchtet der ganze Baum.' },
    { id: 'nutcracker', name: 'Nussknacker', cat: 'prop', season: 'xmas', lvl: 6, price: 70, w: 56, sink: 6, wood: true, info: 'Steht stramm in roter Uniform und bewacht das Becken.' },
    { id: 'santadiver', name: 'Taucher-Weihnachtsmann', cat: 'prop', season: 'xmas', lvl: 7, price: 95, w: 90, sink: 7, bubbles: [0.366, 0.877, 2.4], info: 'Mit Taucherbrille, Schnorchel und einem Sack voller Geschenke. Aus dem Schnorchel steigen Blasen.' },
    { id: 'snowglobe', name: 'Schneekugel', cat: 'prop', season: 'xmas', lvl: 8, price: 120, w: 80, sink: 5, globe: [0.5, 0.398, 0.499], info: 'Drinnen rieselt der Schnee. Antippen schüttelt sie – dann wirbelt er hoch.' },
    { id: 'oldsleigh', name: 'Versunkener Schlitten', cat: 'prop', season: 'xmas', lvl: 9, price: 110, w: 150, sink: 7, wood: true, info: 'Liegt schon lange hier unten – mit Algen und zwei Seepocken.' },
    { id: 'gingerwreck', name: 'Lebkuchenhaus-Wrack', cat: 'prop', season: 'xmas', lvl: 10, price: 140, w: 150, sink: 7, hide: [-0.05, 0.2], fav: 'candyeel', info: 'Halb eingestürzt und angeknabbert – ein Versteck für Höhlenbewohner.' },
    { id: 'mistletoe', name: 'Mistelzweig-Alge', cat: 'plant', season: 'xmas', lvl: 10, price: 0, pearls: 5, w: 90, sink: 5, sway: 0.03, mistle: { hatch: 0.9, pause: 0.9 },
      info: 'Im Becken, in dem sie steht, schlüpfen Eier 10 % schneller und die Paarungspause ist 10 % kürzer – nicht im Brutbecken. Eine pro Becken wirkt.' },
    { id: 'snowchurch', name: 'Kirche im Schnee', cat: 'prop', season: 'xmas', lvl: 12, price: 220, w: 120, sink: 8, stone: true, glow: [0.447, 0.301, '#ffd27a', 1.0], info: 'Eine kleine Dorfkirche mit Glocke. Nachts leuchten die Fenster.' },
    { id: 'balkansled', name: 'Balkanmafia Schlitten', cat: 'prop', season: 'xmas', lvl: 15, price: 1500, w: 170, sink: 5, shine: 2, info: 'Schwarze Limo im Geschenkpapier: Blondi am Steuer, der Braunhaarige hängt hinten aus dem Fenster.' },
    { id: 'snowman', name: 'Schneemann', cat: 'critter', season: 'xmas', lvl: 4, price: 35, w: 62, sink: 2, water: 'both', crawl: ['snowman', 16], wave: [0.7386, 0.3783],
      info: 'Gleitet über den Boden, dreht sich ab und zu um und winkt wie verrückt. Muscheln als Knöpfe, Koralle als Nase.' }
  ];
  AA.DECO_BY = {};
  AA.DECO.forEach(function (d) { AA.DECO_BY[d.id] = d; });
  /* Runde 18: aus dem Spiel genommen (Steinkopf mit Hut, die Brücken und die Wege). Wer eins hatte, bekommt beim Laden den Kaufpreis zurück (AA.dropGone, js/state.js). */
  AA.DECO_GONE = { moai_pukao: ['Steinkopf mit Hut', 340], stonebridge: ['Steinbrücke', 160], rootbridge: ['Wurzelbrücke', 165],
    path_stones: ['Trittstein-Pfad', 40], path_planks: ['Holzbohlen-Weg', 48], path_mosaic: ['Mosaik-Weg', 90] };
  /* 19.11.2026 (Damian): noch einmal aufgeräumt – drei Tiere, drei Krabbler, drei Deko-Stücke und sechs Böden. Wer etwas davon hat, bekommt beim
     Laden einmal etwas zurück (AA.dropGone20, js/state.js): Tiere den Verkaufswert (Grenouille ihre 15 Perlen), Deko und Krabbler den Kaufpreis.
     Böden kosten nichts – ein Becken mit einem davon bekommt wieder Sand. */
  AA.GONE20 = {
    fish: { kissing: ['Küssender Gurami', 143], puffer: ['Igelfisch', 303], frenchfrog: ['Grenouille', 0, 15] },
    deco: { petanque: ['Pétanque-Kugeln', 120], fridge: ['Retro-Kühlschrank', 420], mosswall: ['Mooswand', 180],
      mudskipper: ['Schlammspringer', 75], arrowcrab: ['Pfeilkrabbe', 95], pistolgoby: ['Pistolenkrebs & Wächtergrundel', 120] },
    floors: ['cobble', 'autumnleaves', 'footprints', 'ripplesand', 'seagrasslawn', 'travertine']
  };
  /* Runde 18: Weihnachtszeit nach dem Kalender des Geräts. shop = Reiter „Weihnachten“ im Shop (15. November bis 6. Januar), hats = Mützen auf den
     Clownfischen (1. Dezember bis 6. Januar), advent = Knopf „Adventskalender“ (wie shop). Für Tests: window.AA_DATE = '2026-12-05'. */
  AA.season = function (now) {
    const d = now || (window.AA_DATE ? new Date(window.AA_DATE + 'T12:00:00') : new Date()), m = d.getMonth() + 1, day = d.getDate();
    const shop = (m === 11 && day >= 15) || m === 12 || (m === 1 && day <= 6), hats = m === 12 || (m === 1 && day <= 6);
    return { xmas: shop, hats: hats, advent: shop };
  };
  let seasonC = null, seasonT = 0, seasonK = '';
  AA.seasonNow = function () {                       // dasselbe, aber höchstens alle 30 Sekunden neu gerechnet (wird je Bild und Fisch gefragt)
    const now = Date.now(), k = window.AA_DATE || '';
    if (!seasonC || now - seasonT > 30000 || k !== seasonK) { seasonC = AA.season(); seasonT = now; seasonK = k; }
    return seasonC;
  };
  /* Putzkolonne (Runde 8): Jobs der Krabbler. algae = frisst Algen (bremst Veralgen, clean), glass = putzt die Scheibe (hinterlässt saubere Spuren und
     bremst Veralgen), food = räumt liegen gebliebenes Futter weg (sonst fault es und macht Schmutz), doctor = Putzerstation für die Fische.
     Sind mindestens zwei Jobs besetzt, gibt es einen Bonus, mit allen drei Putz-Jobs (algae, glass, food) einen größeren – und eine höhere Obergrenze. */
  AA.JOBS = { algae: { name: 'Algenfresser', ico: '🌿' }, glass: { name: 'Scheibenputzer', ico: '🪟' }, food: { name: 'Resteverwerter', ico: '🍽️' }, doctor: { name: 'Putzerstation', ico: '🩺' } };
  AA.CREW = { two: 0.1, three: 0.2, max: 0.6, maxFull: 0.8, rot: 0.005, k: 1.6 };      // k: Runde 11 – weniger Krabbler pro Becken, dafür putzt jeder 60 % mehr
  AA.DECO_CAT = { plant: 'Pflanzen & Korallen', rock: 'Steine & Holz', prop: 'Requisiten', critter: 'Krabbler', special: 'Spezial' };

  /* ---------- Deko-Größe ----------
     Beim Einrichten lässt sich jedes Stück stufenlos größer und kleiner ziehen (gespeichert als o.s, 1 = Originalgröße) – aber nur
     innerhalb seiner Spanne [kleinste, größte]:
       Pflanzen & Korallen, Steine & Holz   50 % … 300 %   (wachsen in der Natur auch in jeder Größe)
       Requisiten (Amphore, Burg, Anker …)  60 % … 200 %   (ein Fass, dreimal so groß wie der Hai, sieht nur noch albern aus)
       fest: Krabbler und Oktopus (Tiere haben ihre eigene Größe), Schatzkiste und Blubber-Muschel (Spielfunktion)
     Was schon in Originalgröße groß ist, bekommt oben in der Liste per size:[…] eine kleinere Obergrenze: kein Stück wird breiter als
     AA.DECO_LIMIT.w oder höher als AA.DECO_LIMIT.h (Pixel bei Tiefe „ganz vorn“) – so ragt nichts aus dem Wasser oder stellt das
     halbe Becken zu. Der Test test/decosize.py prüft das für jedes Stück gegen die echten Bildmaße. */
  AA.DECO_SIZE = { plant: [0.5, 3], rock: [0.5, 3], prop: [0.6, 2], critter: null, special: null };
  AA.DECO_LIMIT = { w: 540, h: 500 };

  /* ---------- Kies (Wechsel gratis, Farben nach Level) und Hintergründe (kosten Perlen) ---------- */
  AA.FLOORS = [
    { id: 'sand', name: 'Heller Kies', lvl: 1 },
    { id: 'black', name: 'Schwarzer Kies', lvl: 2 },
    { id: 'teal', name: 'Türkiser Kies', lvl: 4 },
    { id: 'blue', name: 'Blauer Kies', lvl: 6 },
    { id: 'pink', name: 'Rosa Kies', lvl: 8 },
    { id: 'glass', name: 'Bunte Glaskiesel', lvl: 10 },
    { id: 'volcanic', name: 'Vulkangestein', lvl: 12 },
    { id: 'pinklava', name: 'Pink Lava', lvl: 14 },
    { id: 'gold', name: 'Goldkies', lvl: 16 },
    /* Runde 7: 20 neue Böden mit eigener Beschaffenheit (gemalt, nicht umgefärbt) */
    { id: 'whitegravel', name: 'Weißer Kies', lvl: 2 },
    { id: 'finesand', name: 'Feiner Sand', lvl: 3 },
    { id: 'riverstone', name: 'Flusskiesel', lvl: 5 },
    { id: 'amazonsoil', name: 'Amazonas-Grund (Laub)', lvl: 7 },
    { id: 'split_sandblack', name: 'Zweigeteilt: Sand | schwarzer Kies', lvl: 9, seam: 0.494 },      // seam = Lage der Naht im Bild (Anteil der Breite)
    { id: 'coralsand', name: 'Korallensand', lvl: 11 },
    { id: 'aquasoil', name: 'Dunkler Soil', lvl: 13 },
    { id: 'mossfloor', name: 'Moos-Teppich', lvl: 15 },
    { id: 'shells', name: 'Muschelgrund', lvl: 17 },
    { id: 'slatefloor', name: 'Schieferplatten', lvl: 19 },
    { id: 'split_whitemoss', name: 'Zweigeteilt: weißer Kies | Moos', lvl: 21, seam: 0.488 },
    { id: 'zen', name: 'Zen-Garten (geharkt)', lvl: 23 },
    { id: 'mud', name: 'Teichschlamm', lvl: 25 },
    { id: 'redclay', name: 'Roter Lehm', lvl: 27 },
    { id: 'lavasand', name: 'Schwarzer Lavasand', lvl: 29 },
    { id: 'split_stonesand', name: 'Zweigeteilt: Flusskiesel | Sand', lvl: 31, seam: 0.495 },
    { id: 'marble', name: 'Marmorkiesel', lvl: 33 },
    { id: 'icegravel', name: 'Gletscherkies', lvl: 35 },
    { id: 'crystal', name: 'Kristallsplitt', lvl: 38 },
    { id: 'amber', name: 'Bernsteinkies', lvl: 42 },
    /* Runde 10: 10 neue Böden (der rote Kies ist aus dem hellen Kies umgefärbt) */
    { id: 'riosand', name: 'Rio-Negro-Sand (Laub)', lvl: 4 },
    { id: 'xmas', name: 'Weihnachtsschnee', lvl: 5 },
    { id: 'wadden', name: 'Wattenmeer', lvl: 6 },
    { id: 'redgravel', name: 'Roter Kies', lvl: 9 },
    { id: 'tanganyika', name: 'Tanganjika-Schneckenhäuser', lvl: 12 },
    { id: 'coralrubble', name: 'Korallenbruch', lvl: 16 },
    { id: 'treasure', name: 'Schatzgrund', lvl: 24 },
    { id: 'nacre', name: 'Perlmutt', lvl: 28 },
    { id: 'deepsea', name: 'Tiefsee-Schlick', lvl: 30 },
    { id: 'olymp', name: 'Olymp-Marmor', lvl: 34 },
    /* Runde 18: zwei Winterböden – nicht an die Weihnachtszeit gebunden */
    { id: 'powder', name: 'Pulverschnee', lvl: 1 },
    { id: 'winterwood', name: 'Winterwald-Boden', lvl: 3 },
    /* Runde 20d: Paris */
    /* Runde 20f: sieben Böden */
    { id: 'pinksand', name: 'Rosa Strand (Bahamas)', lvl: 14 },
    { id: 'stardust', name: 'Sternenstaub', lvl: 24 }
  ];
  /* ---------- Boden-Formen (Runde 7): 10 Anordnungen, gratis, jederzeit wechselbar. f(u) = Höhe 0…1 an der Stelle u (0 = links, 1 = rechts);
     an der höchsten Stelle liegt der Boden AA.LIFT_MAX Pixel höher. Deko, Eier, Krabbler und Futter folgen der Form von allein. ---------- */
  AA.LIFT_MAX = 64;
  (function () {
    const sm = function (a, b, x) { x = Math.max(0, Math.min(1, (x - a) / (b - a))); return x * x * (3 - 2 * x); }, C = Math.cos, PI = Math.PI;
    AA.SHAPES = [
      { id: 'flat', name: 'Eben', f: null },
      { id: 'slopeL', name: 'Hang – links hoch', f: function (u) { return 1 - sm(0.08, 0.92, u); } },
      { id: 'slopeR', name: 'Hang – rechts hoch', f: function (u) { return sm(0.08, 0.92, u); } },
      { id: 'valley', name: 'Tal – links und rechts ein Haufen', f: function (u) { return (C(2 * PI * u) + 1) / 2; } },
      { id: 'hill', name: 'Hügel in der Mitte', f: function (u) { return (1 - C(2 * PI * u)) / 2; } },
      { id: 'moundL', name: 'Haufen links', f: function (u) { const d = (u - 0.2) / 0.17; return Math.exp(-d * d); } },
      { id: 'moundR', name: 'Haufen rechts', f: function (u) { const d = (u - 0.8) / 0.17; return Math.exp(-d * d); } },
      { id: 'terrace', name: 'Terrasse – links eine Stufe', f: function (u) { return 1 - sm(0.36, 0.5, u); } },
      { id: 'twin', name: 'Zwei Hügel', f: function (u) { return (1 - C(4 * PI * u)) / 2; } },
      { id: 'dunes', name: 'Dünen', f: function (u) { return 0.45 + 0.4 * Math.sin(u * 7 * PI + 0.8) * (0.6 + 0.4 * Math.sin(u * 2.3 * PI)); } }
    ];
    AA.SHAPE_BY = {}; AA.SHAPES.forEach(function (x) { AA.SHAPE_BY[x.id] = x; });
  })();
  AA.FLOOR_BY = {};
  AA.FLOORS.forEach(function (f) { AA.FLOOR_BY[f.id] = f; });

  /* cols = Wasserfarbe von oben nach unten, far = Farbe der Silhouetten im Hintergrund, ray = Lichtstrahlen */
  AA.WALLS = [
    { id: 'aqua', name: 'Aquamarin', pearls: 0, cols: ['#9af3e6', '#5fdcd8', '#33bdd0', '#1f9dc0'], far: '#27a9c2', ray: '255,255,235' },
    { id: 'river', name: 'Flussgrün', pearls: 0, cols: ['#d9f7c8', '#a9e6a0', '#6fca8a', '#3f9f7a'], far: '#4aa980', ray: '250,255,215' },
    { id: 'lagoon', name: 'Lagune', pearls: 2, cols: ['#c9fbe0', '#86ecc4', '#43cfae', '#22a898'], far: '#2bb39d', ray: '255,255,225' },
    { id: 'deep', name: 'Tiefblau', pearls: 3, cols: ['#4f8fe0', '#2f66c4', '#1d439c', '#142a6e'], far: '#1a3a8c', ray: '190,220,255' },
    { id: 'sunset', name: 'Abendrot', pearls: 4, cols: ['#ffd27a', '#ff9e7a', '#e36a9b', '#8a4fb5'], far: '#b85aa6', ray: '255,240,200' },
    { id: 'candy', name: 'Bonbon', pearls: 5, cols: ['#ffe3f1', '#ffb9dd', '#d9a4f5', '#9c8cf0'], far: '#b596ee', ray: '255,255,255' },
    /* gemalte Hintergrundbilder (img = Schlüssel im Bündel bg); cols/far bleiben als Ersatzfarben für Vorschauen */
    { id: 'reef', name: 'Korallenriff', pearls: 4, img: 'bg/reef', home: 'salt', cols: ['#b8f6f2', '#7fe9ee', '#4fd6e8', '#2cc0de'], far: '#3cc4dc', ray: '255,255,240' },
    { id: 'kelpforest', name: 'Tangwald', pearls: 5, img: 'bg/kelpforest', home: 'salt', cols: ['#d6f5cf', '#a5e6c8', '#6fcdb9', '#48aea4'], far: '#55b5a6', ray: '255,255,225' },
    { id: 'ruins', name: 'Versunkener Tempel', pearls: 8, img: 'bg/ruins', home: 'salt', cols: ['#5fa8e0', '#3f86cc', '#2b68b4', '#1f4f96'], far: '#2a62aa', ray: '200,230,255' },
    { id: 'amazon', name: 'Amazonas', pearls: 4, img: 'bg/amazon', home: 'fresh', cols: ['#f2c860', '#d9a84c', '#b98a3e', '#8a6230'], far: '#a67a3a', ray: '255,240,190' },
    { id: 'iwagumi', name: 'Bergbach', pearls: 5, img: 'bg/iwagumi', home: 'fresh', cols: ['#c8f7e4', '#93ecd3', '#62d9c2', '#3fc2b0'], far: '#4cc8b4', ray: '255,255,235' },
    { id: 'lilypond', name: 'Seerosenteich', pearls: 6, img: 'bg/lilypond', home: 'fresh', cols: ['#e3f9b8', '#b9eda0', '#8fdc92', '#6cc58a'], far: '#78cc8e', ray: '255,255,215' },
    /* Runde 7: 20 neue gemalte Kulissen */
    { id: 'atoll', name: 'Atoll', pearls: 3, img: 'bg/atoll', home: 'salt', cols: ['#bff8f4', '#86eef0', '#52dcea', '#33c8e2'], far: '#40cde4', ray: '255,255,240' },
    { id: 'seagrass', name: 'Seegraswiese', pearls: 3, img: 'bg/seagrass', home: 'salt', cols: ['#c9f7dc', '#9decd0', '#74dcc0', '#56c6ae'], far: '#60ccb4', ray: '255,255,225' },
    { id: 'redsea', name: 'Rotes Meer', pearls: 4, img: 'bg/redsea', home: 'salt', cols: ['#b9ecfa', '#86d8f6', '#5cc2ee', '#3eaae2'], far: '#48b2e6', ray: '255,255,240' },
    { id: 'mangrove', name: 'Mangroven', pearls: 4, img: 'bg/mangrove', home: 'salt', cols: ['#cfe9a8', '#9bd3a0', '#6fb898', '#4f9c8c'], far: '#5aa692', ray: '255,250,200' },
    { id: 'shipwreck', name: 'Wrack-Friedhof', pearls: 5, img: 'bg/shipwreck', home: 'salt', cols: ['#b4f0ee', '#84e2e6', '#5bcfdc', '#3fbad0'], far: '#48c0d4', ray: '255,255,240' },
    { id: 'grotto', name: 'Meeresgrotte', pearls: 5, img: 'bg/grotto', home: 'salt', cols: ['#a8eafa', '#74d8f6', '#48c4f0', '#2caee6'], far: '#38b6ea', ray: '255,255,240' },
    { id: 'arctic', name: 'Eismeer', pearls: 6, img: 'bg/arctic', home: 'salt', cols: ['#dff6fc', '#b8e8f8', '#94d8f2', '#78c8ea'], far: '#84d0ee', ray: '255,255,255' },
    { id: 'openocean', name: 'Hochsee', pearls: 6, img: 'bg/openocean', home: 'salt', cols: ['#9fe6f8', '#62ccf4', '#3aaeea', '#2594de'], far: '#2e9ee2', ray: '255,255,235' },
    { id: 'nightreef', name: 'Riff bei Nacht', pearls: 7, img: 'bg/nightreef', home: 'salt', cols: ['#4a6fd0', '#3a52b8', '#3040a4', '#2a3492'], far: '#30409c', ray: '200,220,255' },
    { id: 'abyss', name: 'Tiefsee', pearls: 8, img: 'bg/abyss', home: 'salt', cols: ['#2f5cb8', '#2646a0', '#1f358a', '#1a2a78'], far: '#203484', ray: '180,210,255' },
    { id: 'lowriver', name: 'Flusslauf', pearls: 3, img: 'bg/lowriver', home: 'fresh', cols: ['#e6ee9a', '#cfd97c', '#b8c468', '#a2ae58'], far: '#aab860', ray: '255,255,200' },
    { id: 'reeds', name: 'Schilfgürtel', pearls: 3, img: 'bg/reeds', home: 'fresh', cols: ['#eef0a0', '#d4dc84', '#b8c870', '#9eb460'], far: '#a8bc66', ray: '255,255,200' },
    { id: 'bamboo', name: 'Bambusbach', pearls: 4, img: 'bg/bamboo', home: 'fresh', cols: ['#d8f8c8', '#b0eeb8', '#8ce0aa', '#70d0a0'], far: '#7ad6a4', ray: '255,255,225' },
    { id: 'japanpond', name: 'Japan-Teich', pearls: 5, img: 'bg/japanpond', home: 'fresh', cols: ['#d6f2b0', '#aee4a4', '#88d49c', '#6cc294'], far: '#76c898', ray: '255,255,215' },
    { id: 'alpinelake', name: 'Bergsee', pearls: 5, img: 'bg/alpinelake', home: 'fresh', cols: ['#c4f4ee', '#96e4e0', '#70d0d2', '#56bcc4'], far: '#60c4ca', ray: '255,255,240' },
    { id: 'malawi', name: 'Malawisee', pearls: 5, img: 'bg/malawi', home: 'fresh', cols: ['#b8ecfa', '#88d8f4', '#60c4ec', '#44b0e2'], far: '#4eb8e6', ray: '255,255,240' },
    { id: 'waterfall', name: 'Wasserfall-Becken', pearls: 6, img: 'bg/waterfall', home: 'fresh', cols: ['#c8f8e8', '#98ecd8', '#6edcc8', '#52c8b6'], far: '#5cd0bc', ray: '255,255,235' },
    { id: 'floodforest', name: 'Überschwemmter Wald', pearls: 6, img: 'bg/floodforest', home: 'fresh', cols: ['#d8f0a0', '#a8dc90', '#80c684', '#62b07a'], far: '#6cb87e', ray: '255,255,205' },
    { id: 'blackwater', name: 'Schwarzwasser', pearls: 7, img: 'bg/blackwater', home: 'fresh', cols: ['#f0b040', '#d08828', '#a85e20', '#7a3a1a'], far: '#94501e', ray: '255,225,160' },
    { id: 'cenote', name: 'Cenote', pearls: 8, img: 'bg/cenote', home: 'fresh', cols: ['#b0f0f4', '#80e0ee', '#58cce6', '#3cb6da'], far: '#46bede', ray: '255,255,245' },
    /* Runde 10: 10 kräftige Kulissen – drei davon Spezial (Korallenriff, Olymp, Weihnachten) */
    { id: 'reef2', name: 'Buntes Korallenriff', pearls: 10, img: 'bg/reef2', home: 'salt', special: true, cols: ['#5beffd', '#41e8fd', '#43e3ee', '#5fd9da'], far: '#81abcd', ray: '255,255,235' },
    { id: 'olymp', name: 'Olymp', pearls: 12, img: 'bg/olymp', home: 'salt', special: true, cols: ['#d7e2aa', '#63d2ec', '#9ad6d8', '#4bb3e1'], far: '#a5cbcc', ray: '255,255,235' },
    { id: 'xmas', name: 'Weihnachten', pearls: 8, img: 'bg/xmas', special: true, cols: ['#7db7db', '#58a5de', '#55a1ec', '#2a79d9'], far: '#6aa1da', ray: '255,255,235' },
    { id: 'vents', name: 'Tiefsee-Schlote', pearls: 7, img: 'bg/vents', home: 'salt', cols: ['#0256a6', '#043284', '#062b7d', '#0a236b'], far: '#253680', ray: '255,255,235' },
    { id: 'jungle', name: 'Amazonas-Dschungel', pearls: 6, img: 'bg/jungle', home: 'fresh', cols: ['#cddb34', '#cbd53b', '#beb82f', '#b89d31'], far: '#aea226', ray: '255,255,235' },
    { id: 'castlelake', name: 'Burgsee', pearls: 6, img: 'bg/castlelake', home: 'fresh', cols: ['#8defb7', '#4dd5ca', '#39c4c6', '#29aeb6'], far: '#44baad', ray: '255,255,235' },
    { id: 'tanganyika', name: 'Tanganjikasee', pearls: 6, img: 'bg/tanganyika', home: 'fresh', cols: ['#39d2fb', '#25aff2', '#1f9ae7', '#8db5bb'], far: '#5d8dc2', ray: '255,255,235' },
    { id: 'atlantis', name: 'Atlantis', pearls: 9, img: 'bg/atlantis', home: 'salt', cols: ['#54eaf5', '#2dd1ec', '#45d2e9', '#1bb2d9'], far: '#62c6da', ray: '255,255,235' },
    { id: 'volcano', name: 'Unterwasser-Vulkan', pearls: 8, img: 'bg/volcano', home: 'salt', cols: ['#2baabf', '#3f8a9d', '#448293', '#236785'], far: '#5a6775', ray: '255,255,235' },
    { id: 'crystalcave', name: 'Kristallhöhle', pearls: 8, img: 'bg/crystalcave', home: 'fresh', cols: ['#83b3fc', '#6087f9', '#506ff0', '#4a57db'], far: '#6a72ec', ray: '255,255,235' },
    /* Runde 12: Adria-Biotop und fünf „lebende Kulissen“ (live: im Hintergrund ziehen Silhouetten vorbei – js/tankview.js drawLive) */
    { id: 'krka', name: 'Krka-Wasserfälle', pearls: 8, img: 'bg/krka', home: 'fresh', special: true, cols: ['#6deead', '#2cddca', '#63dccf', '#09bbb8'], far: '#8ad1a3', ray: '255,255,235' },
    { id: 'paris', name: 'Paris – Seine bei Nacht', pearls: 8, img: 'bg/paris', home: 'fresh', special: true, cols: ['#3e7061', '#126675', '#085967', '#32655b'], far: '#0f5c6c', ray: '255,226,150' },      // Runde 20d
    /* Runde 20f: neun Kulissen */
    { id: 'plitvice', name: 'Plitvicer Seen', pearls: 8, img: 'bg/plitvice', home: 'fresh', cols: ['#3d8d6e', '#178c81', '#25947c', '#29936b'], far: '#259784', ray: '255,255,235' },
    { id: 'autumnpond', name: 'Herbst-Teich', pearls: 6, img: 'bg/autumnpond', home: 'fresh', cols: ['#8c7a19', '#4d6725', '#2e6030', '#4d692b'], far: '#36612d', ray: '255,236,170' },
    { id: 'nile', name: 'Nil mit Pyramiden', pearls: 8, img: 'bg/nile', home: 'fresh', cols: ['#807f24', '#788331', '#547136', '#4e6529'], far: '#627937', ray: '255,240,180' },
    { id: 'caribbean', name: 'Karibik-Sandbank', pearls: 7, img: 'bg/caribbean', home: 'salt', cols: ['#71c7da', '#29aba2', '#039ead', '#39aa90'], far: '#0aa1ac', ray: '255,255,235' },
    { id: 'maldives', name: 'Malediven-Hausriff', pearls: 8, img: 'bg/maldives', home: 'salt', cols: ['#3dafb6', '#2c9db8', '#5881a0', '#6ea7ab'], far: '#4091a6', ray: '255,255,235' },
    { id: 'bluehole', name: 'Dean’s Blue Hole', pearls: 9, img: 'bg/bluehole', home: 'salt', special: true, cols: ['#39887b', '#05788f', '#014268', '#0b4b67'], far: '#015476', ray: '255,255,235' },
    { id: 'sunsetreef', name: 'Sonnenuntergang überm Riff', pearls: 9, img: 'bg/sunsetreef', home: 'salt', special: true, cols: ['#f07b45', '#4d886f', '#10708c', '#49707a'], far: '#147889', ray: '255,214,160' },
    { id: 'biolum', name: 'Biolumineszenz-Bucht', pearls: 9, img: 'bg/biolum', home: 'salt', special: true, cols: ['#045988', '#012e54', '#013058', '#023457'], far: '#012d54', ray: '170,220,255' },
    { id: 'space', name: 'Weltraum-Aquarium', pearls: 10, img: 'bg/space', special: true, cols: ['#395664', '#323f95', '#232e87', '#164f68'], far: '#3a388e', ray: '200,210,255' },
    { id: 'adria', name: 'Adria-Felsküste', pearls: 8, img: 'bg/adria', home: 'salt', special: true, cols: ['#1ac9fd', '#09aef9', '#22bceb', '#55a170'], far: '#68b0c7', ray: '255,255,235' },
    { id: 'whale', name: 'Offener Ozean', pearls: 10, img: 'bg/whale', home: 'salt', live: 'whale', cols: ['#2ae8fd', '#0bbef6', '#059fed', '#0293e6'], far: '#079cec', ray: '230,245,255' },
    { id: 'shoal', name: 'Riffkante', pearls: 10, img: 'bg/shoal', home: 'salt', live: 'shoal', cols: ['#17ecfd', '#03b5fb', '#0186f2', '#0879e9'], far: '#4487d6', ray: '255,255,235' },
    { id: 'jellybay', name: 'Dämmerungsbucht', pearls: 10, img: 'bg/jellybay', home: 'salt', live: 'jelly', cols: ['#e982cc', '#9672e4', '#836fe8', '#665bd1'], far: '#9477cb', ray: '255,225,245' },
    { id: 'polar', name: 'Polarmeer', pearls: 10, img: 'bg/polar', home: 'salt', live: 'polar', cols: ['#b2f5fc', '#48e7fd', '#3ce4fd', '#2bd9f7'], far: '#5be1fb', ray: '235,250,255' },
    { id: 'sunkencity', name: 'Versunkene Stadt', pearls: 12, img: 'bg/sunkencity', home: 'salt', live: 'city', special: true, cols: ['#6bc0e7', '#207ad0', '#2567c2', '#0f4ea9'], far: '#2c6db8', ray: '200,215,255' }
  ];
  AA.WALL_BY = {};
  AA.WALLS.forEach(function (w) { AA.WALL_BY[w.id] = w; });

  /* ---------- Aquarien: 50/75/100/125/150/175 Gallonen = 10/20/30/40/50/60 Bewohner, höchstens 8 Becken ----------
     Runde 20f (Damian, 19.11.2026): zwei Ausbaustufen mehr – 150 und 175 Gallonen, bis 60 Fische; Fische und Deko werden dabei kleiner (AA.ZOOM).
     AA.BIG_SIZE: ab dieser Stufe (125 Gallonen) dürfen Bodenhaie & Co. (big an der Art) einziehen – bleibt bei 3, auch mit den neuen Stufen. */
  AA.SIZES = [{ gal: 50, cap: 10 }, { gal: 75, cap: 20 }, { gal: 100, cap: 30 }, { gal: 125, cap: 40 }, { gal: 150, cap: 50 }, { gal: 175, cap: 60 }];
  AA.BIG_SIZE = 3;
  AA.MAX_TANKS = 8;                                   // dazu kommt das Sonderangebot Süßwasser-Becken (bonus) – also höchstens 9
  /* Preis und Mindest-Level für Becken idx (0 = erstes; das Bonus-Becken zählt nicht mit) in Größe size (0 = 50 Gallonen) */
  AA.tankReq = function (idx, size, bonus) {
    if (size >= 4) {                                    // Runde 20f: die großen Stufen – ab Level 20 (150 Gal.) bzw. 26 (175 Gal.), spätere Becken wie gehabt später
      const k = size - 4;
      return { price: [1500, 3000][k] + [250, 500][k] * (bonus ? 0 : idx), lvl: Math.max([20, 26][k] + (bonus ? 2 : 0), bonus ? 0 : 7 * idx + 2 * size) };
    }
    if (bonus) return { price: AA.FRESH_TANK.price[size], lvl: AA.FRESH_TANK.lvl[size] };
    if (idx === 0) return { price: [0, 100, 150, 200][size], lvl: [1, 3, 5, 6][size] };
    return { price: [300, 400, 500, 600][size], lvl: 7 * idx + 2 * size };
  };

  /* ---------- Futter-Regal (Preise sind eigene Werte – das Vorbild nennt keine) ---------- */
  AA.FOOD = [
    { id: 'small', name: 'Futterdöschen', ico: '🥫', lvl: 1, price: 5, food: 10, info: '10 Prisen für zwischendurch.' },
    { id: 'can', name: 'Futterdose', ico: '🥫', lvl: 2, price: 12, food: 30, info: '30 Prisen – reicht ein paar Tage.' },
    { id: 'bucket', name: 'Futtereimer', ico: '🪣', lvl: 6, price: 35, food: 100, info: '100 Prisen für volle Becken.' },
    { id: 'feeder3', name: 'Futterautomat (3 Tage)', ico: '⏲️', lvl: 4, price: 60, days: 3, info: 'Hält die Fische im aktuellen Becken 3 Tage lang satt – auch wenn du weg bist.' },
    { id: 'feeder7', name: 'Futterautomat (7 Tage)', ico: '⏲️', lvl: 10, pearls: 4, days: 7, info: 'Eine Woche Ruhe im aktuellen Becken. Kostet Perlen.' },
    /* Runde 8: Spezialfutter – wird gezielt gestreut (Futter-Werkzeug, Sorte oben wählen) */
    { id: 'color5', name: 'Farbfutter', ico: '🌈', kind: 'color', lvl: 8, price: 90, n: 5, info: '5 Prisen. Wer davon frisst, hat bei seinen nächsten 3 Eiern doppeltes Glück auf Farbvarianten.' },
    { id: 'turbo5', name: 'Turbofutter', ico: '⚡', kind: 'turbo', lvl: 5, price: 70, n: 5, info: '5 Prisen. Jungfische, die davon fressen, wachsen einen halben Tag lang 50 % schneller.' },
    { id: 'med3', name: 'Medizin', ico: '💊', kind: 'med', lvl: 3, price: 45, n: 3, info: '3 Prisen. Ein Bissen macht einen kranken Fisch sofort gesund – Kranke schwimmen gezielt hin.' },
    { id: 'live5', name: 'Lebendfutter (Futterfische)', ico: '🐟', kind: 'live', lvl: 18, price: 110, n: 5, info: '5 Portionen à 3 kleine Futterfische. Nur große Jäger (Hecht, Wels, Hai & Co.) schnappen sie – und sind danach lange satt.' }
  ];
  /* Spezialfutter: dur = Wirkdauer in Spiel-Sekunden, fill = wie satt ein Bissen macht */
  AA.FOOD2 = {
    color: { name: 'Farbfutter', ico: '🌈', eggs: 3, luck: 2, cols: ['#ff5b5b', '#ffb13b', '#ffe44d', '#6fdc6f', '#58b8ff', '#b77cff'] },
    turbo: { name: 'Turbofutter', ico: '⚡', dur: 43200, grow: 1.5, cols: ['#4fd8ff', '#2aa8ff', '#9af2ff'] },
    med: { name: 'Medizin', ico: '💊', cols: ['#ffffff', '#ff5a6a'] },
    live: { name: 'Lebendfutter', ico: '🐟', fill: 0.45, per: 3, life: 120 }
  };
  AA.FOOD_BY = {};
  AA.FOOD.forEach(function (f) { AA.FOOD_BY[f.id] = f; });

  /* ---------- Erfolge: vier Medaillen je Erfolg ---------- */
  AA.MEDAL_TIERS = [
    { name: 'Bronze', ico: '🥉', xp: 100, pearls: 1 }, { name: 'Silber', ico: '🥈', xp: 250, pearls: 2 },
    { name: 'Gold', ico: '🥇', xp: 1000, pearls: 3 }, { name: 'Platin', ico: '🏆', xp: 5000, pearls: 5 }
  ];
  AA.MEDALS = [
    { id: 'wrangler', name: 'Fisch-Dompteur', desc: 'Lass deine Fische Tricks vorführen.', goals: [10, 50, 200, 500], get: function (s) { return s.stats.tricks; } },
    { id: 'matchmaker', name: 'Kuppler der Meere', desc: 'Eier aus geglückten Paarungen.', goals: [10, 50, 1000, 5000], get: function (s) { return s.stats.eggs; } },
    { id: 'arranger', name: 'Deko-Künstler', desc: 'Münzen für Deko ausgeben.', goals: [1000, 5000, 10000, 50000], get: function (s) { return s.stats.spentDeco; } },
    { id: 'friend', name: 'Fischfreund', desc: 'Münzen für Fische ausgeben.', goals: [1000, 10000, 50000, 100000], get: function (s) { return s.stats.spentFish; } },
    { id: 'guardian', name: 'Aufzucht-Profi', desc: 'Fische bis zum Erwachsenenalter großziehen.', goals: [25, 500, 2000, 5000], get: function (s) { return s.stats.raised; } },
    { id: 'collector', name: 'Großer Sammler', desc: 'Verschiedene Arten kaufen.', goals: [5, 15, 35, 62], get: function (s) { return AA.keys(s.stats.spBought); } },
    { id: 'tycoon', name: 'Gezeiten-Tycoon', desc: 'Münzen mit Fischverkäufen verdienen.', goals: [500, 5000, 25000, 100000], get: function (s) { return s.stats.soldCoins; } },
    { id: 'protector', name: 'Arten-Beschützer', desc: 'Verschiedene Arten großziehen.', goals: [3, 10, 25, 50], get: function (s) { return AA.keys(s.stats.spRaised); } },
    { id: 'cupid', name: 'Amor der Meere', desc: 'Verschiedene Arten erfolgreich paaren.', goals: [3, 10, 25, 50], get: function (s) { return AA.keys(s.stats.spMated); } },
    { id: 'scrubber', name: 'Putzteufel', desc: 'Bürstenstriche im Becken.', goals: [50, 250, 1000, 5000], get: function (s) { return s.stats.cleans; } },
    { id: 'hunter', name: 'Schatzsucher', desc: 'Münzen bei der Schatzsuche einsammeln.', goals: [100, 500, 2500, 10000], get: function (s) { return s.stats.huntCoins; } },
    { id: 'bookworm', name: 'Sammelbuch', desc: 'Arten im Sammelbuch entdecken.', goals: [10, 25, 45, 62], get: function (s) { return AA.keys(s.book); } },
    { id: 'mutant', name: 'Farbenjäger', desc: 'Farbvarianten entdecken – sie schlüpfen nur aus Eiern.', goals: [1, 5, 20, 60], get: function (s) { return s.stats.variants || 0; } },
    { id: 'questor', name: 'Auftragsprofi', desc: 'Tagesaufträge erledigen und abholen.', goals: [10, 50, 200, 500], get: function (s) { return s.stats.quests || 0; } },
    { id: 'customer', name: 'Kundenliebling', desc: 'Kundenaufträge komplett beliefern.', goals: [3, 15, 60, 200], get: function (s) { return s.stats.ordersDone || 0; } },
    { id: 'topbreeder', name: 'Topzüchter', desc: 'Fische der Klasse S züchten.', goals: [1, 5, 25, 100], get: function (s) { return s.stats.sBred || 0; } }
  ];

  /* ---------- Tagesaufträge ----------
     Jeden Spieltag drei, aus dieser Liste gewürfelt – höchstens einer je Gruppe (grp) und nur solche, die heute zu schaffen sind (ok).
     stat = Zähler aus der Bilanz (state.stats), der mitläuft; n = wie oft, je Level-Stufe [bis Level 7, bis 19, ab 20];
     w = wie viel der Auftrag wert ist (Belohnung = Grundwert × w, Grundwert wächst mit dem Level); p = wie oft er drankommt. */
  function plural(n, one, many) { return n === 1 ? one : many.replace('{n}', n); }
  function tier(s) { return s.level < 8 ? 0 : (s.level < 20 ? 1 : 2); }      // Stufe der Ziele: Level 1–7, 8–19, ab 20
  function allFish(s) { let a = []; s.tanks.forEach(function (t) { a = a.concat(t.fish); }); return a; }
  function strokes(s) { let n = 0; s.tanks.forEach(function (t) { n += Math.ceil(Math.max(0, t.dirt - 0.004) / AA.BAL.cleanStep); }); return n; }
  function pairsReady(s) {                             // Arten, bei denen heute noch ein Ei drin ist: ♂ und ♀ erwachsen im selben Becken, deren Pause bald abläuft (Runde 11: je Fisch)
    const ok = {};
    s.tanks.forEach(function (t) {
      const m = {}, f = {};
      t.fish.forEach(function (x) { if (x.adult && (+x.mcd || 0) - s.clock < 43200) (x.sex === 'm' ? m : f)[x.sp] = 1; });
      for (const sp in m) if (f[sp]) ok[sp] = 1;
    });
    return Object.keys(ok).length;
  }
  AA.QUESTS = [
    { id: 'feed', grp: 'care', stat: 'shakes', n: function (s) { return AA.clamp(Math.round(allFish(s).length * 0.8), 2, [6, 10, 14][tier(s)]); }, w: 0.8, p: 3, ico: '🥫', txt: function (n) { return 'Streue ' + n + '-mal Futter ins Becken'; }, ok: function (s) { return allFish(s).length > 0; } },
    { id: 'bites', grp: 'care', stat: 'bites', n: function (s) { return AA.clamp(allFish(s).length * 3, 6, [12, 25, 40][tier(s)]); }, w: 0.9, p: 2, ico: '😋', txt: function (n) { return 'Lass deine Fische ' + n + ' Bissen fressen'; }, ok: function (s) { return allFish(s).length > 1; } },
    { id: 'clean', grp: 'care', stat: 'cleans', n: [3, 5, 7], w: 0.9, p: 3, ico: '🧽', txt: function (n) { return 'Putze die Scheiben: ' + n + ' Bürstenstriche'; }, ok: function (s) { return strokes(s) >= [3, 5, 7][tier(s)]; } },
    { id: 'sell', grp: 'trade', stat: 'soldAdult', n: [1, 1, 2], w: 1.0, p: 3, ico: '🏷️', txt: function (n) { return plural(n, 'Verkaufe einen erwachsenen Fisch', 'Verkaufe {n} erwachsene Fische'); },
      ok: function (s) { return allFish(s).filter(function (f) { return f.adult; }).length >= 3; } },
    { id: 'earn', grp: 'trade', stat: 'earned', n: function (s) { return Math.round((20 + 12 * s.level) / 10) * 10; }, w: 1.1, p: 2, ico: '🪙', txt: function (n) { return 'Verdiene ' + AA.fmt(n) + ' Münzen (Verkauf, Schatzkiste, Schatzsuche, Training)'; }, ok: function (s) { return allFish(s).length > 0; } },
    { id: 'buy', grp: 'trade', stat: 'bought', n: [1, 1, 2], w: 0.8, p: 2, ico: '🐟', txt: function (n) { return plural(n, 'Kaufe einen neuen Fisch', 'Kaufe {n} neue Fische'); },
      ok: function (s) { return s.tanks.some(function (t) { return t.fish.length + t.eggs.length < AA.SIZES[t.size].cap - 1; }); } },
    { id: 'deco', grp: 'trade', stat: 'decoBought', n: 1, w: 0.8, p: 1, ico: '🪸', txt: function () { return 'Kaufe ein Deko-Stück oder einen Krabbler'; }, ok: function (s) { return s.level >= 2; } },
    { id: 'mate', grp: 'breed', stat: 'eggs', n: [1, 1, 2], w: 1.4, p: 4, ico: '❤️', txt: function (n) { return plural(n, 'Züchte ein Ei', 'Züchte {n} Eier'); },
      ok: function (s) { return pairsReady(s) >= [1, 1, 2][tier(s)]; } },
    { id: 'raise', grp: 'breed', stat: 'raised', n: 1, w: 1.2, p: 2, ico: '🌱', txt: function () { return 'Zieh einen Fisch groß, bis er erwachsen ist'; },
      ok: function (s) { const left = 86400 - (s.clock % 86400); return allFish(s).some(function (f) { return !f.adult && !f.sick && AA.FISH_BY[f.sp].grow - f.age < left * 0.75; }); } },
    { id: 'hatch', grp: 'breed', stat: 'hatched', n: 1, w: 1.0, p: 2, ico: '🐣', txt: function () { return 'Lass ein Ei schlüpfen'; },
      ok: function (s) { const left = 86400 - (s.clock % 86400); return s.tanks.some(function (t) { return t.eggs.some(function (e) { return e.hatch < left * 0.75; }); }); } },
    { id: 'train', grp: 'fun', stat: 'trained', n: [1, 2, 2], w: 1.3, p: 3, ico: '🎓', txt: function (n) { return plural(n, 'Bring einem Fisch einen Trick bei', 'Bring deinen Fischen {n} Tricks bei'); },
      ok: function (s) { return allFish(s).filter(function (f) { return AA.trainStatus(f).ok; }).length >= 2; } },
    { id: 'tricks', grp: 'fun', stat: 'tricks', n: [3, 6, 10], w: 0.9, p: 2, ico: '👆', txt: function (n) { return 'Lass ' + n + ' Tricks vorführen (ans Glas klopfen)'; }, ok: function (s) { return allFish(s).some(function (f) { return f.tricks.length > 0; }); } },
    { id: 'hunt', grp: 'fun', stat: 'hunts', n: [1, 2, 2], w: 1.0, p: 2, ico: '🧭', txt: function (n) { return plural(n, 'Geh auf Schatzsuche', 'Geh {n}-mal auf Schatzsuche'); },
      ok: function (s) { return allFish(s).length > 0 && s.daily.hunts === 0; } },
    { id: 'chest', grp: 'free', stat: 'chests', n: 1, w: 0.5, p: 1, ico: '💰', txt: function () { return 'Leere die Schatzkiste in Aquarium 1'; }, ok: function (s) { return !s.daily.chest; } },
    { id: 'gift', grp: 'free', stat: 'gifts', n: 1, w: 0.4, p: 1, ico: '🎁', txt: function () { return 'Hol dein Tagesgeschenk ab'; }, ok: function (s) { return !s.daily.gift; } },
    { id: 'photo', grp: 'free', stat: 'photos', n: 1, w: 0.5, p: 1, ico: '📷', txt: function () { return 'Mach ein Foto von deinem Becken'; } },
    // nur am allerersten Tag
    { id: 'buy1', starter: true, grp: 'trade', stat: 'bought', n: 1, w: 0.8, ico: '🐟', txt: function () { return 'Kaufe deinen ersten Fisch'; } },
    { id: 'feed1', starter: true, grp: 'care', stat: 'shakes', n: 3, w: 0.8, ico: '🥫', txt: function (n) { return 'Streue ' + n + '-mal Futter ins Becken'; } }
  ];
  AA.QUEST_BY = {};
  AA.QUESTS.forEach(function (q) { AA.QUEST_BY[q.id] = q; });
  AA.QUEST_BONUS = { pearls: 1 };                     // alle drei Aufträge eines Tages abgeholt: eine Perle und ein Stempel
  /* Wochenkarte: so viele Stempel (Tage mit drei erledigten Aufträgen) in einer Spielwoche bringen … */
  AA.WEEK = [
    { at: 3, pearls: 3, name: '3 Perlen' },
    { at: 5, glitter: 1, name: 'Glitzer-Ei' },
    { at: 7, glitterBig: 1, pearls: 5, name: 'Großes Glitzer-Ei + 5 Perlen' }
  ];

  /* ---------- Perks – kommen später ---------- */
  AA.PERKS = [
    { ico: '⚡', name: 'Wachstums-Booster', desc: 'Fische werden für kurze Zeit schneller erwachsen.' },
    { ico: '🎁', name: 'Mehr Schatzsuche', desc: 'Zusätzliche Tauchgänge pro Tag.' },
    { ico: '🦦', name: 'Otter & Pinguine', desc: 'Größere Mitbewohner, die Tricks lernen.' }
  ];

  AA.NAMES = ['Blubb', 'Flossi', 'Nugget', 'Pixel', 'Krümel', 'Mango', 'Kiwi', 'Tango', 'Wasabi', 'Pommes', 'Käpt’n',
    'Otto', 'Luna', 'Mochi', 'Pesto', 'Rocky', 'Zeus', 'Kleo', 'Gustav', 'Fritzi', 'Brösel', 'Motte', 'Kalle', 'Emil',
    'Paula', 'Lotte', 'Bruno', 'Hugo', 'Ida', 'Mila', 'Coco', 'Pepper', 'Chili', 'Mojo', 'Ziggy', 'Yuki', 'Sunny',
    'Rio', 'Jazz', 'Turbo', 'Tiny', 'Boss', 'Gazda', 'Burek', 'Ajvar', 'Keks', 'Muffin', 'Socke', 'Glubschi', 'Schuppe',
    'Perle', 'Welle', 'Koralle', 'Tiffy', 'Olli', 'Pünktchen', 'Streifi', 'Blitz', 'Donner', 'Nacho', 'Taco', 'Fussel'];

  /* Spieltempo: Faktor auf ALLES, was Zeit braucht (Wachstum, Hunger, Schmutz, Eier, der „Tag“). 600× ist zum Durchrauschen gedacht:
     ein Spieltag dauert dann 2:24 Minuten und ein satter Fisch hat nach 48 Sekunden einen leeren Magen. */
  AA.SPEEDS = [{ v: 1, name: '1× Original' }, { v: 10, name: '10× Schnell' }, { v: 60, name: '60× Turbo' }, { v: 600, name: '600× Mega-Turbo' }];

  /* ---------- Runde 5: Zuchtbetrieb (Regeln in js/biz.js, Erklärung in docs/MECHANIK.md §6b, §8c, §8d) ----------
     Gene: jeder Fisch hat Farbe (c), Größe (s) und Vitalität (v), je 1–5. Summe = Güteklasse. */
  AA.GENE_NAMES = { c: ['Farbe', '🎨'], s: ['Größe', '📏'], v: ['Vitalität', '💪'] };
  AA.CLASSES = [                                       // ab Summe (3–15): Klasse, Preis-Faktor, Farbe der Marke
    { id: 'C', min: 3, mult: 1.0, col: '#9aa9b1' },
    { id: 'B', min: 7, mult: 1.25, col: '#35a7c2' },
    { id: 'A', min: 10, mult: 1.75, col: '#8b5cf6' },
    { id: 'S', min: 13, mult: 2.75, col: '#f2a900' }
  ];
  AA.GENE_SHOP = [20, 40, 32, 8, 0];                   // Gewichte für 1…5 bei Fischen aus dem Shop (meist Klasse C/B)
  AA.GENE_RULE = { down: 0.2, up: 0.22, jump: 0.05 };  // Vererbung je Wert: Mittel der Eltern, dann 20 % −1, 22 % +1, extra 5 % „Sprung“ +1
  AA.VAR_VALUE = { albino: 2, gold: 3, amethyst: 3, night: 5, rainbow: 10, cwild: 1.3, czeil: 1.8, cblack: 15, psun: 1.3, prubin: 1.8, pob: 2.2, pdragon: 4 };   // Preis-Faktor der Farbvarianten
  /* Markt: Tageskurs je Art (0,75–1,25), dazu zwei Trend-Arten (×1,35–1,6). Verkauf drückt den Preis (Sättigung); der Druck halbiert sich
     alle satHalf Spiel-Sekunden (Runde 15: 30 Min statt über Nacht, und je Verkauf halb so stark wie vorher). */
  AA.MARKET = { kMin: 0.75, kMax: 1.25, trends: 2, tMin: 1.35, tMax: 1.6, satStep: 0.06, satFloor: 0.4, satHalf: 1800 };
  /* Kunden: bis zu 3 Aufträge gleichzeitig; ein freier Platz füllt sich nach 20 Spielminuten (Runde 15, vorher 2 Std). need = Mindest-Ruf-Stufe. */
  AA.CUSTOMERS = [
    { id: 'shop', ico: '🏪', kind: 'Zoohandlung', names: ['Zoohandlung Fischer', 'Aqua-Laden Brandt', 'Zoo Paradies', 'Fischstube Kovač', 'Tierwelt Huber'], need: 0, n: [2, 3], cls: ['C', 'B'], pay: 1.3, days: 2, rep: 6 },
    { id: 'hotel', ico: '🏨', kind: 'Hotel', names: ['Hotel Adria', 'Grand Hotel Vodice', 'Villa Marina', 'Hotel Krumbacher Hof', 'Resort Kornati'], need: 1, n: [4, 6], cls: ['C', 'B'], pay: 1.5, days: 3, rep: 10 },
    { id: 'collector', ico: '🎩', kind: 'Sammler', names: ['Graf Koi', 'Frau Dr. Lindqvist', 'Baron von Schuppe', 'Señor Coral', 'Madame Perle'], need: 2, n: [1, 1], cls: ['A', 'S'], pay: 2.2, days: 4, rep: 15 }
  ];
  AA.ORDERS = { max: 3, refill: 20 * 60, failRep: 8, declineRep: 2, repBonus: 0.06 };
  AA.REP_LEVELS = [                                    // Ruf = Firmenstufe
    { at: 0, name: 'Hobbyzüchter', ico: '🐣' },
    { at: 25, name: 'Kleiner Zuchtbetrieb', ico: '🐟' },
    { at: 80, name: 'Fachbetrieb', ico: '🏪' },
    { at: 200, name: 'Großhandel', ico: '🏭' },
    { at: 500, name: 'Aquaristik-Imperium', ico: '👑' }
  ];

  /* ================= Runde 6: Zuchtbetrieb, Teil 2 ================= */
  /* Maßstab je Ausbaustufe (50 / 75 / 100 / 125 Gallonen): Fische, Deko und Eier werden um 1/√k größer gezeichnet – je größer das Becken,
     desto kleiner wirkt alles darin (siehe V.setZoom). Bis 13.11.2026 stand ein kleines Becken auf k verkleinert in einem Raum. */
  AA.ZOOM = [0.66, 0.78, 0.89, 1, 1.16, 1.32];      // Runde 20f: 150 Gal. × 0,93 · 175 Gal. × 0,87 (Meeresbecken 0,78)
  /* Meeresbecken: ein einziges, riesiges Meerwasser-Becken. Level 40 = kurz bevor der Adlerrochen (41) freigeschaltet wird.
     Meeresriesen (ocean: true an der Art) lassen sich nur dort kaufen oder hineinsetzen; wer schon in einem normalen Becken lebt, darf bleiben. */
  AA.OCEAN = { lvl: 40, price: 15000, cap: 50, name: 'Meeresbecken' };
  /* Runde 20f (Damian, 19.11.2026): bis zu 3 Meeresbecken und 2 Tiefsee-Becken – jedes weitere später und teurer */
  AA.OCEAN.max = 3; AA.OCEAN.lvls = [40, 44, 48]; AA.OCEAN.prices = [15000, 22000, 30000];
  /* Tiefsee-Becken (Runde 9): ein einziges, stockdunkles Meerwasser-Becken. Nur Tiefsee-Tiere (deep an der Art) dürfen hinein – dort leuchten sie selbst. */
  AA.DEEP = { lvl: 36, price: 9000, cap: 40, name: 'Tiefsee-Becken', wall: 'abyss', floor: 'lavasand' };
  AA.DEEP.max = 2; AA.DEEP.lvls = [36, 42]; AA.DEEP.prices = [9000, 15000];
  /* Zuchtstation: ein Becken bekommt eine Aufgabe (einmal kaufen, bleibt; pro Becken eine). */
  AA.ROLES = {
    brut: { name: 'Brutbecken', ico: '🥚', lvl: 8, price: 400, hatch: 2, info: 'Eier in diesem Becken schlüpfen doppelt so schnell.' },
    aufzucht: { name: 'Aufzuchtbecken', ico: '🍼', lvl: 10, price: 600, grow: 1.5, info: 'Jungfische in diesem Becken wachsen 50 % schneller.' }
  };
  /* Personal: Lohn pro Spieltag, fällig beim Tageswechsel (auch für Tage, die du weg warst). Reicht das Geld nicht, kündigt die Person. rep = Mindest-Firmenstufe. */
  AA.STAFF = {
    keeper: { name: 'Pfleger', ico: '🧑‍🔧', wage: 60, rep: 1, info: 'Füttert und putzt in allen Becken: Fische bleiben mindestens zu 75 % satt, Becken höchstens zu 25 % veralgt.', keep: 0.75, dirt: 0.25 },
    seller: { name: 'Verkäufer', ico: '🧑‍💼', wage: 45, rep: 1, info: 'Liefert Aufträge der Zoohandlungen selbst aus, sobald passende Fische da sind (nie benannte Lieblinge mit Tricks, nie Farbvarianten).' },
    master: { name: 'Zuchtmeister', ico: '🧑‍🔬', wage: 80, rep: 2, info: 'Verpaart in jedem Becken das beste Paar einer Art, sobald es wieder darf – auch während du weg bist (die Paarungsgebühr zahlst du, einen Platz lässt er frei).' }
  };
  /* Lieferverträge: jeden Spieltag neue Angebote, höchstens 2 laufen gleichzeitig. Eine „Woche“ = 7 Spieltage. Geliefert wird jederzeit innerhalb der Woche;
     was am Wochenende fehlt, kostet Strafe (penalty × Stückpreis je fehlendem Fisch) und Ruf. pay = Aufschlag auf den Listenpreis (fest, unabhängig vom Markt). */
  AA.CONTRACTS = { offers: 3, max: 2, week: 7, n: [3, 6], weeks: [2, 4], pay: [1.25, 1.45], penalty: 0.6, failRep: 6, weekRep: 3, doneRep: 10, lvl: 8 };
  /* Kaviar: erwachsene Stör-Weibchen. base = Münzen je Ernte bei Klasse C (× Klassen-Faktor), cd = Pause in Spieltagen. */
  AA.CAVIAR = { sturgeon: { base: 150, name: 'Stör-Kaviar' }, beluga: { base: 1400, name: 'Beluga-Kaviar' }, bester: { base: 900, name: 'Bester-Kaviar' } };      // Runde 15: ernten so oft wie die Paarungspause des Weibchens (vorher alle 2–3 Tage)
  /* Lachs: Anteil der Jugend, die er im Meerwasser verbracht haben muss, um als Meerlachs erwachsen zu werden; Wert-Faktor; Eier je Laich; Laich-Pause als Vielfaches der normalen Pause. */
  AA.SALMON = { sea: 0.6, mult: 1.6, size: 1.1, eggs: 3, cd: 3 };

  /* ================= Runde 7: Biotope, Räuber ================= */
  /* Biotop: Hintergrund, Boden, Deko und Bewohner passen zusammen. Vier Punkte sind möglich (jeweils einer):
       Kulisse aus `walls` · Boden aus `floors` · mindestens BIO.deco verschiedene Deko-Stücke aus `deco` · mindestens BIO.fish Fische und davon BIO.share aus `fish`
     Ab 2 Punkten gibt es die Stufe mit Bonus (AA.BIO.tiers): grow = Jungfische wachsen schneller, luck = Chance auf Farbvarianten bei Eiern aus diesem Becken,
     value = Verkaufswert der Biotop-Arten, die in diesem Becken leben. Das Wasser muss natürlich stimmen. */
  AA.BIO = { deco: 3, fish: 4, share: 0.7, tiers: [null, null, { name: 'Bronze', ico: '🥉', grow: 1.05, luck: 1.1, value: 1.05 }, { name: 'Silber', ico: '🥈', grow: 1.1, luck: 1.25, value: 1.1 }, { name: 'Gold', ico: '🥇', grow: 1.2, luck: 1.5, value: 1.15 }] };
  AA.BIOTOPES = [
    { id: 'reef', name: 'Korallenriff', ico: '🪸', water: 'salt', walls: ['reef', 'atoll', 'redsea', 'grotto', 'nightreef', 'reef2', 'atlantis'], floors: ['sand', 'whitegravel', 'finesand', 'coralsand', 'shells', 'pink', 'coralrubble', 'nacre'],
      deco: ['anemone', 'braincoral', 'tubesponge', 'mushrooms', 'cupcoral', 'coral_purple', 'seafan', 'coral_plate', 'coral_lilac', 'staghorn', 'leathercoral', 'flowerpot', 'birdnest', 'seawhip', 'anemone_pink', 'anemone_carpet', 'torchcoral', 'bubblecoral', 'pillarcoral', 'zoanthus', 'seapen', 'liverock'],
      fish: ['auriga', 'clown', 'flameback', 'lemonpeel', 'gramma', 'chromis', 'blenny', 'yellowtang', 'damsel', 'mandarin', 'firefish', 'hawkfish', 'banggai', 'copperband', 'foxface', 'bluetang', 'tuskfish', 'parrotfish', 'butterfly', 'wrasse', 'boxfish', 'emperor', 'trigger', 'moorish', 'picasso', 'lion', 'seahorse', 'powderblue', 'eel', 'flameangel', 'dorade', 'turtle',
        'cleanerwrasse', 'neongoby', 'stonefish', 'sepia', 'squid', 'bluesquid', 'bambooshark', 'epaulette', 'hornshark', 'napoleon', 'goliath', 'barracuda', 'manta'] },
    { id: 'amazon', name: 'Amazonas', ico: '🌴', water: 'fresh', walls: ['amazon', 'blackwater', 'floodforest', 'jungle'], floors: ['amazonsoil', 'finesand', 'aquasoil', 'mud', 'redclay', 'riosand'],
      deco: ['driftwood', 'log', 'rootarch', 'stump', 'woodslice', 'amazonsword', 'ludwigia', 'cabomba', 'vallisneria', 'javafern', 'anubias', 'spiderwood', 'bogwood', 'mangroveroots', 'talawa', 'rootcave', 'twigbush', 'forkbranch', 'longbranch', 'deadtree'],
      fish: ['neon', 'skalar', 'discus', 'ram', 'cory', 'ancistrus', 'piranha', 'arowana', 'arapaima', 'redtail', 'eleel', 'guppy', 'platy', 'molly', 'swordtail', 'pantodon',
        'oto', 'whiptail', 'sturisoma', 'zebrapleco', 'goldnugget', 'gibbiceps', 'greenphantom', 'bluephantom', 'royalpleco', 'scarletpleco', 'reticulatus', 'leopoldi'] },
    { id: 'japan', name: 'Japan-Teich', ico: '⛩️', water: 'fresh', walls: ['japanpond', 'lilypond', 'bamboo', 'iwagumi'], floors: ['zen', 'riverstone', 'whitegravel', 'mossfloor', 'split_whitemoss', 'slatefloor'],
      deco: ['lotus', 'bamboo', 'bonsai', 'mossball', 'steprock', 'slate', 'tablerock', 'basalt', 'plateau', 'seiryu', 'dragonstone', 'pebbles3', 'cairn', 'rocktooth', 'spire', 'stepstone', 'pillarstump'],
      fish: ['koi', 'goldfish', 'carp', 'danio', 'betta', 'tigerbarb', 'clownloach', 'snakehead', 'axolotl', 'grasscarp'] },
    { id: 'river', name: 'Heimischer Fluss', ico: '🏞️', water: 'fresh', walls: ['river', 'lowriver', 'reeds', 'alpinelake', 'waterfall', 'castlelake'], floors: ['riverstone', 'mud', 'finesand', 'split_stonesand', 'slatefloor', 'redgravel'],
      deco: ['log', 'stump', 'driftwood', 'rootarch', 'vallisneria', 'cabomba', 'rock_grey', 'rocks_brown', 'jetty', 'steprock', 'basalt', 'roundboulder', 'pebblepile', 'dome', 'forkbranch', 'longbranch', 'twigbush'],
      fish: ['carp', 'tench', 'trout', 'pike', 'salmon', 'wels', 'sturgeon', 'beluga', 'aal', 'grasscarp'] },
    { id: 'deep', name: 'Tiefsee', ico: '🌌', water: 'salt', walls: ['abyss', 'nightreef', 'deep', 'ruins', 'shipwreck', 'vents', 'volcano', 'crystalcave'], floors: ['lavasand', 'volcanic', 'black', 'slatefloor', 'crystal', 'deepsea'],
      deco: ['lavarock', 'volcano', 'crystals', 'wreck', 'anchor', 'columns', 'helmet', 'tubesponge', 'basalt', 'lavatwin', 'geode', 'turtlerock', 'rockgate', 'ufo'],
      fish: ['angler', 'monkfish', 'squid', 'jellyfish', 'catshark', 'shark', 'ray', 'swordfish', 'eel',
        'lanternfish', 'hatchetfish', 'blobfish', 'viperfish', 'gulper', 'dumbo', 'barreleye', 'fangtooth', 'dragonfish', 'chimaera', 'frilledshark', 'oarfish', 'coelacanth',
        'bluesquid', 'johndory', 'tuna', 'hammerhead', 'mola', 'thresher', 'tigershark', 'greatwhite', 'whaleshark', 'sawfish'] },
    /* Runde 12: Adria – Krka-Wasserfälle (Süßwasser) und Felsküste mit Seegraswiese (Meer) */
    { id: 'krka', name: 'Krka-Fluss', ico: '💦', water: 'fresh', walls: ['krka', 'waterfall', 'river', 'alpinelake'], floors: ['riverstone', 'whitegravel', 'finesand', 'split_stonesand', 'slatefloor'],
      deco: ['rotala', 'ambulia', 'hygrophila', 'cryptobal', 'vallisneria', 'cabomba', 'mossball', 'javafern', 'rock_grey', 'roundboulder', 'pebblepile', 'steprock', 'dome', 'limeslab', 'log', 'driftwood'],
      fish: ['trout', 'aal', 'tench', 'carp', 'salmon', 'pike', 'frog', 'otter'] },
    { id: 'adria', name: 'Adria-Küste', ico: '🏖️', water: 'salt', walls: ['adria', 'lagoon'], floors: ['finesand', 'whitegravel', 'shells', 'coralsand'],
      deco: ['posidonia', 'pinna', 'amphora', 'caulerpa', 'halimeda', 'ulva', 'rock_grey', 'roundboulder', 'pebblepile', 'limeslab', 'anchor', 'columns', 'seaweed_lime', 'redkelp'],
      fish: ['scorpionfish', 'weever', 'bream', 'medmoray', 'garfish', 'dorade', 'seahorse', 'sepia', 'squid', 'jellyfish', 'seal'] },
    /* Runde 20e: die beiden großen afrikanischen Seen */
    { id: 'malawi', name: 'Malawisee', ico: '🌅', water: 'fresh', walls: ['malawi'], floors: ['finesand', 'sand', 'whitegravel', 'riverstone'],
      deco: ['limestone', 'rock_grey', 'roundboulder', 'pebblepile', 'cave', 'crevice', 'arch', 'miniarch', 'dome', 'stepstone', 'tablerock', 'vallisneria'],
      fish: ['yellowlab', 'demasoni', 'peacock', 'venustus', 'livingstoni'] },
    { id: 'tanganjika', name: 'Tanganjikasee', ico: '🐚', water: 'fresh', walls: ['tanganyika'], floors: ['tanganyika', 'finesand', 'shells', 'sand'],
      deco: ['shellpile', 'limestone', 'rock_grey', 'crevice', 'cave', 'slate', 'tiltslabs', 'limeslab', 'claycave', 'jagged', 'vallisneria'],
      fish: ['lemoncichlid', 'julie', 'burundi', 'tropheus', 'calvus', 'cuckoocat', 'frontosa'] }
  ];
  /* Runde 20b: die neuen Arten in ihren Biotopen (zählen damit auch in den Regionen der Themen-Sets) */
  /* Runde 20f: neue Kulissen, Böden und Deko in passenden Biotopen */
  [['reef', ['maldives', 'caribbean', 'sunsetreef', 'bluehole'], ['pinksand']], ['krka', ['plitvice'], []], ['river', ['autumnpond', 'plitvice'], []],
   ['adria', ['sunsetreef'], []]].forEach(function (x) {
    const b = AA.BIOTOPES.find(function (q) { return q.id === x[0]; }); if (!b) return;
    x[1].forEach(function (id) { if (b.walls.indexOf(id) < 0) b.walls.push(id); }); x[2].forEach(function (id) { if (b.floors.indexOf(id) < 0) b.floors.push(id); });
  });
  [['japan', ['mosstree']], ['amazon', ['coconut', 'claycave', 'mosstree']], ['river', ['claycave']], ['krka', ['mosstree']]].forEach(function (x) {
    const b = AA.BIOTOPES.find(function (q) { return q.id === x[0]; }); if (b) x[1].forEach(function (id) { if (b.deco.indexOf(id) < 0) b.deco.push(id); });
  });
  [['reef', ['flamegoby', 'pyjama', 'rabbitfish', 'cowfish', 'titan', 'yellowangler', 'snake_laticauda', 'snake_belcher', 'snake_dubois', 'snake_platurus']], ['adria', ['moonjelly', 'compass', 'gurnard', 'sardine', 'seabass', 'redmullet', 'redgurnard']], ['amazon', ['ghostknife']], ['river', ['zander']]].forEach(function (x) {
    const b = AA.BIOTOPES.find(function (q) { return q.id === x[0]; }); x[1].forEach(function (id) { if (b.fish.indexOf(id) < 0) b.fish.push(id); });
  });
  /* Räuber (pred: true an der Art – unten gesetzt): Wird einer richtig hungrig (unter `hungry`), jagt er einen Fisch, der höchstens `ratio` so lang ist wie er selbst
     (Jungfische zählen mit ihrer aktuellen Größe; die eigene Art frisst er nie). Die Jagd dauert `chase` echte Sekunden – wer in der Zeit füttert, rettet die Beute.
     Ein gefressener Fisch macht `fill` satt. Unter `warn` gibt es vorher eine Warnung. Mit Futterautomat oder Pfleger werden Räuber nie so hungrig.
     Während du weg bist, frisst jeder Räuber höchstens `away` Fische. Abschalten: Einstellungen → „Räuber jagen“. */
  AA.PRED = { hungry: 0.3, warn: 0.45, ratio: 0.55, fill: 0.6, chase: 7, away: 1 };
  ['pike', 'wels', 'shark', 'catshark', 'piranha', 'snakehead', 'eel', 'monkfish', 'swordfish', 'arapaima', 'lion', 'angler',
    'barracuda', 'hammerhead', 'goliath', 'thresher', 'tigershark', 'greatwhite', 'viperfish', 'fangtooth', 'dragonfish', 'frilledshark'].forEach(function (id) { AA.FISH_BY[id].pred = true; });
  /* Runde 9: diese alten Bekannten dürfen zusätzlich ins Tiefsee-Becken (deep: 2) – mit ihrer Leuchtfarbe */
  [['angler', '#9ae8ff'], ['monkfish', '#ffd27a'], ['squid', '#d6a8ff'], ['jellyfish', '#ff9ee0']].forEach(function (x) { AA.FISH_BY[x[0]].deep = 2; AA.FISH_BY[x[0]].glow = x[1]; });
  AA.FISH_BY.galaxysquid.deep = 2;
  AA.FISH_BY.ancistrus.suck = true;                  // der Antennenwels aus Runde 3 saugt sich jetzt auch fest

  /* ================= Runde 8: Verhalten, Schwärme, Sammelbuch-Sets, Kreuzen, Optik ================= */
  /* Schwarmfische: ab `min` Tieren derselben Art in einem Becken schwimmen sie sichtbar im Schwarm (+grow Wachstum),
     unter `lonely` sind sie unglücklich (schauen traurig, wachsen langsamer). */
  AA.SCHOOL = { min: 6, lonely: 3, grow: 1.15, lonelyGrow: 0.85, species: ['neon', 'danio', 'chromis', 'tigerbarb', 'cory', 'clownloach', 'piranha', 'banggai', 'lanternfish', 'congotetra'] };      // Runde 20e: + Kongosalmler
  AA.SCHOOL.species.forEach(function (id) { AA.FISH_BY[id].school = true; });
  /* Kreuzen: Chance auf ein Ei, Kosten-Faktor (auf die Paarungsgebühren beider Eltern). Pause der Eltern: wie beim Hybriden (sein f.pause, Runde 15) */
  AA.CROSS = { chance: 1, cost: 1.5 };                 // Runde 11: jede Kreuzung bringt ein Ei; Pause je Fisch
  /* Sammelbuch-Sets: alle Varianten einer Art = +10 % Wert für diese Art. Titel für komplette Gruppen (einmal Perlen). */
  AA.SETBONUS = 1.1;
  AA.TITLES = [
    { id: 'reef', name: 'Riff-Kenner', ico: '🪸', pearls: 15, info: 'Alle Riff-Fische im Sammelbuch', list: function () { return AA.BIOTOPES[0].fish; } },
    { id: 'amazon', name: 'Amazonas-Forscher', ico: '🌴', pearls: 15, info: 'Alle Amazonas-Fische', list: function () { return AA.BIOTOPE_BY.amazon.fish; } },
    { id: 'japan', name: 'Teich-Meister', ico: '⛩️', pearls: 10, info: 'Alle Fische des Japan-Teichs', list: function () { return AA.BIOTOPE_BY.japan.fish; } },
    { id: 'river', name: 'Fluss-Ranger', ico: '🏞️', pearls: 10, info: 'Alle Fische des Heimischen Flusses', list: function () { return AA.BIOTOPE_BY.river.fish; } },
    { id: 'deep', name: 'Tiefsee-Entdecker', ico: '🌌', pearls: 15, info: 'Alle Tiefsee-Tiere', list: function () { return AA.BIOTOPE_BY.deep.fish; } },
    { id: 'krka', name: 'Krka-Ranger', ico: '💦', pearls: 10, info: 'Alle Tiere des Krka-Flusses', list: function () { return AA.BIOTOPE_BY.krka.fish; } },
    { id: 'adria', name: 'Adria-Taucher', ico: '🏖️', pearls: 12, info: 'Alle Tiere der Adria-Küste', list: function () { return AA.BIOTOPE_BY.adria.fish; } },
    { id: 'special', name: 'Tierfreund', ico: '⭐', pearls: 20, info: 'Alle besonderen Tiere (Perlen-Tiere, ohne Saison-Tiere)', list: function () { return AA.FISH.filter(function (f) { return f.special && !f.season; }).map(function (f) { return f.id; }); } },      // Runde 19: Saison-Tiere (Rentier, Eisbär) zählen nicht
    { id: 'schools', name: 'Schwarm-Dirigent', ico: '🐟', pearls: 10, info: 'Alle Schwarmfische', list: function () { return AA.SCHOOL.species; } },
    { id: 'hybrid', name: 'Hybrid-Pionier', ico: '🧬', pearls: 30, info: 'Alle Hybride gezüchtet', list: function () { return AA.HYBRIDS.map(function (h) { return h.id; }); } },
    { id: 'fresh', name: 'Süßwasser-Profi', ico: '🌿', pearls: 25, info: 'Alle Süßwasser-Arten (ohne Hybride und Saison-Tiere)', list: function () { return AA.FISH.filter(function (f) { return !f.hybrid && !f.season && f.water === 'fresh'; }).map(function (f) { return f.id; }); } },
    { id: 'salt', name: 'Meeres-Profi', ico: '🌊', pearls: 25, info: 'Alle Meerwasser-Arten (ohne Hybride und Saison-Tiere)', list: function () { return AA.FISH.filter(function (f) { return !f.hybrid && !f.season && (f.water || 'salt') === 'salt'; }).map(function (f) { return f.id; }); } },
    { id: 'colors', name: 'Farb-Fanatiker', ico: '🌈', pearls: 30, info: '10 Arten mit allen Farbvarianten', sets: 10 },
    { id: 'all', name: 'Fisch-Enzyklopädie', ico: '📚', pearls: 60, info: 'Jede Art im Sammelbuch (ohne Saison-Tiere)', list: function () { return AA.FISH.filter(function (f) { return !f.season; }).map(function (f) { return f.id; }); } }
  ];
  AA.BIOTOPE_BY = {}; AA.BIOTOPES.forEach(function (b) { AA.BIOTOPE_BY[b.id] = b; });

  /* ---------- Runde 19: Themen-Sets (Regeln js/themes.js, Oberfläche js/themesui.js, Effekte js/themefx.js; docs/MECHANIK.md § 11h) ----------
     kind: region = Kapitel eines Biotops (Arten aus AA.BIOTOPES nach Level-Band lv), coll = Sammlung quer durch alles, crawl = Krabbler-Album,
     master = die großen Titel (AA.TITLES, eine Stufe), family = mit den Freunden zusammen (eine Stufe).
     Stufen: Entdeckt (alles im Sammelbuch bzw. einmal besessen) → Titel + Perlen · Gezüchtet (selbst ausgebrütet; ab 12 Tieren reichen drei Viertel) → Becken-Effekt fx ·
     Ausgestellt (alles gleichzeitig erwachsen in deinen Becken) → Gold-Kulisse (Regionen, Goldfassung von wall) bzw. Pokal, Goldrahmen, Abzeichen.
     title: eigener Titel (Name) · titleId: vorhandener Titel aus AA.TITLES (eine Kapitel-Regionen und Meister). */
  AA.THEMES = [
    { id: 'riff1', kind: 'region', bio: 'reef', lv: [0, 12], name: 'Riff-Kinderstube', ico: '🐠', title: 'Riff-Küken', fx: 'sunspots', wall: 'reef' },
    { id: 'riff2', kind: 'region', bio: 'reef', lv: [13, 30], name: 'Buntes Riff', ico: '🪸', title: 'Farbenprofi', fx: 'colorbubbles', wall: 'reef2' },
    { id: 'riff3', kind: 'region', bio: 'reef', lv: [31, 99], name: 'Großes Riff', ico: '🐢', title: 'Riff-Kapitän', fx: 'manta', wall: 'atoll' },
    { id: 'amaz1', kind: 'region', bio: 'amazon', lv: [0, 20], name: 'Kleiner Amazonas', ico: '🌿', title: 'Dschungelkind', fx: 'rain', wall: 'amazon' },
    { id: 'amaz2', kind: 'region', bio: 'amazon', lv: [21, 99], name: 'Großer Amazonas', ico: '🌳', title: 'Dschungel-Profi', fx: 'leaves', wall: 'floodforest' },
    { id: 'japan', kind: 'region', bio: 'japan', lv: [0, 99], name: 'Japan-Teich', ico: '⛩️', titleId: 'japan', fx: 'blossoms', wall: 'japanpond' },
    { id: 'river', kind: 'region', bio: 'river', lv: [0, 99], name: 'Heimischer Fluss', ico: '🏞️', titleId: 'river', fx: 'autumn', wall: 'lowriver' },
    { id: 'krka', kind: 'region', bio: 'krka', lv: [0, 99], name: 'Krka-Fluss', ico: '💦', titleId: 'krka', fx: 'spray', wall: 'krka' },
    { id: 'adria', kind: 'region', bio: 'adria', lv: [0, 99], name: 'Adria-Küste', ico: '🏖️', titleId: 'adria', fx: 'wavelight', wall: 'adria' },
    { id: 'deep1', kind: 'region', bio: 'deep', lv: [0, 43], name: 'Dämmerzone', ico: '🔦', title: 'Dämmerungs-Taucher', fx: 'plankton', wall: 'nightreef' },
    { id: 'deep2', kind: 'region', bio: 'deep', lv: [44, 99], name: 'Abgrund', ico: '🌌', title: 'Tiefsee-Legende', fx: 'marinesnow', wall: 'abyss' },
    { id: 'live', kind: 'coll', name: 'Lebendgebärende', ico: '🐣', title: 'Nachwuchs-Profi', fx: 'hearts', list: ['guppy', 'platy', 'molly', 'swordtail', 'swordplaty'] },
    { id: 'cats', kind: 'coll', name: 'Welse und Sauger', ico: '🐟', title: 'Wels-Flüsterer', fx: 'sandpuffs',
      list: ['oto', 'whiptail', 'cory', 'ancistrus', 'sturisoma', 'zebrapleco', 'upsidedown', 'goldnugget', 'gibbiceps', 'greenphantom', 'bluephantom', 'wels', 'redtail', 'royalpleco', 'scarletpleco'] },
    { id: 'spiky', kind: 'coll', name: 'Lieber nicht anfassen', ico: '⚡', title: 'Stachel-Profi', fx: 'sparks',      // Runde 20b: + Gift-Tiere und Gift-Krabbler
      list: ['weever', 'scorpionfish', 'stonefish', 'piranha', 'lion', 'eleel', 'jellyfish', 'rabbitfish', 'compass', 'titan', 'boxjelly', 'irukandji', 'manowar', 'bluedragon', 'lionsmane', 'cone', 'mantis', 'bluering'] },
    { id: 'paris', kind: 'coll', name: 'Paris', ico: '🗼', title: 'Bon Vivant', fx: 'champagne',      // Runde 20d (Pokal: der goldene Eiffelturm)
      list: ['sardine', 'seabass', 'redmullet', 'dorade', 'redgurnard', 'zander', 'johndory', 'monkfish', 'escargot', 'sole', 'turbot'] },
    { id: 'snakes', kind: 'coll', name: 'Seeschlangen', ico: '🐍', title: 'Schlangenbeschwörer', list: ['snake_laticauda', 'snake_belcher', 'snake_dubois', 'snake_platurus'] },      // Runde 20c
    { id: 'malawi', kind: 'region', bio: 'malawi', lv: [0, 99], name: 'Malawisee', ico: '🌅', title: 'Sternensee-Fischer', fx: 'lakestars', wall: 'malawi' },      // Runde 20e
    { id: 'tanganjika', kind: 'region', bio: 'tanganjika', lv: [0, 99], name: 'Tanganjikasee', ico: '🐚', title: 'Schneckenhaus-Kenner', fx: 'shellglint', wall: 'tanganyika' },
    { id: 'africa', kind: 'coll', name: 'Afrika-Legenden', ico: '🌍', title: 'Afrika-Legende', fx: 'savanna',
      list: ['kribensis', 'yellowlab', 'congotetra', 'demasoni', 'lemoncichlid', 'peacock', 'julie', 'burundi', 'tropheus', 'venustus', 'livingstoni', 'calvus', 'cuckoocat', 'frontosa',
        'sunkaiser', 'zebraprincess', 'bloodparrot', 'flowerhorn'] },
    { id: 'jellies', kind: 'coll', name: 'Quallen-Ballett', ico: '🎐', title: 'Quallen-Dirigent', fx: 'jellyglow', list: ['moonjelly', 'compass', 'jellyfish', 'boxjelly', 'irukandji', 'combjelly', 'manowar', 'lionsmane'] },
    { id: 'fossil', kind: 'coll', name: 'Lebende Fossilien', ico: '🦴', title: 'Zeitreisender', fx: 'ammonite', list: ['sturgeon', 'arowana', 'beluga', 'arapaima', 'chimaera', 'frilledshark', 'coelacanth', 'horseshoe'] },
    { id: 'sharks', kind: 'coll', name: 'Haie und Rochen', ico: '🦈', title: 'Hai-Flüsterer', fx: 'shark',
      list: ['reticulatus', 'bambooshark', 'epaulette', 'leopoldi', 'ray', 'hornshark', 'catshark', 'sawfish', 'shark', 'hammerhead', 'thresher', 'tigershark', 'manta', 'greatwhite', 'frilledshark', 'whaleshark'] },
    { id: 'squids', kind: 'coll', name: 'Tintenfische und Kraken', ico: '🦑', title: 'Tinten-Künstler', fx: 'ink', list: ['sepia', 'squid', 'prachtsepia', 'bluesquid', 'galaxysquid', 'saphirsepia', 'dumbo'] },
    { id: 'glow', kind: 'coll', name: 'Leuchtende Tiere', ico: '✨', title: 'Lichtsammler', fx: 'trails',
      list: ['squid', 'jellyfish', 'lanternfish', 'monkfish', 'bluesquid', 'hatchetfish', 'galaxysquid', 'angler', 'viperfish', 'gulper', 'dumbo', 'barreleye', 'dragonfish', 'chimaera', 'oarfish', 'coelacanth'] },
    { id: 'giants', kind: 'coll', name: 'Riesen der Meere', ico: '🐋', title: 'Riesen-Hüter', fx: 'whale',
      list: ['beluga', 'tuna', 'napoleon', 'goliath', 'swordfish', 'arapaima', 'mola', 'manta', 'turtle', 'greatwhite', 'whaleshark', 'oarfish'] },
    { id: 'menu', kind: 'coll', name: 'Die Speisekarte', ico: '🍽️', title: 'Feinschmecker – nur gucken!', list: ['carp', 'trout', 'bream', 'dorade', 'salmon', 'aal', 'johndory', 'monkfish', 'tuna', 'swordfish'] },
    { id: 'winter', kind: 'coll', season: 'xmas', name: 'Winterwunderland', ico: '❄️', title: 'Schneeflöckchen', fx: 'snow', list: ['snowman', 'reindeer', 'xmashorse', 'halofish', 'polarbear', 'candyeel'] },
    { id: 'snails', kind: 'crawl', name: 'Schnecken und Muscheln', ico: '🐌', title: 'Schneckentempo', list: ['seaslug', 'ramshorn', 'turbosnail', 'nerite', 'applesnail', 'spanishdancer', 'giantclam'] },
    { id: 'stars', kind: 'crawl', name: 'Seesterne, Seeigel und Seegurken', ico: '⭐', title: 'Sternensammler', list: ['starfish', 'urchin', 'starfish_red', 'starfish_blue', 'brittlestar', 'urchin_diadem', 'urchin_pink', 'starfish_orange', 'urchin_pencil', 'seacucumber'] },
    { id: 'shrimps', kind: 'crawl', name: 'Garnelen', ico: '🦐', title: 'Garnelen-Guru', list: ['cherryshrimp', 'amano', 'cleanershrimp', 'shrimp', 'bandedshrimp', 'harlequin', 'fireshrimp', 'tigershrimp'] },
    { id: 'crabs', kind: 'crawl', name: 'Krebse und Krabben', ico: '🦀', title: 'Scherenprofi', list: ['crab', 'fiddler', 'panthercrab', 'hermit', 'crayfish_blue', 'pompomcrab', 'hummer', 'lobster', 'decorator', 'spidercrab'] },
    { id: 'flats', kind: 'crawl', name: 'Platt am Boden', ico: '🥞', title: 'Bodenständig', list: ['scholle', 'sole', 'turbot', 'torpedo'] },
    { id: 'deepcrawl', kind: 'crawl', name: 'Tiefsee-Krabbler', ico: '🦞', title: 'Yeti-Freund', list: ['isopod', 'seapig', 'yeticrab'] },
    { id: 'm_special', kind: 'master', titleId: 'special' }, { id: 'm_schools', kind: 'master', titleId: 'schools' }, { id: 'm_hybrid', kind: 'master', titleId: 'hybrid' },
    { id: 'm_fresh', kind: 'master', titleId: 'fresh' }, { id: 'm_salt', kind: 'master', titleId: 'salt' }, { id: 'm_colors', kind: 'master', titleId: 'colors' }, { id: 'm_all', kind: 'master', titleId: 'all' },
    { id: 'fam_book', kind: 'family', name: 'Familien-Enzyklopädie', ico: '🛡️', pearls: 20, info: 'Jede Art (ohne Saison-Tiere) haben mindestens zwei von euch entdeckt – ein einzelner Profi-Stand reicht nicht.' },
    { id: 'fam_gifts', kind: 'family', name: 'Geschenkt!', ico: '🎁', title: 'Gute Seele', need: 10, info: '10 Geschenke an andere verschickt.' },
    { id: 'fam_helps', kind: 'family', name: 'Gute Nachbarn', ico: '🤝', title: 'Guter Nachbar', need: 20, info: 'Bei anderen 20-mal gefüttert oder geputzt.' }
  ];
  AA.THEME_FX = { sunspots: 'Sonnenkringel', colorbubbles: 'Bunte Blasen', manta: 'Manta-Schatten', rain: 'Regen', leaves: 'Treibende Blätter', blossoms: 'Kirschblüten',
    autumn: 'Herbstlaub', spray: 'Gischt', wavelight: 'Wellenlicht', plankton: 'Leuchtplankton', marinesnow: 'Meeresschnee', hearts: 'Herzchen-Blasen', sandpuffs: 'Sandwölkchen',
    sparks: 'Funken', ammonite: 'Ammoniten-Schatten', shark: 'Hai-Schatten', ink: 'Tintenwölkchen', trails: 'Leuchtspuren', whale: 'Walhai in der Ferne', snow: 'Schneeflocken', jellyglow: 'Leuchtende Quallen', champagne: 'Champagner-Perlen',
    lakestars: 'Sternensee-Lichter', shellglint: 'Perlmutt-Glitzern', savanna: 'Savannen-Sonne' };      // Runde 20e
  AA.THEME_BY = {};
  AA.THEMES.forEach(function (T) {
    AA.THEME_BY[T.id] = T;
    const ti = T.titleId && AA.TITLES.find(function (x) { return x.id === T.titleId; });
    if (T.kind === 'master' && ti) { T.name = ti.name; T.ico = ti.ico; T.info = ti.info; }
  });
  /* Gold-Kulissen (Stufe „Ausgestellt“ der Regionen): Goldfassung einer vorhandenen Kulisse – js/tankview.js färbt sie beim Malen (wall.gold) */
  AA.THEMES.forEach(function (T) {
    if (T.kind !== 'region') return;
    const b = AA.WALL_BY[T.wall];
    const w = { id: 'gold_' + T.id, name: 'Gold: ' + T.name, pearls: 0, theme: T.id, gold: T.wall, img: b.img, home: b.home, cols: b.cols, far: b.far, ray: '255,236,170' };
    AA.WALLS.push(w); AA.WALL_BY[w.id] = w;
    AA.BIOTOPES.forEach(function (bi) { if (bi.walls.indexOf(T.wall) >= 0) bi.walls.push(w.id); });      // zählt im Biotop wie das Vorbild
  });
  /* Pokale (Stufe „Ausgestellt“ der Sammlungen und Krabbler-Alben): ein Bild für alle (as), das Spiel malt das Set-Zeichen darauf */
  AA.THEMES.forEach(function (T) {
    if (T.kind !== 'coll' && T.kind !== 'crawl') return;
    const d = { id: 'trophy_' + T.id, name: 'Pokal: ' + T.name, cat: 'prop', lvl: 1, price: 0, w: 88, sink: 4, trophy: 6, as: 'trophy_gold', theme: T.id,
      info: 'Für „' + T.name + '“: alle Tiere gleichzeitig in deinen Becken. Gibt es nicht zu kaufen – nur zu verdienen.' };
    AA.DECO.push(d); AA.DECO_BY[d.id] = d;
  });
  (function () {                                     // Runde 20d: Paris bekommt keinen Kelch, sondern einen goldenen Eiffelturm (eigenes Bild, ohne Set-Zeichen)
    const d = AA.DECO_BY.trophy_paris; if (!d) return;
    delete d.as; d.name = 'Goldener Eiffelturm'; d.w = 96; d.sink = 6; d.noMark = true; d.sparkle = true; d.glow = [0.5, 0.42, '#ffe08a', 0.9];
    d.info = 'Für „Paris“: alle Tiere gleichzeitig in deinen Becken. Pures Gold – und nachts glitzert er wie der echte.';
  })();
  /* Optik: Textur-Maßstab je Beckengröße (Kies und Kulisse werden mit wachsendem Becken feiner, damit sie zur Größe passen),
     Tiefe der Seitenscheiben in Pixeln. Das Meeresbecken ist extra weit: alles darin ist kleiner gezeichnet (OCEAN_SPR). */
  AA.TEX = [1.08, 0.93, 0.82, 0.72, 0.65, 0.58]; AA.TEX_OCEAN = 0.5; AA.OCEAN_SPR = 0.78;
  AA.DEPTH = [26, 38, 52, 66, 78, 90]; AA.DEPTH_OCEAN = 104;
  AA.OCEAN.cap = 70;

  /* ================= Runde 9 ================= */
  /* Verstecken (Sekunden echte Zeit): normale Fische verschwinden nur ab und zu kurz in einem Versteck – `every` = Abstand, `stay` = Dauer.
     Lauerer (Muräne, Aal, Zitteraal, Wels) wechseln tagsüber zwischen Höhle (`den`) und Ausflug durchs Becken (`out`) – etwa halb und halb. */
  AA.HIDE = { every: [40, 110], stay: [3, 7] };
  AA.LURK = { den: [14, 30], out: [16, 34] };
})(window.AA);
