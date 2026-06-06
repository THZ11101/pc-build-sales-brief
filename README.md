# 每日装机销售简报

面向 DIY 销售组装服务团队的静态简报站点。

## 本期入口

- 首页：`index.html`
- 详情页：`briefs/2026-06-05.html`
- 分享图：`share-images/2026-06-05.png`
- 数据源：`brief-data/2026-06-05.json`

## 每日自动化

仓库已配置 GitHub Actions：

- `Daily Brief`：已暂停定时自动生成，避免在 OpenAI API 无额度时消耗调用；需要时可手动触发生成当天简报、渲染页面、生成分享图、提交发布并推送飞书。
- `Send Feishu Brief`：手动重发指定日期的飞书卡片。

需要的 Secrets：

- `FEISHU_WEBHOOK`：飞书群机器人 Webhook。
- `OPENAI_API_KEY`：用于每日联网生成新一期简报。
- `FEISHU_APP_ID` / `FEISHU_APP_SECRET`：可选，用于把分享图上传为飞书图片并嵌入卡片；未配置时只发送简报和分享图链接。

## GitHub Pages 发布建议

1. 新建 GitHub 仓库。
2. 将本目录文件提交到 `main` 分支。
3. 在 GitHub 仓库设置中开启 Pages：`Settings -> Pages -> Deploy from a branch -> main / root`。
4. 发布后访问：`https://<owner>.github.io/<repo>/`。
