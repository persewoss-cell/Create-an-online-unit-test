// 한국어 답안 비교에 필요한 공통 유틸리티 (외부 AI 없이 규칙 기반)

export const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';

export function circledToNumber(ch) {
  const i = CIRCLED.indexOf(ch);
  return i >= 0 ? i + 1 : null;
}

export function numberToCircled(n) {
  return CIRCLED[n - 1] || String(n);
}

const CHOSEONG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNGSEONG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';

/**
 * 원·네모·괄호 안의 숫자·글자를 보통 글자로: ①→1, ❶→1, 1️⃣→1, ⑴→(1), ㉠→ㄱ, ㈀→(ㄱ), ㉮→가, ⓐ→a, 🄰→A, ㎝→cm
 * (태블릿 키보드로는 원 기호를 치기 어려우므로 1, ㄱ, 가로 써도 같은 답으로 본다)
 */
export function plainSymbols(s) {
  return String(s ?? '')
    .replace(/[❶-➓]/g, (c) => String(((c.charCodeAt(0) - 0x2776) % 10) + 1)) // ❶ ➀ ➊ (검은 원·원 숫자 딩뱃)
    .replace(/[️⃣]/g, '') // 1️⃣ 키캡 숫자
    .replace(/[\u{1F150}-\u{1F169}\u{1F170}-\u{1F189}]/gu, (c) => String.fromCharCode(65 + ((c.codePointAt(0) - 0x1f150) % 32))) // 🅐 🅰 (검은 원·네모 글자)
    .normalize('NFKC')
    .replace(/[ᄀ-ᄒ]/g, (c) => CHOSEONG[c.charCodeAt(0) - 0x1100])
    .replace(/[ᅡ-ᅵ]/g, (c) => JUNGSEONG[c.charCodeAt(0) - 0x1161]);
}

// 태블릿 특수문자에서 모양이 비슷한 수학 기호를 하나로 (〈 ‹ ＜ → <, ≦ → ≤, ㅡ – − → - …)
const MATH_LOOKALIKE = [
  [/[<＜〈〈‹˂ᐸ⟨≺﹤]/g, '<'],
  [/[>＞〉〉›˃ᐳ⟩≻﹥]/g, '>'],
  [/[≤≦⩽]|<=/g, '≤'],
  [/[≥≧⩾]|>=/g, '≥'],
  [/[=＝⩵]/g, '='],
  [/[≠]|=\/|\/=/g, '≠'],
  [/[+＋﹢]/g, '+'],
  [/[-−‐‑‒–—―ㅡ﹣－]/g, '-'],
  [/[×✕✖⨯*]/g, '×'],
  [/[÷]/g, '÷'],
];
const MATH_SYMBOL = /[<>≤≥=≠+×÷]/;

/** 수학 기호만 비교하기 좋게: 비슷한 모양 기호를 하나로, 띄어쓰기 제거 */
export function mathSymbols(s) {
  let out = plainSymbols(s).toLowerCase().replace(/[\s 　]+/g, '');
  for (const [re, to] of MATH_LOOKALIKE) out = out.replace(re, to);
  return out;
}

/** 정답에 <, >, = 같은 수학 기호가 들어 있는지 */
export function hasMathSymbol(s) {
  return MATH_SYMBOL.test(mathSymbols(s));
}

/** 공백·문장부호 제거, 소문자화 */
export function normalizeText(s) {
  return plainSymbols(s)
    .toLowerCase()
    .replace(/[\s 　]+/g, '')
    .replace(/[.,!?;:'"`~·•…()[\]{}<>「」『』“”‘’\-_/\\=+*^%$#@&|，。、：；！？（）]/g, '');
}

// 문장 끝 어미와 조사 (긴 것부터 검사)
const SUFFIXES = [
  '이었습니다', '였습니다', '입니다', '습니다', '합니다', '됩니다', '이에요', '이예요', '이라고', '라고',
  '에서는', '으로는', '이어서', '이므로', '때문에', '이다', '예요', '에요', '이요', '에서', '으로', '에게',
  '까지', '부터', '이고', '이며', '이나', '처럼', '요', '다', '은', '는', '이', '가', '을', '를', '의',
  '에', '로', '와', '과', '도', '만', '고', '며', '나',
];

/**
 * 어미/조사를 떼어낸 여러 형태를 만든다. 양쪽 답안의 형태 집합이 겹치면 같은 말로 본다.
 * 예: "바다입니다" -> {바다입니다, 바다, 바}
 */
export function variants(normalized, depth = 2) {
  const out = new Set([normalized]);
  let frontier = [normalized];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const s of frontier) {
      for (const suf of SUFFIXES) {
        if (s.length > suf.length && s.endsWith(suf)) {
          const v = s.slice(0, -suf.length);
          if (!out.has(v)) {
            out.add(v);
            next.push(v);
          }
        }
      }
    }
    frontier = next;
  }
  return out;
}

/**
 * 어미·조사 차이를 무시하고 학생 답(answer)이 정답(expected)과 같은 말인지 판정.
 * 학생 답에서 어미를 떼어 정답과 같아지면 인정하고, 양쪽을 모두 뗄 때는 2글자 이상 어간이 같아야 한다.
 * (정답 "물" / 학생 "물입니다" → 인정, 정답 "나이" / 학생 "나" → 불인정)
 */
export function sameWord(expected, answer) {
  const ne = normalizeText(expected);
  const na = normalizeText(answer);
  if (!ne || !na) return false;
  if (ne === na) return true;
  const va = variants(na);
  if (va.has(ne)) return true;
  for (const v of variants(ne)) {
    if (v.length >= 2 && va.has(v)) return true;
  }
  return false;
}

/** 어미·조사를 무시하고 text 안에 word가 들어있는지 */
export function containsWord(text, word) {
  const nt = normalizeText(text);
  const nw = normalizeText(word);
  if (!nw) return false;
  if (nt.includes(nw)) return true;
  for (const v of variants(nw, 1)) {
    if (v.length >= 2 && v.length >= nw.length - 2 && nt.includes(v)) return true;
  }
  return false;
}

// ── 자모 분해 (오타 허용 비교용) ──
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ',
  'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

export function toJamo(s) {
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const idx = code - 0xac00;
      out += CHO[Math.floor(idx / 588)] + JUNG[Math.floor((idx % 588) / 28)] + JONG[idx % 28];
    } else {
      out += ch;
    }
  }
  return out;
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 자모 단위 편집거리 유사도 (0~1) */
export function jamoSimilarity(a, b) {
  const ja = toJamo(normalizeText(a));
  const jb = toJamo(normalizeText(b));
  if (!ja.length && !jb.length) return 1;
  return 1 - levenshtein(ja, jb) / Math.max(ja.length, jb.length);
}

/** 글자 2-gram Dice 유사도 (서술형 문장 비교용) */
export function diceSimilarity(a, b) {
  const grams = (s) => {
    const m = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) || 0) + 1);
    }
    return m;
  };
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na.length < 2 || nb.length < 2) return na === nb ? 1 : 0;
  const ga = grams(na);
  const gb = grams(nb);
  let inter = 0;
  for (const [g, c] of ga) inter += Math.min(c, gb.get(g) || 0);
  return (2 * inter) / (na.length - 1 + nb.length - 1);
}

// ── 숫자 답 비교 ──
const NUM_RE = /^(-?\d[\d,]*(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?(.*)$/;

/** "24개", "3/4", "4분의 3", "3.5cm" 같은 답에서 값과 단위를 뽑는다. 숫자 답이 아니면 null */
export function parseNumeric(s) {
  let t = String(s ?? '').replace(/\s+/g, '');
  t = t.replace(/^(-?\d+)분의(-?\d+)/, '$2/$1');
  const m = t.match(NUM_RE);
  if (!m) return null;
  let value = Number(m[1].replace(/,/g, ''));
  if (m[2]) value /= Number(m[2]);
  if (!Number.isFinite(value)) return null;
  // 단위 뒤의 어미 제거 ("24개입니다" -> "개")
  const unit = normalizeText(m[3]).replace(/(입니다|이에요|이예요|이다|예요|에요|요|다)$/, '');
  // 단위가 너무 길면 숫자 답으로 보지 않는다 (예: "3학년 때 배운 내용")
  if (unit.length > 4) return null;
  return { value, unit };
}

// ── 용언(동사·형용사) 어간 추출: "많아진다" / "많아져요" / "많아졌다" → "많아지" ──
function jongIndex(ch) {
  const code = ch.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 : -1;
}
function dropJong(ch) {
  return String.fromCharCode(ch.charCodeAt(0) - jongIndex(ch));
}
const PRED_RULES = [
  [/(했습니다|했어요|했다|합니다|한다|하다|해요|해서|하고|하여|하면|하는|한|할|함|해)$/, '하'],
  [/(됐습니다|됐어요|됐다|됩니다|된다|되다|돼요|되어요|되어서|되어|되고|되면|됨|돼)$/, '되'],
  [/(졌습니다|졌어요|졌다|집니다|진다|지다|져요|져서|지고|지면|짐|져)$/, '지'],
];
const PRED_ENDINGS = /(었습니다|았습니다|였습니다|었어요|았어요|였어요|었다|았다|였다|습니다|어요|아요|여요|어서|아서|으면|으니|는다|이다|이었|었|았|였|고|면|다|요|서|어|아|여)$/;

export function predicateStem(word) {
  let s = normalizeText(word);
  for (const [re, rep] of PRED_RULES) {
    if (re.test(s)) return s.replace(re, rep);
  }
  if (s.length >= 3 && s.endsWith('는다')) return s.slice(0, -2);
  // "늘어납니다" → "늘어나", "늘어난다" → "늘어나"
  if (s.length >= 4 && s.endsWith('니다') && jongIndex(s.at(-3)) === 17) return s.slice(0, -3) + dropJong(s.at(-3));
  if (s.length >= 3 && s.endsWith('다') && jongIndex(s.at(-2)) === 4) return s.slice(0, -2) + dropJong(s.at(-2));
  return s.replace(PRED_ENDINGS, '');
}

/** 어간이 같은 용언인지 ("늘어난다" ≈ "늘어나요") */
export function samePredicate(a, b) {
  const pa = predicateStem(a);
  return pa.length >= 2 && pa === predicateStem(b);
}

// ── 서술형 핵심어 자동 추출 ──
const STOPWORDS = new Set([
  '것', '수', '때', '등', '이것', '그것', '저것', '있', '없', '하', '되', '때문', '그리고', '그래서',
  '따라서', '또한', '매우', '더', '가장', '많이', '조금', '그', '이', '저', '및', '또는', '위해', '위하여',
  '통해', '대한', '대해', '같은', '같이', '예시', '답안', '정답', '모범', '우리', '싶', '갖', '경우', '정도', '위해서', '위하', '때문에',
]);
const NOUN_PARTICLES = /(에서는|으로는|에서|으로|에게|까지|부터|처럼|보다|이라는|라는|이나|이다|이고|이며|은|는|이|가|을|를|의|에|로|와|과|도|만)$/;
const PRED_TAIL = /(기|게|는|은|을|던|지|며|려고|도록)$/;

export function stemToken(token) {
  const t = String(token).toLowerCase();
  const noun = t.replace(NOUN_PARTICLES, '');
  if (noun !== t && noun.length >= 2) return noun;
  return predicateStem(t);
}

/**
 * 모범 답안에서 핵심어 후보를 뽑는다. 명사(조사가 붙은 말)를 먼저, 그다음 용언 어간을 등장 순서대로.
 */
export function extractKeywords(modelAnswer, max = 6) {
  const tokens = String(modelAnswer ?? '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const seen = new Set();
  const nouns = [];
  const preds = [];
  for (const tok of tokens) {
    const t = tok.toLowerCase();
    const noun = t.replace(NOUN_PARTICLES, '');
    let stem;
    let isNoun = false;
    if (noun !== t && noun.length >= 1) {
      // 조사가 붙은 말은 명사로 본다 (한 글자 명사 "물", "열"도 중요한 핵심어)
      stem = noun;
      isNoun = true;
    } else {
      stem = predicateStem(t.replace(PRED_TAIL, '') || t);
      if (stem === t && t.length <= 4) isNoun = true; // 조사 없이 쓰인 명사 ("광합성")
      // "증발하" → "증발" (하다/되다 동사는 명사 부분만 핵심어로)
      if (/[하되]$/.test(stem) && stem.length >= 3) stem = stem.slice(0, -1);
    }
    if (!stem || (stem.length < 2 && !isNoun) || STOPWORDS.has(stem) || /^\d+$/.test(stem) || seen.has(stem)) continue;
    seen.add(stem);
    (isNoun ? nouns : preds).push(stem);
  }
  return [...nouns, ...preds].slice(0, max);
}

const NEGATION_RE = /(않|없|못하|못한|못해|아니|안된|안되|안돼)/;
export function hasNegation(s) {
  return NEGATION_RE.test(normalizeText(s));
}
