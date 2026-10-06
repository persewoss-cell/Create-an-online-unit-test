import { describe, it, expect } from 'vitest';
import { buildAnswerPrompt } from '../src/lib/aiPrompt.js';

describe('buildAnswerPrompt', () => {
  const qs = [
    { no: 1, type: 'mc', choiceCount: 5 },
    { no: 2, type: 'short', blankCount: 3 },
    { no: 3, type: 'draw' },
  ];
  const p = buildAnswerPrompt(qs, '5학년 1학기 수학 1. 약수와 배수 단원평가');
  it('번호 없이 정답만 위아래로, 문항 수만큼 줄을 적게 한다', () => {
    expect(p).toContain('정확히 3줄');
    expect(p).toContain('1번부터 3번까지');
    
    expect(p).toContain('문항 번호, "1.", "정답:", 제목 줄, 빈 줄은 쓰지 마');
    expect(p).not.toContain('번호<탭>정답');
    expect(p).not.toContain('번호\t정답');
  });
  it('배점이 있으면 탭 뒤에, 부분 점수는 ; 로, 없으면 쓰지 않게 한다', () => {
    expect(p).toContain('3 ; 2');
    expect(p).toMatch(/배점이 어디에도 적혀 있지 않은 문항은 탭도 배점도 쓰지 말고/);
    expect(p).toContain('20 cm\t3 ; 2');
    expect(p).toContain('3 cm, 6 cm\t2 ; 2');
    expect(p).toMatch(/답마다 점수가 분명히 적혀 있을 때만/);
    expect(p).toMatch(/네가 판단해서 부분 점수를 만들면 안 돼/);
    expect(p).toMatch(/배점을 짐작하거나 100점을 나눠서 만들지 마/);
  });
  it('문항마다 답 쓰는 법을 붙인다', () => {
    expect(p).toContain('- 1번: ① ② ③ ④ ⑤ 중에서 적기 (예: ①)');
    expect(p).toContain('- 2번: 답 칸 3개');
    expect(p).toContain('- 3번: ✏️ 그림만 그리는 문항 — 그리기 라고 적기');
  });
  it('사이트 규칙(; 부분, / 여러 답, 검토)을 담는다', () => {
    expect(p).toMatch(/; 로 구분/);
    expect(p).toMatch(/\/ 로 구분/);
    expect(p).toMatch(/검토/);
  });
});
