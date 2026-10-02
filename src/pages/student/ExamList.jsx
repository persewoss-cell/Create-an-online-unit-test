import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar.jsx';
import Loading from '../../components/Loading.jsx';
import { loadStudent, clearStudent } from '../../lib/student.js';
import { ensureStudentSession, watchOpenExams, watchMyResults } from '../../lib/db.js';
import { useToast } from '../../components/Toast.jsx';

export default function ExamList() {
  const nav = useNavigate();
  const p = loadStudent();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const [toast, notify] = useToast();
  const prev = useRef(null); // 지난번 목록 (바뀐 것을 알림으로 알려 주기 위해)

  // 선생님이 시험을 개시·마감하거나 오답 재응시를 열면 새로고침하지 않아도 바로 바뀐다
  useEffect(() => {
    if (!p) return undefined;
    let alive = true;
    const unsubs = [];
    const cur = { open: null, mine: null };
    const publish = () => {
      if (!cur.open || !cur.mine) return;
      const before = prev.current;
      if (before) {
        const doneNow = new Set(cur.mine.map((m) => m.exam.id));
        for (const e of cur.open) {
          if (!before.open.some((x) => x.id === e.id) && !doneNow.has(e.id)) notify(`새 평가가 열렸어요: ${e.title}`, { kind: 'success' });
        }
        for (const e of before.open) {
          if (!cur.open.some((x) => x.id === e.id)) notify(`선생님이 응시를 마감했어요: ${e.title}`);
        }
        for (const m of cur.mine) {
          const old = before.mine.find((x) => x.exam.id === m.exam.id);
          if (old && !old.submission.retake?.on && m.submission.retake?.on) notify(`오답 재응시가 열렸어요: ${m.exam.title}`, { kind: 'success' });
        }
        for (const m of before.mine) {
          if (!cur.mine.some((x) => x.exam.id === m.exam.id) && cur.open.some((x) => x.id === m.exam.id)) {
            notify(`선생님이 다시 응시할 수 있게 했어요: ${m.exam.title}`, { kind: 'success' });
          }
        }
      }
      prev.current = { open: cur.open, mine: cur.mine };
      setData({ open: cur.open, mine: cur.mine });
    };
    (async () => {
      try {
        await ensureStudentSession(p);
        if (!alive) return;
        unsubs.push(
          watchOpenExams(p.school, p.grade, p.classNo, (open) => {
            cur.open = open;
            publish();
          }, (e) => setError(`평가 목록을 불러오지 못했습니다: ${e.message}`)),
          // 지난 결과를 못 불러와도 볼 수 있는 평가는 보여 준다
          watchMyResults(p, (mine) => {
            cur.mine = mine;
            publish();
          }, () => {
            if (!cur.mine) {
              cur.mine = [];
              publish();
            }
          }),
        );
      } catch (e) {
        if (e.message.startsWith('학생 명단')) {
          clearStudent();
          nav('/', { replace: true });
          return;
        }
        setError(`평가 목록을 불러오지 못했습니다: ${e.message}`);
      }
    })();
    return () => {
      alive = false;
      unsubs.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!p) return <Navigate to="/" replace />;

  function logout() {
    clearStudent();
    nav('/');
  }

  const doneIds = new Set((data?.mine || []).map((m) => m.exam.id));
  const past = (data?.mine || [])
    .filter((m) => !data.open.some((e) => e.id === m.exam.id))
    .sort((a, b) => (b.submission.submittedAt?.seconds || 0) - (a.submission.submittedAt?.seconds || 0));

  const card = (e, done) => (
    <div key={e.id} className="card row" style={{ justifyContent: 'space-between' }}>
      <div>
        <div className="muted small">
          {e.subject} · {e.grade}학년 {e.semester}학기 {e.unit && `· ${e.unit}`}
        </div>
        <h2 style={{ margin: '4px 0' }}>{e.title}</h2>
        <div className="muted small">{e.questions.length}문항</div>
      </div>
      <div className="row">
        {done ? (
          <button className="btn done-btn" disabled aria-label="응시 완료">✔ 응시 완료</button>
        ) : (
          <button className="btn primary" onClick={() => nav(`/exam/${e.id}`)}>평가 시작</button>
        )}
        {done && (
          <button className="btn result-btn" onClick={() => nav(`/exam/${e.id}/result`)}>평가 결과</button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <TopBar who={`${p.grade}학년 ${p.classNo}반 ${p.number}번 ${p.name}`}>
        <button className="btn sm" onClick={logout}>나가기</button>
      </TopBar>
      {toast}
      <div className="container" style={{ maxWidth: 760 }}>
        <h1>볼 수 있는 단원평가</h1>
        {error && <div className="alert error">{error}</div>}
        {!data && !error && <Loading />}
        {data && !data.open.length && (
          <div className="card center muted">지금 볼 수 있는 평가가 없습니다. 선생님이 평가를 열 때까지 기다려 주세요.</div>
        )}
        {data?.open.map((e) => card(e, doneIds.has(e.id)))}
        {past.length > 0 && (
          <>
            <h2 style={{ marginTop: 28 }}>지난 평가 결과</h2>
            {past.map((m) => card(m.exam, true))}
          </>
        )}
      </div>
    </>
  );
}
