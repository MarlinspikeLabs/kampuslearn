import { notFound } from 'next/navigation';
import StudentEntry from '../_components/student-entry/StudentEntry';

export const metadata = {
  title:'Log in or create an account — KampusLearn',
  description:'Explore the KampusLearn account and student onboarding design.',
  robots:{ index:false, follow:false },
};
export default function AuthPreviewPage(){
  if(process.env.NODE_ENV !== 'development')notFound();
  return <StudentEntry startAt="auth"/>;
}
