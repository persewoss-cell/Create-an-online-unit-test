// 선생님이 문제지에서 "학생에게 보이는 부분(캡쳐)"을 직접 고치는 창
//  - 파란 네모(캡쳐): 끌어서 옮기기, 모서리·변을 끌어서 크기 조절, 여러 개면 위에서부터 순서대로 이어 붙여 보여 줌
//  - 흰 네모(가리기): 학생에게 안 보일 부분을 흰 칸으로 덮기 (그 쪽 문제지 전체에 적용)
//  - 버튼: ↑↓←→ 이동, 크게/작게, 캡쳐 순서, 삭제 / 키보드 화살표·Delete 도 됨
import { useEffect, useRef, useState } from 'react';
import { Regions, aspectOf } from './ExamViews.jsx';

const MIN = 0.01; // 너무 작은 네모는 버림 (쪽 크기의 1%)
const STEP = 0.005; // 버튼 한 번에 움직이는 양 (쪽 크기의 0.5%)
const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const r4 = (v) => Math.round(v * 10000) / 10000;
const clone = (x) => JSON.parse(JSON.stringify(x || []));

/** 거꾸로 끈 네모 바로잡기 + 소수 넷째 자리까지 */
function fix(b) {
  return {
    ...b,
    x0: r4(clamp01(Math.min(b.x0, b.x1))), x1: r4(clamp01(Math.max(b.x0, b.x1))),
    y0: r4(clamp01(Math.min(b.y0, b.y1))), y1: r4(clamp01(Math.max(b.y0, b.y1))),
  };
}
const big = (b) => b.x1 - b.x0 >= MIN && b.y1 - b.y0 >= MIN;

/**
 * @param {{title:string, note?:string, view:object, pages:string[], regions:object[], masks:object[],
 *   startPage?:number, drawFirst?:boolean, ghosts?:{label:string, region:object}[],
 *   onApply:(r:{regions:object[], masks:object[]})=>void, onClose:()=>void}} props
 */
export default function RegionEditor({ title, note, view, pages, regions, masks, startPage, drawFirst, ghosts = [], onApply, onClose }) {
  const [regs, setRegs] = useState(() => clone(regions));
  const [msks, setMsks] = useState(() => clone(masks));
  const [page, setPage] = useState(() => startPage || regions?.[0]?.page || 1);
  const [sel, setSel] = useState(() => (regions?.length ? { list: 'r', i: 0 } : null));
  const [mode, setMode] = useState(drawFirst ? 'r' : null); // 'r' 새 캡쳐 / 'm' 새 가리기 그리는 중
  const stage = useRef(null);
  const drag = useRef(null);
  const latest = useRef({ regs, msks });
  latest.current = { regs, msks };

  const listOf = (l) => (l === 'r' ? latest.current.regs : latest.current.msks);
  const setList = (l, f) => (l === 'r' ? setRegs : setMsks)(f);
  const selBox = sel ? listOf(sel.list)[sel.i] : null;
  const pageCount = pages.length;
  const aspect = aspectOf(view, page);

  function goPage(p) {
    const n = Math.min(pageCount, Math.max(1, p));
    setPage(n);
    if (selBox && selBox.page !== n) setSel(null);
  }

  function pt(e) {
    const r = stage.current.getBoundingClientRect();
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
  }

  function down(e, target) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const p = pt(e);
    stage.current.setPointerCapture?.(e.pointerId);
    if (mode) {
      const box = { page, x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      const l = mode;
      const i = listOf(l).length;
      setList(l, (a) => [...a, box]);
      setSel({ list: l, i });
      drag.current = { list: l, i, handle: 'se', start: p, orig: box, creating: true };
      return;
    }
    if (!target) {
      setSel(null);
      return;
    }
    setSel({ list: target.list, i: target.i });
    drag.current = { ...target, start: p, orig: listOf(target.list)[target.i] };
  }

  function moveP(e) {
    const d = drag.current;
    if (!d) return;
    const p = pt(e);
    const dx = p.x - d.start.x;
    const dy = p.y - d.start.y;
    const o = d.orig;
    let b;
    if (d.handle === 'move') {
      const w = o.x1 - o.x0;
      const h = o.y1 - o.y0;
      const x0 = Math.min(1 - w, Math.max(0, o.x0 + dx));
      const y0 = Math.min(1 - h, Math.max(0, o.y0 + dy));
      b = { ...o, x0, y0, x1: x0 + w, y1: y0 + h };
    } else {
      b = { ...o };
      if (d.handle.includes('n')) b.y0 = clamp01(o.y0 + dy);
      if (d.handle.includes('s')) b.y1 = clamp01(o.y1 + dy);
      if (d.handle.includes('w')) b.x0 = clamp01(o.x0 + dx);
      if (d.handle.includes('e')) b.x1 = clamp01(o.x1 + dx);
    }
    setList(d.list, (a) => a.map((x, k) => (k === d.i ? b : x)));
  }

  function up() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const cur = listOf(d.list);
    const done = fix(cur[d.i]);
    if (!big(done)) {
      // 클릭만 하고 끌지 않은 새 네모는 버림
      setList(d.list, (a) => a.filter((_, k) => k !== d.i));
      setSel(null);
    } else {
      setList(d.list, (a) => a.map((x, k) => (k === d.i ? done : x)));
    }
    if (d.creating) setMode(null);
  }

  /** 선택한 네모 옮기기(dx, dy) / 키우기(grow > 0) / 줄이기(grow < 0) */
  function nudge(dx, dy, grow = 0) {
    if (!sel) return;
    setList(sel.list, (a) =>
      a.map((b, k) => {
        if (k !== sel.i) return b;
        let n = { ...b, x0: b.x0 - grow, x1: b.x1 + grow, y0: b.y0 - grow, y1: b.y1 + grow };
        if (!big(fix(n))) return b;
        const w = n.x1 - n.x0;
        const h = n.y1 - n.y0;
        const x0 = Math.min(1 - Math.min(w, 1), Math.max(0, n.x0 + dx));
        const y0 = Math.min(1 - Math.min(h, 1), Math.max(0, n.y0 + dy));
        n = { ...n, x0, y0, x1: x0 + Math.min(w, 1), y1: y0 + Math.min(h, 1) };
        return fix(n);
      }),
    );
  }

  function remove() {
    if (!sel) return;
    setList(sel.list, (a) => a.filter((_, k) => k !== sel.i));
    setSel(null);
  }

  /** 캡쳐 순서 바꾸기 (여러 캡쳐는 이 순서대로 위에서 아래로 이어 붙여 보여 줌) */
  function reorder(dir) {
    if (sel?.list !== 'r') return;
    const j = sel.i + dir;
    if (j < 0 || j >= regs.length) return;
    setRegs((a) => {
      const out = [...a];
      [out[sel.i], out[j]] = [out[j], out[sel.i]];
      return out;
    });
    setSel({ list: 'r', i: j });
  }

  // 키보드: 화살표 = 옮기기(Shift는 크게), Delete = 지우기, Esc = 닫기
  useEffect(() => {
    function key(e) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === 'Escape') return onClose();
      if (!sel) return;
      const s = e.shiftKey ? STEP * 4 : STEP;
      const map = { ArrowUp: [0, -s], ArrowDown: [0, s], ArrowLeft: [-s, 0], ArrowRight: [s, 0] };
      if (map[e.key]) {
        e.preventDefault();
        nudge(...map[e.key]);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        remove();
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const boxStyle = (b) => ({
    left: `${b.x0 * 100}%`, top: `${b.y0 * 100}%`, width: `${(b.x1 - b.x0) * 100}%`, height: `${(b.y1 - b.y0) * 100}%`,
  });
  const renderBox = (b, i, list) => {
    if (b.page !== page) return null;
    const on = sel?.list === list && sel.i === i;
    return (
      <div
        key={`${list}${i}`}
        className={`re-box ${list === 'r' ? 'reg' : 'mask'} ${on ? 'on' : ''}`}
        style={boxStyle(b)}
        onPointerDown={(e) => down(e, { list, i, handle: 'move' })}
        title={list === 'r' ? `캡쳐 ${i + 1} — 끌어서 옮기기` : '가리기 — 끌어서 옮기기'}
      >
        <span className="re-label">{list === 'r' ? `캡쳐 ${i + 1}` : '가리기'}</span>
        {on && HANDLES.map((h) => <span key={h} className={`re-h ${h}`} onPointerDown={(e) => down(e, { list, i, handle: h })} />)}
      </div>
    );
  };

  const previewView = { ...view, masks: msks };
  const otherPages = [...new Set(regs.map((r) => r.page))].filter((p) => p !== page);

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="re-title" onClick={onClose}>
      <div className="modal stack region-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="manual-close" onClick={onClose} aria-label="닫기" title="닫기 (적용하지 않음)">✕</button>
        <h2 id="re-title" style={{ margin: 0, paddingRight: 44 }}>{title}</h2>
        {note && <div className="small muted">{note}</div>}

        <div className="re-toolbar">
          <span className="row" style={{ gap: 4 }}>
            <button type="button" className="btn sm" onClick={() => goPage(page - 1)} disabled={page <= 1} aria-label="앞 쪽">◀</button>
            <b className="nowrap">{page}쪽 / {pageCount}</b>
            <button type="button" className="btn sm" onClick={() => goPage(page + 1)} disabled={page >= pageCount} aria-label="다음 쪽">▶</button>
          </span>
          <button type="button" className={`btn sm ${mode === 'r' ? 'primary' : ''}`} onClick={() => setMode(mode === 'r' ? null : 'r')}>
            ＋ 캡쳐 추가{mode === 'r' ? ' (문제지에서 끌어 그리세요)' : ''}
          </button>
          <button type="button" className={`btn sm ${mode === 'm' ? 'primary' : ''}`} onClick={() => setMode(mode === 'm' ? null : 'm')}>
            ⬜ 가리기 추가{mode === 'm' ? ' (가릴 부분을 끌어 그리세요)' : ''}
          </button>
        </div>

        <div className={`re-toolbar ${sel ? '' : 'off'}`}>
          <span className="small nowrap"><b>{sel ? (sel.list === 'r' ? `캡쳐 ${sel.i + 1}` : '가리기') : '네모를 눌러 고르세요'}</b></span>
          <span className="row" style={{ gap: 4 }}>
            <button type="button" className="btn sm" disabled={!sel} onClick={() => nudge(0, -STEP)} aria-label="위로">↑</button>
            <button type="button" className="btn sm" disabled={!sel} onClick={() => nudge(0, STEP)} aria-label="아래로">↓</button>
            <button type="button" className="btn sm" disabled={!sel} onClick={() => nudge(-STEP, 0)} aria-label="왼쪽으로">←</button>
            <button type="button" className="btn sm" disabled={!sel} onClick={() => nudge(STEP, 0)} aria-label="오른쪽으로">→</button>
          </span>
          <span className="row" style={{ gap: 4 }}>
            <button type="button" className="btn sm" disabled={!sel} onClick={() => nudge(0, 0, STEP)}>⊕ 크게</button>
            <button type="button" className="btn sm" disabled={!sel} onClick={() => nudge(0, 0, -STEP)}>⊖ 작게</button>
          </span>
          {sel?.list === 'r' && regs.length > 1 && (
            <span className="row" style={{ gap: 4 }}>
              <span className="small">순서</span>
              <button type="button" className="btn sm" disabled={sel.i === 0} onClick={() => reorder(-1)} aria-label="캡쳐 순서 앞으로">▲</button>
              <button type="button" className="btn sm" disabled={sel.i === regs.length - 1} onClick={() => reorder(1)} aria-label="캡쳐 순서 뒤로">▼</button>
            </span>
          )}
          <button type="button" className="btn sm danger" disabled={!sel} onClick={remove}>🗑 삭제</button>
        </div>

        <div className="re-body">
          <div className="re-stage-wrap">
            <div
              ref={stage}
              className={`re-stage ${mode ? 'drawing' : ''}`}
              style={{ aspectRatio: `${aspect}`, width: `min(100%, calc(70vh * ${aspect}))` }}
              onPointerDown={(e) => down(e, null)}
              onPointerMove={moveP}
              onPointerUp={up}
              onPointerCancel={up}
            >
              {pages[page - 1] && <img src={pages[page - 1]} alt={`${page}쪽`} draggable={false} />}
              {ghosts.filter((g) => g.region.page === page).map((g, i) => (
                <div key={`g${i}`} className="re-ghost" style={boxStyle(g.region)}><span>{g.label}</span></div>
              ))}
              {msks.map((b, i) => renderBox(b, i, 'm'))}
              {regs.map((b, i) => renderBox(b, i, 'r'))}
            </div>
            {otherPages.length > 0 && <div className="small muted">다른 쪽에도 캡쳐가 있어요: {otherPages.map((p) => `${p}쪽`).join(', ')}</div>}
          </div>
          <div className="re-preview">
            <div className="small"><b>학생에게 보이는 모습</b></div>
            {regs.length ? (
              <div className="qview-question"><Regions exam={previewView} pages={pages} regions={regs} /></div>
            ) : (
              <div className="small muted">캡쳐가 없으면 문제지 쪽 전체가 보여요. <b>＋ 캡쳐 추가</b>를 누르고 문제 부분을 끌어 그리세요.</div>
            )}
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="small muted">네모 안을 끌면 옮겨지고, 모서리·변의 점을 끌면 크기가 바뀌어요. 키보드 화살표(Shift는 크게)·Delete 도 돼요.</span>
          <span className="row">
            <button type="button" className="btn" onClick={onClose}>취소</button>
            <button type="button" className="btn primary" onClick={() => onApply({ regions: regs.map(fix).filter(big), masks: msks.map(fix).filter(big) })}>적용</button>
          </span>
        </div>
      </div>
    </div>
  );
}
