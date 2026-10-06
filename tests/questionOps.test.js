import { describe, it, expect } from 'vitest';
import { renumber, insertAfter, move, duplicate, mergeWithNext, split, blankItem } from '../src/lib/questionOps.js';

const R = (page, y0, y1) => ({ page, x0: 0.05, y0, x1: 0.5, y1 });
const items = [
  { no: 1, page: 1, type: 'mc', points: 10, regions: [R(1, 0.1, 0.2)], keyChoices: [3], group: 'g1' },
  { no: 2, page: 1, type: 'short', points: 10, regions: [R(1, 0.2, 0.3)], answerText: '광합성', group: 'g1' },
  { no: 3, page: 1, type: 'short', points: 10, regions: [R(1, 0.3, 0.5)], answerText: '3 cm', group: null },
];
const groups = [{ id: 'g1', from: 1, to: 2, regions: [R(1, 0.05, 0.1)] }];

describe('문항 편집', () => {
  it('1번 뒤에 추가하면 새 문항이 2번, 원래 2·3번은 3·4번 (정답은 문항을 따라감)', () => {
    const r = renumber(insertAfter(items, 0, blankItem(items[0])), groups);
    expect(r.items.map((it) => it.no)).toEqual([1, 2, 3, 4]);
    expect(r.items[2].answerText).toBe('광합성');
    expect(r.items[1].page).toBe(1);
    expect(r.groups[0]).toMatchObject({ from: 1, to: 3 });
  });
  it('순서 바꾸기 후 번호 다시 매기기', () => {
    const r = renumber(move(items, 2, -1), groups);
    expect(r.items.map((it) => it.answerText ?? it.keyChoices)).toEqual([[3], '3 cm', '광합성']);
    expect(r.items.map((it) => it.no)).toEqual([1, 2, 3]);
    expect(r.groups[0]).toMatchObject({ from: 1, to: 3 });
    expect(move(items, 0, -1)).toBe(items);
  });
  it('복제는 바로 아래에, 원본과 따로 고쳐진다', () => {
    const d = duplicate(items, 1);
    expect(d.length).toBe(4);
    d[2].regions[0].y0 = 0.9;
    expect(items[1].regions[0].y0).toBe(0.2);
  });
  it('아래 문항과 합치기: 캡쳐 이어 붙이고 배점 더함', () => {
    const m = renumber(mergeWithNext(items, 1)).items;
    expect(m.length).toBe(2);
    expect(m[1].regions.length).toBe(2);
    expect(m[1].points).toBe(20);
    expect(m[1].answerText).toBe('광합성');
  });
  it('둘로 나누기: 캡쳐 하나면 위아래 반으로', () => {
    const s = renumber(split(items, 2)).items;
    expect(s.length).toBe(4);
    expect(s[2].regions[0]).toMatchObject({ y0: 0.3, y1: 0.4 });
    expect(s[3].regions[0]).toMatchObject({ y0: 0.4, y1: 0.5 });
    expect(s[2].answerText).toBe('3 cm');
    expect(s[3].answerText).toBe('');
    expect(s[2].points + s[3].points).toBe(10);
  });
});
