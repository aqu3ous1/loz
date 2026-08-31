/* Poses the player (and any named rig) in front of a fixed camera so the
   character art can actually be reviewed. */
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SHOTS = path.resolve('shots');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8080/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GAME, null, { timeout: 30000 });
  await sleep(1200);
  await page.click('#bootbtn').catch(() => {});
  await sleep(600);
  await page.keyboard.press('Enter'); await sleep(400);
  await page.keyboard.press('Enter'); await sleep(2500);
  /* skip the prologue */
  await page.evaluate(() => { window.GAME.cutscene.skip(); window.GAME.dialogue.close(); });
  await sleep(400);

  const rigs = JSON.parse(process.env.RIGS || '["player"]');
  for (const spec of rigs) {
    /* pin every shot to one known, flat, empty area so the framing is
       reproducible run to run */
    await page.evaluate((area) => {
      window.GAME.goToArea(area, 'default');
    }, spec.area || 'farrow');
    await sleep(900);
    await page.evaluate((spec) => {
      const g = window.GAME, LZ = window.LZ;
      g.hud.visible = false;
      g.dialogue.active = false;
      /* clear the room so nothing occludes the model */
      g.world.actors = g.world.actors.filter(a => a === g.player);
      g.world.staticMeshes = [];
      var pp = spec.playerAt || [0, 0, 0];
      g.player.pos[0] = pp[0]; g.player.pos[1] = pp[1]; g.player.pos[2] = pp[2];
      g.player.yaw = spec.yaw === undefined ? 0 : spec.yaw;
      g.player.targetYaw = g.player.yaw;
      if (spec.clip) g.player.play(spec.clip, { restart: true, blend: 0 });
      if (spec.weapon) { g.inv.weapons = [{ id: spec.weapon, dur: 99 }]; g.inv.equippedWeapon = 0; }
      if (spec.shield) { g.inv.shields = [{ id: spec.shield, dur: 99 }]; g.inv.equippedShield = 0; }
      if (spec.spawn) {
        const a = LZ.Enemies.make(g, spec.spawn, { x: 1.6, y: 0, z: 0 });
        if (a) { a.yaw = -0.6; a.aggro = false; g.world.addActor(a); }
      }
      if (spec.boss) {
        const b = LZ.Bosses.make(g, spec.boss, { x: 2.4, y: 0, z: 0 });
        if (b) {
          b.introDone = true;
          b.yaw = spec.byaw === undefined ? -0.7 : spec.byaw;
          g.world.addActor(b);
          /* freeze the AI: several bosses hover, teleport or dive, which
             moves them out of frame between setup and capture */
          b.brain = function () {};
          b.think = function () {};
          b.gravity = 0;
          g.__poseBoss = b;
          g.__poseClip = spec.bclip || null;
          g.__poseAt = [b.pos[0], spec.by !== undefined ? spec.by : (b.hoverY === undefined ? b.pos[1] : b.hoverY), b.pos[2]];
          g.__poseYaw = b.yaw;
        }
      }
      g.cam.mode = 'fixed';
      if (spec.lit !== false) {
        g.world.light = {
          ambient: [0.52, 0.53, 0.60],
          dir0: [0.40, 0.80, 0.45], col0: [0.85, 0.82, 0.76],
          dir1: [-0.50, 0.20, -0.60], col1: [0.28, 0.30, 0.40]
        };
        g.world.fog = { color: [0.10, 0.10, 0.13], near: 40, far: 120, density: 1 };
      }
      g.__shotCam = spec.cam || [0, 1.15, 3.0];
      g.__shotTarget = spec.target || [0, 0.75, 0];
      const step = g.step.bind(g);
      g.step = function (dt) {
        step(dt);
        g.cam.mode = 'fixed';
        if (g.__poseBoss) {
          var pb = g.__poseBoss;
          pb.pos[0] = g.__poseAt[0]; pb.pos[1] = g.__poseAt[1]; pb.pos[2] = g.__poseAt[2];
          pb.yaw = pb.targetYaw = g.__poseYaw;
          if (g.__poseClip) pb.play(g.__poseClip, { restart: false, blend: 0.1 });
        }
        LZ.V3.set(g.cam.pos, g.__shotCam[0], g.__shotCam[1], g.__shotCam[2]);
        LZ.V3.set(g.cam.target, g.__shotTarget[0], g.__shotTarget[1], g.__shotTarget[2]);
        g.cam._build();
      };
    }, spec);
    await sleep(700);
    if (process.env.DUMP) {
      const d = await page.evaluate(() => {
        const g = window.GAME;
        const a = g.world.actors.filter(x => x !== g.player)[0];
        if (!a || !a.model) return 'no actor';
        return a.model.skel.bones.map((bo, i) => {
          const wm = a.anim.boneMatrix(bo.name);
          const mesh = a.model.meshes[i];
          return bo.name + ' mesh=' + (mesh ? (mesh.count !== undefined ? mesh.count : 'y') : 'NONE') +
            ' at ' + (wm ? [wm[12], wm[13], wm[14]].map(v => v.toFixed(2)).join(',') : '-');
        }).join('\n');
      });
      console.log('--- ' + spec.name + '\n' + d);
    }
    await page.screenshot({ path: path.join(SHOTS, 'model-' + spec.name + '.png') });
    console.log('shot', spec.name);
  }
  await browser.close();
  if (errs.length) console.log('ERRORS:', errs.slice(0, 5).join('\n'));
})();
