'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Brand, Icon } from '../student-entry/StudentEntry';
import StudentShell, { useStudentSession, useStudentTheme } from './StudentShell';
import styles from '../student-entry/StudentEntry.module.css';

export const GOALS = [['understand','Understand my courses','book'],['exams','Prepare for exams','check'],['papers','Practise past questions','file'],['ai','Get help from AI','spark'],['progress','Improve my performance','chart'],['habit','Study more consistently','clock']];
export const MODES = [['quick','Quick sessions','clock'],['deep','Deep study','book'],['exam','Exam revision','target'],['practice','Practice first','check']];
const STEPS = ['Welcome','Profile','Goals','Courses','Preferences','Ready'];
const HEADINGS = ['A good place to begin.','Your academic home.','What matters to you?','Make room for your courses.','Find your study rhythm.','Your space is ready.'];

export default function Onboarding() {
  const { user, profile, loading } = useStudentSession();
  const [theme, setTheme] = useStudentTheme();
  const [settings, setSettings] = useState(null);
  const [courses, setCourses] = useState([]);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const busyRef = useRef(false);
  const heading = useRef(null);
  const router = useRouter();
  useEffect(() => {
    if (user?.role !== 'student') return;
    let active = true;
    setError('');
    api.get('/student/settings').then(res => {
      if (!active) return;
      const data = res.data.data;
      const ids = new Set(data.courses.map(c => c.id));
      setSettings({ ...data.settings, course_ids: data.settings.course_ids.filter(id => ids.has(id)) });
      setCourses(data.courses);
      setStep(data.settings.status === 'draft' ? data.settings.step : 0);
    }).catch(() => { if (active) setError('We couldn’t load your saved setup. Please try again.'); });
    return () => { active = false; };
  }, [user?.id, retry]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'auto' }); }, [step]);
  function update(key, value) { setSettings(s => ({ ...s, [key]: value })); }
  function toggle(key, id) { update(key, settings[key].includes(id) ? settings[key].filter(x => x !== id) : [...settings[key], id]); }
  async function save(next, status) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const result = await api.put('/student/settings', { ...settings, step: next, status: status || settings.status });
      setSettings(result.data.data.settings);
      if (status === 'complete' || status === 'skipped') router.replace('/dashboard');
      else setStep(next);
    } catch (err) { setError(err.response?.data?.message || 'Your choices were not saved. Check your connection and try again.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  if (loading || !user || user.role !== 'student') return <StudentShell/>;
  if (!settings) return <StudentShell><p role={error ? 'alert' : 'status'}>{error || 'Loading your study setup…'}</p>{error && <button onClick={() => setRetry(n => n + 1)}>Try again</button>}</StudentShell>;
  const selected = courses.filter(c => settings.course_ids.includes(c.id));
  function choices(items, key) {
    return <div className={styles.choiceGrid}>{items.map(([id, label, icon]) => <label key={id} className={`${styles.choice} ${settings[key].includes(id) ? styles.chosen : ''}`}><input type="checkbox" checked={settings[key].includes(id)} onChange={() => toggle(key, id)}/><span className={styles.choiceIcon}><Icon name={icon}/></span><strong>{label}</strong><span className={styles.selectionMark}>{settings[key].includes(id) && <Icon name="check" size={13}/>}</span></label>)}</div>;
  }
  return <div className={styles.app} data-theme={theme}>
    <a className={styles.skipLink} href="#setup-main">Skip to content</a>
    <header className={styles.header}><div className={styles.headerInner}><Brand onClick={() => router.push('/')}/><span className={styles.stepCount}>Step {step + 1} of 6</span><button className={styles.iconButton} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}><Icon name={theme === 'light' ? 'moon' : 'sun'}/></button></div></header>
    <main id="setup-main" className={styles.onboarding}>
      <div className={styles.progressHeader}><div className={styles.progressTrack} role="progressbar" aria-label="Student setup" aria-valuemin={1} aria-valuemax={6} aria-valuenow={step + 1}><span style={{ width: `${(step + 1) / 6 * 100}%` }}/></div><ol className={styles.steps}>{STEPS.map((label, i) => <li key={label} className={i === step ? styles.currentStep : i < step ? styles.doneStep : ''}><button disabled={busy || i > step} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined}><span>{i + 1}</span>{label}</button></li>)}</ol></div>
      <div className={`${styles.wizardShell} ${step === 0 ? styles.welcomeShell : ''}`}>
        <section className={styles.formPane}><p className={styles.eyebrow}>YOUR SPACE, YOUR PACE</p><h1 ref={heading} tabIndex={-1}>{HEADINGS[step]}</h1><p className={styles.stepSupport}>{step === 0 ? 'Let’s make KampusLearn feel like your learning space.' : step === 1 ? 'These are the academic details you registered with.' : step === 5 ? 'Review your choices, then start learning.' : 'Choose what fits you. You can change this later from your profile.'}</p>
          <form onSubmit={e => { e.preventDefault(); save(Math.min(step + 1, 5), step === 5 ? 'complete' : undefined); }} aria-busy={busy}>
            <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
              {step === 0 && <div className={styles.welcomeForm}><label className={styles.field}>What should we call you? <span className={styles.optional}>(optional)</span><input autoComplete="given-name" maxLength={60} value={settings.preferred_name} onChange={e => update('preferred_name', e.target.value)} placeholder={user.full_name?.split(' ')[0] || 'Your name'}/></label><div className={styles.welcomeBenefits}><span><Icon name="campus"/>Your campus</span><span><Icon name="target"/>Your goals</span><span><Icon name="clock"/>Your pace</span></div></div>}
              {step === 1 && <div className={styles.readySummary}><dl>{[['Institution',profile?.institution_name],['Faculty / School',profile?.faculty_name || profile?.school_name],['Department',profile?.department_name],['Level',profile?.level]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl></div>}
              {step === 2 && <fieldset className={styles.choiceFieldset}><legend>What would you like to work on?</legend>{choices(GOALS, 'goals')}</fieldset>}
              {step === 3 && <div className={styles.courseStep}><div className={styles.courseListHeading}><h2>Your semester list</h2><span>{selected.length} selected</span></div><label className={styles.courseSearch}><Icon name="search"/><input type="search" aria-label="Find a course" value={search} onChange={e => setSearch(e.target.value)} placeholder="Course name or code"/></label><div className={styles.choiceGrid}>{courses.filter(c => `${c.code} ${c.title}`.toLowerCase().includes(search.toLowerCase())).map(c => <label key={c.id} className={`${styles.choice} ${settings.course_ids.includes(c.id) ? styles.chosen : ''}`}><input type="checkbox" checked={settings.course_ids.includes(c.id)} onChange={() => toggle('course_ids', c.id)}/><span><strong>{c.code}</strong><small>{c.title} · {c.semester} semester</small></span><span className={styles.selectionMark}>{settings.course_ids.includes(c.id) && <Icon name="check" size={13}/>}</span></label>)}</div>{!courses.length && <p className={styles.emptyCourses}>Your department’s courses haven’t been added for this level yet. You can continue and choose courses later.</p>}{courses.length > 0 && !courses.some(c => `${c.code} ${c.title}`.toLowerCase().includes(search.toLowerCase())) && <p className={styles.emptyCourses}>No courses match that search.</p>}</div>}
              {step === 4 && <><fieldset className={styles.choiceFieldset}><legend>How do you like to learn?</legend>{choices(MODES, 'modes')}</fieldset><div className={styles.fields}><label className={styles.field}>Daily study time<select value={settings.daily_minutes} onChange={e => update('daily_minutes', Number(e.target.value))}>{[15,30,60,120].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label><label className={styles.field}>Weekly CBT goal<select value={settings.weekly_target} onChange={e => update('weekly_target', Number(e.target.value))}>{Array.from({ length: 14 }, (_,i) => i + 1).map(n => <option key={n} value={n}>{n} practice {n === 1 ? 'session' : 'sessions'}</option>)}</select></label><p className={styles.fieldHint}>Completed CBT sessions count toward your weekly progress. Your study time is a plan, not a timer.</p></div></>}
              {step === 5 && <div className={styles.readySummary}><dl>{[['Name',settings.preferred_name || user.full_name,0],['Goals',GOALS.filter(g => settings.goals.includes(g[0])).map(g => g[1]).join(' · ') || 'Choose later',2],['Courses',selected.map(c => c.code).join(' · ') || 'Add later',3],['Study rhythm',MODES.filter(m => settings.modes.includes(m[0])).map(m => m[1]).join(' · ') || 'Your own pace',4],['Daily plan',`${settings.daily_minutes} minutes`,4],['Weekly goal',`${settings.weekly_target} CBT sessions`,4]].map(([label,value,target]) => <div key={label}><dt>{label}</dt><dd>{value}</dd><button type="button" onClick={() => setStep(target)} aria-label={`Edit ${label.toLowerCase()}`}>Edit</button></div>)}</dl></div>}
              {error && <p role="alert" className={styles.error}>{error}</p>}
              <div className={styles.formActions}>{step === 0 ? <button type="button" className={styles.textButton} onClick={() => save(5, 'skipped')}>Skip for now</button> : <button type="button" className={styles.textButton} onClick={() => setStep(step - 1)}><Icon name="back" size={17}/>Back</button>}<button className={styles.primary} type="submit">{busy ? 'Saving…' : step === 0 ? 'Let’s get started' : step === 5 ? 'Start learning' : 'Continue'}<Icon name="arrow" size={18}/></button></div>
              {step >= 2 && step <= 4 && <button type="button" className={styles.skipStep} onClick={() => save(step + 1)}>Decide later</button>}
            </fieldset>
          </form>
        </section>
        <aside className={styles.studyAside}><div className={styles.asideTop}><Icon name={['spark','campus','target','book','clock','check'][step]}/><span>MADE FOR YOUR NEXT CHAPTER</span></div><h2>A little structure.<br/>A clearer start.</h2><div className={styles.planCard}><div className={styles.planTitle}><Icon name="home"/><strong>{settings.preferred_name || user.full_name?.split(' ')[0]}’s study space</strong></div><div className={styles.planCampus}><small>{profile?.institution_short}</small><strong>{profile?.department_name}</strong></div><div className={styles.planCounts}><div><strong>{selected.length}</strong><span>Courses</span></div><div><strong>{settings.goals.length}</strong><span>Goals</span></div><div><strong>{settings.daily_minutes}m</strong><span>Daily plan</span></div></div></div><p className={styles.asideNote}>Your choices are saved to your account when you continue, so you can pick up on another device.</p></aside>
      </div>
    </main>
  </div>;
}
