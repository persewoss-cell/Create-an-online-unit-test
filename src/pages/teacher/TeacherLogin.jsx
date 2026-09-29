import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar.jsx';
import Loading from '../../components/Loading.jsx';
import { useTeacher } from '../../components/TeacherAuth.jsx';
import { teacherSignIn, teacherSignUp, resetPassword } from '../../lib/db.js';

const AUTH_ERR = {
  'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
  'auth/wrong-password': '이메일 또는 비밀번호가 올바르지 않습니다.',
  'auth/user-not-found': '가입되지 않은 이메일입니다.',
  'auth/invalid-email': '이메일 형식이 올바르지 않습니다.',
  'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
  'auth/too-many-requests': '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  'auth/operation-not-allowed': 'Firebase 콘솔에서 이메일/비밀번호 로그인을 사용 설정해 주세요.',
};

export default function TeacherLogin() {
  const nav = useNavigate();
  const { teacher, loading, setTeacher } = useTeacher();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', code: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (loading) return <Loading />;
  if (teacher) return <Navigate to="/teacher/dashboard" replace />;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const t = mode === 'login'
        ? await teacherSignIn(form.email.trim(), form.password)
        : await teacherSignUp({ name: form.name.trim(), email: form.email.trim(), password: form.password, code: form.code.trim() });
      setTeacher(t);
      nav('/teacher/dashboard');
    } catch (err) {
      setError(AUTH_ERR[err.code] || err.message);
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (!form.email) return setError('비밀번호를 재설정할 이메일을 입력해 주세요.');
    try {
      await resetPassword(form.email.trim());
      setInfo('비밀번호 재설정 메일을 보냈습니다.');
    } catch (err) {
      setError(AUTH_ERR[err.code] || err.message);
    }
  }

  return (
    <>
      <TopBar />
      <div className="container narrow">
        <div className="home-hero">
          <div className="emoji">🧑‍🏫</div>
          <h1>교사 관리 페이지</h1>
        </div>
        <form className="card stack" onSubmit={submit}>
          <div className="tabs" style={{ marginBottom: 4 }}>
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>로그인</button>
            <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>교사 가입</button>
          </div>
          {mode === 'signup' && (
            <label className="field"><span>이름</span><input type="text" value={form.name} onChange={set('name')} required /></label>
          )}
          <label className="field"><span>이메일</span><input type="email" value={form.email} onChange={set('email')} required autoComplete="username" /></label>
          <label className="field">
            <span>비밀번호</span>
            <input type="password" value={form.password} onChange={set('password')} required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </label>
          {mode === 'signup' && (
            <label className="field">
              <span>교사 가입 코드</span>
              <input type="text" value={form.code} onChange={set('code')} required />
              <div className="muted small" style={{ fontWeight: 400, marginTop: 4 }}>학생이 교사로 가입하지 못하도록 관리자가 정한 코드입니다.</div>
            </label>
          )}
          {error && <div className="alert error">{error}</div>}
          {info && <div className="alert success">{info}</div>}
          <button className="btn primary block lg" disabled={busy}>
            {busy ? '처리 중…' : mode === 'login' ? '로그인' : '가입하기'}
          </button>
          {mode === 'login' && (
            <button type="button" className="btn sm" style={{ border: 0 }} onClick={forgot}>비밀번호를 잊으셨나요?</button>
          )}
        </form>
        <div className="teacher-link"><Link to="/">← 학생 화면으로</Link></div>
      </div>
    </>
  );
}
