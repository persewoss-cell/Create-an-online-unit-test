import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { backState } from '../lib/nav.js';
import TopBar from '../components/TopBar.jsx';
import Loading from '../components/Loading.jsx';
import { useTeacher } from '../components/TeacherAuth.jsx';
import StudentLogin from './student/StudentLogin.jsx';
import TeacherLoginForm from './teacher/TeacherLoginForm.jsx';
import AlreadyLoggedIn from '../components/AlreadyLoggedIn.jsx';

const TABS = [
  ['student', '학생 로그인'],
  ['teacher', '교사 로그인'],
];

/** 첫 화면: 학생 / 교사 로그인 */
export default function Home() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'teacher' ? 'teacher' : 'student';
  const { teacher, loading } = useTeacher();
  const location = useLocation();

  if (tab === 'teacher' && loading) return <Loading />;

  return (
    <>
      <TopBar />
      <div className="container narrow home">
        <div className="home-hero">
          <div className="emoji">{tab === 'teacher' ? '🧑‍🏫' : '✏️'}</div>
          <h1>온라인 단원평가</h1>
        </div>
        {/* 사용설명서: 지금 고른 탭(학생/교사)의 설명서가 먼저 열린다 */}
        <Link
          to={tab === 'teacher' ? '/guide?who=teacher' : '/guide'}
          state={backState(location)}
          className="btn block guide-btn"
        >
          📖 사용설명서
        </Link>
        <div className="login-tabs" role="tablist">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={tab === k ? 'active' : ''}
              onClick={() => setParams(k === 'teacher' ? { tab: 'teacher' } : {}, { replace: true })}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'teacher' ? (teacher ? <AlreadyLoggedIn /> : <TeacherLoginForm />) : <StudentLogin />}
        {tab === 'teacher' && (
          <div className="teacher-link"><Link to="/admin">관리자 로그인 →</Link></div>
        )}
        <footer className="maker">만든이: 강형권 선생님</footer>
      </div>
    </>
  );
}
