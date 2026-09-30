import { useNavigate } from 'react-router-dom';
import TopBar from './TopBar.jsx';
import { useTeacher } from './TeacherAuth.jsx';
import { teacherLabel } from '../lib/school.js';

/** 선생님 화면 상단바. 관리자가 선생님 방을 보고 있으면 알림 줄과 "관리자 화면으로" 버튼을 보여 준다 */
export default function TeacherBar({ children }) {
  const { teacher, isAdmin, viewing, viewAs } = useTeacher();
  const nav = useNavigate();
  const who = isAdmin ? '관리자' : teacherLabel(teacher);
  return (
    <>
      <TopBar home="/teacher/dashboard" who={who}>{children}</TopBar>
      {viewing && (
        <div className="view-banner" role="status">
          <span>🔑 관리자로 <b>{teacherLabel(viewing)}</b> 선생님 방을 보고 있습니다.</span>
          <button
            className="btn sm"
            onClick={() => {
              viewAs(null);
              nav('/teacher/dashboard');
            }}
          >
            관리자 화면으로
          </button>
        </div>
      )}
    </>
  );
}
