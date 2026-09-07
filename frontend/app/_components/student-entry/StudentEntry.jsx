'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './StudentEntry.module.css';
import StudentAuth from './StudentAuth';

const STEPS = ['Welcome', 'Profile', 'Goals', 'Courses', 'Preferences', 'Ready'];
const INSTITUTIONS = [
  { id:'unimaid', name:'UNIMAID', detail:'University of Maiduguri', logo:'unimaid-logo.png' },
  { id:'ramat', name:'Ramat Polytechnic', detail:'Maiduguri', logo:'ramat-logo.png' },
  { id:'kiu', name:'Kashim Ibrahim University', detail:'Formerly Borno State University', logo:'kiu-logo.png' },
  { id:'noun', name:'NOUN', detail:'National Open University of Nigeria', logo:'noun-logo.png' },
  { id:'ui', name:'University of Ibadan', detail:'Ibadan', logo:'ui-logo.jpg' },
];
const SAMPLE_COURSES = [
  { id:'cpe301', code:'CPE 301', name:'Computer Architecture', icon:'cpu', tone:'mint' },
  { id:'eee301', code:'EEE 301', name:'Electronic Circuits', icon:'circuit', tone:'blue' },
  { id:'mth301', code:'MTH 301', name:'Engineering Mathematics', icon:'chart', tone:'lilac' },
  { id:'csc301', code:'CSC 301', name:'Data Structures', icon:'tree', tone:'mint' },
];
const GOALS = [
  { id:'understand', title:'Understand my courses', text:'Make difficult ideas click.', icon:'book' },
  { id:'exams', title:'Prepare for exams', text:'Go in with more confidence.', icon:'check' },
  { id:'papers', title:'Practise past questions', text:'Get familiar with the questions.', icon:'file' },
  { id:'ai', title:'Get help from AI', text:'Work through a tricky concept.', icon:'spark' },
  { id:'progress', title:'Improve my performance', text:'Find and work on weak areas.', icon:'chart' },
  { id:'habit', title:'Study more consistently', text:'Make a little time, more often.', icon:'clock' },
];
const MODES = [
  { id:'quick', title:'Quick sessions', text:'10–20 minutes at a time', icon:'clock' },
  { id:'deep', title:'Deep study', text:'30–60 minutes of focused work', icon:'book' },
  { id:'exam', title:'Exam mode', text:'Focused revision and preparation', icon:'target' },
  { id:'practice', title:'Practice first', text:'Learn by answering questions', icon:'check' },
];
const EMPTY_PROFILE = { institution:'', institutionName:'', faculty:'', department:'', departmentName:'', level:'', programme:'' };
const HEADINGS = ['A good place to begin.', 'Where do you study?', 'What matters to you?', 'Make room for your courses.', 'Find your study rhythm.', 'Your space is taking shape.'];
const SUPPORT = ['Let’s make KampusLearn feel like your learning space, one small step at a time.', 'Help us bring the right academic context into your study space.', 'Choose the goals you want your study space to support.', 'Start with the courses you’re studying this semester. You can change these later.', 'Choose the ways you enjoy learning. There’s no single right answer.', 'Take a moment to check your choices before you explore your dashboard.'];

export function Icon({ name, size=20, ...props }) {
  const paths = {
    arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>, back:<path d="M20 12H4m6-6-6 6 6 6"/>,
    check:<path d="m5 12 4 4L19 6"/>, close:<path d="m6 6 12 12M18 6 6 18"/>, plus:<path d="M12 5v14M5 12h14"/>,
    book:<><path d="M12 5v16M12 5C8 2 4 3 2 4v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-2-1-6-2-10 1Z"/></>,
    file:<><path d="M14 3H5v18h14V8Zm0 0v5h5M8 12h8M8 16h6"/></>,
    spark:<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4M18 4h4"/>,
    clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    target:<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    chart:<><path d="M3 20h18M6 16V9m6 7V5m6 11v-5M4 8l7-5 8 5"/></>,
    cpu:<><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/></>,
    circuit:<><path d="M8 4v16l12-8ZM2 8h6M2 16h6m14-4h-2M10 8h3m-1.5-1.5v3M10 16h3"/></>,
    tree:<><circle cx="12" cy="4" r="2"/><circle cx="5" cy="13" r="2"/><circle cx="19" cy="13" r="2"/><path d="m10.5 5.5-4 5.5m7-5.5 4 5.5M5 15v5m14-5v5M3 20h4m10 0h4"/></>,
    sun:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/></>,
    moon:<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>,
    search:<><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></>,
    campus:<><path d="m3 9 9-6 9 6ZM4 21h16M6 11v7m6-7v7m6-7v7"/></>,
    home:<path d="m3 10 9-7 9 7v10H3Zm6 10v-7h6v7"/>,
    pause:<><path d="M8 5v14M16 5v14" strokeWidth="3"/></>,
    play:<path d="m8 5 11 7-11 7Z"/>,
    mail:<><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/></>,
    key:<><circle cx="8" cy="9" r="5"/><path d="m12 13 8 8m-3-3 3-3m-6 0 3-3"/></>,
    eye:<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff:<><path d="m3 3 18 18M10.6 5.1C17 4.4 22 12 22 12a23 23 0 0 1-3 3.8M6 6.5A22 22 0 0 0 2 12s3.6 7 10 7c1.9 0 3.5-.6 5-1.5M10 10a3 3 0 0 0 4 4"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.book}</svg>;
}

export function Brand({ onClick }) {
  return <button type="button" className={styles.brand} aria-label="KampusLearn landing page" onClick={onClick}>
    <svg className={styles.cap} viewBox="0 0 64 52" fill="none" aria-hidden="true"><path d="M12 24v13c0 9 32 9 32 0V24" fill="currentColor" fillOpacity=".07" stroke="currentColor" strokeWidth="2.8"/><path d="M3 18 29 6a4 4 0 0 1 4 0l27 12-29 13Z" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round"/><path d="m31 17 17 6c4 1 5 4 5 8v5m-2 4-2 9h8l-2-9" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="31" cy="17" r="2.8" fill="currentColor"/><circle cx="53" cy="37" r="3" fill="currentColor"/></svg>
    <span><span className={styles.kampus}>Kampus</span><span>Learn</span></span>
  </button>;
}

function ProductWindow({ onStart }) {
  const [tab,setTab] = useState('Learn');
  return <div className={styles.productStage}>
    <div className={styles.productWindow}>
      <div className={styles.productTop}><span className={styles.productMonogram}><Icon name="book" size={18}/></span><strong>Your learning space</strong><span className={styles.demoTag}>Preview</span></div>
      <div className={styles.productGreeting}><small>A LITTLE PROGRESS, EVERY DAY</small><h2>Make today a learning day.</h2><p>One course. One question. One step forward.</p></div>
      <div className={styles.productTabs} role="group" aria-label="Explore study tools">{[['Learn','book'],['Practice','check'],['AI','spark']].map(([label,icon])=><button type="button" key={label} aria-pressed={tab===label} onClick={()=>setTab(label)}><Icon name={icon} size={17}/>{label}</button>)}</div>
      <div className={styles.productContent}>
        {tab==='Learn'&&<><div className={`${styles.previewCourseArt} ${styles.mint}`}><Icon name="cpu" size={62}/><span>CPE 301</span></div><div className={styles.previewCourseBody}><small>COMPUTER ARCHITECTURE</small><h3>Memory organisation</h3><p>Your materials and past questions, together.</p><button type="button" onClick={onStart}>Build my course space <Icon name="arrow" size={17}/></button></div></>}
        {tab==='Practice'&&<div className={styles.practiceDemo}><span className={styles.pill}>A quick knowledge check</span><h3>Which memory is closest to the CPU?</h3><p>Practise the kind of questions you’ll meet in your courses.</p><div><Icon name="check" size={18}/> Registers</div><button type="button" onClick={onStart}>Find my practice <Icon name="arrow" size={17}/></button></div>}
        {tab==='AI'&&<div className={styles.aiDemo}><span className={styles.aiBadge}><Icon name="spark" size={24}/></span><h3>“Can you explain it another way?”</h3><p>Think of cache as a small desk beside your processor: it keeps frequently used information close by.</p><small>Example explanation</small><button type="button" onClick={onStart}>Set up my study companion <Icon name="arrow" size={17}/></button></div>}
      </div>
      <div className={styles.productBottom}><Icon name="clock" size={16}/><span>A little time today goes a long way.</span></div>
    </div>
    <p className={styles.stageCaption}><Icon name="check" size={17}/> Built around the way you study.</p>
  </div>;
}

export default function StudentEntry({ startAt='landing', dashboardHref='/dashboard-preview', assetBase='/student-entry', onAccountNavigate }) {
  const [screen,setScreen] = useState(startAt);
  const [authInitialMode,setAuthInitialMode] = useState('login');
  const [institutionsPaused,setInstitutionsPaused] = useState(false);
  const [step,setStep] = useState(0);
  const [theme,setTheme] = useState('light');
  const [themeReady,setThemeReady] = useState(false);
  const [name,setName] = useState('');
  const [profile,setProfile] = useState(EMPTY_PROFILE);
  const [goals,setGoals] = useState([]);
  const [courses,setCourses] = useState([]);
  const [coursesInitialised,setCoursesInitialised] = useState(false);
  const [modes,setModes] = useState([]);
  const [daily,setDaily] = useState('');
  const [query,setQuery] = useState('');
  const [newCode,setNewCode] = useState('');
  const [newTitle,setNewTitle] = useState('');
  const [error,setError] = useState('');
  const [courseError,setCourseError] = useState('');
  const [notice,setNotice] = useState('');
  const titleRef = useRef(null);
  const firstRender = useRef(true);
  const suggestions = profile.institution==='unimaid' && profile.department==='cpe' && profile.level==='300' ? SAMPLE_COURSES : [];
  const institution = profile.institution==='unimaid' ? 'University of Maiduguri' : profile.institutionName.trim();
  const department = profile.institution==='unimaid' ? (profile.department==='cpe'?'Computer Engineering':'') : profile.departmentName.trim();

  useEffect(()=>{
    try { const saved=localStorage.getItem('kl-preview-theme-v2'); if(saved==='dark'||saved==='light')setTheme(saved); } catch (_) {}
    setThemeReady(true);
    const font=document.createElement('link'); font.rel='stylesheet'; font.href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@400;500;600;700;800&display=swap'; document.head.appendChild(font);
    return ()=>font.remove();
  },[]);
  useEffect(()=>{if(themeReady){try{localStorage.setItem('kl-preview-theme-v2',theme);}catch(_){}}},[theme,themeReady]);
  useEffect(()=>{
    if(firstRender.current){firstRender.current=false;return;}
    window.scrollTo({top:0,behavior:'auto'}); titleRef.current?.focus({preventScroll:true});
  },[screen,step]);

  function openScreen(next){setError('');setScreen(next);}
  function openAuth(mode){if(onAccountNavigate){onAccountNavigate(mode);return;}setAuthInitialMode(mode);openScreen('auth');}
  function move(next){setError('');setCourseError('');setStep(next);}
  function updateProfile(key,value){
    setProfile(p=>{
      if(key==='institution')return {...EMPTY_PROFILE,institution:value};
      if(key==='faculty')return {...p,faculty:value,department:'',departmentName:'',programme:''};
      if(key==='department')return {...p,department:value,programme:''};
      return {...p,[key]:value};
    });
    if(key!=='programme'){setCourses([]);setCoursesInitialised(false);setQuery('');setNewCode('');setNewTitle('');}
    setError('');setCourseError('');
  }
  function toggle(value,items,setItems){setItems(items.includes(value)?items.filter(x=>x!==value):[...items,value]);setError('');}
  function next(event){
    event.preventDefault();
    if(step===1){
      if(!institution||!profile.faculty.trim()||!department||!profile.level){setError('Choose your institution, faculty, department and level to continue.');return;}
      if(!coursesInitialised){setCourses(suggestions.slice(0,3));setCoursesInitialised(true);}
    }
    if(step===2&&!goals.length){setError('Choose at least one goal, or select “Skip this step”.');return;}
    if(step===3&&!courses.length){setError('Add a course, or select “Add courses later”.');return;}
    if(step===4&&!modes.length){setError('Choose a study preference, or select “Decide later”.');return;}
    move(Math.min(5,step+1));
  }
  function addCourse(course){setCourses(c=>[...c,course]);setError('');setCourseError('');setNotice(`${course.code} added.`);}
  function removeCourse(course){setCourses(c=>c.filter(x=>x.id!==course.id));setNotice(`${course.code} removed.`);}
  function addCustomCourse(){
    const code=newCode.trim().toUpperCase().replace(/\s+/g,' '); const title=newTitle.trim();
    if(!code||!title){setCourseError('Enter both a course code and a course title.');return;}
    if(courses.some(c=>c.code.replace(/\s/g,'')===code.replace(/\s/g,''))){setCourseError('That course is already in your list.');return;}
    const known=SAMPLE_COURSES.find(c=>c.code.replace(/\s/g,'')===code.replace(/\s/g,''));
    addCourse({...known,id:known?.id||`custom-${code.replace(/\s/g,'')}`,code,name:title,icon:known?.icon||'book',tone:known?.tone||'mint'});setNewCode('');setNewTitle('');
  }
  const available=suggestions.filter(c=>!courses.some(item=>item.id===c.id)&&`${c.code} ${c.name}`.toLowerCase().includes(query.toLowerCase()));

  return <div className={styles.app} data-theme={theme}>
    <a className={styles.skipLink} href="#entry-main">Skip to content</a>
    <header className={styles.header}><div className={styles.headerInner}>
      <Brand onClick={()=>openScreen('landing')}/>
      {screen==='landing'?<nav className={styles.headerNav} aria-label="Main navigation"><a href="#study-tools">Study tools</a><a href="#how-it-works">How it works</a><a href="#questions">Questions</a></nav>:screen==='onboarding'?<span className={styles.stepCount}>Step {step+1} of 6 <span>· {STEPS[step]}</span></span>:<span className={styles.authHeaderNote}>A good place to begin.</span>}
      <div className={styles.headerActions}><button type="button" className={styles.iconButton} aria-label={`Switch to ${theme==='light'?'dark':'light'} mode`} onClick={()=>setTheme(theme==='light'?'dark':'light')}><Icon name={theme==='light'?'moon':'sun'}/></button>{screen==='landing'&&<button type="button" className={styles.headerLogin} onClick={()=>openAuth('login')}>Log in</button>}{screen==='landing'&&<button type="button" className={styles.headerCta} onClick={()=>openAuth('signup')}>Get started <Icon name="arrow" size={17}/></button>}</div>
    </div></header>

    {screen==='landing'?<main id="entry-main" className={styles.landing}>
      <section className={styles.hero} aria-labelledby="landing-title"><div className={styles.heroCopy}>
        <p className={styles.heroBadge}><Icon name="campus" size={17}/> Built for Nigerian universities & polytechnics</p>
        <h1 id="landing-title" tabIndex={-1} ref={titleRef}>Your Entire <span>Kampus</span><br/>in One Place</h1>
        <p className={styles.heroSupport}>AI-powered learning built around your courses, exams, and campus — designed to help you understand faster, practise smarter and perform better.</p>
        <div className={styles.heroActions}><button type="button" className={styles.primary} onClick={()=>openAuth('signup')}>Start Learning <Icon name="arrow"/></button></div>
        <p className={styles.heroLogin}>Already have an account? <button type="button" onClick={()=>openAuth('login')}>Log in</button></p>
      </div></section>

      <section className={styles.studentImages} aria-label="Learning on campus and at your own pace">
        <div className={styles.studentPortraitCard}><img src={`${assetBase}/student-on-campus.jpg`} width="625" height="350" alt="A smiling student wearing glasses and a backpack on campus"/><div className={styles.studentAccent}><Icon name="spark" size={30}/><span>Your next<br/>chapter.</span><Icon name="arrow" size={23}/></div><p>Big goals. Small steps.<strong>A learning space that grows with you.</strong></p></div>
        <figure className={styles.studentStudyCard}><img src={`${assetBase}/student-study-space.png`} width="1692" height="929" alt="A student using KampusLearn on a phone beside lecture notes and a laptop" decoding="async"/><figcaption><span>FROM YOUR FIRST LECTURE TO YOUR NEXT EXAM</span><strong>Your campus, wherever you study.</strong></figcaption></figure>
      </section>

      <section className={styles.toolsSection} id="study-tools" aria-labelledby="tools-title"><div className={styles.sectionIntro}><p className={styles.eyebrow}>LESS SEARCHING. MORE UNDERSTANDING.</p><h2 id="tools-title">A place for every part<br/>of your learning.</h2><p>Move from understanding a concept to putting it into practice, without losing your place.</p></div>
        <div className={styles.featureGrid}>
          <article className={styles.feature}><span className={`${styles.featureIcon} ${styles.mint}`}><Icon name="book" size={25}/></span><small>01 / LEARN</small><h3>Your courses, together.</h3><p>Keep materials and past questions organised around what you’re actually studying.</p><div className={styles.featureTags}><span>Course materials</span><span>Past questions</span></div></article>
          <article className={styles.feature}><span className={`${styles.featureIcon} ${styles.blue}`}><Icon name="check" size={25}/></span><small>02 / PRACTICE</small><h3>Turn revision into confidence.</h3><p>Practise questions, check your understanding and see where to focus next.</p><div className={styles.featureTags}><span>CBT practice</span><span>Course progress</span></div></article>
          <article className={styles.feature}><span className={`${styles.featureIcon} ${styles.lilac}`}><Icon name="spark" size={25}/></span><small>03 / AI</small><h3>Ask that extra question.</h3><p>Break down a difficult idea, explore an example or get another explanation.</p><div className={styles.featureTags}><span>Guided explanations</span><span>Study support</span></div></article>
        </div>
      </section>

      <section className={styles.howSection} id="how-it-works" aria-labelledby="how-title"><div><p className={styles.eyebrow}>MAKE IT YOURS</p><h2 id="how-title">Your learning space.<br/>Built around you.</h2><p>A few thoughtful choices help you begin with a plan that fits your semester.</p><ol className={styles.howList}>{[['01','Start with your campus','Tell us your institution, department and level.'],['02','Choose your focus','Add your courses and the goals that matter to you.'],['03','Find your rhythm','Choose how you like to study and make time that works for you.']].map(([n,title,text])=><li key={n}><span>{n}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol><button type="button" className={styles.primary} onClick={()=>openAuth('signup')}>Start Learning <Icon name="arrow"/></button></div><ProductWindow onStart={()=>openAuth('signup')}/></section>

      <section className={styles.faqSection} id="questions" aria-labelledby="faq-title"><div><p className={styles.eyebrow}>BEFORE YOU BEGIN</p><h2 id="faq-title">A few things<br/>you might be wondering.</h2></div><div className={styles.faqList}>{[
        ['Who is KampusLearn for?','Students in Nigerian universities and polytechnics who want course materials, practice and AI study support in one place. UNIMAID is the starting pilot.'],
        ['What do I choose during setup?','Your academic context, learning goals, semester courses and study preferences. You can skip the optional choices and revisit them.'],
        ['Can I use it for more than exam revision?','Yes. Learn is for your everyday course materials and past questions, Practice is for checking your understanding, and AI is for working through difficult ideas.'],
        ['Can I read materials without paying?','Yes. Reading course materials in the app is free. Saving a material offline costs 5 KampusCoin (KP). KP can be earned through activities such as daily login, referrals and completed CBT tests.'],
        ['Does this preview create an account?','No. This preview lets you try the design and onboarding flow. Your choices stay in this page session, and the dashboard uses sample data.']
      ].map(([q,a])=><details key={q}><summary>{q}<Icon name="plus" size={18}/></summary><p>{a}</p></details>)}</div></section>

      <section className={styles.institutionSection} aria-labelledby="institutions-title"><div className={styles.institutionHeading}><div><p className={styles.eyebrow}>STARTING IN BORNO. GROWING WITH YOU.</p><h2 id="institutions-title">Built for students across Nigeria.</h2><p>The campuses we’re building for, starting with the UNIMAID pilot.</p></div><button type="button" className={styles.marqueeControl} aria-label={institutionsPaused?'Play institution logos':'Pause institution logos'} aria-pressed={institutionsPaused} onClick={()=>setInstitutionsPaused(!institutionsPaused)}><Icon name={institutionsPaused?'play':'pause'} size={17}/><span>{institutionsPaused?'Play':'Pause'}</span></button></div><div className={styles.institutionViewport}><div className={styles.institutionTrack} data-paused={institutionsPaused}>
        {[0,1].map(copy=><ul key={copy} className={styles.institutionGroup} aria-hidden={copy===1?true:undefined} aria-label={copy===0?'Institution communities':undefined}>{INSTITUTIONS.map(institution=><li key={institution.id} className={styles.institutionCard}><span className={styles.institutionLogo} data-institution={institution.id}><img src={`${assetBase}/${institution.logo}`} width="58" height="58" alt="" loading="lazy" decoding="async"/></span><span><strong>{institution.name}</strong><small>{institution.detail}</small></span></li>)}</ul>)}
      </div></div></section>
      <footer className={styles.landingFooter}><Brand onClick={()=>{window.scrollTo({top:0,behavior:'auto'});titleRef.current?.focus({preventScroll:true});}}/><p>Learn at your own pace.</p><small>Design preview · No account is created</small></footer>
    </main>:screen==='auth'?<StudentAuth key={authInitialMode} initialMode={authInitialMode} Icon={Icon} dashboardHref={dashboardHref} onOnboard={fullName=>{setName(fullName.split(/\s+/)[0]);move(0);openScreen('onboarding');}}/>:<main id="entry-main" className={styles.onboarding}>
      <div className={styles.progressHeader}><div className={styles.progressTrack} role="progressbar" aria-label="Onboarding step" aria-valuemin={1} aria-valuemax={6} aria-valuenow={step+1} aria-valuetext={`Step ${step+1} of 6: ${STEPS[step]}`}><span style={{width:`${(step+1)/6*100}%`}}/></div><ol className={styles.steps} aria-label="Setup steps">{STEPS.map((label,i)=><li key={label} className={i===step?styles.currentStep:i<step?styles.doneStep:''}><button type="button" onClick={()=>move(i)} disabled={i>step} aria-current={i===step?'step':undefined}><span>{i<step?<Icon name="check" size={13}/>:String(i+1).padStart(2,'0')}</span>{label}</button></li>)}</ol></div>

      <div className={`${styles.wizardShell} ${step===0?styles.welcomeShell:''} ${step===5?styles.readyShell:''}`}>
        <section className={styles.formPane} aria-labelledby="step-title"><p className={styles.eyebrow}>{step===5?'A PLACE TO CALL YOURS':`LET’S MAKE IT YOURS / ${String(step+1).padStart(2,'0')}`}</p><h1 id="step-title" tabIndex={-1} ref={titleRef}>{step===5&&name.trim()?`${name.trim()}, your space is taking shape.`:HEADINGS[step]}</h1><p className={styles.stepSupport}>{SUPPORT[step]}</p>
          <form onSubmit={next} noValidate>
            {step===0&&<div className={styles.welcomeForm}><label className={styles.field}>What should we call you? <span className={styles.optional}>(optional)</span><input name="first_name" type="text" autoComplete="given-name" maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="Your first name"/></label><div className={styles.welcomeBenefits}><span><Icon name="campus"/> Your campus</span><span><Icon name="target"/> Your goals</span><span><Icon name="clock"/> Your pace</span></div></div>}

            {step===1&&<div className={styles.fields}>
              <label className={styles.field}>Institution<select name="institution" value={profile.institution} onChange={e=>updateProfile('institution',e.target.value)} aria-required="true"><option value="">Choose your institution</option><option value="unimaid">University of Maiduguri</option><option value="other">Another institution</option></select></label>
              {profile.institution==='other'&&<label className={styles.field}>Institution name<input name="institution_name" maxLength={120} value={profile.institutionName} onChange={e=>updateProfile('institutionName',e.target.value)} placeholder="Enter your institution" aria-required="true"/></label>}
              {profile.institution==='unimaid'?<><label className={styles.field}>Faculty / School<select name="faculty" value={profile.faculty} onChange={e=>updateProfile('faculty',e.target.value)} aria-required="true"><option value="">Choose your faculty</option><option value="engineering">Faculty of Engineering</option></select></label><label className={styles.field}>Department<select name="department" disabled={!profile.faculty} value={profile.department} onChange={e=>updateProfile('department',e.target.value)} aria-required="true"><option value="">Choose your department</option><option value="cpe">Computer Engineering</option></select></label><p className={styles.fieldHint}>The preview catalogue starts with the UNIMAID Computer Engineering pilot.</p></>:<div className={styles.fieldRow}><label className={styles.field}>Faculty / School<input name="faculty" maxLength={100} disabled={!profile.institution} value={profile.faculty} onChange={e=>updateProfile('faculty',e.target.value)} placeholder="Your faculty" aria-required="true"/></label><label className={styles.field}>Department<input name="department_name" maxLength={100} disabled={!profile.institution} value={profile.departmentName} onChange={e=>updateProfile('departmentName',e.target.value)} placeholder="Your department" aria-required="true"/></label></div>}
              <div className={styles.fieldRow}><label className={styles.field}>Level<select name="level" disabled={!profile.institution} value={profile.level} onChange={e=>updateProfile('level',e.target.value)} aria-required="true"><option value="">Choose your level</option>{(profile.institution==='unimaid'?['100','200','300','400','500','600']:['100','200','300','400','500','600','ND1','ND2','HND1','HND2']).map(l=><option key={l} value={l}>{/^\d/.test(l)?`${l} Level`:l}</option>)}</select></label><label className={styles.field}>Programme <span className={styles.optional}>(optional)</span><input name="programme" maxLength={100} value={profile.programme} onChange={e=>updateProfile('programme',e.target.value)} placeholder="e.g. B.Eng."/></label></div>
            </div>}

            {step===2&&<fieldset className={styles.choiceFieldset}><legend>Choose as many as you like</legend><div className={styles.choiceGrid}>{GOALS.map(g=><label key={g.id} className={`${styles.choice} ${goals.includes(g.id)?styles.chosen:''}`}><input type="checkbox" name="goals" value={g.id} checked={goals.includes(g.id)} onChange={()=>toggle(g.id,goals,setGoals)}/><span className={styles.choiceIcon}><Icon name={g.icon}/></span><span><strong>{g.title}</strong><small>{g.text}</small></span><span className={styles.selectionMark}>{goals.includes(g.id)&&<Icon name="check" size={13}/>}</span></label>)}</div></fieldset>}

            {step===3&&<div className={styles.courseStep}>
              <div className={styles.courseListHeading}><h2>Your semester list</h2><span>{courses.length} selected</span></div>
              <ul className={styles.courseList}>{courses.map(c=><li key={c.id}><span className={`${styles.courseIcon} ${styles[c.tone]}`}><Icon name={c.icon} size={25}/></span><div><strong>{c.code}</strong><span>{c.name}</span></div><button type="button" className={styles.removeButton} aria-label={`Remove ${c.code}`} onClick={()=>removeCourse(c)}><Icon name="close" size={17}/></button></li>)}</ul>
              {!courses.length&&<p className={styles.emptyCourses}>Your list is clear. Add a course below, or come back to this later.</p>}
              {!!suggestions.length&&<div className={styles.suggestedCourses}><label className={styles.courseSearch}><Icon name="search" size={18}/><input aria-label="Search sample courses" type="search" placeholder="Find a course to add" value={query} onChange={e=>setQuery(e.target.value)}/></label><div>{available.map(c=><button type="button" key={c.id} onClick={()=>addCourse(c)} aria-label={`Add ${c.code}`}><span><strong>{c.code}</strong> {c.name}</span><Icon name="plus" size={17}/></button>)}{!available.length&&<p>{query?'No matching courses. You can add your own below.':'All suggested courses are in your list.'}</p>}</div><p className={styles.fieldHint}>Sample course suggestions, not an official semester catalogue.</p></div>}
              {!suggestions.length&&<p className={styles.fieldHint}>There are no sample suggestions for this academic profile yet. Add the courses you study below.</p>}
              <details className={styles.customCourse}><summary><Icon name="plus" size={18}/> Add a course manually</summary><div className={styles.fieldRow}><label className={styles.field}>Course code<input name="course_code" maxLength={24} value={newCode} onChange={e=>{setNewCode(e.target.value);setCourseError('');}} placeholder="e.g. CPE 303"/></label><label className={styles.field}>Course title<input name="course_title" maxLength={100} value={newTitle} onChange={e=>{setNewTitle(e.target.value);setCourseError('');}} placeholder="e.g. Digital Systems"/></label></div>{courseError&&<p role="alert" className={styles.error}>{courseError}</p>}<button type="button" className={styles.secondary} onClick={addCustomCourse}>Add to my courses <Icon name="plus" size={17}/></button></details>
              <span role="status" className={styles.srOnly}>{notice}</span>
            </div>}

            {step===4&&<><fieldset className={styles.choiceFieldset}><legend>Your preferred ways to study</legend><div className={styles.choiceGrid}>{MODES.map(m=><label key={m.id} className={`${styles.choice} ${modes.includes(m.id)?styles.chosen:''}`}><input type="checkbox" name="study_modes" value={m.id} checked={modes.includes(m.id)} onChange={()=>toggle(m.id,modes,setModes)}/><span className={styles.choiceIcon}><Icon name={m.icon}/></span><span><strong>{m.title}</strong><small>{m.text}</small></span><span className={styles.selectionMark}>{modes.includes(m.id)&&<Icon name="check" size={13}/>}</span></label>)}</div></fieldset><fieldset className={styles.dailyFieldset}><legend>How much time feels right each day? <span className={styles.optional}>(optional)</span></legend><div className={styles.timeChoices}>{['15 min','30 min','1 hour','2+ hours','Not sure yet'].map(t=><label key={t} className={daily===t?styles.timeSelected:''}><input type="radio" name="daily_time" value={t} checked={daily===t} onChange={()=>setDaily(t)}/>{t}</label>)}</div><p className={styles.fieldHint}>Start with what fits your day. You can adjust as you go.</p></fieldset></>}

            {step===5&&<div className={styles.readySummary}>
              <div className={styles.readyNote}><span><Icon name="check" size={24}/></span><div><strong>{courses.length?'A little structure. A clearer start.':'Begin at your own pace.'}</strong><p>{courses.length?'Here’s the study plan you put together.':'You can add your academic details and courses whenever you’re ready.'}</p></div></div>
              <dl>{[
                ['Profile',institution?[institution,department,profile.level?`${profile.level} Level`:'',profile.programme].filter(Boolean).join(' · '):'Not set yet',1],
                ['Goals',goals.length?GOALS.filter(g=>goals.includes(g.id)).map(g=>g.title).join(' · '):'Choose later',2],
                ['Courses',courses.length?courses.map(c=>c.code).join(' · '):'Add later',3],
                ['Study rhythm',modes.length?MODES.filter(m=>modes.includes(m.id)).map(m=>m.title).join(' · '):'Choose later',4],
                ['Daily time',daily||'At your own pace',4]
              ].map(([label,value,target])=><div key={label}><dt>{label}</dt><dd>{value}</dd><button type="button" aria-label={`Edit ${label.toLowerCase()}`} onClick={()=>move(target)}>Edit</button></div>)}</dl>
            </div>}

            {error&&<p className={styles.error} role="alert">{error}</p>}
            <div className={styles.formActions}>
              {step===0?<button type="button" className={styles.textButton} onClick={()=>move(5)}>Skip for now</button>:<button type="button" className={styles.textButton} onClick={()=>move(step-1)}><Icon name="back" size={17}/> Back</button>}
              {step<5?<button type="submit" className={styles.primary}>{step===0?'Let’s get started':step===4?'Review my choices':'Continue'}<Icon name="arrow" size={18}/></button>:<a className={styles.primary} href={dashboardHref}>Open dashboard preview <Icon name="arrow" size={18}/></a>}
            </div>
            {step>=2&&step<=4&&<button type="button" className={styles.skipStep} onClick={()=>move(step+1)}>{step===3?'Add courses later':step===4?'Decide later':'Skip this step'}</button>}
            {step===5&&<p className={styles.previewNotice}>Your choices stay in this page session. The dashboard opens with sample data.</p>}
          </form>
        </section>

        <aside className={styles.studyAside} aria-label="Your study plan preview"><div className={styles.asideTop}><span className={styles.asideIcon}><Icon name={['spark','campus','target','book','clock','check'][step]} size={24}/></span><span>YOUR SPACE, YOUR PACE</span></div><h2>{['Big possibilities.<br/>Small beginnings.','It starts with<br/>your campus.','Give your effort<br/>a direction.','Your semester,<br/>in one place.','A rhythm<br/>that fits your life.','A fresh start.<br/>Made by you.'][step].split('<br/>').map((part,i)=><span key={part}>{i>0&&<br/>}{part}</span>)}</h2>
          <div className={styles.planCard}><div className={styles.planTitle}><Icon name="home" size={18}/><span>{name.trim()?`${name.trim()}’s study space`:'Your study space'}</span></div><div className={styles.planCampus}><small>{institution||'YOUR NEXT CHAPTER'}</small><strong>{department||'A little more understanding, every day.'}</strong></div><div className={styles.planCounts}><div><strong>{courses.length||'—'}</strong><span>Courses</span></div><div><strong>{goals.length||'—'}</strong><span>Goals</span></div><div><strong>{daily&&daily!=='Not sure yet'?daily:'You decide'}</strong><span>Daily rhythm</span></div></div>{courses.length>0&&<div className={styles.planCourse}><span className={`${styles.courseIcon} ${styles[courses[0].tone]}`}><Icon name={courses[0].icon} size={23}/></span><div><strong>{courses[0].code}</strong><span>{courses[0].name}</span></div><Icon name="check" size={17}/></div>}</div>
          <p className={styles.asideNote}>{step===0?'You bring the curiosity. We’ll help you find a place to begin.':step===4?'Consistency starts with a plan you can actually keep.':'Your choices help keep your learning focused on what matters to you.'}</p>
        </aside>
      </div>
      <footer className={styles.onboardingFooter}><button type="button" onClick={()=>openScreen('landing')}>Back to landing page</button><span>Design preview · No account is created</span></footer>
    </main>}
  </div>;
}

