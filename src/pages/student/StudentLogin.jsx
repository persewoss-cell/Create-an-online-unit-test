import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStudent, saveStudent, loadRemembered, setRemembered } from '../../lib/student.js';
import { startStudentSession } from '../../lib/db.js';
import { normalizeSchool } from '../../lib/school.js';

/** 학생 로그인: 학교 이름 · 학년 · 반 · 번호 · 이름 */
export default function StudentLogin() {
  const nav = useNavigate();
  const remembered = loadRemembered();
  const prev = remembered || loadStudent();
  const [form, setForm] = useState({
    school: prev?.school ?? '',
    grade: prev?.grade ?? '',
    classNo: prev?.classNo ?? '',
    number: remembered?.number ?? '',
    name: remembered?.name ?? '',
  });
  const [remember, setRemember] = useState(!!remembered);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const p = {
      school: normalizeSchool(form.school),
      grade: Number(form.grade),
      classNo: Number(form.classNo),
      number: Number(form.number),
      name: form.name.trim(),
    };
    if (!p.school || !p.grade || !p.classNo || !p.number || !p.name) {
      setError('학교 이름, 학년, 반, 번호, 이름을 모두 입력해 주세요.');
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
    <form className="card stack login-form" onSubmit={submit}>
      <label className="field">
        <span>학교 이름</span>
        <input type="text" value={form.school} onChange={set('school')} placeholder="예: 광양중동초등학교" maxLength={40} aria-label="학교 이름" />
      </label>
      <div className="grid3">
        <label className="field">
          <span>학년</span>
          <input type="number" min="1" max="6" inputMode="numeric" value={form.grade} onChange={set('grade')} aria-label="학년" />
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
        로그인 정보 저장
      </label>
      {error && <div className="alert error">{error}</div>}
      <button className="btn primary lg block" disabled={busy}>
        {busy ? '접속 중…' : '로그인'}
      </button>
    </form>
  );
}
