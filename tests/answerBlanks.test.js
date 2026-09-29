import { describe, it, expect } from 'vitest';
import { parseQuestions, pickAnswerBlanks } from '../src/lib/parseQuestions.js';

// 줄 하나: 글자와 그 줄의 "( )" 칸 수
let y = 0.1;
const L = (text, n = (text.match(/\(\s*\)/g) || []).length) => {
  y += 0.03;
  return { text, x0: 0.1, x1: 0.9, top: y, bottom: y + 0.02, col: 0, colCount: 1, blanks: Array.from({ length: n }, (_, i) => ({ x0: 0.2 + i * 0.2, x1: 0.3 + i * 0.2 })) };
};
const seg = (...lines) => lines.map((l) => ({ ...l, page: 1 }));

describe('답 칸 고르기', () => {
  it('공통으로 들어갈 말: 문제 괄호·지문 괄호는 빼고 따로 있는 답 칸 하나', () => {
    const s = seg(
      L('17. 다음 ( ) 안에 공통으로 들어갈 말을 쓰시오.'),
      L('( )(이)란 사람과 더불어 살아가는 동물을'),
      L('뜻합니다. 오늘날 우리 사회에는 ( )과/와 더'),
      L('불어 사는 문화가 널리 퍼지고 있습니다.'),
      L('(\t)'),
    );
    const r = pickAnswerBlanks(s, s.map((l) => l.text).join('\n'));
    expect(r.blanks).toHaveLength(1);
    expect(r.common).toBe(true);
  });
  it('( ) 안에 들어갈 말 + 보기 속 괄호, 따로 된 답 칸이 없으면 보기 속 괄호 하나', () => {
    const s = seg(L('3. ( ) 안에 들어갈 알맞은 말을 쓰시오.'), L('물이 얼면 ( )이/가 됩니다.'));
    expect(pickAnswerBlanks(s, '').blanks).toHaveLength(1);
  });
  it('문장 끝마다 붙은 ○표 칸은 모두 답 칸', () => {
    const s = seg(
      L('17 알맞은 것에 ○표를 하시오.'),
      L('(1) 손과 머리를 쓰는 기술이 있다. (\t)'),
      L('(2) 손 기술에는 얼굴 막기가 있다.'),
      L('(\t)'),
      L('(3) 발 기술이 있다. (\t)'),
    );
    expect(pickAnswerBlanks(s, '').blanks).toHaveLength(3);
  });
  it('단위가 붙은 답 칸 줄', () => {
    const s = seg(L('3 원의 지름은 몇 cm일까요?'), L('(\t) cm'));
    expect(pickAnswerBlanks(s, '').blanks).toHaveLength(1);
  });
  it('문항 전체: 공통 괄호 문제는 입력칸 하나(단답형)', () => {
    y = 0.05;
    const pages = [{
      page: 1,
      lines: [
        L('1. 다음 ( ) 안에 공통으로 들어갈 말을 쓰시오.'),
        L('( )(이)란 사람과 더불어 살아가는 동물을'),
        L('뜻합니다. 우리 사회에는 ( )과/와 더'),
        L('(\t)'),
        L('2. 다음 중 알맞은 것은?'),
        L('① 가 ② 나 ③ 다'),
      ],
    }];
    const { questions } = parseQuestions(pages);
    expect(questions[0].type).toBe('short');
    expect(questions[0].blanks).toHaveLength(1);
    expect(questions[0].commonBlank).toBe(true);
    expect(questions[0].blankCount || 0).toBeLessThan(2);
  });
});
