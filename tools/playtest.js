/* Headless smoke test: boots the game in Chromium, drives it with real
   key events, screenshots what it sees, and reports every console error. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHOTS = path.resolve('shots');
const URL = process.env.GAME_URL || 'http://127.0.0.1:8080/index.html';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox',
           '--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

  const errors = [];
  const logs = [];
  page.on('console', m => {
    const t = m.type();
    const txt = m.text();
    logs.push(t + ': ' + txt);
    if (t === 'error' || t === 'warning') errors.push(t + ': ' + txt);
  });
  page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message)));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  /* wait for boot */
  await page.waitForFunction(() => window.GAME && window.GAME.state, null, { timeout: 30000 })
    .catch(() => {});
  await sleep(1500);

  const errBox = await page.$eval('#err', el => el.style.display === 'block' ? el.textContent : null)
    .catch(() => null);
  if (errBox) {
    console.log('=== BOOT FAILURE ===\n' + errBox);
    await page.screenshot({ path: path.join(SHOTS, 'boot-error.png') });
    await browser.close();
    process.exit(1);
  }

  await page.click('#bootbtn').catch(() => {});
  await sleep(1200);
  await page.screenshot({ path: path.join(SHOTS, '01-title.png') });

  const steps = JSON.parse(process.env.STEPS || '[]');
  let shot = 2;

  async function press(code, ms) {
    await page.keyboard.down(code);
    await sleep(ms || 60);
    await page.keyboard.up(code);
    await sleep(40);
  }
  async function hold(code, ms) {
    await page.keyboard.down(code);
    await sleep(ms);
    await page.keyboard.up(code);
  }
  async function snap(name) {
    await page.screenshot({ path: path.join(SHOTS, String(shot).padStart(2, '0') + '-' + name + '.png') });
    shot++;
  }
  async function state() {
    return await page.evaluate(() => {
      const g = window.GAME;
      if (!g) return null;
      return {
        state: g.state,
        area: g.world && g.world.area ? g.world.area.id : null,
        actors: g.world ? g.world.actors.length : 0,
        draws: g.r.drawCalls, tris: Math.round(g.r.tris),
        fps: Math.round(g.fps),
        pos: g.player ? g.player.pos[0].toFixed(1) + ',' + g.player.pos[1].toFixed(1) + ',' + g.player.pos[2].toFixed(1) : null,
        hearts: g.inv ? g.inv.hearts + '/' + g.inv.maxHearts : null,
        dialogue: g.dialogue ? g.dialogue.active : null,
        cutscene: g.cutscene ? g.cutscene.active : null,
        worldTris: g.world ? g.world.tris : 0
      };
    });
  }

  console.log('after title:', JSON.stringify(await state()));

  /* title -> file select -> new game */
  await press('Enter'); await sleep(600);
  await snap('fileselect');
  await press('Enter'); await sleep(2500);
  console.log('after new game:', JSON.stringify(await state()));
  await snap('prologue');

  /* skip through the prologue cutscene by mashing A */
  for (let i = 0; i < 60; i++) {
    await press('Space', 40);
    await sleep(120);
    const s = await state();
    if (!s.cutscene && !s.dialogue) break;
  }
  await sleep(600);
  await snap('after-prologue');
  console.log('after prologue:', JSON.stringify(await state()));

  await browser.close();

  console.log('\n=== CONSOLE ERRORS (' + errors.length + ') ===');
  errors.slice(0, 40).forEach(e => console.log(e));
  fs.writeFileSync(path.join(SHOTS, 'log.txt'), logs.join('\n'));
  process.exit(errors.length ? 2 : 0);
})();
