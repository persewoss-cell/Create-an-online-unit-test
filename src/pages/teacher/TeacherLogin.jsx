import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar.jsx';
import Loading from '../../components/Loading.jsx';
import { useTeacher } from '../../components/TeacherAuth.jsx';
import { adminSignIn } from '../../lib/db.js';

export const AUTH_ERR = {
  'auth/invalid-credential': '비밀번호가 올바르지 않습니다.',
  'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
  'auth/user-not-found': '관리자 계정이 아직 만들어지지 않았습니다.',
  'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
  'auth/too-many-requests': '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  'auth/requires-recent-login': '다시 로그인한 뒤 시도해 주세요.',
};

export default function TeacherLogin() {
  const nav = useNavigate();
  const { teacher, loading, setTeacher } = useTeacher();
  const [password, setPassword] = useState('');
  const [keep, setKeep] = useState(() => {
    try {
      return localStorage.getItem('admin-keep') !== '0';
    } catch {
      return true;
    }
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (teacher) return <Navigate to="/teacher/dashboard" replace />;

  async function submit(e) {
    e.preventDefault();
    if (!password) return setError('비밀번호를 입력해 주세요.');
    setError('');
    setBusy(true);
    try {
      setTeacher(await adminSignIn(password, keep));
      try {
        localStorage.setItem('admin-keep', keep ? '1' : '0');
      } catch {
        /* 무시 */
      }
      nav('/teacher/dashboard');
    } catch (err) {
      setError(AUTH_ERR[err.code] || err.message);
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar />
      <div className="container narrow">
        <div className="home-hero">
          <div className="emoji">🧑‍🏫</div>
          <h1>관리자 로그인</h1>
        </div>
        <form className="card stack" onSubmit={submit}>
          <label className="field">
            <span>비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              aria-label="비밀번호"
            />
          </label>
          {/* 브라우저 비밀번호 저장 기능이 동작하도록 사용자 이름 칸(보이지 않음) */}
          <input type="text" name="username" autoComplete="username" value="관리자" readOnly hidden />
          <label className="row small remember">
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} aria-label="로그인 상태 유지" />
            로그인 상태 유지 <span className="muted">(브라우저를 닫아도 로그인이 유지돼요)</span>
          </label>
          {error && <div className="alert error">{error}</div>}
          <button className="btn primary block lg" disabled={busy}>{busy ? '확인 중…' : '로그인'}</button>
        </form>
        <div className="teacher-link"><Link to="/">← 학생 화면으로</Link></div>
      </div>
    </>
  );
}
