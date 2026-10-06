// 3학년 2학기 수학 2. 원 — 화면에서 인식된 20문항 (명령어·엑셀 왕복 시험용)
const s = (no, x = {}) => ({ no, page: 1, type: 'short', choiceCount: 0, choices: [], multi: false, points: 5, text: '', ...x });
export const CIRCLE_QUESTIONS = [
  s(1), s(2), s(3),
  s(4, { fillBoxes: true }),
  s(5, { blankCount: 2 }),
  s(6, { fillBoxes: true }),
  s(7, { draw: true }),
  s(8),
  s(9, { type: 'mc', choiceCount: 3, choiceLabels: ['㉠', '㉡', '㉢'] }),
  s(10, { type: 'draw', draw: true }),
  s(11, { type: 'mc', choiceCount: 2, choiceLabels: ['왼쪽', '오른쪽'], oxBlanks: true }),
  s(12), s(13), s(14),
  s(15, { type: 'parts', manual: true, parts: [{ type: 'essay', choiceCount: 0 }, { type: 'short', choiceCount: 0 }] }),
  s(16), s(17), s(18), s(19), s(20),
];
