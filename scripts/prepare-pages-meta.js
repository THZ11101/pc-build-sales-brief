const fs = require('fs');
function injectHead(file, tags) {
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/<meta property="og:[\s\S]*?<meta name="twitter:card" content="summary_large_image">\n?/g, '');
  if (!html.includes(tags.trim())) {
    html = html.replace('</head>', `${tags}\n</head>`);
  }
  fs.writeFileSync(file, html, 'utf8');
}
injectHead('index.html', `
<meta property="og:title" content="每日装机销售简报">
<meta property="og:description" content="面向电竞玩家与生产力玩家的 DIY 销售组装服务日报。">
<meta property="og:image" content="share-images/2026-06-05.png">
<meta name="twitter:card" content="summary_large_image">`);
injectHead('briefs/2026-06-05.html', `
<meta property="og:title" content="每日装机销售简报｜2026-06-05">
<meta property="og:description" content="销售先问场景，再谈配置：电竞玩家机会、生产力玩家机会、配置成本与销售话术。">
<meta property="og:image" content="../share-images/2026-06-05.png">
<meta name="twitter:card" content="summary_large_image">`);
