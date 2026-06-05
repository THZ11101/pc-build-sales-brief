const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'brief-data');
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const SECTION_NAMES = ['电竞玩家机会', '生产力玩家机会', '配置与成本信号', '销售话术与服务'];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { date: process.env.BRIEF_DATE || chinaDate(), force: process.env.FORCE === '1' };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--date') out.date = args[++i];
    else if (arg === '--force') out.force = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/generate-daily-brief.js [--date YYYY-MM-DD] [--force]');
      process.exit(0);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.date)) fail(`Invalid date: ${out.date}`);
  return out;
}

function chinaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function weekdayFor(date) {
  const noonUtc = new Date(`${date}T04:00:00.000Z`);
  return WEEKDAYS[noonUtc.getUTCDay()];
}

function listRecentBriefs(limit = 7) {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs.readdirSync(DATA_DIR)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort()
    .reverse()
    .slice(0, limit)
    .map((name) => {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
      return {
        date: data.date,
        opening: data.opening,
        insight: data.insight,
        titles: (data.sections || []).flatMap((section) => section.items || []).map((item) => item.title),
        urls: (data.sections || []).flatMap((section) => section.items || []).map((item) => item.sourceUrl),
      };
    });
}

function schemaFor(date) {
  const item = {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'description', 'sourceName', 'sourceUrl', 'sourceDateLabel'],
    properties: {
      title: { type: 'string', description: '格式必须是 产品/工具/信号名 | 动作短语' },
      description: { type: 'string', description: '先写事实，再写对装机销售或服务的影响，60-90 个中文字符' },
      sourceName: { type: 'string' },
      sourceUrl: { type: 'string' },
      sourceDateLabel: { type: 'string' },
    },
  };
  const section = {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'subtitle', 'items'],
    properties: {
      name: { type: 'string', enum: SECTION_NAMES },
      subtitle: { type: 'string' },
      items: { type: 'array', items: item },
    },
  };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['date', 'weekday', 'industry', 'publicTitle', 'chineseTitle', 'opening', 'insight', 'methodNote', 'homepage', 'sections'],
    properties: {
      date: { type: 'string' },
      weekday: { type: 'string', enum: WEEKDAYS },
      industry: { type: 'string' },
      publicTitle: { type: 'string' },
      chineseTitle: { type: 'string' },
      opening: { type: 'string' },
      insight: { type: 'string' },
      methodNote: { type: 'string' },
      homepage: {
        type: 'object',
        additionalProperties: false,
        required: ['headline', 'summary', 'mobileSections'],
        properties: {
          headline: { type: 'string' },
          summary: { type: 'string' },
          mobileSections: {
            type: 'array',
            minItems: 4,
            maxItems: 4,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'summary'],
              properties: {
                name: { type: 'string', enum: SECTION_NAMES },
                summary: { type: 'string' },
              },
            },
          },
        },
      },
      sections: { type: 'array', items: section },
    },
  };
}

function buildPrompt(date) {
  const recent = listRecentBriefs();
  return [
    {
      role: 'system',
      content: [
        '你是电脑 DIY 销售组装服务公司的行业简报编辑。',
        '读者是装机销售、客服和方案顾问，客户群体是电竞玩家、生产力玩家。',
        '简报必须回答：卖什么、怎么讲、怎么配、怎么避坑。',
        '不要写成泛硬件新闻汇总；每条都必须落到销售追问、配置建议、成本提醒或售后风险。',
        '优先使用最近 7 天的一手来源、官方新闻、厂商博客、财报/投资者新闻、权威机构报告；如果用更早资料，sourceDateLabel 必须标注“最近官方参考”。',
        '不要编造 URL、发布日期或产品名；sourceUrl 必须可公开访问。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `请生成 ${date}（中国时区）的《每日装机销售简报》。`,
        `weekday 必须是：${weekdayFor(date)}。`,
        '栏目顺序固定为：电竞玩家机会、生产力玩家机会、配置与成本信号、销售话术与服务。每个栏目 3 条，共 12 条。',
        '标题格式固定为“产品/工具/信号名 | 核心动作短语”，动作短语尽量 15 个中文字符以内。',
        'opening 控制在 50 个中文字符以内；insight 控制在 150 个中文字符以内；methodNote 写明采集窗口与来源策略。',
        'homepage.mobileSections 必须与四个栏目一一对应。',
        '尽量避免与最近几期重复。最近几期摘要如下：',
        JSON.stringify(recent, null, 2),
      ].join('\n'),
    },
  ];
}

function extractOutputText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  const chunks = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') chunks.push(content.text);
      if (content.type === 'text' && typeof content.text === 'string') chunks.push(content.text);
    }
  }
  return chunks.join('\n').trim();
}

function normalizeBrief(data, date) {
  data.date = date;
  data.weekday = weekdayFor(date);
  data.industry = '电脑DIY销售组装服务';
  data.publicTitle = 'The PC Build Sales Brief';
  data.chineseTitle = '每日装机销售简报';
  const byName = new Map((data.sections || []).map((section) => [section.name, section]));
  data.sections = SECTION_NAMES.map((name) => byName.get(name) || { name, subtitle: '', items: [] });
  data.homepage = data.homepage || {};
  const mobileByName = new Map((data.homepage.mobileSections || []).map((section) => [section.name, section]));
  data.homepage.mobileSections = SECTION_NAMES.map((name) => mobileByName.get(name) || { name, summary: '' });
  return data;
}

function validateBrief(data) {
  const errors = [];
  if (data.sections.length !== 4) errors.push('sections must be 4');
  data.sections.forEach((section, index) => {
    if (section.name !== SECTION_NAMES[index]) errors.push(`section ${index + 1} name must be ${SECTION_NAMES[index]}`);
    if (!Array.isArray(section.items) || section.items.length !== 3) errors.push(`${section.name} must have 3 items`);
    (section.items || []).forEach((item) => {
      if (!String(item.title || '').includes('|')) errors.push(`title missing pipe: ${item.title}`);
      if (!/^https?:\/\//.test(String(item.sourceUrl || ''))) errors.push(`bad source URL: ${item.sourceUrl}`);
      if (!item.sourceName || !item.sourceDateLabel || !item.description) errors.push(`missing item fields: ${item.title}`);
    });
  });
  if (errors.length) fail(`Generated brief failed validation:\n- ${errors.join('\n- ')}`);
}

async function callOpenAI(date) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) fail('Missing OPENAI_API_KEY. Add it as a GitHub Actions repository secret before enabling daily generation.');
  const model = process.env.OPENAI_MODEL || 'gpt-4.1';
  const body = {
    model,
    input: buildPrompt(date),
    tools: [{ type: 'web_search_preview' }],
    text: {
      format: {
        type: 'json_schema',
        name: 'pc_build_sales_brief',
        strict: true,
        schema: schemaFor(date),
      },
    },
  };
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) fail(`OpenAI API ${res.status}: ${text}`);
  const response = JSON.parse(text);
  const outputText = extractOutputText(response);
  if (!outputText) fail(`OpenAI response did not include output text: ${text.slice(0, 1000)}`);
  return JSON.parse(outputText);
}

async function main() {
  const { date, force } = parseArgs();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const outPath = path.join(DATA_DIR, `${date}.json`);
  if (fs.existsSync(outPath) && !force) {
    console.log(`Brief data already exists: ${outPath}`);
    return;
  }
  const raw = await callOpenAI(date);
  const data = normalizeBrief(raw, date);
  validateBrief(data);
  fs.writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Generated brief data: ${outPath}`);
}

main().catch((error) => fail(error.stack || error.message));
