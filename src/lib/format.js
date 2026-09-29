import { choiceLabel } from './parseQuestions.js';

export const TYPE_LABEL = { mc: '객관식', short: '단답형', essay: '서술형', match: '선 잇기', draw: '그리기', parts: '여러 유형' };

const partQ = (q, i) => ({ ...q.parts[i], no: q.no, parts: undefined, draw: false, manual: false });
export const STATUS_LABEL = { correct: '정답', wrong: '오답', review: '검토 대기' };

export function matchLabel(q, n) {
  return q?.matchLabels?.[n - 1] || choiceLabel(null, n);
}

export function answerToText(q, ans) {
  if (ans == null) return '';
  if (q.parts?.length) {
    return q.parts.map((_, i) => `(${i + 1}) ${answerToText(partQ(q, i), ans.parts?.[i]) || '-'}`).join('  ');
  }
  if (q.type === 'draw') return ans.strokes?.length ? '(그림)' : '';
  if (q.draw) return answerToText({ ...q, draw: false }, ans.text);
  if (Array.isArray(ans) && q.type !== 'mc' && q.type !== 'match') return ans.join(', ');
  if (q.type === 'mc') {
    return (Array.isArray(ans) ? ans : [ans]).map(Number).sort((a, b) => a - b).map((n) => choiceLabel(q, n)).join(', ');
  }
  if (q.type === 'match') {
    return (Array.isArray(ans) ? ans : []).map((v, i) => `(${i + 1})-${v ? matchLabel(q, v) : '?'}`).join(' ');
  }
  return String(ans);
}

export function keyToText(q, key) {
  if (!key) return '';
  if (q.parts?.length && !(q.manual && !key.parts)) {
    return q.parts.map((_, i) => `(${i + 1}) ${keyToText(partQ(q, i), key.parts?.[i]) || '-'}`).join('  ');
  }
  if (q.manual && !hasKeyContent(key)) return '(선생님이 직접 채점)';
  if (q.type === 'draw') return '(그리기 — 선생님 확인)';
  if (q.draw) return `(그리기) ${keyToText({ ...q, draw: false }, key)}`;
  if (q.type === 'mc') return (key.choices || []).map((n) => choiceLabel(q, n)).join(', ');
  if (q.type === 'match') return answerToText(q, key.pairs || []);
  if (q.type === 'essay') {
    if (key.examples?.length) return `(예) ${key.examples.join(' / ')}`;
    const kw = (key.keywords || []).length ? ` [핵심어: ${key.keywords.join(', ')}]` : '';
    return `${key.model || ''}${kw}`;
  }
  return (key.accepted || []).join(' / ');
}

/** 채점된 시험지에 빨간 글씨로 쓸 짧은 정답 */
export function shortKeyText(q, key) {
  if (!key) return '';
  if (q.parts?.length) return q.parts.map((_, i) => `(${i + 1}) ${shortKeyText(partQ(q, i), key.parts?.[i])}`).join(' ');
  if (q.type === 'draw') return '';
  if (q.draw) return shortKeyText({ ...q, draw: false }, key);
  if (q.type === 'essay') {
    const t = key.examples?.length ? key.examples[0] : key.model || '';
    return t.length > 24 ? `${t.slice(0, 24)}…` : t;
  }
  if (q.type === 'short') return (key.accepted || [])[0] || '';
  return keyToText(q, key);
}

function hasKeyContent(key) {
  return !!(key.choices?.length || key.pairs?.some(Boolean) || key.accepted?.some((a) => a.trim()) || key.model?.trim() || key.keywords?.length);
}

/** 비교용: 빈 값·기본값을 빼고 키 순서를 맞춘 문자열 (실제로 바뀐 문항만 찾기 위해) */
export function stableKey(v) {
  const norm = (x) => {
    if (Array.isArray(x)) return x.map(norm);
    if (x && typeof x === 'object') {
      const out = {};
      for (const k of Object.keys(x).sort()) {
        const val = norm(x[k]);
        const empty = val === false || val === null || val === undefined || val === 0 || val === '' ||
          (Array.isArray(val) && (val.length === 0 || val.every((e) => e === '' || e == null))) ||
          (val && typeof val === 'object' && !Array.isArray(val) && !Object.keys(val).length);
        if (!empty) out[k] = val;
      }
      return out;
    }
    return x;
  };
  return JSON.stringify(norm(v));
}
