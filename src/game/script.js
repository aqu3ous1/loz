/* =============================================================
   game/script.js -- the story: cutscenes, set-piece dialogue, and the
   text that carries the game between its dungeons.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, V3 = LZ.V3;

  var S = {};

  /* ---------------- portraits ---------------- */
  S.PORTRAITS = {
    link:    { skin: 0xd8bfa4, cloth: 0x4a7a52, hair: 0xe4e0d4, beard: true, beardColor: 0xe4e0d4 },
    player:  { skin: 0xecc49c, cloth: 0x4aa257, hair: 0x8a5f2a, hat: 'cap' },
    gran:    { skin: 0xe0c0a0, cloth: 0x7a5a8a, hair: 0xd8d4cc },
    grandad: { skin: 0xd4b090, cloth: 0x5a6a8a, hair: 0xc8c4bc, beard: true, beardColor: 0xc8c4bc },
    genmo:   { skin: 0xc09878, cloth: 0x3a2a40, hair: 0x8a2a1a, evil: true },
    smith:   { skin: 0xb08050, cloth: 0x6a4a2c, hair: 0x2a2418, beard: true, beardColor: 0x2a2418 },
    conman:  { skin: 0xe8d0b0, cloth: 0x9a6a2a, hair: 0x4a3a20 },
    guard:   { skin: 0xd8b490, cloth: 0x36527e, hair: 0x3a3028 },
    kid:     { skin: 0xf0d0b0, cloth: 0xa8483c, hair: 0x6a4a20 },
    elder:   { skin: 0xd0b494, cloth: 0xd8cdb0, hair: 0xe8e4dc, beard: true, beardColor: 0xe8e4dc },
    miner:   { skin: 0xb89070, cloth: 0x8a7050, hair: 0x3a2a1a },
    zora:    { skin: 0x8ec8dc, cloth: 0x2f6a86, hair: 0x2f6a86 },
    keeper:  { skin: 0xc0b8a8, cloth: 0x3a3444, hair: 0x8a8478 },
    merchant:{ skin: 0xc89860, cloth: 0xbfa374, hair: 0x2a2418 }
  };

  function name(g) { return g.inv.playerName || 'Rell'; }

  /* ---------------------------------------------------------------- */
  /* PROLOGUE -- the deathbed                                          */
  /* ---------------------------------------------------------------- */
  S.prologue = function (g) {
    var n = name(g);
    g.cutscene.play([
      { fade: 'out', dur: 0.01 },
      { fn: function () { g.hud.visible = false; } },
      { fade: 'in', dur: 1.6 },
      { title: 'Farrow Village', sub: 'The house at the end of the lane' },
      { wait: 0.8 },
      { cam: { pos: [0.2, 2.6, 4.4], target: [0, 1.0, -1.2], dur: 2.6 } },
      { say: 'Your great-grandfather has not left this bed in\nfourteen days.\f'
           + 'The whole village knows what that means. Nobody\nsays it out loud.',
        style: 'dark' },
      { anim: 'Link', clip: 'lieReach' },
      { sfx: 'blip_low' },
      { say: n + '.... come closer. My eyes are not what\nthey were.',
        speaker: 'Link', portrait: S.PORTRAITS.link },
      { cam: { pos: [-1.5, 1.7, 1.2], target: [0, 1.05, -1.0], dur: 1.8 } },
      { say: n + '.... Hyrule has been peaceful for many\nyears now. I\'ve sealed away the powers of darkness\naway for several generations.\f'
           + 'Your family has all become peaceful dwellers of the\nland, and none of them have a single bone in their\nbodies in which they could even hurt a fly.\f'
           + 'But, ' + n + '.... I sense times are changing soon.\f'
           + 'Something is on the verge of escaping confinement\nsoon, and I don\'t know who or what it is.\f'
           + 'It\'s taking all that I have in me even to just\ndetect whatever this malicious force is.',
        speaker: 'Link', portrait: S.PORTRAITS.link },
      { shake: 0.12 },
      { say: 'If I were your age, I could take it out.\nBut I\'ve been past my prime for nearly sixty years\nnow...',
        speaker: 'Link', portrait: S.PORTRAITS.link },
      { cam: { pos: [1.6, 1.5, 0.6], target: [0, 1.0, -1.0], dur: 2.2 } },
      { say: n + '..... this force that I\'m detecting...\nit seems to be coming from a small desert town in\nGerudo.\f'
           + 'Yes, quite far away from where we are now, but I\ndon\'t like what this forebodes.\f'
           + 'I sense that there\'s something different in you from\nmy other descendants. For whatever reason, they\nfailed to inherit my genes.\f'
           + 'But I think you\'re different. You have always been\ndifferent.\f'
           + 'You\'re the only one who can save us now.',
        speaker: 'Link', portrait: S.PORTRAITS.link },
      { anim: 'Link', clip: 'lie' },
      { cam: { pos: [0, 1.9, 3.0], target: [-1.8, 0.6, -1.6], dur: 2.0 } },
      { say: 'But before you start your journey, please check\ninside that chest. It has my old gear in there.\f'
           + 'It won\'t be much use as of now, but take it to a\nproper blacksmith, and it can be just as good as new.\f'
           + 'Only don\'t let some random conman rip you off.',
        speaker: 'Link', portrait: S.PORTRAITS.link },
      { cam: { pos: [-1.2, 1.6, 1.4], target: [0, 1.05, -1.0], dur: 1.8 } },
      { anim: 'Link', clip: 'lieReach' },
      { say: 'Well, ' + n + '.... your time has come.\f'
           + 'Make your great grandfather proud and carry on my\nlegacy.',
        speaker: 'Link', portrait: S.PORTRAITS.link },
      { anim: 'Link', clip: 'lie' },
      { flag: 'heardLink' },
      { wait: 0.8 },
      { camFollow: true },
      { fn: function () {
          g.hud.visible = true;
          g.hud.toast('Open the chest at the foot of the bed.');
        } }
    ]);
  };

  /* ---------------------------------------------------------------- */
  /* HANMAN -- Genmo steals the candy                                  */
  /* ---------------------------------------------------------------- */
  S.genmoIntro = function (g, genmo, cop1, cop2, child) {
    var n = name(g);
    g.audio.stopSong();
    g.cutscene.play([
      { fn: function () { g.player.setState('ground'); } },
      { cam: { pos: [genmo.pos[0] + 5, genmo.pos[1] + 2.6, genmo.pos[2] + 5],
               target: [genmo.pos[0], genmo.pos[1] + 1.0, genmo.pos[2]], dur: 1.6 } },
      { anim: genmo, clip: 'laugh' },
      { say: 'A boy about your age is holding a paper twist of\ncandy above his head. A much smaller child is\ncrying at his feet.',
        style: 'dark' },
      { say: 'What? She wasn\'t going to finish it.\fLook at her. Look how small she is.',
        speaker: 'Genmo', portrait: S.PORTRAITS.genmo },
      { anim: cop1, clip: 'point' },
      { say: 'Hand it back. Now, lad. I have had a long week and\nyou are not going to be the worst part of it.',
        speaker: 'Town Guard', portrait: S.PORTRAITS.guard },
      { anim: genmo, clip: 'idleAlert' },
      { say: 'Fine. Fine! Here.\fTake your...',
        speaker: 'Genmo', portrait: S.PORTRAITS.genmo },
      { wait: 0.6 },
      { sfx: 'dark' },
      { shake: 0.5 },
      { fn: function () {
          g.effects.burst(genmo.pos[0], genmo.pos[1] + 1.0, genmo.pos[2], [0.6, 0.2, 0.9]);
          g.particles.emit('dark', genmo.pos[0], genmo.pos[1] + 0.6, genmo.pos[2], 26, 1.2);
        } },
      { say: '...oh.\fOh, that\'s new.',
        speaker: 'Genmo', portrait: S.PORTRAITS.genmo },
      { cam: { pos: [genmo.pos[0] + 2.5, genmo.pos[1] + 1.6, genmo.pos[2] + 3.6],
               target: [genmo.pos[0], genmo.pos[1] + 1.4, genmo.pos[2]], dur: 1.2 } },
      { anim: genmo, clip: 'cast' },
      { sfx: 'magic' },
      { shake: 0.8 },
      { fn: function () {
          g.effects.ring(genmo.pos[0], genmo.pos[1] + 0.2, genmo.pos[2], [0.7, 0.2, 1, 0.9], 10);
          [cop1, cop2].forEach(function (c) {
            if (!c) return;
            c.play('die', { restart: true, blend: 0.05 });
            c.knock[0] = (c.pos[0] - genmo.pos[0]) * 3;
            c.knock[2] = (c.pos[2] - genmo.pos[2]) * 3;
          });
        } },
      { say: 'The guards go down like sacks of grain. Neither of\nthem gets up.',
        style: 'dark' },
      { anim: genmo, clip: 'float' },
      { fn: function () { genmo.flying = true; genmo.gravity = 0; } },
      { say: 'I have never felt like this.\fI have NEVER felt like this.',
        speaker: 'Genmo', portrait: S.PORTRAITS.genmo },
      { face: genmo, at: 'player' },
      { cam: { pos: [g.player.pos[0] + 1.5, g.player.pos[1] + 1.8, g.player.pos[2] + 2.6],
               target: [genmo.pos[0], genmo.pos[1] + 1.6, genmo.pos[2]], dur: 1.4 } },
      { wait: 1.0 },
      { say: 'He looks straight at you.\fFor one long second, neither of you moves.',
        style: 'dark' },
      { sfx: 'warp' },
      { fn: function () {
          g.effects.burst(genmo.pos[0], genmo.pos[1] + 1.2, genmo.pos[2], [0.6, 0.2, 0.9]);
          genmo.removeMe = true;
        } },
      { shake: 0.4 },
      { say: 'And then he is gone, straight up, faster than\nanything with legs should move.',
        style: 'dark' },
      { flag: 'sawGenmo' },
      { camFollow: true },
      { music: 'desert' }
    ], function () { S.deathNews(g); });
  };

  /* ---------------------------------------------------------------- */
  /* The call from home                                                */
  /* ---------------------------------------------------------------- */
  S.deathNews = function (g) {
    var n = name(g);
    g.cutscene.play([
      { wait: 1.2 },
      { fade: 'out', dur: 1.0 },
      { music: null },
      { say: 'A courier catches up with you at the edge of the\nsquare. She has run a long way. She will not look\nat your face.',
        style: 'dark' },
      { fade: 'in', dur: 0.8 },
      { say: n + '. Oh, ' + n + '.\fHe went in the night. Two days ago now.',
        speaker: 'Grandmother\'s Letter', portrait: S.PORTRAITS.gran },
      { say: 'I want you to hear the rest from me and not from\nthe village.\f'
           + 'It was not his age. I have sat with people who went\nof their age and it does not look like that.\f'
           + 'There was a darkness in the room. It came in under\nthe door like water and it did not leave until it\nwas finished.\f'
           + 'He was too feeble to push it back. He knew he would\nbe. He told me so a month ago and made me promise\nnot to tell you.',
        speaker: 'Grandmother\'s Letter', portrait: S.PORTRAITS.gran },
      { sfx: 'dark' },
      { shake: 0.2 },
      { say: 'There is one more thing. He left a note on the\nbedside, in a hand I could barely read.\f'
           + 'It says: "THE BOY IN THE SAND. HE DID NOT KNOW\nHE COULD REACH THIS FAR. HE KNOWS NOW."\f'
           + 'Come home when you can, ' + n + '. But do not come\nhome yet.',
        speaker: 'Grandmother\'s Letter', portrait: S.PORTRAITS.gran },
      { give: 'lastNote' },
      { flag: 'heardOfDeath' },
      { fn: function () {
          g.hud.toast('The world feels different now.');
          g.inv.setFlag('worldHostile');
        } },
      { say: 'Somewhere out past the dunes, something that used\nto ignore you decides that it will not, any more.',
        style: 'dark' },
      { music: 'desert' }
    ]);
  };

  /* ---------------------------------------------------------------- */
  /* Ashvale call to action                                            */
  /* ---------------------------------------------------------------- */
  S.ashvaleNews = function (g) {
    g.cutscene.play([
      { say: 'A man on a mule comes down the road so fast he nearly\nrides through you.',
        style: 'dark' },
      { say: 'Ashvale! It\'s Ashvale! The mountain\'s open and\nsomething came out of it!\f'
           + 'There\'s a boy up there. A boy, and he\'s LAUGHING,\nand the rock is moving when he tells it to!',
        speaker: 'Fleeing Miner', portrait: S.PORTRAITS.miner },
      { flag: 'heardAshvale' },
      { fn: function () { g.hud.toast('New destination: Ashvale'); } }
    ]);
  };

  /* ---------------------------------------------------------------- */
  /* Genmo's mid-game retreat (after boss 2)                           */
  /* ---------------------------------------------------------------- */
  S.genmoRetreat = function (g, boss) {
    var n = name(g);
    g.cutscene.play([
      { music: null },
      { cam: { pos: [boss.pos[0] + 3, boss.pos[1] + 2, boss.pos[2] + 3],
               target: [boss.pos[0], boss.pos[1] + 1.0, boss.pos[2]], dur: 1.2 } },
      { anim: boss, clip: 'kneel' },
      { say: 'You... you\'re HIS, aren\'t you.\fThe old man in the green. The one I burned out of\nthe world from four hundred leagues away.',
        speaker: 'Genmo', portrait: S.PORTRAITS.genmo },
      { say: 'I didn\'t even know what I was doing. I was ANGRY,\nand then he was dead, and it felt like stretching.',
        speaker: 'Genmo', portrait: S.PORTRAITS.genmo },
      { say: 'You should have seen my face. I laughed for an hour.\fI keep waiting to feel bad about it.',
        speaker: 'Genmo', portrait: S.PORTRAITS.genmo },
      { sfx: 'dark' },
      { anim: boss, clip: 'float' },
      { say: 'I am not finished. I have barely STARTED.\f'
           + 'Go on, then. Chase me. Kill the things I leave\nbehind me.\f'
           + 'When you finally catch up, I will be so much more\nthan this.',
        speaker: 'Genmo', portrait: S.PORTRAITS.genmo },
      { sfx: 'warp' },
      { shake: 0.5 },
      { fn: function () {
          g.effects.burst(boss.pos[0], boss.pos[1] + 1, boss.pos[2], [0.6, 0.2, 0.9]);
          boss.removeMe = true;
        } },
      { flag: 'genmoFled' },
      { camFollow: true }
    ]);
  };

  /* ---------------------------------------------------------------- */
  /* Ending                                                            */
  /* ---------------------------------------------------------------- */
  S.ending = function (g) {
    var n = name(g);
    g.cutscene.play([
      { music: null },
      { fade: 'out', dur: 1.6, color: [1, 1, 1] },
      { wait: 0.6 },
      { say: 'The dark goes out of him all at once, the way a\nlamp goes out. What is left is a boy your age, on\nhis knees, looking at his hands.',
        style: 'dark' },
      { say: 'I didn\'t...\fI never asked for any of it. It was just IN me.\fWas it in him too? The first one? Was he just\nsomeone this happened to?',
        speaker: 'Genmo', portrait: S.PORTRAITS.genmo },
      { say: 'You could answer that. You have carried a dead man\'s\nsword across a whole country to be standing here.\f'
           + 'You know exactly how much of a person is their\nblood, and how much is what they do about it.',
        style: 'dark' },
      { flag: 'gameCleared' },
      { fade: 'in', dur: 2.0 },
      { music: 'ending' },
      { title: 'THE LEGEND OF ZELDA: DESCENDANTS', sub: 'thank you for playing' },
      { say: 'Hyrule is quiet again.\f'
           + 'You go home. You put the Heirloom Blade back in the\nchest at the foot of an empty bed, because that is\nwhere it lives.\f'
           + 'Your grandmother tells everyone at the door that\nyou were always different. She has been saying it\nfor years. She is finally right in front of\nwitnesses.',
        style: 'msg' },
      { say: 'Sixty years from now, someone small will open that\nchest.\f'
           + 'That is how it works. That is the whole of it.',
        style: 'msg' },
      { fn: function () { g.state = 'credits'; g.creditT = 0; } }
    ]);
  };

  /* ---------------------------------------------------------------- */
  /* Blacksmith: the honest smith and the conman                       */
  /* ---------------------------------------------------------------- */
  S.smithOffer = function (g, npc) {
    var inv = g.inv;
    if (inv.flag('swordReforged')) {
      g.dialogue.say('She swings well now, doesn\'t she. That steel was\nmade before my grandfather\'s grandfather.\f'
        + 'Whoever forged it the first time knew something I\ndon\'t.',
        { speaker: 'Doram the Smith', portrait: S.PORTRAITS.smith });
      return;
    }
    var hasRusty = inv.weapons.some(function (w) { return w.id === 'rustySword'; });
    if (!hasRusty) {
      g.dialogue.say('Bring me something worth the coal and we\'ll talk.',
        { speaker: 'Doram the Smith', portrait: S.PORTRAITS.smith });
      return;
    }
    var price = 60;
    g.dialogue.ask('That is not a sword, that is a memory of one.\f'
      + 'I can bring it back. Sixty rupees, and I will not\npretend it is cheap, because it isn\'t, and I will\nnot pretend it is dear, because it isn\'t that\neither.\f'
      + 'Sixty. Yes or no.',
      ['Pay 60 rupees', 'Not yet'],
      function (i) {
        if (i !== 0) return;
        if (!inv.spend(price)) {
          g.audio.sfx('error');
          g.dialogue.say('Come back when your purse is heavier.',
            { speaker: 'Doram the Smith', portrait: S.PORTRAITS.smith });
          return;
        }
        S.reforge(g, npc);
      }, { speaker: 'Doram the Smith', portrait: S.PORTRAITS.smith });
  };

  S.reforge = function (g, npc) {
    var inv = g.inv;
    g.cutscene.play([
      { fade: 'out', dur: 0.8 },
      { sfx: 'fire' },
      { wait: 0.5 },
      { fn: function () {
          var idx = -1;
          for (var i = 0; i < inv.weapons.length; i++) if (inv.weapons[i].id === 'rustySword') idx = i;
          if (idx >= 0) inv.replaceWeapon(idx, 'heirloomBlade');
          else inv.addWeapon('heirloomBlade');
          inv.equippedWeapon = Math.max(0, idx);
          inv.setFlag('swordReforged');
        } },
      { fade: 'in', dur: 0.8 },
      { sfx: 'fanfare_big' },
      { say: 'Two days at the fire and one night with a stone.\f'
           + 'Here. The Heirloom Blade.\f'
           + 'I took the rust off and found something underneath\nthat did not want taking off. Whatever that is, it\nis yours now.\f'
           + 'It will not break. Do not test me on that. Just\ntake it and go do whatever has you looking like\nthat.',
        speaker: 'Doram the Smith', portrait: S.PORTRAITS.smith },
      { fn: function () {
          g.hud.toast('Got: Heirloom Blade');
          g.inv.setFlag('done_sq_conman');
        } }
    ]);
  };

  S.conmanOffer = function (g, npc) {
    var inv = g.inv;
    if (inv.flag('conmanPaid')) {
      g.dialogue.say('Still working on it! Very delicate. Very technical.\f...You haven\'t been to the other smith, have you?',
        { speaker: 'Bexil', portrait: S.PORTRAITS.conman });
      return;
    }
    if (inv.flag('swordReforged')) {
      g.dialogue.say('Oh. Oh, you went to Doram.\fWell. Fine. He\'s better. Everyone knows he\'s\nbetter. I have a FAMILY.',
        { speaker: 'Bexil', portrait: S.PORTRAITS.conman });
      return;
    }
    g.dialogue.ask('Friend! FRIEND. Is that an antique?\f'
      + 'I can have that blade singing by tomorrow. Master\nsmith, twenty years, ask anyone.\f'
      + 'For you? Two hundred rupees. And that is me losing\nmoney, which I do constantly, out of love.',
      ['Pay 200 rupees', 'Ask around first'],
      function (i) {
        if (i !== 0) {
          g.dialogue.say('Ask around! Ask around, sure. Ask ANYONE.\fJust... maybe not Doram. He and I have history.',
            { speaker: 'Bexil', portrait: S.PORTRAITS.conman });
          return;
        }
        if (!inv.spend(200)) {
          g.audio.sfx('error');
          g.dialogue.say('You don\'t have it. That\'s awkward for both of us.',
            { speaker: 'Bexil', portrait: S.PORTRAITS.conman });
          return;
        }
        inv.setFlag('conmanPaid');
        g.audio.sfx('error');
        g.dialogue.say('Wonderful! Marvellous! Come back tomorrow!\f'
          + '...He is not going to be here tomorrow.\n'
          + 'You know that. You knew it while you were counting\nthe rupees out.',
          { speaker: 'Bexil', portrait: S.PORTRAITS.conman,
            onDone: function () {
              g.hud.toast('Your great-grandfather did warn you.');
              npc.hidden = true;
              npc.interactable = false;
            } });
      }, { speaker: 'Bexil', portrait: S.PORTRAITS.conman });
  };

  /* ---------------------------------------------------------------- */
  /* Generic dungeon completion                                        */
  /* ---------------------------------------------------------------- */
  S.dungeonCleared = function (g, dungeonId, opts) {
    opts = opts || {};
    var text = opts.text || 'The air goes still. Whatever was wrong here is\nfinished.';
    g.cutscene.play([
      { music: null },
      { wait: 0.6 },
      { sfx: 'secret' },
      { say: text, style: 'dark' },
      { fn: function () {
          g.inv.medallions[dungeonId] = true;
          if (opts.then) opts.then(g);
        } }
    ]);
  };

  /* ---------------------------------------------------------------- */
  /* Boss opening barks                                                */
  /* ---------------------------------------------------------------- */
  S.bossBark = function (g, which) {
    var lines = {
      emberhusk: ['Something down here has been awake the whole time\nthe mountain was asleep.', null],
      genmoYoung: ['"You followed me. Nobody has ever followed me."', 'Genmo'],
      thornheart: ['The grove has one mouth and it is finally hungry\nenough to use it.', null],
      tidewrought: ['The lake sings. It has been singing since before\nthere were ears.', null],
      hollowking: ['Something in the dark is wearing a crown and\nwaiting to be looked at.', null],
      genmoFinal: ['"There he is. My great-grandfather\'s little\nproblem, all grown up."', 'Genmo']
    };
    var l = lines[which];
    if (!l) return;
    g.dialogue.say(l[0], l[1] ? { speaker: l[1], portrait: S.PORTRAITS.genmo } : { style: 'dark' });
  };

  /* ---------------------------------------------------------------- */
  /* Ambient villager lines                                            */
  /* ---------------------------------------------------------------- */
  S.LINES = {
    farrow: [
      ['Old Nesk', ['He taught me to fish when I was six. Sat in the\nrain for four hours and caught nothing and called\nit a good day.']],
      ['Marra', ['Your great-grandfather never once told us what he\ndid before he came here.\fWe worked it out anyway. You don\'t move like that\nfrom farming.']],
      ['Bell', ['Are you really going? All the way to Gerudo?\fBring me back some sand. I have never seen sand.']],
      ['Hemm', ['Careful past the fence line. The rabbits have been\nstrange this week.\fThey watch you. Rabbits do not watch you.']]
    ],
    stonebell: [
      ['Toll-keeper', ['The clock in the tower stopped at four in the\nmorning nine days ago and nobody can get it going.\fMy whole life runs on that bell.']],
      ['Rin', ['Two smiths in one town. One of them is very good\nand one of them is very loud.\fI will let you work out which is which.']],
      ['Guardsman Oll', ['Road south is open but I would not walk it at\nnight. Not this month.']],
      ['Herbalist', ['Bottles? I have bottles. Everyone wants bottles.\fFind me something worth putting in one.']]
    ],
    hanman: [
      ['Sand-caller', ['The dunes have moods. Today the dune is in a\nMOOD.']],
      ['Amjed', ['That boy has been trouble since he could walk.\fBut this is not trouble. This is something else\nwearing trouble\'s coat.']],
      ['Tavernkeep', ['His great-grandmother came through here once, they\nsay. Long time ago. Died young.\fNobody remembers her name. That always seemed\nwrong to me.']],
      ['Child', ['He took my candy. Then he took the WHOLE SQUARE.']]
    ],
    ashvale: [
      ['Foreman Gask', ['Half my seam is molten and the other half is\nWALKING.\fI have been a miner for thirty years and I have\nnever once had to say that sentence.']],
      ['Sella', ['We keep the lamps burning day and night now.\fWhatever came up out of that mountain does not\nlike the light. It just does not mind it enough.']],
      ['Old Pell', ['Ash falls like snow and nothing grows and my knees\nhurt.\fOther than that it is lovely up here.']]
    ]
  };

  LZ.Script = S;
})(LZ);
