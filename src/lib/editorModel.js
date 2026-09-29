// 교사 편집 화면에서 쓰는 형태 <-> 저장 형태(questions + keys) 변환
import { splitAlternatives } from './parseAnswers.js';

export function toItems(questions, keys) {
  return questions.map((q) => {
    const k = keys[q.no] || {};
    return {
      ...q,
      choices: q.choices || [],
      keyChoices: k.choices || [],
      answerText: (k.accepted || []).join(' / '),
      model: k.examples?.length ? k.examples.join(' / ') : k.model || '',
      keywordsText: (k.keywords || []).join(', '),
      keyPairs: k.pairs || [],
      open: !!k.open,
    };
  });
}

export function fromItems(items) {
  const questions = [];
  const keys = {};
  for (const it of items) {
    const q = {
      no: Number(it.no),
      page: Math.max(1, Number(it.page) || 1),
      type: it.type,
      choiceCount: it.type === 'mc' ? Math.max(2, Number(it.choiceCount) || 5) : 0,
      choices: it.type === 'mc' ? (it.choices || []).slice(0, Number(it.choiceCount) || 5) : [],
      multi: it.type === 'mc' && (!!it.multi || (it.keyChoices || []).length > 1),
      points: Number(it.points) || 0,
      text: it.text || '',
      choiceLabels: it.type === 'mc' && it.choiceLabels ? it.choiceLabels.slice(0, Number(it.choiceCount) || 5) : null,
      matchCount: it.type === 'match' ? Math.max(1, Number(it.matchCount) || 2) : 0,
      matchLabels: it.type === 'match' ? it.matchLabels || null : null,
      group: it.group || null,
      draw: it.type === 'draw' || !!it.draw,
      regions: it.regions || [],
      anchor: it.anchor || null,
      blanks: it.blanks || [],
    };
    questions.push(q);
    if (it.type === 'draw') {
      keys[q.no] = { draw: true };
    } else if (it.type === 'mc') {
      keys[q.no] = { choices: [...new Set(it.keyChoices || [])].filter((n) => n <= q.choiceCount).sort((a, b) => a - b) };
    } else if (it.type === 'match') {
      keys[q.no] = { pairs: Array.from({ length: q.matchCount }, (_, i) => Number(it.keyPairs?.[i]) || 0) };
    } else if (it.type === 'essay') {
      const model = (it.model || '').trim();
      keys[q.no] = {
        model,
        keywords: (it.keywordsText || '').split(/\s*[,，]\s*/).map((s) => s.trim()).filter(Boolean),
        ...(it.open ? { examples: model.split(/\s*\/\s*/).filter(Boolean), open: true } : {}),
      };
    } else {
      keys[q.no] = { accepted: splitAlternatives(it.answerText || '') };
    }
  }
  for (const q of questions) if (q.draw && keys[q.no]) keys[q.no].draw = true;
  return { questions, keys };
}

export function newItem(no, page = 1) {
  return {
    no, page, type: 'short', choiceCount: 5, choices: [], multi: false, points: 0, text: '',
    keyChoices: [], answerText: '', model: '', keywordsText: '',
  };
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
    if (pageCount && (Number(it.page) < 1 || Number(it.page) > pageCount)) errs.push(`${it.no}번: 쪽 번호가 범위를 벗어났습니다.`);
    if (!(Number(it.points) > 0)) errs.push(`${it.no}번: 배점을 입력해 주세요.`);
    if (it.type === 'mc' && !(it.keyChoices || []).length) errs.push(`${it.no}번: 객관식 정답을 선택해 주세요.`);
    if (it.type === 'match' && !(Array.from({ length: Number(it.matchCount) || 2 }, (_, i) => it.keyPairs?.[i]).every(Boolean))) {
      errs.push(`${it.no}번: 선 잇기 정답을 모두 선택해 주세요.`);
    }
    if (it.type === 'short' && !String(it.answerText || '').trim()) errs.push(`${it.no}번: 정답을 입력해 주세요.`);
    if (it.type === 'essay' && !String(it.model || '').trim() && !String(it.keywordsText || '').trim()) {
      errs.push(`${it.no}번: 모범 답안이나 핵심어를 입력해 주세요.`);
    }
  }
  return errs;
}
