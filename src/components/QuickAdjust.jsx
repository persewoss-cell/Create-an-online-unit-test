// 마우스 간편조정: 문항 카드의 문제 그림 위에서 바로
//  - 마우스 휠: 확대·축소 (마우스가 있는 곳을 중심으로)
//  - 손 모양으로 끌기: 위아래·좌우로 옮기기
// 캡쳐가 여러 개면 그림마다 따로 조정된다. 저장은 카드의 [저장] 버튼으로.
import { useEffect, useRef, useState } from 'react';
import { Crop, Regions, aspectOf, masksOn } from './ExamViews.jsx';
import { zoomRegion, panRegion } from '../lib/viewport.js';

function AdjustCrop({ exam, src, region, onRegion }) {
  const ref = useRef(null);
  const latest = useRef({ region, onRegion });
  latest.current = { region, onRegion };
  const drag = useRef(null);
  const [grabbing, setGrabbing] = useState(false);

  // 휠은 페이지 스크롤을 막아야 해서 passive: false 로 직접 붙인다
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const wheel = (e) => {
      e.preventDefault();
      const b = el.getBoundingClientRect();
      const fx = (e.clientX - b.left) / b.width;
      const fy = (e.clientY - b.top) / b.height;
      const delta = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY; // 줄 단위 휠도 픽셀처럼
      const { region: r, onRegion: set } = latest.current;
      set(zoomRegion(r, Math.exp(delta * 0.0015), fx, fy)); // 아래로 굴리면 축소, 위로 굴리면 확대
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);

  function down(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const b = ref.current.getBoundingClientRect();
    ref.current.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, w: b.width, h: b.height, orig: region };
    setGrabbing(true);
  }
  function move(e) {
    const d = drag.current;
    if (!d) return;
    onRegion(panRegion(d.orig, (e.clientX - d.x) / d.w, (e.clientY - d.y) / d.h));
  }
  function up() {
    drag.current = null;
    setGrabbing(false);
  }

  return (
    <div
      ref={ref}
      className={`quick-crop ${grabbing ? 'grabbing' : ''}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      title="휠: 확대·축소 / 끌기: 옮기기"
    >
      <Crop src={src} region={region} aspect={aspectOf(exam, region.page)} masks={masksOn(exam, region.page)} />
    </div>
  );
}

/**
 * @param {{exam:object, pages:string[], group:object|null, regions:object[], onChange:(regions:object[])=>void}} props
 */
export default function QuickAdjust({ exam, pages, group, regions, onChange }) {
  return (
    <div className="qview quick-adjust">
      {group?.regions?.length > 0 && (
        <div className="qview-passage">
          <Regions exam={exam} pages={pages} regions={group.regions} />
        </div>
      )}
      <div className="qview-question">
        {regions.map((r, i) =>
          pages[r.page - 1] ? (
            <AdjustCrop
              key={i}
              exam={exam}
              src={pages[r.page - 1]}
              region={r}
              onRegion={(nr) => onChange(regions.map((x, k) => (k === i ? nr : x)))}
            />
          ) : null,
        )}
      </div>
    </div>
  );
}
