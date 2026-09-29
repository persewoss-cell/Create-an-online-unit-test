import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import TopBar from '../../components/TopBar.jsx';
import Loading from '../../components/Loading.jsx';
import { GradedPaper } from '../../components/ExamViews.jsx';
import { loadStudent } from '../../lib/student.js';
import { getExam, getKeys, getMySubmission, getPages, studentIdOf, watchMySubmission, ensureStudentSession } from '../../lib/db.js';
import { gradeSubmission } from '../../lib/grading.js';

export default function Result() {
  const { id } = useParams();
  const nav = useNavigate();
  const p = loadStudent();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const [updated, setUpdated] = useState(false);
  useEffect(() => {
    if (!p) return undefined;
    let unsub = () => {};
    let alive = true;
    const fail = (e) =>
      setError(e.code === 'permission-denied' ? '결과를 볼 수 없습니다. 선생님께 문의하세요.' : e.message);
    (async () => {
      try {
        await ensureStudentSession(p);
        const sid = studentIdOf(p);
        const first = await getMySubmission(id, sid);
        if (!first) throw new Error('제출 기록을 찾을 수 없습니다.');
        const [exam, keys, pages] = await Promise.all([getExam(id), getKeys(id), getPages(id)]);
        if (!exam) throw new Error('평가가 마감되어 결과를 볼 수 없습니다. 선생님께 문의하세요.');
        if (!alive) return;
        // 선생님이 검토하면 새로고침하지 않아도 바로 점수와 표시가 바뀐다
        let prevOverrides = JSON.stringify(first.overrides || {});
        unsub = watchMySubmission(id, sid, (sub) => {
          if (!sub) return;
          const now = JSON.stringify(sub.overrides || {});
          if (now !== prevOverrides) {
            prevOverrides = now;
            setUpdated(true);
            setTimeout(() => setUpdated(false), 6000);
          }
          setData({ exam, keys, sub, pages, result: gradeSubmission(exam, keys, sub) });
        }, fail);
      } catch (e) {
        fail(e);
      }
    })();
    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!p) return <Navigate to="/" replace />;
  const who = `${p.grade}학년 ${p.classNo}반 ${p.number}번 ${p.name}`;
  if (error) {
    return (
      <>
        <TopBar who={who} />
        <div className="container narrow">
          <div className="alert warn">{error}</div>
          <p><button className="btn" onClick={() => nav('/exams')}>평가 목록으로</button></p>
        </div>
      </>
    );
  }
  if (!data) return (<><TopBar who={who} /><Loading text="채점 중…" /></>);

  const { exam, keys, sub, pages, result } = data;
  return (
    <>
      <TopBar who={who}>
        <button className="btn sm" onClick={() => nav('/exams')}>평가 목록</button>
      </TopBar>
      <div className="container" style={{ maxWidth: 940 }}>
        <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
          <div className="muted">{exam.title}</div>
          <div className="score-big" data-testid="score">{result.score100}점</div>
          <div className="score-sub">
            {exam.questions.length}문항 중 {result.correctCount}문항 정답
          </div>
          {updated && (
            <div className="alert success" style={{ marginTop: 14 }}>선생님이 답을 확인했어요. 점수가 새로 반영되었습니다.</div>
          )}
          {result.reviewCount > 0 && (
            <div className="alert warn" style={{ marginTop: 14, textAlign: 'left' }}>
              선생님이 확인해야 하는 답이 {result.reviewCount}개 있어요(노란색 표시). 확인 후 점수가 올라갈 수 있어요.
            </div>
          )}
        </div>
        <GradedPaper exam={exam} pages={pages} keys={keys} answers={sub.answers} result={result} />
      </div>
    </>
  );
}
