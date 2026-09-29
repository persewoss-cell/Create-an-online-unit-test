// 문제지 텍스트에서 문항을 규칙 기반으로 찾아낸다.
// 과목마다 번호 양식(1. / 1) / 1번 / 문제 1 / [1] / Q1 …)과 보기 양식(①~⑤, (1)~(5))이 달라도
// 번호가 1부터 차례대로 증가한다는 점을 이용해 문항 경계를 잡는다.

import { circledToNumber } from './korean.js';

const START_PATTERNS = [
  /^\s*(\d{1,2})\s*[.．。](?!\d)\s*/,
  /^\s*(\d{1,2})\s*\)\s*/,
  /^\s*(\d{1,2})\s*번\s*[.):]?\s*/,
  /^\s*문제\s*(\d{1,2})\s*[.):]?\s*/,
  /^\s*문항\s*(\d{1,2})\s*[.):]?\s*/,
  /^\s*[[【〔<](\d{1,2})[\]】〕>]\s*/,
  /^\s*[Qq]\s*(\d{1,2})\s*[.):]?\s*/,
];
// 번호 뒤에 구두점 없이 바로 문장이 오는 양식 ("1 다음 중 …") — 가장 마지막에 시도
// (번호 다음 글자는 한글·영문뿐 아니라 ㉠, ‘, “ 같은 기호도 올 수 있다)
const LOOSE_START = /^\s*(\d{1,2})\s+(?=[^\d\s.,:;)\]~\-−–·])/;

export function matchQuestionStart(text, allowLoose = true) {
  for (const re of START_PATTERNS) {
    const m = text.match(re);
    if (m) return { no: Number(m[1]), rest: text.slice(m[0].length) };
  }
  if (allowLoose) {
    const m = text.match(LOOSE_START);
    if (m) return { no: Number(m[1]), rest: text.slice(m[0].length), loose: true };
  }
  return null;
}

const MULTI_RE = /모두\s*고르|두\s*개를?\s*고르|2\s*개를?\s*고르|세\s*개를?\s*고르|3\s*개를?\s*고르|두\s*가지를?\s*고르|모두\s*찾/;
const ESSAY_RE = /서술|논술|설명하(?:시오|세요|여라|여\s*쓰)|설명해\s*보|(?:이유|까닭|과정|방법|근거|생각|차이점|공통점)[^?\n]{0,20}(?:쓰시오|쓰세요|써\s*보|적으시오|적어\s*보|설명)/;
const POINTS_RE = /[[(（]\s*(\d+(?:\.\d+)?)\s*점\s*[\])）]/;

export const HANGUL_CIRCLED = '㉮㉯㉰㉱㉲㉳㉴㉵㉶㉷';

/** 보기 기호 목록. 기본은 ①②③…, ㉮㉯㉰ 보기나 (1)(2)(3) 보기는 그 기호를 그대로 쓴다 */
export function choiceLabel(q, n) {
  return q?.choiceLabels?.[n - 1] || '①②③④⑤⑥⑦⑧⑨⑩'[n - 1] || String(n);
}

/** 문항 본문에서 보기(①②…, ㉮㉯㉰…, (1)(2)…)를 분리 */
export function extractChoices(text) {
  let labels = null;
  const circ = [...text.matchAll(/[①-⑩]/g)].map((m) => ({ n: circledToNumber(m[0]), i: m.index, len: 1 }));
  let marks = pickSequential(circ);
  if (marks.length < 2) {
    const hc = [...text.matchAll(/[㉮-㉷]/g)].map((m) => ({ n: HANGUL_CIRCLED.indexOf(m[0]) + 1, i: m.index, len: 1 }));
    marks = pickSequential(hc);
    if (marks.length >= 2) labels = marks.map((mk) => HANGUL_CIRCLED[mk.n - 1]);
  }
  if (marks.length < 2) {
    const paren = [...text.matchAll(/\((\d{1,2})\)/g)].map((m) => ({ n: Number(m[1]), i: m.index, len: m[0].length }));
    const seq = pickSequential(paren);
    marks = seq.length >= 3 ? seq : [];
    if (marks.length) labels = marks.map((mk) => `(${mk.n})`);
  }
  if (marks.length < 2) return { stem: text.trim(), choices: [], labels: null };
  const stem = text.slice(0, marks[0].i).trim();
  const choices = marks.map((mk, k) => {
    const end = k + 1 < marks.length ? marks[k + 1].i : text.length;
    let t = text.slice(mk.i + mk.len, end);
    if (k === marks.length - 1) t = t.trim().split('\n')[0];
    t = t.replace(/\s+/g, ' ').trim();
    t = t.replace(/[⩔∨]/g, '').replace(/\(\s*\)\s*$/, '').trim();
    return t.length > 80 ? t.slice(0, 80) + '…' : t;
  });
  return { stem, choices, labels };
}

// 1,2,3… 순서로 이어지는 표시만 고른다
function pickSequential(marks) {
  const out = [];
  let expect = 1;
  for (const m of marks) {
    if (m.n === expect) {
      out.push(m);
      expect++;
    }
  }
  return out;
}

export function analyzeQuestion(no, text, page) {
  const body = text.trim();
  const { stem, choices, labels } = extractChoices(body);
  const pm = body.match(POINTS_RE);
  let type = 'short';
  if (choices.length >= 2) type = 'mc';
  else if (ESSAY_RE.test(body)) type = 'essay';
  const firstLine = stem
    .replace(new RegExp(POINTS_RE.source, 'g'), '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/[·•…]{3,}.*$/, '') // 답 칸 앞의 점선
    .replace(/\(\s*\)/g, '')
    .trim();
  return {
    no,
    page,
    type,
    choiceCount: type === 'mc' ? choices.length : 0,
    choices: type === 'mc' ? choices : [],
    choiceLabels: type === 'mc' && labels ? labels : null,
    multi: type === 'mc' && MULTI_RE.test(stem),
    points: pm ? Number(pm[1]) : null,
    text: firstLine.length > 200 ? firstLine.slice(0, 200) + '…' : firstLine,
  };
}

const GROUP_RE = /[(\[]\s*(\d{1,2})\s*[~∼～\-–]\s*(\d{1,2})\s*[)\]]/;
const HEADER_JUNK_RE = /이름\s*[:：]|학년.*반.*번|초등학교|^\s*\d{1,3}\s*$/;

/** "※ 다음 글을 읽고 물음에 답하시오. (1~4)" 같은 지문 안내 줄 */
export function matchGroupHeader(text) {
  if (!/※|물음에|답하시오|답하세요|보고|읽고/.test(text)) return null;
  const m = text.match(GROUP_RE);
  if (!m) return null;
  const from = Number(m[1]);
  const to = Number(m[2]);
  return to > from ? { from, to } : null;
}

/**
 * @param {{page:number, lines:(string|{text:string,x0:number,x1:number,top:number,bottom:number,col:number})[]}[]} pages
 * @returns {{questions: object[], groups: object[], warnings: string[]}}
 */
export function parseQuestions(pages) {
  const lines = pages.flatMap((p) =>
    p.lines.map((l) => {
      const o = typeof l === 'string' ? { text: l } : l;
      return { ...o, text: o.text.replace(/\t/g, ' '), page: p.page };
    }),
  );
  const warnings = [];
  const anchors = []; // {kind:'q'|'group', idx, ...}
  let expected = 1;
  lines.forEach((line, idx) => {
    const g = matchGroupHeader(line.text);
    if (g && g.from >= expected - 1) {
      anchors.push({ kind: 'group', idx, ...g });
      return;
    }
    const m = matchQuestionStart(line.text);
    if (!m || (m.loose && (looksLikeTableRow(line.text) || !m.rest.trim()))) return;
    const exact = m.no === expected;
    // 번호 하나를 놓쳤더라도 뒤 문항은 계속 찾는다 (확실한 양식이거나 지문 안내 범위 안의 번호일 때)
    const skip = !exact && m.no > expected && m.no <= expected + 2 && (!m.loose || inGroupRange(anchors, m.no));
    if (!exact && !skip) return;
    if (skip) warnings.push(`${expected}${m.no - expected > 1 ? `~${m.no - 1}` : ''}번 문항 번호를 찾지 못했습니다. 확인해 주세요.`);
    anchors.push({ kind: 'q', idx, no: m.no, rest: m.rest });
    expected = m.no + 1;
  });

  const layout = pageLayout(lines);
  const hasPos = lines.some((l) => l.top != null);
  const groups = [];
  const questions = [];
  anchors.forEach((a, k) => {
    const end = k + 1 < anchors.length ? anchors[k + 1].idx : lines.length;
    const seg = lines.slice(a.idx, end);
    const regions = hasPos ? regionsFor(seg, lines[end], layout) : [];
    if (a.kind === 'group') {
      groups.push({ id: `g${a.from}`, from: a.from, to: a.to, regions });
      return;
    }
    const body = seg.slice(1).filter((l) => !/^\s*-?\s*\d{1,3}\s*-?\s*$/.test(l.text)); // 쪽 번호 제외
    const text = [a.rest, ...body.map((l) => l.text)].join('\n');
    const q = analyzeQuestion(a.no, text, lines[a.idx].page);
    const grp = groups.find((g) => a.no >= g.from && a.no <= g.to);
    const first = lines[a.idx];
    questions.push({
      ...q,
      group: grp ? grp.id : null,
      regions,
      anchor: hasPos ? { page: first.page, x: first.x0, top: first.top, bottom: first.bottom, colX1: layout.colBounds(first).x1 } : null,
    });
  });

  const textLen = lines.reduce((s, l) => s + l.text.length, 0);
  if (!lines.length || textLen < 20) {
    warnings.push('문제지에서 글자를 읽을 수 없습니다(스캔 이미지 PDF일 수 있음). 문항 수를 직접 입력해 주세요.');
  } else if (!questions.length) {
    warnings.push('문항 번호를 찾지 못했습니다. 문항 수를 직접 입력하거나 문항을 추가해 주세요.');
  }
  return { questions, groups, warnings };
}

function inGroupRange(anchors, no) {
  return anchors.some((a) => a.kind === 'group' && no >= a.from && no <= a.to);
}

/** 페이지·단별 가로 범위와 쪽 번호(바닥글) 위치 */
function pageLayout(lines) {
  const cols = new Map();
  const footer = new Map();
  for (const l of lines) {
    if (l.top == null) continue;
    if (/^\s*-?\s*\d{1,3}\s*-?\s*$/.test(l.text) && l.top > 0.88) {
      footer.set(l.page, Math.min(footer.get(l.page) ?? 1, l.top));
      continue;
    }
    const key = `${l.page}:${l.col}`;
    const c = cols.get(key) || { x0: 1, x1: 0 };
    c.x0 = Math.min(c.x0, l.x0);
    c.x1 = Math.max(c.x1, l.x1);
    cols.set(key, c);
  }
  // 2단 페이지: 왼쪽 단은 오른쪽 단이 시작하는 곳에서 자른다 (가로로 긴 제목 때문에 넓어지지 않게)
  for (const [key, c] of cols) {
    const [page, col] = key.split(':');
    const right = cols.get(`${page}:1`);
    if (col === '0' && right) {
      const starts = lines.filter((l) => String(l.page) === page && l.col === 1 && l.x0 != null).map((l) => l.x0);
      const rightStart = Math.min(...starts);
      c.x1 = Math.min(c.x1, rightStart - 0.02);
      right.x0 = Math.min(right.x0, rightStart - 0.005);
    }
  }
  return {
    colBounds: (l) => cols.get(`${l.page}:${l.col}`) || { x0: 0, x1: 1 },
    bottom: (page) => Math.min(footer.get(page) ?? 0.97, 0.97),
  };
}

/** 문항(또는 지문) 범위의 줄들을 페이지·단별 사각형 영역으로 바꾼다 */
function regionsFor(seg, nextLine, layout) {
  const parts = [];
  for (const l of seg) {
    if (l.top == null) continue;
    const last = parts[parts.length - 1];
    if (last && last.page === l.page && last.col === l.col) last.lines.push(l);
    else parts.push({ page: l.page, col: l.col, lines: [l] });
  }
  const PAD = 0.008;
  return parts
    .filter((p, i) => i === 0 || p.lines.some((l) => l.text.replace(/\s/g, '').length >= 8 && !HEADER_JUNK_RE.test(l.text)))
    .map((p) => {
      const cb = layout.colBounds(p.lines[0]);
      const lines = p.lines.filter((l) => !HEADER_JUNK_RE.test(l.text) || p.lines.length === 1);
      const top = Math.min(...(lines.length ? lines : p.lines).map((l) => l.top));
      const sameCol = nextLine && nextLine.top != null && nextLine.page === p.page && nextLine.col === p.col;
      const bottom = sameCol ? nextLine.top - PAD : layout.bottom(p.page);
      return {
        page: p.page,
        x0: Math.max(0, cb.x0 - PAD * 2),
        x1: Math.min(1, cb.x1 + PAD * 2),
        y0: Math.max(0, top - PAD),
        y1: Math.max(top + 0.02, Math.min(1, bottom)),
      };
    });
}

function looksLikeTableRow(text) {
  return /^[\d\s]+$/.test(text.trim());
}

/** 배점이 없는 문항에 나머지 점수를 고르게 나눠준다 (총점 100 기준) */
export function fillDefaultPoints(questions, total = 100) {
  const fixed = questions.filter((q) => q.points != null && q.points > 0);
  const free = questions.filter((q) => !(q.points != null && q.points > 0));
  if (!free.length) return questions;
  const used = fixed.reduce((s, q) => s + q.points, 0);
  const remain = Math.max(total - used, free.length);
  const each = Math.floor((remain / free.length) * 10) / 10;
  const lastFree = free[free.length - 1];
  const last = Math.round((remain - each * (free.length - 1)) * 10) / 10; // 마지막 문항이 나머지를 받아 총점을 맞춘다
  return questions.map((q) => {
    if (q.points != null && q.points > 0) return q;
    return { ...q, points: q === lastFree ? last : each };
  });
}
