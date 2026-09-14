'use client';

import {useEffect,useMemo,useState} from 'react';
import {
  CheckCircle,
  CircleDot,
  Edit3,
  BookOpen,
  ArrowRight
} from 'lucide-react';

import {
  api,
  s,
  useData,
  useSearch,
  State,
  Empty,
  SearchBox,
  Pager,
  Modal,
  saved,
  message,
  number
} from './shared';

export default function QuestionBank(){
  const banks=useData('/admin-console/question-banks');

  const [bankId,setBankId]=useState('');
  const [status,setStatus]=useState('');
  const [difficulty,setDifficulty]=useState('');
  const [topic,setTopic]=useState('');
  const [page,setPage]=useState(1);
  const [value,setValue,search]=useSearch();
  const [selected,setSelected]=useState(null);

  useEffect(()=>{
    if(!bankId && banks.data?.length){
      setBankId(banks.data[0].id);
    }
  },[bankId,banks.data]);

  useEffect(()=>{
    setPage(1);
  },[bankId,status,difficulty,topic,search]);

  const url=useMemo(()=>{
    if(!bankId)return '';

    const p=new URLSearchParams();

    p.set('page',String(page));

    if(status)p.set('status',status);
    if(difficulty)p.set('difficulty',difficulty);
    if(topic)p.set('topic',topic);
    if(search)p.set('search',search);

    return `/admin-console/question-banks/${bankId}/questions?${p}`;
  },[
    bankId,
    page,
    status,
    difficulty,
    topic,
    search
  ]);

  const questions=useData(
    url || '/admin-console/question-banks'
  );

  const bank=banks.data?.find(x=>x.id===bankId);

  function reload(){
    banks.reload();
    questions.reload();
  }

  return <>
    <div className={s.heading}>
      <div>
        <small>ASSESSMENT CONTENT</small>

        <h1>Question Bank</h1>

        <p>
          Review and publish shared practice questions
          before they reach students.
        </p>
      </div>
    </div>

    <State resource={banks}>
      {!banks.data?.length
        ? <Empty>No shared question banks have been created yet.</Empty>
        : <>
          <section className={s.card}>
            <label>
              Shared bank

              <select
                value={bankId}
                onChange={e=>{
                  setBankId(e.target.value);
                  setTopic('');
                }}
              >
                {banks.data.map(x=>
                  <option key={x.id} value={x.id}>
                    {x.code} · {x.title} · {x.level}
                  </option>
                )}
              </select>
            </label>

            {bank&&
              <div className={s.kpis}>
                <section className={s.card}>
                  <small>Total questions</small>
                  <strong>{number(bank.total_questions)}</strong>
                  <p>{bank.topics} topics</p>
                </section>

                <section className={s.card}>
                  <small>Approved</small>
                  <strong>{number(bank.approved_questions)}</strong>
                  <p>Visible to students</p>
                </section>

                <section className={s.card}>
                  <small>Drafts</small>
                  <strong>{number(bank.draft_questions)}</strong>
                  <p>Awaiting review</p>
                </section>

                <section className={s.card}>
                  <small>Shared reach</small>
                  <strong>{number(bank.mapped_courses)}</strong>
                  <p>Course instances</p>
                </section>
              </div>
            }
          </section>

          {bankId&&
            <State resource={questions}>
              <>
                <section className={s.card}>
                  <div className={s.toolbar}>
                    <SearchBox
                      value={value}
                      onChange={setValue}
                      placeholder="Search question text…"
                    />

                    <select
                      aria-label="Review status"
                      value={status}
                      onChange={e=>setStatus(e.target.value)}
                    >
                      <option value="">All statuses</option>
                      <option value="draft">Draft</option>
                      <option value="approved">Approved</option>
                    </select>

                    <select
                      aria-label="Difficulty"
                      value={difficulty}
                      onChange={e=>setDifficulty(e.target.value)}
                    >
                      <option value="">All difficulties</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>

                    <select
                      aria-label="Topic"
                      value={topic}
                      onChange={e=>setTopic(e.target.value)}
                    >
                      <option value="">All topics</option>

                      {questions.data?.topics?.map(x=>
                        <option key={x.id} value={x.id}>
                          {x.name} · {x.questions}
                        </option>
                      )}
                    </select>
                  </div>

                  {questions.data?.rows?.length
                    ? <>
                      <div className={s.tableWrap}>
                        <table>
                          <thead>
                            <tr>
                              <th>Question</th>
                              <th>Topic</th>
                              <th>Difficulty</th>
                              <th>Status</th>
                              <th>Review</th>
                            </tr>
                          </thead>

                          <tbody>
                            {questions.data.rows.map(q=>
                              <tr key={q.id}>
                                <td>
                                  <button
                                    className={s.entity}
                                    onClick={()=>setSelected(q)}
                                  >
                                    <span className={s.icon}>
                                      <BookOpen size={19}/>
                                    </span>

                                    <span>
                                      <b>{q.question_text}</b>
                                      <small>
                                        {q.question_type
                                          ?.replaceAll('_',' ')}
                                      </small>
                                    </span>
                                  </button>
                                </td>

                                <td>{q.topic_name||'—'}</td>

                                <td>
                                  {q.difficulty}
                                </td>

                                <td>
                                  <span className={
                                    q.is_approved
                                      ? s.badge
                                      : s.warning
                                  }>
                                    {q.is_approved
                                      ? 'Approved'
                                      : 'Draft'}
                                  </span>
                                </td>

                                <td>
                                  <button
                                    onClick={()=>setSelected(q)}
                                    aria-label="Review question"
                                  >
                                    <ArrowRight size={17}/>
                                  </button>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <Pager
                        data={questions.data}
                        page={page}
                        setPage={setPage}
                      />
                    </>
                    : <Empty>No questions match these filters.</Empty>
                  }
                </section>

                {selected&&
                  <QuestionReview
                    item={selected}
                    onClose={()=>{
                      setSelected(null);
                      reload();
                    }}
                  />
                }
              </>
            </State>
          }
        </>
      }
    </State>
  </>;
}

function QuestionReview({item,onClose}){
  const [edit,setEdit]=useState(false);
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState('');

  const [questionText,setQuestionText]=useState(
    item.question_text||''
  );

  const [explanation,setExplanation]=useState(
    item.explanation||''
  );

  const [difficulty,setDifficulty]=useState(
    item.difficulty||'medium'
  );

  const [correct,setCorrect]=useState(
    item.correct_answer||''
  );

  const [options,setOptions]=useState(
    Array.isArray(item.options)
      ? item.options.map(x=>({...x}))
      : []
  );

  async function toggleApproval(){
    if(busy)return;

    setBusy(true);
    setErr('');

    try{
      await api.patch(
        `/admin-console/question-bank/questions/${item.id}`,
        {is_approved:!item.is_approved}
      );

      saved(
        item.is_approved
          ? 'Question returned to draft'
          : 'Question approved'
      );

      onClose();

    }catch(e){
      setErr(message(e));
    }finally{
      setBusy(false);
    }
  }

  async function saveEdit(e){
    e.preventDefault();

    if(busy)return;

    setBusy(true);
    setErr('');

    try{
      await api.patch(
        `/admin-console/question-bank/questions/${item.id}`,
        {
          question_text:questionText,
          explanation,
          difficulty,
          correct_answer:correct,
          question_type:item.question_type,
          options
        }
      );

      saved('Question updated');
      onClose();

    }catch(e){
      setErr(message(e));
    }finally{
      setBusy(false);
    }
  }

  return <Modal
    wide
    title={edit ? 'Edit question' : 'Review question'}
    onClose={onClose}
  >
    {!edit
      ? <>
        <div className={s.contentHero}>
          {item.is_approved
            ? <CheckCircle size={35}/>
            : <CircleDot size={35}/>
          }

          <h3>{item.topic_name||'Practice question'}</h3>

          <p>
            {item.difficulty} · {item.question_type}
          </p>

          <span className={
            item.is_approved ? s.badge : s.warning
          }>
            {item.is_approved ? 'Approved' : 'Draft'}
          </span>
        </div>

        <section className={s.card}>
          <h2>{item.question_text}</h2>

          {Array.isArray(item.options)&&
            item.options.map(opt=>
              <p key={opt.label}>
                <b>{opt.label}.</b> {opt.text}
                {opt.label===item.correct_answer
                  ? ' ✓'
                  : ''
                }
              </p>
            )
          }
        </section>

        <section className={s.card}>
          <small>CORRECT ANSWER</small>
          <h3>{item.correct_answer}</h3>

          <small>EXPLANATION</small>
          <p>
            {item.explanation||'No explanation provided.'}
          </p>
        </section>

        {err&&<p className={s.error}>{err}</p>}

        <div className={s.actions}>
          <button
            disabled={busy}
            onClick={()=>setEdit(true)}
          >
            <Edit3 size={17}/> Edit
          </button>

          <button
            className={s.primary}
            disabled={busy}
            onClick={toggleApproval}
          >
            {busy
              ? 'Working…'
              : item.is_approved
                ? 'Return to draft'
                : 'Approve question'
            }
          </button>
        </div>
      </>
      :
      <form onSubmit={saveEdit} className={s.form}>
        <fieldset disabled={busy}>
          <label>
            Question
            <textarea
              rows={4}
              value={questionText}
              onChange={e=>setQuestionText(e.target.value)}
            />
          </label>

          {options.map((opt,index)=>
            <label key={index}>
              Option {opt.label}
              <input
                value={opt.text}
                onChange={e=>{
                  const next=[...options];
                  next[index]={
                    ...next[index],
                    text:e.target.value
                  };
                  setOptions(next);
                }}
              />
            </label>
          )}

          <label>
            Correct answer

            <select
              value={correct}
              onChange={e=>setCorrect(e.target.value)}
            >
              {options.map(opt=>
                <option key={opt.label} value={opt.label}>
                  {opt.label}
                </option>
              )}
            </select>
          </label>

          <label>
            Difficulty

            <select
              value={difficulty}
              onChange={e=>setDifficulty(e.target.value)}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>

          <label>
            Explanation

            <textarea
              rows={4}
              value={explanation}
              onChange={e=>setExplanation(e.target.value)}
            />
          </label>
        </fieldset>

        {err&&<p className={s.error}>{err}</p>}

        <footer>
          <button
            type="button"
            disabled={busy}
            onClick={()=>setEdit(false)}
          >
            Cancel
          </button>

          <button
            className={s.primary}
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Save question'}
          </button>
        </footer>
      </form>
    }
  </Modal>;
}
