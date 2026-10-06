import { describe, it, expect } from 'vitest';
import { toItems, fromItems, validateItems, newPart } from '../src/lib/editorModel.js';
import { gradeAnswer, isBlank } from '../src/lib/grading.js';
import { buildKey, hasAnswer } from '../src/lib/parseAnswers.js';
import { answerToText, keyToText } from '../src/lib/format.js';

const base = { no: 3, page: 1, points: 10, regions: [] };

describe('객관식 보기 편집', () => {
  it('보기 기호·내용·수를 바꾼 대로 저장된다', () => {
    const it0 = toItems([{ ...base, type: 'mc', choiceCount: 2, choiceLabels: ['왼쪽', '오른쪽'], choices: [] }], { 3: { choices: [2] } })[0];
    const edited = { ...it0, choiceCount: 3, choiceLabels: ['왼쪽', '가운데', '오른쪽'], choices: ['', '둥근 모양', ''], showChoiceText: true, keyChoices: [2] };
    const { questions, keys } = fromItems([edited]);
    expect(questions[0]).toMatchObject({ type: 'mc', choiceCount: 3, choiceLabels: ['왼쪽', '가운데', '오른쪽'], showChoiceText: true });
    expect(questions[0].choices[1]).toBe('둥근 모양');
    expect(keys[3]).toEqual({ choices: [2] });
    expect(gradeAnswer(questions[0], keys[3], [2]).status).toBe('correct');
  });
});

describe('한 문제에 답 유형 여러 개', () => {
  const item = {
    ...toItems([{ ...base, type: 'short' }], {})[0],
    parts: [
      { ...newPart('mc'), choiceCount: 2, choiceLabels: ['왼쪽', '오른쪽'], keyChoices: [1] },
      { ...newPart('short'), answerText: '3 cm' },
    ],
  };
  const { questions, keys } = fromItems([item]);
  const q = questions[0];
  it('저장 형식', () => {
    expect(q.type).toBe('parts');
    expect(q.parts.map((p) => p.type)).toEqual(['mc', 'short']);
    expect(keys[3]).toEqual({ parts: [{ choices: [1] }, { accepted: ['3 cm'] }] });
    expect(hasAnswer(keys[3])).toBe(true);
    expect(validateItems([item], 1)).toEqual([]);
    // 다시 편집 화면으로
    const back = toItems(questions, keys)[0];
    expect(back.parts[1].answerText).toBe('3 cm');
    expect(back.parts[0].keyChoices).toEqual([1]);
  });
  it('모두 맞아야 정답, 하나라도 답하면 제출 가능', () => {
    expect(gradeAnswer(q, keys[3], { parts: { 0: [1], 1: '3cm' } }).status).toBe('correct');
    expect(gradeAnswer(q, keys[3], { parts: { 0: [1], 1: '4cm' } }).status).toBe('wrong');
    expect(gradeAnswer(q, keys[3], { parts: { 0: [2], 1: '3cm' } }).status).toBe('wrong');
    expect(isBlank({ parts: { 0: [1] } }, q)).toBe(false);
    expect(isBlank({ parts: {} }, q)).toBe(true);
    expect(gradeAnswer(q, keys[3], { parts: { 0: [1] } }).status).toBe('wrong');
  });
  it('글자로 보여 주기', () => {
    expect(answerToText(q, { parts: { 0: [1], 1: '3cm' } })).toBe('(1) 왼쪽  (2) 3cm');
    expect(keyToText(q, keys[3])).toBe('(1) 왼쪽  (2) 3 cm');
  });
  it('엑셀 정답은 ; 로 부분마다', () => {
    const { question, key } = buildKey(q, '오른쪽 ; 5 cm');
    expect(key.parts).toEqual([{ choices: [2] }, { accepted: ['5 cm'] }]);
    expect(question.parts[0].choiceLabels).toEqual(['왼쪽', '오른쪽']);
  });
});

describe('엑셀 정답에 ; 가 있으면 보통 문항도 여러 부분으로', () => {
  const plain = { ...base, type: 'essay', choiceCount: 0, choices: [] };
  const raw = '선분 ㄱㄴ의 길이는 두 원의 지름의 길이의 합과 같습니다. ; 20 cm';
  it('문장 → 서술형, 짧은 답 → 단답형', () => {
    const { question, key } = buildKey(plain, raw);
    expect(question.parts.map((p) => p.type)).toEqual(['essay', 'short']);
    expect(key.parts[0].model).toBe('선분 ㄱㄴ의 길이는 두 원의 지름의 길이의 합과 같습니다.');
    expect(key.parts[1]).toEqual({ accepted: ['20 cm'] });
  });
  it('편집 칸으로 바꿨다 다시 저장해도 두 부분 그대로, 채점도 부분마다', () => {
    const { question, key } = buildKey(plain, raw);
    const item = toItems([question], { 3: key })[0];
    const { questions, keys } = fromItems([item]);
    expect(questions[0].type).toBe('parts');
    expect(questions[0].parts.map((p) => p.type)).toEqual(['essay', 'short']);
    const ans = { parts: { 0: '선분 ㄱㄴ의 길이는 두 원의 지름의 길이의 합과 같습니다.', 1: '20cm' } };
    expect(gradeAnswer(questions[0], keys[3], ans).status).toBe('correct');
    expect(gradeAnswer(questions[0], keys[3], { parts: { 0: ans.parts[0], 1: '10cm' } }).status).toBe('wrong');
  });
  it('객관식 + 단답도 된다', () => {
    const { question, key } = buildKey({ ...base, type: 'short' }, '③ ; 3 cm');
    expect(question.parts.map((p) => p.type)).toEqual(['mc', 'short']);
    expect(key.parts).toEqual([{ choices: [3] }, { accepted: ['3 cm'] }]);
  });
});

describe('엑셀 정답이 그리기면 늘 선생님 채점', () => {
  it('그리기', () => {
    const { question, key } = buildKey({ ...base, type: 'short' }, '그리기');
    expect(question).toMatchObject({ type: 'draw', manual: true });
    expect(key.manual).toBe(true);
    const item = toItems([question], { 3: key })[0];
    expect(item.manual).toBe(true);
    expect(fromItems([item]).keys[3].manual).toBe(true);
  });
  it('그리기 + 답', () => {
    const { question, key } = buildKey({ ...base, type: 'short' }, '그리기 + 3 cm');
    expect(question).toMatchObject({ draw: true, manual: true });
    expect(key).toMatchObject({ accepted: ['3 cm'], draw: true, manual: true });
  });
});
