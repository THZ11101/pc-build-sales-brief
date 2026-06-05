const fs = require('fs');
const path = require('path');

const date = process.env.BRIEF_DATE || process.argv[2];
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('Usage: BRIEF_DATE=YYYY-MM-DD node scripts/validate-brief.js');
  process.exit(1);
}

const dataPath = path.join('brief-data', `${date}.json`);
const detailPath = path.join('briefs', `${date}.html`);
const imagePath = path.join('share-images', `${date}.png`);
for (const file of [dataPath, detailPath, 'index.html', imagePath]) {
  if (!fs.existsSync(file)) {
    console.error(`Missing required file: ${file}`);
    process.exit(1);
  }
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const detail = fs.readFileSync(detailPath, 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const count = (html, re) => (html.match(re) || []).length;
const urls = data.sections.flatMap((section) => section.items || []).map((item) => item.sourceUrl);
const stats = {
  date: data.date,
  dataSections: data.sections.length,
  dataItems: data.sections.flatMap((section) => section.items || []).length,
  sourceUrls: urls.length,
  uniqueSourceUrls: new Set(urls).size,
  detailSections: count(detail, /<section class="section">/g),
  detailItems: count(detail, /<article class="item">/g),
  detailSources: count(detail, /<a class="item-source" href=/g),
  indexLatest: index.includes(`href="briefs/${date}.html">`),
  archiveItems: count(index, /class="archive-item"/g),
  paletteSwatches: count(index, /class="palette-swatch"/g),
  imageBytes: fs.statSync(imagePath).size,
  oldAiBrand: index.includes('每日 AI 行业简报') || detail.includes('The AI Industry Brief') || detail.includes('星期一研究室'),
  placeholders: /TODO|PLACEHOLDER|示例内容|YYYY-MM-DD/.test(detail + index + JSON.stringify(data)),
};
console.log(JSON.stringify(stats, null, 2));

if (
  stats.date !== date ||
  stats.dataSections !== 4 ||
  stats.dataItems !== 12 ||
  stats.sourceUrls !== 12 ||
  stats.detailSections !== 4 ||
  stats.detailItems !== 12 ||
  stats.detailSources !== 12 ||
  !stats.indexLatest ||
  stats.paletteSwatches !== 7 ||
  stats.imageBytes < 10000 ||
  stats.oldAiBrand ||
  stats.placeholders
) {
  process.exit(1);
}
