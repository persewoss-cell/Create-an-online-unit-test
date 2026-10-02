// 교사 편집 화면에서 쓰는 형태 <-> 저장 형태(questions + keys) 변환
// 한 문항 안에 답 유형이 여러 개인 경우 question.parts / key.parts 로 나눠 저장한다.
import { splitAlternatives } from './parseAnswers.js';
import { boxAlternatives } from './format.js';

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';

/** 정답 키 → 편집 칸 값 */
function keyFields(k = {}, q = {}) {
  const n = Number(q.blankCount) > 1 ? Number(q.blankCount) : 0;
  return {
    keyChoices: k.choices || [],
    answerText: (k.accepted || []).join(' / '),
    // 칸이 여러 개인 단답형: 칸마다 정답 (순서대로)
    boxAnswers: n ? boxAlternatives(k, n).map((a) => a.join(' / ')) : [],
    anyOrder: !!k.anyOrder,
    model: k.examples?.length ? k.examples.join(' / ') : k.model || '',
    keywordsText: (k.keywords || []).join(', '),
    keyPairs: k.pairs || [],
    open: !!k.open,
  };
}

export function toItems(questions, keys) {
  return questions.map((q) => {
    const k = keys[q.no] || {};
    const it = { ...q, choices: q.choices || [], ...keyFields(k, q) };
    if (q.parts?.length) {
      it.parts = q.parts.map((p, i) => ({ ...p, choices: p.choices || [], ...keyFields(k.parts?.[i], p) }));
    }
    return it;
  });
}

/** 편집 칸(유형별 필드) → 답 형식 + 정답 키. 문항 전체와 "부분 문항"에 함께 쓴다 */
function answerSpec(it) {
  const type = it.type;
  const count = type === 'mc' ? Math.max(2, Math.min(10, Number(it.choiceCount) || 5)) : 0;
  const spec = {
    type,
    choiceCount: count,
    choices: type === 'mc' ? Array.from({ length: count }, (_, i) => (it.choices || [])[i] || '') : [],
    choiceLabels: type === 'mc' && it.choiceLabels?.length
      ? Array.from({ length: count }, (_, i) => it.choiceLabels[i] || (it.customLabels ? '' : CIRCLED[i] || `${i + 1}`))
      : null,
    showChoiceText: type === 'mc' && !!it.showChoiceText,
    customLabels: type === 'mc' && !!it.customLabels,
    multi: type === 'mc' && (!!it.multi || (it.keyChoices || []).length > 1),
    matchCount: type === 'match' ? Math.max(1, Number(it.matchCount) || 2) : 0,
    matchLabels: type === 'match' ? it.matchLabels || null : null,
    blankCount: type === 'short' && Number(it.blankCount) > 1 ? Number(it.blankCount) : 0,
  };
  let key;
  if (type === 'draw') key = { draw: true };
  else if (type === 'mc') key = { choices: [...new Set(it.keyChoices || [])].filter((n) => n <= count).sort((a, b) => a - b) };
  else if (type === 'match') key = { pairs: Array.from({ length: spec.matchCount }, (_, i) => Number(it.keyPairs?.[i]) || 0) };
  else if (type === 'essay') {
    const model = (it.model || '').trim();
    key = {
      model,
      keywords: (it.keywordsText || '').split(/\s*[,，]\s*/).map((s) => s.trim()).filter(Boolean),
      ...(it.open ? { examples: model.split(/\s*\/\s*/).filter(Boolean), open: true } : {}),
    };
  } else if (spec.blankCount > 1) {
    // 칸마다 정답 (칸 안에서 여러 답 인정은 "/")
    const boxes = boxAnswersOf(it).map((b) => splitAlternatives(b).join(' / '));
    key = {
      boxes,
      accepted: boxes.some(Boolean) ? [boxes.map((b) => b.split(' / ')[0] || '').join(', ')] : [],
      ...(it.anyOrder ? { anyOrder: true } : {}),
    };
  } else key = { accepted: splitAlternatives(it.answerText || '') };
  return { spec, key };
}

/** 편집 중인 칸별 정답 (칸 수에 맞춤). 칸별 정답이 없으면 "가, 나" 한 줄 정답을 칸마다 나눈다 */
export function boxAnswersOf(it) {
  const n = Math.max(1, Number(it.blankCount) || 1);
  const cur = it.boxAnswers || [];
  const fromText = cur.some((b) => String(b || '').trim())
    ? null
    : boxAlternatives({ accepted: splitAlternatives(it.answerText || '') }, n).map((a) => a.join(' / '));
  return Array.from({ length: n }, (_, i) => String((fromText || cur)[i] ?? ''));
}

export function fromItems(items) {
  const questions = [];
  const keys = {};
  for (const it of items) {
    const hasParts = it.parts?.length > 0;
    const { spec, key } = answerSpec(hasParts ? { type: 'short' } : it);
    const q = {
      no: Number(it.no),
      page: Math.max(1, Number(it.page) || 1),
      ...spec,
      type: hasParts ? 'parts' : spec.type,
      points: Number(it.points) || 0,
      text: it.text || '',
      group: it.group || null,
      draw: !hasParts && (it.type === 'draw' || !!it.draw),
      manual: !!it.manual,
      oxBlanks: !!it.oxBlanks,
      fillBoxes: !!it.fillBoxes,
      regions: it.regions || [],
      anchor: it.anchor || null,
      blanks: it.blanks || [],
      answerSpots: it.answerSpots || [],
      ...(it.fullText ? { fullText: it.fullText } : {}),
      ...(it.blankInfo?.length ? { blankInfo: it.blankInfo } : {}),
      ...(it.commonBlank ? { commonBlank: true } : {}),
    };
    let k = key;
    if (hasParts) {
      const built = it.parts.map((p) => answerSpec(p));
      q.parts = built.map((b) => b.spec);
      k = { parts: built.map((b) => b.key) };
    }
    if (q.draw) k.draw = true;
    if (q.manual) k.manual = true;
    questions.push(q);
    keys[q.no] = k;
  }
  return { questions, keys };
}

export function newItem(no, page = 1) {
  return {
    no, page, type: 'short', choiceCount: 5, choices: [], multi: false, points: 0, text: '',
    keyChoices: [], answerText: '', model: '', keywordsText: '',
  };
}

export function newPart(type = 'short') {
  return { type, choiceCount: 3, choices: [], choiceLabels: null, multi: false, keyChoices: [], answerText: '', model: '', keywordsText: '', keyPairs: [], matchCount: 2 };
}

/** 한 부분(또는 문항)의 정답이 비었는지 */
export function partMissing(p) {
  if (p.type === 'draw') return false;
  if (p.type === 'mc') return !(p.keyChoices || []).length;
  if (p.type === 'match') return !Array.from({ length: Number(p.matchCount) || 2 }, (_, i) => p.keyPairs?.[i]).every(Boolean);
  if (p.type === 'short' && Number(p.blankCount) > 1) return boxAnswersOf(p).some((b) => !b.trim());
  if (p.type === 'short') return !String(p.answerText || '').trim();
  if (p.type === 'essay') return !String(p.model || '').trim() && !String(p.keywordsText || '').trim();
  return false;
}

/** 저장 전 점검: 문제가 있으면 메시지 배열 반환 */
export function validateItems(items, pageCount) {
  const errs = [];
  if (!items.length) errs.push('문항이 하나도 없습니다.');
  const nos = items.map((i) => Number(i.no));
  const dup = nos.filter((n, i) => nos.indexOf(n) !== i);
  if (dup.length) errs.push(`번호가 중복되었습니다: ${[...new Set(dup)].join(', ')}번`);
  for (const it of items) {
    if (!(Number(it.no) > 0)) errs.push('문항 번호가 비어 있습니다.');
    if (!(Number(it.points) > 0)) errs.push(`${it.no}번: 배점을 입력해 주세요.`);
    if (pageCount && (Number(it.page) < 1 || Number(it.page) > pageCount)) errs.push(`${it.no}번: 쪽 번호가 범위를 벗어났습니다.`);
    if (it.manual) continue; // 선생님이 직접 채점하는 문항은 정답을 비워 둬도 된다
    if (it.parts?.length) {
      it.parts.forEach((p, i) => {
        if (partMissing(p)) errs.push(`${it.no}번 (${i + 1}): 정답을 입력해 주세요.`);
      });
      continue;
    }
    if (it.draw && it.type === 'short') continue; // 그리기 + 답: 답은 비워도 됨
    if (partMissing(it)) {
      errs.push(`${it.no}번: ${it.type === 'mc' ? '객관식 정답을 선택해' : it.type === 'match' ? '선 잇기 정답을 모두 선택해' : it.type === 'essay' ? '모범 답안이나 핵심어를 입력해' : '정답을 입력해'} 주세요.`);
    }
  }
  return errs;
}
