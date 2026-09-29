// PDF 텍스트 조각(item)들을 읽는 순서대로 줄(line)로 재구성한다.
// 2단 편집(왼쪽 단 → 오른쪽 단)된 시험지도 자동으로 감지한다.
// 각 줄은 페이지 안의 위치(0~1로 정규화, 위쪽이 0)도 함께 가진다 → 문항 이미지 자르기에 사용.

/**
 * @param {{str:string,x:number,y:number,w:number,h:number}[]} items  y는 PDF 좌표(아래에서 위로 증가)
 * @param {number} pageWidth
 * @param {number} [pageHeight]
 * @returns {{text:string,x0:number,x1:number,top:number,bottom:number,col:number}[]} 읽는 순서의 줄 목록
 */
export function layoutLines(items, pageWidth, pageHeight) {
  const clean = items.filter((it) => it.str && it.str.trim() !== '');
  if (!clean.length) return [];
  const W = pageWidth || Math.max(...clean.map((it) => it.x + it.w)) || 1;
  const H = pageHeight || Math.max(...clean.map((it) => it.y + (it.h || 10))) || 1;
  const cols = splitColumns(clean, pageWidth);
  return cols.flatMap((colItems, col) =>
    groupLines(colItems).map((l) => ({
      text: l.text,
      col,
      colCount: cols.length,
      x0: clamp(l.x0 / W),
      x1: clamp(l.x1 / W),
      top: clamp(1 - l.top / H),
      bottom: clamp(1 - l.bottom / H),
    })),
  );
}

/** 텍스트만 필요할 때 */
export function itemsToLines(items, pageWidth) {
  return layoutLines(items, pageWidth).map((l) => l.text);
}

const clamp = (v) => Math.min(1, Math.max(0, v));

function chars(it) {
  return it.str.trim().length;
}

export function splitColumns(items, pageWidth) {
  if (!pageWidth) return [items];
  const total = items.reduce((s, it) => s + chars(it), 0);
  let best = null;
  for (let r = 0.3; r <= 0.7001; r += 0.01) {
    const g = pageWidth * r;
    let left = 0;
    let right = 0;
    let cross = 0;
    for (const it of items) {
      const c = chars(it);
      if (it.x + it.w <= g) left += c;
      else if (it.x >= g) right += c;
      else cross += c;
    }
    if (left >= total * 0.2 && right >= total * 0.2 && (!best || cross < best.cross)) {
      best = { g, cross };
    }
  }
  if (!best || best.cross > total * 0.08) return [items];
  // 가운데를 가로지르는 제목 등은 왼쪽 단에 붙인다(보통 맨 위에 있으므로 먼저 읽힘)
  const left = items.filter((it) => it.x < best.g);
  const right = items.filter((it) => it.x >= best.g);
  // 각 단이 실제로 여러 줄을 가진 경우에만 2단으로 인정
  const rows = (arr) => new Set(arr.map((it) => Math.round(it.y / 4))).size;
  if (rows(left) < 3 || rows(right) < 3) return [items];
  return [left, right];
}

function groupLines(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    const h = it.h || 10;
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= Math.max(2, h * 0.45)) {
      last.items.push(it);
    } else {
      lines.push({ y: it.y, items: [it] });
    }
  }
  return lines
    .map((line) => {
      const parts = line.items.sort((a, b) => a.x - b.x);
      let text = '';
      let prevEnd = null;
      let x0 = Infinity;
      let x1 = -Infinity;
      let top = -Infinity;
      let bottom = Infinity;
      for (const it of parts) {
        const h = it.h || 10;
        const gap = prevEnd === null ? 0 : it.x - prevEnd;
        // 간격이 아주 넓으면 표의 칸 구분으로 보고 탭을 넣는다
        if (gap > h * 1.5) text = text.trimEnd() + '\t';
        else if (gap > h * 0.2 && !text.endsWith(' ') && !it.str.startsWith(' ')) text += ' ';
        text += it.str;
        prevEnd = it.x + it.w;
        if (it.str.trim()) {
          x0 = Math.min(x0, it.x);
          x1 = Math.max(x1, it.x + it.w);
          top = Math.max(top, it.y + h * 0.9);
          bottom = Math.min(bottom, it.y - h * 0.25);
        }
      }
      return {
        text: text.replace(/[  ]+/g, ' ').replace(/ ?\t ?/g, '\t').trim(),
        x0, x1, top, bottom,
      };
    })
    .filter((l) => l.text);
}
