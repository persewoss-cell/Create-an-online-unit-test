import { describe, it, expect } from 'vitest';
import { gradeAnswer } from '../src/lib/grading.js';
import { plainSymbols } from '../src/lib/korean.js';

const short = { no: 1, type: 'short', points: 5 };
const essay = { no: 2, type: 'essay', points: 5 };
const g = (q, accepted, ans) => gradeAnswer(q, q.type === 'essay' ? accepted : { accepted: [accepted] }, ans).status;

describe('원·네모 기호는 키보드 글자로 써도 정답', () => {
  it('기호 바꾸기', () => {
    expect(plainSymbols('①②⑩⑳')).toBe('121020');
    expect(plainSymbols('❶➀➊')).toBe('111');
    expect(plainSymbols('1️⃣')).toBe('1');
    expect(plainSymbols('⑴')).toBe('(1)');
    expect(plainSymbols('㉠㉡㉭')).toBe('ㄱㄴㅎ');
    expect(plainSymbols('㈀')).toBe('(ㄱ)');
    expect(plainSymbols('㉮㉯')).toBe('가나');
    expect(plainSymbols('ⓐ🄰🅰🅐')).toBe('aAAA');
    expect(plainSymbols('3㎝')).toBe('3cm');
    expect(plainSymbols('점 ㄱ, 하늘')).toBe('점 ㄱ, 하늘'); // 보통 글자는 그대로
  });
  it('단답형', () => {
    expect(g(short, '①', '1')).toBe('correct');
    expect(g(short, '①', '①')).toBe('correct');
    expect(g(short, '①', '2')).toBe('wrong');
    expect(g(short, '㉠', 'ㄱ')).toBe('correct');
    expect(g(short, '㉠, ㉢', 'ㄱ, ㄷ')).toBe('correct');
    expect(g(short, '㉮', '가')).toBe('correct');
    expect(g(short, '⑴', '1')).toBe('correct');
    expect(g(short, '점 ㉠', '점 ㄱ')).toBe('correct');
    expect(g(short, '3', '③')).toBe('correct'); // 반대로 학생이 기호를 써도
  });
  it('칸이 여러 개인 단답형', () => {
    const q = { ...short, blankCount: 2 };
    expect(gradeAnswer(q, { boxes: ['②', '㉡'] }, ['2', 'ㄴ']).status).toBe('correct');
  });
  it('서술형 핵심어', () => {
    const key = { model: '㉠은 물이 증발하기 때문이다.', keywords: ['㉠', '증발'] };
    expect(g(essay, key, 'ㄱ은 물이 증발하기 때문입니다.')).toBe('correct');
  });
});
