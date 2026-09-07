import styles from './StudentJourney.module.css';
export function Icon({ name, size = 20, ...props }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>,
    book: <><path d="M12 5v16M12 5C8 2 4 3 2 4v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-2-1-6-2-10 1Z" /></>,
    check: <><path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9M9 10l4 4L22 3" /></>,
    spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4M18 4h4" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" /></>,
    moon: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    back: <path d="m14 6-6 6 6 6" />,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M3 8V5a2 2 0 0 1 2-2h13M21 11h-6v5h6" /><circle cx="17" cy="13.5" r=".5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    file: <><path d="M14 2H5a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8Zm0 0v6h6M8 12h8M8 16h8" /></>,
    search: <><circle cx="10.5" cy="10.5" r="7.5" /><path d="m16 16 5 5" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4ZM22 2 11 13" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.book}</svg>;
}

export function Brand({ onClick }) {
  return <button type="button" className={styles.brand} onClick={onClick} aria-label="KampusLearn home">
    <svg className={styles.cap} viewBox="0 0 64 52" fill="none" aria-hidden="true">
      <path d="M12 24v13c0 9 32 9 32 0V24" fill="currentColor" fillOpacity=".08" stroke="currentColor" strokeWidth="2.8" />
      <path d="M3 18 29 6a4 4 0 0 1 4 0l27 12-29 13Z" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
      <path d="m31 17 17 6c4 1 5 4 5 8v5m-2 4-2 9h8l-2-9" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="31" cy="17" r="2.8" fill="currentColor" /><circle cx="53" cy="37" r="3" fill="currentColor" />
    </svg>
    <span><span className={styles.kampus}>Kampus</span><span className={styles.learnWord}>Learn</span></span>
  </button>;
}

export function CourseArt({ kind }) {
  // Course-specific schematics retain the illustrated bands in the reference.
  return <svg viewBox="0 0 100 80" width="100" height="80" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'cpu' && <><rect x="30" y="20" width="40" height="40" rx="5" /><rect x="40" y="30" width="20" height="20" rx="2" />{[36, 46, 56, 66].map(n => <g key={n}><path d={`M${n} 12v8M${n} 60v8M22 ${n-10}h8M70 ${n-10}h8`} /></g>)}</>}
    {kind === 'circuit' && <><path d="M33 18v44l36-22ZM10 28h23M10 52h23M69 40h20M76 40V10H20v18" /><path d="M38 28h8M42 24v8M38 52h8" /><circle cx="10" cy="28" r="3" /><circle cx="10" cy="52" r="3" /><circle cx="89" cy="40" r="3" /></>}
    {kind === 'graph' && <><path d="M12 62h78M20 62V44M36 62V28M52 62V36M68 62V16M84 62V48" /><path strokeWidth="2.2" d="m20 44 16-16 16 8 16-20 16 32" />{[[20,44],[36,28],[52,36],[68,16],[84,48]].map(([x,y])=><circle key={x} cx={x} cy={y} r="2.6" fill="currentColor" />)}</>}
    {kind === 'tree' && <><path d="M50 20 27 43m23-23 23 23M27 43 14 66m13-23 14 23m32-23-14 23m14-23 13 23" />{[[50,16],[27,42],[73,42],[14,67],[41,67],[59,67],[86,67]].map(([x,y])=><circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill="var(--art-bg)" />)}</>}
  </svg>;
}

