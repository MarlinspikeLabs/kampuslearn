'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Brand, Icon } from './StudentEntry';
import { AuthStory } from './StudentAuth';
import styles from './StudentEntry.module.css';
import live from './LiveAccount.module.css';

const UNI_LEVELS = ['100','200','300','400','500','600'];
const POLY_LEVELS = ['ND1','ND2','HND1','HND2'];
const INITIAL = { full_name:'', email:'', password:'', institution_id:'', parent_id:'', department_id:'', level:'', matric_number:'', referral_code:'' };

// Discard late responses when the student changes the parent dropdown or leaves.
function useOptions(path) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ path:null, items:[], status:'idle' });
  useEffect(() => {
    let current = true;
    if (!path) { setState({ path:null, items:[], status:'idle' }); return; }
    setState({ path, items:[], status:'loading' });
    api.get(path).then(response => {
      if (!current) return;
      const items = response.data?.data;
      if (!Array.isArray(items)) throw new Error('Invalid list response');
      setState({ path, items:items.map(item => ({ ...item, id:String(item.id) })), status:'ready' });
    }).catch(() => {
      if (current) setState({ path, items:[], status:'error' });
    });
    return () => { current = false; };
  }, [path, attempt]);
  const result = state.path === path ? state : { items:[], status:path ? 'loading' : 'idle' };
  return { ...result, retry:() => setAttempt(value => value + 1) };
}

function ListState({ list, label }) {
  if (list.status === 'loading') return <p className={live.listState} role="status">Loading {label}…</p>;
  if (list.status === 'error') return <div className={live.listState} role="alert">We couldn’t load {label}.<button type="button" onClick={list.retry}>Try again</button></div>;
  if (list.status === 'ready' && !list.items.length) return <p className={live.listState}>No {label} are available yet.</p>;
  return null;
}

export default function LiveAccount({ mode='login' }) {
  const signup = mode === 'signup';
  const router = useRouter();
  const { login, register } = useAuth();
  const [form, setForm] = useState(INITIAL);
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState('');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [errorAttempt, setErrorAttempt] = useState(0);
  const [notice, setNotice] = useState('');
  const [theme, setTheme] = useState('light');
  const [themeReady, setThemeReady] = useState(false);
  const titleRef = useRef(null);
  const errorRef = useRef(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const institutions = useOptions(signup ? '/institutions' : null);
  const institution = institutions.items.find(item => item.id === form.institution_id);
  const poly = institution?.type === 'polytechnic';
  const parentType = poly ? 'schools' : 'faculties';
  const supported = institution && ['university','polytechnic'].includes(institution.type);
  const parents = useOptions(signup && supported ? `/institutions/${encodeURIComponent(form.institution_id)}/${parentType}` : null);
  const parent = parents.items.find(item => item.id === form.parent_id);
  const departments = useOptions(signup && parent ? `/institutions/${parentType}/${encodeURIComponent(form.parent_id)}/departments` : null);
  const department = departments.items.find(item => item.id === form.department_id);
  const levels = poly ? POLY_LEVELS : UNI_LEVELS;

  useEffect(() => {
    mounted.current = true;
    const referral = new URLSearchParams(window.location.search).get('ref');
    if (referral) setForm(value => ({ ...value, referral_code:referral.slice(0,64).trim().toUpperCase() }));
    try {
      const saved = localStorage.getItem('kl-preview-theme-v2');
      if (saved === 'light' || saved === 'dark') setTheme(saved);
    } catch (_) {}
    setThemeReady(true);
    const font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(font);
    return () => { mounted.current = false; font.remove(); };
  }, []);
  useEffect(() => {
    if (themeReady) { try { localStorage.setItem('kl-preview-theme-v2',theme); } catch (_) {} }
  }, [theme, themeReady]);
  useEffect(() => {
    window.scrollTo({ top:0, behavior:'auto' });
    titleRef.current?.focus({ preventScroll:true });
  }, [step]);
  useEffect(() => { if (errorAttempt) errorRef.current?.focus(); }, [errorAttempt]);

  function update(key, value) {
    setErrors(current => ({ ...current, [key]:undefined }));
    setMessage('');
    setForm(current => {
      const next = { ...current, [key]:value };
      if (key === 'institution_id') Object.assign(next, { parent_id:'', department_id:'', level:'' });
      if (key === 'parent_id') Object.assign(next, { department_id:'', level:'' });
      if (key === 'department_id') next.level = '';
      return next;
    });
  }
  function showErrors(next, text='Please check the highlighted fields.') {
    setErrors(next); setMessage(text); setErrorAttempt(value => value + 1);
  }
  function validateAccount() {
    const next = {};
    if (signup && form.full_name.trim().length < 2) next.full_name = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (!form.password || (signup && form.password.length < 8)) next.password = signup ? 'Use at least 8 characters.' : 'Enter your password.';
    return next;
  }
  function validateAcademic() {
    const next = {};
    if (!supported) next.institution_id = 'Choose a university or polytechnic.';
    if (!parent) next.parent_id = `Choose your ${poly ? 'school' : 'faculty'}.`;
    if (!department) next.department_id = 'Choose your department.';
    if (!levels.includes(form.level)) next.level = 'Choose your level.';
    return next;
  }
  function navigateAccount(nextMode) {
    if (busyRef.current) return;
    setForm(current => ({ ...current, password:'' })); setVisible(false);
    const suffix = form.referral_code ? `?ref=${encodeURIComponent(form.referral_code)}` : '';
    router.push(`${nextMode === 'login' ? '/login' : '/register'}${suffix}`);
  }
  function back() { setMessage(''); setErrors({}); setStep(value => Math.max(0,value - 1)); }
  async function submit(event) {
    event.preventDefault();
    if (busyRef.current || complete) return;
    const accountErrors = validateAccount();
    if (signup && step === 0) {
      if (Object.keys(accountErrors).length) { showErrors(accountErrors); return; }
      setErrors({}); setMessage(''); setVisible(false); setStep(1); return;
    }
    if (signup && step === 1) {
      const academicErrors = validateAcademic();
      if (Object.keys(academicErrors).length) { showErrors(academicErrors); return; }
      setErrors({}); setMessage(''); setStep(2); return;
    }
    if (Object.keys(accountErrors).length) { if (signup) setStep(0); showErrors(accountErrors); return; }
    if (signup) {
      const academicErrors = validateAcademic();
      if (Object.keys(academicErrors).length) { setStep(1); showErrors(academicErrors); return; }
    }
    busyRef.current = true; setBusy(true); setMessage(''); setErrors({});
    try {
      let user;
      if (signup) {
        user = await register({
          full_name:form.full_name.trim(), email:form.email.trim().toLowerCase(), password:form.password,
          role:'student', institution_id:form.institution_id,
          ...(poly ? { school_id:form.parent_id } : { faculty_id:form.parent_id }),
          department_id:form.department_id, level:form.level,
          ...(form.matric_number.trim() ? { matric_number:form.matric_number.trim() } : {}),
          ...(form.referral_code.trim() ? { referral_code:form.referral_code.trim().toUpperCase() } : {}),
        });
      } else {
        ({ user } = await login(form.email.trim().toLowerCase(),form.password));
      }
      if (!mounted.current) return;
      setForm(current => ({ ...current, password:'' })); setVisible(false);
      const destination = ['admin','super_admin'].includes(user.role) ? '/admin' : '/dashboard';
      setComplete(destination); router.replace(destination);
    } catch (error) {
      if (!mounted.current) return;
      const serverMessage = error.response?.data?.message;
      const text = typeof serverMessage === 'string' ? serverMessage.slice(0,250)
        : error.response ? 'We couldn’t complete that request. Please try again.'
        : 'We couldn’t reach KampusLearn. Check your connection and try again.';
      // Keep academic choices on failures; a duplicate email can be corrected in Account.
      if (signup && error.response?.status === 409) {
        setStep(0); showErrors({ email:text },text);
      } else { showErrors({},text); }
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function fieldProps(name, required=true) {
    return { name, value:form[name], onChange:event => update(name,event.target.value), disabled:busy,
      'aria-required':required, 'aria-invalid':!!errors[name], 'aria-describedby':errors[name] ? `${name}-error` : undefined };
  }
  function fieldError(name) { return errors[name] ? <span className={styles.fieldError} id={`${name}-error`}>{errors[name]}</span> : null; }
  const heading = complete ? (signup ? 'Your account is ready.' : 'You’re logged in.')
    : !signup ? 'Welcome back.' : ['Start learning smarter.','Where do you study?','Ready to begin?'][step];

  return <div className={styles.app} data-theme={theme}>
    <a className={styles.skipLink} href="#entry-main">Skip to content</a>
    <header className={styles.header}><div className={styles.headerInner}>
      <Brand onClick={() => { if (!busyRef.current) router.push(form.referral_code ? `/?ref=${encodeURIComponent(form.referral_code)}` : '/'); }}/>
      <span className={styles.authHeaderNote}>A good place to begin.</span>
      <button type="button" className={styles.iconButton} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}><Icon name={theme === 'light' ? 'moon' : 'sun'}/></button>
    </div></header>
    <main id="entry-main" className={styles.authPage}>
      <div className={styles.authShell}>
        <AuthStory Icon={Icon}/>
        <section className={styles.authFormPane} aria-labelledby="account-heading">
          {!complete && <div className={styles.authTabs} data-mode={mode} role="group" aria-label="Account action">
            <button type="button" aria-pressed={!signup} disabled={busy} onClick={() => { if (signup) navigateAccount('login'); }}>Log in</button>
            <button type="button" aria-pressed={signup} disabled={busy} onClick={() => { if (!signup) navigateAccount('signup'); }}>Create account</button>
          </div>}
          {signup && !complete && <ol className={live.steps} aria-label="Registration progress">{['Account','Academic profile','Confirm'].map((label,index) => <li key={label} aria-current={index === step ? 'step' : undefined}><span>{index < step ? <Icon name="check" size={14}/> : index + 1}</span>{label}</li>)}</ol>}
          <h1 ref={titleRef} tabIndex={-1} id="account-heading">{heading}</h1>
          <p className={styles.authSupport}>{complete ? 'Opening your learning space…' : !signup ? 'Log in to your learning space and pick up where you left off.' : ['Create your KampusLearn account and build your personalised academic experience.','Choose your institution and department so we can find the right courses for you.','Check your details before creating your account.'][step]}</p>
          {complete ? <div className={live.success}><a href={complete}>Continue to {complete === '/admin' ? 'admin' : 'your dashboard'} <Icon name="arrow" size={17}/></a></div> : <form className={styles.authForm} onSubmit={submit} noValidate aria-busy={busy}>
            {message && <p ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>{message}</p>}
            {(!signup || step === 0) && <>
              {signup && <label className={styles.field}>Full name<input {...fieldProps('full_name')} autoComplete="name" maxLength={120} placeholder="e.g. Usman Waziri"/>{fieldError('full_name')}</label>}
              <label className={styles.field}>Email address<input {...fieldProps('email')} type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} placeholder="you@example.com"/>{fieldError('email')}</label>
              <div className={styles.passwordField}>
                <div className={styles.passwordLabel}><label htmlFor="account-password">Password</label>{!signup && <button type="button" disabled={busy} onClick={() => setNotice('Password recovery is not available yet. Please contact the KampusLearn team for help accessing your account.')}>Forgot password?</button>}</div>
                <div className={styles.passwordInput}><input {...fieldProps('password')} id="account-password" type={visible ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} maxLength={128} placeholder={signup ? 'Create a password' : 'Enter your password'}/><button type="button" disabled={busy} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)}><Icon name={visible ? 'eyeOff' : 'eye'}/></button></div>
                {fieldError('password')}{signup && <p className={live.passwordHint}>Use at least 8 characters. Choose a long, unique password.</p>}
              </div>
            </>}
            {signup && step === 1 && <>
              <label className={styles.field}>Institution<select {...fieldProps('institution_id')} disabled={busy || institutions.status !== 'ready'}><option value="">Select institution</option>{institutions.items.filter(item => ['university','polytechnic'].includes(item.type)).map(item => <option key={item.id} value={item.id}>{item.name}{item.short_name ? ` (${item.short_name})` : ''}</option>)}</select>{fieldError('institution_id')}</label>
              <ListState list={institutions} label="institutions"/>
              {supported && <>
                <label className={styles.field}>{poly ? 'School' : 'Faculty'}<select {...fieldProps('parent_id')} disabled={busy || parents.status !== 'ready' || !parents.items.length}><option value="">Select {poly ? 'school' : 'faculty'}</option>{parents.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldError('parent_id')}</label>
                <ListState list={parents} label={parentType}/>
              </>}
              {parent && <>
                <label className={styles.field}>Department<select {...fieldProps('department_id')} disabled={busy || departments.status !== 'ready' || !departments.items.length}><option value="">Select department</option>{departments.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldError('department_id')}</label>
                <ListState list={departments} label="departments"/>
              </>}
              {department && <label className={styles.field}>Level<select {...fieldProps('level')}><option value="">Select level</option>{levels.map(value => <option key={value} value={value}>{value}</option>)}</select>{fieldError('level')}</label>}
              <label className={styles.field}>Matric number <span className={styles.optional}>(optional)</span><input {...fieldProps('matric_number',false)} maxLength={80} placeholder="e.g. 22/ENG/CPE/001"/></label>
              <label className={styles.field}>Referral code <span className={styles.optional}>(optional)</span><input {...fieldProps('referral_code',false)} maxLength={64} autoCapitalize="characters" spellCheck={false} placeholder="Enter a referral code"/></label>
            </>}
            {signup && step === 2 && <dl className={live.review}>{[
              ['Full name',form.full_name.trim()],['Email',form.email.trim().toLowerCase()],['Institution',institution?.name],
              [poly ? 'School' : 'Faculty',parent?.name],['Department',department?.name],['Level',form.level],
              ...(form.matric_number.trim() ? [['Matric number',form.matric_number.trim()]] : []),
              ...(form.referral_code.trim() ? [['Referral code',form.referral_code.trim().toUpperCase()]] : []),
            ].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
            {signup && step > 0 ? <div className={live.actions}><button type="button" className={styles.textButton} onClick={back} disabled={busy}><Icon name="back" size={17}/> Back</button><button type="submit" className={styles.primary} disabled={busy}>{busy ? 'Creating account…' : step === 1 ? 'Review details' : 'Create my account'}{!busy && <Icon name="arrow" size={17}/>}</button></div>
              : <button type="submit" className={styles.primary} disabled={busy}>{busy ? 'Logging in…' : signup ? 'Continue' : 'Log in'}{!busy && <Icon name="arrow" size={17}/>}</button>}
          </form>}
          {notice && <p role="status" className={live.notice}>{notice}</p>}
          {!complete && <p className={styles.authSwitch}>{signup ? 'Already have an account?' : 'New to KampusLearn?'} <button type="button" disabled={busy} onClick={() => navigateAccount(signup ? 'login' : 'signup')}>{signup ? 'Log in' : 'Create an account'}</button></p>}
        </section>
      </div>
      <p className={styles.authFooter}>KampusLearn · Your courses, your possibilities.</p>
    </main>
  </div>;
}
