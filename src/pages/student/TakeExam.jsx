import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { goBackTo } from '../../lib/nav.js';
import TopBar from '../../components/TopBar.jsx';
import Loading from '../../components/Loading.jsx';
import { AnswerInput, FitRegions, regionsOf, stackRatio, useSize, unitsPerCm } from '../../components/ExamViews.jsx';
import { DrawLayer, DrawToolbar } from '../../components/Drawing.jsx';
import { loadStudent, loadDraft, saveDraft, clearDraft } from '../../lib/student.js';
import {
  ensureStudentSession, getExam, getPages, submitAnswers, submissionState, studentIdOf, watchExamLive,
  loadServerDraft, saveServerDraft, deleteServerDraft, getMySubmission, getKeys, submitRetake,
} from '../../lib/db.js';
import { retakeState } from '../../lib/retake.js';
import { isBlank } from '../../lib/grading.js';
import { TYPE_LABEL, stableKey } from '../../lib/format.js';

/** 답의 형식 (이게 바뀌면 이미 입력한 답을 지운다) */
function shapeOf(q) {
  if (!q) return '';
  if (q.parts?.length) return `parts:${q.parts.map(shapeOf).join('|')}`;
  return [q.type, q.choiceCount || 0, q.matchCount || 0, q.blankCount || 0, q.draw ? 'd' : ''].join(':');
}

/** 제출용으로 답 정리 (문항 형식에 맞게) */
function cleanAnswer(x, v) {
  if (v == null) return null;
  if (x.parts?.length) {
    const out = {};
    x.parts.forEach((p, i) => {
      const pv = v.parts?.[i];
      if (pv != null) out[i] = cleanAnswer(p, pv);
    });
    return { parts: out };
  }
  if (x.type === 'draw' || x.draw) return { strokes: v.strokes || [], ...(x.type === 'draw' ? {} : { text: String(v.text ?? '').trim() }) };
  if (x.type === 'mc' || x.type === 'match') return (Array.isArray(v) ? v : []).map(Number);
  return Array.isArray(v) ? v.map((t) => String(t ?? '').trim()) : String(v).trim();
}

/** 임시 저장한 답 중 지금 문항 형식과 맞는 것만 남긴다 */
function restoreDraft(draft, questions) {
  const out = {};
  if (!draft?.answers) return out;
  for (const q of questions) {
    const v = draft.answers[q.no];
    if (v == null) continue;
    if (draft.shapes && draft.shapes[q.no] && draft.shapes[q.no] !== shapeOf(q)) continue;
    out[q.no] = v;
  }
  return out;
}

/** retake=true: 오답 재응시 — 아직 못 맞힌 문제만 다시 풀고, 처음 점수는 그대로 */
export default function TakeExam({ retake = false }) {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const p = loadStudent();
  const [exam, setExam] = useState(null);
  const [pages, setPages] = useState(null);
  const [answers, setAnswers] = useState({});
  const [ready, setReady] = useState(false); // 임시 저장한 답을 불러온 뒤에만 저장
  const [saveState, setSaveState] = useState(''); // '' | 'saving' | 'saved' | 'local'
  const serverTimer = useRef(null);
  const pendingDraft = useRef(null);
  const [cur, setCur] = useState(0);
  const [tool, setTool] = useState('pen');
  const [ruler, setRuler] = useState({ show: false, x: 60, y: 120, a: 0 });
  const [history, setHistory] = useState({}); // 문항별 되돌리기 기록
  const [error, setError] = useState('');
  const [missing, setMissing] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [mainRef, main] = useSize();
  const examRef = useRef(null);
  const noticeTimer = useRef(null);

  function showNotice(text, ms = 8000) {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    if (ms) noticeTimer.current = setTimeout(() => setNotice(''), ms);
  }

  /** 서버에서 받은 최신 평가를 화면에 반영 (같은 내용이 여러 번 와도 한 번만) */
  function applyExam(next) {
    const prev = examRef.current;
    if (!next || !prev) return;
    if (next.status !== 'open') {
      setError('선생님이 평가를 마감했어요.');
      return;
    }
    const newRev = (next.revision || 0) > (prev.revision || 0);
    if (!newRev && stableKey(next.questions) === stableKey(prev.questions)) return;
    // 학생 화면에 보이는 것만 비교 (영역·위치 정보 등은 제외)
    const view = (x) => (x ? { ...x, regions: undefined, anchor: undefined, blanks: undefined, answerSpots: undefined, text: undefined, blankInfo: undefined, fullText: undefined } : null);
    const changed = new Set(
      next.questions.filter((q) => stableKey(view(prev.questions.find((o) => o.no === q.no))) !== stableKey(view(q))).map((q) => q.no),
    );
    if (newRev) for (const no of next.lastEdit?.nos || []) changed.add(no);
    examRef.current = next;
    setExam(next);
    // 형식이 바뀐 문항의 답은 지운다 (예: 단답형 → 객관식)
    setAnswers((a) => {
      const out = { ...a };
      for (const q of next.questions) {
        const oq = prev.questions.find((o) => o.no === q.no);
        if (out[q.no] != null && (!oq || shapeOf(oq) !== shapeOf(q))) delete out[q.no];
      }
      return out;
    });
    setCur((c) => Math.min(c, next.questions.length - 1));
    const nos = [...changed].sort((x, y) => x - y);
    if (nos.length) showNotice(`선생님이 ${nos.join(', ')}번 문제를 고쳤어요. 다시 확인해 주세요.`, 15000);
    else if (newRev) showNotice('선생님이 문제를 고쳤어요. 다시 확인해 주세요.', 15000);
  }

  useEffect(() => {
    if (!p) return undefined;
    let unsubExam = () => {};
    let alive = true;
    (async () => {
      try {
        await ensureStudentSession(p);
        if (retake) {
          // 오답 재응시: 임시 저장·실시간 반영 없이, 남은 오답만
          const sub = await getMySubmission(id, studentIdOf(p));
          if (!sub) return nav(`/exam/${id}`, { replace: true, state: location.state });
          const [e, keys] = await Promise.all([getExam(id), getKeys(id)]);
          if (!e) throw new Error('평가를 찾을 수 없습니다.');
          const st = retakeState(e, keys, sub);
          if (!st.enabled || st.done) return nav(`/exam/${id}/result`, { replace: true, state: location.state });
          const only = { ...e, questions: e.questions.filter((q) => st.remaining.includes(q.no)) };
          examRef.current = only;
          setExam(only);
          setPages(await getPages(id));
          return;
        }
        const state = await submissionState(id, studentIdOf(p));
        if (state === 'mine') return nav(`/exam/${id}/result`, { replace: true, state: location.state });
        if (state === 'taken') return nav(`/exam/${id}/result`, { replace: true, state: location.state });
        const e = await getExam(id);
        if (!e || e.status !== 'open') throw new Error('지금은 볼 수 없는 평가입니다.');
        // 풀던 답 불러오기: 이 기기(localStorage)와 서버 중 더 최근 것
        const local = loadDraft(id, p);
        const server = await loadServerDraft(id, p);
        const draft = [local, server].filter(Boolean).sort((a, b) => (b.at || 0) - (a.at || 0))[0];
        const restored = restoreDraft(draft, e.questions);
        const n = Object.keys(restored).length;
        setExam(e);
        setAnswers(restored);
        if (n) {
          setCur(Math.min(Math.max(0, Number(draft.cur) || 0), e.questions.length - 1));
          showNotice(`지난번에 풀던 답 ${n}문항을 불러왔어요. 이어서 풀어요.`, 6000);
        }
        setReady(true);
        setPages(await getPages(id));
        // 시험 중 선생님이 문제·정답을 고치면 바로 반영 (실시간 + 연결이 끊겨도 주기적으로 확인)
        examRef.current = e;
        if (!alive) return;
        unsubExam = watchExamLive(id, applyExam);
      } catch (err) {
        setError(err.code === 'permission-denied' ? '지금은 볼 수 없는 평가입니다.' : err.message);
      }
    })();
    return () => {
      alive = false;
      unsubExam();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 답을 고칠 때마다 이 기기에 바로 저장 + 서버에도 잠깐 뒤 저장 (사이트가 꺼져도 답이 남도록)
  useEffect(() => {
    if (!p || !exam || !ready) return;
    const shapes = {};
    for (const q of exam.questions) shapes[q.no] = shapeOf(q);
    const draft = { answers, shapes, cur, at: Date.now() };
    saveDraft(id, p, draft);
    pendingDraft.current = draft;
    setSaveState('saving');
    clearTimeout(serverTimer.current);
    serverTimer.current = setTimeout(flushDraft, 1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, cur, ready]);

  function flushDraft() {
    clearTimeout(serverTimer.current);
    const d = pendingDraft.current;
    if (!d || !p) return;
    pendingDraft.current = null;
    saveServerDraft(id, p, d)
      .then(() => setSaveState((s) => (pendingDraft.current ? s : 'saved')))
      .catch(() => setSaveState('local'));
  }

  // 화면을 닫거나 다른 앱으로 넘어갈 때 곧바로 서버에 저장
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flushDraft();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushDraft);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushDraft);
      flushDraft();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <p><button className="btn" onClick={() => goBackTo(nav, location, '/exams')}>평가 목록으로</button></p>
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
      for (const x of qs) clean[x.no] = cleanAnswer(x, answers[x.no]);
      if (retake) {
        await submitRetake(id, p, clean);
        // 결과 화면에서 왔으면 그 기록으로 돌아감 (결과 화면이 기록에 두 번 쌓이지 않게)
        goBackTo(nav, location, `/exam/${id}/result`);
        return;
      }
      await submitAnswers(id, p, clean);
      clearTimeout(serverTimer.current);
      pendingDraft.current = null;
      clearDraft(id, p);
      deleteServerDraft(id, p);
      nav(`/exam/${id}/result`, { replace: true, state: location.state });
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
      {isDraw && (
        <div className="small muted" style={{ marginTop: 8 }}>
          왼쪽 문제 그림 위에 직접 그리세요.{q.type !== 'draw' && ' 그림을 그렸으면 답 칸은 비워도 제출할 수 있어요.'}
        </div>
      )}
      {missing.includes(q.no) && <div className="small" style={{ color: 'var(--bad)', marginTop: 8 }}>답을 입력해야 제출할 수 있어요.</div>}
    </div>
  );

  return (
    <div className="exam-shell">
      <header className="exam-top">
        <b className="exam-title">{retake && <span className="badge review" style={{ marginRight: 6 }}>오답 재응시</span>}{exam.title}</b>
        <span className="muted small">{who}</span>
        <div className="exam-progress">
          <span className={`save-state small ${saveState}`} data-testid="save-state">
            {saveState === 'saving' ? '저장 중…' : saveState === 'saved' ? '✓ 자동 저장됨' : saveState === 'local' ? '✓ 이 기기에 저장됨' : ''}
          </span>
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
      {notice && (
        <div className="missing-toast notice-toast" role="status" onClick={() => setNotice('')}>
          🔔 {notice} <button type="button" className="btn xs" style={{ marginLeft: 8 }}>확인</button>
        </div>
      )}
      {missing.length > 0 && (
        <div className="missing-toast" role="alert">
          아직 답하지 않은 문항이 있어 제출할 수 없어요: {missing.join(', ')}번
        </div>
      )}

      {confirming && (
        <div className="modal-back" role="dialog" aria-modal="true">
          <div className="modal stack">
            <h2>{retake ? '다시 푼 답을 제출할까요?' : '답안을 제출할까요?'}</h2>
            <p className="muted">
              {retake ? '또 틀린 문제는 다시 풀 수 있어요. 점수는 처음 제출한 점수 그대로예요.' : '제출하면 답을 고칠 수 없고, 다시 볼 수 없어요.'}
            </p>
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
