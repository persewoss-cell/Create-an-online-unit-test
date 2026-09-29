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
  it('그리기 문항', () => {
    const q7 = buildKey(parsed.questions[6], '그리기 + 3 cm');
    expect(q7.question).toMatchObject({ type: 'short', draw: true });
    expect(q7.key).toMatchObject({ accepted: ['3 cm'], draw: true });
    const q10 = buildKey(parsed.questions[9], '그리기');
    expect(q10.question.type).toBe('draw');
    const strokes = [{ t: 'line', p: [0, 0, 10, 10] }];
    expect(isBlank({ strokes }, q7.question)).toBe(true); // 답도 써야 함
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
