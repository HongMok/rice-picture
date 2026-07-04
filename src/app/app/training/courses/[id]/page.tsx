import { CourseDetailPage } from '~/components/app/training/CourseDetailPage';

export default function Page({ params }: { params: { id: string } }) {
  return <CourseDetailPage id={Number(params.id)} />;
}
