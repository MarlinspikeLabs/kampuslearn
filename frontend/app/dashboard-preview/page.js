import { notFound } from 'next/navigation';
import DashboardPreview from './DashboardPreview';

export const metadata = {
  title: 'Student Dashboard Preview — KampusLearn',
  robots: { index: false, follow: false },
};

export default function Page() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return <DashboardPreview />;
}