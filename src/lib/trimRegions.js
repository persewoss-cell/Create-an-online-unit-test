// 문항 영역 아래쪽의 빈 공간을 잘라낸다 (그림·밑줄 같은 글자 아닌 내용은 남긴다).
// 페이지 이미지의 픽셀을 보고, 영역 아래에서부터 위로 올라가며 처음으로 내용이 있는 줄을 찾는다.

async function loadPixels(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  return { data: ctx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
}

function lastInkRow(px, r) {
  const x0 = Math.floor((r.x0 + (r.x1 - r.x0) * 0.03) * px.w);
  const x1 = Math.ceil((r.x1 - (r.x1 - r.x0) * 0.03) * px.w);
  const top = Math.floor(r.y0 * px.h);
  for (let y = Math.min(px.h - 1, Math.ceil(r.y1 * px.h)); y > top; y--) {
    let dark = 0;
    for (let x = x0; x < x1; x++) {
      const i = (y * px.w + x) * 4;
      if (px.data[i] + px.data[i + 1] + px.data[i + 2] < 540) dark++;
      if (dark > 2) return y / px.h;
    }
  }
  return null;
}

/** questions·groups의 regions를 제자리에서 고친다 */
export async function trimRegions(pageSrcs, questions, groups) {
  const cache = new Map();
  const pixels = async (page) => {
    if (!cache.has(page)) cache.set(page, loadPixels(pageSrcs[page - 1]));
    return cache.get(page);
  };
  const all = [...questions.flatMap((q) => q.regions || []), ...groups.flatMap((g) => g.regions || [])];
  for (const r of all) {
    if (!pageSrcs[r.page - 1]) continue;
    const last = lastInkRow(await pixels(r.page), r);
    if (last != null && last + 0.012 < r.y1) r.y1 = Math.min(r.y1, last + 0.012);
  }
}
