/* =============================================================
   game/save.js -- three save slots in localStorage.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var KEY = 'zelda_descendants_save_v1';

  function Save() { }

  Save.slots = function () {
    var out = [null, null, null];
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return out;
      var data = JSON.parse(raw);
      for (var i = 0; i < 3; i++) out[i] = data[i] || null;
    } catch (e) { }
    return out;
  };

  Save.write = function (slot, payload) {
    try {
      var all = Save.slots();
      all[slot] = payload;
      window.localStorage.setItem(KEY, JSON.stringify(all));
      return true;
    } catch (e) { return false; }
  };

  Save.erase = function (slot) {
    return Save.write(slot, null);
  };

  Save.summary = function (s) {
    if (!s) return null;
    var mins = Math.floor((s.playTime || 0) / 60);
    return {
      name: s.inv.playerName || 'Rell',
      hearts: s.inv.maxHearts,
      rupees: s.inv.rupees,
      area: s.areaName || s.area,
      time: (Math.floor(mins / 60)) + ':' + String(mins % 60).padStart(2, '0'),
      progress: s.progress || 0
    };
  };

  LZ.Save = Save;
})(LZ);
