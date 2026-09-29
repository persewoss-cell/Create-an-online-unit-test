import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar.jsx';
import { loadStudent, saveStudent, loadRemembered, setRemembered } from '../../lib/student.js';
import { startStudentSession } from '../../lib/db.js';

export default function StudentLogin() {
  const nav = useNavigate();
  const remembered = loadRemembered();
  const prev = remembered || loadStudent();
  const [form, setForm] = useState({
    grade: prev?.grade ?? '', classNo: prev?.classNo ?? '', number: remembered?.number ?? '', name: remembered?.name ?? '',
  });
  const [remember, setRemember] = useState(!!remembered);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const p = {
      grade: Number(form.grade), classNo: Number(form.classNo), number: Number(form.number), name: form.name.trim(),
    };
    if (!p.grade || !p.classNo || !p.number || !p.name) {
      setError('학년, 반, 번호, 이름을 모두 입력해 주세요.');
      return;
    }
    if (p.name.length > 20) {
      setError('이름이 너무 깁니다.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await startStudentSession(p);
      saveStudent(p);
      setRemembered(remember ? p : null);
      nav('/exams');
    } catch (err) {
      setError(err.message.startsWith('학생 명단') ? err.message : `접속에 실패했습니다: ${err.message}`);
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar />
      <div className="container narrow">
        <div className="home-hero">
          <div className="emoji">✏️</div>
          <h1>단원평가 보러 가기</h1>
          <p className="muted">내 정보를 정확하게 입력하세요.</p>
        </div>
        <form className="card stack" onSubmit={submit}>
          <div className="grid2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <label className="field">
              <span>학년</span>
              <select value={form.grade} onChange={set('grade')} aria-label="학년">
                <option value="">선택</option>
                {[1, 2, 3, 4, 5, 6].map((g) => (
                  <option key={g} value={g}>{g}학년</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>반</span>
              <input type="number" min="1" max="30" inputMode="numeric" value={form.classNo} onChange={set('classNo')} aria-label="반" />
            </label>
            <label className="field">
              <span>번호</span>
              <input type="number" min="1" max="60" inputMode="numeric" value={form.number} onChange={set('number')} aria-label="번호" />
            </label>
          </div>
          <label className="field">
            <span>이름</span>
            <input type="text" value={form.name} onChange={set('name')} maxLength={20} aria-label="이름" autoComplete="off" />
          </label>
          <label className="row small remember">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} aria-label="로그인 정보 저장" />
            로그인 정보 저장 <span className="muted">(이 기기에서 다음에 자동으로 채워요 · 여럿이 쓰는 기기에서는 체크하지 마세요)</span>
          </label>
          {error && <div className="alert error">{error}</div>}
          <button className="btn primary lg block" disabled={busy}>
            {busy ? '접속 중…' : '평가 목록 보기'}
          </button>
        </form>
        <div className="teacher-link">
          <Link to="/teacher">관리자 로그인 →</Link>
        </div>
      </div>
    </>
  );
}
