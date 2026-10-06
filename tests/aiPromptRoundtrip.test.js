// 명령어를 받은 AI의 답(시뮬레이션)을 엑셀 B2에 붙여 넣고 → 사이트가 읽어 문항에 넣기까지
import { describe, it, expect } from 'vitest';
import { buildAnswerPrompt } from '../src/lib/aiPrompt.js';
import { buildAnswerTemplate, readAnswerSheet, withSheetPoints } from '../src/lib/answerSheet.js';
import { buildKey } from '../src/lib/parseAnswers.js';
import { toItems, fromItems, answerCount } from '../src/lib/editorModel.js';
import { CIRCLE_QUESTIONS } from './fixtures-circle.js';

// 정답지 가정: 1~20번 각 5점. 5번은 "각 2.5점", 15번은 "(1) 3점 (2) 2점". 나머지는 부분 점수 표시 없음
const AI_OUT = [
  '원의 중심\t5',
  '반지름\t5',
  '지름\t5',
  '2\t5',
  '5 cm, 10 cm\t2.5 ; 2.5',
  '14\t5',
  '그리기 + 4 cm\t5',
  '원의 중심\t5',
  '㉡\t5',
  '그리기\t5',
  '오른쪽\t5',
  '8 cm\t5',
  '6 cm\t5',
  '16 cm\t5',
  '선분 ㄱㄴ의 길이는 두 원의 지름의 길이의 합과 같습니다. ; 20 cm\t3 ; 2',
  '12 cm\t5',
  '3 cm\t5',
  '24 cm\t5',
  '5 cm\t5',
  '7 cm\t5',
];

/** 엑셀에서 B2를 누르고 붙여 넣기: 줄 → 행, 탭 → 다음 열 */
async function pasteAtB2(text) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await buildAnswerTemplate(CIRCLE_QUESTIONS));
  const ws = wb.getWorksheet('정답');
  text.split('\n').forEach((line, i) => {
    line.split('\t').forEach((cell, j) => {
      ws.getCell(2 + i, 2 + j).value = cell;
    });
  });
  return readAnswerSheet(await wb.xlsx.writeBuffer());
}

async function applySheet(text) {
  const { answers, points, partPoints } = await pasteAtB2(text);
  const items = toItems(CIRCLE_QUESTIONS, {});
  const next = items.map((it) => {
    const no = Number(it.no);
    const { question, key } = buildKey(it, answers.get(no));
    const fresh = toItems([question], { [no]: key })[0];
    const pp = partPoints.get(no);
    return { ...fresh, points: points.get(no) ?? it.points, partPoints: pp && pp.length === answerCount(fresh) ? pp : null };
  });
  return { answers, points, partPoints, items: withSheetPoints(next, points) };
}

describe('AI 명령어 → 엑셀 붙여 넣기 → 문항 반영 (3학년 원 20문항)', () => {
  const prompt = buildAnswerPrompt(CIRCLE_QUESTIONS, '3학년 2학기 수학 2. 원 단원평가');
  it('명령어에 줄 수·탭·배점·부분 점수 규칙과 문항별 답 개수가 있다', () => {
    expect(prompt).toContain('정확히 20줄');
    expect(prompt).toContain('B2');
    expect(prompt).toContain('탭 뒤는 C열(배점)');
    expect(prompt).toContain('5번: 답 칸 2개');
    expect(prompt).toContain('배점도 2개를 ; 로');
    expect(prompt).toContain('10번: ✏️ 그림만 그리는 문항 — 그리기 라고 적기');
    expect(prompt).not.toMatch(/비워 둬도 됨|비워 두면 학생 그림/); // "줄을 비우지 마"와 어긋나는 안내 없음
  });

  it('정답은 B열, 배점은 C열로 들어가 20문항 모두 반영된다', async () => {
    const { answers, points, partPoints, items } = await applySheet(AI_OUT.join('\n'));
    expect(answers.size).toBe(20);
    expect(points.size).toBe(20);
    expect([...partPoints.keys()]).toEqual([5, 15]);
    const { questions } = fromItems(items);
    expect(questions.reduce((a, q) => a + q.points, 0)).toBe(100);
    const by = Object.fromEntries(questions.map((q) => [q.no, q]));
    expect(by[5].partPoints).toEqual([2.5, 2.5]);
    expect(by[15].partPoints).toEqual([3, 2]);
    expect(by[15].parts.map((p) => p.type)).toEqual(['essay', 'short']);
    expect(by[1].partPoints).toBeUndefined();
    expect(by[7].manual && by[7].draw).toBe(true);
    expect(by[10].type).toBe('draw');
    expect(by[10].manual).toBe(true);
    expect(by[9].type).toBe('mc');
  });

  it('AI가 탭 대신 띄어쓰기를 넣어도 배점을 찾아낸다', async () => {
    const spaced = AI_OUT.map((l) => l.replace('\t', '    ')).join('\n');
    const { answers, points, partPoints } = await applySheet(spaced);
    expect(answers.get(1)).toBe('원의 중심');
    expect(points.get(1)).toBe(5);
    expect(answers.get(15)).toBe('선분 ㄱㄴ의 길이는 두 원의 지름의 길이의 합과 같습니다. ; 20 cm');
    expect(partPoints.get(15)).toEqual([3, 2]);
    expect(answers.get(5)).toBe('5 cm, 10 cm');
  });

  it('배점이 없는 정답지: 정답만 → 배점은 균등 분배 그대로', async () => {
    const { points, items } = await applySheet(AI_OUT.map((l) => l.split('\t')[0]).join('\n'));
    expect(points.size).toBe(0);
    expect(items.every((it) => it.points === 5 && !it.partPoints)).toBe(true);
  });

  it('부분 점수 개수가 답 개수와 다르면 총점만', async () => {
    const bad = [...AI_OUT];
    bad[4] = '5 cm, 10 cm\t1 ; 2 ; 2';
    const { items } = await applySheet(bad.join('\n'));
    const q5 = items.find((it) => Number(it.no) === 5);
    expect(q5.points).toBe(5);
    expect(q5.partPoints).toBeNull();
  });
});
