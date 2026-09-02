/* Drives the message box and the menu with real key presses and asserts
   they open once and close once. A UI layer that runs before the world and
   does not consume its press makes both loop forever. */
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 480, height: 360 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8080/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GAME, null, { timeout: 30000 });
  await sleep(1200);
  await page.click('#bootbtn').catch(() => {});
  await sleep(600);
  await page.keyboard.press('Enter'); await sleep(400);
  await page.keyboard.press('Enter'); await sleep(2200);
  const tap = async (k, ms) => { await page.keyboard.down(k); await sleep(70); await page.keyboard.up(k); await sleep(ms || 260); };
  await page.evaluate(() => { const g = window.GAME; g.cutscene.skip(); g.dialogue.close(); });
  await sleep(400);

  const out = [];

  /* 1. stand next to a villager, talk, then close the box */
  await page.evaluate(() => {
    const g = window.GAME;
    g.goToArea('farrow', 'default'); g._doAreaChange();
  });
  await sleep(900);
  await page.evaluate(() => {
    const g = window.GAME;
    const npc = g.world.actors.find(a => a.kind === 'npc' && a.interactable);
    window.__npc = npc.name;
    g.player.pos[0] = npc.pos[0]; g.player.pos[2] = npc.pos[2] + 1.0;
    g.player.pos[1] = g.world.groundHeight(g.player.pos[0], g.player.pos[2]);
    g.player.yaw = g.player.targetYaw = Math.PI;
  });
  await sleep(400);
  await tap('Space', 500);
  const opened = await page.evaluate(() => window.GAME.dialogue.active);
  /* mash through: a finite conversation must end */
  let closed = false;
  for (let i = 0; i < 30; i++) {
    await tap('Space', 200);
    if (!(await page.evaluate(() => window.GAME.dialogue.active))) { closed = true; break; }
  }
  out.push(`talk: opened=${opened} closed=${closed} ${opened && closed ? 'OK' : 'FAIL'}`);

  /* it must also stay closed rather than immediately reopening */
  await sleep(700);
  const stayed = await page.evaluate(() => !window.GAME.dialogue.active);
  out.push(`stays closed: ${stayed} ${stayed ? 'OK' : 'FAIL'}`);

  /* 2. the menu opens and closes on Enter */
  await tap('Enter', 450);
  const mOpen = await page.evaluate(() => window.GAME.menu.open);
  await tap('Enter', 450);
  const mClosed = await page.evaluate(() => !window.GAME.menu.open);
  out.push(`menu: opened=${mOpen} closed=${mClosed} ${mOpen && mClosed ? 'OK' : 'FAIL'}`);

  console.log(out.join('\n'));
  console.log(out.some(l => l.includes('FAIL')) ? 'UI FAIL' : 'ui ok');
  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 3).join(' | ') : 'no errors');
  await b.close();
})();
