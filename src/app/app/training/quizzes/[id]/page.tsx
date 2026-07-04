import { QuizAttemptPage } from '~/components/app/training/QuizAttemptPage';

export default function Page({ params }: { params: { id: string } }) {
  return <QuizAttemptPage id={Number(params.id)} />;
}
