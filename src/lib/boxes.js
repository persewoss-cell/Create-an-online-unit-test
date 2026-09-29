// 문제지 이미지에서 답을 써넣는 빈 네모 칸(□)을 찾는다.
// 네 변이 선으로 둘러싸여 있고 안이 비어 있는 작은 사각형을 찾는 방식.

/**
 * @param {{data:Uint8ClampedArray,w:number,h:number}} px  페이지 이미지 픽셀(RGBA)
 * @param {{x0:number,y0:number,x1:number,y1:number}} rect 찾을 범위 (픽셀)
 * @returns {{x0:number,y0:number,x1:number,y1:number}[]} 찾은 칸 (픽셀)
 */
export function findBoxesInPixels(px, rect) {
  const { data, w } = px;
  const X0 = Math.max(0, Math.floor(rect.x0));
  const Y0 = Math.max(0, Math.floor(rect.y0));
  const X1 = Math.min(w - 1, Math.ceil(rect.x1));
  const Y1 = Math.min(px.h - 1, Math.ceil(rect.y1));
  const dark = (x, y) => {
    const i = (y * w + x) * 4;
    return data[i] + data[i + 1] + data[i + 2] < 600; // 옅은 회색 테두리도 선으로 본다
  };
  const scale = w / 1100; // 폭 1100px 기준 크기
  const minW = 22 * scale;
  const maxW = 180 * scale;
  const minH = 20 * scale;
  const maxH = 80 * scale;

  // 1) 가로선 조각 찾기
  const runs = [];
  for (let y = Y0; y <= Y1; y++) {
    let start = -1;
    for (let x = X0; x <= X1 + 1; x++) {
      const d = x <= X1 && dark(x, y);
      if (d && start < 0) start = x;
      if (!d && start >= 0) {
        const len = x - start;
        if (len >= minW && len <= maxW) runs.push({ x0: start, x1: x - 1, y });
        start = -1;
      }
    }
  }
  // 2) 위·아래 가로선 짝 + 양쪽 세로선 + 속이 비어 있는지 확인
  const colDark = (x, ya, yb) => {
    let n = 0;
    for (let y = ya; y <= yb; y++) if (dark(x, y) || (x > 0 && dark(x - 1, y)) || (x < w - 1 && dark(x + 1, y))) n++;
    return n / (yb - ya + 1);
  };
  const boxes = [];
  for (const top of runs) {
    for (const bot of runs) {
      const hgt = bot.y - top.y;
      if (hgt < minH || hgt > maxH) continue;
      if (Math.abs(bot.x0 - top.x0) > 4 * scale + 1 || Math.abs(bot.x1 - top.x1) > 4 * scale + 1) continue;
      // 세로선: 모서리가 둥글 수 있으므로 가로선 끝 근처에서 가장 진한 세로 줄을 찾는다 (모서리 부분은 빼고)
      const r = Math.ceil(7 * scale);
      const ya = top.y + r;
      const yb = bot.y - r;
      if (yb <= ya) continue;
      let left = 0;
      let right = 0;
      for (let dx = -r; dx <= 2; dx++) {
        left = Math.max(left, colDark(Math.max(0, top.x0 + dx), ya, yb));
        right = Math.max(right, colDark(Math.min(w - 1, top.x1 - dx), ya, yb));
      }
      if (left < 0.8 || right < 0.8) continue;
      // 안쪽이 비어 있어야 답 칸
      const ix0 = top.x0 + Math.ceil(4 * scale);
      const ix1 = top.x1 - Math.ceil(4 * scale);
      const iy0 = top.y + Math.ceil(4 * scale);
      const iy1 = bot.y - Math.ceil(4 * scale);
      if (ix1 <= ix0 || iy1 <= iy0) continue;
      let ink = 0;
      let all = 0;
      for (let y = iy0; y <= iy1; y += 2) {
        for (let x = ix0; x <= ix1; x += 2) {
          all++;
          if (dark(x, y)) ink++;
        }
      }
      if (ink / all > 0.04) continue;
      const b = { x0: top.x0, y0: top.y, x1: top.x1, y1: bot.y };
      if (!boxes.some((o) => overlap(o, b))) boxes.push(b);
    }
  }
  // 읽는 순서 (위→아래, 왼→오른)
  return boxes.sort((a, b) => (Math.abs(a.y0 - b.y0) < 12 * scale ? a.x0 - b.x0 : a.y0 - b.y0));
}

function overlap(a, b) {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}
