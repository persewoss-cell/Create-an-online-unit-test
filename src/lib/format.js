import { splitCommas } from './korean.js';
import { choiceLabel } from './parseQuestions.js';

export const TYPE_LABEL = { mc: '객관식', short: '단답형', essay: '서술형', match: '선 잇기', draw: '그리기', parts: '여러 유형' };

const partQ = (q, i) => ({ ...q.parts[i], no: q.no, parts: undefined, draw: false, manual: false });
export const STATUS_LABEL = { correct: '정답', wrong: '오답', review: '검토 대기' };

/** 글로 적을 때의 보기 이름: 기호 → (기호가 없으면) 보기 내용 → n번 */
export function choiceName(q, n) {
  return choiceLabel(q, n) || String(q?.choices?.[n - 1] || '').trim() || `${n}번`;
}

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
    return (Array.isArray(ans) ? ans : [ans]).map(Number).sort((a, b) => a - b).map((n) => choiceName(q, n)).join(', ');
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
  if (q.type === 'mc') return (key.choices || []).map((n) => choiceName(q, n)).join(', ');
  if (q.type === 'match') return answerToText(q, key.pairs || []);
  if (q.type === 'essay') {
    if (key.examples?.length) return `(예) ${key.examples.join(' / ')}`;
    const kw = (key.keywords || []).length ? ` [핵심어: ${key.keywords.join(', ')}]` : '';
    return `${key.model || ''}${kw}`;
  }
  if (key.boxes?.length) {
    const alts = boxAlternatives(key);
    const text = alts.length > 1 ? alts.map((a, i) => `[${i + 1}] ${a.join(' / ')}`).join('  ') : alts.flat().join(' / ');
    return key.anyOrder ? `${text} (순서 무관)` : text;
  }
  return (key.accepted || []).join(' / ');
}

/**
 * 칸이 여러 개인 단답형의 칸별 정답 (칸마다 "가 / 나"처럼 여러 답 인정 가능)
 * 새 형식 key.boxes, 예전 형식 key.accepted("가, 나" 쉼표로 칸 구분) 모두 읽는다.
 * @returns {string[][]} 칸마다 인정하는 답 목록
 */
export function boxAlternatives(key, n) {
  if (!key) return [];
  if (key.boxes?.length) return key.boxes.map((b) => String(b || '').split(/\s*\/\s*/).map((x) => x.trim()).filter(Boolean));
  const sets = (key.accepted || []).map((a) => splitCommas(a));
  const len = n || Math.max(0, ...sets.map((s) => s.length));
  return Array.from({ length: len }, (_, i) => [...new Set(sets.map((s) => s[i]).filter(Boolean))]);
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
  if (q.type === 'short' && key.boxes?.length) return boxAlternatives(key).map((a) => a[0] || '').join(', ');
  if (q.type === 'short') return (key.accepted || [])[0] || '';
  return keyToText(q, key);
}

function hasKeyContent(key) {
  return !!(key.choices?.length || key.pairs?.some(Boolean) || key.accepted?.some((a) => a.trim()) || key.boxes?.some((b) => String(b).trim()) || key.model?.trim() || key.keywords?.length);
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
