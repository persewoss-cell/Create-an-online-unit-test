import { describe, it, expect } from 'vitest';
import { ranksOf } from '../src/lib/excel.js';

describe('엑셀 등수', () => {
  it('같은 점수는 같은 등수, 다음 등수는 건너뜀', () => {
    expect(ranksOf([80, 100, 80, 60, 100])).toEqual([3, 1, 3, 5, 1]);
    expect(ranksOf([])).toEqual([]);
  });
});
