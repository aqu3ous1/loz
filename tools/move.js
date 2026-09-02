/* Asserts that each movement key sends the player the way the key says,
   for several camera angles. A sign error in the stick-to-world basis is
   invisible in a screenshot and obvious the moment you hold a key. */
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
  await page.evaluate(() => {
    const g = window.GAME;
    g.cutscene.skip(); g.dialogue.close();
    g.goToArea('yeld', 'default'); g._doAreaChange();
  });
  await sleep(900);

  const out = [];
  /* camYaw 0 looks down -z, so screen-right is +x; at PI it is -x */
  for (const [label, camYaw, ex] of [
    ['cam 0  ', 0, { KeyD: '+x', KeyA: '-x', KeyW: '-z', KeyS: '+z' }],
    ['cam PI ', Math.PI, { KeyD: '-x', KeyA: '+x', KeyW: '+z', KeyS: '-z' }],
    ['cam PI2', Math.PI / 2, { KeyD: '-z', KeyA: '+z', KeyW: '-x', KeyS: '+x' }]
  ]) {
    for (const key of ['KeyD', 'KeyA', 'KeyW', 'KeyS']) {
      await page.evaluate((cy) => {
        const g = window.GAME;
        g.player.pos[0] = 0; g.player.pos[2] = 0;
        g.player.pos[1] = g.world.groundHeight(0, 0);
        g.cam.yaw = cy; g.cam._build();
        g.__lockCam = cy;
        if (!g.__camPinned) {
          const step = g.step.bind(g);
          g.step = function (dt) { step(dt); if (g.__lockCam !== undefined) { g.cam.yaw = g.__lockCam; g.cam._build(); } };
          g.__camPinned = true;
        }
      }, camYaw);
      await sleep(200);
      await page.keyboard.down(key);
      await sleep(900);
      await page.keyboard.up(key);
      const d = await page.evaluate(() => ({ x: window.GAME.player.pos[0], z: window.GAME.player.pos[2] }));
      const moved = Math.abs(d.x) > Math.abs(d.z)
        ? (d.x > 0 ? '+x' : '-x') : (d.z > 0 ? '+z' : '-z');
      const dist = Math.sqrt(d.x * d.x + d.z * d.z);
      const ok = moved === ex[key] && dist > 0.4;
      out.push(`${label} ${key}: moved ${moved} (${dist.toFixed(2)}) expect ${ex[key]} ${ok ? 'OK' : 'FAIL'}`);
    }
  }
  console.log(out.join('\n'));
  console.log(out.some(l => l.includes('FAIL')) ? 'MOVEMENT FAIL' : 'movement ok');
  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 3).join(' | ') : 'no errors');
  await b.close();
})();
