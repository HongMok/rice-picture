'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AbilityProfile } from '~/data/training-types';
import { GraduationIcon, ChatIcon, CheckIcon, WorksIcon } from '~/components/ui/icons';

export function TrainingLanding() {
  const [profile, setProfile] = useState<AbilityProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/training/profile')
      .then((r) => r.json())
      .then((d) => setProfile(d.profile || null))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1080px] px-6 py-16 md:px-10">
        <h1 className="font-serif text-[40px] font-normal leading-[1.6] text-ink">
          培训测评 · 学练测一体
        </h1>
        <p className="mt-3 max-w-[60ch] text-[15px] leading-[2] text-ink-soft">
          康复师的成长闭环 —— 看课程、做练习、参加测评，学完就知道自己到哪儿了。
        </p>

        {/* 顶部能力画像条 */}
        <ProfileBar profile={profile} loading={loading} />

        {/* 三大功能卡 */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <FunctionCard
            step="01"
            title="学"
            subtitle="课程库"
            desc="视频课转结构化图文稿，配章节要点，读完就会记住"
            href="/app/training/courses"
            icon={<GraduationIcon width={22} height={22} />}
          />
          <FunctionCard
            step="02"
            title="练"
            subtitle="AI 情景模拟"
            desc="AI 扮演家长、督导、孩子，练习真实沟通场景"
            href="/app/training/practice"
            icon={<ChatIcon width={22} height={22} />}
          />
          <FunctionCard
            step="03"
            title="测"
            subtitle="选择式测评"
            desc="题目按知识点组卷，答完自动出报告，命中弱项"
            href="/app/training/quizzes"
            icon={<CheckIcon width={22} height={22} />}
          />
        </div>

        {/* 能力画像入口大条（含历史记录） */}
        <Link
          href="/app/training/profile"
          className="mt-8 flex items-center gap-4 rounded-card border border-line bg-card p-6 transition-colors duration-[450ms] hover:bg-paper-deep"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sage-mist text-sage-deep">
            <WorksIcon width={22} height={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] font-medium text-ink">能力画像 · 我的记录</h3>
            <p className="mt-1 text-sm text-ink-faint">
              六维雷达评估你的康复能力；查看过往测评得分与练习复盘
            </p>
          </div>
          <span className="text-sm text-clay-deep">进入 →</span>
        </Link>
      </div>
    </div>
  );
}

function ProfileBar({
  profile,
  loading,
}: {
  profile: AbilityProfile | null;
  loading: boolean;
}) {
  if (loading) {
    return <div className="mt-8 h-20 animate-breathe rounded-card bg-paper-deep" />;
  }
  const active = profile?.competencies.filter((c) => c.question_total > 0) || [];
  if (!profile || active.length === 0) {
    return (
      <div className="mt-8 rounded-card border border-line bg-card px-5 py-4 text-[13px] text-ink-faint">
        你还没有答题记录。挑一份测评开始吧。
      </div>
    );
  }
  return (
    <div className="mt-8 rounded-card border border-line bg-card px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <span className="text-[12px] text-ink-faint">综合掌握</span>
          <span className="ml-2 font-serif text-[22px] font-medium text-clay-deep">
            {profile.overall}
          </span>
          <span className="ml-0.5 text-[13px] text-ink-soft">/ 100</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
          {active.map((c) => (
            <span key={c.key} className="flex items-center gap-1.5 text-ink-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-clay-deep/60" />
              {c.name}
              <span className="font-medium text-ink">{c.score}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function FunctionCard({
  step,
  title,
  subtitle,
  desc,
  href,
  icon,
}: {
  step: string;
  title: string;
  subtitle: string;
  desc: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-card border border-line bg-card p-8 transition-colors duration-[450ms] hover:bg-paper-deep"
    >
      <span className="absolute right-5 top-5 text-[11px] font-medium tracking-[0.2em] text-clay-deep">
        {step}
      </span>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sage-mist text-sage-deep">
        {icon}
      </span>
      <h3 className="mt-5 font-serif text-[24px] font-medium text-clay-deep">
        {title}
        <span className="ml-2 font-sans text-[14px] font-normal text-ink-soft">
          · {subtitle}
        </span>
      </h3>
      <p className="mt-2 text-sm leading-[1.9] text-ink-faint">{desc}</p>
      <span className="mt-6 text-sm text-clay-deep">进入 →</span>
    </Link>
  );
}
