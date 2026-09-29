import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar.jsx';
import Loading from '../../components/Loading.jsx';
import { useTeacher } from '../../components/TeacherAuth.jsx';
import { listMyExams, listSubmissions, getKeys, logout } from '../../lib/db.js';
import { gradeSubmission } from '../../lib/grading.js';

export const STATUS = { draft: '준비 중', open: '응시 중', closed: '마감' };

export default function Dashboard() {
  const { teacher, setTeacher } = useTeacher();
  const nav = useNavigate();
  const [exams, setExams] = useState(null);
  const [stats, setStats] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const list = await listMyExams(teacher.uid);
        setExams(list);
        // 평가별 응시 인원·검토 대기 수
        for (const e of list) {
          Promise.all([listSubmissions(e.id), getKeys(e.id)]).then(([subs, keys]) => {
            const graded = subs.map((s) => gradeSubmission(e, keys, s));
            setStats((st) => ({
              ...st,
              [e.id]: {
                count: subs.length,
                review: graded.reduce((a, r) => a + r.reviewCount, 0),
                avg: graded.length ? Math.round((graded.reduce((a, r) => a + r.score100, 0) / graded.length) * 10) / 10 : null,
              },
            }));
          });
        }
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [teacher.uid]);

  async function doLogout() {
    await logout();
    setTeacher(null);
    nav('/teacher');
  }

  return (
    <>
      <TopBar home="/teacher/dashboard" who={`${teacher.name} 선생님`}>
        <button className="btn sm" onClick={doLogout}>로그아웃</button>
      </TopBar>
      <div className="container">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ margin: 0 }}>내 단원평가</h1>
          <Link to="/teacher/new" className="btn primary">+ 새 평가 만들기</Link>
        </div>
        {error && <div className="alert error">{error}</div>}
        {!exams && !error && <Loading />}
        {exams && !exams.length && (
          <div className="card center">
            <p>아직 만든 평가가 없습니다.</p>
            <Link to="/teacher/new" className="btn primary">문제·정답 PDF로 첫 평가 만들기</Link>
          </div>
        )}
        {exams && exams.length > 0 && (
          <div className="card table-wrap" style={{ padding: 0 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>평가</th><th>과목</th><th>대상</th><th className="c">상태</th>
                  <th className="c">응시</th><th className="c">평균</th><th className="c">검토 요청</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((e) => {
                  const st = stats[e.id];
                  return (
                    <tr key={e.id}>
                      <td><Link to={`/teacher/exam/${e.id}`}><b>{e.title}</b></Link><div className="muted small">{e.unit}</div></td>
                      <td>{e.subject}</td>
                      <td>{e.grade}학년 {e.semester}학기{e.classes?.length ? ` · ${e.classes.join(',')}반` : ''}</td>
                      <td className="c"><span className={`badge ${e.status}`}>{STATUS[e.status]}</span></td>
                      <td className="c">{st ? `${st.count}명` : '…'}</td>
                      <td className="c">{st?.avg ?? '-'}</td>
                      <td className="c">
                        {st?.review ? (
                          <Link to={`/teacher/exam/${e.id}?tab=review`} className="badge review">{st.review}건</Link>
                        ) : st ? '-' : '…'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
