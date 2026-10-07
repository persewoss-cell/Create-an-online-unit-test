import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { goBackTo } from '../lib/nav.js';
import TopBar from './TopBar.jsx';
import { useTeacher } from './TeacherAuth.jsx';
import { teacherLabel } from '../lib/school.js';
import { desktopState, enableDesktop, disableDesktop } from '../lib/desktopNotify.js';
import { logout } from '../lib/db.js';
import ManualDialog from '../pages/Manual.jsx';

/** 바탕화면(Windows) 알림 켜기/끄기 */
function AlertToggle() {
  const [state, setState] = useState(desktopState);
  if (state === 'unsupported') return null;
  const on = state === 'on';
  async function click() {
    if (on) return setState(disableDesktop());
    if (state === 'blocked') {
      alert('브라우저에서 이 사이트의 알림이 차단되어 있어요.\n주소창 왼쪽 자물쇠(사이트 정보) 아이콘 → 알림 → "허용"으로 바꾼 뒤 다시 눌러 주세요.');
      return setState(desktopState());
    }
    const next = await enableDesktop();
    setState(next);
    if (next === 'blocked') alert('알림이 허용되지 않았어요. 주소창 왼쪽 자물쇠 아이콘 → 알림 → "허용"으로 바꿔 주세요.');
  }
  return (
    <button
      className={`btn sm ${on ? 'alerts-on' : ''}`}
      onClick={click}
      title={on ? '창을 내려 두어도 학생 제출·확인할 일을 Windows 알림으로 알려 줍니다. 누르면 끕니다.' : '창을 내려 두어도 Windows 알림으로 알려 줍니다'}
    >
      {on ? '🔔 알림 켜짐' : '🔕 바탕화면 알림 켜기'}
    </button>
  );
}

/** 사용설명서 (선생님용 탭으로 열기) */
function ManualButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn sm" onClick={() => setOpen(true)} title="사용설명서 보기">📖 설명서</button>
      {open && <ManualDialog initial="teacher" onClose={() => setOpen(false)} />}
    </>
  );
}

/** 선생님 화면 상단바. 관리자가 선생님 방을 보고 있으면 알림 줄과 "관리자 화면으로" 버튼을 보여 준다 */
export default function TeacherBar({ children }) {
  const { teacher, isAdmin, viewing, viewAs, setTeacher } = useTeacher();
  const nav = useNavigate();
  const location = useLocation();
  const who = isAdmin ? '관리자' : teacherLabel(teacher);
  return (
    <>
      <TopBar home={isAdmin && !viewing ? '/teacher/admin' : '/teacher/dashboard'} who={who}>
        <AlertToggle />
        <ManualButton />
        {children}
        {/* 선생님 화면 어디서든 맨 오른쪽에 로그아웃 */}
        {teacher && (
          <button
            type="button"
            className="btn sm"
            onClick={async () => {
              await logout();
              setTeacher(null);
              nav('/?tab=teacher', { replace: true });
            }}
          >
            로그아웃
          </button>
        )}
      </TopBar>
      {viewing && (
        <div className="view-banner" role="status">
          <span>🔑 관리자로 <b>{teacherLabel(viewing)}</b> 선생님 방을 보고 있습니다.</span>
          <button
            className="btn sm"
            onClick={() => {
              viewAs(null);
              goBackTo(nav, location, '/teacher/admin');
            }}
          >
            관리자 화면으로
          </button>
        </div>
      )}
    </>
  );
}

/** 상단 [목록]: 목록에서 왔으면 뒤로 가기(기록이 쌓이지 않게), 아니면 목록으로 */
export function ListButton() {
  const nav = useNavigate();
  const location = useLocation();
  return (
    <button type="button" className="btn sm" onClick={() => goBackTo(nav, location, '/teacher/dashboard')}>목록</button>
  );
}
