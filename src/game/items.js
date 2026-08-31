/* =============================================================
   game/items.js -- item registry.

   Weapons carry Breath-of-the-Wild style durability; the heirloom blade
   is the exception, because the whole point of the story is that it is
   the one thing that does not wear out.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';

  var ITEMS = {};
  function def(id, o) { o.id = id; ITEMS[id] = o; return o; }

  /* ---------------- swords & clubs ---------------- */
  def('rustySword', {
    name: 'Rusted Sword', type: 'weapon', icon: 'sword',
    atk: 1, dur: 26, reach: 1.05, speed: 1.0, weight: 1,
    color: 0x8a7a68, mat: 'metalRust',
    desc: 'Your great-grandfather\'s old blade. Sixty years of rust have\nleft it barely sharper than a stick. A real smith could fix it.'
  });
  def('heirloomBlade', {
    name: 'Heirloom Blade', type: 'weapon', icon: 'sword',
    atk: 3, dur: Infinity, reach: 1.15, speed: 1.05, weight: 1,
    color: 0xdfe6ef, mat: 'metal', unbreakable: true, heirloom: true,
    desc: 'Reforged from the Rusted Sword. It will never break, and it\nremembers every monster it has ever cut.'
  });
  def('awakenedBlade', {
    name: 'Awakened Heirloom', type: 'weapon', icon: 'sword',
    atk: 6, dur: Infinity, reach: 1.22, speed: 1.10, weight: 1,
    color: 0xcfe8ff, mat: 'gemBlue', unbreakable: true, heirloom: true, glow: [0.4, 0.7, 1.0],
    desc: 'The blade has remembered what it used to be. Light runs along\nthe edge like water.'
  });
  def('travelersSword', {
    name: 'Traveler\'s Sword', type: 'weapon', icon: 'sword',
    atk: 2, dur: 32, reach: 1.05, speed: 1.0, weight: 1, color: 0xbfc6d0, mat: 'metal',
    desc: 'Cheap, common, and everywhere. Every road in Hyrule has one\nrusting in a ditch beside it.'
  });
  def('scimitar', {
    name: 'Gerudo Scimitar', type: 'weapon', icon: 'sword',
    atk: 3, dur: 28, reach: 1.12, speed: 1.28, weight: 0.8, color: 0xe0c88a, mat: 'gold',
    desc: 'Curved, light, and made for fighting in sand where a heavy\nswing will bury you.'
  });
  def('broadsword', {
    name: 'Knight\'s Broadsword', type: 'weapon', icon: 'sword',
    atk: 4, dur: 44, reach: 1.20, speed: 0.78, weight: 1.6, color: 0xa8b0be, mat: 'metal',
    desc: 'Heavy enough that the swing decides where you are standing\nafterwards.'
  });
  def('minersPick', {
    name: 'Miner\'s Pick', type: 'weapon', icon: 'hammer',
    atk: 2, dur: 40, reach: 1.0, speed: 0.85, weight: 1.4, color: 0x9a8878, mat: 'metalRust',
    breaksOre: true,
    desc: 'Bad at fighting, excellent at ore. Ashvale miners swear by it,\nand at it.'
  });
  def('flamespike', {
    name: 'Emberfang', type: 'weapon', icon: 'sword',
    atk: 3, dur: 30, reach: 1.08, speed: 1.0, weight: 1, element: 'fire',
    color: 0xd85838, mat: 'gemRed', glow: [1.0, 0.5, 0.2],
    desc: 'Forged in the Ashvale vents. Lights torches, melts ice, and\nannoys anything with fur.'
  });
  def('frostEdge', {
    name: 'Rimeglass Edge', type: 'weapon', icon: 'sword',
    atk: 3, dur: 30, reach: 1.08, speed: 1.0, weight: 1, element: 'ice',
    color: 0x8ad8f0, mat: 'gemBlue', glow: [0.4, 0.8, 1.0],
    desc: 'Cold enough that the wound closes before it bleeds. Freezes\nwhat it strikes, briefly.'
  });
  def('boneClub', {
    name: 'Bone Club', type: 'weapon', icon: 'hammer',
    atk: 2, dur: 16, reach: 0.98, speed: 0.9, weight: 1.3, color: 0xded6be, mat: 'bone',
    desc: 'Someone\'s femur, probably. It has stopped caring whose.'
  });
  def('royalBlade', {
    name: 'Royal Guard\'s Blade', type: 'weapon', icon: 'sword',
    atk: 6, dur: 22, reach: 1.16, speed: 1.05, weight: 1, color: 0xe8e2c0, mat: 'gold',
    desc: 'Beautiful, deadly, and made two hundred years ago by people\nwho did not expect anyone to still be swinging it.'
  });

  /* ---------------- shields ---------------- */
  def('woodShield', {
    name: 'Wooden Shield', type: 'shield', icon: 'shield',
    guard: 1, dur: 24, color: 0x8a6438, mat: 'planks', burnable: true,
    desc: 'Stops most things. Catches fire around the other things.'
  });
  def('ironShield', {
    name: 'Banded Shield', type: 'shield', icon: 'shield',
    guard: 2, dur: 48, color: 0x9aa2ad, mat: 'metal',
    desc: 'Iron over oak. Heavy on the arm, light on the regrets.'
  });
  def('mirrorShield', {
    name: 'Mirror Shield', type: 'shield', icon: 'mirror',
    guard: 3, dur: Infinity, color: 0xd8e8f8, mat: 'gemBlue', unbreakable: true, reflects: true,
    desc: 'Throws light and magic straight back where it came from.'
  });

  /* ---------------- C-button tools ---------------- */
  def('bombs', {
    name: 'Bomb', type: 'tool', icon: 'bomb', slot: true, ammo: 'bombs',
    desc: 'Blows open cracked walls, and anything standing near one.'
  });
  def('bow', {
    name: 'Hero\'s Bow', type: 'tool', icon: 'bow', slot: true, ammo: 'arrows', aims: true,
    desc: 'Hold to aim in first person. Release to fire.'
  });
  def('hookshot', {
    name: 'Hookshot', type: 'tool', icon: 'hookshot', slot: true, aims: true, magic: 0,
    desc: 'Fires a chain at wooden and metal targets and reels you in.'
  });
  def('boomerang', {
    name: 'Gale Boomerang', type: 'tool', icon: 'boomerang', slot: true, aims: true,
    desc: 'Stuns enemies, cuts grass, and brings back whatever it hits.'
  });
  def('lantern', {
    name: 'Storm Lantern', type: 'tool', icon: 'lantern', slot: true, magic: 0,
    desc: 'Burns steadily in any wind. Lights torches and dark rooms.'
  });
  def('iceRod', {
    name: 'Rime Rod', type: 'tool', icon: 'icerod', slot: true, magic: 4, aims: true,
    desc: 'Freezes water into a standing block, and enemies into\nsomething you can shatter.'
  });
  def('lens', {
    name: 'Lens of Truth', type: 'tool', icon: 'lens', slot: true, magic: 1,
    desc: 'Drains magic while held. Shows what is really there.'
  });
  def('flute', {
    name: 'Wayfarer\'s Flute', type: 'tool', icon: 'flute', slot: true,
    desc: 'Your great-grandfather\'s. Certain songs move more than air.'
  });
  def('hammer', {
    name: 'Skullbreaker Hammer', type: 'tool', icon: 'hammer', slot: true,
    desc: 'Drives posts, flattens armour, and shakes the ground.'
  });

  /* ---------------- masks ---------------- */
  def('stoneMask', {
    name: 'Stone Mask', type: 'mask', icon: 'mask_stone', slot: true,
    desc: 'So plain that eyes slide off it. Ordinary enemies stop\nnoticing you entirely.'
  });
  def('hareMask', {
    name: 'Hare Hood', type: 'mask', icon: 'mask_hare', slot: true,
    desc: 'Long ears, longer stride. You run considerably faster.'
  });
  def('truthMask', {
    name: 'Mask of Truth', type: 'mask', icon: 'mask_truth', slot: true,
    desc: 'Lets you hear what the small and the dead are thinking.\nThey are usually thinking about you.'
  });
  def('gibdoMask', {
    name: 'Wrappings Mask', type: 'mask', icon: 'mask_truth', slot: true,
    desc: 'The dead of the Sunken Quarter take you for one of their own.'
  });

  /* ---------------- consumables & materials ---------------- */
  def('redPotion', { name: 'Red Potion', type: 'consumable', icon: 'potion_red', heal: 8, desc: 'Restores eight hearts.' });
  def('greenPotion', { name: 'Green Potion', type: 'consumable', icon: 'potion_green', magic: 48, desc: 'Restores your magic.' });
  def('bottle', { name: 'Empty Bottle', type: 'bottle', icon: 'bottle', desc: 'Holds one of almost anything.' });
  def('fairy', { name: 'Fairy', type: 'bottled', icon: 'fairy', desc: 'Revives you once if you fall.' });

  def('emberOre', { name: 'Ember Ore', type: 'material', icon: 'ore', desc: 'Still warm. Smiths pay well and ask nothing.' });
  def('coldIron', { name: 'Cold Iron', type: 'material', icon: 'ore', desc: 'Iron that never warms. Monsters dislike it.' });
  def('sealShard', { name: 'Seal Shard', type: 'material', icon: 'star', desc: 'A fragment of the seal your great-grandfather set.' });

  /* ---------------- quest items ---------------- */
  def('letter', { name: 'Grandmother\'s Letter', type: 'quest', icon: 'letter', desc: 'News from home. You have read it eleven times.' });
  def('lastNote', { name: 'The Last Note', type: 'quest', icon: 'letter', desc: 'Written in a hand that could barely hold the pen.' });
  def('sealKey', { name: 'Seal Key', type: 'quest', icon: 'bosskey', desc: 'Opens what the Hero sealed.' });
  def('minerPass', { name: 'Miner\'s Token', type: 'quest', icon: 'lock', desc: 'Ashvale\'s mine gate opens for this and nothing else.' });
  def('clockGear', { name: 'Clock Gear', type: 'quest', icon: 'clockface', desc: 'A tooth from the Stonebell tower clock.' });
  def('desertPass', { name: 'Caravan Chit', type: 'quest', icon: 'letter', desc: 'The gate guards at Hanman honour it. Barely.' });

  /* ---------------- key items ---------------- */
  def('heartPiece', { name: 'Piece of Heart', type: 'collectible', icon: 'heartpiece', desc: 'Four of these make a whole heart.' });
  def('heartContainer', { name: 'Heart Container', type: 'collectible', icon: 'heart_full', desc: 'A full heart, taken from something that no longer needs it.' });
  def('smallKey', { name: 'Small Key', type: 'key', icon: 'key', desc: 'Opens one locked door in this dungeon.' });
  def('bossKey', { name: 'Great Key', type: 'key', icon: 'bosskey', desc: 'Opens the door at the end.' });
  def('map', { name: 'Dungeon Map', type: 'key', icon: 'map', desc: 'Shows the layout of every room.' });
  def('compass', { name: 'Compass', type: 'key', icon: 'compass', desc: 'Marks chests and the great door.' });

  /* ---------------- upgrades ---------------- */
  def('quiver', { name: 'Bigger Quiver', type: 'upgrade', icon: 'quiver', desc: 'Carry more arrows.' });
  def('bombBag', { name: 'Bigger Bomb Bag', type: 'upgrade', icon: 'bombbag', desc: 'Carry more bombs.' });
  def('wallet', { name: 'Giant Wallet', type: 'upgrade', icon: 'wallet', desc: 'Hold up to 999 rupees.' });
  def('magicJar', { name: 'Magic Vessel', type: 'upgrade', icon: 'magic', desc: 'Doubles your magic.' });

  /* ---------------- songs (played on the flute) ---------------- */
  var SONGS = {
    hymnOfAges: {
      id: 'hymnOfAges', name: 'Hymn of Ages', notes: ['cLeft', 'cRight', 'cUp', 'cLeft', 'cRight', 'cUp'],
      color: [0.65, 0.55, 1.0],
      desc: 'Sixty years fall away, or return.'
    },
    verseOfReturn: {
      id: 'verseOfReturn', name: 'Verse of Return', notes: ['cDown', 'cLeft', 'cDown', 'cLeft'],
      color: [0.5, 0.9, 1.0],
      desc: 'Pulls the last few moments back into place.'
    },
    windsCall: {
      id: 'windsCall', name: "Wind's Call", notes: ['cUp', 'cLeft', 'cRight', 'cDown'],
      color: [0.7, 1.0, 0.8],
      desc: 'Carries you to any place you have already been.'
    },
    dirgeOfTheSeal: {
      id: 'dirgeOfTheSeal', name: 'Dirge of the Seal', notes: ['cDown', 'cDown', 'cRight', 'cLeft', 'cUp'],
      color: [1.0, 0.85, 0.4],
      desc: 'The song the Hero used to bind the dark. It still answers.'
    }
  };

  LZ.Items = { ITEMS: ITEMS, SONGS: SONGS, get: function (id) { return ITEMS[id]; } };
})(LZ);
