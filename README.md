# 小禾AI（XiaoheAI） · 特需儿童康复图卡与绘本生成

小禾AI（XiaoheAI）是面向特需儿童康复的 **图卡 / 多页绘本** 生成系统。输入一句描述，选风格与康复课题，即可生成清晰、温和、适合教学的图卡；或让模型扩写成完整故事并逐页配图，组成可翻页阅读、可导出 PDF 的绘本。

## 功能

- **账号密码登录**（熊猫眼神交互登录页）
- **图片模式**：一句描述 → 单张教学图卡
- **绘本模式**：一句描述 → 通义千问扩写拆页 → 逐页文生图 → 翻页阅读器 + **精美中文 PDF 导出**
- **模板库**：按 类型（康复课题）/ 风格 两个维度筛选，图片与绘本各自成套，缩略图预生成入库
  - 康复课题：语言沟通 / 社交交往 / 生活自理 / 认知与精细动作
  - 画风：暖色手绘 / 水彩 / 扁平简洁 / 黑白线描
- 我的作品（图片 + 绘本混排）、侧栏收起/展开

## 技术栈

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- PostgreSQL（`pg`）— 建议 Neon / Vercel Postgres
- 自建会话认证（`jose` 签 JWT + httpOnly cookie，`bcryptjs` 哈希）
- 阿里百炼 DashScope：`wanx2.1-t2i-turbo`（文生图）+ `qwen-plus`（写故事拆页）
- PDF：`jspdf` 前端生成 + `subset-font` 服务端中文字体子集化

## 环境变量

复制 `.env.example` 为 `.env.local` 并填写：

| 变量 | 说明 |
|------|------|
| `POSTGRES_URL` | Postgres 连接串（Neon 示例：`postgres://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`） |
| `SESSION_SECRET` | 会话 JWT 签名密钥（`openssl rand -base64 32`） |
| `DASHSCOPE_API_KEY` | 阿里百炼 API Key（服务端使用） |

## 本地开发

```bash
npm install
cp .env.example .env.local   # 填好三个变量
npm run db:init              # 建表 + 预置演示账号 demo / demo1234
node scripts/seed-templates.mjs   # （可选）预生成模板缩略图入库
npm run dev
```

## 部署到 Vercel

1. Import 本仓库到 Vercel（框架自动识别 Next.js）。
2. 接一个 Postgres（Vercel 集成里的 Neon，或自建 Neon），拿到连接串。
3. 在 Vercel 项目 Settings → Environment Variables 配置 `POSTGRES_URL`、`SESSION_SECRET`、`DASHSCOPE_API_KEY`。
4. 首次部署后，对生产库执行一次建表：本地把 `.env.local` 的 `POSTGRES_URL` 指向生产库，运行 `npm run db:init` 与 `node scripts/seed-templates.mjs`。

> 注意：DashScope 生成的图片 URL 有效期约 24 小时，长期保存需转存对象存储（代码中已留 TODO）。
