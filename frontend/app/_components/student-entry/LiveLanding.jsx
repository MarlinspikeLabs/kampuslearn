'use client';

import { useRouter } from 'next/navigation';
import StudentEntry from './StudentEntry';

export default function LiveLanding() {
  const router = useRouter();
  function openAccount(mode) {
    const ref = new URLSearchParams(window.location.search).get('ref');
    const suffix = ref ? `?ref=${encodeURIComponent(ref.slice(0,64))}` : '';
    router.push(`${mode === 'login' ? '/login' : '/register'}${suffix}`);
  }
  return <StudentEntry onAccountNavigate={openAccount} dashboardHref="/dashboard"/>;
}
