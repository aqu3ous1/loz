/* Renders every texture to one PNG sheet so the tiles can be judged as
   pixel art, at 1:1 and at 4x, the way they will actually be seen. */
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.goto('http://127.0.0.1:8080/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GAME, null, { timeout: 30000 });
  await sleep(1500);
  const names = JSON.parse(process.env.TEX || '["grass","dirt","sand","rock","cobble","planks","plaster","thatch","shingleRed","stoneblock","bark","leaves"]');
  await page.evaluate((names) => {
    const g = window.GAME;
    document.body.innerHTML = '';
    document.body.style.cssText = 'background:#202024;margin:0;font:11px monospace;color:#ddd';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;padding:10px';
    for (const n of names) {
      const t = g.assets.tex[n] && g.assets.tex[n].tile;
      const src = t || (g.assets.rawTiles && g.assets.rawTiles[n]);
      const cell = document.createElement('div');
      if (!src) { cell.textContent = n + ' (missing)'; wrap.appendChild(cell); continue; }
      const cv = document.createElement('canvas');
      cv.width = src.w * 4; cv.height = src.h * 4;
      cv.style.cssText = 'image-rendering:pixelated;display:block';
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(src.w, src.h);
      img.data.set(src.data);
      const tmp = document.createElement('canvas');
      tmp.width = src.w; tmp.height = src.h;
      tmp.getContext('2d').putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, cv.width, cv.height);
      /* count distinct colours */
      const set = new Set();
      for (let i = 0; i < src.data.length; i += 4) {
        if (src.data[i + 3] < 8) continue;
        set.add(src.data[i] + ',' + src.data[i + 1] + ',' + src.data[i + 2]);
      }
      cell.appendChild(cv);
      const lab = document.createElement('div');
      lab.textContent = n + '  ' + src.w + 'x' + src.h + '  ' + set.size + ' col';
      cell.appendChild(lab);
      wrap.appendChild(cell);
    }
    document.body.appendChild(wrap);
  }, names);
  await sleep(400);
  fs.mkdirSync('shots', { recursive: true });
  await page.screenshot({ path: path.join('shots', 'textures.png'), fullPage: true });
  console.log('shot textures');
  await browser.close();
})();
