import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar.jsx';
import Loading from '../../components/Loading.jsx';
import { useTeacher } from '../../components/TeacherAuth.jsx';
import { listMyExams, listSubmissions, getKeys, logout, changeAdminPassword } from '../../lib/db.js';
import { AUTH_ERR } from './TeacherLogin.jsx';
import { gradeSubmission } from '../../lib/grading.js';

export const STATUS = { draft: '준비 중', open: '응시 중', closed: '마감' };

export default function Dashboard() {
  const { teacher, setTeacher } = useTeacher();
  const nav = useNavigate();
  const [exams, setExams] = useState(null);
  const [stats, setStats] = useState({});
  const [error, setError] = useState('');
  const [pwOpen, setPwOpen] = useState(false);

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
      <TopBar home="/teacher/dashboard" who="관리자">
        <button className="btn sm" onClick={() => setPwOpen(true)}>비밀번호 변경</button>
        <button className="btn sm" onClick={doLogout}>로그아웃</button>
      </TopBar>
      {pwOpen && <PasswordDialog onClose={() => setPwOpen(false)} />}
      <div className="container">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ margin: 0 }}>내 단원평가</h1>
          <div className="row">
            <Link to="/teacher/students" className="btn">👥 학생 명단</Link>
            <Link to="/teacher/new" className="btn primary">+ 새 평가 만들기</Link>
          </div>
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

function PasswordDialog({ onClose }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (next.length < 6) return setMsg({ type: 'error', text: '새 비밀번호는 6자 이상이어야 합니다.' });
    if (next !== next2) return setMsg({ type: 'error', text: '새 비밀번호가 서로 다릅니다.' });
    setBusy(true);
    try {
      await changeAdminPassword(cur, next);
      setMsg({ type: 'success', text: '비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요.' });
      setCur('');
      setNext('');
      setNext2('');
    } catch (err) {
      setMsg({ type: 'error', text: AUTH_ERR[err.code] || err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" role="dialog" aria-modal="true">
      <form className="modal stack" onSubmit={submit}>
        <h2>비밀번호 변경</h2>
        <label className="field"><span>현재 비밀번호</span><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} aria-label="현재 비밀번호" /></label>
        <label className="field"><span>새 비밀번호 (6자 이상)</span><input type="password" value={next} onChange={(e) => setNext(e.target.value)} aria-label="새 비밀번호" /></label>
        <label className="field"><span>새 비밀번호 확인</span><input type="password" value={next2} onChange={(e) => setNext2(e.target.value)} aria-label="새 비밀번호 확인" /></label>
        {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>닫기</button>
          <button className="btn primary" disabled={busy}>{busy ? '변경 중…' : '변경'}</button>
        </div>
      </form>
    </div>
  );
}
