// 실제 학교 시험지(3학년 2학기 국어 2단원)로 인식·정답·채점 전체 점검
// 시험지 PDF는 저작권 때문에 저장소에 넣지 않는다. 가지고 있으면 REAL_SAMPLE_PDF=경로 로 지정해서 실행.
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync } from 'node:fs';
import { extract } from '../scripts/inspect-pdf.mjs';
import { parseQuestions, fillDefaultPoints } from '../src/lib/parseQuestions.js';
import { buildKey } from '../src/lib/parseAnswers.js';
import { buildAnswerTemplate, readAnswerSheet } from '../src/lib/answerSheet.js';
import { gradeAnswer } from '../src/lib/grading.js';

const ANSWERS = {
  1: '④', 2: '④', 3: '①', 4: '(3) ○', 5: '㉮', 6: '(예) 우울한 표정 / 걱정하는 목소리 등', 7: '⑤', 8: '㉰',
  9: '로제타 선생님', 10: '⑤', 11: '㉰', 12: '(예) 박에스더가 병을 무서워하지 않고 환자를 돌보는 모습이 존경스러웠다. 등',
  13: '주인', 14: '⑤', 15: '㉰', 16: '(1) - ① (2) - ②', 17: '(2) ○', 18: '채린', 19: '④',
  20: '(예) 책 읽기와 그림 그리기를 좋아한다. / 비빔밥을 잘 먹는다. / 생일은 6월 2일이고, 혈액형은 B형이다. / 야구 선수가 되고 싶어 한다. / 보라색을 좋아한다. 등',
};

const PDF = process.env.REAL_SAMPLE_PDF || 'samples/real_q.pdf';
const HAS_PDF = existsSync(PDF);

let parsed;
let keyed;
beforeAll(async () => {
  if (!HAS_PDF) return;
  parsed = parseQuestions(await extract(PDF));
  // 엑셀 양식 → 교사 작성 → 다시 읽기
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await buildAnswerTemplate(parsed.questions.map((q) => q.no)));
  const ws = wb.getWorksheet('정답');
  for (const [no, a] of Object.entries(ANSWERS)) ws.getCell(`B${Number(no) + 1}`).value = a;
  const { answers } = await readAnswerSheet(await wb.xlsx.writeBuffer());
  const qs = fillDefaultPoints(parsed.questions);
  keyed = qs.map((q) => buildKey(q, answers.get(q.no)));
});

describe.skipIf(!HAS_PDF)('실제 국어 시험지', () => {
  it('20문항과 지문 묶음을 모두 찾는다', () => {
    expect(parsed.questions.map((q) => q.no)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(parsed.groups.map((g) => `${g.from}~${g.to}`)).toEqual(['1~4', '5~6', '7~8', '9~12', '13~15', '16~18', '19~20']);
    expect(parsed.questions[3].group).toBe('g1');
    expect(parsed.warnings).toEqual([]);
  });

  it('모든 문항에 자를 영역이 있다', () => {
    for (const q of parsed.questions) expect(q.regions.length, `${q.no}번`).toBeGreaterThan(0);
    for (const g of parsed.groups) expect(g.regions.length, `지문 ${g.from}`).toBeGreaterThan(0);
  });

  it('엑셀의 정답만으로 유형이 정해진다', () => {
    const t = Object.fromEntries(keyed.map(({ question: q }) => [q.no, q.type]));
    expect(t).toMatchObject({
      1: 'mc', 4: 'mc', 5: 'mc', 6: 'essay', 9: 'short', 12: 'essay', 13: 'short', 16: 'match', 17: 'mc', 18: 'short', 20: 'essay',
    });
    const k = Object.fromEntries(keyed.map(({ question: q, key }) => [q.no, key]));
    expect(k[1]).toEqual({ choices: [4] });
    expect(k[4]).toEqual({ choices: [3] });
    expect(k[5]).toEqual({ choices: [1] });
    expect(k[16]).toEqual({ pairs: [1, 2] });
    expect(k[6].examples).toEqual(['우울한 표정', '걱정하는 목소리']);
    expect(keyed[4].question.choiceLabels).toEqual(['㉮', '㉯', '㉰']);
    expect(keyed[3].question.choiceLabels).toEqual(['(1)', '(2)', '(3)']);
    const total = keyed.reduce((s, x) => s + x.question.points, 0);
    expect(total).toBe(100);
  });

  it('채점', () => {
    const g = (no, ans) => gradeAnswer(keyed[no - 1].question, keyed[no - 1].key, ans).status;
    expect(g(1, [4])).toBe('correct');
    expect(g(5, [1])).toBe('correct');
    expect(g(16, [1, 2])).toBe('correct');
    expect(g(16, [2, 1])).toBe('wrong');
    expect(g(6, '걱정하는 목소리로 읽는다')).toBe('correct');
    expect(g(6, '슬픈 목소리')).toBe('review');
    expect(g(9, '로제타 선생님')).toBe('correct');
    expect(g(13, '주인')).toBe('correct');
    expect(g(13, '색깔')).toBe('wrong');
    expect(g(12, '에스더가 대단하다고 생각했다')).toBe('review');
  });
});
