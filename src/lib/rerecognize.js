// "답안 유형 다시 인식하기": 한 문항을 여러 가지 방법으로 다시 읽어 보고, 그럴듯한 순서대로 후보를 만든다.
// 버튼을 누를 때마다 지금과 다른 다음 후보로 바꾼다 (규칙 기반, AI 미사용).
import { blankLabels } from './parseQuestions.js';
import { newPart } from './editorModel.js';

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';
const HANGUL = '㉮㉯㉰㉱㉲㉳㉴㉵㉶㉷';
const KOREAN = '㉠㉡㉢㉣㉤㉥㉦㉧㉨㉩';
const DRAW_RE = /그려\s*(?:보|넣|주|라|야)|그리(?:시오|세요|십시오)|그어\s*(?:보|주|라)|그으(?:시오|세요)|표시(?:해\s*보|하시오|하세요)|색칠|나타내어\s*보/;
const OX_MARK_RE = /○\s*표|○를|○\s*하|동그라미/;
const FILL_RE = /써\s*넣|빈\s*칸|□|안에\s*알맞은/;
const COUNT_RE = /(두|세|네|다섯|2|3|4|5)\s*(?:가지|개|곳|군데)(?:를|을|씩)?\s*(?:찾아\s*)?(?:쓰|적|써)/;

const strip = ({ alone, isRef, ...b }) => b;

/** 답 형식이 같은지 비교하는 값 */
export function formatSignature(it) {
  if (it.parts?.length) return `parts:${it.parts.map((p) => formatSignature(p)).join('|')}`;
  const labels = it.type === 'mc' ? (it.choiceLabels || []).join('') || 'circled' : '';
  return [it.type, it.type === 'mc' ? Number(it.choiceCount) || 0 : 0, labels, it.type === 'short' ? Math.max(1, Number(it.blankCount) || 1) : 0,
    it.type === 'match' ? Number(it.matchCount) || 0 : 0, it.draw ? 'd' : '', it.manual ? 'm' : ''].join(':');
}

/**
 * @param {object} q 편집 중인 문항 (fullText, blankInfo가 있으면 더 잘 읽는다)
 * @returns {{label:string, patch:object, score:number}[]} 그럴듯한 순서
 */
export function recognizeOptions(q) {
  const text = String(q.fullText || q.text || '');
  const info = q.blankInfo?.length ? q.blankInfo : (q.blanks || []).map((b) => ({ ...b, alone: true }));
  const alone = info.filter((b) => b.alone);
  const nonRef = info.filter((b) => !b.isRef);
  const boxes = (q.answerSpots || []).filter((s) => s.kind === 'box');
  const opts = [];
  const base = {
    draw: false, manual: false, oxBlanks: false, parts: null, blankCount: 0, customLabels: false, commonBlank: false,
    choiceLabels: null, choices: [], multi: false,
  };
  const withSpots = (spots) => (spots ? { blanks: spots.map(strip), answerSpots: [...boxes, ...spots.map((s) => ({ ...strip(s), kind: 'paren' }))] } : {});
  const add = (score, label, patch) => opts.push({ score, label, patch: { ...base, ...patch } });

  const asks = /쓰시오|쓰세요|써\s*보|구하|몇|무엇|누구|어디|언제|찾아/.test(text);
  const common = /공통(?:으로|적으로)?\s*(?:들어갈|알맞은|쓸)/.test(text);

  // ── 객관식 ──
  const circled = [...new Set(text.match(/[①-⑩]/g) || [])];
  if (circled.length >= 2) {
    const n = Math.max(...circled.map((c) => CIRCLED.indexOf(c) + 1));
    add(/것은\s*\?|것은\s*무엇|고르|골라/.test(text) ? 95 : 70, `객관식 ①~${CIRCLED[n - 1]} (보기 ${n}개)`, { type: 'mc', choiceCount: n, multi: /모두\s*(?:고르|골라)/.test(text) });
  }
  for (const [series, name] of [[HANGUL, '㉮㉯㉰'], [KOREAN, '㉠㉡㉢']]) {
    const found = [...new Set((text.match(new RegExp(`[${series}]`, 'g')) || []))];
    if (found.length >= 2) {
      const n = Math.max(...found.map((c) => series.indexOf(c) + 1));
      add(/기호를?\s*(?:쓰|써|고르)/.test(text) ? 90 : 45, `기호 고르기 ${name} (${n}개)`, {
        type: 'mc', choiceCount: n, choiceLabels: series.slice(0, n).split(''), multi: /모두/.test(text),
      });
    }
  }
  // ( ) ( ) 중 ○표
  if (alone.length >= 2 && alone.length <= 8) {
    add(OX_MARK_RE.test(text) ? 92 : 35, `○표 하기 · 칸 ${alone.length}개 중 고르기`, {
      type: 'mc', choiceCount: alone.length, choiceLabels: blankLabels(alone), oxBlanks: true, multi: /모두/.test(text), ...withSpots(alone),
    });
  }
  // (1) (2) (3) 작은 문항
  const subs = [...new Set((text.match(/(?:^|\n)\s*\((\d)\)/g) || []).map((s) => s.trim()))];
  if (subs.length >= 2) {
    if (OX_MARK_RE.test(text)) {
      add(82, `(1)~(${subs.length}) 중 ○표 하기`, {
        type: 'mc', choiceCount: subs.length, choiceLabels: subs.map((_, i) => `(${i + 1})`), multi: /모두/.test(text),
      });
    }
    add(OX_MARK_RE.test(text) ? 40 : 74, `여러 부분 (1)~(${subs.length}) 각각 답 쓰기`, {
      type: 'short', parts: subs.map(() => newPart('short')),
    });
  }
  // O/X
  add(/맞으면|틀리면|옳으면|옳지\s*않으면|O\s*표|X\s*표|[OＯ]\s*,\s*[XＸ×]|○\s*,\s*×/.test(text) ? 88 : 22, 'O/X 고르기', {
    type: 'mc', choiceCount: 2, choiceLabels: ['O', 'X'],
  });

  // ── 단답형 ──
  const cm = text.match(COUNT_RE);
  if (cm) {
    const n = { 두: 2, 세: 3, 네: 4, 다섯: 5 }[cm[1]] || Number(cm[1]);
    add(89, `단답형 · 답 칸 ${n}개 ("${cm[0].trim()}")`, { type: 'short', blankCount: n });
  }
  if (common) add(93, '단답형 · 답 칸 1개 (공통으로 들어갈 말)', { type: 'short', commonBlank: true, ...withSpots(alone.length ? alone : nonRef.slice(0, 1)) });
  add(asks ? 76 : 50, '단답형 · 답 칸 1개', { type: 'short', ...withSpots(alone.length === 1 ? alone : nonRef.length === 1 ? nonRef : null) });
  if (alone.length >= 2) add(72, `단답형 · 답 칸 ${alone.length}개 (따로 떨어진 답 칸마다)`, { type: 'short', blankCount: alone.length, ...withSpots(alone) });
  if (boxes.length >= 2) add(FILL_RE.test(text) ? 80 : 40, `단답형 · □ 칸마다 (${boxes.length}개)`, { type: 'short', blankCount: boxes.length, fillBoxes: true });
  if (nonRef.length >= 2 && nonRef.length !== alone.length) {
    add(FILL_RE.test(text) && !common ? 68 : 38, `단답형 · 괄호마다 (${nonRef.length}개)`, { type: 'short', blankCount: nonRef.length, ...withSpots(nonRef) });
  }
  if (info.length >= 2 && info.length !== nonRef.length && info.length !== alone.length) {
    add(18, `단답형 · 모든 괄호마다 (${info.length}개)`, { type: 'short', blankCount: Math.min(8, info.length), ...withSpots(info) });
  }

  // ── 서술형 ──
  const long = /까닭|이유|설명|방법|생각|느낌|까닭은|왜|어떻게|문장으로|자신의|의견|차이점|공통점|비교/.test(text);
  if (/풀이\s*과정/.test(text)) add(91, '서술형 · 풀이 과정 (선생님이 직접 채점)', { type: 'essay', manual: true });
  add(long ? 84 : 33, '서술형 (문장으로 쓰기)', { type: 'essay' });
  add(12, '서술형 · 선생님이 직접 채점', { type: 'essay', manual: true });

  // ── 그리기·선 잇기 ──
  const draws = DRAW_RE.test(text);
  add(draws && !alone.length ? 87 : draws ? 60 : 14, '그리기 (그림만)', { type: 'draw', draw: true });
  add(draws && (alone.length || FILL_RE.test(text)) ? 86 : 11, '그리기 + 답 쓰기', { type: 'short', draw: true });
  if (/선으로\s*이으|이어\s*보|연결/.test(text)) add(85, '선 잇기', { type: 'match', matchCount: Math.max(2, subs.length || 3) });
  add(8, '객관식 ①~⑤', { type: 'mc', choiceCount: 5 });

  // 같은 형식은 점수가 높은 것 하나만
  opts.sort((a, b) => b.score - a.score);
  const seen = new Set();
  return opts.filter((o) => {
    const sig = formatSignature(o.patch);
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

/**
 * 다음 후보 고르기: step번째부터 지금 형식과 다른 첫 후보
 * @returns {{option, index:number, total:number, nextStep:number}|null}
 */
export function nextRecognition(q, step = 0) {
  const opts = recognizeOptions(q);
  if (!opts.length) return null;
  const cur = formatSignature(q);
  for (let k = 0; k < opts.length; k++) {
    const i = (step + k) % opts.length;
    if (formatSignature(opts[i].patch) !== cur) return { option: opts[i], index: i + 1, total: opts.length, nextStep: i + 1 };
  }
  return null;
}

/** 후보를 편집 중인 문항에 적용 (정답 칸은 형식이 바뀌면 비우되, 글자 답은 되도록 살린다) */
export function applyRecognition(it, patch) {
  const answer = String(it.answerText || it.model || '').trim();
  const next = { ...it, ...patch, keyChoices: [], keyPairs: [] };
  if (patch.type === 'mc') next.choices = Array.from({ length: patch.choiceCount }, (_, i) => it.choices?.[i] || '');
  if (patch.type === 'short') next.answerText = it.type === 'short' ? it.answerText : answer.length <= 30 ? answer : '';
  if (patch.type === 'essay') next.model = it.model || answer;
  if (patch.type === 'match') next.matchLabels = null;
  if (!patch.parts) next.parts = null;
  return next;
}
