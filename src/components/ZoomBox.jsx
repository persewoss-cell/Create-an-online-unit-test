// 학생 시험 화면: 지문·문제 그림을 두 손가락으로 벌려 크게 보기 (원래 크기보다 작게는 안 됨)
//  - 두 손가락: 확대(벌리기)·되돌리기(오므리기, 원래 크기까지만)·옮기기
//  - 확대한 뒤 한 손가락 끌기: 위아래·좌우로 옮기기 (그리기 칸 위에서는 그리기가 먼저라 두 손가락으로 옮김)
//  - 마우스: Ctrl + 휠로 확대, 확대한 뒤 휠로 위아래 이동
import { useEffect, useRef, useState } from 'react';

const MAX = 4;
const clampScale = (s) => Math.min(MAX, Math.max(1, s));

export default function ZoomBox({ children }) {
  const box = useRef(null);
  const [z, setZ] = useState({ s: 1, x: 0, y: 0 });
  const zRef = useRef(z);
  zRef.current = z;
  const pts = useRef(new Map()); // 누르고 있는 손가락
  const gesture = useRef(null);
  const inner = useRef(null);
  const room = useRef(0); // 확대했을 때 칸이 아래로 늘어날 수 있는 최대 높이 (화면의 빈 곳까지)

  /** 확대하면 칸이 화면의 남는 높이만큼 늘어나서 더 많이 보이게 */
  function measureRoom() {
    const el = box.current;
    const fit = el?.closest('.fit');
    const hn = inner.current?.offsetHeight || 0;
    if (!fit) return (room.current = hn);
    const others = [...fit.children].filter((c) => !c.contains(el)).reduce((sum, c) => sum + c.offsetHeight + 10, 0);
    room.current = Math.max(hn, fit.clientHeight - others - 24);
    return room.current;
  }
  const boxHeight = (s) => {
    const hn = inner.current?.offsetHeight || 0;
    return Math.min(hn * s, Math.max(hn, room.current || hn));
  };

  /** 그림이 칸을 벗어나 빈 곳이 보이지 않게 */
  function clampPos(s, x, y) {
    const el = box.current;
    if (!el || s <= 1) return { s: 1, x: 0, y: 0 };
    const w = el.clientWidth;
    const hn = inner.current?.offsetHeight || 0;
    const bh = boxHeight(s);
    return { s, x: Math.min(0, Math.max(w - w * s, x)), y: Math.min(0, Math.max(bh - hn * s, y)) };
  }
  const local = (e) => {
    const r = box.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function startPinch() {
    const [a, b] = [...pts.current.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const { s, x, y } = zRef.current;
    if (s <= 1) measureRoom();
    gesture.current = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: s, p: { x: (mid.x - x) / s, y: (mid.y - y) / s } };
    window.dispatchEvent(new Event('draw-cancel')); // 첫 손가락으로 그리던 선은 지운다
  }

  function down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pts.current.set(e.pointerId, local(e));
    if (pts.current.size === 2) {
      e.stopPropagation(); // 두 번째 손가락은 그리기로 가지 않게
      startPinch();
      return;
    }
    const onDraw = e.target.closest?.('.draw-layer:not(.readonly)');
    if (pts.current.size === 1 && zRef.current.s > 1 && !onDraw) {
      gesture.current = { type: 'pan', start: local(e), x0: zRef.current.x, y0: zRef.current.y };
    }
  }
  function move(e) {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, local(e));
    const g = gesture.current;
    if (!g) return;
    e.stopPropagation();
    if (g.type === 'pinch' && pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const s = clampScale((g.s0 * Math.hypot(a.x - b.x, a.y - b.y)) / g.d0);
      setZ(clampPos(s, mid.x - g.p.x * s, mid.y - g.p.y * s));
    } else if (g.type === 'pan') {
      const p = local(e);
      setZ(clampPos(zRef.current.s, g.x0 + p.x - g.start.x, g.y0 + p.y - g.start.y));
    }
  }
  function up(e) {
    pts.current.delete(e.pointerId);
    if (gesture.current?.type === 'pinch') e.stopPropagation();
    if (pts.current.size < 2 && gesture.current?.type === 'pinch') gesture.current = null;
    if (!pts.current.size) gesture.current = null;
  }

  // 마우스 휠: Ctrl+휠 확대·되돌리기, 확대 중이면 휠로 위아래 이동 (페이지가 같이 움직이지 않게 passive: false)
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const wheel = (e) => {
      const { s, x, y } = zRef.current;
      if (e.ctrlKey) {
        e.preventDefault();
        if (s <= 1) measureRoom();
        const p = local(e);
        const ns = clampScale(s * Math.exp(-e.deltaY * 0.002));
        setZ(clampPos(ns, p.x - ((p.x - x) / s) * ns, p.y - ((p.y - y) / s) * ns));
      } else if (s > 1) {
        e.preventDefault();
        setZ(clampPos(s, x - e.deltaX, y - e.deltaY));
      }
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={box}
      className={`zoom-box ${z.s > 1 ? 'zoomed' : ''}`}
      style={z.s > 1 ? { height: boxHeight(z.s) } : undefined}
      onPointerDownCapture={down}
      onPointerMoveCapture={move}
      onPointerUpCapture={up}
      onPointerCancelCapture={up}
    >
      <div className="zoom-inner" ref={inner} style={{ transform: `translate(${z.x}px, ${z.y}px) scale(${z.s})` }}>{children}</div>
      {z.s > 1 && (
        <button type="button" className="zoom-reset" onClick={() => setZ({ s: 1, x: 0, y: 0 })} onPointerDownCapture={(e) => e.stopPropagation()}>
          ↺ 원래 크기
        </button>
      )}
    </div>
  );
}
