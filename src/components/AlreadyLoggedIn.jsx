import { useNavigate } from 'react-router-dom';
import { useTeacher } from './TeacherAuth.jsx';
import { logout } from '../lib/db.js';
import { teacherLabel } from '../lib/school.js';

/**
 * 로그인 화면에 왔는데 이미 선생님(관리자)으로 로그인되어 있을 때.
 * (예전에는 곧바로 목록으로 되돌려 보내서 뒤로가기가 막힌 것처럼 보였다)
 */
export default function AlreadyLoggedIn() {
  const { teacher, isAdmin, setTeacher } = useTeacher();
  const nav = useNavigate();
  if (!teacher) return null;
  return (
    <div className="card stack center-text">
      <div><b>{isAdmin ? '관리자' : teacherLabel(teacher)}</b>(으)로 로그인되어 있어요.</div>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn primary" onClick={() => nav(isAdmin ? '/teacher/admin' : '/teacher/dashboard')}>
          {isAdmin ? '관리자 화면으로' : '내 단원평가로'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={async () => {
            await logout();
            setTeacher(null);
          }}
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
