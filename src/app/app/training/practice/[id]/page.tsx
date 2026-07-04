import { PracticeSessionPage } from '~/components/app/training/PracticeSessionPage';

export default function Page({ params }: { params: { id: string } }) {
  return <PracticeSessionPage id={Number(params.id)} />;
}
