// 정답지 텍스트에서 번호별 정답을 찾아낸다.
// 지원 양식 예:
//   "1. ③  2. ④"            "1) 광합성"          "3번 답: 2"
//   "1③ 2① 3④"              "[서술형 1] 예시 답안: …"
//   표 형태:  "번호 1 2 3 4 5" / "정답 ③ ① ④ ② ⑤"

import { circledToNumber, numberToCircled, extractKeywords, splitCommas } from './korean.js';
import { HANGUL_CIRCLED, KOREAN_CIRCLED } from './parseQuestions.js';

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
  return s.replace(/\s+/g, ' ').replace(/\s+등\s*\.?$/, '').trim();
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
  const built = buildKeyRaw(question, raw);
  // 그림을 그리는 문항은 자동 채점할 수 없으므로 반드시 선생님 채점
  const q = built.question;
  const drawn = q.type === 'draw' || q.draw || q.parts?.some((p) => p.type === 'draw');
  if (drawn && raw != null && String(raw).trim() !== '') {
    return { question: { ...q, manual: true }, key: { ...built.key, manual: true } };
  }
  return built;
}

const SPLIT_PARTS = /\s*[;；]\s*/;
const isDrawPiece = (s) => /^그리기$/.test(String(s).replace(LEAD_RE, '').trim());

function buildKeyRaw(question, raw) {
  let q = { ...question };
  const flags = (k) => ({ ...k, ...(q.draw ? { draw: true } : {}), ...(q.manual ? { manual: true } : {}) });
  if (raw == null || String(raw).trim() === '') return { question: q, key: flags(emptyKey(q.type)) };
  // 여러 유형 문항: 엑셀 정답을 ; 로 나눠 부분마다 ("③ ; 3 cm")
  if (q.parts?.length) {
    const pieces = String(raw).split(SPLIT_PARTS);
    const built = q.parts.map((p, i) => buildKey({ ...p, no: q.no, parts: undefined }, pieces[i] ?? ''));
    return {
      question: { ...q, parts: built.map((b, i) => ({ ...q.parts[i], ...pick(b.question) })) },
      key: flags({ parts: built.map((b) => b.key) }),
    };
  }
  // 문제지에서는 답 칸 하나로 읽었지만 정답이 ; 로 여러 부분이면(예: "서술형 문장 ; 20 cm")
  // 부분마다 답 형식이 따로 있는 문항으로 바꾼다 (부분마다 서술형·단답형·객관식 등을 정답 보고 정함)
  const pieces = String(raw).split(SPLIT_PARTS).map((x) => x.trim()).filter(Boolean);
  if (pieces.length >= 2) {
    const drawPiece = pieces.some(isDrawPiece);
    const rest = pieces.filter((x) => !isDrawPiece(x));
    // "그리기 ; 3 cm" → 그림 + 답 문항
    if (drawPiece && rest.length === 1) return buildKeyRaw({ ...q, draw: true, type: q.type === 'draw' ? 'short' : q.type }, `그리기 + ${rest[0]}`);
    const base = { ...q, type: 'short', draw: false, choiceCount: 0, choices: [], choiceLabels: null, multi: false, blankCount: 0 };
    const parts = rest.map(() => ({ type: 'short', choiceCount: 0, choices: [], choiceLabels: null, multi: false, matchCount: 0, matchLabels: null, blankCount: 0 }));
    const built = buildKeyRaw({ ...base, parts }, rest.join(' ; '));
    return drawPiece ? { question: { ...built.question, manual: true }, key: { ...built.key, manual: true } } : built;
  }
  // 그림만 그리는 문항으로 인식했는데 답을 적었다면 → 그림 + 답 문항
  if (q.type === 'draw' && !/^\s*그리기/.test(String(raw))) q = { ...q, type: 'short', draw: true };
  const built = buildKeyInner(q, raw);
  return { question: built.question, key: flags(built.key) };
}

function buildKeyInner(question, raw) {
  const q = { ...question };
  const special = buildSpecialKey(q, String(raw));
  if (special) return special;
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
  const accepted = splitAlternatives(text);
  // 답 칸 수는 엑셀 정답을 따른다: 쉼표로 여러 개(예: 3, 6, 9)를 적었으면 그 수만큼 칸,
  // 하나만 적었으면 칸 하나 (문제지에서 인식한 칸 수보다 엑셀을 우선)
  const parts = accepted[0] ? splitCommas(accepted[0]) : [];
  if (parts.length >= 2 && parts.length <= 8) q.blankCount = parts.length;
  else delete q.blankCount;
  return { question: q, key: { accepted } };
}

/** 부분 문항에 남길 답 형식 필드 */
function pick(q) {
  const { type, choiceCount, choices, choiceLabels, showChoiceText, multi, matchCount, matchLabels, blankCount } = q;
  return { type, choiceCount, choices, choiceLabels, showChoiceText, multi, matchCount, matchLabels, blankCount };
}

const PAREN_LABELS = (n) => Array.from({ length: n }, (_, i) => `(${i + 1})`);

/** 선 잇기, ㉮㉯㉰ 기호, (1)(2)(3) ○표, (예) 예시 답안 같은 특수 정답 */
function buildSpecialKey(q, raw) {
  const s = raw.replace(LEAD_RE, '').trim();
  // O/X 문항: 정답 칸에 O 또는 X (○, × 도 됨)
  const isOXq = q.type === 'mc' && q.choiceLabels?.[0] === 'O' && q.choiceLabels?.[1] === 'X';
  if (/^[OoXx○◯×✕]$/.test(s) && (q.type !== 'mc' || isOXq)) {
    return {
      question: { ...q, type: 'mc', choiceCount: 2, choiceLabels: ['O', 'X'], choices: [], multi: false, blankCount: 0 },
      key: { choices: [/^[OoＯ○◯]$/.test(s) ? 1 : 2] },
    };
  }
  // "왼쪽/오른쪽" 처럼 이름 붙은 칸 중 고르는 문항: 이름이나 번호로 적을 수 있다
  if (q.type === 'mc' && q.choiceLabels && /^[가-힣]/.test(q.choiceLabels[0])) {
    const norm = s.replace(/\s|괄호|칸|에|○|표/g, '');
    const byName = q.choiceLabels.map((l, i) => (norm.includes(l) ? i + 1 : 0)).filter(Boolean);
    const byNum = byName.length ? [] : (parseChoiceAnswer(s) || []);
    const picks = byName.length ? byName : byNum.filter((n) => n <= q.choiceCount);
    if (picks.length) return { question: { ...q, multi: q.multi || picks.length > 1 }, key: { choices: picks } };
  }
  // 선생님이 직접 채점: 정답 칸에 "검토" 또는 "선생님 채점"
  if (/^(검토|선생님\s*(채점|검토|확인)|직접\s*채점)$/.test(s)) {
    return { question: { ...q, manual: true }, key: { ...emptyKey(q.type), manual: true } };
  }
  // 그리기 문항: "그리기" 또는 "그리기 + 3 cm" (그림은 선생님 확인, 뒤의 답은 입력칸)
  const dm = s.match(/^그리기\s*(?:[+＋,/]\s*(.+))?$/s);
  if (dm) {
    if (!dm[1]) {
      return {
        question: { ...q, type: 'draw', draw: true, choiceCount: 0, choices: [], choiceLabels: null, multi: false },
        key: { draw: true },
      };
    }
    const inner = buildKey({ ...q, draw: false, type: q.type === 'draw' ? 'short' : q.type }, dm[1]);
    return { question: { ...inner.question, draw: true }, key: { ...inner.key, draw: true } };
  }
  // 선 잇기: "(1) - ① (2) - ②"
  const pairs = [...s.matchAll(/\((\d{1,2})\)\s*[-–~→:]?\s*([①-⑩㉮-㉷])/g)];
  if (pairs.length >= 2) {
    const hangul = /[㉮-㉷]/.test(pairs[0][2]);
    const idx = (ch) => (hangul ? HANGUL_CIRCLED.indexOf(ch) + 1 : circledToNumber(ch));
    const sorted = pairs.map((m) => ({ item: Number(m[1]), opt: idx(m[2]) })).sort((a, b) => a.item - b.item);
    const optCount = Math.max(sorted.length, ...sorted.map((p) => p.opt));
    return {
      question: {
        ...q, type: 'match', choiceCount: 0, choices: [], choiceLabels: null, multi: false,
        matchCount: sorted.length,
        matchLabels: Array.from({ length: optCount }, (_, i) => (hangul ? HANGUL_CIRCLED[i] : numberToCircled(i + 1))),
      },
      key: { pairs: sorted.map((p) => p.opt) },
    };
  }
  // ㉮ / ㉮, ㉰ / ㉡ (㉮㉯㉰ 또는 ㉠㉡㉢ 기호로 고르는 문제)
  if (/^([㉮-㉷]|[㉠-㉭])(\s*[,、]\s*([㉮-㉷]|[㉠-㉭]))*$/.test(s)) {
    const series = /[㉮-㉷]/.test(s[0]) ? HANGUL_CIRCLED : KOREAN_CIRCLED;
    const picks = [...s.matchAll(/[㉮-㉷㉠-㉭]/g)].map((m) => series.indexOf(m[0]) + 1).filter((n) => n > 0);
    const hasLabels = q.choiceLabels && series.includes(q.choiceLabels[0]);
    const count = Math.max(hasLabels ? q.choiceLabels.length : 3, ...picks);
    return {
      question: {
        ...q, type: 'mc', choiceCount: count, choices: hasLabels ? q.choices : [],
        choiceLabels: series.slice(0, count).split(''), multi: picks.length > 1,
      },
      key: { choices: picks },
    };
  }
  // (3) ○  → (1)(2)(3) 중 고르는 문제
  const pm = s.match(/^((?:\(\d{1,2}\)\s*[,、]?\s*)+)\s*(?:○|O|o|표)?\s*$/);
  if (pm) {
    const picks = [...pm[1].matchAll(/\d{1,2}/g)].map((m) => Number(m[0]));
    // 보기 수: 문제지에서 찾은 보기 수, 없으면 "( ) ( )" 답 칸 수, 그것도 없으면 3
    const blanks = (q.blanks || []).length;
    const count = Math.max(q.type === 'mc' ? q.choiceCount : blanks >= 2 ? blanks : 3, ...picks);
    if (q.type === 'mc' && q.oxBlanks) return { question: q, key: { choices: picks } };
    return {
      question: {
        ...q, type: 'mc', choiceCount: count, choices: q.type === 'mc' ? q.choices : [],
        choiceLabels: PAREN_LABELS(count), multi: picks.length > 1,
      },
      key: { choices: picks },
    };
  }
  // (예) 예시 답안 → 서술형(예시와 비슷하면 정답, 아니면 선생님 확인)
  const ex = s.match(/^\(?\s*예(?:시)?\s*(?:답안)?\s*\)?\s*[.:：)]?\s*(.+)$/s);
  if (ex && /^\(?\s*예/.test(s)) {
    const examples = ex[1]
      .replace(/\s*등\s*\.?\s*$/, '')
      .split(/\s*\/\s*/)
      .map((x) => x.trim())
      .filter(Boolean);
    return {
      question: { ...q, type: 'essay', choiceCount: 0, choices: [], choiceLabels: null, multi: false },
      key: { model: examples.join(' / '), examples, keywords: [], open: true },
    };
  }
  return null;
}

export function emptyKey(type) {
  if (type === 'mc') return { choices: [] };
  if (type === 'essay') return { model: '', keywords: [] };
  if (type === 'match') return { pairs: [] };
  if (type === 'draw') return { draw: true };
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
  if (key.manual) return true;
  if (key.parts) return key.parts.length > 0 && key.parts.every((k) => hasAnswer(k));
  if (key.draw && !key.choices && !key.pairs && !key.accepted && !key.model) return true;
  if (key.choices) return key.choices.length > 0;
  if (key.pairs) return key.pairs.length > 0 && key.pairs.every(Boolean);
  if (key.accepted) return key.accepted.some((a) => a.trim());
  return !!(key.model && key.model.trim()) || (key.keywords || []).length > 0;
}
