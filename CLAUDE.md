# CLAUDE.md — 小禾AI 项目协作说明

本文件是 Claude 在这个仓库工作时的**长期上下文**与**协作规则**。每次开工前先读它。

---

## 一、项目背景

**小禾AI（XiaoheAI）** 是面向**特需儿童康复师 / 特教老师**的一站式 AI 助手。用户人群主要是：
- 康复机构的一线老师（ABA/DTT、语言训练、感统训练等方向）
- 特殊学校的特教老师
- 部分自闭症/发育迟缓儿童的家长

产品定位是"温柔、可信、有秩序的专业助手"——不是玩具、不是通用聊天工具。任何视觉/文案改动都要匹配这个调性（Japandi 米色纸质基调 + 小禾绿主色 + 印章化 Logo，具体见 tailwind.config.ts 里的 token）。

**核心功能模块**（左侧栏顺序即上线优先级）：

1. **工具箱** `/app/toolbox` — 五个生成工具的入口
   - **图卡**：一句描述 → 单张教学图卡（DashScope wanx2.1）
   - **绘本**：扩写故事 → 逐页配图 → 翻页阅读器 + 中文 PDF 导出
   - **互动游戏**：按个案定制出题（情绪匹配 / 物品配对 / 反应类捉蝴蝶 / 打地鼠），图库复用
   - **视频分析**：上传课堂视频 → 通义千问 VL 出结构化家长报告（qwen3.7-plus）
   - **教案生成**：ABA/DTT 四层结构（目标体系/教学设置/教学程序/目标清单）
2. **资源管理** `/app/library` — 三类资源（图卡/绘本/教案）统一管理，软删（`deleted_at`）
3. **个案管理** `/app/cases` — 孩子档案（诊断/能力侧重/兴趣），是"定制出题"的数据依据
4. **小禾AI** `/app/chat` — 通用对话助手，多轮会话自动入库并出现在"过去 30 天"历史

**过去 30 天**列表来自 `/api/projects/recent`，联合查询 `works / books / games / video_analyses / lesson_plans / chat_sessions`。任何新增可持久化的产物类型，都要在这个联合查询里补一条 union。

---

## 二、技术栈与关键约束

- **框架**：Next.js 14 App Router + TypeScript + Tailwind CSS
- **数据库**：Postgres（Neon on Vercel）；建表脚本 `sql/init.sql`，**幂等**（`if not exists` / `add column if not exists`）
- **认证**：`jose` 签 JWT 存 httpOnly cookie；`bcryptjs` 哈希密码
- **AI 服务**：阿里百炼 DashScope
  - `DASHSCOPE_API_KEY` — 图卡/绘本文生图 + 通用文本（qwen-plus / qwen-max）
  - `QWEN_VIDEO_API_KEY` + `QWEN_VIDEO_MODEL=qwen3.7-plus` — 课堂视频分析（多模态 VL）
- **对象存储**：`BLOB_READ_WRITE_TOKEN`（Vercel Blob）用于把 DashScope 24h 临时链转存为永久 URL；未配置时代码 gate 住、退回临时链，不阻塞
- **部署**：Vercel Production 部署，`.vercel/project.json` 已 link
- **PDF**：`jspdf` 前端 + `subset-font` 服务端中文字体子集化

**数据库表命名与惯例**：
- 用户可拥有的资源都带 `user_id bigint references users(id)`
- 软删走 `deleted_at timestamptz`（`works` / `books` / `lesson_plans` / `chat_sessions` 都已启用）
- 大字段（配置/生成结果/消息数组）存 `jsonb`
- 时间列统一 `created_at` / `updated_at`，默认 `now()`

**颜色 token（不要凭空发明色值）**：
- 主色：`clay` `#7FA98B` / `clay-deep` `#5E8A6E`
- 底色：`paper` `#FAF7F2` / `paper-deep` `#F3F0E9` / `sage-mist` `#EAF0E8`
- 墨：`ink` `#3E3A36` / `ink-soft` `#8A857D` / `ink-faint` `#A8A296`

**品牌规则**（历次改版沉淀）：
- 字标：`小禾` 用宋体 clay-deep 绿；`AI` 用无衬线小字宽字距 ink 黑。**不论深浅底一律绿+黑**，不要反色
- Logo：卡通萌芽（黑边 + 绿叶 + 土棕小堆 + 一大一小对生叶）装在柔角印章 `sage-mist` 底 + `clay-deep/25` 描边里；不要圆形渐变、不要投影
- 复用组件：`<Brandmark>` 完整字标，`<BrandmarkGlyph>` 只是印章内的萌芽 SVG（对话页空态用它）

---

## 三、协作规则（重要）

### 1. 提交与推送

- **不要**在没有我明确允许的情况下 `git commit` 或 `git push`。我说"推一下"/"提交并推送"/"push"这类明确指令时才能推
- 每次开工先跑 `git status`，把没有 stage 的改动如实告诉我；不要静默 `git add .`
- Stage 时用**具体路径列表**而非 `git add .` / `git add -A`；`resources/` `.kiro/` `*-preview.html` 已在 `.gitignore` 但仍要盯紧，防止误加
- Commit message 用中文，first line 说清楚模块+动作（如 `feat(chat): xxx` / `fix(sidebar): xxx`），body 用条目讲清"改了什么、为什么"；末尾保留 `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`
- 大改动倾向一个 commit 打包（我一般会说"一个大 commit"）；只有当我要求拆分才拆
- 绝对不要 `--force` push、不要 `--no-verify` 跳 hook、不要 `--amend` 改已推送过的 commit

### 2. 数据库变更

- **任何 schema 变更**：先改 `sql/init.sql`（追加**幂等** DDL：`create ... if not exists` / `add column if not exists`），再考虑生产库怎么同步
- 生产库迁移必须**先于**代码 push 完成——不然 Vercel 拉了新代码就白屏（我们已经踩过一次 `column b.deleted_at does not exist`）
- 迁移方式：从 Vercel CLI 拉 `POSTGRES_URL_NON_POOLING`，用本地 psql 跑；用完立刻 `rm` 临时文件
- 迁移完主动跟我说清楚"生产库跑了什么 DDL"

### 3. 环境变量

- 新增 env 时同步更新 `.env.example`
- 生产环境的 env 通过 `vercel env add` 加，`printf ... | vercel env add ... production` 避免 key 出现在 shell 历史
- 加完 env **必须触发一次 Redeploy**（`vercel redeploy <url> --target production --no-wait`），Vercel 不 redeploy 不会注入新变量

### 4. 代码风格

- 不写多余的注释、docstring；只在"为什么"非显而易见时加**一行**注释
- 不做过度抽象——三行相似代码 > 一个提前抽的 helper
- 边界处理只放在**系统边界**（用户输入、外部 API）；内部函数信任传入值
- 不加"以防万一"的 fallback（比如为不可能发生的空数组加空数组分支）
- 删除未使用代码时干脆删掉，不要留 `// removed for X` 之类的墓碑注释

### 5. 出错时的处理

- **不要用破坏性操作绕开**问题（`--no-verify` / `git reset --hard` / 删 lock 文件 / rm -rf）
- 白屏 / 500 时先看 Vercel logs（`vercel logs --level error --since 10m --expand`）定位真实原因，再决定改哪里；不要凭报错文案瞎猜
- 遇到破坏性操作前先跟我确认；我说"允许"了才能做

### 6. UI 改动验证

- 涉及 UI 的改动**不要仅凭 typecheck 通过就说"完成了"**——tsc 只验类型，不验视觉/交互
- 明确说清"改了什么、你自己没跑过浏览器验证"，让我来验
- CI 或部署起来的话可以用 `curl -I` 或 `vercel logs` 快速确认没有 500

### 7. 询问用户

- 遇到多种合理方案且我没说清偏好的时候，用 `AskUserQuestion` 问，不要闷头选一个
- 不确定的破坏性动作、密钥/密码相关决策、涉及多张表的数据库改动，都要先问

---

## 四、常用命令速查

```bash
# 本地开发
npm run dev

# 生产日志 / 部署状态
vercel logs --level error --since 10m --expand
vercel ls
vercel inspect <url>

# 生产 env
vercel env ls
printf '<value>' | vercel env add KEY production
vercel redeploy <latest-url> --target production --no-wait

# 数据库
vercel env pull /tmp/.env.rp --environment production --yes
DB=$(grep '^POSTGRES_URL_NON_POOLING=' /tmp/.env.rp | sed 's/POSTGRES_URL_NON_POOLING="//; s/"$//')
psql "$DB" -v ON_ERROR_STOP=1 -f /tmp/migration.sql
rm -f /tmp/.env.rp /tmp/migration.sql
```

---

## 五、当前状态锚点（跟进时可先看这里）

- 主域名：`https://rice-picture.vercel.app`
- Vercel Project：`scutmox-7383s-projects/rice-picture`
- 演示账号：`demo` / `demo1234`
- 数据库：Neon Postgres 17（表清单：`users / works / books / book_pages / templates / template_pages / children / assets / games / video_analyses / user_quotas / lesson_plans / lesson_plan_templates / chat_sessions`）
