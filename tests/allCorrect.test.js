import { describe, it, expect } from 'vitest';
import { gradeSubmission } from '../src/lib/grading.js';
import { retakeState } from '../src/lib/retake.js';

const exam = {
  questions: [
    { no: 1, type: 'mc', choiceCount: 4, points: 50 },
    { no: 2, type: 'short', blankCount: 1, points: 50 },
  ],
};
const keys = { 1: { choices: [3] }, 2: { text: ['6'] } };

describe('모두 정답 처리', () => {
  it('처리한 문항은 무엇을 썼든(빈 답 포함) 정답, 선생님 판정보다 우선', () => {
    const wrong = { answers: { 1: [1], 2: '7' } };
    expect(gradeSubmission(exam, keys, wrong).score100).toBe(0);
    const e2 = { ...exam, allCorrect: [1] };
    const r = gradeSubmission(e2, keys, wrong);
    expect(r.items[0]).toMatchObject({ status: 'correct', earned: 50, allCorrect: true });
    expect(r.score100).toBe(50);
    expect(gradeSubmission(e2, keys, { answers: {} }).items[0].status).toBe('correct');
    expect(gradeSubmission(e2, keys, { answers: { 1: [1] }, overrides: { 1: 'wrong' } }).items[0].status).toBe('correct');
  });
  it('모두 정답 처리한 문항은 오답 재응시에서 빠진다', () => {
    const sub = { answers: { 1: [1], 2: '7' } };
    expect(retakeState(exam, keys, sub, gradeSubmission(exam, keys, sub)).firstWrong).toContain(1);
    const e2 = { ...exam, allCorrect: ['1'] }; // 문자열 번호로 저장돼 있어도
    const rt = retakeState(e2, keys, sub, gradeSubmission(e2, keys, sub));
    expect(rt.firstWrong).not.toContain(1);
  });
});
