// 그리기 문항: 문제 이미지 위에 손가락/펜으로 그리기
// 좌표는 "문항 이미지 묶음" 기준: x는 0~1000(폭), y는 폭과 같은 비율의 단위(0~1000×세로비율)
import { useRef, useState } from 'react';

export const TOOLS = [
  ['pen', '✏️', '펜'],
  ['line', '📏', '직선'],
  ['circle', '⭕', '컴퍼스'],
  ['dot', '•', '점'],
  ['eraser', '🧽', '지우개'],
];

const round = (v) => Math.round(v * 10) / 10;

function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function hits(s, x, y, tol) {
  if (s.t === 'dot') return Math.hypot(s.p[0] - x, s.p[1] - y) < tol + 4;
  if (s.t === 'circle') return Math.abs(Math.hypot(s.p[0] - x, s.p[1] - y) - s.p[2]) < tol;
  for (let i = 0; i + 3 < s.p.length; i += 2) {
    if (distToSeg(x, y, s.p[i], s.p[i + 1], s.p[i + 2], s.p[i + 3]) < tol) return true;
  }
  return s.p.length === 2 && Math.hypot(s.p[0] - x, s.p[1] - y) < tol;
}

/** 획 하나를 SVG 요소로 (map: 좌표 변환 함수, 채점 화면에서 페이지 좌표로 바꿀 때 사용) */
export function StrokeShape({ s, map = (x, y) => [x, y], scale = 1, color = '#1c3faa', width = 3.2 }) {
  const common = { stroke: color, strokeWidth: width, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (s.t === 'dot') {
    const [x, y] = map(s.p[0], s.p[1]);
    return <circle cx={x} cy={y} r={width * 1.8} fill={color} />;
  }
  if (s.t === 'circle') {
    const [x, y] = map(s.p[0], s.p[1]);
    return <circle cx={x} cy={y} r={s.p[2] * scale} {...common} />;
  }
  const pts = [];
  for (let i = 0; i + 1 < s.p.length; i += 2) pts.push(map(s.p[i], s.p[i + 1]).join(','));
  return <polyline points={pts.join(' ')} {...common} />;
}

/** 화면 속 자 (실제 시험지 크기와 같은 눈금) */
function Ruler({ ruler, ppc, active }) {
  const L = 15; // cm
  const h = 0.9 * ppc;
  const ticks = [];
  for (let mm = 0; mm <= L * 10; mm++) {
    const x = (mm / 10) * ppc;
    const len = mm % 10 === 0 ? h * 0.45 : mm % 5 === 0 ? h * 0.3 : h * 0.18;
    ticks.push(<line key={mm} x1={x} y1={0} x2={x} y2={len} stroke="#333" strokeWidth={mm % 10 === 0 ? 1.4 : 0.8} />);
    if (mm % 10 === 0) {
      ticks.push(
        <text key={`t${mm}`} x={x} y={h * 0.78} fontSize={h * 0.3} textAnchor="middle" fill="#333">
          {mm / 10}
        </text>,
      );
    }
  }
  return (
    <g transform={`translate(${ruler.x},${ruler.y}) rotate(${ruler.a})`} style={{ pointerEvents: active ? 'auto' : 'none' }}>
      <rect x={-ppc * 0.3} y={0} width={(L + 0.6) * ppc} height={h} rx={4} fill="rgba(255, 236, 153, 0.72)" stroke="#b08900" strokeWidth={1} data-part="body" />
      <g style={{ pointerEvents: 'none' }}>{ticks}</g>
      <circle cx={(L + 0.3) * ppc} cy={h / 2} r={h * 0.42} fill="rgba(47,111,237,0.85)" data-part="rotate" />
      <text x={(L + 0.3) * ppc} y={h / 2 + h * 0.14} fontSize={h * 0.36} textAnchor="middle" fill="#fff" style={{ pointerEvents: 'none' }}>↻</text>
    </g>
  );
}

/**
 * 문항 이미지 위에 겹쳐지는 그리기 판
 * @param {{ratio:number, strokes:object[], onChange?:(strokes)=>void, tool?:string, ruler?:object, setRuler?:Function, ppc?:number, readOnly?:boolean}} props
 */
export function DrawLayer({ ratio, strokes = [], onChange, tool = 'pen', ruler, setRuler, ppc = 50, readOnly }) {
  const svgRef = useRef(null);
  const [draft, setDraftState] = useState(null);
  const draftRef = useRef(null);
  const setDraft = (d) => {
    draftRef.current = d;
    setDraftState(d);
  };
  const drag = useRef(null);
  const H = 1000 * ratio;

  const toLocal = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const k = 1000 / r.width;
    return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
  };

  function down(e) {
    if (readOnly) return;
    const [x, y] = toLocal(e);
    const part = e.target?.dataset?.part;
    if (tool === 'ruler' && ruler?.show && part) {
      drag.current = { mode: part, x, y, start: { ...ruler } };
      svgRef.current.setPointerCapture(e.pointerId);
      return;
    }
    if (tool === 'ruler') return;
    svgRef.current.setPointerCapture(e.pointerId);
    if (tool === 'eraser') {
      drag.current = { mode: 'erase' };
      erase(x, y);
      return;
    }
    if (tool === 'dot') {
      onChange([...strokes, { t: 'dot', p: [round(x), round(y)] }]);
      return;
    }
    drag.current = { mode: 'draw' };
    setDraft(tool === 'circle' ? { t: 'circle', p: [round(x), round(y), 0] } : { t: tool, p: [round(x), round(y), round(x), round(y)] });
  }

  function move(e) {
    const d = drag.current;
    if (!d) return;
    const [x, y] = toLocal(e);
    if (d.mode === 'body') {
      setRuler({ ...d.start, x: d.start.x + x - d.x, y: d.start.y + y - d.y });
    } else if (d.mode === 'rotate') {
      const a = (Math.atan2(y - d.start.y, x - d.start.x) * 180) / Math.PI;
      setRuler({ ...d.start, a: Math.round(a) });
    } else if (d.mode === 'erase') {
      erase(x, y);
    } else if (d.mode === 'draw' && draftRef.current) {
      const draft = draftRef.current;
      if (draft.t === 'pen') {
        const n = draft.p.length;
        if (Math.hypot(x - draft.p[n - 2], y - draft.p[n - 1]) > 2) setDraft({ ...draft, p: [...draft.p, round(x), round(y)] });
      } else if (draft.t === 'line') {
        setDraft({ ...draft, p: [draft.p[0], draft.p[1], round(x), round(y)] });
      } else if (draft.t === 'circle') {
        setDraft({ ...draft, p: [draft.p[0], draft.p[1], round(Math.hypot(x - draft.p[0], y - draft.p[1]))] });
      }
    }
  }

  function up() {
    const d = drag.current;
    drag.current = null;
    const draft = draftRef.current;
    if (d?.mode === 'draw' && draft) {
      const tiny = draft.t === 'circle' ? draft.p[2] < 3 : draft.p.length <= 4 && Math.hypot(draft.p[2] - draft.p[0], draft.p[3] - draft.p[1]) < 3;
      if (!tiny) onChange([...strokes, draft]);
      else if (draft.t === 'pen') onChange([...strokes, { t: 'dot', p: [draft.p[0], draft.p[1]] }]);
      setDraft(null);
    }
  }

  function erase(x, y) {
    const left = strokes.filter((s) => !hits(s, x, y, 14));
    if (left.length !== strokes.length) onChange(left);
  }

  return (
    <svg
      ref={svgRef}
      className={`draw-layer ${readOnly ? 'readonly' : `tool-${tool}`}`}
      viewBox={`0 0 1000 ${H}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      data-testid="draw-layer"
    >
      {strokes.map((s, i) => <StrokeShape key={i} s={s} />)}
      {draft && <StrokeShape s={draft} />}
      {draft?.t === 'circle' && <circle cx={draft.p[0]} cy={draft.p[1]} r={4} fill="#e03131" />}
      {ruler?.show && !readOnly && <Ruler ruler={ruler} ppc={ppc} active={tool === 'ruler'} />}
    </svg>
  );
}

export function DrawToolbar({ tool, setTool, ruler, setRuler, onUndo, onClear, canUndo }) {
  return (
    <div className="draw-toolbar" role="toolbar" aria-label="그리기 도구">
      {TOOLS.map(([k, icon, label]) => (
        <button key={k} type="button" className={tool === k ? 'on' : ''} onClick={() => setTool(k)} aria-pressed={tool === k}>
          <span>{icon}</span>
          {label}
        </button>
      ))}
      <button
        type="button"
        className={ruler?.show ? 'on' : ''}
        onClick={() => {
          const show = !ruler?.show;
          setRuler({ ...ruler, show });
          setTool(show ? 'ruler' : 'pen');
        }}
        aria-pressed={!!ruler?.show}
      >
        <span>📐</span>
        {ruler?.show ? '자 치우기' : '자'}
      </button>
      <button type="button" onClick={onUndo} disabled={!canUndo}>
        <span>↩</span>되돌리기
      </button>
      <button type="button" onClick={onClear} disabled={!canUndo}>
        <span>🗑</span>모두 지우기
      </button>
      {ruler?.show && (
        <div className="small muted" style={{ width: '100%' }}>
          📐 자 모드: 노란 자를 끌어서 옮기고, 파란 ↻ 를 끌어서 돌리세요. 그리려면 다른 도구를 누르세요.
        </div>
      )}
    </div>
  );
}

/** 문항 이미지 묶음 좌표 → 페이지 좌표 (채점된 시험지에 학생 그림 표시용) */
export function stackToPage(regions, aspectOf, W, Hpage) {
  const ratios = regions.map((r) => (r.y1 - r.y0) / ((r.x1 - r.x0) * aspectOf(r.page)));
  return (x, y) => {
    let v = y / 1000;
    for (let i = 0; i < regions.length; i++) {
      if (v <= ratios[i] || i === regions.length - 1) {
        const r = regions[i];
        return { page: r.page, X: (r.x0 + (x / 1000) * (r.x1 - r.x0)) * W, Y: (r.y0 + (v / ratios[i]) * (r.y1 - r.y0)) * Hpage(r.page), scale: ((r.x1 - r.x0) * W) / 1000 };
      }
      v -= ratios[i];
    }
    return null;
  };
}
