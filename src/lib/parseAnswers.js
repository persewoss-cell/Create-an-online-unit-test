// 정답지 텍스트에서 번호별 정답을 찾아낸다.
// 지원 양식 예:
//   "1. ③  2. ④"            "1) 광합성"          "3번 답: 2"
//   "1③ 2① 3④"              "[서술형 1] 예시 답안: …"
//   표 형태:  "번호 1 2 3 4 5" / "정답 ③ ① ④ ② ⑤"

import { circledToNumber, extractKeywords } from './korean.js';

const EXPLAIN_RE = /(?:\[|<|【|\()?\s*(?:해설|풀이|채점\s*기준|오답\s*피하기|오답\s*풀이|참고)\s*(?:\]|>|】|\))?\s*[:：]?/;
const LEAD_RE = /^\s*(?:정답|답안?|모범\s*답안|예시\s*답안?|예시답|답)\s*[:：)]?\s*/;
const KEYWORD_RE = /(?:핵심\s*(?:어|단어|키워드|낱말)|키워드|필수\s*단어)\s*[:：]\s*([^\n]+)/;

function tokens(line) {
  const t = line.trim();
  // 표의 칸은 탭으로 구분되어 있다(layout.js). 탭이 없으면 공백으로 나눈다.
  if (t.includes('\t')) return t.split('\t').map((x) => x.trim()).filter(Boolean);
  return t.replace(/\s*([,、])\s*/g, '$1').split(/\s+/).filter(Boolean);
}

/** 표 형태(번호 줄 + 정답 줄) 인식 */
function parseTables(lines, found, used) {
  for (let i = 0; i < lines.length - 1; i++) {
    let nums = tokens(lines[i]);
    if (nums.length && /^(번호|문항|문제|번)$/.test(nums[0])) nums = nums.slice(1);
    if (nums.length < 3 || !nums.every((t) => /^\d{1,2}$/.test(t))) continue;
    const ns = nums.map(Number);
    if (!ns.every((n, k) => k === 0 || n === ns[k - 1] + 1)) continue;
    // 다음 줄들 중 같은 개수의 칸을 가진 정답 줄 찾기
    for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j++) {
      let ans = tokens(lines[j]);
      if (ans.length && /^(정답|답)$/.test(ans[0])) ans = ans.slice(1);
      // "③①④②⑤"처럼 붙어 있는 경우
      if (ans.length === 1 && /^[①-⑩]+$/.test(ans[0]) && ans[0].length === ns.length) ans = [...ans[0]];
      if (ans.length === ns.length) {
        ns.forEach((n, k) => {
          if (!found.has(n)) found.set(n, ans[k]);
        });
        used.add(i);
        used.add(j);
        break;
      }
    }
  }
}

/** 번호 표시로 구간을 나눠 정답 추출 */
function parseMarkers(text, found, out) {
  const re = /(?:^|[\s\n,;])(?:\[?\s*(?:서술형|단답형|주관식)\s*)?(\d{1,2})\s*(?:번\s*[.):]?|[.．)\]](?!\d)|(?=\s*[①-⑩]))/g;
  // 표에서 이미 찾은 번호는 건너뛰고 다음 번호부터 찾는다
  const nextMissing = (n) => {
    while (found.has(n)) n++;
    return n;
  };
  const marks = [];
  let expected = nextMissing(1);
  let m;
  while ((m = re.exec(text))) {
    const no = Number(m[1]);
    if (no === expected) {
      marks.push({ no, start: m.index, contentStart: m.index + m[0].length });
      expected = nextMissing(no + 1);
    }
  }
  marks.forEach((mk, k) => {
    const end = k + 1 < marks.length ? marks[k + 1].start : text.length;
    const raw = text.slice(mk.contentStart, end).trim();
    if (raw) out.set(mk.no, raw);
  });
}

/**
 * @param {string[]} lines 정답지의 모든 줄
 * @returns {Map<number,string>} 번호 → 정답 원문
 */
export function parseAnswerText(lines) {
  const found = new Map();
  const used = new Set();
  parseTables(lines, found, used);
  const rest = lines.filter((_, i) => !used.has(i)).join('\n');
  const markerFound = new Map();
  parseMarkers(rest, found, markerFound);
  for (const [no, raw] of markerFound) if (!found.has(no)) found.set(no, raw);
  return new Map([...found.entries()].sort((a, b) => a[0] - b[0]));
}

/** 원문에서 객관식 번호 추출 ("③", "②, ④", "3", "3번") */
export function parseChoiceAnswer(raw) {
  const s = String(raw).replace(LEAD_RE, '').trim();
  const circ = s.match(/^[①-⑩](?:\s*(?:[,、/·]|및|와|과|,?\s*)\s*[①-⑩])*/);
  if (circ) return [...circ[0].matchAll(/[①-⑩]/g)].map((x) => circledToNumber(x[0]));
  const num = s.match(/^\(?(\d{1,2})\)?\s*번?(?:\s*[,、/]\s*\(?(\d{1,2})\)?\s*번?)*(?=\s|$|[.해풀])/);
  if (num) return [...num[0].matchAll(/\d{1,2}/g)].map((x) => Number(x[0])).filter((n) => n >= 1 && n <= 10);
  return null;
}

function cleanTextAnswer(raw) {
  let s = String(raw);
  const ex = s.search(EXPLAIN_RE);
  if (ex > 0) s = s.slice(0, ex);
  s = s.replace(KEYWORD_RE, '');
  s = s.replace(LEAD_RE, '');
  s = s.replace(/[[(（]\s*\d+(?:\.\d+)?\s*점\s*[\])）]/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

/** "광합성(또는 광합성 작용) / 탄소 동화" → ["광합성", "광합성 작용", "탄소 동화"] */
export function splitAlternatives(text) {
  const alts = [];
  const s = text.replace(/\(\s*(?:또는|=|or|혹은)\s*([^)]+)\)/gi, (_, alt) => {
    alts.push(alt.trim());
    return '';
  });
  const main = s
    .split(/\s*(?:\/|또는|혹은|\bor\b)\s*/i)
    .map((x) => x.trim())
    .filter(Boolean);
  return [...new Set([...main, ...alts])];
}

/**
 * 문항 정보와 정답 원문을 합쳐 채점용 정답 키를 만든다.
 * 문제지만으로 판단한 유형이 정답을 보고 바뀔 수 있다(예: 정답이 ③이면 객관식).
 */
export function buildKey(question, raw) {
  const q = { ...question };
  if (raw == null || String(raw).trim() === '') return { question: q, key: emptyKey(q.type) };
  const choice = parseChoiceAnswer(raw);
  const looksCircled = /^[①-⑩]/.test(String(raw).replace(LEAD_RE, '').trim());
  if (choice && choice.length && (q.type === 'mc' || looksCircled)) {
    if (q.type !== 'mc') {
      q.type = 'mc';
      q.choiceCount = Math.max(5, ...choice);
      q.choices = [];
    }
    q.choiceCount = Math.max(q.choiceCount || 0, ...choice);
    if (choice.length > 1) q.multi = true;
    return { question: q, key: { choices: choice } };
  }
  const kwMatch = String(raw).match(KEYWORD_RE);
  const text = cleanTextAnswer(raw);
  const long = text.replace(/\s/g, '').length > 25 || (text.split(' ').length >= 5 && /[다요]\.?$/.test(text));
  if (q.type === 'mc') {
    // 객관식으로 보였는데 정답이 글자인 경우 → 단답형으로
    q.type = long ? 'essay' : 'short';
    q.choiceCount = 0;
    q.choices = [];
    q.multi = false;
  } else if (q.type === 'short' && (long || kwMatch)) {
    q.type = 'essay';
  }
  if (q.type === 'essay') {
    const keywords = kwMatch
      ? kwMatch[1].split(/\s*[,、/·]\s*/).map((k) => k.trim()).filter(Boolean)
      : extractKeywords(text);
    return { question: q, key: { model: text, keywords } };
  }
  return { question: q, key: { accepted: splitAlternatives(text) } };
}

export function emptyKey(type) {
  if (type === 'mc') return { choices: [] };
  if (type === 'essay') return { model: '', keywords: [] };
  return { accepted: [] };
}

/**
 * 문항 목록 + 정답 원문 맵을 합친다.
 * @returns {{questions: object[], keys: Record<number,object>, warnings: string[]}}
 */
export function mergeQuestionsAndAnswers(questions, answerMap) {
  const warnings = [];
  let qs = questions;
  // 문제지에서 문항을 못 찾았지만 정답지에서는 찾은 경우: 정답 개수만큼 문항 생성
  if (!qs.length && answerMap.size) {
    const max = Math.max(...answerMap.keys());
    qs = Array.from({ length: max }, (_, i) => ({
      no: i + 1, page: 1, type: 'short', choiceCount: 0, choices: [], multi: false, points: null, text: '',
    }));
    warnings.push(`문제지에서 문항을 찾지 못해 정답지 기준으로 ${max}개 문항을 만들었습니다. 쪽 번호와 유형을 확인해 주세요.`);
  }
  const keys = {};
  const outQs = qs.map((q) => {
    const { question, key } = buildKey(q, answerMap.get(q.no));
    keys[q.no] = key;
    return question;
  });
  const missing = outQs.filter((q) => !hasAnswer(keys[q.no])).map((q) => q.no);
  if (missing.length) warnings.push(`정답을 찾지 못한 문항: ${missing.join(', ')}번 — 직접 입력해 주세요.`);
  const extra = [...answerMap.keys()].filter((n) => !outQs.some((q) => q.no === n));
  if (extra.length) warnings.push(`정답지에는 있지만 문제지에서 찾지 못한 번호: ${extra.join(', ')}번`);
  return { questions: outQs, keys, warnings };
}

export function hasAnswer(key) {
  if (!key) return false;
  if (key.choices) return key.choices.length > 0;
  if (key.accepted) return key.accepted.some((a) => a.trim());
  return !!(key.model && key.model.trim()) || (key.keywords || []).length > 0;
}
