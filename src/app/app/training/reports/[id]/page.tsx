import { ReportPage } from '~/components/app/training/ReportPage';

export default function Page({ params }: { params: { id: string } }) {
  return <ReportPage id={Number(params.id)} />;
}
