/* =============================================================
   game/quest.js -- the quest log and the main-path checklist that
   drives the "where do I go now" prompt.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';

  /* ordered main story beats; the first unmet one is the current objective */
  var CHAPTERS = [
    { id: 'ch0', title: 'A Last Instruction',
      goal: 'Speak with your great-grandfather.',
      done: function (inv) { return inv.flag('heardLink'); } },
    { id: 'ch0b', title: 'A Last Instruction',
      goal: 'Open the chest at the foot of the bed.',
      done: function (inv) { return inv.flag('gotRustySword'); } },
    { id: 'ch1', title: 'The Long Road',
      goal: 'Leave Farrow Village and cross the Yeld Plains.',
      done: function (inv) { return inv.visited['stonebell']; } },
    { id: 'ch2', title: 'Iron and Honesty',
      goal: 'Have the Rusted Sword reforged in Stonebell.',
      done: function (inv) { return inv.flag('swordReforged'); } },
    { id: 'ch3', title: 'South to the Sand',
      goal: 'Reach Hanman Town in the Gerudo waste.',
      done: function (inv) { return inv.visited['hanman']; } },
    { id: 'ch4', title: 'The Boy in the Square',
      goal: 'Find out what is happening in Hanman Town.',
      done: function (inv) { return inv.flag('sawGenmo'); } },
    { id: 'ch5', title: 'Word From Home',
      goal: 'Your great-grandfather has died. Learn what happened.',
      done: function (inv) { return inv.flag('heardOfDeath'); } },
    { id: 'ch6', title: 'Ash on the Wind',
      goal: 'Ashvale is under attack. Reach the mountain town.',
      done: function (inv) { return inv.visited['ashvale']; } },
    { id: 'ch7', title: 'The Emberhusk',
      goal: 'Clear the Ashvale Mine.',
      done: function (inv) { return inv.medallions['mine']; } },
    { id: 'ch8', title: 'The Stopped Clock',
      goal: 'Genmo has taken the Stonebell clock tower.',
      done: function (inv) { return inv.medallions['clock']; } },
    { id: 'ch9', title: 'Roots and Rot',
      goal: 'Something is killing the Elderwood.',
      done: function (inv) { return inv.medallions['grove']; } },
    { id: 'ch10', title: 'The Drowned Quarter',
      goal: 'Find the seal beneath Lake Nial.',
      done: function (inv) { return inv.medallions['lake']; } },
    { id: 'ch11', title: 'Where the Hero Lies',
      goal: 'Visit your great-grandfather\'s grave in the Hollow.',
      done: function (inv) { return inv.medallions['hollow']; } },
    { id: 'ch12', title: 'The Descendant',
      goal: 'Enter Genmo\'s fortress and end this.',
      done: function (inv) { return inv.flag('gameCleared'); } }
  ];

  /* optional content the log tracks separately */
  var SIDE = [
    { id: 'sq_conman', title: 'The Honest Smith',
      hint: 'Two men in Stonebell both offer to reforge your sword.' },
    { id: 'sq_hearts', title: 'Pieces of Heart',
      hint: 'Four pieces make a whole heart. There are twelve in Hyrule.' },
    { id: 'sq_masks', title: 'The Mask Collector',
      hint: 'A trader in Hanman buys strange faces.' },
    { id: 'sq_ore', title: 'Ember Ore',
      hint: 'The Ashvale smith pays for ore pulled from the deep seam.' },
    { id: 'sq_cucco', title: 'The Missing Flock',
      hint: 'Farrow Village has lost its birds again.' },
    { id: 'sq_gravekeeper', title: 'The Gravekeeper\'s Rounds',
      hint: 'Someone has been disturbing the stones in the Hollow.' },
    { id: 'sq_songs', title: 'Songs of the Hero',
      hint: 'Four melodies were passed down. You know some of them.' },
    { id: 'sq_bottles', title: 'Bottles',
      hint: 'Four bottles exist. Nobody agrees on where.' }
  ];

  function Quest(game) {
    this.g = game;
  }
  Quest.prototype.current = function () {
    var inv = this.g.inv;
    for (var i = 0; i < CHAPTERS.length; i++) {
      if (!CHAPTERS[i].done(inv)) return CHAPTERS[i];
    }
    return null;
  };
  Quest.prototype.progress = function () {
    var inv = this.g.inv, n = 0;
    for (var i = 0; i < CHAPTERS.length; i++) if (CHAPTERS[i].done(inv)) n++;
    return n / CHAPTERS.length;
  };
  Quest.prototype.chapters = function () { return CHAPTERS; };
  Quest.prototype.side = function () { return SIDE; };
  Quest.prototype.sideDone = function (id) {
    return this.g.inv.flag('done_' + id);
  };

  LZ.Quest = Quest;
  LZ.Quest.CHAPTERS = CHAPTERS;
  LZ.Quest.SIDE = SIDE;
})(LZ);
