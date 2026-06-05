const fs = require('fs');
const path = require('path');
const data = JSON.parse(fs.readFileSync('brief-data/2026-06-05.json', 'utf8'));
const detail = fs.readFileSync('briefs/2026-06-05.html', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const count = (html, re) => (html.match(re) || []).length;
const stats = {
  dataSections: data.sections.length,
  dataItems: data.sections.flatMap(s => s.items).length,
  detailSections: count(detail, /<section class="section">/g),
  detailItems: count(detail, /<article class="item">/g),
  detailSources: count(detail, /<a class="item-source" href=/g),
  indexLatest: /href="briefs\/2026-06-05\.html">阅读最新一期<\/a>/.test(index),
  archiveItems: count(index, /class="archive-item"/g),
  paletteSwatches: count(index, /class="palette-swatch"/g),
  oldAiBrand: index.includes('每日 AI 行业简报') || detail.includes('The AI Industry Brief'),
  placeholders: /TODO|PLACEHOLDER|示例内容/.test(detail + index)
};
console.log(JSON.stringify(stats, null, 2));
if (stats.dataSections !== 4 || stats.dataItems !== 12 || stats.detailSections !== 4 || stats.detailItems !== 12 || stats.detailSources !== 12 || !stats.indexLatest || stats.paletteSwatches !== 7 || stats.oldAiBrand || stats.placeholders) {
  process.exit(1);
}
