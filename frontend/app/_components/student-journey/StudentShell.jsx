'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Brand, Icon } from './Visuals';
import styles from './StudentJourney.module.css';

export function useStudentSession() {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) {
      // A temporary /me failure must not look like a successful logout.
      if (!localStorage.getItem('kl_token')) router.replace('/login');
    } else if (auth.user.role !== 'student') router.replace(['admin','super_admin'].includes(auth.user.role) ? '/admin' : '/courses');
  }, [auth.loading, auth.user, router]);
  return auth;
}

export function useStudentTheme() {
  const [theme, setTheme] = useState('light');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const saved = localStorage.getItem('kl-preview-theme-v2'); if (['light','dark'].includes(saved)) setTheme(saved); } catch (_) {}
    setReady(true);
    const font = document.createElement('link'); font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(font);
    return () => font.remove();
  }, []);
  useEffect(() => { if (ready) { try { localStorage.setItem('kl-preview-theme-v2', theme); } catch (_) {} } }, [theme, ready]);
  return [theme, setTheme];
}

export default function StudentShell({ children, title, legacy = false }) {
  const { user, loading } = useStudentSession();
  const [theme, setTheme] = useStudentTheme();
  const pathname = usePathname();
  const router = useRouter();
  const nav = [['Home','home','/dashboard'],['Learn','book','/learn'],['Practice','check','/exams'],['AI','spark','/ai-chat'],['More','more','/more']];
  const active = ['/learn','/courses','/materials','/past-questions','/read'].includes(pathname) ? '/learn' : ['/tokens','/profile','/notifications','/onboarding'].includes(pathname) ? '/more' : pathname;
  const navigation = () => nav.map(([label,icon,href]) => <Link key={href} href={href} className={`${styles.navItem} ${active === href ? styles.active : ''}`} aria-current={active === href ? 'page' : undefined}><Icon name={icon}/><span>{label}</span></Link>);
  if (loading) return <div className={styles.app}><p className={styles.loading} role="status">Opening your learning space…</p></div>;
  if (!user) return <div className={styles.app}><div className={styles.loading}><p>We couldn’t load your account.</p><button className={styles.secondaryButton} onClick={() => window.location.reload()}>Try again</button><Link href="/login">Log in</Link></div></div>;
  if (user.role !== 'student') return null;
  return <div className={styles.app} data-theme={theme}>
    <a className={styles.skip} href="#student-main">Skip to content</a>
    <header className={styles.topbar}><div className={styles.topbarInner}>
      <Brand onClick={() => router.push('/dashboard')}/>
      <nav className={styles.desktopNav} aria-label="Student navigation">{navigation()}</nav>
      <div className={styles.headerActions}>
        <button className={styles.iconButton} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}><Icon name={theme === 'light' ? 'moon' : 'sun'}/></button>
        <Link className={styles.iconButton} href="/notifications" aria-label="Notifications"><Icon name="bell"/></Link>
        <Link className={styles.iconButton} href="/profile" aria-label="View and edit profile"><span className={styles.avatar}>{user.full_name?.trim().slice(0,1).toUpperCase() || 'S'}</span></Link>
      </div>
    </div></header>
    <main id="student-main" className={`${styles.main} ${legacy ? styles.legacy : ''} ${legacy && pathname === '/ai-chat' ? styles.chatMain : ''}`} tabIndex={-1}>{title && <h1 className={styles.pageTitle}>{title}</h1>}{children}</main>
    <nav className={styles.bottomNav} aria-label="Student navigation">{navigation()}</nav>
  </div>;
}
