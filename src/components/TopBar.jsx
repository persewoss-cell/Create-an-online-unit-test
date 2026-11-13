import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

/**
 * 맨 위 줄의 왼쪽·오른쪽 끝을 아래 본문(.container) 내용의 왼쪽·오른쪽 끝에 맞춘다.
 * 화면마다 본문 폭이 달라서(목록·평가 화면·명단 등) 실제 본문 위치를 재서 여백을 정한다.
 */
function useAlignToContent(ref) {
  useEffect(() => {
    const bar = ref.current;
    if (!bar) return undefined;
    let raf = 0;
    let watched = null;
    const ro = new ResizeObserver(() => schedule());
    const apply = () => {
      raf = 0;
      const box = document.querySelector('#root .container');
      if (box !== watched) {
        if (watched) ro.unobserve(watched);
        if (box) ro.observe(box);
        watched = box;
      }
      if (!box) {
        bar.style.paddingLeft = '';
        bar.style.paddingRight = '';
        return;
      }
      const r = box.getBoundingClientRect();
      const cs = getComputedStyle(box);
      const vw = document.documentElement.clientWidth;
      const left = Math.max(12, r.left + parseFloat(cs.paddingLeft));
      const right = Math.max(12, vw - (r.right - parseFloat(cs.paddingRight)));
      bar.style.paddingLeft = `${Math.round(left)}px`;
      bar.style.paddingRight = `${Math.round(right)}px`;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    // 불러오기가 끝나 본문이 나중에 생기거나 바뀌어도 다시 맞춘다
    const mo = new MutationObserver(schedule);
    mo.observe(document.getElementById('root'), { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      ro.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [ref]);
}

export default function TopBar({ home = '/', children, who }) {
  const ref = useRef(null);
  useAlignToContent(ref);
  return (
    <header ref={ref} className="topbar">
      <Link to={home} className="brand">📝 온라인 단원평가</Link>
      <div className="spacer" />
      {who && <span className="who">{who}</span>}
      {children}
    </header>
  );
}
