import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TeacherBar from '../../components/TeacherBar.jsx';
import Loading from '../../components/Loading.jsx';
import { useTeacher } from '../../components/TeacherAuth.jsx';
import { watchMyExams, watchSubmissionsLive, watchKeysLive, logout, changeAdminPassword, changeTeacherPassword } from '../../lib/db.js';
import { AUTH_ERR } from './TeacherLogin.jsx';
import { gradeSubmission } from '../../lib/grading.js';
import { retakeState } from '../../lib/retake.js';
import { MIN_TEACHER_PASSWORD, teacherLabel } from '../../lib/school.js';
import AdminPanel from './AdminPanel.jsx';

export const STATUS = { draft: '개시 전', open: '응시 중', closed: '마감' };

export default function Dashboard() {
  const { teacher, owner, isAdmin, viewing, setTeacher } = useTeacher();
  const nav = useNavigate();
  const [exams, setExams] = useState(null);
  const [stats, setStats] = useState({});
  const [error, setError] = useState('');
  const [pwOpen, setPwOpen] = useState(false);
  const [reloadNo, setReloadNo] = useState(0);

  // 평가 목록과 평가별 응시 인원·평균·검토 요청 수를 실시간으로 (학생이 제출하면 바로 바뀜)
  useEffect(() => {
    setExams(null);
    setStats({});
    setError('');
    const perExam = new Map(); // 평가 id → {exam, subs, keys, stop}
    const recount = (id) => {
      const x = perExam.get(id);
      if (!x?.subs || !x.keys) return;
      const graded = x.subs.map((sub) => gradeSubmission(x.exam, x.keys, sub));
      setStats((st) => ({
        ...st,
        [id]: {
          count: x.subs.length,
          review: graded.reduce((a, r, i) => a + r.reviewCount + retakeState(x.exam, x.keys, x.subs[i], r).pending.length, 0),
          avg: graded.length ? Math.round((graded.reduce((a, r) => a + r.score100, 0) / graded.length) * 10) / 10 : null,
        },
      }));
    };
    const stopList = watchMyExams(
      owner.uid,
      (list) => {
        setExams(list);
        for (const e of list) {
          const known = perExam.get(e.id);
          if (known) {
            known.exam = e;
            recount(e.id);
            continue;
          }
          const x = { exam: e, subs: null, keys: null };
          const quiet = () => {}; // 로그아웃·방 바꾸기 도중이면 무시
          const stops = [
            watchSubmissionsLive(e.id, (subs) => { x.subs = subs; recount(e.id); }, quiet),
            watchKeysLive(e.id, (keys) => { x.keys = keys; recount(e.id); }, quiet),
          ];
          x.stop = () => stops.forEach((f) => f());
          perExam.set(e.id, x);
        }
        for (const [id, x] of perExam) {
          if (!list.some((e) => e.id === id)) {
            x.stop();
            perExam.delete(id);
          }
        }
      },
      (err) => setError(err.message),
    );
    return () => {
      stopList();
      perExam.forEach((x) => x.stop());
    };
  }, [owner.uid, reloadNo]);

  async function doLogout() {
    await logout();
    setTeacher(null);
    nav('/');
  }

  // 관리자가 선생님 방에 들어가지 않았을 때: 선생님 관리 + (옮기기 전) 관리자 계정의 예전 평가
  const adminHome = isAdmin && !viewing;

  return (
    <>
      <TeacherBar>
        {!viewing && <button className="btn sm" onClick={() => setPwOpen(true)}>비밀번호 변경</button>}
        <button className="btn sm" onClick={doLogout}>로그아웃</button>
      </TeacherBar>
      {pwOpen && <PasswordDialog teacher={teacher} isAdmin={isAdmin} onClose={() => setPwOpen(false)} />}
      <div className="container">
        {adminHome && <AdminPanel onMoved={() => setReloadNo((n) => n + 1)} />}
        {(!adminHome || exams?.length > 0) && (
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
            <h1 style={{ margin: 0 }}>
              {adminHome ? '관리자 계정의 평가' : viewing ? `${teacherLabel(viewing)} 단원평가` : '내 단원평가'}
            </h1>
            {!adminHome && (
              <div className="row">
                <Link to="/teacher/students" className="btn">👥 학생 명단</Link>
                <Link to="/teacher/new" className="btn primary">+ 새 평가 만들기</Link>
              </div>
            )}
          </div>
        )}
        {error && <div className="alert error">{error}</div>}
        {!exams && !error && <Loading />}
        {exams && !exams.length && !adminHome && (
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

function PasswordDialog({ teacher, isAdmin, onClose }) {
  const min = isAdmin ? 6 : MIN_TEACHER_PASSWORD;
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (next.length < min) return setMsg({ type: 'error', text: `새 비밀번호는 ${min}자 이상이어야 합니다.` });
    if (next !== next2) return setMsg({ type: 'error', text: '새 비밀번호가 서로 다릅니다.' });
    setBusy(true);
    try {
      if (isAdmin) await changeAdminPassword(cur, next);
      else await changeTeacherPassword(teacher, cur, next);
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
        <label className="field"><span>새 비밀번호 ({min}자 이상)</span><input type="password" value={next} onChange={(e) => setNext(e.target.value)} aria-label="새 비밀번호" /></label>
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
