import { describe, it, expect } from 'vitest';
import { splitColumns } from '../src/lib/layout.js';

const W = 595;
const item = (x, y, str, w = str.length * 9) => ({ str, x, y, w, h: 10 });

describe('2단 나누기', () => {
  it('오른쪽 단에 짧은 문항만 있어도(글자 20% 미만) 가운데 경계가 깨끗하면 2단', () => {
    const left = Array.from({ length: 30 }, (_, i) => item(30, 800 - i * 20, '왼쪽 단의 긴 문항 내용입니다 보기 지문 그림'.slice(0, 26)));
    const right = [
      item(312, 800, '24 다음 글의 빈칸에 들어갈 말을'), item(312, 780, '기법은 겉면에 무늬를 새겨'), item(312, 760, '른 색의 흙으로 그 자리를'),
      item(312, 740, '구워 내는 기법입니다'), item(312, 700, '25 고려 사람들이 까닭을 쓰시오'),
    ]; // 왼쪽 단 글자의 15% 정도
    const cols = splitColumns([...left, ...right], W);
    expect(cols.length).toBe(2);
    expect(cols[1].map((it) => it.str)).toEqual(right.map((it) => it.str));
  });
  it('한 단짜리 쪽은 그대로 한 단', () => {
    const lines = Array.from({ length: 20 }, (_, i) => item(40, 800 - i * 20, '가운데를 가로지르는 아주 긴 한 단짜리 문장입니다 계속', 480));
    const ans = [item(450, 700, '(      )'), item(450, 600, '(      )'), item(450, 500, '(      )')];
    expect(splitColumns([...lines, ...ans], W).length).toBe(1);
  });
});
