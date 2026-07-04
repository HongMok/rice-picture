#!/usr/bin/env python3
"""
从 resources/class/*.xlsx 抽出指定的 9 门课到 JSON。
用法: python3 scripts/training/extract-transcripts.py > scripts/training/transcripts.json
"""
import json
import sys
import os

try:
    import openpyxl
except ImportError:
    sys.stderr.write("请先: pip3 install openpyxl\n")
    sys.exit(1)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
XLSX = os.path.join(ROOT, "resources", "class", "riceai 培训视频文字内容.xlsx")

# 选出 3 领域 × 3 门课 = 9 门（按主题精确匹配）
SELECTIONS = [
    # ABA 基础与教学
    ("ABA是什么？", "aba", ["ABA", "应用行为分析", "基础"]),
    ("分析行为的ABC模式", "aba", ["ABC", "行为分析"]),
    ("什么是回合式教学？", "aba", ["DTT", "回合式教学"]),
    # 提示与强化
    ("什么是“提示”？", "prompt-reinforce", ["提示", "prompt"]),
    ("如何提示褪除？", "prompt-reinforce", ["提示褪除", "撤除"]),
    ("什么是强化和惩罚", "prompt-reinforce", ["强化", "惩罚"]),
    # 家长沟通与专业素养
    ("用心与家长沟通", "communication", ["家长沟通"]),
    ("提供有效的反馈", "communication", ["反馈"]),
    ("如何组织和实施家长培训1", "communication", ["家长培训"]),
]


def main():
    wb = openpyxl.load_workbook(XLSX, read_only=True)
    ws = wb["Sheet1"]
    all_rows = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            continue
        title = (row[0] or "").strip() if row[0] else ""
        content = (row[1] or "").strip() if row[1] else ""
        segs_raw = (row[2] or "").strip() if row[2] else ""
        if not title:
            continue
        segments = None
        if segs_raw:
            try:
                segments = json.loads(segs_raw)
            except Exception:
                segments = None
        all_rows.append(
            {
                "row_num": i,
                "title": title,
                "content": content,
                "segments": segments,
            }
        )

    picked = []
    for target_title, category, kp_tags in SELECTIONS:
        found = None
        for r in all_rows:
            if r["title"].strip() == target_title.strip():
                found = r
                break
        if not found:
            # 宽松匹配
            for r in all_rows:
                if target_title[:6] in r["title"]:
                    found = r
                    break
        if not found:
            sys.stderr.write(f"⚠ 未找到课程: {target_title}\n")
            continue
        picked.append(
            {
                "title": found["title"],
                "category": category,
                "knowledge_tags": kp_tags,
                "transcript": found["content"],
                "segments": found["segments"],
                "source_ref": f'xlsx#row:{found["row_num"]}',
            }
        )
        sys.stderr.write(
            f"✓ {found['title']} ({category}) — {len(found['content'])} 字\n"
        )

    out = {"courses": picked}
    print(json.dumps(out, ensure_ascii=False, indent=2))
    sys.stderr.write(f"\n共抽出 {len(picked)} 门课\n")


if __name__ == "__main__":
    main()
