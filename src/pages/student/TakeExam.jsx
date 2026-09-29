import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import TopBar from '../../components/TopBar.jsx';
import Loading from '../../components/Loading.jsx';
import { loadStudent, loadDraft, saveDraft, clearDraft } from '../../lib/student.js';
import { ensureStudentSession, getExam, getPages, submitAnswers, submissionState, studentIdOf } from '../../lib/db.js';
import { isBlank } from '../../lib/grading.js';
import { numberToCircled } from '../../lib/korean.js';
import { TYPE_LABEL } from '../../lib/format.js';

export default function TakeExam() {
  const { id } = useParams();
  const nav = useNavigate();
  const p = loadStudent();
  const [exam, setExam] = useState(null);
  const [pages, setPages] = useState(null);
  const [answers, setAnswers] = useState(() => (p ? loadDraft(id, p) : {}));
  const [error, setError] = useState('');
  const [missing, setMissing] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pageRefs = useRef([]);
  const cardRefs = useRef({});

  useEffect(() => {
    if (!p) return;
    (async () => {
      try {
        await ensureStudentSession();
        const state = await submissionState(id, studentIdOf(p));
        if (state === 'mine') return nav(`/exam/${id}/result`, { replace: true });
        if (state === 'taken') throw new Error('이미 제출된 기록이 있습니다. 다시 봐야 하면 선생님께 말씀드리세요.');
        const e = await getExam(id);
        if (!e || e.status !== 'open') throw new Error('지금은 볼 수 없는 평가입니다.');
        setExam(e);
        setPages(await getPages(id));
      } catch (err) {
        setError(err.code === 'permission-denied' ? '지금은 볼 수 없는 평가입니다.' : err.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (p && exam) saveDraft(id, p, answers);
  }, [answers, exam, id, p]);

  const answeredCount = useMemo(
    () => (exam ? exam.questions.filter((q) => !isBlank(answers[q.no])).length : 0),
    [answers, exam],
  );

  if (!p) return <Navigate to="/" replace />;

  function setAnswer(no, value) {
    setAnswers((a) => ({ ...a, [no]: value }));
    setMissing((m) => m.filter((x) => x !== no));
  }

  function toggleChoice(q, n) {
    const cur = Array.isArray(answers[q.no]) ? answers[q.no] : [];
    if (q.multi) setAnswer(q.no, cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort((a, b) => a - b));
    else setAnswer(q.no, cur[0] === n ? [] : [n]);
  }

  function goToPage(page) {
    pageRefs.current[page - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function trySubmit() {
    const miss = exam.questions.filter((q) => isBlank(answers[q.no])).map((q) => q.no);
    setMissing(miss);
    if (miss.length) {
      cardRefs.current[miss[0]]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setConfirming(true);
  }

  async function doSubmit() {
    setSubmitting(true);
    try {
      const clean = {};
      for (const q of exam.questions) {
        const v = answers[q.no];
        clean[q.no] = q.type === 'mc' ? v.map(Number) : String(v).trim();
      }
      await submitAnswers(id, p, clean);
      clearDraft(id, p);
      nav(`/exam/${id}/result`, { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
      setConfirming(false);
    }
  }

  const who = `${p.grade}학년 ${p.classNo}반 ${p.number}번 ${p.name}`;
  if (error) {
    return (
      <>
        <TopBar who={who} />
        <div className="container narrow">
          <div className="alert error">{error}</div>
          <p><button className="btn" onClick={() => nav('/exams')}>평가 목록으로</button></p>
        </div>
      </>
    );
  }
  if (!exam || !pages) return (<><TopBar who={who} /><Loading text="문제를 불러오는 중…" /></>);

  const total = exam.questions.length;
  return (
    <>
      <TopBar who={who} />
      <div className="exam-layout">
        <section className="exam-pages" aria-label="문제지">
          {pages.map((src, i) => (
            <div key={i} ref={(el) => (pageRefs.current[i] = el)}>
              <div className="page-label">{i + 1} / {pages.length}쪽</div>
              <img src={src} alt={`문제지 ${i + 1}쪽`} />
            </div>
          ))}
          {!pages.length && <div className="center muted">문제지 이미지가 없습니다.</div>}
        </section>

        <aside className="exam-answers" aria-label="답안지">
          <div className="head">
            <div className="muted small">{exam.subject} · {exam.unit}</div>
            <h2 style={{ margin: '2px 0 0' }}>{exam.title}</h2>
            <div className="row small" style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <span>답한 문항 <b>{answeredCount}</b> / {total}</span>
              {missing.length > 0 && <span style={{ color: 'var(--bad)' }}>안 푼 문항 {missing.length}개</span>}
            </div>
            <div className="progress"><div style={{ width: `${(answeredCount / total) * 100}%` }} /></div>
          </div>

          <div className="list">
            {exam.questions.map((q) => {
              const v = answers[q.no];
              const done = !isBlank(v);
              return (
                <div
                  key={q.no}
                  ref={(el) => (cardRefs.current[q.no] = el)}
                  className={`qcard ${missing.includes(q.no) ? 'missing' : done ? 'done' : ''}`}
                  data-testid={`q-${q.no}`}
                >
                  <div className="qhead">
                    <button className="qno" onClick={() => goToPage(q.page)} title={`${q.page}쪽 문제 보기`}>
                      {q.no}번
                    </button>
                    <span className="muted small">
                      {TYPE_LABEL[q.type]}{q.multi ? ' · 모두 고르기' : ''} · {q.points}점
                    </span>
                  </div>
                  {q.text && <div className="qtext" style={{ marginBottom: 8 }}>{q.text}</div>}
                  {q.type === 'mc' ? (
                    <ChoiceButtons q={q} value={Array.isArray(v) ? v : []} onToggle={(n) => toggleChoice(q, n)} />
                  ) : q.type === 'essay' ? (
                    <textarea
                      value={v ?? ''}
                      onChange={(e) => setAnswer(q.no, e.target.value)}
                      placeholder="답을 문장으로 써 주세요"
                      rows={4}
                      aria-label={`${q.no}번 답`}
                    />
                  ) : (
                    <input
                      type="text"
                      value={v ?? ''}
                      onChange={(e) => setAnswer(q.no, e.target.value)}
                      placeholder="답을 입력하세요"
                      aria-label={`${q.no}번 답`}
                    />
                  )}
                  {missing.includes(q.no) && <div className="small" style={{ color: 'var(--bad)', marginTop: 6 }}>답을 입력해야 제출할 수 있어요.</div>}
                </div>
              );
            })}
          </div>

          <div className="foot">
            {missing.length > 0 && (
              <div className="alert error small" style={{ marginBottom: 8 }}>
                아직 답하지 않은 문항이 있어 제출할 수 없어요: {missing.join(', ')}번
              </div>
            )}
            <button className="btn primary lg block" onClick={trySubmit} disabled={submitting}>
              제출하기 ({answeredCount}/{total})
            </button>
          </div>
        </aside>
      </div>

      {confirming && (
        <div className="modal-back" role="dialog" aria-modal="true">
          <div className="modal stack">
            <h2>답안을 제출할까요?</h2>
            <p className="muted">제출하면 답을 고칠 수 없고, 다시 볼 수 없어요.</p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setConfirming(false)} disabled={submitting}>다시 확인하기</button>
              <button className="btn primary" onClick={doSubmit} disabled={submitting}>
                {submitting ? '제출 중…' : '제출'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ChoiceButtons({ q, value, onToggle }) {
  const n = q.choiceCount || 5;
  const hasText = q.choices?.length === n && q.choices.some((c) => c);
  return (
    <div className={`choices ${hasText ? '' : 'compact'}`} role={q.multi ? 'group' : 'radiogroup'}>
      {Array.from({ length: n }, (_, i) => i + 1).map((k) => (
        <button
          key={k}
          type="button"
          className={`choice ${value.includes(k) ? 'selected' : ''}`}
          onClick={() => onToggle(k)}
          aria-pressed={value.includes(k)}
          aria-label={`${q.no}번 ${k}번 보기`}
        >
          <span className="num">{numberToCircled(k)}</span>
          {hasText && <span>{q.choices[k - 1]}</span>}
        </button>
      ))}
    </div>
  );
}
