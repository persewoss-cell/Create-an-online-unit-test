// 캡쳐(문제지에서 잘라 보여 줄 네모)를 카메라처럼 확대·축소·이동하는 계산
// 좌표는 쪽 크기 기준 0~1. 확대·축소해도 네모의 가로세로 비율은 그대로 (화면의 칸 모양이 바뀌지 않게)

const r4 = (v) => Math.round(v * 10000) / 10000;

/** 쪽 밖으로 나가지 않게 */
export function clampRegion(r) {
  const w = Math.min(1, r.x1 - r.x0);
  const h = Math.min(1, r.y1 - r.y0);
  const x0 = Math.min(1 - w, Math.max(0, r.x0));
  const y0 = Math.min(1 - h, Math.max(0, r.y0));
  return { ...r, x0: r4(x0), y0: r4(y0), x1: r4(x0 + w), y1: r4(y0 + h) };
}

/**
 * 확대·축소: factor < 1 이면 확대(보이는 범위가 좁아짐), > 1 이면 축소.
 * (fx, fy)는 캡쳐 안 마우스 위치(0~1) — 그 점은 제자리에 둔다.
 */
export function zoomRegion(r, factor, fx = 0.5, fy = 0.5) {
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  // 너무 작아지거나(쪽의 3%) 쪽보다 커지지 않게
  const maxF = 1 / Math.max(w, h);
  const minF = 0.03 / Math.min(w, h);
  const f = Math.min(maxF, Math.max(minF, factor));
  const nw = w * f;
  const nh = h * f;
  const px = r.x0 + fx * w;
  const py = r.y0 + fy * h;
  return clampRegion({ ...r, x0: px - fx * nw, y0: py - fy * nh, x1: px - fx * nw + nw, y1: py - fy * nh + nh });
}

/** 손으로 끌어 옮기기: 화면에서 (dxFrac, dyFrac)만큼(캡쳐 칸 크기 기준) 끌면 내용이 따라 움직인다 */
export function panRegion(r, dxFrac, dyFrac) {
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  return clampRegion({ ...r, x0: r.x0 - dxFrac * w, x1: r.x1 - dxFrac * w, y0: r.y0 - dyFrac * h, y1: r.y1 - dyFrac * h });
}
