import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeacher } from '../../components/TeacherAuth.jsx';
import { teacherSignIn } from '../../lib/db.js';
import { normalizeSchool } from '../../lib/school.js';
import { AUTH_ERR } from './TeacherLogin.jsx';

const REMEMBER = 'teacher-remember';

function loadRemembered() {
  try {
    return JSON.parse(localStorage.getItem(REMEMBER) || 'null');
  } catch {
    return null;
  }
}

function setRemembered(v) {
  try {
    if (v) localStorage.setItem(REMEMBER, JSON.stringify(v));
    else localStorage.removeItem(REMEMBER);
  } catch {
    /* 저장 불가 환경은 무시 */
  }
}

/** 교사 로그인: 학교 · 학년 · 반 · 비밀번호 */
export default function TeacherLoginForm() {
  const nav = useNavigate();
  const { setTeacher } = useTeacher();
  const remembered = loadRemembered();
  const [form, setForm] = useState({
    school: remembered?.school ?? '', grade: remembered?.grade ?? '', classNo: remembered?.classNo ?? '', password: '',
  });
  const [remember, setRemember] = useState(!!remembered);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const info = { school: normalizeSchool(form.school), grade: Number(form.grade), classNo: Number(form.classNo) };
    if (!info.school || !info.grade || !info.classNo || !form.password) {
      return setError('학교, 학년, 반, 비밀번호를 모두 입력해 주세요.');
    }
    setError('');
    setBusy(true);
    try {
      setTeacher(await teacherSignIn({ ...info, password: form.password }, remember));
      setRemembered(remember ? info : null);
      nav('/teacher/dashboard');
    } catch (err) {
      setError(AUTH_ERR[err.code] || err.message);
      setBusy(false);
    }
  }

  return (
    <form className="card stack login-form" onSubmit={submit}>
      <label className="field">
        <span>학교</span>
        <input type="text" value={form.school} onChange={set('school')} placeholder="예: 광양중동초등학교" maxLength={40} aria-label="교사 학교" />
      </label>
      <div className="grid2">
        <label className="field">
          <span>학년</span>
          <input type="number" min="1" max="6" inputMode="numeric" value={form.grade} onChange={set('grade')} aria-label="교사 학년" />
        </label>
        <label className="field">
          <span>반</span>
          <input type="number" min="1" inputMode="numeric" value={form.classNo} onChange={set('classNo')} aria-label="교사 반" />
        </label>
      </div>
      <label className="field">
        <span>비밀번호</span>
        <input type="password" value={form.password} onChange={set('password')} autoComplete="current-password" aria-label="교사 비밀번호" />
      </label>
      {/* 브라우저 비밀번호 저장 기능이 동작하도록 사용자 이름 칸(보이지 않음) */}
      <input type="text" name="username" autoComplete="username" value={`${normalizeSchool(form.school)} ${form.grade}-${form.classNo}`} readOnly hidden />
      <label className="row small remember">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} aria-label="로그인 정보 저장" />
        로그인 정보 저장
      </label>
      {error && <div className="alert error">{error}</div>}
      <button className="btn primary lg block" disabled={busy}>{busy ? '확인 중…' : '로그인'}</button>
    </form>
  );
}
