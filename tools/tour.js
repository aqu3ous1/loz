/* Walks the player into named areas and takes gameplay screenshots so the
   whole picture (world + characters + HUD) can be judged at once. */
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
  page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });
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
    /* kit the player out so every system is exercised */
    g.inv.addWeapon('heirloomBlade'); g.inv.addShield('woodShield');
    g.inv.giveTool('bombs'); g.inv.giveTool('bow'); g.inv.giveTool('hookshot');
    g.inv.giveTool('lantern'); g.inv.giveTool('lens'); g.inv.giveTool('boomerang');
    g.inv.giveTool('iceRod'); g.inv.giveTool('flute');
    g.inv.giveMask('hareMask');
    g.inv.maxMagic = 48; g.inv.magic = 48;
    g.inv.maxHearts = 8; g.inv.hearts = 7.5;
    g.inv.rupees = 137;
    g.inv.setFlag('worldHostile'); g.inv.setFlag('sawGenmo'); g.inv.setFlag('heardOfDeath');
    g.inv.songs.hymnOfAges = true; g.inv.songs.verseOfReturn = true;
  });
  await sleep(300);

  const stops = JSON.parse(process.env.STOPS || '[]');
  for (const st of stops) {
    await page.evaluate((st) => {
      const g = window.GAME, LZ = window.LZ;
      g.goToArea(st.area, st.entry || 'default');
      g._doAreaChange();
      if (st.pos) { g.player.pos[0] = st.pos[0]; g.player.pos[1] = st.pos[1]; g.player.pos[2] = st.pos[2]; }
      if (st.yaw !== undefined) { g.player.yaw = st.yaw; g.player.targetYaw = st.yaw; }
      g.cam.yaw = (st.camYaw === undefined ? g.player.yaw + Math.PI : st.camYaw);
      g.cam.pitch = st.pitch === undefined ? 0.26 : st.pitch;
      g.cam.snapBehind(g.player);
      g.cam.yaw = (st.camYaw === undefined ? g.player.yaw + Math.PI : st.camYaw);
      g.hud.areaTimer = 0;
    }, st);
    /* let the camera settle and animations tick */
    for (let i = 0; i < 40; i++) await sleep(25);
    await page.screenshot({ path: path.join(SHOTS, 'tour-' + st.name + '.png') });
    console.log('tour', st.name);
  }
  await browser.close();
  console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 10).join('\n') : 'no errors');
})();
