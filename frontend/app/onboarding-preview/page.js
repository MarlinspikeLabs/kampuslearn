import { notFound } from 'next/navigation';
import StudentEntry from '../_components/student-entry/StudentEntry';

export const metadata = {
  title:'Set up your study space — KampusLearn',
  description:'Personalise your academic context, courses, goals and study rhythm.',
  robots:{ index:false, follow:false },
};
export default function OnboardingPreviewPage(){
  if(process.env.NODE_ENV !== 'development')notFound();
  return <StudentEntry startAt="onboarding"/>;
}
