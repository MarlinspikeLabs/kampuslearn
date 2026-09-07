'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import StudentShell, { useStudentSession } from './StudentShell';
import { CourseArt, Icon } from './Visuals';
import styles from './StudentJourney.module.css';

function useResource(path, userId) {
  const [state, setState] = useState({ data: null, error: false });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!path || !userId) return;
    let active = true; setState({ data: null, error: false });
    api.get(path).then(res => { if (active) setState({ data: res.data.data, error: false }); })
      .catch(() => { if (active) setState({ data: null, error: true }); });
    return () => { active = false; };
  }, [path, userId, retry]);
  return { ...state, retry: () => setRetry(n => n + 1) };
}

function ErrorNotice({ children, retry }) {
  return <div className={styles.errorNotice} role="alert"><p>{children}</p><button className={styles.secondaryButton} onClick={retry}>Try again</button></div>;
}

export function courseVisual(course) {
  const text = `${course.code} ${course.title}`.toLowerCase();
  const seed = Array.from(course.id || course.code).reduce((sum, c) => ((sum * 31 + c.charCodeAt(0)) >>> 0), 0);
  const kind = /circuit|electr|eee/.test(text) ? 'circuit' : /math|account|stat|mth/.test(text) ? 'graph' : /data|program|csc/.test(text) ? 'tree' : /architect|computer|cpe/.test(text) ? 'cpu' : ['cpu','circuit','graph','tree'][seed % 4];
  return { kind, tone: ['mint','lilac','sky','peach'][seed % 4], angle: seed % 180, spacing: 12 + seed % 17 };
}

function CourseCard({ course }) {
  const visual = courseVisual(course);
  const query = `?course_id=${encodeURIComponent(course.id)}`;
  return <article className={styles.courseCard}>
    <div className={`${styles.courseArt} ${styles[visual.tone]}`} style={{ backgroundImage: `repeating-linear-gradient(${visual.angle}deg,transparent 0 ${visual.spacing}px,currentColor ${visual.spacing}px ${visual.spacing + 0.3}px)` }}><CourseArt kind={visual.kind}/><span className={styles.artCode}>{course.code}</span></div>
    <div className={styles.courseBody}><span className={styles.courseCode}>{course.code} · {course.semester}</span><h2>{course.title}</h2><div className={styles.courseLinks}><Link href={`/materials${query}`}>Materials <Icon name="arrow" size={16}/></Link><Link href={`/past-questions${query}`}>Past questions</Link></div></div>
  </article>;
}

function ProfileForm() {
  const { user, profile, setUser, logout } = useStudentSession();
  const [name, setName] = useState(user.full_name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function save(e) {
    e.preventDefault(); if (pending.current) return;
    if (!name.trim()) { setFailed(true); setStatus('Enter your full name.'); return; }
    pending.current = true; setBusy(true); setStatus('');
    try {
      const res = await api.put('/auth/profile', { full_name: name.trim(), phone: phone.trim() });
      const next = { ...user, ...res.data.data.user };
      setUser(next); try { localStorage.setItem('kl_user', JSON.stringify(next)); } catch (_) {}
      setName(next.full_name); setFailed(false); setStatus('Your profile has been saved.');
    } catch (err) { setFailed(true); setStatus(err.response?.data?.message || 'Your profile was not saved. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className={styles.profilePanel}><div className={styles.profileSummary}><span className={styles.largeAvatar}>{user.full_name.slice(0,1)}</span><div><h1>Your profile</h1><p>{user.email}</p></div></div><form onSubmit={save} aria-busy={busy}><h3>Personal information</h3><div className={styles.formGrid}><label>Full name<input required maxLength={120} autoComplete="name" value={name} disabled={busy} onChange={e => setName(e.target.value)}/></label><label>Phone <span>(optional)</span><input type="tel" maxLength={30} autoComplete="tel" value={phone} disabled={busy} onChange={e => setPhone(e.target.value)}/></label></div><p className={failed ? styles.errorNotice : styles.saveStatus} role={failed ? 'alert' : 'status'}>{status}</p><button type="submit" className={styles.primaryButton} disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></form><h3>Academic information</h3><dl className={styles.profileDetails}>{[['Institution',profile?.institution_name],['Department',profile?.department_name],['Faculty / School',profile?.faculty_name || profile?.school_name],['Level',profile?.level],['Matric number',profile?.matric_number]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl><div className={styles.actionRow}><Link className={styles.secondaryButton} href="/onboarding">Edit study setup <Icon name="arrow" size={17}/></Link><button className={styles.secondaryButton} onClick={logout}>Log out</button></div></section>;
}

export default function StudentDashboard({ view = 'Home' }) {
  const { user, profile, logout } = useStudentSession();
  const router = useRouter();
  const studentId = user?.role === 'student' ? user.id : null;
  const setup = useResource('/student/settings', studentId);
  const overview = useResource(view === 'Home' ? '/student/overview' : null, studentId);
  const wallet = useResource(view === 'Home' ? '/tokens/balance' : null, studentId);
  const [query, setQuery] = useState('');
  const [allCourses, setAllCourses] = useState(false);
  const [greeting, setGreeting] = useState('Welcome back');
  const [date, setDate] = useState('Your learning space');
  useEffect(() => {
    const now = new Date(); const hour = now.getHours();
    setGreeting(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');
    setDate(now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }));
  }, []);
  useEffect(() => { if (setup.data?.settings.status === 'draft') router.replace('/onboarding'); }, [setup.data, router]);
  if (!studentId) return <StudentShell/>;
  if (setup.error) return <StudentShell><ErrorNotice retry={setup.retry}>We couldn’t load your study space.</ErrorNotice></StudentShell>;
  if (!setup.data || setup.data.settings.status === 'draft') return <StudentShell><p role="status">Opening your study space…</p></StudentShell>;
  const { settings, courses } = setup.data;
  const selected = courses.filter(c => settings.course_ids.includes(c.id));
  const tracked = overview.data?.courses || [];
  const strongest = tracked.filter(c => c.knowledge >= 50).slice(0,3);
  const review = [...tracked].filter(c => c.weak_topics > 0 || c.knowledge < 50).sort((a,b) => a.knowledge - b.knowledge).slice(0,3);
  const nextCourse = review[0] || selected[0];
  const progress = overview.data ? Math.min(100, Math.round(overview.data.exams.weekly_attempts / settings.weekly_target * 100)) : null;
  const name = settings.preferred_name || user.full_name?.split(' ')[0] || 'Student';
  const nextHref = review.length ? `/exams?course_id=${encodeURIComponent(nextCourse.id)}` : settings.goals.includes('papers') ? '/past-questions' : settings.goals.includes('ai') ? '/ai-chat' : selected.length ? `/materials?course_id=${encodeURIComponent(nextCourse.id)}` : '/learn';
  const nextTitle = review.length ? `Review ${nextCourse.code}` : settings.goals.includes('papers') ? 'Explore past questions' : settings.goals.includes('ai') ? 'Work through a question' : selected.length ? `Study ${nextCourse.code}` : 'Choose a course to begin';
  return <StudentShell>
    {view === 'Home' && <>
      <section className={styles.greeting}><div className={styles.greetingCopy}><p className={styles.date}>{date}</p><h1>{greeting}, {name} 👋</h1><p className={styles.subtitle}>Ready to make progress today?</p><div className={styles.identity}>{[profile?.department_name,profile?.level && `${profile.level}${/^\d/.test(profile.level) ? ' Level' : ''}`,profile?.institution_short].filter(Boolean).map(item => <span key={item}>{item}</span>)}</div></div><Link href="/tokens" className={styles.walletChip} aria-label={wallet.data ? `Wallet: ${wallet.data.balance} KP` : 'Open KP wallet'}><span className={styles.walletGlyph}><Icon name="wallet"/></span><span className={styles.walletInfo}><span className={styles.walletCaption}>KampusCoin</span><strong>{wallet.data ? Number(wallet.data.balance).toLocaleString() : '—'} <small>KP</small></strong><span className={styles.walletCaption}>Open wallet</span></span><Icon name="arrow" size={17}/></Link></section>
      {wallet.error && <ErrorNotice retry={wallet.retry}>Your wallet balance couldn’t load.</ErrorNotice>}
      <div className={styles.homeCards}>
        <section className={styles.progressCard}><h2>Your Weekly Progress</h2><div className={styles.ring} role="img" aria-label={progress === null ? 'Weekly progress unavailable' : `${progress}% of weekly CBT goal completed`}><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" fill="none" stroke="#ffffff24" strokeWidth="10"/><circle cx="60" cy="60" r="50" fill="none" stroke="#81dfb5" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(progress || 0) / 100 * 314.16} 314.16`}/></svg><strong>{progress === null ? '—' : `${progress}%`}</strong></div><p>{overview.data ? `${overview.data.exams.weekly_attempts} of ${settings.weekly_target} CBT sessions` : overview.error ? 'Progress unavailable' : 'Loading progress…'}</p><Link className={styles.onDarkLink} href="/onboarding">Edit weekly goal</Link></section>
        <section className={styles.nextCard}><span className={styles.nextLabel}><Icon name="spark" size={17}/>Your Next Best Action</span><h2>{nextTitle}</h2><p className={styles.nextTopic}>{review.length ? `${nextCourse.title} has areas to strengthen.` : settings.goals.includes('ai') ? 'Bring a question from your course.' : settings.goals.includes('papers') ? 'Get familiar with your course’s exam questions.' : nextCourse?.title || 'Your materials and past questions live in Learn.'}</p><Link className={styles.primaryButton} href={nextHref}>Let’s begin <Icon name="arrow" size={17}/></Link></section>
      </div>
      <section className={styles.academicSection}><div className={styles.sectionHeading}><h2>Your Academic Progress</h2></div>{overview.error ? <ErrorNotice retry={overview.retry}>Your academic progress couldn’t load.</ErrorNotice> : <dl className={styles.academicStats}>{[['CBT sessions completed',overview.data?.exams.attempts],['Average CBT score',overview.data ? overview.data.exams.average === null ? '—' : `${overview.data.exams.average}%` : undefined],['Courses tracked',overview.data?.courses.length],['AI messages',overview.data?.ai_messages]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl>}
        <div className={styles.insightsGrid}><section className={styles.insightCard}><h3>Strongest Courses</h3><p className={styles.insightHint}>Knowledge scores from your practice activity.</p>{strongest.length ? strongest.map(c => <div key={c.id} className={styles.knowledgeRow}><div><span>{c.title}</span><strong>{c.knowledge}%</strong></div><div className={styles.knowledgeBar}><span style={{ width: `${c.knowledge}%` }}/></div></div>) : <p className={styles.emptyCopy}>{overview.data ? 'Complete CBT practice to start building your course knowledge profile.' : 'Your course knowledge will appear when progress loads.'}</p>}</section><section className={styles.insightCard}><h3>Courses to Review</h3>{review.length ? review.map(c => <Link className={styles.reviewLink} key={c.id} href={`/exams?course_id=${encodeURIComponent(c.id)}`}><span><strong>{c.code}</strong><span>{c.title}</span></span><Icon name="arrow" size={18}/></Link>) : <p className={styles.emptyCopy}>{overview.data ? tracked.length ? 'No courses currently flagged for review.' : 'Your practice results will help identify where to focus.' : 'Waiting for your course knowledge.'}</p>}</section></div>
      </section>
    </>}
    {view === 'Learn' && <><div className={styles.pageHeading}><h1>Your learning space</h1><p>Course materials and past questions, together.</p></div><div className={styles.actionRow}><Link className={styles.secondaryButton} href="/materials"><Icon name="file"/>All materials</Link><Link className={styles.secondaryButton} href="/past-questions"><Icon name="book"/>Past questions</Link><Link className={styles.secondaryButton} href="/onboarding">Choose my courses</Link></div><div className={styles.learnControls}><label className={styles.searchField}><Icon name="search"/><input type="search" aria-label="Search courses" value={query} placeholder="Course name or code" onChange={e => setQuery(e.target.value)}/></label><label><input type="checkbox" checked={allCourses} onChange={e => setAllCourses(e.target.checked)}/> All courses at my level</label></div><div className={styles.courseGrid}>{(allCourses ? courses : selected).filter(c => `${c.code} ${c.title}`.toLowerCase().includes(query.toLowerCase())).map(c => <CourseCard key={c.id} course={c}/>)}{!(allCourses ? courses : selected).some(c => `${c.code} ${c.title}`.toLowerCase().includes(query.toLowerCase())) && <div className={styles.empty}><Icon name="book" size={32}/><h2>{query ? 'No matching courses' : selected.length || allCourses ? 'No courses here yet' : 'Build your semester list'}</h2><p>{query ? 'Try another course name or code.' : courses.length ? 'Choose your courses in study setup, or show all courses at your level.' : 'Your department’s catalogue is still being added. You can browse all materials above.'}</p></div>}</div></>}
    {view === 'Profile' && <ProfileForm key={user.id}/>}
    {view === 'More' && <><div className={styles.pageHeading}><h1>More for your study life</h1></div><div className={styles.moreGrid}>{[['Your profile','View and edit your information','user','/profile'],['KP wallet','Balance, downloads and referrals','wallet','/tokens'],['Study setup','Your goals, courses and preferences','book','/onboarding'],['Notifications','Updates from KampusLearn','bell','/notifications']].map(([title,description,icon,href]) => <Link className={styles.menuCard} href={href} key={href}><Icon name={icon} size={25}/><span><strong>{title}</strong><small>{description}</small></span><Icon name="arrow" size={18}/></Link>)}</div><button className={styles.secondaryButton} onClick={logout}>Log out</button></>}
  </StudentShell>;
}
