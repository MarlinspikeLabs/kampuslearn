'use client';

import { useEffect, useState } from 'react';
import {
  Home,
  BookOpen,
  FileText,
  SquareCheck,
  Sparkles,
  MoreHorizontal,
  GraduationCap,
  Bell,
  Search,
  ArrowRight,
  ChevronLeft,
  Coins,
  Target,
} from 'lucide-react';

const NAV = [
  { label: 'Home', icon: Home },
  { label: 'Learn', icon: BookOpen },
  { label: 'Practice', icon: SquareCheck },
  { label: 'AI', icon: Sparkles },
  { label: 'More', icon: MoreHorizontal },
];

const COURSES = [
  {
    code: 'CPE301',
    title: 'Computer Architecture',
    topic: 'Memory organisation',
    count: 12,
    color: 'violet',
  },
  {
    code: 'EEE301',
    title: 'Electronic Circuits',
    topic: 'Operational amplifiers',
    count: 8,
    color: 'orange',
  },
  {
    code: 'MTH301',
    title: 'Engineering Mathematics',
    topic: 'Laplace transforms',
    count: 10,
    color: 'mint',
  },
];

const SAMPLE_SCORE = 72;
const RADIUS = 55;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function DashboardPreview() {
  const [active, setActive] = useState('Home');
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [greeting, setGreeting] = useState('Welcome back');

  useEffect(() => {
    const now = new Date();

    setDate(
      now.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    );

    const hour = now.getHours();

    setGreeting(
      hour < 12
        ? 'Good morning'
        : hour < 17
          ? 'Good afternoon'
          : 'Good evening'
    );

    // Fonts are used only by this preview.
    const fonts = document.createElement('link');
    fonts.rel = 'stylesheet';
    fonts.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700' +
      '&family=Sora:wght@400;500;600;700;800&display=swap';

    document.head.appendChild(fonts);

    return () => fonts.remove();
  }, []);

  function navigate(destination) {
    setActive(destination);
    setDetail(null);
    setSearch('');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function openDetail(title, description) {
    setDetail({ title, description });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  const filteredCourses = COURSES.filter((course) =>
    `${course.code} ${course.title} ${course.topic}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  function navigation() {
    return NAV.map(({ label, icon: Icon }) => (
      <button
        key={label}
        type="button"
        className={`nav-link ${active === label ? 'active' : ''}`}
        aria-current={active === label ? 'page' : undefined}
        onClick={() => navigate(label)}
      >
        <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
        <span>{label}</span>
      </button>
    ));
  }

  function courseCards() {
    return (
      <div className="course-grid">
        {filteredCourses.map((course) => (
          <button
            type="button"
            className="course-card"
            key={course.code}
            onClick={() =>
              openDetail(
                course.title,
                `${course.code} · ${course.topic}. This is a sample course. ` +
                  'Materials and course-specific actions will connect after design approval.'
              )
            }
          >
            <span className={`tile-icon ${course.color}`}>
              <BookOpen size={22} aria-hidden="true" />
            </span>

            <span className="course-code">{course.code}</span>
            <strong>{course.title}</strong>
            <span className="course-topic">{course.topic}</span>

            <span className="course-footer">
              <span>{course.count} sample materials</span>
              <ArrowRight size={17} aria-hidden="true" />
            </span>
          </button>
        ))}

        {filteredCourses.length === 0 && (
          <p className="empty-state">
            No matching courses. Try a course name or code.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="kl-refined">
      <style>{`
        .kl-refined {
          --navy: #0e1b3c;
          --ink: #15203b;
          --muted: #58617b;
          --subtle: #777f99;
          --paper: #f8f7f3;
          --line: #e7e4dc;
          --orange: #ff7a29;
          --orange-dark: #a5410a;
          min-height: 100vh;
          background: var(--paper);
          color: var(--ink);
          font-family: 'Inter', system-ui, sans-serif;
          line-height: 1.55;
          -webkit-font-smoothing: antialiased;
        }

        .kl-refined * { box-sizing: border-box; }

        .kl-refined button,
        .kl-refined input {
          font: inherit;
        }

        .kl-refined button {
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }

        .kl-refined button:focus-visible,
        .kl-refined input:focus-visible {
          outline: 3px solid #a5410a;
          outline-offset: 4px;
        }

        .kl-refined h1,
        .kl-refined h2,
        .kl-refined h3,
        .kl-refined p {
          margin: 0;
        }

        .kl-refined h1,
        .kl-refined h2,
        .kl-refined h3 {
          font-family: 'Sora', system-ui, sans-serif;
          letter-spacing: -.035em;
          line-height: 1.25;
        }

        .kl-refined .topbar {
          background: rgba(248, 247, 243, .96);
          border-bottom: 1px solid var(--line);
        }

        .kl-refined .topbar-inner {
          max-width: 1280px;
          min-height: 80px;
          margin: auto;
          padding: 14px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .kl-refined .brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--navy);
          font-family: 'Sora', system-ui, sans-serif;
          font-weight: 700;
          font-size: 1.125rem;
          white-space: nowrap;
        }

        .kl-refined .brand-mark {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 11px;
          color: white;
          background: linear-gradient(140deg, #403b9d, #7168df 45%, #ff8f48);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.3);
        }

        .kl-refined .desktop-nav {
          display: flex;
          gap: 8px;
        }

        .kl-refined .nav-link {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 44px;
          border: 0;
          padding: 9px 12px;
          background: transparent;
          color: var(--muted);
          font-size: .875rem;
          font-weight: 500;
          border-radius: 12px;
          transition: color .18s, background .18s;
        }

        .kl-refined .nav-link.active {
          color: var(--orange-dark);
        }

        .kl-refined .desktop-nav .nav-link.active {
          background: #fff0e5;
        }

        .kl-refined .header-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .kl-refined .icon-button {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 12px;
          background: transparent;
          color: var(--navy);
        }

        .kl-refined .icon-button:hover {
          background: #eeece6;
        }

        .kl-refined .avatar {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: linear-gradient(135deg, #ed742b, #ffb369);
          color: #402005;
          font-size: .875rem;
          font-weight: 700;
        }

        .kl-refined .main {
          max-width: 1280px;
          margin: auto;
          padding: 36px 32px 60px;
        }

        .kl-refined .hero {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 24px;
          align-items: stretch;
        }

        .kl-refined .greeting {
          position: relative;
          padding: 36px 38px;
          border: 1px solid var(--line);
          border-radius: 32px;
          background:
            radial-gradient(circle at 100% 0%, #efedff 0, transparent 43%),
            white;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .kl-refined .date {
          color: var(--subtle);
          font-size: .8125rem;
          min-height: 21px;
          margin-bottom: 10px;
        }

        .kl-refined .greeting h1 {
          font-size: clamp(1.55rem, 2.8vw, 2.125rem);
          font-weight: 700;
        }

        .kl-refined .greeting-sub {
          margin-top: 11px;
          color: var(--muted);
          font-size: 1rem;
        }

        .kl-refined .identity {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px 10px;
          align-self: flex-start;
          margin-top: 23px;
          padding: 9px 16px;
          border: 1px solid var(--line);
          border-radius: 24px;
          background: var(--paper);
          font-size: .875rem;
          font-weight: 600;
        }

        .kl-refined .identity span + span::before {
          content: '·';
          margin-right: 10px;
          color: var(--subtle);
        }

        .kl-refined .progress-card {
          position: relative;
          border-radius: 32px;
          padding: 29px 24px 25px;
          background:
            radial-gradient(circle at 0% 0%, rgba(255,122,41,.18), transparent 45%),
            var(--navy);
          color: white;
          text-align: center;
        }

        .kl-refined .progress-card h2 {
          font-family: 'Inter', sans-serif;
          font-size: .9375rem;
          letter-spacing: 0;
          font-weight: 600;
        }

        .kl-refined .ring {
          position: relative;
          width: 132px;
          height: 132px;
          margin: 19px auto 15px;
        }

        .kl-refined .ring svg {
          width: 100%;
          height: 100%;
          transform: rotate(-90deg);
        }

        .kl-refined .ring-value {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Sora', sans-serif;
          font-size: 1.75rem;
          font-weight: 700;
        }

        .kl-refined .progress-note {
          color: #bdc5d7;
          font-size: .875rem;
        }

        .kl-refined .section {
          margin-top: 36px;
        }

        .kl-refined .section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        .kl-refined .section-heading h2 {
          font-size: 1.25rem;
          font-weight: 600;
        }

        .kl-refined .text-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          min-height: 44px;
          border: 0;
          padding: 5px 0;
          background: transparent;
          color: var(--orange-dark);
          font-size: .875rem;
          font-weight: 600;
        }

        .kl-refined .next-grid {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 24px;
        }

        .kl-refined .continue-card {
          padding: 30px;
          border-radius: 28px;
          background:
            radial-gradient(circle at 100% 100%, #3d3650, transparent 60%),
            #16264f;
          color: white;
        }

        .kl-refined .continue-tag {
          color: #ffc49a;
          font-size: .8125rem;
          font-weight: 600;
        }

        .kl-refined .continue-card h2 {
          margin-top: 12px;
          font-size: 1.5rem;
        }

        .kl-refined .continue-note {
          margin-top: 9px;
          color: #cbd3e6;
          font-size: .9375rem;
        }

        .kl-refined .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 46px;
          border: 0;
          border-radius: 50px;
          padding: 12px 21px;
          font-size: .9375rem;
          font-weight: 600;
        }

        .kl-refined .button-orange {
          background: #ff8b3e;
          color: #321603;
          margin-top: 22px;
          box-shadow: 0 10px 24px -15px #ff8b3e;
        }

        .kl-refined .button-orange:hover {
          background: #ffa363;
        }

        .kl-refined .focus-card {
          border: 1px solid var(--line);
          border-radius: 28px;
          background: white;
          padding: 28px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
        }

        .kl-refined .focus-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: .875rem;
          color: var(--orange-dark);
          font-weight: 600;
        }

        .kl-refined .focus-card h3 {
          margin-top: 15px;
          font-size: 1.25rem;
        }

        .kl-refined .focus-card p {
          margin-top: 8px;
          color: var(--muted);
          font-size: .9375rem;
        }

        .kl-refined .focus-card .text-button {
          margin-top: 12px;
        }

        .kl-refined .quick-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .kl-refined .quick {
          padding: 20px;
          border: 1px solid var(--line);
          border-radius: 20px;
          background: white;
          text-align: left;
          color: var(--ink);
        }

        .kl-refined .tile-icon {
          display: inline-flex;
          width: 44px;
          height: 44px;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          flex-shrink: 0;
        }

        .kl-refined .violet { background: #eae9fe; color: #5952b9; }
        .kl-refined .orange { background: #ffeadb; color: #a64814; }
        .kl-refined .mint { background: #def3e9; color: #187451; }
        .kl-refined .navy { background: #e9edf5; color: #34496e; }

        .kl-refined .quick strong {
          display: block;
          margin-top: 12px;
          font-size: .9375rem;
          font-weight: 600;
        }

        .kl-refined .quick small {
          display: block;
          margin-top: 4px;
          color: var(--muted);
          font-size: .8125rem;
        }

        .kl-refined .course-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .kl-refined .course-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          border: 1px solid var(--line);
          border-radius: 24px;
          padding: 24px;
          background: white;
          color: var(--ink);
          text-align: left;
        }

        .kl-refined .course-code {
          font-size: .75rem;
          color: var(--subtle);
          font-weight: 600;
          margin-top: 18px;
        }

        .kl-refined .course-card strong {
          font-family: 'Sora', sans-serif;
          font-size: 1rem;
          line-height: 1.45;
          margin-top: 5px;
        }

        .kl-refined .course-topic {
          margin-top: 8px;
          font-size: .875rem;
          color: var(--muted);
        }

        .kl-refined .course-footer {
          align-self: stretch;
          margin-top: auto;
          padding-top: 23px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          color: var(--muted);
          font-size: .8125rem;
        }

        .kl-refined .allowance {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
          padding: 24px 28px;
          background: #efedf8;
          border: 1px solid #e3dff1;
          border-radius: 24px;
        }

        .kl-refined .allowance h2 { font-size: 1rem; }
        .kl-refined .allowance p { margin-top: 5px; color: var(--muted); font-size: .875rem; }
        .kl-refined .allowance strong { font-family: 'Sora', sans-serif; font-size: 1.5rem; }

        .kl-refined .preview-footer {
          margin-top: 32px;
          text-align: center;
          color: var(--muted);
          font-size: .75rem;
        }

        .kl-refined .detail {
          padding: 30px;
          background: white;
          border: 1px solid var(--line);
          border-radius: 28px;
        }

        .kl-refined .detail h1 { font-size: 1.6rem; margin-top: 12px; }
        .kl-refined .detail p { margin-top: 14px; max-width: 680px; color: var(--muted); }

        .kl-refined .search-box {
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid #d8d4c8;
          border-radius: 16px;
          padding: 12px 16px;
          background: white;
          margin: 20px 0;
        }

        .kl-refined .search-box input {
          width: 100%;
          min-width: 0;
          min-height: 30px;
          border: 0;
          color: var(--ink);
          background: transparent;
        }

        .kl-refined .search-box svg { flex-shrink: 0; color: var(--muted); }
        .kl-refined .empty-state { color: var(--muted); padding: 24px 0; }

        .kl-refined .more-grid {
          margin-top: 20px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .kl-refined .bottom-nav { display: none; }

        @media (hover: hover) {
          .kl-refined .course-card:hover,
          .kl-refined .quick:hover {
            border-color: #cbc3b2;
            box-shadow: 0 10px 24px -18px rgba(14,27,60,.3);
          }
        }

        @media (max-width: 1050px) {
          .kl-refined .desktop-nav { gap: 0; }
          .kl-refined .desktop-nav .nav-link { padding-inline: 9px; }
          .kl-refined .desktop-nav .nav-link svg { display: none; }
        }

        @media (max-width: 900px) {
          .kl-refined .hero,
          .kl-refined .next-grid { grid-template-columns: minmax(0, 1fr); }
          .kl-refined .course-grid { grid-template-columns: minmax(0, 1fr); }
          .kl-refined .greeting { min-height: 210px; }
          .kl-refined .progress-card { min-height: 265px; }
        }

        @media (max-width: 760px) {
          .kl-refined .desktop-nav { display: none; }
          .kl-refined .topbar-inner { padding: 12px 18px; gap: 10px; min-height: 72px; }
          .kl-refined .main {
            padding: 36px 18px calc(110px + env(safe-area-inset-bottom));
          }
          .kl-refined .greeting { padding: 26px 22px; }
          .kl-refined .hero { gap: 24px; }
          .kl-refined .quick-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .kl-refined .continue-card,
          .kl-refined .focus-card { padding: 26px 24px; }
          .kl-refined .bottom-nav {
            position: fixed;
            inset: auto 0 0;
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            padding: 7px 6px calc(7px + env(safe-area-inset-bottom));
            border-top: 1px solid var(--line);
            background: rgba(255,255,255,.97);
            backdrop-filter: blur(14px);
            z-index: 30;
          }
          .kl-refined .bottom-nav .nav-link {
            flex-direction: column;
            gap: 4px;
            padding: 5px 2px;
            min-height: 52px;
            font-size: .75rem;
            color: #727994;
            border-radius: 10px;
          }
          .kl-refined .bottom-nav .nav-link.active { color: #b5490e; }
        }

        @media (max-width: 390px) {
          .kl-refined .brand { font-size: 1rem; gap: 7px; }
          .kl-refined .brand-mark { width: 30px; height: 30px; }
          .kl-refined .header-actions { gap: 0; }
          .kl-refined .icon-button { width: 40px; }
          .kl-refined .topbar-inner { padding-inline: 14px; }
          .kl-refined .greeting h1 { font-size: 1.4rem; }
          .kl-refined .identity { padding-inline: 12px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .kl-refined * { transition: none !important; }
        }
      `}</style>

      <header className="topbar">
        <div className="topbar-inner">
          <button
            type="button"
            className="brand"
            onClick={() => navigate('Home')}
            aria-label="KampusLearn home"
          >
            <span className="brand-mark">
              <GraduationCap size={21} strokeWidth={1.5} aria-hidden="true" />
            </span>
            KampusLearn
          </button>

          <nav className="desktop-nav" aria-label="Desktop navigation">
            {navigation()}
          </nav>

          <div className="header-actions">
            <button
              type="button"
              className="icon-button"
              aria-label="Search sample courses"
              onClick={() => navigate('Learn')}
            >
              <Search size={20} strokeWidth={1.6} aria-hidden="true" />
            </button>

            <button
              type="button"
              className="icon-button"
              aria-label="View notifications"
              onClick={() =>
                openDetail(
                  'Notifications',
                  'You’re all caught up. This is a sample empty notification state.'
                )
              }
            >
              <Bell size={20} strokeWidth={1.6} aria-hidden="true" />
            </button>

            <button
              type="button"
              className="icon-button"
              aria-label="Open account options"
              onClick={() => navigate('More')}
            >
              <span className="avatar">U</span>
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        {detail ? (
          <section className="detail">
            <button
              type="button"
              className="text-button"
              onClick={() => setDetail(null)}
            >
              <ChevronLeft size={18} aria-hidden="true" />
              Back to {active}
            </button>
            <h1>{detail.title}</h1>
            <p>{detail.description}</p>
          </section>
        ) : active === 'Home' ? (
          <>
            <section className="hero">
              <div className="greeting">
                <p className="date">{date || 'Your learning workspace'}</p>
                <h1>
                  {greeting}, Usman <span aria-hidden="true">👋</span>
                </h1>
                <p className="greeting-sub">Ready to make progress today?</p>

                <div className="identity">
                  <span>Computer Engineering</span>
                  <span>300 Level</span>
                  <span>UNIMAID</span>
                </div>
              </div>

              <div className="progress-card">
                <h2>Your Practice Performance</h2>

                <div
                  className="ring"
                  role="img"
                  aria-label="Sample average practice score: 72 percent"
                >
                  <svg viewBox="0 0 132 132" aria-hidden="true">
                    <defs>
                      <linearGradient
                        id="kl-practice-gradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#ff7a29" />
                        <stop offset="100%" stopColor="#ffb067" />
                      </linearGradient>
                    </defs>

                    <circle
                      cx="66"
                      cy="66"
                      r={RADIUS}
                      fill="none"
                      stroke="rgba(255,255,255,.13)"
                      strokeWidth="11"
                    />

                    <circle
                      cx="66"
                      cy="66"
                      r={RADIUS}
                      fill="none"
                      stroke="url(#kl-practice-gradient)"
                      strokeWidth="11"
                      strokeLinecap="round"
                      strokeDasharray={CIRCUMFERENCE}
                      strokeDashoffset={
                        CIRCUMFERENCE * (1 - SAMPLE_SCORE / 100)
                      }
                    />
                  </svg>

                  <span className="ring-value">{SAMPLE_SCORE}%</span>
                </div>

                <p className="progress-note">
                  Average across 8 sample practice tests
                </p>
              </div>
            </section>

            <section className="section next-grid">
              <div className="continue-card">
                <p className="continue-tag">Your next step</p>
                <h2>Continue Computer Architecture</h2>
                <p className="continue-note">
                  CPE301 · Memory organisation
                </p>
                <p className="continue-note">
                  Lecture notes · Sample page 12 of 28
                </p>

                <button
                  type="button"
                  className="button button-orange"
                  onClick={() =>
                    openDetail(
                      'Continue reading',
                      'This sample would resume Memory organisation at page 12. ' +
                        'Saved reading positions are a proposed feature and are ' +
                        'not connected to the backend.'
                    )
                  }
                >
                  Continue learning
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              </div>

              <div className="focus-card">
                <div className="focus-label">
                  <Target size={19} aria-hidden="true" />
                  A little more practice
                </div>
                <h3>Laplace transforms</h3>
                <p>
                  MTH301 · Revisit this topic based on your sample results.
                </p>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => navigate('AI')}
                >
                  Work through it with AI
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </div>
            </section>

            <section className="section">
              <div className="section-heading">
                <h2>What do you need?</h2>
              </div>

              <div className="quick-grid">
                {[
                  {
                    label: 'Course materials',
                    note: 'Notes, slides and more',
                    icon: BookOpen,
                    destination: 'Learn',
                    color: 'orange',
                  },
                  {
                    label: 'Past questions',
                    note: 'Prepare with past papers',
                    icon: FileText,
                    destination: 'Practice',
                    color: 'violet',
                  },
                  {
                    label: 'CBT practice',
                    note: 'Put yourself to the test',
                    icon: SquareCheck,
                    destination: 'Practice',
                    color: 'mint',
                  },
                  {
                    label: 'Ask AI',
                    note: 'Make a topic click',
                    icon: Sparkles,
                    destination: 'AI',
                    color: 'navy',
                  },
                ].map(({ label, note, icon: Icon, destination, color }) => (
                  <button
                    key={label}
                    type="button"
                    className="quick"
                    onClick={() => navigate(destination)}
                  >
                    <span className={`tile-icon ${color}`}>
                      <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
                    </span>
                    <strong>{label}</strong>
                    <small>{note}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="section">
              <div className="section-heading">
                <h2>Your courses</h2>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => navigate('Learn')}
                >
                  See all
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
              {courseCards()}
            </section>

            <section className="section allowance">
              <div>
                <h2>A little help when you need it</h2>
                <p>Sample AI allowance · 6 of 20 messages used in 24 hours</p>
              </div>
              <div>
                <strong>14</strong> messages left
              </div>
            </section>
          </>
        ) : active === 'Learn' ? (
          <section>
            <div className="section-heading">
              <h1>Your learning space</h1>
            </div>
            <p>Sample courses · Computer Engineering · 300 Level</p>

            <label className="search-box">
              <Search size={20} aria-hidden="true" />
              <input
                type="search"
                aria-label="Search sample courses"
                placeholder="Search courses by name or code"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            {courseCards()}
          </section>
        ) : active === 'More' ? (
          <section className="detail">
            <h1>Your account</h1>
            <p>Usman Waziri · Sample student profile</p>

            <div className="more-grid">
              <button
                type="button"
                className="quick"
                onClick={() =>
                  openDetail(
                    'KampusCoin wallet',
                    'Sample balance: 125 KP. This preview cannot purchase or spend tokens.'
                  )
                }
              >
                <span className="tile-icon orange">
                  <Coins size={22} aria-hidden="true" />
                </span>
                <strong>125 KP</strong>
                <small>Sample wallet balance</small>
              </button>

              <button
                type="button"
                className="quick"
                onClick={() =>
                  openDetail(
                    'Notifications',
                    'You’re all caught up. This is a sample empty notification state.'
                  )
                }
              >
                <span className="tile-icon violet">
                  <Bell size={22} aria-hidden="true" />
                </span>
                <strong>Notifications</strong>
                <small>View your updates</small>
              </button>
            </div>
          </section>
        ) : (
          <section className="detail">
            <h1>{active === 'AI' ? 'Your AI study companion' : 'Practice space'}</h1>
            <p>
              {active === 'AI'
                ? 'The AI tutor will connect here after the design review. ' +
                  'No AI requests are sent and no tokens are spent in this preview.'
                : 'Past questions and CBT practice will connect here after the ' +
                  'design review. This preview does not start or submit exams.'}
            </p>

            <button
              type="button"
              className="button button-orange"
              onClick={() => navigate('Home')}
            >
              Back to Home
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </section>
        )}

        <p className="preview-footer">
          KampusLearn design preview · Fictional student data · No live services
        </p>
      </main>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navigation()}
      </nav>
    </div>
  );
}