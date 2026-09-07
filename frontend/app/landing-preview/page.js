import { notFound } from 'next/navigation';
import StudentEntry from '../_components/student-entry/StudentEntry';

export const metadata = {
  title:'Your Entire Kampus in One Place — KampusLearn',
  description:'Course materials, past questions, practice and AI study support for Nigerian tertiary students.',
  robots:{ index:false, follow:false },
};
export default function LandingPreviewPage(){
  if(process.env.NODE_ENV !== 'development')notFound();
  return <StudentEntry startAt="landing"/>;
}
