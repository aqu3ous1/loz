/* Drives real combat: spawns enemies, swings, blocks, shoots, and checks the
   damage actually lands. Catches the class of bug a screenshot never shows. */
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']
  });
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|GL Driver/.test(m.text())) errs.push(m.text()); });
  await page.goto('http://127.0.0.1:8080/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GAME, null, { timeout: 30000 });
  await sleep(1200);
  await page.click('#bootbtn').catch(() => {});
  await sleep(600);
  await page.keyboard.press('Enter'); await sleep(400);
  await page.keyboard.press('Enter'); await sleep(2500);
  await page.evaluate(() => {
    const g = window.GAME;
    g.cutscene.skip(); g.dialogue.close();
    g.inv.addWeapon('heirloomBlade'); g.inv.addShield('woodShield');
    g.inv.giveTool('bombs'); g.inv.giveTool('bow');
    g.inv.maxHearts = 10; g.inv.hearts = 10;
    g.goToArea('yeld', 'default'); g._doAreaChange();
  });
  await sleep(900);

  const results = [];
  async function trial(name, setup, act, check) {
    await page.evaluate(setup);
    await act();
    const r = await page.evaluate(check);
    results.push(name + ': ' + JSON.stringify(r));
  }

  /* 1. sword hits a chuchu standing right in front of the player */
  await trial('sword damages enemy',
    () => {
      const g = window.GAME, LZ = window.LZ;
      g.world.actors = g.world.actors.filter(a => a === g.player);
      g.player.pos[0] = 0; g.player.pos[1] = g.world.groundHeight(0, 0); g.player.pos[2] = 0;
      g.player.yaw = g.player.targetYaw = 0;
      const e = LZ.Enemies.make(g, 'chuchu', { x: 0, y: g.world.groundHeight(0, 1.1), z: 1.1 });
      e.aggro = false; e.brain = function () {};
      g.world.addActor(e);
      window.__e = e; window.__hp0 = e.hp;
    },
    async () => { for (let i = 0; i < 6; i++) { await page.keyboard.press('KeyX'); await sleep(420); } },
    () => ({ hp0: window.__hp0, hp: window.__e.hp, alive: window.__e.alive, dead: window.__e.dead })
  );

  /* 2. the enemy can hurt the player */
  await trial('enemy damages player',
    () => {
      const g = window.GAME, LZ = window.LZ;
      g.world.actors = g.world.actors.filter(a => a === g.player);
      g.inv.hearts = 10; g.player.invuln = 0;
      const e = LZ.Enemies.make(g, 'moblin', { x: 0, y: g.world.groundHeight(0, 1.4), z: 1.4 });
      g.world.addActor(e);
      window.__h0 = g.inv.hearts;
    },
    async () => { await sleep(4200); },
    () => ({ h0: window.__h0, hearts: window.GAME.inv.hearts })
  );

  /* 3. a bomb explodes and damages what is next to it */
  await trial('bomb explodes',
    () => {
      const g = window.GAME, LZ = window.LZ;
      g.world.actors = g.world.actors.filter(a => a === g.player);
      g.inv.hearts = 10;
      const e = LZ.Enemies.make(g, 'chuchu', { x: 1.2, y: g.world.groundHeight(1.2, 0), z: 0 });
      e.brain = function () {}; g.world.addActor(e);
      window.__e = e; window.__hp0 = e.hp;
      g.spawnBomb(1.2, g.world.groundHeight(1.2, 0) + 0.2, 0, g.player);
    },
    async () => { await sleep(3200); },
    () => ({ hp0: window.__hp0, hp: window.__e.hp, dead: window.__e.dead })
  );

  /* 4. a boss takes damage and its phase advances */
  await trial('boss takes damage',
    () => {
      const g = window.GAME, LZ = window.LZ;
      g.world.actors = g.world.actors.filter(a => a === g.player);
      const b = LZ.Bosses.make(g, 'emberhusk', { x: 0, y: g.world.groundHeight(0, 3), z: 3 });
      b.introDone = true; b.brain = function () {}; b.vulnerable = true;
      g.world.addActor(b);
      window.__b = b; window.__bhp0 = b.hp;
      for (let i = 0; i < 14; i++) b.hurt(2, g.player, { invuln: 0 });
    },
    async () => { await sleep(400); },
    () => ({ hp0: window.__bhp0, hp: window.__b.hp, phase: window.__b.phase, max: window.__b.maxPhase })
  );

  /* 5. picking up a rupee raises the counter */
  await trial('pickup collected',
    () => {
      const g = window.GAME;
      g.world.actors = g.world.actors.filter(a => a === g.player);
      window.__r0 = g.inv.rupees;
      g.spawnDrop(g.player.pos[0], g.player.pos[1] + 0.4, g.player.pos[2] + 0.3, 'rupeeB');
    },
    async () => { await sleep(2600); },
    () => ({ r0: window.__r0, rupees: window.GAME.inv.rupees })
  );

  console.log(results.join('\n'));
  console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 6).join('\n') : 'no errors');
  await browser.close();
})();
