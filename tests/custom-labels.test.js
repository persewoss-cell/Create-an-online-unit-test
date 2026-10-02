import { describe, it, expect } from 'vitest';
import { toItems, fromItems, validateItems } from '../src/lib/editorModel.js';
import { answerToText, keyToText } from '../src/lib/format.js';
import { choiceLabel } from '../src/lib/parseQuestions.js';
import { gradeAnswer } from '../src/lib/grading.js';

describe('객관식 보기 직접 입력: 한 칸, 필수', () => {
  const it0 = {
    ...toItems([{ no: 1, type: 'mc', points: 10, page: 1, choiceCount: 3 }], { 1: { choices: [2] } })[0],
    customLabels: true,
    choiceLabels: ['', '', ''],
    choices: ['사과', '배', ''],
    keyChoices: [2],
  };
  it('직접 입력 칸을 비우면 저장 안 됨', () => {
    expect(validateItems([it0], 1)).toEqual(['1번: 직접 입력 보기 칸을 모두 채워 주세요.']);
    expect(validateItems([{ ...it0, choiceLabels: ['사과', '배', '감'] }], 1)).toEqual([]);
  });
  it('기호 없이 저장되고, 글로는 보기 내용 → 번호로', () => {
    const { questions, keys } = fromItems([it0]);
    const q = questions[0];
    expect(q.choiceLabels).toEqual(['', '', '']);
    expect(choiceLabel(q, 1)).toBe('');
    expect(answerToText(q, [1])).toBe('사과');
    expect(answerToText(q, [3])).toBe('3번');
    expect(keyToText(q, keys[1])).toBe('배');
    expect(gradeAnswer(q, keys[1], [2]).status).toBe('correct');
  });
  it('기호를 적은 보기는 그대로', () => {
    const { questions } = fromItems([{ ...it0, choiceLabels: ['가', '', '다'] }]);
    expect(answerToText(questions[0], [1, 3])).toBe('가, 다');
  });
});
