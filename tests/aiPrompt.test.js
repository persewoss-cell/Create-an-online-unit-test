import { describe, it, expect } from 'vitest';
import { buildAnswerPrompt } from '../src/lib/aiPrompt.js';

describe('buildAnswerPrompt', () => {
  const qs = [
    { no: 1, type: 'mc', choiceCount: 5 },
    { no: 2, type: 'short', blankCount: 3 },
    { no: 3, type: 'draw' },
  ];
  const p = buildAnswerPrompt(qs, '5학년 1학기 수학 1. 약수와 배수 단원평가');
  it('번호 범위·문항 수와 탭 형식을 알려 준다', () => {
    expect(p).toContain('1번부터 3번까지 3문항');
    expect(p).toContain('번호<탭>정답');
    expect(p).toContain('번호\t정답');
  });
  it('문항마다 답 쓰는 법을 붙인다', () => {
    expect(p).toContain('- 1번: ① ② ③ ④ ⑤ 중에서 적기 (예: ①)');
    expect(p).toContain('- 2번: 답 칸 3개');
    expect(p).toContain('- 3번: ✏️ 그리기');
  });
  it('사이트 규칙(; 부분, / 여러 답, 검토)을 담는다', () => {
    expect(p).toMatch(/; 로 구분/);
    expect(p).toMatch(/\/ 로 구분/);
    expect(p).toMatch(/검토/);
  });
});
