'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './StudentEntry.module.css';

// Visual journey only. Credentials stay in component memory, are never submitted,
// and are cleared when advancing, switching modes or leaving this component.
export default function StudentAuth({ initialMode='login', Icon, onOnboard, dashboardHref }) {
  const [view,setView] = useState(initialMode);
  const [fullName,setFullName] = useState('');
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [visible,setVisible] = useState(false);
  const [errors,setErrors] = useState({});
  const [validationAttempt,setValidationAttempt] = useState(0);
  const [notice,setNotice] = useState('');
  const titleRef = useRef(null);
  const errorRef = useRef(null);
  const isSignup=view==='signup';
  const isForm=view==='signup'||view==='login';
  const titles={signup:'Start learning smarter.',login:'Welcome back.',forgot:'Let’s get you back in.',reset:'Your reset request preview.',verify:'Verify your email.',verified:'A fresh start, made for you.',loggedin:'Your learning space awaits.'};

  useEffect(()=>{window.scrollTo({top:0,behavior:'auto'});titleRef.current?.focus({preventScroll:true});},[view]);
  useEffect(()=>{if(validationAttempt)errorRef.current?.focus();},[validationAttempt]);
  function changeView(next){setView(next);setErrors({});setNotice('');setPassword('');setVisible(false);}
  function clearError(field){setErrors(e=>({...e,[field]:undefined}));}
  function submit(event){
    event.preventDefault();const nextErrors={};
    if(isSignup&&fullName.trim().length<2)nextErrors.name='Enter your full name.';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))nextErrors.email='Enter a valid email address.';
    if(isSignup&&password.length<8)nextErrors.password='Use at least 8 characters for your password.';
    if(view==='login'&&!password)nextErrors.password='Enter your password.';
    if(Object.keys(nextErrors).length){setErrors(nextErrors);setValidationAttempt(n=>n+1);return;}
    setEmail(email.trim());setErrors({});setPassword('');setVisible(false);setNotice('');
    setView(view==='forgot'?'reset':isSignup?'verify':'loggedin');
  }
  const hasErrors=Object.values(errors).some(Boolean);

  return <main id="entry-main" className={styles.authPage}>
    <div className={styles.authShell}>
      <aside className={styles.authStory} aria-label="Your KampusLearn study space">
        <div className={styles.authOrbit} aria-hidden="true">
          <div className={`${styles.orbitNote} ${styles.orbitMaterials}`}><span><Icon name="file" size={17}/></span><div><strong>Course notes</strong><small>CPE 301</small></div></div>
          <div className={`${styles.orbitNote} ${styles.orbitQuestions}`}><span><Icon name="check" size={17}/></span><div><strong>Past questions</strong><small>One question at a time</small></div></div>
          <div className={`${styles.orbitNote} ${styles.orbitAi}`}><span><Icon name="spark" size={17}/></span><div><strong>Ask your AI tutor</strong><small>Make the difficult click.</small></div></div>
          <div className={styles.orbitHub}><div><span><Icon name="book" size={17}/></span><span><Icon name="check" size={17}/></span><span><Icon name="spark" size={17}/></span></div><strong>Your learning space</strong><span className={styles.orbitProgress}><span/></span><small>A little progress, every day.</small></div>
        </div>
        <h2>Everything you need to stay ahead academically.</h2>
        <p className={styles.authStoryFoot}>Your courses. Your goals. Your own pace.</p>
      </aside>

      <section className={styles.authFormPane} aria-labelledby="auth-title">
        {isForm&&<div className={styles.authTabs} data-mode={view} role="group" aria-label="Account action"><button type="button" aria-pressed={view==='login'} onClick={()=>changeView('login')}>Log in</button><button type="button" aria-pressed={isSignup} onClick={()=>changeView('signup')}>Create account</button></div>}
        {!isForm&&<span className={styles.authStateIcon}><Icon name={view==='forgot'||view==='reset'?'key':view==='verify'?'mail':'check'} size={29}/></span>}
        <h1 id="auth-title" tabIndex={-1} ref={titleRef}>{titles[view]}</h1>

        {isForm&&<>
          <p className={styles.authSupport}>{isSignup?'Create your KampusLearn account and build your personalised academic experience.':'Log in to your learning space and pick up where you left off.'}</p>
          <form className={styles.authForm} noValidate onSubmit={submit}>
            {hasErrors&&<p ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>Please check the highlighted fields.</p>}
            {isSignup&&<label className={styles.field}>Full name<input name="auth_name" autoComplete="name" maxLength={120} value={fullName} onChange={e=>{setFullName(e.target.value);clearError('name');}} placeholder="e.g. Usman Waziri" aria-required="true" aria-invalid={!!errors.name} aria-describedby={errors.name?'auth-name-error':undefined}/>{errors.name&&<span id="auth-name-error" className={styles.fieldError}>{errors.name}</span>}</label>}
            <label className={styles.field}>Email address<input type="email" name="auth_email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} value={email} onChange={e=>{setEmail(e.target.value);clearError('email');}} placeholder="you@example.com" aria-required="true" aria-invalid={!!errors.email} aria-describedby={errors.email?'auth-email-error':undefined}/>{errors.email&&<span id="auth-email-error" className={styles.fieldError}>{errors.email}</span>}</label>
            <div className={styles.passwordField}><div className={styles.passwordLabel}><label htmlFor="auth-password">Password</label>{!isSignup&&<button type="button" onClick={()=>changeView('forgot')}>Forgot password?</button>}</div><div className={styles.passwordInput}><input id="auth-password" name="auth_password" type={visible?'text':'password'} autoComplete={isSignup?'new-password':'current-password'} maxLength={128} value={password} onChange={e=>{setPassword(e.target.value);clearError('password');}} placeholder={isSignup?'Create a password':'Enter your password'} aria-required="true" aria-invalid={!!errors.password} aria-describedby={errors.password?'auth-password-error':isSignup?'password-hint':undefined}/><button type="button" aria-label={visible?'Hide password':'Show password'} aria-pressed={visible} onClick={()=>setVisible(!visible)}><Icon name={visible?'eyeOff':'eye'} size={20}/></button></div>{errors.password&&<span id="auth-password-error" className={styles.fieldError}>{errors.password}</span>}
              {isSignup&&<div className={styles.passwordGuidance}><div aria-hidden="true">{[4,8,12,16].map(n=><span key={n} className={password.length>=n?styles.passwordSegmentOn:''}/>)}</div><p id="password-hint">{password.length>=8?'Minimum length reached. A longer, unique password is better.':'Use at least 8 characters. A longer, unique password is better.'}</p></div>}
            </div>
            <button type="submit" className={styles.primary}>{isSignup?'Create my account':'Log in'}<Icon name="arrow" size={18}/></button>
            <p className={styles.authSampleNote}>Use sample details. This preview does not create or sign in to an account.</p>
          </form>
          <div className={styles.authDivider}><span/>or<span/></div>
          <button type="button" className={styles.googleButton} onClick={()=>setNotice('Google sign-in is not connected in this preview. Use the email form above to explore the account journey.')}><svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true"><path d="M22.5 12.2c0-.8-.07-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.2-4.7 3.2-8.1Z" fill="#4285F4"/><path d="M12 23c3 0 5.4-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1.1-3.7 1.1-2.8 0-5.2-1.9-6-4.5H2.4v2.8A11 11 0 0 0 12 23Z" fill="#34A853"/><path d="M6 14.2a6.6 6.6 0 0 1 0-4.4V7H2.4a11 11 0 0 0 0 9.9L6 14.2Z" fill="#FBBC05"/><path d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1C17.4 2.1 15 1 12 1a11 11 0 0 0-9.6 6l3.6 2.8c.8-2.6 3.2-4.4 6-4.4Z" fill="#EA4335"/></svg>Continue with Google</button>
          <p className={styles.authSwitch}>{isSignup?'Already have an account?':'New to KampusLearn?'} <button type="button" onClick={()=>changeView(isSignup?'login':'signup')}>{isSignup?'Log in':'Create an account'}</button></p>
        </>}

        {view==='forgot'&&<><p className={styles.authSupport}>Enter the email linked to your account to preview the recovery journey.</p><form className={styles.authForm} noValidate onSubmit={submit}>{hasErrors&&<p ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>Please check your email address.</p>}<label className={styles.field}>Email address<input type="email" name="reset_email" autoComplete="email" autoCapitalize="none" maxLength={254} value={email} onChange={e=>{setEmail(e.target.value);clearError('email');}} placeholder="you@example.com" aria-required="true" aria-invalid={!!errors.email} aria-describedby={errors.email?'reset-email-error':undefined}/>{errors.email&&<span id="reset-email-error" className={styles.fieldError}>{errors.email}</span>}</label><button type="submit" className={styles.primary}>Send reset link <Icon name="arrow" size={18}/></button><p className={styles.authSampleNote}>Preview only. No reset email will be sent.</p></form><button type="button" className={styles.textButton} onClick={()=>changeView('login')}><Icon name="back" size={17}/> Back to log in</button></>}
        {view==='reset'&&<div className={styles.authResult}><p>This is the confirmation screen for a reset request to <strong>{email}</strong>.</p><div className={styles.authInfo}><Icon name="mail" size={20}/><p>No email was sent. This is a preview of the password recovery confirmation.</p></div><button type="button" className={styles.primary} onClick={()=>changeView('login')}>Back to log in <Icon name="arrow" size={18}/></button><button type="button" className={styles.textButton} onClick={()=>changeView('forgot')}>Use a different email</button></div>}
        {view==='verify'&&<div className={styles.authResult}><p>Your verification step is ready for <strong>{email}</strong>.</p><div className={styles.authInfo}><Icon name="mail" size={21}/><p>This preview does not send a verification link. Use the button below to explore the verified state.</p></div><button type="button" className={styles.primary} onClick={()=>changeView('verified')}>Preview verified state <Icon name="arrow" size={18}/></button><div className={styles.authResultLinks}><button type="button" className={styles.textButton} onClick={()=>setNotice('Resend confirmation preview. No verification email has been sent.')}>Resend email</button><button type="button" className={styles.textButton} onClick={()=>changeView('signup')}>Change email address</button></div></div>}
        {view==='verified'&&<div className={styles.authResult}><p>Let’s build a study space around your campus, courses and goals.</p><div className={styles.authSuccessRow}><Icon name="check" size={18}/> Email verification success preview</div><button type="button" className={styles.primary} onClick={()=>onOnboard(fullName.trim())}>Set up my learning space <Icon name="arrow" size={18}/></button><p className={styles.authSampleNote}>No account has been created. Next is the six-step onboarding preview.</p></div>}
        {view==='loggedin'&&<div className={styles.authResult}><p>Pick up your courses, practise a little, or work through a question.</p><div className={styles.authInfo}><Icon name="home" size={21}/><p>This is the login success preview. Your credentials have not been checked against an account.</p></div><a className={styles.primary} href={dashboardHref}>Open dashboard preview <Icon name="arrow" size={18}/></a><button type="button" className={styles.textButton} onClick={()=>changeView('login')}>Back to log in</button></div>}
        {notice&&<p role="status" className={styles.authStatus}>{notice}</p>}
      </section>
    </div>
    <p className={styles.authFooter}>KampusLearn · Your courses, your possibilities.</p>
  </main>;
}
