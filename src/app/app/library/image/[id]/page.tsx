import { notFound } from 'next/navigation';
import { getCurrentUser } from '~/libs/auth';
import { getWorkById } from '~/libs/works';
import { ImageDetail } from '~/components/app/ImageDetail';

export const dynamic = 'force-dynamic';

export default async function ImageDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const user = await getCurrentUser();
  if (!user) notFound();

  const work = await getWorkById(id, user.id);
  if (!work) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-sm leading-[1.9] text-ink-soft">这张图卡不存在或已被删除。</p>
      </div>
    );
  }

  return (
    <ImageDetail
      id={work.id}
      title={work.title || '未命名图卡'}
      imageUrl={work.output_url}
      status={work.status}
      templateId={work.template_id}
      createdAt={work.created_at}
    />
  );
}
