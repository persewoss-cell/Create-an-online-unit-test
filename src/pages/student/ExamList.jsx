import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar.jsx';
import Loading from '../../components/Loading.jsx';
import { loadStudent, clearStudent } from '../../lib/student.js';
import { ensureStudentSession, listOpenExams, submissionState, studentIdOf } from '../../lib/db.js';

export default function ExamList() {
  const nav = useNavigate();
  const p = loadStudent();
  const [exams, setExams] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!p) return;
    (async () => {
      try {
        await ensureStudentSession();
        setExams(await listOpenExams(p.grade, p.classNo));
      } catch (e) {
        setError(`평가 목록을 불러오지 못했습니다: ${e.message}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!p) return <Navigate to="/" replace />;

  async function choose(exam) {
    setMsg('');
    try {
      const state = await submissionState(exam.id, studentIdOf(p));
      if (state === 'none') nav(`/exam/${exam.id}`);
      else if (state === 'mine') nav(`/exam/${exam.id}/result`);
      else setMsg(`「${exam.title}」은(는) 이미 ${p.grade}학년 ${p.classNo}반 ${p.number}번으로 제출된 기록이 있습니다. 다시 봐야 하면 선생님께 말씀드리세요.`);
    } catch (e) {
      setMsg(`확인 중 오류가 발생했습니다: ${e.message}`);
    }
  }

  function logout() {
    clearStudent();
    nav('/');
  }

  return (
    <>
      <TopBar who={`${p.grade}학년 ${p.classNo}반 ${p.number}번 ${p.name}`}>
        <button className="btn sm" onClick={logout}>나가기</button>
      </TopBar>
      <div className="container" style={{ maxWidth: 720 }}>
        <h1>볼 수 있는 단원평가</h1>
        {msg && <div className="alert warn" style={{ marginBottom: 12 }}>{msg}</div>}
        {error && <div className="alert error">{error}</div>}
        {!exams && !error && <Loading />}
        {exams && !exams.length && (
          <div className="card center muted">지금 볼 수 있는 평가가 없습니다. 선생님이 평가를 열 때까지 기다려 주세요.</div>
        )}
        {exams?.map((e) => (
          <div key={e.id} className="card row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="muted small">
                {e.subject} · {e.grade}학년 {e.semester}학기 {e.unit && `· ${e.unit}`}
              </div>
              <h2 style={{ margin: '4px 0' }}>{e.title}</h2>
              <div className="muted small">{e.questions.length}문항</div>
            </div>
            <button className="btn primary" onClick={() => choose(e)}>평가 시작</button>
          </div>
        ))}
      </div>
    </>
  );
}
