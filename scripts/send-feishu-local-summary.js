#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const webhook = process.env.FEISHU_WEBHOOK;
if (!webhook) {
  console.error('Missing FEISHU_WEBHOOK');
  process.exit(1);
}

const date = process.env.BRIEF_DATE || new Date().toISOString().slice(0, 10);
const dataPath = path.join(process.cwd(), 'brief-data', `${date}.json`);
if (!fs.existsSync(dataPath)) {
  console.error(`Missing brief data: ${dataPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const lines = [
  `${data.chineseTitle}｜${data.date} ${data.weekday}`,
  '',
  `今日判断：${data.opening}`,
  '',
  `今日洞察：${data.insight}`,
  '',
];

for (const section of data.sections) {
  const titles = section.items
    .map((item) => String(item.title || '').split('|')[0].trim())
    .filter(Boolean)
    .join('、');
  lines.push(`${section.name}：${titles}`);
}

lines.push('', '说明：今天的网页归档尚未发布到 GitHub Pages，本条为可直接阅读的摘要版，不包含未发布网页链接。');

const payload = {
  msg_type: 'text',
  content: {
    text: lines.join('\n'),
  },
};

function isNetworkBlocked(error) {
  return error && (
    error.code === 'EACCES' ||
    /fetch failed/i.test(error.message || '') ||
    /connect EACCES/i.test(String(error.cause || ''))
  );
}

(async () => {
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
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
    console.log(`Sent local Feishu summary for ${date}`);
  } catch (error) {
    if (isNetworkBlocked(error)) {
      console.error(`Feishu send blocked by outbound network restrictions in this runner: ${error.message}`);
      process.exit(2);
    }
    console.error(error.stack || error.message);
    process.exit(1);
  }
})();
