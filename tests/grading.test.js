import { describe, it, expect } from 'vitest';
import { gradeAnswer, gradeSubmission } from '../src/lib/grading.js';
import { extractKeywords, sameWord, parseNumeric } from '../src/lib/korean.js';

const mc = { type: 'mc' };
const short = { type: 'short' };
const essay = { type: 'essay' };

describe('객관식', () => {
  it('번호 일치', () => {
    expect(gradeAnswer(mc, { choices: [3] }, [3]).status).toBe('correct');
    expect(gradeAnswer(mc, { choices: [3] }, [2]).status).toBe('wrong');
  });
  it('복수 정답은 모두 골라야 정답', () => {
    expect(gradeAnswer(mc, { choices: [2, 4] }, [4, 2]).status).toBe('correct');
    expect(gradeAnswer(mc, { choices: [2, 4] }, [2]).status).toBe('wrong');
  });
});

describe('단답형', () => {
  const key = { accepted: ['광합성'] };
  it('띄어쓰기·조사·어미 차이는 정답', () => {
    for (const a of ['광합성', ' 광 합성 ', '광합성입니다.', '광합성이다', '광합성이요']) {
      expect(gradeAnswer(short, key, a).status, a).toBe('correct');
    }
  });
  it('포괄적 표현(정답을 포함)은 정답', () => {
    expect(gradeAnswer(short, key, '광합성 작용').status).toBe('correct');
  });
  it('오타는 교사 검토', () => {
    expect(gradeAnswer(short, key, '광합썽').status).toBe('review');
  });
  it('정답의 일부만 쓰면 선생님 검토', () => {
    expect(gradeAnswer(short, { accepted: ['점 ㅇ'] }, 'ㅇ').status).toBe('review');
    expect(gradeAnswer(short, { accepted: ['점 ㅇ'] }, '점 ㅇ').status).toBe('correct');
    expect(gradeAnswer(short, { accepted: ['점 ㅇ'] }, 'ㄱ').status).toBe('wrong');
    expect(gradeAnswer(short, { accepted: ['12 cm'] }, '1').status).toBe('wrong');
    expect(gradeAnswer(short, { accepted: ['로제타 선생님'] }, '로제타').status).toBe('review');
  });
  it('다른 답은 오답', () => {
    expect(gradeAnswer(short, key, '호흡').status).toBe('wrong');
    expect(gradeAnswer(short, key, '모름').status).toBe('wrong');
  });
  it('용언은 활용형이 달라도 정답 (진다/져요, 난다/나요)', () => {
    expect(gradeAnswer(short, { accepted: ['늘어난다', '많아진다'] }, '많아져요').status).toBe('correct');
    expect(gradeAnswer(short, { accepted: ['늘어난다'] }, '늘어납니다').status).toBe('correct');
    expect(gradeAnswer(short, { accepted: ['늘어난다'] }, '줄어든다').status).toBe('wrong');
  });
  it('여러 정답 중 하나면 정답', () => {
    expect(gradeAnswer(short, { accepted: ['광합성', '탄소 동화 작용'] }, '탄소동화작용').status).toBe('correct');
  });
  it('숫자 + 단위', () => {
    const k = { accepted: ['24개'] };
    expect(gradeAnswer(short, k, '24').status).toBe('correct');
    expect(gradeAnswer(short, k, '24 개입니다').status).toBe('correct');
    expect(gradeAnswer(short, k, '25개').status).toBe('wrong');
    expect(gradeAnswer(short, { accepted: ['3/4'] }, '4분의 3').status).toBe('correct');
    expect(gradeAnswer(short, { accepted: ['0.75'] }, '3/4').status).toBe('correct');
    expect(gradeAnswer(short, { accepted: ['3cm'] }, '3m').status).toBe('review');
  });
  it('수학은 단위를 빠뜨리면 틀림', () => {
    const m = (acc, a) => gradeAnswer(short, { accepted: [acc] }, a, 'normal', '수학').status;
    expect(m('3cm', '3')).toBe('wrong');
    expect(m('3권', '3')).toBe('wrong');
    expect(m('3cm', '3cm')).toBe('correct');
    expect(m('3권', '3 권입니다')).toBe('correct');
    expect(m('3/4', '3/4')).toBe('correct');
    expect(gradeAnswer(short, { accepted: ['3cm'] }, '3', 'normal', '과학').status).toBe('correct');
    expect(gradeAnswer({ type: 'short', blankCount: 2 }, { boxes: ['3cm', '5권'] }, ['3cm', '5'], 'normal', '수학').status).toBe('wrong');
  });
  it('쉼표로 구분된 필수 요소', () => {
    const k = { accepted: ['산소, 이산화 탄소'] };
    expect(gradeAnswer(short, k, '이산화탄소와 산소').status).toBe('correct');
    expect(gradeAnswer(short, k, '산소').status).toBe('review');
    expect(gradeAnswer(short, k, '질소').status).toBe('wrong');
  });
  it('영어 대소문자 무시', () => {
    expect(gradeAnswer(short, { accepted: ['Apple'] }, 'apple').status).toBe('correct');
  });
});

describe('서술형', () => {
  const key = {
    model: '물이 열을 받아 증발하여 수증기가 되기 때문이다.',
    keywords: ['열', '증발|기화', '수증기'],
  };
  it('핵심어를 다 쓰면 표현이 달라도 정답', () => {
    expect(gradeAnswer(essay, key, '열을 받으면 물이 기화해서 수증기로 변해요').status).toBe('correct');
  });
  it('핵심어 일부만 있으면 교사 검토', () => {
    const r = gradeAnswer(essay, key, '물이 없어져서');
    expect(r.status).toBe('wrong');
    expect(gradeAnswer(essay, key, '물이 증발해서 사라진다').status).toBe('review');
  });
  it('부정 표현이 섞이면 교사 검토', () => {
    expect(gradeAnswer(essay, key, '열을 받아도 증발하지 않고 수증기가 안 된다').status).toBe('review');
  });
  it('관대 모드는 기준이 낮다', () => {
    const k = { model: '', keywords: ['열', '증발', '수증기', '온도'] };
    expect(gradeAnswer(essay, k, '열 때문에 증발한다', 'normal').status).toBe('review');
    expect(gradeAnswer(essay, k, '열 때문에 증발한다', 'lenient').status).toBe('correct');
  });
  it('핵심어를 자동으로 뽑은 경우 일부만 맞으면 교사 검토', () => {
    const model = '가을이 되어 기온이 낮아지면 나뭇잎에 단풍이 들고 낙엽이 진다.';
    const k = { model, keywords: extractKeywords(model) };
    expect(k.keywords).toEqual(expect.arrayContaining(['기온', '나뭇잎', '단풍', '낙엽']));
    expect(gradeAnswer(essay, k, '추워지면 나뭇잎에 단풍이 든다').status).toBe('review');
    expect(gradeAnswer(essay, k, '가을에 기온이 낮아져서 나뭇잎에 단풍이 들고 낙엽이 떨어진다').status).toBe('correct');
  });
  it('핵심어 자동 추출', () => {
    const kws = extractKeywords('물이 열을 받아 증발하여 수증기가 되기 때문이다.');
    expect(kws).toContain('증발');
    expect(kws).toContain('수증기');
    expect(kws).not.toContain('때문');
  });
});

describe('제출물 채점', () => {
  const exam = {
    leniency: 'normal',
    questions: [
      { no: 1, type: 'mc', points: 50 },
      { no: 2, type: 'short', points: 30 },
      { no: 3, type: 'short', points: 20 },
    ],
  };
  const keys = { 1: { choices: [1] }, 2: { accepted: ['광합성'] }, 3: { accepted: ['증발'] } };
  it('검토 대기는 0점, 교사 판정이 우선', () => {
    const sub = { answers: { 1: [1], 2: '광합썽', 3: '응결' } };
    const r = gradeSubmission(exam, keys, sub);
    expect(r).toMatchObject({ earned: 50, total: 100, score100: 50, reviewCount: 1, correctCount: 1 });
    const r2 = gradeSubmission(exam, keys, { ...sub, overrides: { 2: 'correct' } });
    expect(r2).toMatchObject({ earned: 80, reviewCount: 0 });
  });
});

describe('유틸', () => {
  it('sameWord', () => {
    expect(sameWord('바다', '바다입니다')).toBe(true);
    expect(sameWord('나이', '나')).toBe(false);
  });
  it('parseNumeric', () => {
    expect(parseNumeric('1,000원')).toEqual({ value: 1000, unit: '원' });
    expect(parseNumeric('광합성')).toBeNull();
  });
});

describe('선생님이 직접 채점하는 문항', () => {
  it('정답이 없어도 되고, 답을 쓰면 항상 검토 요청', async () => {
    const { buildKey, hasAnswer } = await import('../src/lib/parseAnswers.js');
    const { fromItems, toItems, validateItems } = await import('../src/lib/editorModel.js');
    const q = { no: 1, type: 'short', points: 10, page: 1 };
    const { question, key } = buildKey(q, '검토');
    expect(question.manual).toBe(true);
    expect(hasAnswer(key)).toBe(true);
    const items = toItems([question], { 1: key });
    expect(validateItems(items, 1)).toEqual([]);
    const { questions, keys } = fromItems(items);
    expect(gradeAnswer(questions[0], keys[1], '아무 답').status).toBe('review');
    expect(gradeAnswer(questions[0], keys[1], '').status).toBe('wrong');
  });
});
