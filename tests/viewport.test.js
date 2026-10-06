import { describe, it, expect } from 'vitest';
import { zoomRegion, panRegion, clampRegion } from '../src/lib/viewport.js';

const r = { page: 2, x0: 0.2, y0: 0.2, x1: 0.6, y1: 0.4 };
const close = (a, b) => expect(Math.abs(a - b)).toBeLessThan(1e-3);

describe('마우스 간편조정 계산', () => {
  it('휠로 확대하면 범위가 좁아지고 마우스 아래 점은 제자리, 비율 유지', () => {
    const z = zoomRegion(r, 0.5, 0.25, 0.5); // 왼쪽 1/4 지점에서 2배 확대
    close(z.x1 - z.x0, 0.2);
    close(z.y1 - z.y0, 0.1);
    close(z.x0 + 0.25 * (z.x1 - z.x0), 0.2 + 0.25 * 0.4);
    expect(z.page).toBe(2);
  });
  it('축소해도 쪽 밖으로 나가지 않고 쪽보다 커지지 않는다', () => {
    const z = zoomRegion(r, 10);
    expect(z.x0).toBeGreaterThanOrEqual(0);
    expect(z.x1).toBeLessThanOrEqual(1);
    close(z.x1 - z.x0, 1);
    close(z.y1 - z.y0, 0.5);
  });
  it('오른쪽으로 끌면 내용이 오른쪽으로 → 보이는 범위는 왼쪽으로', () => {
    const p = panRegion(r, 0.25, 0);
    close(p.x0, 0.1);
    close(p.x1, 0.5);
    const edge = panRegion(r, 5, 0);
    expect(edge.x0).toBe(0);
    close(edge.x1, 0.4);
  });
  it('clampRegion', () => {
    expect(clampRegion({ x0: -0.1, x1: 0.3, y0: 0.9, y1: 1.2 })).toMatchObject({ x0: 0, x1: 0.4, y0: 0.7, y1: 1 });
  });
});
