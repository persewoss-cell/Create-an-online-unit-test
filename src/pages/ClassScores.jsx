import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Loading from '../components/Loading.jsx';
import { useTeacher } from '../components/TeacherAuth.jsx';
import { useDirectory, schoolsOf } from '../components/SchoolSelect.jsx';
import StudentLogin from './student/StudentLogin.jsx';
import TeacherLoginForm from './teacher/TeacherLoginForm.jsx';
import { watchClassStats, ensureStudentSession, logout } from '../lib/db.js';
import { loadStudent, clearStudent } from '../lib/student.js';
import { shortSchool } from '../lib/school.js';

/** 점수 → 막대·글자 색 */
function tone(avg) {
  if (avg >= 90) return 'great';
  if (avg >= 80) return 'good';
  if (avg >= 70) return 'mid';
  return 'low';
}

/**
 * 반별 평가 평균 (/scores): 첫 화면처럼 학생(학교·학년·반·번호·이름) 또는 선생님으로 로그인해야 본다.
 * 학생·선생님은 자기 반 평균만, 관리자는 학교·학년·반을 골라서 본다.
 */
export default function ClassScores() {
  const { teacher, isAdmin, loading } = useTeacher();
  const [student, setStudent] = useState(undefined); // undefined: 확인 중, null: 로그인 안 함
  const [tab, setTab] = useState('student');

  // 이 탭에서 이미 로그인한 학생이면 바로 보여 준다 (선생님이 로그인해 있으면 선생님 우선)
  useEffect(() => {
    if (loading) return;
    if (teacher) {
      setStudent(null);
      return;
    }
    const p = loadStudent();
    if (!p) {
      setStudent(null);
      return;
    }
    let alive = true;
    ensureStudentSession(p)
      .then(() => alive && setStudent(p))
      .catch(() => alive && setStudent(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, !!teacher]);

  async function exit() {
    clearStudent();
    setStudent(null);
    await logout();
  }

  if (loading || student === undefined) return <Loading />;

  const who = teacher
    ? isAdmin && !teacher.school ? '관리자' : `${shortSchool(teacher.school)} ${teacher.grade}-${teacher.classNo} 선생님`
    : student ? `${shortSchool(student.school)} ${student.grade}-${student.classNo} ${student.number}번 ${student.name}` : '';

  return (
    <>
      <TopBar who={who}>
        {(teacher || student) && <button className="btn sm" onClick={exit}>로그아웃</button>}
      </TopBar>
      {isAdmin ? (
        <AdminScores />
      ) : teacher?.school ? (
        <div className="container scores"><Board school={teacher.school} grade={teacher.grade} classNo={teacher.classNo} /></div>
      ) : student ? (
        <div className="container scores"><Board school={student.school} grade={student.grade} classNo={student.classNo} /></div>
      ) : (
        <div className="container narrow home">
          <div className="home-hero">
            <div className="emoji">📊</div>
            <h1>반별 평가 평균</h1>
            <p className="muted" style={{ margin: 0 }}>로그인하면 우리 반 평가별 평균 점수를 볼 수 있어요.</p>
          </div>
          <div className="login-tabs" role="tablist">
            {[['student', '학생 로그인'], ['teacher', '교사 로그인']].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'teacher' ? <TeacherLoginForm onDone={() => {}} /> : <StudentLogin onDone={setStudent} />}
        </div>
      )}
    </>
  );
}

/** 관리자: 학교 · 학년 · 반을 골라서 본다 (고른 값은 주소 ?s=&g=&c= 에 남는다) */
function AdminScores() {
  const [params, setParams] = useSearchParams();
  const dir = useDirectory();
  const schools = schoolsOf(dir);
  const school = params.get('s') || '';
  const grade = Number(params.get('g')) || 0;
  const classNo = Number(params.get('c')) || 0;

  const pick = (s, g, c) => {
    const next = {};
    if (s) next.s = s;
    if (s && g) next.g = String(g);
    if (s && g && c) next.c = String(c);
    setParams(next, { replace: true });
  };
  // 학교가 하나뿐이면 저절로 고른다
  useEffect(() => {
    if (!school && schools.length === 1) pick(schools[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir]);

  const grades = useMemo(
    () => [...new Set((dir || []).filter((d) => d.school === school).map((d) => d.grade))].sort((a, b) => a - b),
    [dir, school],
  );
  const classes = useMemo(
    () => [...new Set((dir || []).filter((d) => d.school === school && d.grade === grade).map((d) => d.classNo))].sort((a, b) => a - b),
    [dir, school, grade],
  );

  return (
    <div className="container scores">
      <h1>📊 반별 평가 평균</h1>
      <div className="card scores-pick">
        <label className="field">
          <span>학교</span>
          <select value={school} onChange={(e) => pick(e.target.value)} aria-label="학교" disabled={dir === null}>
            <option value="">{dir === null ? '불러오는 중…' : '학교를 고르세요'}</option>
            {schools.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        {school && (
          <div className="scores-row">
            <span className="scores-label">학년</span>
            <div className="chips" role="group" aria-label="학년">
              {grades.map((g) => (
                <button key={g} type="button" className={`chip${g === grade ? ' on' : ''}`} aria-pressed={g === grade} onClick={() => pick(school, g)}>
                  {g}학년
                </button>
              ))}
            </div>
          </div>
        )}
        {school && grade > 0 && (
          <div className="scores-row">
            <span className="scores-label">반</span>
            <div className="chips" role="group" aria-label="반">
              {classes.map((c) => (
                <button key={c} type="button" className={`chip${c === classNo ? ' on' : ''}`} aria-pressed={c === classNo} onClick={() => pick(school, grade, c)}>
                  {c}반
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {school && grade > 0 && classNo > 0 && <Board school={school} grade={grade} classNo={classNo} />}
    </div>
  );
}

/** 한 반의 평가별 평균 카드 */
function Board({ school, grade, classNo }) {
  const [subject, setSubject] = useState('');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setList(null);
    setError('');
    setSubject('');
    return watchClassStats(
      school, grade, classNo,
      (l) => setList(l.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))),
      () => setError('평균을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.'),
    );
  }, [school, grade, classNo]);

  const subjects = useMemo(() => [...new Set((list || []).map((x) => x.subject).filter(Boolean))], [list]);
  const shown = (list || []).filter((x) => !subject || x.subject === subject);

  return (
    <>
      <div className="scores-head">
        <h2>📊 {shortSchool(school)} {grade}학년 {classNo}반 평가 평균</h2>
        {subjects.length > 1 && (
          <div className="chips" role="group" aria-label="과목">
            <button type="button" className={`chip sm${!subject ? ' on' : ''}`} aria-pressed={!subject} onClick={() => setSubject('')}>전체</button>
            {subjects.map((s) => (
              <button key={s} type="button" className={`chip sm${s === subject ? ' on' : ''}`} aria-pressed={s === subject} onClick={() => setSubject(s)}>{s}</button>
            ))}
          </div>
        )}
      </div>
      {error && <div className="alert error">{error}</div>}
      {!error && list === null && <div className="muted">불러오는 중…</div>}
      {list && !list.length && <div className="card muted scores-empty">아직 결과가 나온 평가가 없어요.</div>}
      <div className="scores-grid">
        {shown.map((x) => (
          <div key={x.id} className={`card score-card ${tone(x.avg)}`}>
            <div className="score-card-top">
              <span className="subj">{x.subject}</span>
              <span className="muted small">{x.semester}학기</span>
              {x.status === 'open' && <span className="badge open">응시 중</span>}
            </div>
            <div className="score-card-unit" title={x.title}>{x.unit || x.title}</div>
            <div className="score-card-avg">
              <b>{x.avg}</b><span>점</span>
            </div>
            <div className="score-bar" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, x.avg))}%` }} /></div>
            <div className="muted small">{x.count}명 응시 평균</div>
          </div>
        ))}
      </div>
    </>
  );
}
