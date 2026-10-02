import { useCallback, useRef, useState } from 'react';

/**
 * 화면 위쪽에 잠깐 뜨는 알림 (선생님·학생이 한 일이 실시간으로 반영될 때)
 * const [toast, notify] = useToast();  …  notify('선생님이 확인했어요');  …  {toast}
 */
export function useToast(ms = 8000) {
  const [list, setList] = useState([]);
  const seq = useRef(0);
  const notify = useCallback(
    (text, opt = {}) => {
      const id = ++seq.current;
      setList((l) => [...l.filter((t) => t.text !== text), { id, text, kind: opt.kind || 'info', action: opt.action }].slice(-3));
      if (!opt.sticky) setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), opt.ms || ms);
    },
    [ms],
  );
  const close = (id) => setList((l) => l.filter((t) => t.id !== id));
  const toast = list.length ? (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span>🔔 {t.text}</span>
          {t.action && (
            <button
              type="button"
              className="btn xs"
              onClick={() => {
                close(t.id);
                t.action.onClick();
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" className="btn xs" onClick={() => close(t.id)} aria-label="알림 닫기">확인</button>
        </div>
      ))}
    </div>
  ) : null;
  return [toast, notify];
}
