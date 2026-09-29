// 실제 수학 시험지(3학년 2학기 2단원 원)로 인식·그리기 문항 점검
// 저작권 때문에 PDF는 저장소에 넣지 않는다: REAL_MATH_PDF=경로 로 지정해서 실행
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync } from 'node:fs';
import { extract } from '../scripts/inspect-pdf.mjs';
import { parseQuestions } from '../src/lib/parseQuestions.js';
import { buildKey } from '../src/lib/parseAnswers.js';
import { gradeAnswer, isBlank } from '../src/lib/grading.js';

const PDF = process.env.REAL_MATH_PDF || 'samples/real_math.pdf';
const HAS = existsSync(PDF);
let parsed;
beforeAll(async () => {
  if (HAS) parsed = parseQuestions(await extract(PDF));
});

describe.skipIf(!HAS)('실제 수학 시험지', () => {
  it('머리글의 "2. 원"을 문항으로 착각하지 않고 20문항을 찾는다', () => {
    expect(parsed.questions.map((q) => q.no)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(parsed.questions[0].text).toMatch(/^원의 중심을 찾아/);
    expect(parsed.warnings).toEqual([]);
  });
  it('㉠㉡㉢ 보기와 답 칸 위치', () => {
    expect(parsed.questions[8].choiceLabels).toEqual(['㉠', '㉡', '㉢']);
    expect(parsed.questions[0].blanks).toHaveLength(1);
    expect(parsed.questions[10].blanks).toHaveLength(2);
  });
  it('반복되는 쪽 머리글은 문항 영역에 들어가지 않는다', () => {
    for (const q of parsed.questions) for (const r of q.regions) expect(r.y0, `${q.no}번`).toBeGreaterThan(0.07);
  });
  it('문제지만 보고 답 쓰는 방식을 알아낸다', () => {
    const q = Object.fromEntries(parsed.questions.map((x) => [x.no, x]));
    expect(q[7]).toMatchObject({ type: 'short', draw: true }); // 반지름을 그어 보고 … ( )
    expect(q[10]).toMatchObject({ type: 'draw', draw: true }); // 똑같이 그려 보세요
    expect(q[11]).toMatchObject({ type: 'mc', choiceCount: 2, choiceLabels: ['왼쪽', '오른쪽'] }); // ( ) ( ) 중 ○표
    expect(q[5].fillBoxes).toBe(true);
    expect(q[14].type).toBe('short'); // 다음 문항의 "서술형" 머리표에 속지 않음
    expect(q[15]).toMatchObject({ type: 'essay', manual: true }); // 풀이 과정
    const k11 = buildKey(q[11], '오른쪽');
    expect(k11.key.choices).toEqual([2]);
    expect(buildKey(q[11], '2').key.choices).toEqual([2]);
    expect(buildKey(q[11], '(1)').key.choices).toEqual([1]);
    const k10 = buildKey(q[10], '');
    expect(k10.key.draw).toBe(true);
    const k5 = buildKey(q[5], 'ㄱㄷ, ㄱㄷ');
    expect(k5.question.blankCount).toBe(2);
    expect(gradeAnswer(k5.question, k5.key, ['ㄱㄷ', 'ㄱㄷ']).status).toBe('correct');
    expect(gradeAnswer(k5.question, k5.key, ['ㄱㄷ', 'ㄴㄹ']).status).toBe('wrong');
    expect(isBlank(['ㄱㄷ', ''], k5.question)).toBe(true);
  });

  it('그리기 문항', () => {
    const q7 = buildKey(parsed.questions[6], '그리기 + 3 cm');
    expect(q7.question).toMatchObject({ type: 'short', draw: true });
    expect(q7.key).toMatchObject({ accepted: ['3 cm'], draw: true });
    const q10 = buildKey(parsed.questions[9], '그리기');
    expect(q10.question.type).toBe('draw');
    const strokes = [{ t: 'line', p: [0, 0, 10, 10] }];
    expect(isBlank({ strokes }, q7.question)).toBe(false); // 그렸으면 답 칸은 비워도 됨
    expect(isBlank({ strokes: [], text: '' }, q7.question)).toBe(true);
    expect(isBlank({ strokes, text: '3cm' }, q7.question)).toBe(false);
    expect(gradeAnswer(q7.question, q7.key, { strokes, text: '3cm' }).status).toBe('review');
    expect(gradeAnswer(q10.question, q10.key, { strokes }).status).toBe('review');
    const q9 = buildKey(parsed.questions[8], '㉡');
    expect(q9.question.type).toBe('mc');
    expect(q9.key).toEqual({ choices: [2] });
    const q11 = buildKey(parsed.questions[10], '(2)');
    expect(q11.question.choiceCount).toBe(2);
  });
});
