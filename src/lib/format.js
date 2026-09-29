import { numberToCircled } from './korean.js';

export const TYPE_LABEL = { mc: '객관식', short: '단답형', essay: '서술형' };
export const STATUS_LABEL = { correct: '정답', wrong: '오답', review: '검토 대기' };

export function answerToText(q, ans) {
  if (ans == null) return '';
  if (q.type === 'mc') return (Array.isArray(ans) ? ans : [ans]).map(Number).sort().map(numberToCircled).join(', ');
  return String(ans);
}

export function keyToText(q, key) {
  if (!key) return '';
  if (q.type === 'mc') return (key.choices || []).map(numberToCircled).join(', ');
  if (q.type === 'essay') {
    const kw = (key.keywords || []).length ? ` [핵심어: ${key.keywords.join(', ')}]` : '';
    return `${key.model || ''}${kw}`;
  }
  return (key.accepted || []).join(' / ');
}
