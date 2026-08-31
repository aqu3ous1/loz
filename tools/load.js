/* Node-side loader: concatenates the browser sources and evaluates them in
   one scope so headless smoke tests can poke at the game's data model. */
const fs = require('fs');
const path = require('path');
function load(files) {
  const src = files.map(f => fs.readFileSync(path.resolve(f), 'utf8')).join('\n;\n');
  const fn = new Function('globalThisRef', src + '\nreturn LZ;');
  return fn(global);
}
module.exports = { load };
