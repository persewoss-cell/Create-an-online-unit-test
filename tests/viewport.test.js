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

describe('테두리 끌기', () => {
  it('오른쪽 변을 왼쪽으로 끌면 잘리고, 오른쪽으로 끌면 더 보인다', async () => {
    const { resizeRegionEdge } = await import('../src/lib/viewport.js');
    const cut = resizeRegionEdge(r, 'e', -0.25, 0); // 칸 폭의 1/4만큼 안으로
    expect(cut).toMatchObject({ x0: 0.2, x1: 0.5, y0: 0.2, y1: 0.4 });
    const more = resizeRegionEdge(r, 'e', 0.5, 0);
    expect(more.x1).toBe(0.8);
    expect(resizeRegionEdge(r, 'e', 5, 0).x1).toBe(1); // 쪽 끝까지만
  });
  it('위·왼쪽 변, 모서리', async () => {
    const { resizeRegionEdge } = await import('../src/lib/viewport.js');
    expect(resizeRegionEdge(r, 'n', 0, -0.5)).toMatchObject({ y0: 0.1, y1: 0.4 });
    expect(resizeRegionEdge(r, 'w', 2, 0).x0).toBe(0.58); // 반대쪽 변을 넘지 않음 (최소 2%)
    expect(resizeRegionEdge(r, 'se', -0.5, 0.5)).toMatchObject({ x1: 0.4, y1: 0.5 });
  });
});
