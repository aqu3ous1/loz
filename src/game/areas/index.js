/* =============================================================
   game/areas/index.js -- the area registry.
   Content files call LZ.Areas.register(); everything else looks up
   areas by id.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var REG = {};
  LZ.Areas = {
    register: function (a) {
      if (!a.id) throw new Error('area needs an id');
      REG[a.id] = a;
      return a;
    },
    get: function (id) { return REG[id] || null; },
    all: function () { return REG; },
    ids: function () { return Object.keys(REG); }
  };
})(LZ);
