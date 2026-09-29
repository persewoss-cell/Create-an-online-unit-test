import { describe, it, expect } from 'vitest';
import { parseQuestions, fillDefaultPoints, extractChoices } from '../src/lib/parseQuestions.js';
import { parseAnswerText, mergeQuestionsAndAnswers, parseChoiceAnswer, splitAlternatives } from '../src/lib/parseAnswers.js';
import { itemsToLines } from '../src/lib/layout.js';

describe('문제지 인식', () => {
  it('"1." 양식 + 원문자 보기 (수학형)', () => {
    const { questions } = parseQuestions([
      {
        page: 1,
        lines: [
          '3학년 1학기 수학 2단원 평가',
          '이름: ______',
          '1. 다음 중 가장 큰 수는 무엇입니까? [5점]',
          '① 123 ② 321 ③ 213',
          '④ 312 ⑤ 132',
          '2. 24 + 38 을 계산하시오.',
        ],
      },
      { page: 2, lines: ['3. 다음 중 옳은 것을 모두 고르시오.', '① 가 ② 나 ③ 다 ④ 라'] },
    ]);
    expect(questions.map((q) => q.no)).toEqual([1, 2, 3]);
    expect(questions[0]).toMatchObject({ type: 'mc', choiceCount: 5, points: 5, page: 1 });
    expect(questions[0].choices[1]).toBe('321');
    expect(questions[0].text).toBe('다음 중 가장 큰 수는 무엇입니까?');
    expect(questions[1]).toMatchObject({ type: 'short', choiceCount: 0 });
    expect(questions[2]).toMatchObject({ type: 'mc', choiceCount: 4, multi: true, page: 2 });
  });

  it('"문제 1" / "[2]" / "3번" 등 섞인 양식과 서술형 감지', () => {
    const { questions } = parseQuestions([
      {
        page: 1,
        lines: [
          '문제 1 식물이 햇빛을 이용해 양분을 만드는 과정을 무엇이라고 합니까?',
          '[2] 물이 수증기로 변하는 현상이 일어나는 이유를 서술하시오.',
          '3번 (1) 산소 (2) 질소 (3) 수소 (4) 헬륨 중 공기에 가장 많은 기체는?',
        ],
      },
    ]);
    expect(questions.map((q) => q.type)).toEqual(['short', 'essay', 'mc']);
    expect(questions[2].choiceCount).toBe(4);
  });

  it('보기 안의 "2)" 같은 번호는 순서가 맞지 않으면 문항으로 보지 않는다', () => {
    const { questions } = parseQuestions([
      { page: 1, lines: ['1. 다음을 읽고 답하시오.', '가) 사과 나) 배', '5) 잘못된 번호', '2. 두 번째 문제'] },
    ]);
    expect(questions).toHaveLength(2);
  });

  it('문항을 못 찾으면 경고', () => {
    const { questions, warnings } = parseQuestions([{ page: 1, lines: [] }]);
    expect(questions).toHaveLength(0);
    expect(warnings[0]).toMatch(/스캔/);
  });

  it('(1)~(5) 괄호 보기', () => {
    const r = extractChoices('다음 중 알맞은 것은? (1) 가 (2) 나 (3) 다');
    expect(r.choices).toEqual(['가', '나', '다']);
    expect(r.stem).toBe('다음 중 알맞은 것은?');
  });

  it('배점 자동 분배', () => {
    const qs = fillDefaultPoints([{ points: 10 }, { points: null }, { points: null }]);
    expect(qs.map((q) => q.points)).toEqual([10, 45, 45]);
    const three = fillDefaultPoints([{ points: 50 }, {}, {}, {}]);
    expect(three.map((q) => q.points)).toEqual([50, 16.6, 16.6, 16.8]);
  });
});

describe('2단 편집 인식', () => {
  it('왼쪽 단을 먼저, 오른쪽 단을 나중에 읽는다', () => {
    const W = 600;
    const items = [];
    const L = ['1. 왼쪽 첫 문제', '① 가 ② 나', '2. 왼쪽 두번째', '① 다 ② 라'];
    const R = ['3. 오른쪽 첫 문제', '① 마 ② 바', '4. 오른쪽 두번째', '① 사 ② 아'];
    L.forEach((s, i) => items.push({ str: s, x: 40, y: 800 - i * 20, w: 200, h: 10 }));
    R.forEach((s, i) => items.push({ str: s, x: 330, y: 800 - i * 20, w: 200, h: 10 }));
    const lines = itemsToLines(items, W);
    expect(lines).toEqual([...L, ...R]);
  });

  it('1단 문서는 줄 단위로 합친다', () => {
    const items = [
      { str: '1.', x: 40, y: 800, w: 10, h: 10 },
      { str: '다음을', x: 55, y: 800, w: 30, h: 10 },
      { str: '읽고 가로로 넓게 이어지는 문장입니다', x: 90, y: 800.5, w: 450, h: 10 },
      { str: '두 번째 줄', x: 40, y: 780, w: 60, h: 10 },
    ];
    expect(itemsToLines(items, 600)).toEqual(['1. 다음을 읽고 가로로 넓게 이어지는 문장입니다', '두 번째 줄']);
  });
});

describe('정답지 인식', () => {
  it('"1. ③ 2. ④" 한 줄 + 해설 제거', () => {
    const m = parseAnswerText(['정답 및 해설', '1. ③ 2. ④ 3. 광합성 해설: 식물은 빛을 이용한다.', '4. 62']);
    expect(Object.fromEntries(m)).toMatchObject({ 1: '③', 2: '④', 4: '62' });
    expect(m.get(3)).toMatch(/^광합성/);
  });

  it('붙어 있는 "1③ 2① 3④"', () => {
    const m = parseAnswerText(['1③ 2① 3④']);
    expect(Object.fromEntries(m)).toEqual({ 1: '③', 2: '①', 3: '④' });
  });

  it('표 형태', () => {
    const m = parseAnswerText(['번호 1 2 3 4 5', '정답 ③ ① ④ ② ⑤', '6. 증발']);
    expect(Object.fromEntries(m)).toEqual({ 1: '③', 2: '①', 3: '④', 4: '②', 5: '⑤', 6: '증발' });
  });

  it('객관식 번호 해석', () => {
    expect(parseChoiceAnswer('③')).toEqual([3]);
    expect(parseChoiceAnswer('②, ④')).toEqual([2, 4]);
    expect(parseChoiceAnswer('정답: 3번')).toEqual([3]);
    expect(parseChoiceAnswer('광합성')).toBeNull();
  });

  it('여러 정답 분리', () => {
    expect(splitAlternatives('광합성(또는 탄소 동화 작용) / 광합성 작용')).toEqual(['광합성', '광합성 작용', '탄소 동화 작용']);
  });

  it('문항과 합치면서 유형 보정 + 서술형 핵심어', () => {
    const questions = [
      { no: 1, type: 'short', choiceCount: 0, choices: [], page: 1 },
      { no: 2, type: 'short', choiceCount: 0, choices: [], page: 1 },
      { no: 3, type: 'essay', choiceCount: 0, choices: [], page: 1 },
      { no: 4, type: 'mc', choiceCount: 5, choices: [], page: 1 },
    ];
    const answers = parseAnswerText([
      '1. ②',
      '2. 광합성 [해설] 잎에서 일어난다',
      '3. 예시 답안: 물이 열을 받아 증발하여 수증기가 되기 때문이다. 핵심어: 열, 증발|기화, 수증기',
    ]);
    const { questions: qs, keys, warnings } = mergeQuestionsAndAnswers(questions, answers);
    expect(qs[0].type).toBe('mc');
    expect(keys[1]).toEqual({ choices: [2] });
    expect(keys[2]).toEqual({ accepted: ['광합성'] });
    expect(keys[3].keywords).toEqual(['열', '증발|기화', '수증기']);
    expect(keys[3].model).toMatch(/^물이 열을 받아/);
    expect(warnings.join()).toMatch(/4번/);
  });
});
