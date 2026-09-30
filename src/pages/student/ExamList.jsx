import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar.jsx';
import Loading from '../../components/Loading.jsx';
import { loadStudent, clearStudent } from '../../lib/student.js';
import { ensureStudentSession, listOpenExams, listMyResults } from '../../lib/db.js';

export default function ExamList() {
  const nav = useNavigate();
  const p = loadStudent();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!p) return;
    (async () => {
      try {
        await ensureStudentSession(p);
        const [open, mine] = await Promise.all([
          listOpenExams(p.school, p.grade, p.classNo),
          listMyResults(p).catch(() => []), // 지난 결과를 못 불러와도 볼 수 있는 평가는 보여 준다
        ]);
        setData({ open, mine });
      } catch (e) {
        if (e.message.startsWith('학생 명단')) {
          clearStudent();
          nav('/', { replace: true });
          return;
        }
        setError(`평가 목록을 불러오지 못했습니다: ${e.message}`);
      }
    })();
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
