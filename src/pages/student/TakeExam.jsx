import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import TopBar from '../../components/TopBar.jsx';
import Loading from '../../components/Loading.jsx';
import { QuestionView, AnswerInput } from '../../components/ExamViews.jsx';
import { loadStudent, loadDraft, saveDraft, clearDraft } from '../../lib/student.js';
import { ensureStudentSession, getExam, getPages, submitAnswers, submissionState, studentIdOf } from '../../lib/db.js';
import { isBlank } from '../../lib/grading.js';
import { TYPE_LABEL } from '../../lib/format.js';

export default function TakeExam() {
  const { id } = useParams();
  const nav = useNavigate();
  const p = loadStudent();
  const [exam, setExam] = useState(null);
  const [pages, setPages] = useState(null);
  const [answers, setAnswers] = useState(() => (p ? loadDraft(id, p) : {}));
  const [cur, setCur] = useState(0);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const leftRef = useRef(null);

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

  useEffect(() => {
    leftRef.current?.scrollTo({ top: 0 });
  }, [cur]);

  const answeredCount = useMemo(
    () => (exam ? exam.questions.filter((q) => !isBlank(answers[q.no], q)).length : 0),
    [answers, exam],
  );

  if (!p) return <Navigate to="/" replace />;

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

  const qs = exam.questions;
  const q = qs[cur];
  const total = qs.length;

  function setAnswer(no, value) {
    setAnswers((a) => ({ ...a, [no]: value }));
    setMissing((m) => m.filter((x) => x !== no));
  }

  function trySubmit() {
    const miss = qs.filter((x) => isBlank(answers[x.no], x)).map((x) => x.no);
    setMissing(miss);
    if (miss.length) {
      setCur(qs.findIndex((x) => x.no === miss[0]));
      return;
    }
    setConfirming(true);
  }

  async function doSubmit() {
    setSubmitting(true);
    try {
      const clean = {};
      for (const x of qs) {
        const v = answers[x.no];
        clean[x.no] = x.type === 'mc' || x.type === 'match' ? v.map(Number) : String(v).trim();
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

  return (
    <>
      <TopBar who={who} />
      <div className="solve">
        <section className="solve-left" ref={leftRef} aria-label={`${q.no}번 문제`}>
          <QuestionView exam={exam} q={q} pages={pages} />
        </section>

        <aside className="solve-right" aria-label="답안">
          <div className="sec">
            <div className="muted small">{exam.subject} · {exam.unit}</div>
            <div style={{ fontWeight: 700 }}>{exam.title}</div>
            <div className="row small" style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <span>답한 문항 <b>{answeredCount}</b> / {total}</span>
              {missing.length > 0 && <span style={{ color: 'var(--bad)' }}>안 푼 문항 {missing.length}개</span>}
            </div>
            <div className="progress"><div style={{ width: `${(answeredCount / total) * 100}%` }} /></div>
          </div>

          <div className="sec grow" data-testid={`q-${q.no}`}>
            <div className="row" style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 22, fontWeight: 800 }}>{q.no}번</span>
              <span className="muted small">{TYPE_LABEL[q.type]} · {q.points}점</span>
            </div>
            <AnswerInput q={q} value={answers[q.no]} onChange={(v) => setAnswer(q.no, v)} />
            {missing.includes(q.no) && (
              <div className="small" style={{ color: 'var(--bad)', marginTop: 8 }}>답을 입력해야 제출할 수 있어요.</div>
            )}
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
              <button className="btn" onClick={() => setCur(cur - 1)} disabled={cur === 0}>← 이전 문제</button>
              <button className="btn primary" onClick={() => setCur(cur + 1)} disabled={cur === total - 1}>다음 문제 →</button>
            </div>
          </div>

          <div className="sec">
            <div className="small muted" style={{ marginBottom: 6 }}>문항 번호를 누르면 이동해요</div>
            <div className="qnav">
              {qs.map((x, i) => (
                <button
                  key={x.no}
                  className={`${!isBlank(answers[x.no], x) ? 'done' : ''} ${missing.includes(x.no) ? 'missing' : ''} ${i === cur ? 'current' : ''}`}
                  onClick={() => setCur(i)}
                  aria-label={`${x.no}번으로 이동`}
                >
                  {x.no}
                </button>
              ))}
            </div>
          </div>

          <div className="sec">
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
