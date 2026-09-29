// 문항 화면 공통 부품
//  - QuestionView: 문제지에서 지문 + 문항 부분만 잘라서 보여줌
//  - AnswerInput:  학생이 답을 입력하는 칸 (객관식/선 잇기/단답형/서술형), 정답 표시 모드 지원
//  - GradedPaper:  제출 후 문제지 전체에 빨간 색연필로 채점 표시
import { useLayoutEffect, useState } from 'react';
import { choiceLabel } from '../lib/parseQuestions.js';
import { matchLabel, shortKeyText, answerToText } from '../lib/format.js';

const A4 = 210 / 297;
const aspectOf = (exam, page) => exam?.pageAspects?.[page - 1] || A4;

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
            <Regions exam={exam} pages={pages} regions={sec.regions} />
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
  if (q.type === 'mc') {
    const n = q.choiceCount || 5;
    const sel = Array.isArray(value) ? value : [];
    const keySet = new Set(answerKey?.choices || []);
    // 문항 이미지가 있으면 보기 글은 이미지로 보고, 버튼은 기호만 (PDF에서 뽑은 글은 띄어쓰기가 틀릴 수 있음)
    const hasText = !q.regions?.length && q.choices?.length === n && q.choices.some((c) => c);
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
            <span className="num">{choiceLabel(q, k)}</span>
            {hasText && <span>{q.choices[k - 1]}</span>}
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

/**
 * @param {{exam, pages:string[], keys, answers, result}} props  result = gradeSubmission(...)
 */
export function GradedPaper({ exam, pages, keys, answers, result }) {
  const byNo = Object.fromEntries(result.items.map((it) => [it.no, it]));
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
              {page === 1 && (
                <g className="score-mark" filter="url(#pencil)">
                  <text x={W - 40} y={70} textAnchor="end" className="hand red" fontSize="64">
                    {result.score100}점
                  </text>
                  <path d={`M${W - 250},86 Q${W - 140},${96} ${W - 36},82`} className="stroke red" strokeWidth="4" fill="none" />
                </g>
              )}
              {qs.map((q) => {
                const it = byNo[q.no];
                if (!it) return null;
                const a = q.anchor;
                const lh = Math.max(14, (a.bottom - a.top) * H);
                const cx = a.x * W + lh * 0.45;
                const cy = ((a.top + a.bottom) / 2) * H;
                const r = lh * 1.05;
                const rightX = Math.min(W - 16, (a.colX1 || 0.95) * W);
                const mine = answerToText(q, answers?.[q.no]);
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
                        <text x={cx + r * 1.4} y={cy - lh * 0.9} className="hand orange" fontSize="22">선생님 확인 중</text>
                      </>
                    )}
                    {mine && (
                      <text x={rightX} y={cy + lh * 0.1} textAnchor="end" className="hand blue halo" fontSize="24">
                        내 답: {mine.length > 22 ? `${mine.slice(0, 22)}…` : mine}
                      </text>
                    )}
                    {it.status === 'wrong' && (
                      <text x={rightX} y={cy + lh * 1.35} textAnchor="end" className="hand red halo" fontSize="27" filter="url(#pencil)">
                        정답: {shortKeyText(q, keys[q.no])}
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
