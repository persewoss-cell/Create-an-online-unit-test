// 선생님 화면의 바탕화면(Windows) 알림 — 인터넷 창을 내려 두거나 다른 프로그램을 쓰고 있어도 알 수 있게.
// 브라우저 알림 권한이 필요하고, 알림이 뜨는 위치는 Windows가 정한다(보통 오른쪽 아래).
const KEY = 'teacher-desktop-alerts';
const ICON = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📝</text></svg>';

export function desktopSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** 'on' | 'off' | 'blocked'(브라우저에서 막음) | 'unsupported' */
export function desktopState() {
  if (!desktopSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  let want = false;
  try {
    want = localStorage.getItem(KEY) === '1';
  } catch {
    /* 저장 불가 환경 */
  }
  return want && Notification.permission === 'granted' ? 'on' : 'off';
}

/** 알림 켜기 (버튼을 눌렀을 때 호출 — 브라우저가 허용할지 물어봄) */
export async function enableDesktop() {
  if (!desktopSupported()) return 'unsupported';
  const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  try {
    localStorage.setItem(KEY, p === 'granted' ? '1' : '0');
  } catch {
    /* 무시 */
  }
  if (p === 'granted') showDesktop('알림이 켜졌어요', '학생이 제출하거나 확인할 일이 생기면 이렇게 알려 드릴게요.', { tag: 'alerts-on' });
  return desktopState();
}

export function disableDesktop() {
  try {
    localStorage.setItem(KEY, '0');
  } catch {
    /* 무시 */
  }
  return desktopState();
}

/** 바탕화면 알림 띄우기. 누르면 이 창으로 돌아와 onClick 실행 */
export function showDesktop(title, body, { tag, onClick } = {}) {
  if (desktopState() !== 'on' && tag !== 'alerts-on') return;
  try {
    const n = new Notification(title, { body, tag, icon: ICON, renotify: !!tag });
    n.onclick = () => {
      window.focus();
      n.close();
      onClick?.();
    };
  } catch {
    /* 일부 브라우저(모바일 등)는 페이지에서 직접 알림을 만들 수 없음 */
  }
}
