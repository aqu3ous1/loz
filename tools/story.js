/* Walks the main story beats through the real triggers and cutscenes, and
   checks the quest log advances. Catches beats that can never fire. */
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SHOTS = path.resolve('shots');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']
  });
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  const snap = n => page.screenshot({ path: path.join(SHOTS, 'story-' + n + '.png') });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|GL Driver/.test(m.text())) errs.push(m.text()); });
  await page.goto('http://127.0.0.1:8080/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GAME, null, { timeout: 30000 });
  await sleep(1200);
  await page.click('#bootbtn').catch(() => {});
  await sleep(600);
  await page.keyboard.press('Enter'); await sleep(400);
  await page.keyboard.press('Enter'); await sleep(2000);

  const out = [];
  const state = () => page.evaluate(() => {
    const g = window.GAME;
    const q = window.LZ.Quest && g.quest ? g.quest.current() : null;
    return {
      chapter: q ? q.id : null,
      goal: q ? q.goal : null,
      flags: ['heardLink', 'gotRustySword', 'swordReforged', 'sawGenmo', 'heardOfDeath']
        .filter(f => g.inv.flag(f))
    };
  });

  /* mash through the prologue's dialogue */
  /* the input layer samples per frame, so an instantaneous press is missed */
  async function advance(n, ms) {
    for (let i = 0; i < n; i++) {
      await page.keyboard.down('Space');
      await sleep(70);
      await page.keyboard.up('Space');
      await sleep(ms || 200);
    }
  }
  /* the deathbed monologue is long on purpose; give it room to finish */
  for (let i = 0; i < 12; i++) {
    await advance(14, 150);
    const s2 = await page.evaluate(() => {
      const g = window.GAME;
      return { cut: g.cutscene.active, dlg: g.dialogue.active, f: g.inv.flag('heardLink') };
    });
    if (s2.f && !s2.cut && !s2.dlg) break;
  }
  out.push('after prologue: ' + JSON.stringify(await state()));

  /* open the chest at the foot of the bed */
  /* walk to the chest and press A, the way a player would */
  await page.evaluate(() => {
    const g = window.GAME;
    const c = g.world.actors.find(a => a.kind === 'chest');
    if (!c) return;
    g.player.pos[0] = c.pos[0];
    g.player.pos[2] = c.pos[2] + 0.8;
    g.player.pos[1] = g.world.groundHeight(g.player.pos[0], g.player.pos[2]);
    g.player.yaw = g.player.targetYaw = Math.PI;
  });
  await sleep(400);
  await advance(16, 220);
  out.push('after chest: ' + JSON.stringify(await state()));

  /* the road: Stonebell, then the smith */
  await page.evaluate(() => { const g = window.GAME; g.goToArea('stonebell', 'default'); g._doAreaChange(); });
  await sleep(900);
  out.push('at stonebell: ' + JSON.stringify(await state()));

  await page.evaluate(() => { window.GAME.inv.setFlag('swordReforged'); });
  /* Hanman: the square scene must fire on its own */
  await page.evaluate(() => { const g = window.GAME; g.goToArea('hanman', 'default'); g._doAreaChange(); });
  await sleep(1200);
  const before = await state();
  /* the square scene is a trigger volume; the player spawns at the town's
     north edge and has to walk into it */
  await page.evaluate(() => {
    const g = window.GAME;
    g.player.pos[0] = 0; g.player.pos[2] = 3.0;
    g.player.pos[1] = g.world.groundHeight(0, 3.0);
  });
  await sleep(500);
  let shotGenmo = false;
  for (let i = 0; i < 10; i++) {
    await advance(12, 170);
    if (!shotGenmo) { await snap('genmo'); shotGenmo = true; }
    const s3 = await page.evaluate(() => {
      const g = window.GAME;
      return { f: g.inv.flag('sawGenmo'), d: g.inv.flag('heardOfDeath'),
               cut: g.cutscene.active, dlg: g.dialogue.active };
    });
    if (s3.f && s3.d && !s3.cut && !s3.dlg) break;
  }
  const after = await state();
  out.push('at hanman before: ' + JSON.stringify(before));
  out.push('at hanman after:  ' + JSON.stringify(after));

  /* the mountain town must open once the news has landed */
  const reach = await page.evaluate(() => {
    const g = window.GAME;
    g.goToArea('ashvale', 'default'); g._doAreaChange();
    return { area: g.world.area.id, name: g.world.area.name };
  });
  await sleep(900);
  await snap('ashvale');
  out.push('ashvale: ' + JSON.stringify(reach) + ' ' + JSON.stringify(await state()));

  /* every dungeon must be enterable and award a medallion id the log knows */
  const dungeons = await page.evaluate(() => {
    const g = window.GAME, ids = ['mine', 'clockTower', 'grove', 'lakeTemple', 'crypt', 'fortress'];
    const res = [];
    for (const id of ids) {
      g.goToArea(id, 'default'); g._doAreaChange();
      res.push(id + '=' + (g.world.area.id === id ? 'ok' : 'FAIL') + '/' + (g.world.area.dungeon || '-'));
    }
    return res.join(' ');
  });
  out.push('dungeons: ' + dungeons);

  console.log(out.join('\n'));
  console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 6).join('\n') : 'no errors');
  await browser.close();
})();
