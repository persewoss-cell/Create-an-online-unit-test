import { describe, it, expect } from 'vitest';
import { buildKey, hasAnswer } from '../src/lib/parseAnswers.js';
import { parsePoints, withSheetPoints } from '../src/lib/answerSheet.js';
import { gradeSubmission, gradeAnswer } from '../src/lib/grading.js';
import { toItems, fromItems, answerCount, evenParts, withPoints } from '../src/lib/editorModel.js';

const short = { no: 4, page: 1, type: 'short', choiceCount: 0, choices: [], multi: false, points: 5, text: '' };

describe('엑셀 정답: 그리기는 선생님 채점', () => {
  it('그리기 → 선생님 채점', () => {
    const { question, key } = buildKey(short, '그리기');
    expect(question.type).toBe('draw');
    expect(question.manual).toBe(true);
    expect(key.manual).toBe(true);
  });
  it('그리기 + 3 cm → 그림 + 답, 선생님 채점', () => {
    const { question, key } = buildKey(short, '그리기 + 3 cm');
    expect(question.draw).toBe(true);
    expect(question.manual).toBe(true);
    expect(key.accepted).toEqual(['3 cm']);
  });
  it('그리기로 인식한 문항에 답만 적어도 그림이 있으므로 선생님 채점', () => {
    const { question } = buildKey({ ...short, type: 'draw', draw: true }, '3 cm');
    expect(question.draw).toBe(true);
    expect(question.manual).toBe(true);
  });
  it('그리기 ; 3 cm → 그림 + 답', () => {
    const { question, key } = buildKey(short, '그리기 ; 3 cm');
    expect(question.draw).toBe(true);
    expect(question.manual).toBe(true);
    expect(key.accepted).toEqual(['3 cm']);
  });
  it('그리기가 아닌 문항은 그대로 자동 채점', () => {
    expect(buildKey(short, '3 cm').question.manual).toBeFalsy();
  });
});

describe('엑셀 정답: ; 로 나눈 답은 부분마다 형식이 섞인 문항', () => {
  const raw = '선분 ㄱㄴ의 길이는 두 원의 지름의 길이의 합과 같습니다. ; 20 cm';
  const { question, key } = buildKey(short, raw);
  it('서술형 부분 + 단답형 부분', () => {
    expect(question.parts.map((p) => p.type)).toEqual(['essay', 'short']);
    expect(key.parts[0].model).toBe('선분 ㄱㄴ의 길이는 두 원의 지름의 길이의 합과 같습니다.');
    expect(key.parts[1].accepted).toEqual(['20 cm']);
    expect(hasAnswer(key)).toBe(true);
  });
  it('편집 화면을 거쳐 저장해도 부분이 유지되고 채점된다', () => {
    const it0 = toItems([question], { 4: key })[0];
    const { questions, keys } = fromItems([it0]);
    expect(questions[0].parts).toHaveLength(2);
    const ans = { parts: { 0: '선분 ㄱㄴ의 길이는 두 원의 지름의 길이의 합과 같습니다.', 1: '20 cm' } };
    expect(gradeAnswer(questions[0], keys[4], ans).status).toBe('correct');
  });
  it('③ ; 3 cm → 객관식 + 단답형', () => {
    const r = buildKey(short, '③ ; 3 cm');
    expect(r.question.parts.map((p) => p.type)).toEqual(['mc', 'short']);
    expect(r.key.parts[0].choices).toEqual([3]);
  });
});

describe('배점 칸', () => {
  it('숫자, 부분 점수', () => {
    expect(parsePoints('5')).toEqual({ points: 5, parts: null });
    expect(parsePoints('3 ; 2')).toEqual({ points: 5, parts: [3, 2] });
    expect(parsePoints('3+2점')).toEqual({ points: 5, parts: [3, 2] });
    expect(parsePoints('')).toBeNull();
    expect(parsePoints('abc')).toBeNull();
  });
  it('배점이 일부만 있으면 나머지를 고르게, 하나도 없으면 그대로', () => {
    const items = [1, 2, 3, 4].map((no) => ({ no, points: 25 }));
    expect(withSheetPoints(items, new Map())).toBe(items);
    const out = withSheetPoints(items, new Map([[1, 40]]));
    expect(out.map((x) => x.points)).toEqual([40, 20, 20, 20]);
  });
});

describe('부분 점수 채점', () => {
  const q = {
    no: 1, type: 'parts', points: 5, partPoints: [3, 2],
    parts: [{ type: 'short', blankCount: 0 }, { type: 'short', blankCount: 0 }],
  };
  const keys = { 1: { parts: [{ accepted: ['원'] }, { accepted: ['20 cm'] }] } };
  const exam = { questions: [q] };
  const grade = (answers, overrides) => gradeSubmission(exam, keys, { answers: { 1: answers }, overrides }).items[0];
  it('맞힌 부분만큼 점수', () => {
    expect(grade({ parts: { 0: '원', 1: '20 cm' } })).toMatchObject({ status: 'correct', earned: 5, partial: false });
    expect(grade({ parts: { 0: '원', 1: '30 cm' } })).toMatchObject({ status: 'wrong', earned: 3, partial: true });
    expect(grade({ parts: { 0: '세모', 1: '20 cm' } })).toMatchObject({ status: 'wrong', earned: 2, partial: true });
  });
  it('부분 배점이 없으면 모두 맞아야 점수', () => {
    const e = { questions: [{ ...q, partPoints: undefined }] };
    expect(gradeSubmission(e, keys, { answers: { 1: { parts: { 0: '원', 1: '30 cm' } } } }).items[0].earned).toBe(0);
  });
  it('배점을 바꿔도 부분 점수 비율대로', () => {
    const e = { questions: [{ ...q, points: 10 }] };
    expect(gradeSubmission(e, keys, { answers: { 1: { parts: { 0: '원', 1: '30 cm' } } } }).items[0].earned).toBe(6);
  });
  it('선생님이 준 점수', () => {
    expect(grade({ parts: { 0: '원', 1: '30 cm' } }, { 1: 4 })).toMatchObject({ status: 'wrong', earned: 4, partial: true, overridden: true });
    expect(grade({ parts: { 0: '원', 1: '30 cm' } }, { 1: 5 })).toMatchObject({ status: 'correct', earned: 5 });
    expect(grade({ parts: { 0: '원', 1: '30 cm' } }, { 1: 'wrong' })).toMatchObject({ earned: 0 });
  });
  it('부분 배점은 답 개수와 맞을 때만 저장', () => {
    const it0 = { no: 1, page: 1, points: 5, parts: [{ type: 'short', answerText: 'a' }, { type: 'short', answerText: 'b' }], partPoints: [3, 2] };
    expect(fromItems([it0]).questions[0].partPoints).toEqual([3, 2]);
    expect(fromItems([{ ...it0, partPoints: [5] }]).questions[0].partPoints).toBeUndefined();
  });
});

describe('한 유형 문항의 답이 여러 개일 때 부분 점수', () => {
  const ex = (q, key) => ({ exam: { questions: [{ no: 1, points: 4, ...q }] }, keys: { 1: key } });
  const g = ({ exam, keys }, ans, overrides) => gradeSubmission(exam, keys, { answers: { 1: ans }, overrides }).items[0];
  it('답 칸 여러 개 (3, 6)', () => {
    const e = ex({ type: 'short', blankCount: 2, partPoints: [2, 2] }, { boxes: ['3', '6'], accepted: ['3, 6'] });
    expect(g(e, ['3', '6'])).toMatchObject({ status: 'correct', earned: 4 });
    expect(g(e, ['3', '7'])).toMatchObject({ status: 'wrong', earned: 2, partial: true });
    expect(g(e, ['1', '7'])).toMatchObject({ earned: 0, partial: false });
  });
  it('예전 형식(쉼표 정답)도', () => {
    const e = ex({ type: 'short', blankCount: 2, partPoints: [1, 3] }, { accepted: ['3, 6'] });
    expect(g(e, ['5', '6'])).toMatchObject({ earned: 3 });
  });
  it('부분 점수가 없으면 칸이 여러 개여도 모두 맞아야 점수', () => {
    const e = ex({ type: 'short', blankCount: 2 }, { boxes: ['3', '6'] });
    expect(g(e, ['3', '7']).earned).toBe(0);
  });
  it('선 잇기 짝마다', () => {
    const e = ex({ type: 'match', matchCount: 2, partPoints: [2, 2] }, { pairs: [2, 1] });
    expect(g(e, [2, 3])).toMatchObject({ earned: 2, partial: true });
  });
  it('객관식 답 여러 개: 맞힌 보기만큼, 틀린 보기를 더 고르면 그만큼 빼기', () => {
    const e = ex({ type: 'mc', multi: true, choiceCount: 5, partPoints: [2, 2] }, { choices: [2, 4] });
    expect(g(e, [2, 4])).toMatchObject({ status: 'correct', earned: 4 });
    expect(g(e, [2])).toMatchObject({ earned: 2 });
    expect(g(e, [2, 3])).toMatchObject({ earned: 0 });
    expect(g(e, [2, 3, 4])).toMatchObject({ earned: 2 });
    expect(g(e, [2, 3, 5])).toMatchObject({ earned: 0 });
  });
  it('확인할 칸이 있으면 틀린 칸이 있어도 선생님 확인', () => {
    const e = ex({ type: 'short', blankCount: 2, partPoints: [2, 2] }, { boxes: ['광합성', '6'] });
    const it0 = g(e, ['광합셩', '7']);
    expect(it0.status).toBe('review');
    expect(it0.earned).toBe(0);
  });
});

describe('문항 설정: 답 개수와 부분 점수', () => {
  it('답 개수', () => {
    expect(answerCount({ type: 'short', blankCount: 3 })).toBe(3);
    expect(answerCount({ type: 'short' })).toBe(1);
    expect(answerCount({ type: 'match', matchCount: 4 })).toBe(4);
    expect(answerCount({ type: 'mc', keyChoices: [2, 4] })).toBe(2);
    expect(answerCount({ parts: [{}, {}] })).toBe(2);
  });
  it('똑같이 나누기, 배점 바꾸면 비율대로', () => {
    expect(evenParts(5, 2)).toEqual([2.5, 2.5]);
    expect(evenParts(10, 3)).toEqual([3.3, 3.3, 3.4]);
    expect(withPoints({ points: 5, partPoints: [3, 2] }, 10).partPoints).toEqual([6, 4]);
    expect(withPoints({ points: 5 }, 10).partPoints).toBeUndefined();
  });
  it('답 칸 문항의 부분 점수가 저장된다', () => {
    const it0 = { no: 1, page: 1, points: 4, type: 'short', blankCount: 2, boxAnswers: ['3', '6'], partPoints: [2, 2] };
    expect(fromItems([it0]).questions[0].partPoints).toEqual([2, 2]);
    expect(fromItems([{ ...it0, blankCount: 3 }]).questions[0].partPoints).toBeUndefined();
  });
});

describe('정답 엑셀 읽기: 배점·부분 점수', () => {
  it('B칸 정답, C칸 배점(부분 점수 2 ; 2)', async () => {
    const { buildAnswerTemplate, readAnswerSheet } = await import('../src/lib/answerSheet.js');
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await buildAnswerTemplate([1, 2, 3]));
    const ws = wb.getWorksheet('정답');
    ws.getCell('B2').value = '③';
    ws.getCell('C2').value = '4';
    ws.getCell('B3').value = '3 cm, 6 cm';
    ws.getCell('C3').value = '2 ; 2';
    ws.getCell('B4').value = '그리기';
    const { answers, points, partPoints } = await readAnswerSheet(await wb.xlsx.writeBuffer());
    expect(answers.get(3)).toBe('그리기');
    expect(points.get(1)).toBe(4);
    expect(points.get(2)).toBe(4);
    expect(partPoints.get(2)).toEqual([2, 2]);
    expect(points.has(3)).toBe(false);
  });
});
