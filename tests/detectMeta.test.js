import { describe, it, expect } from 'vitest';
import { detectMeta } from '../src/lib/detectMeta.js';

const page = (...texts) => [{ lines: texts.map((text, i) => ({ text, top: i * 0.03 })) }];
const q1 = (top) => [{ anchor: { page: 1, top } }];

describe('detectMeta', () => {
  it('학년·학기·과목·단원이 한 줄에 있는 머리글', () => {
    const p = page('5학년 2학기 과학 2. 생물과 환경 단원평가', '5학년 ( )반 ( )번 이름: ______', '1. 생태계를 구성하는 요소');
    expect(detectMeta(p, q1(0.06))).toEqual({ subject: '과학', grade: '5', semester: '2', unit: '2. 생물과 환경' });
  });
  it('"3-2" 표기와 회차', () => {
    const p = page('국어\t2. 유창하게 읽고 발표해요 (1회)', '3-2', '<국어> 66~105쪽 / <국어활동> 22~41쪽', '※ 다음 글을 읽고');
    expect(detectMeta(p, [])).toEqual({ subject: '국어', grade: '3', semester: '2', unit: '2. 유창하게 읽고 발표해요' });
  });
  it('단원 이름이 따로 있는 줄, 첫 문항은 머리글에서 제외', () => {
    const p = page('수학\t단원 평가', '2. 원', '3-2\t기본 ①회', '1 원의 중심을 찾아 써 보세요.');
    expect(detectMeta(p, q1(0.09))).toEqual({ subject: '수학', grade: '3', semester: '2', unit: '2. 원' });
  });
  it('머리글에 없으면 파일 이름에서 과목을 찾는다', () => {
    expect(detectMeta(page('1. 문제'), q1(0), '과학_문제.pdf')).toEqual({ subject: '과학' });
  });
});
