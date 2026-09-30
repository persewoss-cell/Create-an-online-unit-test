import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Loading from '../../components/Loading.jsx';
import { useTeacher } from '../../components/TeacherAuth.jsx';
import {
  listTeachers, addTeacher, setTeacherPassword, updateTeacher, removeTeacher, legacyDataCount, moveLegacyData,
} from '../../lib/db.js';
import { DEFAULT_TEACHER_PASSWORD, LEGACY_SCHOOL, MIN_TEACHER_PASSWORD } from '../../lib/school.js';
import { AUTH_ERR } from './TeacherLogin.jsx';

const errText = (e) => AUTH_ERR[e.code] || e.message;
const blank = { school: '', grade: '', classNo: '', name: '' };

/** 관리자 화면: 선생님 추가·관리, 선생님 방 들어가기, 예전 자료 옮기기 */
export default function AdminPanel({ onMoved }) {
  const { teacher, viewAs } = useTeacher();
  const nav = useNavigate();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState(null); // {uid, school, grade, classNo, name}
  const [pwFor, setPwFor] = useState(null); // {uid, value}
  const [shown, setShown] = useState({}); // 비밀번호 보이기
  const [legacy, setLegacy] = useState(null);

  async function reload() {
    try {
      setList(await listTeachers());
    } catch (e) {
      setError(errText(e));
    }
  }
  useEffect(() => {
    reload();
    legacyDataCount(teacher.uid).then(setLegacy).catch(() => setLegacy(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(label, fn, done) {
    setBusy(label);
    setError('');
    setMsg('');
    try {
      await fn();
      await reload();
      if (done) setMsg(done);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy('');
    }
  }

  function add(ev) {
    ev.preventDefault();
    run('add', async () => {
      const t = await addTeacher(form);
      setMsg(`${t.school} ${t.grade}학년 ${t.classNo}반 선생님을 추가했습니다. 처음 비밀번호는 ${DEFAULT_TEACHER_PASSWORD}입니다.`);
      setForm({ ...form, classNo: String(Number(form.classNo) + 1), name: '' });
    });
  }

  function enter(t) {
    viewAs(t);
    nav('/teacher/dashboard');
  }

  function savePassword(t) {
    const v = pwFor.value.trim();
    if (v.length < MIN_TEACHER_PASSWORD) return setError(`비밀번호는 ${MIN_TEACHER_PASSWORD}자 이상이어야 합니다.`);
    run(`pw-${t.uid}`, async () => {
      await setTeacherPassword(t, v);
      setPwFor(null);
    }, `${t.school} ${t.grade}학년 ${t.classNo}반 선생님 비밀번호를 바꿨습니다.`);
  }

  function saveEdit(t) {
    run(`edit-${t.uid}`, async () => {
      await updateTeacher(t, editing);
      setEditing(null);
    }, '선생님 정보를 고쳤습니다.');
  }

  function remove(t) {
    if (!confirm(`${t.school} ${t.grade}학년 ${t.classNo}반 선생님 계정을 지울까요?\n(그 선생님이 만든 평가와 학생 명단은 남아 있습니다)`)) return;
    run(`del-${t.uid}`, () => removeTeacher(t), '선생님 계정을 지웠습니다.');
  }

  const setF = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setE = (k) => (e) => setEditing({ ...editing, [k]: e.target.value });

  return (
    <div className="stack" style={{ marginBottom: 28 }}>
      <h1 style={{ margin: 0 }}>선생님 관리</h1>
      {error && <div className="alert error">{error}</div>}
      {msg && <div className="alert success">{msg}</div>}

      {legacy && (legacy.exams > 0 || legacy.students > 0) && (
        <LegacyMove legacy={legacy} adminUid={teacher.uid} onDone={(r) => {
          setLegacy(null);
          setMsg(`${r.owner.school} ${r.owner.grade}학년 ${r.owner.classNo}반 선생님 방으로 평가 ${r.exams}개(답안 ${r.submissions}개), 학생 ${r.students}명을 옮겼습니다.${r.created ? ` 새 선생님 계정의 비밀번호는 ${DEFAULT_TEACHER_PASSWORD}입니다.` : ''}`);
          reload();
          onMoved?.();
        }} />
      )}

      <form className="card admin-add" onSubmit={add}>
        <label className="field school"><span>학교</span><input type="text" value={form.school} onChange={setF('school')} placeholder="예: 광양중동초등학교" aria-label="교사 학교" /></label>
        <label className="field"><span>학년</span><input type="number" min="1" max="6" inputMode="numeric" value={form.grade} onChange={setF('grade')} aria-label="교사 학년" /></label>
        <label className="field"><span>반</span><input type="number" min="1" inputMode="numeric" value={form.classNo} onChange={setF('classNo')} aria-label="교사 반" /></label>
        <label className="field"><span>이름 (선택)</span><input type="text" value={form.name} onChange={setF('name')} aria-label="교사 이름" /></label>
        <button className="btn primary" disabled={busy === 'add'}>{busy === 'add' ? '추가 중…' : '+ 선생님 추가'}</button>
        <div className="muted small full">처음 비밀번호는 <b>{DEFAULT_TEACHER_PASSWORD}</b>입니다. 선생님이 로그인한 뒤 “비밀번호 변경”으로 바꿀 수 있습니다.</div>
      </form>

      <div className="card table-wrap" style={{ padding: 0 }}>
        {!list ? (
          <Loading />
        ) : !list.length ? (
          <div className="center muted">아직 등록된 선생님이 없습니다.</div>
        ) : (
          <table className="data">
            <thead>
              <tr><th>학교</th><th className="c">학년</th><th className="c">반</th><th>이름</th><th>비밀번호</th><th /></tr>
            </thead>
            <tbody>
              {list.map((t) =>
                editing?.uid === t.uid ? (
                  <tr key={t.uid}>
                    <td><input type="text" value={editing.school} onChange={setE('school')} aria-label="학교 수정" /></td>
                    <td><input type="number" value={editing.grade} onChange={setE('grade')} style={{ width: 60 }} aria-label="학년 수정" /></td>
                    <td><input type="number" value={editing.classNo} onChange={setE('classNo')} style={{ width: 60 }} aria-label="반 수정" /></td>
                    <td><input type="text" value={editing.name} onChange={setE('name')} aria-label="이름 수정" /></td>
                    <td />
                    <td className="nowrap" style={{ textAlign: 'right' }}>
                      <button className="btn sm primary" disabled={!!busy} onClick={() => saveEdit(t)}>저장</button>{' '}
                      <button className="btn sm" onClick={() => setEditing(null)}>취소</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.uid}>
                    <td>{t.school}</td>
                    <td className="c">{t.grade}</td>
                    <td className="c">{t.classNo}</td>
                    <td>{t.name}</td>
                    <td className="nowrap">
                      {pwFor?.uid === t.uid ? (
                        <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                          <input
                            type="text" value={pwFor.value} autoFocus style={{ width: 110 }} aria-label="새 비밀번호"
                            onChange={(e) => setPwFor({ ...pwFor, value: e.target.value })}
                          />
                          <button className="btn sm primary" disabled={!!busy} onClick={() => savePassword(t)}>저장</button>
                          <button className="btn sm" onClick={() => setPwFor(null)}>취소</button>
                        </span>
                      ) : (
                        <>
                          <button className="btn sm link-btn" onClick={() => setShown({ ...shown, [t.uid]: !shown[t.uid] })} aria-label="비밀번호 보기">
                            {shown[t.uid] ? t.password || '(모름)' : '••••'}
                          </button>{' '}
                          <button className="btn sm" onClick={() => setPwFor({ uid: t.uid, value: DEFAULT_TEACHER_PASSWORD })}>변경</button>
                        </>
                      )}
                    </td>
                    <td className="nowrap" style={{ textAlign: 'right' }}>
                      <button className="btn sm primary" onClick={() => enter(t)}>방 들어가기</button>{' '}
                      <button className="btn sm" onClick={() => setEditing({ uid: t.uid, school: t.school, grade: t.grade, classNo: t.classNo, name: t.name || '' })}>수정</button>{' '}
                      <button className="btn sm danger" disabled={!!busy} onClick={() => remove(t)}>삭제</button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** 여러 선생님용으로 바꾸기 전에 관리자 계정으로 만든 평가·명단을 한 선생님 방으로 옮기기 */
function LegacyMove({ legacy, adminUid, onDone }) {
  // 명단에 가장 많은 반을 기본값으로
  const top = Object.entries(legacy.classes).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  const [g, c] = top.split('-');
  const [form, setForm] = useState({ school: LEGACY_SCHOOL, grade: g || '', classNo: c || '', name: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function move(ev) {
    ev.preventDefault();
    if (!confirm(`관리자 계정의 평가 ${legacy.exams}개와 학생 ${legacy.students}명을 ${form.school} ${form.grade}학년 ${form.classNo}반 선생님 방으로 옮길까요?`)) return;
    setBusy(true);
    setError('');
    try {
      onDone(await moveLegacyData(adminUid, form));
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  }

  return (
    <form className="card stack legacy-move" onSubmit={move}>
      <h2 style={{ margin: 0 }}>예전 평가·명단 옮기기</h2>
      <p className="muted small" style={{ margin: 0 }}>
        관리자 계정으로 만든 평가 <b>{legacy.exams}개</b>와 학교가 정해지지 않은 학생 <b>{legacy.students}명</b>이 있습니다
        {Object.keys(legacy.classes).length > 0 && ` (${Object.entries(legacy.classes).map(([k, n]) => `${k.replace('-', '학년 ')}반 ${n}명`).join(', ')})`}.
        학생들은 옮긴 뒤에 학교 이름을 넣어 로그인할 수 있습니다. 선생님 계정이 없으면 비밀번호 {DEFAULT_TEACHER_PASSWORD}으로 새로 만듭니다.
      </p>
      <div className="admin-add">
        <label className="field school"><span>학교</span><input type="text" value={form.school} onChange={set('school')} aria-label="옮길 학교" /></label>
        <label className="field"><span>학년</span><input type="number" min="1" max="6" value={form.grade} onChange={set('grade')} aria-label="옮길 학년" /></label>
        <label className="field"><span>반</span><input type="number" min="1" value={form.classNo} onChange={set('classNo')} aria-label="옮길 반" /></label>
        <label className="field"><span>이름 (선택)</span><input type="text" value={form.name} onChange={set('name')} aria-label="옮길 선생님 이름" /></label>
        <button className="btn primary" disabled={busy}>{busy ? '옮기는 중…' : '이 선생님 방으로 옮기기'}</button>
      </div>
      {error && <div className="alert error">{error}</div>}
    </form>
  );
}
