import { describe, it, expect } from 'vitest';
import { gradeAnswer } from '../src/lib/grading.js';
import { buildKey } from '../src/lib/parseAnswers.js';
import { splitCommas } from '../src/lib/korean.js';
import { toItems, fromItems, validateItems, boxAnswersOf } from '../src/lib/editorModel.js';
import { keyToText, shortKeyText } from '../src/lib/format.js';

const q = { no: 1, type: 'short', blankCount: 3, points: 5, page: 1 };

describe('칸마다 정답 (단답형 답 칸 여러 개)', () => {
  const key = { boxes: ['봄', '여름 / 하절기', '가을'], accepted: ['봄, 여름, 가을'] };

  it('순서대로 맞으면 정답, 칸 안의 여러 답 인정', () => {
    expect(gradeAnswer(q, key, ['봄', '하절기', '가을']).status).toBe('correct');
  });
  it('순서가 바뀌면 오답 (순서 지키기)', () => {
    expect(gradeAnswer(q, key, ['여름', '봄', '가을']).status).toBe('wrong');
  });
  it('"순서 무관"이면 순서가 달라도 정답', () => {
    expect(gradeAnswer(q, { ...key, anyOrder: true }, ['가을', '봄', '여름']).status).toBe('correct');
    expect(gradeAnswer(q, { ...key, anyOrder: true }, ['가을', '봄', '겨울']).status).toBe('wrong');
  });
  it('예전 형식(쉼표 한 줄)도 그대로 채점', () => {
    expect(gradeAnswer(q, { accepted: ['봄, 여름, 가을'] }, ['봄', '여름', '가을']).status).toBe('correct');
  });
  it('정답 표시', () => {
    expect(keyToText(q, key)).toBe('[1] 봄  [2] 여름 / 하절기  [3] 가을');
    expect(shortKeyText(q, key)).toBe('봄, 여름, 가을');
  });
});

describe('편집 화면 ↔ 저장', () => {
  it('예전 한 줄 정답을 칸별로 나눠 보여 주고, 저장하면 칸별 정답으로', () => {
    const [it0] = toItems([q], { 1: { accepted: ['3, 6, 9'] } });
    expect(it0.boxAnswers).toEqual(['3', '6', '9']);
    const { keys } = fromItems([{ ...it0, boxAnswers: ['3', '6 / 육', '9'], anyOrder: true }]);
    expect(keys[1]).toEqual({ boxes: ['3', '6 / 육', '9'], accepted: ['3, 6, 9'], anyOrder: true });
  });
  it('칸 수보다 정답이 모자라면 저장 전에 알려 준다', () => {
    const it0 = { ...q, boxAnswers: ['3', '', '9'] };
    expect(validateItems([it0], 1).join()).toMatch(/정답을 입력/);
  });
  it('칸 수를 늘리면 칸별 정답 칸도 늘어난다', () => {
    expect(boxAnswersOf({ blankCount: 4, boxAnswers: ['가', '나'] })).toEqual(['가', '나', '', '']);
  });
});

describe('엑셀 정답의 쉼표 수에 맞춰 답 칸 수 조정', () => {
  const one = { no: 2, type: 'short', points: 5, page: 1 };
  it('칸 하나로 인식했어도 엑셀에 쉼표로 3개 → 칸 3개', () => {
    const { question, key } = buildKey(one, '3, 6, 9');
    expect(question.blankCount).toBe(3);
    expect(gradeAnswer(question, key, ['3', '6', '9']).status).toBe('correct');
    expect(gradeAnswer(question, key, ['3', '6', '8']).status).toBe('wrong');
  });
  it('칸 여러 개로 인식했어도 엑셀 답이 하나 → 칸 하나', () => {
    const { question } = buildKey({ ...one, blankCount: 3, answerSpots: [{}, {}, {}] }, '24');
    expect(question.blankCount || 0).toBeLessThan(2);
  });
  it('1,000 같은 천 단위 쉼표는 나누지 않음', () => {
    const { question, key } = buildKey(one, '1,000원');
    expect(question.blankCount || 0).toBeLessThan(2);
    expect(gradeAnswer(question, key, '1000원').status).toBe('correct');
    const two = buildKey(one, '1,000, 2,500');
    expect(two.question.blankCount).toBe(2);
    expect(gradeAnswer(two.question, two.key, ['1,000', '2500']).status).toBe('correct');
  });
  it('쉼표 나누기', () => {
    expect(splitCommas('3, 6，9、12')).toEqual(['3', '6', '9', '12']);
    expect(splitCommas('12,500, 3')).toEqual(['12,500', '3']);
  });
});

describe('엑셀로 바뀐 칸 수가 편집기를 거쳐 저장까지', () => {
  it('toItems → fromItems 해도 칸 수·칸별 정답 유지', () => {
    const { question, key } = buildKey({ no: 5, type: 'short', points: 5, page: 1 }, '3, 6, 9');
    const items = toItems([question], { 5: key });
    const out = fromItems(items);
    expect(out.questions[0].blankCount).toBe(3);
    expect(gradeAnswer(out.questions[0], out.keys[5], ['3', '6', '9']).status).toBe('correct');
  });
});
