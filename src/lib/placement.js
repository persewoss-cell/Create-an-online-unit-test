// 채점된 시험지에 글씨를 쓸 "빈 곳" 찾기
// 페이지 이미지를 작은 격자로 줄여 잉크(글자·그림)가 있는 칸을 표시하고,
// 원하는 위치에서 가장 가까운, 아무것도 없는 사각형 자리를 찾는다.

export const CELL = 4; // SVG 단위(페이지 폭 1000) 기준 격자 한 칸 크기

export async function buildGrid(src, W = 1000, H = 1414) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const cols = Math.ceil(W / CELL);
  const rows = Math.ceil(H / CELL);
  const c = document.createElement('canvas');
  c.width = cols;
  c.height = rows;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, cols, rows);
  const d = ctx.getImageData(0, 0, cols, rows).data;
  const ink = new Uint8Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    const lum = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
    if (lum < 246) ink[i] = 1;
  }
  return makeGrid(ink, cols, rows);
}

export function makeGrid(ink, cols, rows) {
  // 글자에 바짝 붙지 않도록 한 칸씩 넓힌다
  const occ = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!ink[y * cols + x]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy >= 0 && yy < rows && xx >= 0 && xx < cols) occ[yy * cols + xx] = 1;
        }
      }
    }
  }
  const g = { occ, cols, rows, sat: null };
  rebuild(g);
  return g;
}

// 누적합 표: 사각형 안에 잉크가 있는지 한 번에 확인
function rebuild(g) {
  const W = g.cols + 1;
  const sat = new Int32Array(W * (g.rows + 1));
  for (let y = 0; y < g.rows; y++) {
    let run = 0;
    for (let x = 0; x < g.cols; x++) {
      run += g.occ[y * g.cols + x];
      sat[(y + 1) * W + x + 1] = sat[y * W + x + 1] + run;
    }
  }
  g.sat = sat;
}

function rectFree(g, cx0, cy0, cw, ch) {
  if (cx0 < 0 || cy0 < 0 || cx0 + cw > g.cols || cy0 + ch > g.rows) return false;
  const W = g.cols + 1;
  const s = g.sat;
  const sum = s[(cy0 + ch) * W + cx0 + cw] - s[cy0 * W + cx0 + cw] - s[(cy0 + ch) * W + cx0] + s[cy0 * W + cx0];
  return sum === 0;
}

export function occupy(g, r) {
  const x0 = Math.max(0, Math.floor(r.x / CELL));
  const y0 = Math.max(0, Math.floor(r.y / CELL));
  const x1 = Math.min(g.cols, Math.ceil((r.x + r.w) / CELL));
  const y1 = Math.min(g.rows, Math.ceil((r.y + r.h) / CELL));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g.occ[y * g.cols + x] = 1;
  rebuild(g);
}

/**
 * pref(원하는 중심점) 근처의 빈 자리. box 안에서만 찾는다.
 * @returns {{x,y,w,h}|null} SVG 단위의 사각형
 */
export function findSpot(g, pref, w, h, box) {
  const cw = Math.ceil(w / CELL);
  const ch = Math.ceil(h / CELL);
  const bx0 = Math.max(0, Math.floor(box.x0 / CELL));
  const by0 = Math.max(0, Math.floor(box.y0 / CELL));
  const bx1 = Math.min(g.cols - cw, Math.floor(box.x1 / CELL) - cw);
  const by1 = Math.min(g.rows - ch, Math.floor(box.y1 / CELL) - ch);
  const px = pref.x / CELL - cw / 2;
  const py = pref.y / CELL - ch / 2;
  let best = null;
  for (let y = by0; y <= by1; y++) {
    for (let x = bx0; x <= bx1; x++) {
      // 세로로 멀어지는 것을 가로보다 더 싫어한다(같은 줄 근처 선호)
      const dist = (x - px) ** 2 + ((y - py) * 1.6) ** 2;
      if (best && dist >= best.dist) continue;
      if (rectFree(g, x, y, cw, ch)) best = { x, y, dist };
    }
  }
  return best ? { x: best.x * CELL, y: best.y * CELL, w: cw * CELL, h: ch * CELL } : null;
}

/** 손글씨 글꼴 기준의 대략적인 글자 폭 */
export function textWidth(text, size) {
  let w = 0;
  for (const ch of text) w += /[\u0000-ÿ]/.test(ch) ? size * 0.42 : size * 0.78;
  return w + size * 0.3;
}
