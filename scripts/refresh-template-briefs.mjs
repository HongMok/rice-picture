// 一次性脚本：按 title 幂等更新 templates.brief。
// 图卡：单幕定格（主体+颜色+动作/表情，含背景锚点）
// 绘本：四段时序（起初 / 后来 / 然后 / 最后），每段一句一情节
//
// 用法：
//   node scripts/refresh-template-briefs.mjs
//     只显示改动预览
//   node scripts/refresh-template-briefs.mjs --apply
//     执行 UPDATE
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const PG =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL;
if (!PG) {
  console.error('❌ 缺少 POSTGRES_URL / DATABASE_URL');
  process.exit(1);
}
const APPLY = process.argv.includes('--apply');

const IMAGE_BRIEFS = {
  '水果词汇卡':
    '一个鲜红的苹果，圆润饱满，顶部有一根棕色果柄和一片绿叶，白色纯背景，正中构图',
  '动物词汇卡':
    '一只可爱的橘色小猫，坐姿正面朝前，圆圆的眼睛，尾巴自然卷在身侧，白色背景',
  '"我想要"表达卡':
    '一个小朋友微笑着伸出食指，指向前方一个透明玻璃杯，眼神看向水杯',
  // 兼容当前 DB 里可能的中英文引号变体
  '“我想要”表达卡':
    '一个小朋友微笑着伸出食指，指向前方一个透明玻璃杯，眼神看向水杯',
  '轮流等待':
    '一个小朋友双手交握放在身前，安静站立，眼睛看着前方的滑梯，表情平静',
  '打招呼':
    '两个小朋友面对面，都举起一只手挥手，露出开心的笑容，眼睛看着对方',
  '目光对视':
    '两个小朋友面对面近距离站着，眼睛清楚地对视，都露出温和的微笑',
  '刷牙步骤':
    '一个小朋友双手握着牙刷，把牙刷放进张开的嘴里，牙刷上带着白色泡沫',
  '洗手步骤':
    '一个小朋友把双手放在水龙头下的水流里，手掌上有清晰的白色泡沫，正在互相搓揉',
  '自己吃饭':
    '一个小朋友坐在餐桌前，一只手握着勺子舀起一勺白米饭正要送到嘴边，桌上有一个碗',
  '形状认知卡': '一个正圆形，纯蓝色，实心填色，居中放置在白色背景上',
  '颜色配对卡':
    '三个不同颜色的气球（红、黄、蓝）等距排成一排，每个气球下方有一根细线，白色背景',
  '系扣子':
    '特写：两只小手正在给一件蓝色衬衫系一颗白色圆纽扣，扣眼清晰可见',
  '校门口打招呼':
    '两个小学生在校门口相遇，各自背着一个书包，同时抬手挥动，露出开心的笑容',
};

// 绘本 brief：结构化多行（主角 / 起初 / 后来 / 然后 / 最后），方便老师逐段编辑
const BOOK_BRIEFS = {
  '小鹦鹉说"我想要"': `主角:小鹦鹉皮皮，绿色羽毛，头顶一撮翘起的黄毛
起初:看着桌上的饼干，只是着急地拍翅膀发出叫声
后来:妈妈蹲下来鼓励皮皮用嘴巴说出想要的东西
然后:皮皮鼓起勇气，清楚地说出"我想要"
最后:妈妈开心地把饼干递到皮皮面前`,
  '小鹦鹉说“我想要”': `主角:小鹦鹉皮皮，绿色羽毛，头顶一撮翘起的黄毛
起初:看着桌上的饼干，只是着急地拍翅膀发出叫声
后来:妈妈蹲下来鼓励皮皮用嘴巴说出想要的东西
然后:皮皮鼓起勇气，清楚地说出"我想要"
最后:妈妈开心地把饼干递到皮皮面前`,
  '谢谢小星星': `主角:小女孩朵朵，扎两个羊角辫，穿蓝色睡衣
起初:晚上找不到掉在地上的棕色玩具熊，急得快要哭
后来:窗外一颗小星星发出温暖的亮光，照亮了地板
然后:朵朵顺着光找到了玩具熊，紧紧抱在怀里
最后:朵朵走到窗边，抬头对小星星说"谢谢"`,
  '小熊学会和朋友分享玩具': `主角:棕色小熊布布，戴一条红色围巾
起初:紧紧抱着一辆红色小汽车，不肯给身边的小狐狸玩
后来:小狐狸失落地走开了，布布一个人推着车觉得没意思
然后:布布主动跑过去，把小汽车递到小狐狸手里
最后:两只小动物一起蹲在地上，笑着推着小汽车玩`,
  '小刺猬和小兔子一起玩': `主角:小刺猬豆豆（棕色背刺）和小兔子朵朵（白色长耳朵）
起初:豆豆一个人在草地上堆积木，堆到第三块就倒了下来，有点难过
后来:朵朵蹦过来，蹲下帮它扶住底层的积木
然后:两个小伙伴齐心协力，一块块把积木稳稳堆起来
最后:积木堆得比豆豆还高，两个小伙伴开心地击掌欢呼`,
  '小兔子自己穿衣服': `主角:白色小兔子米米，长长的耳朵，穿一件黄色的小外套
起初:早上想自己穿衣服，看着外套不知道该从哪里开始
后来:兔妈妈耐心地告诉米米先套头再伸手臂
然后:米米照着妈妈说的做，一步一步把外套慢慢穿上身
最后:米米对着镜子转了一圈，露出得意的笑容`,
  '小熊刷刷牙': `主角:棕色小熊球球，穿蓝白条纹睡衣
起初:晚上困得直打哈欠，不想刷牙就想爬上床睡觉
后来:熊妈妈拿来牙刷，示范上下刷动的正确动作
然后:球球学着妈妈的样子认真刷牙，嘴里全是白色的泡沫
最后:球球漱完口，露出干净的白牙齿对妈妈笑`,
  '彩虹小步走': `主角:小女孩豆豆，短发，穿黄色雨衣，脚踩粉色雨鞋
起初:看到雨后天空挂着一道彩虹，好奇地跑到院子里
后来:跟着彩虹的红色，一步一步走到红色的玫瑰花丛前
然后:跟着黄色走到金黄的向日葵旁边，蹲下闻了闻
最后:跟着蓝色走到蓝色的小池塘边，看到水里倒映的彩虹开心欢呼`,
  '小松鼠数松果': `主角:小松鼠丁丁，橘红色毛，一条毛茸茸的大尾巴
起初:在大树下发现一堆松果，太多了数不清有几个
后来:把松果一个一个搬出来，整整齐齐排成一排
然后:一边用小爪子指着松果，一边认真地数"一、二、三、四、五"
最后:丁丁抱起五个松果，满意地对着松果堆笑了`,
};

const needSsl = /sslmode=require|neon\.tech|vercel/i.test(PG);
const pool = new pg.Pool({
  connectionString: PG,
  ssl: needSsl ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  const { rows: existing } = await pool.query(
    'select id, kind, title, brief from templates order by kind, id'
  );

  const plan = [];
  for (const r of existing) {
    const map = r.kind === 'image' ? IMAGE_BRIEFS : BOOK_BRIEFS;
    const next = map[r.title];
    if (!next) {
      plan.push({ ...r, action: 'skip', reason: '未匹配到目标 brief' });
      continue;
    }
    if (next === r.brief) {
      plan.push({ ...r, action: 'noop', reason: '已是最新' });
      continue;
    }
    plan.push({ ...r, action: 'update', next });
  }

  const toUpdate = plan.filter((p) => p.action === 'update');
  const skipped = plan.filter((p) => p.action === 'skip');
  const noop = plan.filter((p) => p.action === 'noop');

  console.log(`总模板 ${existing.length}：`);
  console.log(`  将更新 ${toUpdate.length}，无变化 ${noop.length}，未匹配 ${skipped.length}`);
  console.log();

  for (const p of toUpdate) {
    console.log(`[${p.kind}] ${p.title}`);
    console.log(`  - 旧: ${p.brief}`);
    console.log(`  + 新: ${p.next}`);
  }
  if (skipped.length) {
    console.log('\n未匹配（脚本不认识的 title，跳过）：');
    for (const p of skipped) console.log(`  · [${p.kind}] ${p.title}`);
  }

  if (!APPLY) {
    console.log('\n(dry-run) 加 --apply 才会真正 UPDATE');
    await pool.end();
    return;
  }

  for (const p of toUpdate) {
    await pool.query('update templates set brief = $1 where id = $2', [
      p.next,
      p.id,
    ]);
  }
  console.log(`\n✅ 已 UPDATE ${toUpdate.length} 条`);
  await pool.end();
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
