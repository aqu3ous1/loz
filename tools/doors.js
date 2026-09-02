/* Walks every area, finds every door and every transition volume, and
   checks each one names an area that exists -- then loads that area and
   checks it has a way back. A door that leads nowhere is invisible until
   someone presses A on it. */
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 400, height: 300 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|GL Driver/.test(m.text())) errs.push(m.text()); });
  await page.goto('http://127.0.0.1:8080/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GAME, null, { timeout: 30000 });
  await sleep(1200);
  await page.click('#bootbtn').catch(() => {});
  await sleep(600);
  await page.keyboard.press('Enter'); await sleep(400);
  await page.keyboard.press('Enter'); await sleep(2200);
  await page.evaluate(() => { const g = window.GAME; g.cutscene.skip(); g.dialogue.close(); });
  await sleep(400);

  const report = await page.evaluate(() => {
    const g = window.GAME, LZ = window.LZ;
    const ids = LZ.Areas.ids ? LZ.Areas.ids() : Object.keys(LZ.Areas.all || {});
    const problems = [];
    const seen = {};
    let doors = 0, exits = 0;
    /* give the player everything, so conditional doors still register */
    for (const k of ['mine', 'clock', 'grove', 'lake', 'hollow', 'fortress']) g.inv.medallions[k] = true;
    g.inv.setFlag('sawGenmo'); g.inv.setFlag('heardOfDeath'); g.inv.setFlag('gotRustySword');
    for (const id of ids) {
      let area;
      try { area = LZ.Areas.get(id); } catch (e) { problems.push(id + ': area threw ' + e.message); continue; }
      if (!area) { problems.push(id + ': missing'); continue; }
      g.goToArea(id, 'default');
      try { g._doAreaChange(); } catch (e) { problems.push(id + ': load threw ' + e.message); continue; }
      seen[id] = { doors: [], exits: [] };
      for (const a of g.world.actors) {
        if (a.kind !== 'door') continue;
        doors++;
        seen[id].doors.push(a.to);
        if (!LZ.Areas.get(a.to)) problems.push(id + ': door -> "' + a.to + '" does not exist');
      }
      for (const t of g.world.transitions) {
        if (!t.to) continue;
        exits++;
        seen[id].exits.push(t.to);
        if (!LZ.Areas.get(t.to)) problems.push(id + ': exit -> "' + t.to + '" does not exist');
      }
      /* an interior with no way out is a trap */
      if (area.quiet && id !== 'title' && !seen[id].exits.length && !seen[id].doors.length) {
        problems.push(id + ': interior has no exit');
      }
    }
    /* every door target must lead back to the area it came from */
    for (const from in seen) {
      for (const to of seen[from].doors) {
        const t = seen[to];
        if (!t) continue;
        const back = t.exits.concat(t.doors);
        if (back.indexOf(from) < 0) problems.push(from + ' -> ' + to + ': no way back');
      }
    }
    return { areas: ids.length, doors, exits, problems };
  });
  console.log('areas=' + report.areas + ' doors=' + report.doors + ' exits=' + report.exits);

  /* Actually walk through one: stand at a village door, press the action
     key, and check we end up inside and can walk back out. A door that
     resolves on paper can still be unreachable behind its own wall. */
  const tap = async (k, ms) => { await page.keyboard.down(k); await sleep(70); await page.keyboard.up(k); await sleep(ms || 260); };
  await page.evaluate(() => {
    const g = window.GAME;
    g.goToArea('farrow', 'default'); g._doAreaChange();
  });
  await sleep(900);
  const target = await page.evaluate(() => {
    const g = window.GAME;
    const d = g.world.actors.find(a => a.kind === 'door' && a.to && a.to.indexOf('Home') > 0);
    if (!d) return null;
    /* stand back from the door along the way it faces, looking at it --
       the interaction scan needs the player pointed at the thing */
    var out = 0.85;
    g.player.pos[0] = d.pos[0] + Math.sin(d.yaw) * out;
    g.player.pos[2] = d.pos[2] + Math.cos(d.yaw) * out;
    g.player.pos[1] = g.world.groundHeight(g.player.pos[0], g.player.pos[2]);
    g.player.yaw = g.player.targetYaw = d.yaw + Math.PI;
    window.__door = d;
    return d.to;
  });
  await sleep(1400);
  const near = await page.evaluate(() => {
    const g = window.GAME, d = window.__door;
    return { interact: g.player.interact ? (g.player.interact.kind + '/' + (g.player.interact.to || '')) : null,
             state: g.player.state, grounded: g.player.grounded,
             dlg: g.dialogue.active, cut: g.cutscene.active,
             dist: Math.hypot(g.player.pos[0] - d.pos[0], g.player.pos[2] - d.pos[2]).toFixed(2) };
  });
  console.log('at door: ' + JSON.stringify(near));
  await tap('Space', 2400);
  const inside = await page.evaluate(() => window.GAME.world.area.id);
  /* walk back out through the exit volume */
  await page.evaluate(() => {
    const g = window.GAME;
    const t = g.world.transitions[0];
    if (!t) return;
    g.player.pos[0] = (t.x0 + t.x1) / 2;
    g.player.pos[2] = (t.z0 + t.z1) / 2 - 1.2;
    g.player.pos[1] = g.world.groundHeight(g.player.pos[0], g.player.pos[2]);
  });
  await sleep(300);
  await page.keyboard.down('KeyS'); await sleep(1100); await page.keyboard.up('KeyS');
  await sleep(1600);
  const back = await page.evaluate(() => window.GAME.world.area.id);
  const walkOk = inside === target && back === 'farrow';
  console.log('walk-through: door->' + target + ' entered=' + inside + ' returned=' + back +
    ' ' + (walkOk ? 'OK' : 'FAIL'));
  console.log(report.problems.length
    ? 'PROBLEMS (' + report.problems.length + '):\n' + report.problems.join('\n')
    : 'every door leads somewhere and every interior leads back');
  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 5).join(' | ') : 'no errors');
  if (report.problems.length || !walkOk) process.exitCode = 1;
  await b.close();
})();
