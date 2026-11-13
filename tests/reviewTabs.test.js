import { describe, it, expect } from 'vitest';
import { nextTabOrder, tabAfterRemoval } from '../src/lib/reviewTabs.js';

const m = (o) => new Map(Object.entries(o).map(([k, v]) => [Number(k), v]));

describe('검토 요청 탭 순서', () => {
  it('들어온 순서대로, 다 채점한 번호는 빠지고 다시 들어오면 맨 뒤', () => {
    let t = nextTabOrder([], m({ 6: 30, 1: 10, 5: 20 }));
    expect(t).toEqual([1, 5, 6]);
    t = nextTabOrder(t, m({ 1: 10, 5: 20, 6: 30, 8: 40 }));
    expect(t).toEqual([1, 5, 6, 8]);
    t = nextTabOrder(t, m({ 1: 10, 6: 30, 8: 40 })); // 5번 다 채점
    expect(t).toEqual([1, 6, 8]);
    t = nextTabOrder(t, m({ 1: 10, 6: 30, 8: 40, 5: 50 })); // 5번 다시 들어옴
    expect(t).toEqual([1, 6, 8, 5]);
  });
  it('남은 것 중 먼저 온 답을 채점해도 탭 자리는 그대로', () => {
    const t = nextTabOrder([1, 5, 6], m({ 1: 99, 5: 20, 6: 30 }));
    expect(t).toEqual([1, 5, 6]);
  });
  it('보던 탭이 없어지면 오른쪽 → 왼쪽 → 전체', () => {
    expect(tabAfterRemoval([1, 5, 6], [1, 6], 5)).toBe(6);
    expect(tabAfterRemoval([1, 5, 6], [1, 5], 6)).toBe(5);
    expect(tabAfterRemoval([5], [], 5)).toBe('all');
    expect(tabAfterRemoval([1, 5], [1, 5], 5)).toBe(5);
    expect(tabAfterRemoval([1, 5], [1], 'all')).toBe('all');
  });
});
