// 문항 화면 공통 부품
//  - QuestionView: 문제지에서 지문 + 문항 부분만 잘라서 보여줌
//  - AnswerInput:  학생이 답을 입력하는 칸 (객관식/선 잇기/단답형/서술형), 정답 표시 모드 지원
//  - GradedPaper:  제출 후 문제지 전체에 빨간 색연필로 채점 표시
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { buildGrid, findSpot, occupy, textWidth } from '../lib/placement.js';
import { StrokeShape, stackToPage } from './Drawing.jsx';
import { choiceLabel } from '../lib/parseQuestions.js';
import { matchLabel, shortKeyText, answerToText, keyToText, boxAlternatives } from '../lib/format.js';

const A4 = 210 / 297;
export const aspectOf = (exam, page) => exam?.pageAspects?.[page - 1] || A4;

/** 문항 이미지 묶음(폭 1000 단위)에서 1cm가 몇 단위인지 — 화면 속 자 눈금용 */
export function unitsPerCm(exam, regions) {
  const r = regions[0];
  if (!r) return 50;
  const pageCm = exam?.pageWidthsCm?.[r.page - 1] || 21;
  return 1000 / ((r.x1 - r.x0) * pageCm);
}

const FULL_PAGE = (page) => ({ page, x0: 0, y0: 0, x1: 1, y1: 1 });

/** 문항의 지문 영역과 문제 영역 (영역 정보가 없으면 그 쪽 전체) */
export function regionsOf(exam, q) {
  const group = q.group ? (exam.groups || []).find((g) => g.id === q.group) : null;
  return {
    passage: group?.regions?.length ? group.regions : [],
    question: q.regions?.length ? q.regions : [FULL_PAGE(q.page || 1)],
  };
}

/** 영역들을 같은 폭으로 세로로 쌓았을 때의 (높이 / 폭) 비율 */
export function stackRatio(exam, regions) {
  return regions.reduce((s, r) => s + (r.y1 - r.y0) / ((r.x1 - r.x0) * aspectOf(exam, r.page)), 0);
}

/** 요소 크기 측정: const [ref, size] = useSize(); <div ref={ref}> */
export function useSize() {
  const [el, setEl] = useState(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, size];
}

/**
 * 주어진 칸 안에 스크롤 없이 들어가도록 영역 이미지들의 크기를 맞춘다.
 * sections: 카드 하나에 들어갈 영역 묶음들 (예: [지문 영역들, 문제 영역들])
 */
export function FitRegions({ exam, pages, sections, className = '' }) {
  const [ref, { w, h }] = useSize();
  const CARD_PAD = 20; // 카드 안쪽 여백(위아래 합)
  const GAP = 10;
  const list = sections.filter((sec) => sec.regions.length);
  const ratio = list.reduce((s, sec) => s + stackRatio(exam, sec.regions), 0);
  const fixed = list.length * CARD_PAD + (list.length - 1) * GAP;
  const byHeight = h > 150 ? (h - fixed) / ratio : Infinity; // 높이가 정해지지 않은 좁은 화면은 폭에 맞춤
  const width = ratio > 0 ? Math.max(120, Math.min(w - CARD_PAD, byHeight)) : 0;
  return (
    <div ref={ref} className={`fit ${className}`}>
      {w > 0 &&
        list.map((sec, i) => (
          <div key={i} className={`fit-card ${sec.kind || ''}`} style={{ width: width + CARD_PAD }}>
            <div style={{ position: 'relative' }}>
              <Regions exam={exam} pages={pages} regions={sec.regions} />
              {sec.overlay && sec.overlay(stackRatio(exam, sec.regions))}
            </div>
          </div>
        ))}
    </div>
  );
}

/** 페이지 이미지에서 한 영역만 잘라서 표시 */
export function Crop({ src, region, aspect }) {
  const w = region.x1 - region.x0;
  const h = region.y1 - region.y0;
  if (!(w > 0 && h > 0)) return null;
  return (
    <div className="crop" style={{ aspectRatio: `${w * aspect} / ${h}` }}>
      <img
        src={src}
        alt=""
        draggable={false}
        style={{ width: `${100 / w}%`, left: `${(-region.x0 / w) * 100}%`, top: `${(-region.y0 / h) * 100}%` }}
      />
    </div>
  );
}

export function Regions({ exam, pages, regions }) {
  return regions.map((r, i) =>
    pages[r.page - 1] ? <Crop key={i} src={pages[r.page - 1]} region={r} aspect={aspectOf(exam, r.page)} /> : null,
  );
}

/** 지문(같은 지문 묶음이면 그대로) + 문항 */
export function QuestionView({ exam, q, pages }) {
  const group = q.group ? (exam.groups || []).find((g) => g.id === q.group) : null;
  if (!q.regions?.length) {
    const src = pages[(q.page || 1) - 1];
    return src ? <img className="page-img" src={src} alt={`${q.page}쪽`} /> : <div className="muted">문제지 이미지가 없습니다.</div>;
  }
  return (
    <div className="qview">
      {group?.regions?.length > 0 && (
        <div className="qview-passage">
          <Regions exam={exam} pages={pages} regions={group.regions} />
        </div>
      )}
      <div className="qview-question">
        <Regions exam={exam} pages={pages} regions={q.regions} />
      </div>
    </div>
  );
}

/**
 * @param {{q:object, value:any, onChange?:(v)=>void, answerKey?:object, disabled?:boolean}} props
 * answerKey가 있으면 정답을 초록색으로 표시한다(교사 미리보기).
 */
export function AnswerInput({ q, value, onChange = () => {}, answerKey, disabled }) {
  const show = !!answerKey;
  if (q.parts?.length) {
    // 한 문제 안에 답 유형이 여러 개: 부분마다 (1), (2) … 입력
    const vals = value?.parts || {}; // {0: 답, 1: 답} (Firestore는 배열 안에 배열을 저장할 수 없어서 객체로)
    return (
      <div className="parts">
        {q.parts.map((p, i) => (
          <div key={i} className="part">
            <div className="part-head">({i + 1})</div>
            <div className="part-body">
              <AnswerInput
                q={{ ...p, no: `${q.no}-${i + 1}`, regions: q.regions, parts: undefined }}
                value={vals[i]}
                onChange={(v) => onChange({ parts: { ...vals, [i]: v } })}
                answerKey={show ? answerKey.parts?.[i] || {} : undefined}
                disabled={disabled}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (q.type === 'draw' || q.draw) {
    return (
      <div>
        <div className="key-box" style={{ background: 'var(--primary-weak)', color: '#1d4194' }}>
          ✏️ 그리기 문항 — 학생이 문제 그림 위에 직접 그립니다. 그림은 선생님이 확인합니다.
        </div>
        {q.type !== 'draw' && (
          <div style={{ marginTop: 8 }}>
            <AnswerInput
              q={{ ...q, draw: false }}
              value={value?.text ?? ''}
              onChange={(t) => onChange({ ...(value || {}), text: t })}
              answerKey={answerKey}
              disabled={disabled}
            />
          </div>
        )}
      </div>
    );
  }
  if (q.type === 'mc') {
    const n = q.choiceCount || 5;
    const sel = Array.isArray(value) ? value : [];
    const keySet = new Set(answerKey?.choices || []);
    // 문항 이미지가 있으면 보기 글은 이미지로 보고, 버튼은 기호만 (PDF에서 뽑은 글은 띄어쓰기가 틀릴 수 있음)
    // 직접 입력 보기는 적은 글(기호 칸) 하나만 버튼에 보인다
    const hasText = !q.customLabels && (q.showChoiceText || !q.regions?.length) && q.choices?.length === n && q.choices.some((c) => c);
    const toggle = (k) => {
      if (q.multi) onChange(sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k].sort((a, b) => a - b));
      else onChange(sel[0] === k ? [] : [k]);
    };
    return (
      <div className={`choices ${hasText ? '' : 'compact'}`} role={q.multi ? 'group' : 'radiogroup'}>
        {q.multi && <div className="small muted" style={{ width: '100%' }}>알맞은 것을 모두 고르세요.</div>}
        {Array.from({ length: n }, (_, i) => i + 1).map((k) => (
          <button
            key={k}
            type="button"
            className={`choice ${sel.includes(k) ? 'selected' : ''} ${show && keySet.has(k) ? 'correct-key' : ''}`}
            onClick={() => !disabled && toggle(k)}
            aria-pressed={sel.includes(k)}
            aria-label={`${q.no}번 ${k}번 보기`}
            disabled={disabled && !show}
          >
            {/* 직접 입력 보기에서 기호를 비워 두었으면 내용만, 내용도 없으면 번호 */}
            {choiceLabel(q, k) ? (
              <span className="num">{choiceLabel(q, k)}</span>
            ) : (
              !String(q.choices?.[k - 1] || '').trim() && <span className="num">{k}</span>
            )}
            {(hasText || (!choiceLabel(q, k) && !q.customLabels)) && q.choices?.[k - 1] && <span>{q.choices[k - 1]}</span>}
            {show && keySet.has(k) && <span className="key-check">✓ 정답</span>}
          </button>
        ))}
      </div>
    );
  }
  if (q.type === 'match') {
    const count = q.matchCount || 2;
    const opts = (q.matchLabels || []).length || count;
    const cur = Array.isArray(value) ? value : [];
    const set = (i, v) => {
      const next = Array.from({ length: count }, (_, j) => cur[j] || 0);
      next[i] = next[i] === v ? 0 : v;
      onChange(next);
    };
    return (
      <div className="match">
        <div className="small muted">각 번호와 이어지는 것을 고르세요.</div>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="match-row">
            <b>({i + 1})</b>
            <span className="muted">→</span>
            {Array.from({ length: opts }, (_, k) => k + 1).map((v) => (
              <button
                key={v}
                type="button"
                className={`choice ${cur[i] === v ? 'selected' : ''} ${show && answerKey?.pairs?.[i] === v ? 'correct-key' : ''}`}
                onClick={() => !disabled && set(i, v)}
                aria-label={`${q.no}번 (${i + 1}) ${v}번`}
              >
                <span className="num">{matchLabel(q, v)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (q.type === 'short' && q.blankCount > 1) {
    const vals = Array.isArray(value) ? value : [];
    const ord = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째'];
    const keyParts = show ? boxAlternatives(answerKey, q.blankCount).map((a) => a.join(' / ')) : [];
    return (
      <div className="stack" style={{ gap: 8 }}>
        <div className="small muted">□ 칸마다 순서대로 답을 쓰세요.</div>
        {Array.from({ length: q.blankCount }, (_, i) => (
          <label key={i} className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <span className="small" style={{ width: 56, flexShrink: 0, fontWeight: 600 }}>{ord[i]} 칸</span>
            <input
              type="text"
              value={vals[i] ?? ''}
              onChange={(e) => {
                const next = Array.from({ length: q.blankCount }, (_, j) => vals[j] ?? '');
                next[i] = e.target.value;
                onChange(next);
              }}
              placeholder={show ? keyParts[i] || '' : '답'}
              aria-label={`${q.no}번 ${ord[i]} 칸`}
              disabled={disabled}
            />
          </label>
        ))}
        {show && (
          <div className="key-box">
            <b>정답</b> {keyToText(q, answerKey)}
          </div>
        )}
      </div>
    );
  }
  const keyText = show
    ? q.type === 'essay'
      ? answerKey.examples?.length
        ? `(예) ${answerKey.examples.join(' / ')}`
        : answerKey.model
      : (answerKey.accepted || []).join(' / ')
    : '';
  return (
    <div>
      {q.type === 'essay' ? (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="답을 문장으로 써 주세요"
          rows={4}
          aria-label={`${q.no}번 답`}
          disabled={disabled}
        />
      ) : (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="답을 입력하세요"
          aria-label={`${q.no}번 답`}
          disabled={disabled}
        />
      )}
      {show && (
        <div className="key-box">
          <b>정답</b> {keyText || <span style={{ color: 'var(--bad)' }}>(정답 없음)</span>}
          {q.type === 'essay' && !answerKey.examples?.length && answerKey.keywords?.length > 0 && (
            <div className="small muted">핵심어: {answerKey.keywords.join(', ')}</div>
          )}
          {answerKey.open && <div className="small muted">예시와 다른 답은 선생님 확인으로 넘어갑니다.</div>}
        </div>
      )}
    </div>
  );
}

// ───────────── 채점된 시험지 ─────────────

// 손으로 그린 듯한 동그라미 (시작과 끝이 살짝 겹치고 삐뚤어짐)
function circlePath(cx, cy, r, seed) {
  const pts = [];
  const start = -1.9 + (seed % 5) * 0.1;
  for (let i = 0; i <= 40; i++) {
    const t = start + (i / 40) * Math.PI * 2.18;
    const wob = 1 + 0.05 * Math.sin(t * 3 + seed) + 0.03 * Math.cos(t * 5 + seed * 2);
    const rr = r * wob * (1 - (i / 40) * 0.06);
    pts.push(`${(cx + rr * 1.08 * Math.cos(t)).toFixed(1)},${(cy + rr * 0.92 * Math.sin(t)).toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
}

function slashPath(cx, cy, r, seed) {
  const bend = ((seed % 3) - 1) * 4;
  return `M${cx - r * 0.9},${cy + r * 1.25} Q${cx + bend},${cy + bend} ${cx + r * 1.5},${cy - r * 1.35}`;
}

/** 답 칸(□, ( )) 한가운데에 글자 크기를 칸에 맞춰 쓴다 */
function inSpot(sp, text, W, H, maxFs = 24) {
  const bw = (sp.x1 - sp.x0) * W - 6;
  const bh = (sp.bottom - sp.top) * H;
  let fs = maxFs;
  while (fs > 11 && (textWidth(text, fs) > bw || fs * 1.1 > bh + 6)) fs -= 1;
  const w = textWidth(text, fs);
  const h = fs * 1.1;
  return { x: ((sp.x0 + sp.x1) / 2) * W - w / 2, y: ((sp.top + sp.bottom) / 2) * H - h / 2, w, h, fs, text };
}

const grow = (b, up, down) => ({ x0: b.x0 - 6, y0: b.y0 - up, x1: b.x1 + 6, y1: b.y1 + down });

function placeLabels(exam, pages, grids, byNo, keys, answers, result, hideKeys) {
  const out = {}; // no -> {mine, key}, 'score' -> spot
  pages.forEach((_, pi) => {
    const page = pi + 1;
    const src = grids?.[pi];
    if (!src) return;
    const g = { ...src, occ: src.occ.slice() };
    const W = 1000;
    const H = W / aspectOf(exam, page);
    if (page === 1) {
      const text = `${result.score100}점`;
      const w = textWidth(text, 64);
      out.score = findSpot(g, { x: W - w / 2 - 30, y: 50 }, w, 70, { x0: W * 0.45, y0: 0, x1: W, y1: H * 0.25 })
        || { x: W - w - 30, y: 4, w, h: 70 };
      occupy(g, out.score);
    }
    const qs = exam.questions.filter((q) => q.anchor && q.anchor.page === page);
    // 채점 표시(동그라미·빗금) 자리는 먼저 비워 둔다
    for (const q of qs) {
      const a = q.anchor;
      const lh = Math.max(14, (a.bottom - a.top) * H);
      const cx = a.x * W + lh * 0.45;
      const cy = ((a.top + a.bottom) / 2) * H;
      occupy(g, { x: cx - lh * 1.3, y: cy - lh * 1.3, w: lh * 2.6, h: lh * 2.6 });
    }
    for (const q of qs) {
      const it = byNo[q.no];
      if (!it) continue;
      const a = q.anchor;
      const lh = Math.max(14, (a.bottom - a.top) * H);
      const regs = (q.regions || []).filter((r) => r.page === page);
      const box = regs.length
        ? {
            x0: Math.min(...regs.map((r) => r.x0)) * W,
            y0: Math.min(...regs.map((r) => r.y0)) * H,
            x1: Math.max(...regs.map((r) => r.x1)) * W,
            y1: Math.max(...regs.map((r) => r.y1)) * H,
          }
        : { x0: 0, y0: a.top * H - lh, x1: W, y1: a.bottom * H + lh * 8 };
      const res = {};
      const pageBlanks = (q.blanks || []).filter((b) => b.page === page);
      const sel = Array.isArray(answers?.[q.no]) ? answers[q.no] : [];
      // "( ) ( )" 중 하나에 ○표 하는 문제: 고른 칸에 ○를 쓴다
      const oxBlanks = q.type === 'mc' && q.choiceCount >= 2 && pageBlanks.length === q.choiceCount;
      if (oxBlanks && sel.length) {
        const b = pageBlanks[sel[0] - 1];
        if (b) {
          const fs = 28;
          const w = textWidth('○', fs);
          const h = fs * 1.15;
          const c = { x: ((b.x0 + b.x1) / 2) * W, y: ((b.top + b.bottom) / 2) * H };
          const spot = findSpot(g, c, w, h, { x0: b.x0 * W - 10, y0: b.top * H - 12, x1: b.x1 * W + 10, y1: b.bottom * H + 12 })
            || { x: c.x - w / 2, y: c.y - h / 2, w, h };
          occupy(g, spot);
          res.mine = { ...spot, text: '○', fs };
        }
      }
      // 칸이 여러 개인 답: 칸마다 제자리에
      const ans = answers?.[q.no];
      const spots = (q.answerSpots || []).filter((sp) => sp.page === page);
      if (Array.isArray(ans) && q.type === 'short' && spots.length && spots.length === ans.length) {
        res.multi = [];
        ans.forEach((v, i) => {
          const text = String(v ?? '').trim();
          if (!text) return;
          const spot = inSpot(spots[i], text, W, H, 22);
          occupy(g, spot);
          res.multi.push(spot);
          if (!res.mine) res.mine = { ...spot, text: '' };
        });
      }
      const mineText = oxBlanks || q.type === 'draw' || res.multi ? '' : answerToText(q, answers?.[q.no]);
      if (mineText) {
        const text = mineText.length > 22 ? `${mineText.slice(0, 22)}…` : mineText;
        const fs = 24;
        const w = textWidth(text, fs);
        const h = fs * 1.15;
        const blank = pageBlanks[0];
        const box1 = spots.length === 1 && spots[0].kind === 'box' ? spots[0] : null;
        let spot = null;
        if (box1) {
          spot = inSpot(box1, text, W, H, fs);
        } else if (blank) {
          const c = { x: ((blank.x0 + blank.x1) / 2) * W, y: ((blank.top + blank.bottom) / 2) * H };
          spot = findSpot(g, c, w, h, { x0: blank.x0 * W - 30, y0: blank.top * H - 16, x1: blank.x1 * W + 30, y1: blank.bottom * H + 16 });
          if (!spot) spot = findSpot(g, c, w, h, box);
        } else {
          // 답 칸이 없으면 문항 첫 줄 오른쪽 끝 근처의 빈 곳
          spot = findSpot(g, { x: box.x1 - w / 2 - 10, y: ((a.top + a.bottom) / 2) * H }, w, h, grow(box, 40, 70));
        }
        if (!spot) spot = findSpot(g, { x: box.x1 - w / 2, y: box.y1 }, w, h, grow(box, 60, 160));
        if (!spot) spot = { x: Math.max(0, box.x1 - w - 10), y: a.top * H, w, h, overlap: true };
        occupy(g, spot);
        res.mine = { fs, ...spot, text };
      }
      if (it.status === 'review') {
        const text = '선생님 확인 중';
        const fs = 22;
        const w = textWidth(text, fs);
        const h = fs * 1.15;
        const near = res.mine
          ? { x: res.mine.x + res.mine.w + w / 2 + 8, y: res.mine.y + res.mine.h / 2 }
          : { x: box.x1 - w / 2 - 20, y: a.bottom * H + lh };
        const spot = findSpot(g, near, w, h, grow(box, 40, 70))
          || findSpot(g, near, w, h, grow(box, 60, 160))
          || { x: box.x1 - w - 10, y: a.top * H - h, w, h, overlap: true };
        occupy(g, spot);
        res.review = { ...spot, text, fs };
      }
      const keyShort = shortKeyText(q, keys[q.no]);
      if (!hideKeys && it.status === 'wrong' && keyShort && !(q.manual && keyShort.startsWith('('))) {
        const text = `정답: ${keyShort}`;
        const fs = 26;
        const w = textWidth(text, fs);
        const h = fs * 1.15;
        const near = res.mine
          ? { x: res.mine.x + res.mine.w + w / 2 + 8, y: res.mine.y + res.mine.h / 2 }
          : { x: box.x1 - w / 2 - 20, y: a.bottom * H + lh };
        let spot = findSpot(g, near, w, h, grow(box, 40, 70)) || findSpot(g, near, w, h, grow(box, 60, 160));
        if (!spot) spot = { x: Math.max(0, box.x1 - w - 10), y: (res.mine ? res.mine.y + res.mine.h : a.bottom * H), w, h, overlap: true };
        occupy(g, spot);
        res.key = { ...spot, text, fs };
      }
      out[q.no] = res;
    }
  });
  return out;
}

/**
 * @param {{exam, pages:string[], keys, answers, result, hideKeys?:boolean}} props  result = gradeSubmission(...)
 *   hideKeys: 틀린 문제에 정답을 써 주지 않음 (학생 화면)
 */
export function GradedPaper({ exam, pages, keys, answers, result, hideKeys = false }) {
  const byNo = Object.fromEntries(result.items.map((it) => [it.no, it]));
  const [grids, setGrids] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.all(pages.map((src, i) => buildGrid(src, 1000, 1000 / aspectOf(exam, i + 1)).catch(() => null))).then((g) => {
      if (alive) setGrids(g);
    });
    return () => {
      alive = false;
    };
  }, [pages, exam]);
  const labels = useMemo(
    () => (grids ? placeLabels(exam, pages, grids, byNo, keys, answers, result, hideKeys) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grids, exam, pages, keys, answers, result, hideKeys],
  );
  return (
    <div className="graded">
      {pages.map((src, pi) => {
        const page = pi + 1;
        const aspect = aspectOf(exam, page);
        const W = 1000;
        const H = W / aspect;
        const qs = exam.questions.filter((q) => q.anchor && q.anchor.page === page);
        return (
          <div className="graded-page" key={pi}>
            <img src={src} alt={`${page}쪽`} />
            <svg viewBox={`0 0 ${W} ${H}`} className="marks" aria-hidden="true">
              <defs>
                <filter id="pencil" x="-5%" y="-5%" width="110%" height="110%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
                  <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" />
                </filter>
              </defs>
              {page === 1 && labels.score && (
                <g className="score-mark" filter="url(#pencil)">
                  <text x={labels.score.x + 6} y={labels.score.y + 54} className="hand red" fontSize="64">
                    {result.score100}점
                  </text>
                  <path
                    d={`M${labels.score.x},${labels.score.y + 64} Q${labels.score.x + labels.score.w / 2},${labels.score.y + 72} ${labels.score.x + labels.score.w},${labels.score.y + 62}`}
                    className="stroke red"
                    strokeWidth="4"
                    fill="none"
                  />
                </g>
              )}
              {/* 학생이 그린 그림 */}
              {exam.questions.map((q) => {
                const strokes = answers?.[q.no]?.strokes;
                if (!strokes?.length) return null;
                const { question } = regionsOf(exam, q);
                if (!question.some((r) => r.page === page)) return null;
                const toPage = stackToPage(question, (pg) => aspectOf(exam, pg), W, (pg) => W / aspectOf(exam, pg));
                return (
                  <g key={`d${q.no}`}>
                    {strokes.map((st, i) => {
                      const m0 = toPage(st.p[0], st.p[1]);
                      if (!m0 || m0.page !== page) return null;
                      return (
                        <StrokeShape
                          key={i}
                          s={st}
                          map={(x, y) => {
                            const m = toPage(x, y);
                            return [m.X, m.Y];
                          }}
                          scale={m0.scale}
                          color="#3b4a6b"
                          width={2.6}
                        />
                      );
                    })}
                  </g>
                );
              })}
              {qs.map((q) => {
                const it = byNo[q.no];
                if (!it) return null;
                const a = q.anchor;
                const lh = Math.max(14, (a.bottom - a.top) * H);
                const cx = a.x * W + lh * 0.45;
                const cy = ((a.top + a.bottom) / 2) * H;
                const r = lh * 1.05;
                const lab = labels[q.no] || {};
                return (
                  <g key={q.no}>
                    {it.status === 'correct' && (
                      <path d={circlePath(cx, cy, r, q.no)} className="stroke red" strokeWidth="4.5" filter="url(#pencil)" />
                    )}
                    {it.status === 'wrong' && (
                      <path d={slashPath(cx, cy, r, q.no)} className="stroke red" strokeWidth="5" filter="url(#pencil)" />
                    )}
                    {it.status === 'review' && (
                      <>
                        <rect x={cx - r * 1.2} y={cy - lh * 0.7} width={r * 2.4} height={lh * 1.4} rx="4" className="highlight" />
                        {lab.review && (
                          <text x={lab.review.x + 3} y={lab.review.y + lab.review.h * 0.8} className={`hand orange ${lab.review.overlap ? 'halo' : ''}`} fontSize={lab.review.fs}>
                            {lab.review.text}
                          </text>
                        )}
                      </>
                    )}
                    {(lab.multi || []).map((m, i) => (
                      <text key={i} x={m.x + 3} y={m.y + m.h * 0.8} className={`hand blue ${m.overlap ? 'halo' : ''}`} fontSize={m.fs}>
                        {m.text}
                      </text>
                    ))}
                    {lab.mine?.text && (
                      <text x={lab.mine.x + 3} y={lab.mine.y + lab.mine.h * 0.8} className={`hand blue ${lab.mine.overlap ? 'halo' : ''}`} fontSize={lab.mine.fs}>
                        {lab.mine.text}
                      </text>
                    )}
                    {lab.key && (
                      <text
                        x={lab.key.x + 3}
                        y={lab.key.y + lab.key.h * 0.8}
                        className={`hand red ${lab.key.overlap ? 'halo' : ''}`}
                        fontSize={lab.key.fs}
                        filter="url(#pencil)"
                      >
                        {lab.key.text}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        );
      })}
    </div>
  );
}
