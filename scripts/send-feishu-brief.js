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
const imagePath = path.join(process.cwd(), 'share-images', `${date}.png`);

const sectionLines = data.sections.map((section) => {
  const titles = section.items.map((item) => String(item.title).split('|')[0].trim()).join('、');
  return `**${section.name}**：${titles}`;
}).join('\n');

async function getTenantAccessToken() {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  if (!appId || !appSecret) return null;

  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Feishu token HTTP ${res.status}: ${text}`);
  const result = JSON.parse(text);
  if (result.code !== 0 || !result.tenant_access_token) {
    throw new Error(`Feishu token API error: ${text}`);
  }
  return result.tenant_access_token;
}

async function uploadImage() {
  if (!fs.existsSync(imagePath)) return null;
  const tenantAccessToken = await getTenantAccessToken();
  if (!tenantAccessToken) return null;

  const form = new FormData();
  form.append('image_type', 'message');
  const bytes = fs.readFileSync(imagePath);
  form.append('image', new Blob([bytes], { type: 'image/png' }), `${date}.png`);

  const res = await fetch('https://open.feishu.cn/open-apis/im/v1/images', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tenantAccessToken}`,
    },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Feishu image HTTP ${res.status}: ${text}`);
  const result = JSON.parse(text);
  if (result.code !== 0 || !result.data || !result.data.image_key) {
    throw new Error(`Feishu image API error: ${text}`);
  }
  return result.data.image_key;
}

function buildPayload(imageKey) {
  const elements = [
    { tag: 'markdown', content: `**${data.homepage.headline}**\n${data.homepage.summary}` },
    { tag: 'markdown', content: sectionLines },
    { tag: 'markdown', content: `📄 [阅读完整简报](${briefUrl})\n🖼️ [打开分享图](${imageUrl})` },
  ];
  if (imageKey) {
    elements.splice(1, 0, {
      tag: 'img',
      img_key: imageKey,
      alt: { tag: 'plain_text', content: '简报分享图' },
    });
  }

  return {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: 'green',
        title: { tag: 'plain_text', content: `${data.chineseTitle}｜${date}` },
      },
      elements,
    },
  };
}

function isNetworkBlocked(error) {
  return error && (
    error.code === 'EACCES' ||
    /fetch failed/i.test(error.message || '') ||
    /connect EACCES/i.test(String(error.cause || ''))
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries(label, fn, attempts = 3) {
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts) {
        console.warn(`${label} failed on attempt ${i}/${attempts}: ${error.message}`);
        await sleep(1500 * i);
      }
    }
  }
  throw lastError;
}

async function postWebhook(payload) {
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Feishu HTTP ${res.status}: ${text}`);
  }
  const result = JSON.parse(text);
  if (result.code !== 0) {
    throw new Error(`Feishu API error: ${text}`);
  }
}

async function sendImageOnly(imageKey) {
  await postWebhook({
    msg_type: 'image',
    content: { image_key: imageKey },
  });
}

function resolveImageFallbackMode() {
  const mode = (process.env.FEISHU_IMAGE_FALLBACK_MODE || 'missing-image').trim().toLowerCase();
  if (mode === 'never' || mode === 'missing-image') return mode;
  console.warn(`Unsupported FEISHU_IMAGE_FALLBACK_MODE="${mode}", falling back to "missing-image".`);
  return 'missing-image';
}

(async () => {
  try {
    let imageKey = null;
    try {
      imageKey = await withRetries('Feishu image upload', uploadImage, 3);
    } catch (error) {
      if (isNetworkBlocked(error)) {
        console.warn(`Image upload skipped because outbound network is blocked in this runner: ${error.message}`);
      } else {
        console.warn(`Image upload skipped: ${error.message}`);
      }
    }
    const payload = buildPayload(imageKey);
    await withRetries('Feishu webhook send', () => postWebhook(payload), 3);

    let imageFallbackSent = false;
    const fallbackMode = resolveImageFallbackMode();
    if (!imageKey && fallbackMode === 'missing-image') {
      try {
        const retryImageKey = await withRetries('Feishu fallback image upload', uploadImage, 2);
        if (retryImageKey) {
          await withRetries('Feishu image-only fallback send', () => sendImageOnly(retryImageKey), 2);
          imageFallbackSent = true;
        }
      } catch (error) {
        console.warn(`Image-only fallback skipped: ${error.message}`);
      }
    }

    const imageStatus = imageKey
      ? (imageFallbackSent ? ' with image; image-only fallback sent' : ' with image')
      : (imageFallbackSent ? ' without image; image-only fallback sent' : ' without image');
    console.log(`Sent Feishu brief card for ${date}: ${briefUrl}${imageStatus}`);
  } catch (error) {
    if (isNetworkBlocked(error)) {
      console.error(`Feishu send blocked by outbound network restrictions in this runner: ${error.message}`);
      process.exit(2);
    }
    console.error(error.stack || error.message);
    process.exit(1);
  }
})();
