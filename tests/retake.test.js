import { describe, it, expect } from 'vitest';
import { retakeState } from '../src/lib/retake.js';
import { gradeSubmission } from '../src/lib/grading.js';

const exam = {
  subject: '수학',
  questions: [
    { no: 1, type: 'short', points: 50 },
    { no: 2, type: 'short', points: 25 },
    { no: 3, type: 'mc', points: 25 },
  ],
};
const keys = { 1: { accepted: ['3cm'] }, 2: { accepted: ['<'] }, 3: { choices: [2] } };
const base = { answers: { 1: '3cm', 2: '>', 3: [1] } };

describe('오답 재응시', () => {
  it('처음 틀린 문제만 다시 풀고, 처음 점수는 그대로', () => {
    const sub = { ...base, retake: { on: true } };
    const st = retakeState(exam, keys, sub);
    expect(st.firstWrong).toEqual([2, 3]);
    expect(st.remaining).toEqual([2, 3]);
    expect(st.done).toBe(false);
    const after = { ...sub, retakes: [{ answers: { 2: '＜', 3: [3] }, at: 1 }] };
    const st2 = retakeState(exam, keys, after);
    expect(st2.remaining).toEqual([3]);
    expect(st2.fixed).toEqual([2]);
    expect(gradeSubmission(exam, keys, after).score100).toBe(50); // 원 점수 유지
  });
  it('또 틀리면 계속, 다 맞히면 끝', () => {
    const sub = { ...base, retake: { on: true }, retakes: [{ answers: { 2: '>', 3: [1] } }, { answers: { 2: '<' } }, { answers: { 3: [2] } }] };
    const st = retakeState(exam, keys, sub);
    expect(st.attempts).toBe(3);
    expect(st.remaining).toEqual([]);
    expect(st.done).toBe(true);
  });
  it('선생님이 정답으로 바꾼 문제는 다시 풀지 않음', () => {
    const st = retakeState(exam, keys, { ...base, overrides: { 2: 'correct' }, retake: { on: true } });
    expect(st.firstWrong).toEqual([3]);
  });
});
