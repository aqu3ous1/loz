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
    await page.evaluate((spec) => {
      const g = window.GAME, LZ = window.LZ;
      g.hud.visible = false;
      g.dialogue.active = false;
      /* clear the room so nothing occludes the model */
      g.world.actors = g.world.actors.filter(a => a === g.player);
      g.world.staticMeshes = [];
      g.player.pos[0] = 0; g.player.pos[1] = 0; g.player.pos[2] = 0;
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
        if (b) { b.introDone = true; b.yaw = -0.7; g.world.addActor(b); }
      }
      g.cam.mode = 'fixed';
      g.__shotCam = spec.cam || [0, 1.15, 3.0];
      g.__shotTarget = spec.target || [0, 0.75, 0];
      const step = g.step.bind(g);
      g.step = function (dt) {
        step(dt);
        g.cam.mode = 'fixed';
        LZ.V3.set(g.cam.pos, g.__shotCam[0], g.__shotCam[1], g.__shotCam[2]);
        LZ.V3.set(g.cam.target, g.__shotTarget[0], g.__shotTarget[1], g.__shotTarget[2]);
        g.cam._build();
      };
    }, spec);
    await sleep(700);
    await page.screenshot({ path: path.join(SHOTS, 'model-' + spec.name + '.png') });
    console.log('shot', spec.name);
  }
  await browser.close();
  if (errs.length) console.log('ERRORS:', errs.slice(0, 5).join('\n'));
})();
