const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'brief-data');
const OUT_DIR = path.join(ROOT, 'share-images');
const WIDTH = 1480;
const MARGIN = 58;
const PAPER_X = 58;
const PAPER_W = WIDTH - PAPER_X * 2;
const CONTENT_X = 128;
const CONTENT_W = WIDTH - CONTENT_X * 2;
const GAP = 46;
const COL_W = Math.floor((CONTENT_W - GAP) / 2);
const PALETTE = {
  '星期一': { primary: '#927BBE', light: '#F4EFFA', short: 'MON' },
  '星期二': { primary: '#6F97A8', light: '#EEF4F7', short: 'TUE' },
  '星期三': { primary: '#7FA6C9', light: '#EEF4FB', short: 'WED' },
  '星期四': { primary: '#7FA68B', light: '#EFF5F0', short: 'THU' },
  '星期五': { primary: '#6F9F99', light: '#EEF6F3', short: 'FRI' },
  '星期六': { primary: '#8A93B7', light: '#F0F1F8', short: 'SAT' },
  '星期日': { primary: '#EC9BC8', light: '#FDF0F7', short: 'SUN' },
};
const MARKS = ['◆', '◇', '◈'];

function fail(message) { console.error(message); process.exit(1); }
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function parseArgs() {
  const args = process.argv.slice(2);
  const out = { date: process.env.BRIEF_DATE || new Date().toISOString().slice(0, 10) };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--date') out.date = args[++i];
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.date)) fail(`Invalid date: ${out.date}`);
  return out;
}
function md(date) { return `${date.slice(5, 7)}/${date.slice(8, 10)}`; }
function readData(date) {
  const file = path.join(DATA_DIR, `${date}.json`);
  if (!fs.existsSync(file)) fail(`Missing data file: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function textUnits(text) {
  return [...String(text ?? '')].reduce((sum, ch) => sum + (/^[\x00-\x7F]$/.test(ch) ? 0.56 : 1), 0);
}
function wrapText(text, maxUnits) {
  const source = String(text ?? '').replace(/\s+/g, ' ').trim();
  const lines = [];
  let line = '';
  let units = 0;
  for (const ch of [...source]) {
    const u = /^[\x00-\x7F]$/.test(ch) ? 0.56 : 1;
    if (units + u > maxUnits && line) {
      lines.push(line.trim());
      line = ch;
      units = u;
    } else {
      line += ch;
      units += u;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}
function textBlock(lines, x, y, opts) {
  const { size, lineHeight, fill, weight = 400, family = 'Noto Sans CJK SC, Microsoft YaHei, Arial, sans-serif' } = opts;
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}">${lines.map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`).join('')}</text>`;
}
function singleLine(text, x, y, opts) {
  return textBlock([text], x, y, opts);
}
function itemHeight(item) {
  const titleLines = wrapText(item.title, 24).length;
  const descLines = wrapText(item.description, 32).length;
  const sourceLines = wrapText(`→ ${item.sourceName}  ${item.sourceDateLabel}`, 40).length;
  return 34 + titleLines * 30 + 18 + descLines * 26 + 22 + sourceLines * 18 + 28;
}
function drawItem(item, mark, x, y, w, h, colors) {
  const titleLines = wrapText(item.title, 24);
  const descLines = wrapText(item.description, 32);
  const sourceLines = wrapText(`→ ${item.sourceName}  ${item.sourceDateLabel}`, 40);
  const titleY = y + 42;
  const descY = titleY + titleLines.length * 30 + 20;
  const sourceY = y + h - sourceLines.length * 18 - 13;
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fffefc" stroke="rgba(17,17,17,.10)"/>
    ${singleLine(mark, x + 24, titleY, { size: 22, fill: colors.primary, weight: 800 })}
    ${textBlock(titleLines, x + 64, titleY, { size: 21, lineHeight: 30, fill: '#121212', weight: 800 })}
    ${textBlock(descLines, x + 28, descY, { size: 16, lineHeight: 26, fill: '#2e3330', weight: 400 })}
    <line x1="${x + 28}" y1="${sourceY - 18}" x2="${x + w - 28}" y2="${sourceY - 18}" stroke="rgba(17,17,17,.10)"/>
    ${textBlock(sourceLines, x + 28, sourceY, { size: 12, lineHeight: 18, fill: '#66706d', weight: 800 })}
  </g>`;
}
function sectionHeight(section) {
  return 106 + section.items.reduce((sum, item) => sum + itemHeight(item), 0) + (section.items.length - 1) * 14 + 22;
}
function drawSection(section, index, x, y, colors) {
  const h = sectionHeight(section);
  let cursor = y + 104;
  const items = section.items.map((item, i) => {
    const ih = itemHeight(item);
    const svg = drawItem(item, MARKS[i], x + 18, cursor, COL_W - 36, ih, colors);
    cursor += ih + 14;
    return svg;
  }).join('\n');
  return { h, svg: `<g>
    <rect x="${x}" y="${y}" width="${COL_W}" height="${h}" fill="${colors.card}" stroke="rgba(17,17,17,.12)"/>
    <rect x="${x + 18}" y="${y + 20}" width="54" height="36" fill="${colors.primary}"/>
    ${singleLine(String(index + 1).padStart(2, '0'), x + 32, y + 44, { size: 14, fill: '#fff', weight: 800, family: 'Arial, sans-serif' })}
    ${singleLine(section.name, x + 88, y + 47, { size: 26, fill: '#121212', weight: 800 })}
    ${singleLine(section.subtitle || '', x + 88, y + 78, { size: 11, fill: '#66706d', weight: 800, family: 'Arial, sans-serif' })}
    ${items}
  </g>` };
}
function drawSections(data, startY, colors) {
  const leftX = CONTENT_X;
  const rightX = CONTENT_X + COL_W + GAP;
  let leftY = startY;
  let rightY = startY;
  const pieces = [];
  data.sections.forEach((section, index) => {
    const useLeft = index % 2 === 0;
    const x = useLeft ? leftX : rightX;
    const y = useLeft ? leftY : rightY;
    const rendered = drawSection(section, index, x, y, colors);
    pieces.push(rendered.svg);
    if (useLeft) leftY += rendered.h + 42;
    else rightY += rendered.h + 42;
  });
  return { svg: pieces.join('\n'), bottom: Math.max(leftY, rightY) - 42 };
}
function grid(height) {
  const lines = [];
  for (let x = 98; x < 1380; x += 38) lines.push(`<line x1="${x}" y1="92" x2="${x}" y2="${height - 80}"/>`);
  for (let y = 92; y < height - 80; y += 38) lines.push(`<line x1="98" y1="${y}" x2="1380" y2="${y}"/>`);
  return `<g stroke="rgba(17,17,17,.045)" stroke-width="1">${lines.join('')}</g>`;
}
async function main() {
  const { date } = parseArgs();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const data = readData(date);
  const colors = PALETTE[data.weekday] || PALETTE['星期五'];
  colors.card = '#fbfaf7';
  const leadLines = wrapText(data.opening, 42);
  const startSectionsY = 426 + Math.max(0, leadLines.length - 2) * 30;
  const sections = drawSections(data, startSectionsY, colors);
  const insightLines = wrapText(data.insight, 40);
  const methodLines = wrapText(data.methodNote, 82);
  const insightY = sections.bottom + 96;
  const footerY = insightY + 76 + insightLines.length * 32 + methodLines.length * 18 + 58;
  const height = Math.max(1900, footerY + 100);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">
    <rect width="${WIDTH}" height="${height}" fill="#f3f1ec"/>
    <rect x="${PAPER_X}" y="36" width="${PAPER_W}" height="${height - 72}" fill="#fcfbf8"/>
    ${grid(height)}
    <line x1="${CONTENT_X}" y1="76" x2="${CONTENT_X + CONTENT_W}" y2="76" stroke="${colors.primary}" stroke-width="6"/>
    ${singleLine(data.publicTitle, CONTENT_X + 10, 142, { size: 44, fill: '#121212', weight: 800, family: 'Georgia, Noto Serif CJK SC, serif' })}
    ${singleLine('琴剑产品研发部', CONTENT_X + CONTENT_W - 118, 122, { size: 13, fill: '#121212', weight: 800 })}
    ${singleLine(`${md(date)} · ${data.weekday}`, CONTENT_X + CONTENT_W - 118, 146, { size: 12, fill: '#66706d', weight: 800, family: 'Arial, sans-serif' })}
    <line x1="${CONTENT_X}" y1="170" x2="${CONTENT_X + CONTENT_W}" y2="170" stroke="#121212" stroke-width="2"/>
    <line x1="${CONTENT_X}" y1="208" x2="${CONTENT_X + CONTENT_W}" y2="208" stroke="rgba(17,17,17,.18)"/>
    <rect x="${CONTENT_X}" y="226" width="${CONTENT_W}" height="${142 + Math.max(0, leadLines.length - 2) * 30}" fill="${colors.light}"/>
    <line x1="202" y1="226" x2="202" y2="${368 + Math.max(0, leadLines.length - 2) * 30}" stroke="rgba(17,17,17,.16)"/>
    ${singleLine('LEAD', 158, 306, { size: 11, fill: colors.primary, weight: 800, family: 'Arial, sans-serif' })}
    ${textBlock(leadLines, 234, 306, { size: 28, lineHeight: 36, fill: '#121212', weight: 800 })}
    ${sections.svg}
    <line x1="${CONTENT_X}" y1="${sections.bottom + 48}" x2="${CONTENT_X + CONTENT_W}" y2="${sections.bottom + 48}" stroke="rgba(17,17,17,.18)"/>
    ${singleLine('今日洞察', 196, insightY, { size: 27, fill: colors.primary, weight: 800 })}
    ${textBlock(insightLines, 344, insightY, { size: 22, lineHeight: 32, fill: '#121212', weight: 800 })}
    ${textBlock(methodLines, 344, insightY + insightLines.length * 32 + 42, { size: 12, lineHeight: 18, fill: '#66706d', weight: 800 })}
    <line x1="${CONTENT_X}" y1="${footerY}" x2="${CONTENT_X + CONTENT_W}" y2="${footerY}" stroke="#121212" stroke-width="2"/>
    ${singleLine('琴剑产品研发部出品', CONTENT_X, footerY + 34, { size: 13, fill: '#121212', weight: 800 })}
    ${singleLine(`${data.chineseTitle} · 销售机会 · 配置建议 · 来源可追溯`, CONTENT_X + 760, footerY + 34, { size: 12, fill: '#66706d', weight: 800 })}
  </svg>`;
  const outPath = path.join(OUT_DIR, `${date}.png`);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outPath);
  console.log(`Generated share image: ${outPath}`);
}

main().catch((error) => fail(error.stack || error.message));
