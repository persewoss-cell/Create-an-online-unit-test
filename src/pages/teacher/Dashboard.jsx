import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { backState } from '../../lib/nav.js';
import TeacherBar from '../../components/TeacherBar.jsx';
import Loading from '../../components/Loading.jsx';
import { useTeacher } from '../../components/TeacherAuth.jsx';
import {
  watchMyExams, watchSubmissionsLive, watchKeysLive, changeAdminPassword, changeTeacherPassword, setExamShared, deleteExam,
} from '../../lib/db.js';
import SharedImport from './SharedImport.jsx';
import { AUTH_ERR } from './TeacherLogin.jsx';
import { gradeSubmission } from '../../lib/grading.js';
import { retakeState } from '../../lib/retake.js';
import { MIN_TEACHER_PASSWORD, teacherLabel } from '../../lib/school.js';
import AdminPanel from './AdminPanel.jsx';

export const STATUS = { draft: '개시 전', open: '응시 중', closed: '마감' };

export default function Dashboard({ adminRoute = false }) {
  const { teacher, owner: roomOwner, isAdmin, viewing, viewAs } = useTeacher();
  const location = useLocation();
  // 관리자 화면(/teacher/admin)과 선생님 방(/teacher/dashboard)은 주소가 달라서 뒤로가기로 오갈 수 있다
  const owner = adminRoute ? teacher : roomOwner;
  // 관리자 화면에 "도착"했을 때만(뒤로가기 등) 선생님 방에서 나온다 — 방 들어가기를 누른 순간에는 건드리지 않음
  useEffect(() => {
    if (adminRoute) viewAs(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminRoute, location.key]);
  const [exams, setExams] = useState(null);
  const [stats, setStats] = useState({});
  const [error, setError] = useState('');
  const [pwOpen, setPwOpen] = useState(false);
  const [reloadNo, setReloadNo] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [busyId, setBusyId] = useState('');

  async function toggleShare(e) {
    const on = !e.shared;
    if (on && e.importedFrom) return; // 다른 선생님에게서 가져온 시험지는 다시 공유할 수 없음
    if (on && !confirm(`"${e.title}" 시험지를 공유할까요?\n모든 학교 선생님이 이 시험지(문항·정답·문제지)를 보고 가져갈 수 있어요. 학생 답안은 공유되지 않아요.`)) return;
    setBusyId(e.id);
    try {
      await setExamShared(e.id, on, owner);
    } catch (err) {
      alert(err.code === 'permission-denied'
        ? '공유하지 못했어요. Firebase 보안 규칙을 새 규칙으로 게시했는지 확인해 주세요.'
        : `공유하지 못했어요: ${err.message}`);
    } finally {
      setBusyId('');
    }
  }

  async function remove(e) {
    const n = stats[e.id]?.count || 0;
    if (!confirm(`"${e.title}" 평가를 삭제할까요?${n ? `\n응시한 학생 ${n}명의 답안과 결과도 모두 지워져요.` : ''}`)) return;
    if (!confirm(`정말 삭제할까요? 삭제하면 되돌릴 수 없어요.\n\n"${e.title}"`)) return;
    setBusyId(e.id);
    try {
      await deleteExam(e.id);
    } catch (err) {
      alert(`삭제하지 못했어요: ${err.message}`);
    } finally {
      setBusyId('');
    }
  }

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

  // 관리자가 선생님 방에 들어가지 않았을 때: 선생님 관리 + (옮기기 전) 관리자 계정의 예전 평가
  const adminHome = isAdmin && adminRoute;
  if (adminRoute && !isAdmin) return <Navigate to="/teacher/dashboard" replace />;
  if (!adminRoute && isAdmin && !viewing) return <Navigate to="/teacher/admin" replace />;

  return (
    <>
      <TeacherBar>
        {!viewing && <button className="btn sm" onClick={() => setPwOpen(true)}>비밀번호 변경</button>}
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
                <Link to="/teacher/students" state={backState(location)} className="btn">👥 학생 명단 추가·수정</Link>
                <Link to="/teacher/new" state={backState(location)} className="btn primary">+ 새 평가 만들기</Link>
                <button type="button" className="btn" onClick={() => setImportOpen(true)}>📥 공유 시험지 가져오기</button>
              </div>
            )}
          </div>
        )}
        {importOpen && <SharedImport owner={owner} onClose={() => setImportOpen(false)} />}
        {error && <div className="alert error">{error}</div>}
        {!exams && !error && <Loading />}
        {exams && !exams.length && !adminHome && (
          <div className="card center">
            <p>아직 만든 평가가 없습니다.</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <Link to="/teacher/new" state={backState(location)} className="btn primary">문제·정답 PDF로 첫 평가 만들기</Link>
              <button type="button" className="btn" onClick={() => setImportOpen(true)}>📥 공유 시험지 가져오기</button>
            </div>
          </div>
        )}
        {exams && exams.length > 0 && (
          <div className="card table-wrap" style={{ padding: 0 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>평가</th><th>과목</th><th>대상</th><th className="c">상태</th>
                  <th className="c">응시</th><th className="c">평균</th><th className="c">검토 요청</th>
                  <th className="c">공유</th><th className="c">삭제</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((e) => {
                  const st = stats[e.id];
                  return (
                    <tr key={e.id}>
                      <td>
                        <Link to={`/teacher/exam/${e.id}`} state={backState(location)}><b>{e.title}</b></Link>
                        <div className="muted small">{e.unit}{e.importedFrom ? ` · 공유 시험지(${e.importedFrom.by})` : ''}</div>
                      </td>
                      <td>{e.subject}</td>
                      <td>{e.grade}학년 {e.semester}학기{e.classes?.length ? ` · ${e.classes.join(',')}반` : ''}</td>
                      <td className="c"><span className={`badge ${e.status}`}>{STATUS[e.status]}</span></td>
                      <td className="c">{st ? `${st.count}명` : '…'}</td>
                      <td className="c">{st?.avg ?? '-'}</td>
                      <td className="c">
                        {st?.review ? (
                          <Link to={`/teacher/exam/${e.id}?tab=review`} state={backState(location)} className="badge review">{st.review}건</Link>
                        ) : st ? '-' : '…'}
                      </td>
                      <td className="c nowrap">
                        <button
                          type="button"
                          className={`btn xs ${e.shared ? 'shared-on' : ''}`}
                          // 공유 시험지에서 가져온 평가는 공유할 수 없음 (이미 공유 중이었다면 그만두기만 가능)
                          disabled={busyId === e.id || (!!e.importedFrom && !e.shared)}
                          onClick={() => toggleShare(e)}
                          title={
                            e.shared
                              ? '공유 중 — 누르면 공유를 그만둡니다'
                              : e.importedFrom
                                ? '공유 시험지에서 가져온 평가라 다시 공유할 수 없어요'
                                : '모든 학교 선생님과 이 시험지를 공유합니다'
                          }
                        >
                          {e.shared ? '✓ 공유 중' : '공유'}
                        </button>
                      </td>
                      <td className="c">
                        <button type="button" className="btn xs danger" disabled={busyId === e.id} onClick={() => remove(e)}>삭제</button>
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
