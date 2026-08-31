/* =============================================================
   game/music.js -- the score.

   Written as step sequences (div = steps per beat). A token is a note
   name, '.' to hold the previous note, or '-' for a rest. Drum tracks
   use k/s/h/o/c/t. All melodies here are original.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';

  function song(o) {
    o.div = o.div || 4;
    o.length = o.length || (o.tracks[0].seq.trim().split(/\s+/).length);
    if (o.loop === undefined) o.loop = true;
    return o;
  }

  var S = {};

  /* ---- Title: "The Last Instruction" ------------------------------ */
  S.title = song({
    bpm: 74,
    tracks: [
      { inst: 'harp', vol: 0.95, seq:
        'D4 .  .  .  F4 .  .  A4 .  .  G4 .  F4 .  E4 .  ' +
        'D4 .  .  .  .  .  C4 .  D4 .  .  .  .  .  .  .  ' +
        'F4 .  .  .  A4 .  .  C5 .  .  Bb4 . A4 .  G4 .  ' +
        'A4 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' },
      { inst: 'choir', vol: 0.8, seq:
        'A3 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'Bb3 . .  .  .  .  .  .  A3 .  .  .  .  .  .  .  ' +
        'C4 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'C4 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' },
      { inst: 'bass', vol: 0.9, seq:
        'D2 .  .  .  .  .  .  .  D2 .  .  .  A2 .  .  .  ' +
        'Bb1 . .  .  .  .  .  .  C2 .  .  .  .  .  .  .  ' +
        'F2 .  .  .  .  .  .  .  F2 .  .  .  C3 .  .  .  ' +
        'A1 .  .  .  .  .  .  .  A1 .  .  .  E2 .  .  .  ' },
      { inst: 'pad', vol: 0.7, seq:
        'F3 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'D3 .  .  .  .  .  .  .  E3 .  .  .  .  .  .  .  ' +
        'A3 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'E3 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' }
    ]
  });

  /* ---- Farrow Village: warm, small, a little sad ------------------ */
  S.village = song({
    bpm: 104,
    tracks: [
      { inst: 'flute', vol: 0.9, seq:
        'F4 .  A4 .  C5 .  A4 .  G4 .  F4 .  .  .  -  -  ' +
        'G4 .  Bb4 . D5 .  Bb4 . A4 .  G4 .  .  .  -  -  ' +
        'C5 .  Bb4 . A4 .  G4 .  F4 .  E4 .  F4 .  .  .  ' +
        'D4 .  F4 .  G4 .  A4 .  F4 .  .  .  .  .  .  .  ' },
      { inst: 'harp', vol: 0.55, seq:
        'F3 C4 A3 C4 F3 C4 A3 C4 Bb2 F3 D4 F3 Bb2 F3 D4 F3 ' +
        'C3 G3 E4 G3 C3 G3 E4 G3 F3 C4 A3 C4 F3 C4 A3 C4 ' +
        'Bb2 F3 D4 F3 Bb2 F3 D4 F3 C3 G3 E4 G3 C3 G3 E4 G3 ' +
        'F3 C4 A3 C4 D3 A3 F4 A3 C3 G3 E4 G3 C3 G3 E4 G3 ' },
      { inst: 'bass', vol: 0.85, seq:
        'F2 -  -  -  C2 -  -  -  Bb1 - -  -  F2 -  -  -  ' +
        'C2 -  -  -  G2 -  -  -  F2 -  -  -  C2 -  -  -  ' +
        'Bb1 - -  -  F2 -  -  -  C2 -  -  -  G2 -  -  -  ' +
        'F2 -  -  -  D2 -  -  -  C2 -  -  -  C2 -  -  -  ' }
    ]
  });

  /* ---- Hyrule Field: a march for a boy who is not a hero yet ------ */
  S.field = song({
    bpm: 138,
    tracks: [
      { inst: 'brass', vol: 0.85, seq:
        'G4 .  -  G4 .  -  B4 .  D5 .  .  .  B4 .  G4 .  ' +
        'A4 .  -  A4 .  -  C5 .  E5 .  .  .  C5 .  A4 .  ' +
        'B4 .  -  D5 .  -  G5 .  .  .  F#5 . D5 .  B4 .  ' +
        'C5 .  B4 .  A4 .  G4 .  .  .  .  .  D4 .  .  .  ' },
      { inst: 'organ', vol: 0.5, seq:
        'G3 .  .  .  .  .  .  .  D3 .  .  .  .  .  .  .  ' +
        'A3 .  .  .  .  .  .  .  E3 .  .  .  .  .  .  .  ' +
        'B3 .  .  .  .  .  .  .  G3 .  .  .  .  .  .  .  ' +
        'C4 .  .  .  .  .  .  .  D4 .  .  .  .  .  .  .  ' },
      { inst: 'bass', vol: 0.95, seq:
        'G2 -  G2 -  D2 -  G2 -  G2 -  G2 -  D2 -  D2 -  ' +
        'A2 -  A2 -  E2 -  A2 -  A2 -  A2 -  E2 -  E2 -  ' +
        'B2 -  B2 -  G2 -  B2 -  G2 -  G2 -  D3 -  D3 -  ' +
        'C3 -  C3 -  G2 -  G2 -  D3 -  D3 -  G2 -  -  -  ' },
      { inst: 'drum', vol: 0.85, seq:
        'k -  h -  s -  h -  k -  h k  s -  h -  ' +
        'k -  h -  s -  h -  k -  h k  s -  h h  ' +
        'k -  h -  s -  h -  k -  h k  s -  h -  ' +
        'k -  h -  s -  h -  k k  s -  c -  -  -  ' }
    ]
  });

  /* ---- Stonebell Town: jaunty market ----------------------------- */
  S.town = song({
    bpm: 120,
    tracks: [
      { inst: 'pluck', vol: 0.9, seq:
        'C5 -  E5 -  G5 -  E5 -  F5 -  E5 -  D5 -  C5 -  ' +
        'D5 -  F5 -  A5 -  F5 -  G5 -  F5 -  E5 -  D5 -  ' +
        'E5 -  G5 -  C6 -  G5 -  A5 -  G5 -  F5 -  E5 -  ' +
        'D5 -  C5 -  B4 -  C5 -  D5 -  E5 -  C5 -  -  -  ' },
      { inst: 'organ', vol: 0.42, seq:
        'C4 .  .  .  E4 .  .  .  F4 .  .  .  G4 .  .  .  ' +
        'D4 .  .  .  F4 .  .  .  G4 .  .  .  A4 .  .  .  ' +
        'E4 .  .  .  G4 .  .  .  A4 .  .  .  B4 .  .  .  ' +
        'G4 .  .  .  F4 .  .  .  E4 .  .  .  C4 .  .  .  ' },
      { inst: 'bass', vol: 0.9, seq:
        'C3 -  -  G2 C3 -  -  -  F2 -  -  C3 F2 -  -  -  ' +
        'D3 -  -  A2 D3 -  -  -  G2 -  -  D3 G2 -  -  -  ' +
        'E3 -  -  B2 E3 -  -  -  A2 -  -  E3 A2 -  -  -  ' +
        'G2 -  -  D3 G2 -  -  -  C3 -  -  G2 C3 -  -  -  ' },
      { inst: 'drum', vol: 0.55, seq:
        'k -  h -  s -  h -  k -  h -  s -  h h  ' +
        'k -  h -  s -  h -  k -  h -  s -  h h  ' +
        'k -  h -  s -  h -  k -  h -  s -  h h  ' +
        'k -  h -  s -  h -  k -  h -  s -  c -  ' }
    ]
  });

  /* ---- Hanman Town / Gerudo: phrygian dominant, hand drums ------- */
  S.desert = song({
    bpm: 126,
    tracks: [
      { inst: 'lead2', vol: 0.85, seq:
        'A4 -  Bb4 - C#5 - D5 -  C#5 - Bb4 - A4 -  .  -  ' +
        'A4 -  Bb4 - C#5 - E5 -  D5 -  C#5 - Bb4 - A4 -  ' +
        'G4 -  A4 -  Bb4 - C#5 - Bb4 - A4 -  G4 -  F4 -  ' +
        'E4 -  F4 -  G4 -  A4 -  .  .  .  .  -  -  -  -  ' },
      { inst: 'strings', vol: 0.55, seq:
        'A3 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'A3 .  .  .  .  .  .  .  Bb3 . .  .  .  .  .  .  ' +
        'C4 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'E3 .  .  .  .  .  .  .  A3 .  .  .  .  .  .  .  ' },
      { inst: 'bass', vol: 0.95, seq:
        'A1 -  -  A1 -  -  E2 -  A1 -  -  A1 -  -  E2 -  ' +
        'A1 -  -  A1 -  -  E2 -  Bb1 - -  Bb1 - -  F2 -  ' +
        'F2 -  -  F2 -  -  C2 -  F2 -  -  F2 -  -  C2 -  ' +
        'E2 -  -  E2 -  -  B1 -  A1 -  -  A1 -  -  -  -  ' },
      { inst: 'drum', vol: 0.9, seq:
        'k -  -  k -  -  s -  h -  k -  -  -  s h  ' +
        'k -  -  k -  -  s -  h -  k -  -  -  s h  ' +
        'k -  -  k -  -  s -  h -  k -  -  -  s h  ' +
        'k -  k -  s -  s -  k k  s -  c -  -  -  ' }
    ]
  });

  /* ---- Ashvale, mountain town under ash --------------------------- */
  S.mountain = song({
    bpm: 82,
    tracks: [
      { inst: 'choir', vol: 0.9, seq:
        'E4 .  .  .  .  .  D4 .  C4 .  .  .  .  .  .  .  ' +
        'B3 .  .  .  .  .  C4 .  D4 .  .  .  .  .  .  .  ' +
        'E4 .  .  .  G4 .  .  .  F4 .  E4 .  D4 .  .  .  ' +
        'C4 .  .  .  .  .  B3 .  A3 .  .  .  .  .  .  .  ' },
      { inst: 'strings', vol: 0.6, seq:
        'A3 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'G3 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'C4 .  .  .  .  .  .  .  B3 .  .  .  .  .  .  .  ' +
        'A3 .  .  .  .  .  .  .  E3 .  .  .  .  .  .  .  ' },
      { inst: 'bass', vol: 0.85, seq:
        'A1 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'G1 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'C2 .  .  .  .  .  .  .  G1 .  .  .  .  .  .  .  ' +
        'A1 .  .  .  .  .  .  .  E2 .  .  .  .  .  .  .  ' },
      { inst: 'drum', vol: 0.4, seq:
        't -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  ' +
        '-  -  -  -  -  -  -  -  t -  -  -  -  -  -  -  ' +
        't -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  ' +
        '-  -  -  -  -  -  -  -  t -  -  -  -  -  -  -  ' }
    ]
  });

  /* ---- Generic dungeon: sparse, wrong-sounding intervals ---------- */
  S.dungeon = song({
    bpm: 88,
    tracks: [
      { inst: 'pad', vol: 0.85, seq:
        'D3 .  .  .  .  .  .  .  .  .  .  .  Eb3 . .  .  ' +
        '.  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'D3 .  .  .  .  .  .  .  .  .  .  .  Ab3 . .  .  ' +
        '.  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' },
      { inst: 'bell', vol: 0.55, seq:
        '-  -  -  -  -  -  -  -  Bb4 - -  -  -  -  -  -  ' +
        '-  -  -  -  Eb5 - -  -  -  -  -  -  -  -  -  -  ' +
        '-  -  -  -  -  -  -  -  -  -  -  -  Ab4 - -  -  ' +
        '-  -  -  -  D5 -  -  -  -  -  -  -  -  -  -  -  ' },
      { inst: 'bass', vol: 0.8, seq:
        'D1 .  .  .  .  .  .  .  -  -  -  -  -  -  -  -  ' +
        '-  -  -  -  -  -  -  -  Eb1 . .  .  -  -  -  -  ' +
        'D1 .  .  .  .  .  .  .  -  -  -  -  -  -  -  -  ' +
        'Ab1 . .  .  -  -  -  -  -  -  -  -  -  -  -  -  ' },
      { inst: 'drum', vol: 0.5, seq:
        '-  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  ' +
        '-  -  -  -  -  -  -  -  -  -  -  -  -  -  -  t3 ' +
        '-  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  ' +
        'k4 -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  ' }
    ]
  });

  /* ---- Forest: mysterious woodwind round ------------------------- */
  S.forest = song({
    bpm: 96,
    tracks: [
      { inst: 'flute', vol: 0.85, seq:
        'E4 -  G4 -  A4 -  B4 -  A4 -  G4 -  E4 -  -  -  ' +
        'D4 -  E4 -  G4 -  A4 -  G4 -  E4 -  D4 -  -  -  ' +
        'B4 -  A4 -  G4 -  E4 -  G4 -  A4 -  B4 -  -  -  ' +
        'D5 -  B4 -  A4 -  G4 -  E4 -  -  -  -  -  -  -  ' },
      { inst: 'harp', vol: 0.5, seq:
        '-  -  -  -  E3 -  B3 -  -  -  -  -  E3 -  B3 -  ' +
        '-  -  -  -  D3 -  A3 -  -  -  -  -  D3 -  A3 -  ' +
        '-  -  -  -  G3 -  D4 -  -  -  -  -  G3 -  D4 -  ' +
        '-  -  -  -  E3 -  B3 -  -  -  -  -  E3 -  B3 -  ' },
      { inst: 'bass', vol: 0.8, seq:
        'E2 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'D2 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'G2 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'E2 .  .  .  .  .  .  .  B1 .  .  .  .  .  .  .  ' }
    ]
  });

  /* ---- Lake: still water ----------------------------------------- */
  S.lake = song({
    bpm: 72,
    tracks: [
      { inst: 'bell', vol: 0.8, seq:
        'C5 -  -  -  E5 -  -  -  G5 -  -  -  E5 -  -  -  ' +
        'D5 -  -  -  F5 -  -  -  A5 -  -  -  F5 -  -  -  ' +
        'E5 -  -  -  G5 -  -  -  B5 -  -  -  G5 -  -  -  ' +
        'D5 -  -  -  C5 -  -  -  G4 -  -  -  -  -  -  -  ' },
      { inst: 'pad', vol: 0.85, seq:
        'C4 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'D4 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'E4 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'G3 .  .  .  .  .  .  .  C4 .  .  .  .  .  .  .  ' },
      { inst: 'bass', vol: 0.7, seq:
        'C2 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'Bb1 . .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'A1 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'G1 .  .  .  .  .  .  .  C2 .  .  .  .  .  .  .  ' }
    ]
  });

  /* ---- Graveyard / shadow ---------------------------------------- */
  S.shadow = song({
    bpm: 66,
    tracks: [
      { inst: 'choir', vol: 0.9, seq:
        'C4 .  .  .  .  .  .  .  Db4 . .  .  .  .  .  .  ' +
        'C4 .  .  .  .  .  .  .  G3 .  .  .  .  .  .  .  ' +
        'Ab3 . .  .  .  .  .  .  Bb3 . .  .  .  .  .  .  ' +
        'C4 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' },
      { inst: 'organ', vol: 0.35, seq:
        'F2 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'E2 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'Ab2 . .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'F2 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' },
      { inst: 'bass', vol: 0.85, seq:
        'F1 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'E1 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'Ab1 . .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'F1 .  .  .  .  .  .  .  C2 .  .  .  .  .  .  .  ' }
    ]
  });

  /* ---- Boss ------------------------------------------------------- */
  S.boss = song({
    bpm: 152,
    tracks: [
      { inst: 'brass', vol: 0.85, seq:
        'D4 -  D4 -  F4 -  D4 -  G4 -  F4 -  D4 -  C4 -  ' +
        'D4 -  D4 -  F4 -  D4 -  A4 -  G4 -  F4 -  D4 -  ' +
        'Bb4 - A4 -  G4 -  F4 -  E4 -  D4 -  C4 -  Bb3 - ' +
        'A3 -  C4 -  D4 -  F4 -  A4 -  .  -  -  -  -  -  ' },
      { inst: 'bassy', vol: 0.95, seq:
        'D1 D1 -  D1 -  D1 D1 -  D1 D1 -  D1 -  D1 D1 -  ' +
        'D1 D1 -  D1 -  D1 D1 -  D1 D1 -  D1 -  D1 D1 -  ' +
        'Bb0 Bb0 - Bb0 - Bb0 Bb0 - C1 C1 -  C1 -  C1 C1 - ' +
        'D1 D1 -  D1 -  D1 D1 -  D1 D1 -  D1 D1 D1 D1 D1 ' },
      { inst: 'organ', vol: 0.4, seq:
        'A3 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'A3 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'F3 .  .  .  .  .  .  .  G3 .  .  .  .  .  .  .  ' +
        'A3 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' },
      { inst: 'drum', vol: 1.0, seq:
        'k -  k h  s -  k -  k -  k h  s -  s h  ' +
        'k -  k h  s -  k -  k -  k h  s -  s h  ' +
        'k -  k h  s -  k -  k -  k h  s -  s h  ' +
        'k k  s s  k k  s s  k -  s -  c -  -  -  ' }
    ]
  });

  /* ---- Genmo's theme: the descendant of Ganon --------------------- */
  S.genmo = song({
    bpm: 100,
    tracks: [
      { inst: 'organ', vol: 0.9, seq:
        'Eb3 . .  .  .  .  D3 .  Eb3 . .  .  .  .  .  .  ' +
        'F3 .  .  .  .  .  Gb3 . F3 .  .  .  E3 .  .  .  ' +
        'Eb3 . .  .  .  .  D3 .  C3 .  .  .  .  .  .  .  ' +
        'Bb2 . .  .  B2 .  .  .  C3 .  .  .  .  .  .  .  ' },
      { inst: 'choir', vol: 0.65, seq:
        'Bb3 . .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        'C4 .  .  .  .  .  .  .  Bb3 . .  .  .  .  .  .  ' +
        'Ab3 . .  .  .  .  .  .  G3 .  .  .  .  .  .  .  ' +
        'Gb3 . .  .  .  .  .  .  G3 .  .  .  .  .  .  .  ' },
      { inst: 'bass', vol: 1.0, seq:
        'Eb1 -  -  Eb1 -  -  Bb1 -  Eb1 -  -  Eb1 -  -  -  -  ' +
        'F1 -  -  F1 -  -  C2 -  F1 -  -  F1 -  -  -  -  ' +
        'Eb1 -  -  Eb1 -  -  Bb1 -  C1 -  -  C1 -  -  -  -  ' +
        'Bb0 -  -  Bb0 -  -  -  -  C1 -  -  C1 -  -  -  -  ' },
      { inst: 'drum', vol: 0.8, seq:
        'k -  -  -  -  -  t -  k -  -  -  s -  -  -  ' +
        'k -  -  -  -  -  t -  k -  -  -  s -  -  h  ' +
        'k -  -  -  -  -  t -  k -  -  -  s -  -  -  ' +
        'k -  k -  -  -  t -  k k  s -  c -  -  -  ' }
    ]
  });

  /* ---- Shop ------------------------------------------------------- */
  S.shop = song({
    bpm: 112,
    tracks: [
      { inst: 'pluck', vol: 0.9, seq:
        'G4 -  B4 -  D5 -  B4 -  C5 -  E5 -  C5 -  G4 -  ' +
        'A4 -  C5 -  E5 -  C5 -  D5 -  B4 -  G4 -  -  -  ' },
      { inst: 'bass', vol: 0.85, seq:
        'G2 -  -  D2 G2 -  -  -  C3 -  -  G2 C3 -  -  -  ' +
        'A2 -  -  E2 A2 -  -  -  D3 -  -  A2 G2 -  -  -  ' }
    ]
  });

  /* ---- Cave / interior ambience ----------------------------------- */
  S.cave = song({
    bpm: 60,
    tracks: [
      { inst: 'pad', vol: 0.8, seq:
        'A2 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' +
        '.  .  .  .  .  .  .  .  E3 .  .  .  .  .  .  .  ' },
      { inst: 'bell', vol: 0.35, seq:
        '-  -  -  -  -  -  -  -  -  -  -  -  A4 -  -  -  ' +
        '-  -  -  -  -  -  E5 -  -  -  -  -  -  -  -  -  ' }
    ]
  });

  /* ---- Game over (non-looping) ------------------------------------ */
  S.gameover = song({
    bpm: 68, loop: false,
    tracks: [
      { inst: 'brass', vol: 0.9, seq:
        'D4 .  .  .  C4 .  .  .  Bb3 . .  .  A3 .  .  .  ' +
        'D3 .  .  .  .  .  .  .  .  .  .  .  -  -  -  -  ' },
      { inst: 'bass', vol: 0.9, seq:
        'D2 .  .  .  C2 .  .  .  Bb1 . .  .  A1 .  .  .  ' +
        'D1 .  .  .  .  .  .  .  .  .  .  .  -  -  -  -  ' }
    ]
  });

  /* ---- Ending: the title theme, finally in major ------------------ */
  S.ending = song({
    bpm: 80,
    tracks: [
      { inst: 'flute', vol: 0.95, seq:
        'D4 .  .  .  F#4 . .  A4 .  .  G4 .  F#4 . E4 .  ' +
        'D4 .  .  .  .  .  E4 .  D4 .  .  .  .  .  .  .  ' +
        'F#4 . .  .  A4 .  .  D5 .  .  C#5 . B4 .  A4 .  ' +
        'D5 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' },
      { inst: 'harp', vol: 0.6, seq:
        'D3 A3 F#4 A3 D3 A3 F#4 A3 G2 D3 B3 D3 G2 D3 B3 D3 ' +
        'A2 E3 C#4 E3 A2 E3 C#4 E3 D3 A3 F#4 A3 D3 A3 F#4 A3 ' +
        'G2 D3 B3 D3 G2 D3 B3 D3 A2 E3 C#4 E3 A2 E3 C#4 E3 ' +
        'D3 A3 F#4 A3 D3 A3 F#4 A3 D3 A3 F#4 A3 D3 A3 F#4 A3 ' },
      { inst: 'choir', vol: 0.7, seq:
        'A3 .  .  .  .  .  .  .  B3 .  .  .  .  .  .  .  ' +
        'C#4 . .  .  .  .  .  .  D4 .  .  .  .  .  .  .  ' +
        'B3 .  .  .  .  .  .  .  A3 .  .  .  .  .  .  .  ' +
        'D4 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ' },
      { inst: 'bass', vol: 0.9, seq:
        'D2 .  .  .  .  .  .  .  G1 .  .  .  .  .  .  .  ' +
        'A1 .  .  .  .  .  .  .  D2 .  .  .  .  .  .  .  ' +
        'G1 .  .  .  .  .  .  .  A1 .  .  .  .  .  .  .  ' +
        'D2 .  .  .  .  .  .  .  A2 .  .  .  .  .  .  .  ' }
    ]
  });

  LZ.Music = S;
})(LZ);
