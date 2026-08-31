/* =============================================================
   game/inventory.js -- the player's persistent state.
   Everything the save file cares about lives here.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, Items = LZ.Items;

  function Inventory() {
    this.playerName = 'Rell';
    this.maxHearts = 3;
    this.hearts = 3;            /* in quarter-heart units internally? no: whole hearts, halves allowed */
    this.heartPieces = 0;
    this.magic = 0;
    this.maxMagic = 0;
    this.rupees = 0;
    this.maxRupees = 99;
    this.arrows = 0;
    this.maxArrows = 0;
    this.bombs = 0;
    this.maxBombs = 0;

    this.weapons = [];          /* [{id, dur}] */
    this.shields = [];
    this.equippedWeapon = -1;
    this.equippedShield = -1;
    this.maxWeapons = 5;
    this.maxShields = 3;

    this.tools = {};            /* id -> true */
    this.masks = {};
    this.wornMask = null;
    this.songs = {};
    this.bottles = [];          /* [null | 'redPotion' | 'fairy' | ...] */
    this.quest = {};            /* quest item id -> true */
    this.materials = {};        /* id -> count */

    this.slots = [null, null, null];   /* C-Left, C-Down, C-Right */

    this.keys = {};             /* dungeonId -> count */
    this.bossKeys = {};
    this.maps = {};
    this.compasses = {};
    this.medallions = {};       /* dungeonId -> true, the "cleared" record */

    this.flags = {};
    this.counters = {};
    this.deaths = 0;
    this.playTime = 0;
    this.visited = {};
  }

  Inventory.prototype.hasTool = function (id) { return !!this.tools[id]; };
  Inventory.prototype.hasMask = function (id) { return !!this.masks[id]; };
  Inventory.prototype.hasSong = function (id) { return !!this.songs[id]; };
  Inventory.prototype.hasQuest = function (id) { return !!this.quest[id]; };
  Inventory.prototype.flag = function (id) { return !!this.flags[id]; };
  Inventory.prototype.setFlag = function (id, v) { this.flags[id] = (v === undefined ? true : v); };
  Inventory.prototype.counter = function (id) { return this.counters[id] || 0; };
  Inventory.prototype.bump = function (id, n) {
    this.counters[id] = (this.counters[id] || 0) + (n === undefined ? 1 : n);
    return this.counters[id];
  };

  Inventory.prototype.weapon = function () {
    return this.equippedWeapon >= 0 ? this.weapons[this.equippedWeapon] : null;
  };
  Inventory.prototype.weaponDef = function () {
    var w = this.weapon();
    return w ? Items.ITEMS[w.id] : null;
  };
  Inventory.prototype.shield = function () {
    return this.equippedShield >= 0 ? this.shields[this.equippedShield] : null;
  };
  Inventory.prototype.shieldDef = function () {
    var s = this.shield();
    return s ? Items.ITEMS[s.id] : null;
  };

  Inventory.prototype.addWeapon = function (id) {
    var d = Items.ITEMS[id];
    if (!d) return false;
    if (this.weapons.length >= this.maxWeapons) return 'full';
    this.weapons.push({ id: id, dur: d.dur });
    if (this.equippedWeapon < 0) this.equippedWeapon = this.weapons.length - 1;
    return true;
  };
  Inventory.prototype.addShield = function (id) {
    var d = Items.ITEMS[id];
    if (!d) return false;
    if (this.shields.length >= this.maxShields) return 'full';
    this.shields.push({ id: id, dur: d.dur });
    if (this.equippedShield < 0) this.equippedShield = this.shields.length - 1;
    return true;
  };
  Inventory.prototype.replaceWeapon = function (index, id) {
    var d = Items.ITEMS[id];
    if (!d || index < 0 || index >= this.weapons.length) return false;
    this.weapons[index] = { id: id, dur: d.dur };
    return true;
  };
  /* returns 'broke' when the weapon shatters */
  Inventory.prototype.wearWeapon = function (amount) {
    var w = this.weapon();
    if (!w) return null;
    var d = Items.ITEMS[w.id];
    if (d.unbreakable || w.dur === Infinity) return null;
    w.dur -= (amount === undefined ? 1 : amount);
    if (w.dur <= 0) {
      this.weapons.splice(this.equippedWeapon, 1);
      if (this.equippedWeapon >= this.weapons.length) this.equippedWeapon = this.weapons.length - 1;
      return 'broke';
    }
    return null;
  };
  Inventory.prototype.wearShield = function (amount) {
    var s = this.shield();
    if (!s) return null;
    var d = Items.ITEMS[s.id];
    if (d.unbreakable || s.dur === Infinity) return null;
    s.dur -= (amount === undefined ? 1 : amount);
    if (s.dur <= 0) {
      this.shields.splice(this.equippedShield, 1);
      if (this.equippedShield >= this.shields.length) this.equippedShield = this.shields.length - 1;
      return 'broke';
    }
    return null;
  };
  Inventory.prototype.cycleWeapon = function (dir) {
    if (!this.weapons.length) return;
    this.equippedWeapon = (this.equippedWeapon + dir + this.weapons.length) % this.weapons.length;
  };

  Inventory.prototype.addRupees = function (n) {
    this.rupees = M.clamp(this.rupees + n, 0, this.maxRupees);
    return this.rupees;
  };
  Inventory.prototype.spend = function (n) {
    if (this.rupees < n) return false;
    this.rupees -= n;
    return true;
  };
  Inventory.prototype.heal = function (n) {
    this.hearts = Math.min(this.maxHearts, this.hearts + n);
  };
  Inventory.prototype.damage = function (n) {
    this.hearts = Math.max(0, this.hearts - n);
    return this.hearts <= 0;
  };
  Inventory.prototype.addHeartPiece = function () {
    this.heartPieces++;
    if (this.heartPieces >= 4) {
      this.heartPieces = 0;
      this.maxHearts++;
      this.hearts = this.maxHearts;
      return true;
    }
    return false;
  };
  Inventory.prototype.addMagic = function (n) { this.magic = M.clamp(this.magic + n, 0, this.maxMagic); };
  Inventory.prototype.useMagic = function (n) {
    if (this.magic < n) return false;
    this.magic -= n;
    return true;
  };
  Inventory.prototype.addArrows = function (n) { this.arrows = M.clamp(this.arrows + n, 0, this.maxArrows); };
  Inventory.prototype.addBombs = function (n) { this.bombs = M.clamp(this.bombs + n, 0, this.maxBombs); };

  Inventory.prototype.giveTool = function (id) {
    this.tools[id] = true;
    var d = LZ.Items.ITEMS[id];
    if (d && d.slot) {
      /* auto-assign to the first empty C slot, like the era's games did */
      for (var i = 0; i < 3; i++) {
        if (!this.slots[i]) { this.slots[i] = id; break; }
      }
    }
    if (id === 'bow' && this.maxArrows === 0) { this.maxArrows = 30; this.arrows = 30; }
    if (id === 'bombs' && this.maxBombs === 0) { this.maxBombs = 20; this.bombs = 20; }
  };
  Inventory.prototype.giveMask = function (id) {
    this.masks[id] = true;
    for (var i = 0; i < 3; i++) if (!this.slots[i]) { this.slots[i] = id; break; }
  };
  Inventory.prototype.keyCount = function (d) { return this.keys[d] || 0; };
  Inventory.prototype.addKey = function (d, n) { this.keys[d] = (this.keys[d] || 0) + (n || 1); };
  Inventory.prototype.useKey = function (d) {
    if ((this.keys[d] || 0) <= 0) return false;
    this.keys[d]--;
    return true;
  };

  Inventory.prototype.bottleCount = function () { return this.bottles.length; };
  Inventory.prototype.addBottle = function (contents) { this.bottles.push(contents || null); };
  Inventory.prototype.firstBottleWith = function (what) {
    for (var i = 0; i < this.bottles.length; i++) if (this.bottles[i] === what) return i;
    return -1;
  };
  Inventory.prototype.firstEmptyBottle = function () {
    for (var i = 0; i < this.bottles.length; i++) if (!this.bottles[i]) return i;
    return -1;
  };

  Inventory.prototype.serialize = function () {
    return JSON.parse(JSON.stringify(this, function (k, v) {
      return v === Infinity ? '__inf' : v;
    }));
  };
  Inventory.deserialize = function (data) {
    var inv = new Inventory();
    for (var k in data) {
      var v = data[k];
      inv[k] = (v === '__inf') ? Infinity : v;
    }
    /* durability of unbreakable gear round-trips as a sentinel */
    for (var i = 0; i < inv.weapons.length; i++) if (inv.weapons[i].dur === '__inf') inv.weapons[i].dur = Infinity;
    for (var j = 0; j < inv.shields.length; j++) if (inv.shields[j].dur === '__inf') inv.shields[j].dur = Infinity;
    return inv;
  };

  LZ.Inventory = Inventory;
})(LZ);
