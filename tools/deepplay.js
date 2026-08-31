/* A longer automated run: plays through the prologue, opens the chest,
   leaves the house, walks the village, fights, and reports state at each
   checkpoint. Screenshots go to shots/. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const SHOTS = path.resolve('shots');
const URL = process.env.GAME_URL || 'http://127.0.0.1:8080/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message)));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GAME, null, { timeout: 30000 });
  await sleep(1200);
  await page.click('#bootbtn').catch(() => {});
  await sleep(800);

  let shot = 10;
  const press = async (c, ms) => { await page.keyboard.down(c); await sleep(ms || 60); await page.keyboard.up(c); await sleep(50); };
  const hold = async (c, ms) => { await page.keyboard.down(c); await sleep(ms); await page.keyboard.up(c); await sleep(60); };
  const snap = async n => { await page.screenshot({ path: path.join(SHOTS, String(shot++).padStart(2,'0') + '-' + n + '.png') }); };
  const st = () => page.evaluate(() => {
    const g = window.GAME;
    return { state: g.state, area: g.world.area && g.world.area.id, cut: g.cutscene.active, dlg: g.dialogue.active,
      pos: g.player ? [+g.player.pos[0].toFixed(1), +g.player.pos[1].toFixed(1), +g.player.pos[2].toFixed(1)] : null,
      pstate: g.player && g.player.state, hearts: g.inv.hearts, weapons: g.inv.weapons.length,
      draws: g.r.drawCalls, tris: Math.round(g.r.tris), fps: Math.round(g.fps), actors: g.world.actors.length };
  });
  const jump = (area, entry) => page.evaluate(([a, e]) => { window.GAME.goToArea(a, e || 'default'); }, [area, entry]);
  const advance = async (n) => { for (let i = 0; i < n; i++) { await press('Space', 40); await sleep(150);
      const s = await st(); if (!s.cut && !s.dlg) return true; } return false; };

  console.log('== title:', JSON.stringify(await st()));
  await press('Enter'); await sleep(500);
  await press('Enter'); await sleep(2500);
  console.log('== new game:', JSON.stringify(await st()));

  const done = await advance(90);
  console.log('== prologue finished:', done, JSON.stringify(await st()));
  await snap('bedroom');

  /* walk to the chest and open it */
  await hold('KeyS', 700); await hold('KeyA', 500);
  await sleep(300);
  await snap('at-chest');
  for (let i = 0; i < 6; i++) { await press('Space', 60); await sleep(500); }
  await advance(12);
  console.log('== after chest:', JSON.stringify(await st()));
  await snap('chest-opened');

  /* leave the house */
  await hold('KeyW', 1600);
  await sleep(1600);
  console.log('== outside:', JSON.stringify(await st()));
  await snap('village');

  /* run around the village */
  await hold('KeyW', 1400); await sleep(200);
  await snap('village-run');
  await hold('KeyD', 1200);
  await press('KeyJ'); await sleep(300);
  await press('KeyJ'); await sleep(300);
  await snap('sword-swing');
  console.log('== after swings:', JSON.stringify(await st()));

  /* teleport-test each area to catch build-time crashes */
  const areas = await page.evaluate(() => Object.keys(window.LZ.Areas.all()));
  const results = [];
  for (const a of areas) {
    await jump(a, 'default');
    await sleep(750);
    const s = await st();
    results.push(a.padEnd(20) + ' actors=' + String(s.actors).padStart(3) +
                 ' draws=' + String(s.draws).padStart(3) + ' tris=' + String(s.tris).padStart(6) +
                 ' fps=' + String(s.fps).padStart(3) + (s.area === a ? '' : '   <-- DID NOT LOAD'));
  }
  console.log('\n== area sweep ==');
  results.forEach(r => console.log(r));
  await snap('last-area');

  await browser.close();
  console.log('\n== errors (' + errors.length + ') ==');
  errors.slice(0, 30).forEach(e => console.log(e));
  process.exit(errors.length ? 2 : 0);
})();
