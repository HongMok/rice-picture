import { notFound } from 'next/navigation';
import { getCurrentUser } from '~/libs/auth';
import { getLessonPlan, lessonPlanOwnerId } from '~/libs/lesson-plans';
import { LessonPlanPoster } from '~/components/app/lesson-plan/LessonPlanPoster';

export const dynamic = 'force-dynamic';

export default async function LessonPlanDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const user = await getCurrentUser();
  if (!user) notFound();

  const plan = await getLessonPlan(id, user.id);
  if (!plan) {
    const ownerId = await lessonPlanOwnerId(id);
    if (ownerId !== null) {
      return (
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <p className="text-sm leading-[1.9] text-ink-soft">你没有权限查看这份教案。</p>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-sm leading-[1.9] text-ink-soft">这份教案不存在或已被删除。</p>
      </div>
    );
  }

  return <LessonPlanPoster initialPlan={plan} />;
}
