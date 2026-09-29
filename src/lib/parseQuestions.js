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
const LOOSE_START = /^\s*(\d{1,2})\s+(?=[가-힣A-Za-z<[(「])/;

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

/** 문항 본문에서 보기(①②… 또는 (1)(2)…)를 분리 */
export function extractChoices(text) {
  const circ = [...text.matchAll(/[①-⑩]/g)].map((m) => ({ n: circledToNumber(m[0]), i: m.index, len: 1 }));
  let marks = pickSequential(circ);
  if (marks.length < 2) {
    const paren = [...text.matchAll(/\((\d{1,2})\)/g)].map((m) => ({ n: Number(m[1]), i: m.index, len: m[0].length }));
    const seq = pickSequential(paren);
    marks = seq.length >= 3 ? seq : [];
  }
  if (marks.length < 2) return { stem: text.trim(), choices: [] };
  const stem = text.slice(0, marks[0].i).trim();
  const choices = marks.map((mk, k) => {
    const end = k + 1 < marks.length ? marks[k + 1].i : text.length;
    let t = text.slice(mk.i + mk.len, end);
    if (k === marks.length - 1) t = t.trim().split('\n')[0];
    t = t.replace(/\s+/g, ' ').trim();
    return t.length > 80 ? t.slice(0, 80) + '…' : t;
  });
  return { stem, choices };
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
  const { stem, choices } = extractChoices(body);
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
    .trim();
  return {
    no,
    page,
    type,
    choiceCount: type === 'mc' ? choices.length : 0,
    choices: type === 'mc' ? choices : [],
    multi: type === 'mc' && MULTI_RE.test(stem),
    points: pm ? Number(pm[1]) : null,
    text: firstLine.length > 200 ? firstLine.slice(0, 200) + '…' : firstLine,
  };
}

/**
 * @param {{page:number, lines:string[]}[]} pages
 * @returns {{questions: object[], warnings: string[]}}
 */
export function parseQuestions(pages) {
  const lines = pages.flatMap((p) => p.lines.map((text) => ({ text: text.replace(/\t/g, ' '), page: p.page })));
  const blocks = [];
  let cur = null;
  let expected = 1;
  for (const line of lines) {
    const m = matchQuestionStart(line.text);
    if (m && m.no === expected && !(m.loose && looksLikeTableRow(line.text))) {
      cur = { no: m.no, page: line.page, lines: [m.rest] };
      blocks.push(cur);
      expected++;
    } else if (cur) {
      cur.lines.push(line.text);
    }
  }
  const warnings = [];
  const textLen = lines.reduce((s, l) => s + l.text.length, 0);
  if (!lines.length || textLen < 20) {
    warnings.push('문제지에서 글자를 읽을 수 없습니다(스캔 이미지 PDF일 수 있음). 문항 수를 직접 입력해 주세요.');
  } else if (!blocks.length) {
    warnings.push('문항 번호를 찾지 못했습니다. 문항 수를 직접 입력하거나 문항을 추가해 주세요.');
  }
  const questions = blocks.map((b) => analyzeQuestion(b.no, b.lines.join('\n'), b.page));
  return { questions, warnings };
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
