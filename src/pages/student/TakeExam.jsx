import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import TopBar from '../../components/TopBar.jsx';
import Loading from '../../components/Loading.jsx';
import { AnswerInput, FitRegions, regionsOf, stackRatio, useSize, unitsPerCm } from '../../components/ExamViews.jsx';
import { DrawLayer, DrawToolbar } from '../../components/Drawing.jsx';
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
  const [tool, setTool] = useState('pen');
  const [ruler, setRuler] = useState({ show: false, x: 60, y: 120, a: 0 });
  const [history, setHistory] = useState({}); // 문항별 되돌리기 기록
  const [error, setError] = useState('');
  const [missing, setMissing] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mainRef, main] = useSize();

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
        if (x.type === 'draw' || x.draw) clean[x.no] = { strokes: v.strokes, ...(x.type === 'draw' ? {} : { text: String(v.text).trim() }) };
        else clean[x.no] = x.type === 'mc' || x.type === 'match' ? v.map(Number) : String(v).trim();
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

  // ── 화면 배치 고르기 (태블릿 한 화면에 스크롤 없이) ──
  const { passage, question } = regionsOf(exam, q);
  const rp = stackRatio(exam, passage);
  const rq = stackRatio(exam, question);
  const ANSWER_W = 340;
  const answerH =
    q.type === 'draw' ? 190 : q.draw ? 280
      : q.type === 'essay' ? 190 : q.type === 'match' ? 70 + 56 * (q.matchCount || 2) : q.type === 'short' ? 120 : 110;
  const H = main.h - 24;
  // 세로로 긴 화면(태블릿 세로)은 답 칸을 아래에, 가로 화면은 오른쪽에
  const portrait = main.h > main.w * 1.05;
  const contentH = portrait ? H - answerH - 12 : H;
  const stackW = Math.min(main.w - (portrait ? 40 : ANSWER_W + 40), contentH / (rp + rq || 1));
  const colW = (main.w - 40) / 2;
  const sideW = portrait
    ? Math.min(colW, contentH / (rp || 1), contentH / (rq || 1))
    : Math.min(colW, H / (rp || 1), (H - answerH) / (rq || 1));
  const side = passage.length > 0 && main.w >= 700 && sideW > stackW * 1.1;

  // ── 그리기 ──
  const isDraw = q.type === 'draw' || q.draw;
  const drawValue = isDraw ? answers[q.no] || { strokes: [] } : null;
  const setStrokes = (strokes) => {
    setHistory((h) => ({ ...h, [q.no]: [...(h[q.no] || []), drawValue.strokes].slice(-60) }));
    setAnswer(q.no, { ...drawValue, strokes });
  };
  const undo = () => {
    const h = history[q.no] || [];
    if (!h.length) return setAnswer(q.no, { ...drawValue, strokes: drawValue.strokes.slice(0, -1) });
    setHistory({ ...history, [q.no]: h.slice(0, -1) });
    setAnswer(q.no, { ...drawValue, strokes: h[h.length - 1] });
  };
  const questionSection = {
    kind: 'question',
    regions: question,
    overlay: isDraw
      ? (ratio) => (
          <DrawLayer
            ratio={ratio}
            strokes={drawValue.strokes}
            onChange={setStrokes}
            tool={tool}
            ruler={ruler}
            setRuler={setRuler}
            ppc={unitsPerCm(exam, question)}
          />
        )
      : null,
  };

  const answerBox = (
    <div className="answer-box" data-testid={`q-${q.no}`}>
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="answer-no">{q.no}번</span>
        <span className="muted small">{TYPE_LABEL[q.type]} · {q.points}점</span>
      </div>
      {isDraw && (
        <DrawToolbar
          tool={tool}
          setTool={setTool}
          ruler={ruler}
          setRuler={setRuler}
          onUndo={undo}
          onClear={() => setStrokes([])}
          canUndo={drawValue.strokes.length > 0}
        />
      )}
      {isDraw ? (
        q.type !== 'draw' && (
          <div style={{ marginTop: 10 }}>
            <AnswerInput q={{ ...q, draw: false }} value={drawValue.text ?? ''} onChange={(t) => setAnswer(q.no, { ...drawValue, text: t })} />
          </div>
        )
      ) : (
        <AnswerInput q={q} value={answers[q.no]} onChange={(v) => setAnswer(q.no, v)} />
      )}
      {isDraw && <div className="small muted" style={{ marginTop: 8 }}>왼쪽 문제 그림 위에 직접 그리세요.</div>}
      {missing.includes(q.no) && <div className="small" style={{ color: 'var(--bad)', marginTop: 8 }}>답을 입력해야 제출할 수 있어요.</div>}
    </div>
  );

  return (
    <div className="exam-shell">
      <header className="exam-top">
        <b className="exam-title">{exam.title}</b>
        <span className="muted small">{who}</span>
        <div className="exam-progress">
          <span className="small">답한 문항 <b>{answeredCount}</b>/{total}</span>
          <div className="progress"><div style={{ width: `${(answeredCount / total) * 100}%` }} /></div>
        </div>
      </header>

      <main ref={mainRef} className={`exam-main ${portrait ? 'portrait' : ''} ${side ? 'side' : 'stack'}`} aria-label={`${q.no}번 문제`}>
        {portrait && main.w >= 700 ? (
          <>
            <div className="pane grow portrait-content">
              {side ? (
                <>
                  <FitRegions exam={exam} pages={pages} sections={[{ kind: 'passage', regions: passage }]} className="grow" />
                  <FitRegions exam={exam} pages={pages} sections={[questionSection]} className="grow" />
                </>
              ) : (
                <FitRegions
                  exam={exam}
                  pages={pages}
                  sections={[{ kind: 'passage', regions: passage }, questionSection]}
                  className="grow"
                />
              )}
            </div>
            {answerBox}
          </>
        ) : side ? (
          <>
            <FitRegions exam={exam} pages={pages} sections={[{ kind: 'passage', regions: passage }]} className="pane" />
            <div className="pane col">
              <FitRegions exam={exam} pages={pages} sections={[questionSection]} className="grow" />
              {answerBox}
            </div>
          </>
        ) : (
          <>
            <FitRegions
              exam={exam}
              pages={pages}
              sections={[{ kind: 'passage', regions: passage }, questionSection]}
              className="pane grow"
            />
            <div className="pane answer-pane">{answerBox}</div>
          </>
        )}
      </main>

      <footer className="exam-bottom">
        <button className="btn nav-btn" onClick={() => setCur(cur - 1)} disabled={cur === 0}>← 이전</button>
        <div className="qnav" role="navigation" aria-label="문항 이동">
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
        {cur < total - 1 ? (
          <button className="btn primary nav-btn" onClick={() => setCur(cur + 1)}>다음 →</button>
        ) : (
          <span />
        )}
        <button className="btn primary nav-btn submit-btn" onClick={trySubmit} disabled={submitting}>
          제출하기
        </button>
      </footer>
      {missing.length > 0 && (
        <div className="missing-toast" role="alert">
          아직 답하지 않은 문항이 있어 제출할 수 없어요: {missing.join(', ')}번
        </div>
      )}

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
    </div>
  );
}
