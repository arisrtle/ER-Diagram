/**
 * 把每个预览场景渲染成 HTML：node scripts/preview/build.js <输出目录> [场景名...]
 */
const fs = require('fs');
const path = require('path');
const { renderPage } = require('./wxml-preview');
const scenarios = require('./scenarios');

(async () => {
  const out = path.resolve(process.argv[2] || 'preview-out');
  const only = process.argv.slice(3);
  fs.mkdirSync(out, { recursive: true });
  for (const s of scenarios) {
    if (only.length && !only.includes(s.name)) continue;
    try {
      let html = await renderPage(s.route, s.mock, s.act);
      if (s.holding) html = html.replace('class="hold ready', 'class="hold ready holding');
      fs.writeFileSync(path.join(out, `${s.name}.html`), html);
      console.log('ok', s.name);
    } catch (e) {
      console.error('FAIL', s.name, e.stack);
      process.exitCode = 1;
    }
  }
})();
