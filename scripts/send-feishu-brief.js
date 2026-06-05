#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const webhook = process.env.FEISHU_WEBHOOK;
if (!webhook) {
  console.error('Missing FEISHU_WEBHOOK');
  process.exit(1);
}

const date = process.env.BRIEF_DATE || new Date().toISOString().slice(0, 10);
const baseUrl = (process.env.BRIEF_BASE_URL || 'https://thz11101.github.io/pc-build-sales-brief').replace(/\/$/, '');
const dataPath = path.join(process.cwd(), 'brief-data', `${date}.json`);
if (!fs.existsSync(dataPath)) {
  console.error(`Missing brief data: ${dataPath}`);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const briefUrl = `${baseUrl}/briefs/${date}.html`;
const imageUrl = `${baseUrl}/share-images/${date}.png`;

const sectionLines = data.sections.map((section) => {
  const titles = section.items.map((item) => String(item.title).split('|')[0].trim()).join('、');
  return `**${section.name}**：${titles}`;
}).join('\n');

const payload = {
  msg_type: 'interactive',
  card: {
    config: { wide_screen_mode: true },
    header: {
      template: 'green',
      title: { tag: 'plain_text', content: `${data.chineseTitle}｜${date}` }
    },
    elements: [
      { tag: 'markdown', content: `**${data.homepage.headline}**\n${data.homepage.summary}` },
      { tag: 'img', img_key: '', alt: { tag: 'plain_text', content: '简报分享图' } },
      { tag: 'markdown', content: sectionLines },
      { tag: 'markdown', content: `📄 [阅读完整简报](${briefUrl})\n🖼️ [打开分享图](${imageUrl})` }
    ]
  }
};

// Custom bots cannot send external image URLs directly in img_key without uploading media,
// so remove the image block and keep the image URL as a clickable fallback.
payload.card.elements = payload.card.elements.filter((element) => element.tag !== 'img');

(async () => {
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Feishu HTTP ${res.status}: ${text}`);
    process.exit(1);
  }
  const result = JSON.parse(text);
  if (result.code !== 0) {
    console.error(`Feishu API error: ${text}`);
    process.exit(1);
  }
  console.log(`Sent Feishu brief card for ${date}: ${briefUrl}`);
})();
