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
const ESSAY_RE = /서술하|서술해|논술하|풀이\s*과정|설명하(?:시오|세요|여라|여\s*쓰)|설명해\s*보|(?:이유|까닭|과정|방법|근거|생각|차이점|공통점)[^?\n]{0,20}(?:쓰시오|쓰세요|써\s*보|적으시오|적어\s*보|설명)/;
const POINTS_RE = /[[(（]\s*(\d+(?:\.\d+)?)\s*점\s*[\])）]/;

export const HANGUL_CIRCLED = '㉮㉯㉰㉱㉲㉳㉴㉵㉶㉷';
export const KOREAN_CIRCLED = '㉠㉡㉢㉣㉤㉥㉦㉧㉨㉩';

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
    // ㉠㉡㉢ 보기는 지문 속 표시(㉠을…)와 헷갈리지 않도록 줄 맨 앞에 있을 때만
    const kc = [...text.matchAll(/(^|\n)\s*([㉠-㉭])/g)].map((m) => ({
      n: KOREAN_CIRCLED.indexOf(m[2]) + 1, i: m.index + m[0].length - 1, len: 1,
    }));
    const seq = pickSequential(kc);
    if (seq.length >= 2) {
      marks = seq;
      labels = seq.map((mk) => KOREAN_CIRCLED[mk.n - 1]);
    }
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

const SECTION_LABEL_RE = /^[\s❙|｜▎■□◆◇【\[]*(서술형|단답형|객관식|주관식|논술형)[\s❙|｜▎■□◆◇】\]]*$/;

export function analyzeQuestion(no, text, page) {
  // "❙서술형❙" 같은 다음 문항의 머리표는 이 문항 내용이 아니다
  const body = text
    .split('\n')
    .filter((l) => !SECTION_LABEL_RE.test(l))
    .join('\n')
    .trim();
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

// ── 문제지를 보고 "답을 어떻게 쓰는 문항인지" 판단 ──
// 그리기: "그려 보세요", "그어 보고", "표시해 보세요", "색칠하세요" …  (선 잇기 "선으로 이으시오"는 제외)
const DRAW_RE = /그려\s*(?:보|넣|주|라|야)|그리(?:시오|세요|십시오)|그어\s*(?:보|주|라)|그으(?:시오|세요)|표시(?:해\s*보|하시오|하세요)|색칠|나타내어\s*보|이어\s*(?:보세요|그리)/;
const OX_RE = /○\s*표|○를|○\s*하|동그라미/;
const FILL_RE = /써\s*넣|빈\s*칸|□|안에\s*알맞은/;

/** "( ) ( )" 칸들의 이름: 같은 줄이면 왼쪽/오른쪽, 세로로 놓이면 위/아래, 그 밖엔 첫째/둘째… */
export function blankLabels(blanks) {
  const n = blanks.length;
  const sameRow = blanks.every((b) => Math.abs(b.top - blanks[0].top) < 0.012 && b.page === blanks[0].page);
  const sameCol = blanks.every((b) => Math.abs(b.x0 - blanks[0].x0) < 0.03 && b.page === blanks[0].page);
  if (sameRow && n === 2) return ['왼쪽', '오른쪽'];
  if (sameRow && n === 3) return ['왼쪽', '가운데', '오른쪽'];
  if (sameCol && n === 2) return ['위', '아래'];
  if (sameCol && n === 3) return ['위', '가운데', '아래'];
  const ord = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째'];
  return blanks.map((_, i) => ord[i] || `${i + 1}번째`);
}

// "( ) 안에", "( )에 들어갈" 처럼 문제 글이 가리키기만 하는 괄호 (답 칸이 아님)
const REF_PAREN_RE = /\(\s*\)\s*(?:안에|속에|에\s*(?:들어갈|알맞은|공통|넣|쓸|써))/g;
// 답 칸만 있는 줄에서 괄호 말고 남아도 되는 것: 기호·번호·단위
const ALONE_JUNK_RE = /\(\s*\)|[\s:：.,]|[㉠-㉭㉮-㉷①-⑩]|\(\d\)|답|cm|mm|km|m|kg|g|L|mL|개|명|번|원|도|°|쪽|장|권|자루|마리|분|초|시간|살|배|층|칸/g;

/**
 * 문항 안 "( )" 중 학생이 답을 쓰는 칸만 고른다.
 *  - 문제 글이 가리키는 괄호("( ) 안에 들어갈 말")는 답 칸이 아니다.
 *  - 답만 쓰는 따로 떨어진 "( )" 줄이 있으면 그것만 답 칸이다 (지문·보기 속 괄호는 빈칸 표시일 뿐).
 *  - "공통으로 들어갈 말"은 괄호가 여러 개여도 답은 하나.
 * @returns {{blanks: object[], common: boolean}}
 */
export function pickAnswerBlanks(seg, text) {
  const all = [];
  for (const l of seg) {
    const bl = l.blanks || [];
    if (!bl.length) continue;
    const t = l.text || '';
    const lineAlone = t.replace(ALONE_JUNK_RE, '').length <= 2;
    // 줄 안의 괄호 차례대로: 가리키는 괄호인지, 문장 끝에 붙은 답 칸인지 표시
    const parens = [...t.matchAll(/\(\s*\)/g)].map((m) => ({ at: m.index, end: m.index + m[0].length }));
    const refs = new Set([...t.matchAll(REF_PAREN_RE)].map((m) => m.index));
    const known = parens.length === bl.length;
    bl.forEach((b, i) => {
      const pr = known ? parens[i] : null;
      const isRef = !lineAlone && !!pr && refs.has(pr.at);
      // "…있다. (   )" 처럼 문장이 끝난 뒤 줄 끝에 있는 괄호도 답 칸
      const trailing = !!pr && !t.slice(pr.end).replace(ALONE_JUNK_RE, '') && /[.?!다요]\s*$|\t\s*$/.test(t.slice(0, pr.at));
      all.push({ page: l.page, x0: b.x0, x1: b.x1, top: l.top, bottom: l.bottom, alone: lineAlone || trailing, isRef });
    });
  }
  const strip = ({ alone, isRef, ...b }) => b;
  const common = /공통(?:으로|적으로)?\s*(?:들어갈|알맞은|쓸)/.test(text);
  const alone = all.filter((b) => b.alone);
  if (alone.length) return { blanks: alone.map(strip), common, info: all };
  const inText = all.filter((b) => !b.isRef);
  return { blanks: inText.map(strip), common, info: all };
}

export function inferAnswerFormat(q, text, blanks) {
  const out = { ...q };
  // 그림 아래 "( ) ( )" 중 하나에 ○표 → 칸을 고르는 객관식 (왼쪽/오른쪽)
  if (out.type !== 'mc' && blanks.length >= 2 && blanks.length <= 8 && OX_RE.test(text)) {
    out.type = 'mc';
    out.choiceCount = blanks.length;
    out.choiceLabels = blankLabels(blanks);
    out.choices = [];
    out.multi = /모두/.test(text);
    out.oxBlanks = true;
    return out;
  }
  if (out.type !== 'mc' && out.type !== 'match' && DRAW_RE.test(text) && !/선으로\s*이으/.test(text)) {
    out.draw = true;
    // 답 칸도 없고 써넣는 칸도 없으면 그림만 그리는 문항
    if (!blanks.length && !FILL_RE.test(text)) out.type = 'draw';
    else if (out.type === 'essay') out.type = 'short';
  }
  if (out.type !== 'mc' && FILL_RE.test(text)) out.fillBoxes = true;
  // "두 가지를 쓰시오", "세 개 찾아 쓰세요" → 답 칸을 그 수만큼
  const cm = text.match(/(두|세|네|다섯|2|3|4|5)\s*(?:가지|개|곳|군데)(?:를|을|씩)?\s*(?:찾아\s*)?(?:쓰|적|써)/);
  if (cm && (out.type === 'short' || out.type === 'essay') && !out.draw) {
    const n = { 두: 2, 세: 3, 네: 4, 다섯: 5 }[cm[1]] || Number(cm[1]);
    if (n >= 2) {
      out.type = 'short';
      out.blankCount = n;
    }
  }
  // "풀이 과정을 쓰고 답을 구해 보세요" → 서술형, 풀이는 선생님이 채점
  if (/풀이\s*과정/.test(text)) {
    out.type = 'essay';
    out.manual = true;
  }
  return out;
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
  // 여러 쪽에 똑같이 반복되는 머리글(예: "수학 3-2 단원 평가 2. 원")은 문항에서 뺀다
  const topTexts = new Map();
  for (const l of lines) {
    if (l.top != null && l.top < 0.1) {
      const key = l.text.replace(/\s/g, '');
      if (!topTexts.has(key)) topTexts.set(key, new Set());
      topTexts.get(key).add(l.page);
    }
  }
  const repeated = new Set([...topTexts].filter(([, pages]) => pages.size >= 2).map(([k]) => k));
  if (repeated.size) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].top < 0.1 && repeated.has(lines[i].text.replace(/\s/g, ''))) lines.splice(i, 1);
    }
  }

  // 번호를 엄격하게(1,2,3… 차례로) 찾은 결과와 건너뛰기를 허용한 결과 중 더 많이 찾은 쪽을 쓴다.
  // (쪽 머리글의 "2. 원" 같은 단원 제목을 2번 문항으로 착각하지 않도록)
  const strict = findAnchors(lines, false);
  const loose = findAnchors(lines, true);
  const { anchors, warnings } = loose.count > strict.count ? loose : strict;

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
    const { blanks, common, info } = hasPos ? pickAnswerBlanks(seg, text) : { blanks: [], common: false, info: [] };
    questions.push({
      ...inferAnswerFormat(q, text, blanks),
      ...(common ? { commonBlank: true } : {}),
      // "답안 유형 다시 인식하기"에 쓰는 원본 정보: 문항 전체 글과 모든 괄호 칸
      fullText: text.length > 1500 ? text.slice(0, 1500) : text,
      blankInfo: info,
      group: grp ? grp.id : null,
      regions,
      anchor: hasPos ? { page: first.page, x: first.x0, top: first.top, bottom: first.bottom, colX1: layout.colBounds(first).x1 } : null,
      // 답을 쓰는 "(   )" 칸 위치 (채점된 시험지에 학생 답을 적을 자리)
      blanks,
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

function findAnchors(lines, allowSkip) {
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
    const skip = allowSkip && !exact && m.no > expected && m.no <= expected + 2 && (!m.loose || inGroupRange(anchors, m.no));
    if (!exact && !skip) return;
    if (skip) warnings.push(`${expected}${m.no - expected > 1 ? `~${m.no - 1}` : ''}번 문항 번호를 찾지 못했습니다. 확인해 주세요.`);
    anchors.push({ kind: 'q', idx, no: m.no, rest: m.rest });
    expected = m.no + 1;
  });
  return { anchors, warnings, count: anchors.filter((a) => a.kind === 'q').length };
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
  // 2단 페이지: 두 단의 경계에서 자른다 (가로로 긴 제목·옆 단 글자가 섞이지 않게)
  for (const [key, c] of cols) {
    const [page, col] = key.split(':');
    const right = cols.get(`${page}:1`);
    if (col === '0' && right) {
      const rightStarts = lines
        .filter((l) => String(l.page) === page && l.col === 1 && l.x0 != null && l.text.replace(/\s/g, '').length >= 4)
        .map((l) => l.x0)
        .sort((a, b) => a - b);
      const rightStart = rightStarts.length ? rightStarts[Math.floor(rightStarts.length * 0.05)] : right.x0;
      const leftEnds = lines
        .filter((l) => String(l.page) === page && l.col === 0 && l.x1 != null && l.x1 < rightStart)
        .map((l) => l.x1)
        .sort((a, b) => a - b);
      const leftEnd = leftEnds.length ? leftEnds[Math.floor(leftEnds.length * 0.97)] : c.x1;
      const mid = (leftEnd + rightStart) / 2;
      c.x1 = Math.min(c.x1, mid - 0.004);
      right.x0 = Math.max(Math.min(right.x0, rightStart - 0.012), mid + 0.004);
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
