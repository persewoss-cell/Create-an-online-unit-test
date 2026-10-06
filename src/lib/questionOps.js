// 선생님이 문항을 추가·이동·복제·합치기·나누기 할 때 쓰는 함수들 (편집 칸 items 기준)
// 문항 번호는 바뀐 뒤 위에서부터 1, 2, 3 … 으로 다시 매긴다. 정답·배점은 문항을 따라간다.

const clone = (x) => JSON.parse(JSON.stringify(x));

/** 번호를 1부터 다시 매기고, 지문 묶음(from~to)도 새 번호에 맞춘다 */
export function renumber(items, groups = []) {
  const next = items.map((it, i) => ({ ...it, no: i + 1 }));
  const gs = groups
    .map((g) => {
      const nos = next.filter((it) => it.group === g.id).map((it) => it.no);
      return nos.length ? { ...g, from: Math.min(...nos), to: Math.max(...nos) } : { ...g, from: null, to: null };
    });
  return { items: next, groups: gs };
}

/** 빈 새 문항 (단답형, 정답 없음) — 앞 문항과 같은 쪽 */
export function blankItem(after) {
  return {
    no: 0, page: after?.page || 1, type: 'short', points: Number(after?.points) || 0, text: '', group: null,
    choices: [], choiceCount: 0, multi: false, regions: [], manual: false, draw: false,
    keyChoices: [], answerText: '', boxAnswers: [], anyOrder: false, model: '', keywordsText: '', keyPairs: [], open: false,
  };
}

export function insertAfter(items, idx, item) {
  const out = [...items];
  out.splice(idx + 1, 0, item);
  return out;
}

/** idx 문항을 dir(-1 위로, +1 아래로)만큼 옮기기 */
export function move(items, idx, dir) {
  const j = idx + dir;
  if (j < 0 || j >= items.length) return items;
  const out = [...items];
  [out[idx], out[j]] = [out[j], out[idx]];
  return out;
}

export function duplicate(items, idx) {
  return insertAfter(items, idx, clone(items[idx]));
}

/** idx 문항과 바로 아래 문항을 하나로: 캡쳐는 이어 붙이고, 정답 형식은 위 문항 것, 배점은 더함 */
export function mergeWithNext(items, idx) {
  const a = items[idx];
  const b = items[idx + 1];
  if (!a || !b) return items;
  const merged = {
    ...a,
    regions: [...(a.regions || []), ...(b.regions || [])],
    points: Math.round(((Number(a.points) || 0) + (Number(b.points) || 0)) * 10) / 10,
    group: a.group || b.group || null,
  };
  const out = [...items];
  out.splice(idx, 2, merged);
  return out;
}

/**
 * idx 문항을 둘로: 캡쳐가 여러 개면 앞쪽 절반 / 뒤쪽 절반으로, 하나면 그 캡쳐를 위아래 반으로 나눈다.
 * 아래 문항은 정답 없는 단답형으로 새로 만든다 (위 문항의 정답은 그대로).
 */
export function split(items, idx) {
  const a = items[idx];
  if (!a) return items;
  const regs = a.regions || [];
  let top;
  let bottom;
  if (regs.length >= 2) {
    const k = Math.ceil(regs.length / 2);
    top = regs.slice(0, k);
    bottom = regs.slice(k);
  } else if (regs.length === 1) {
    const r = regs[0];
    const mid = Math.round(((r.y0 + r.y1) / 2) * 1000) / 1000;
    top = [{ ...r, y1: mid }];
    bottom = [{ ...r, y0: mid }];
  } else {
    top = [];
    bottom = [];
  }
  const half = Math.round(((Number(a.points) || 0) / 2) * 10) / 10;
  const first = { ...a, regions: top, points: half };
  const second = { ...blankItem(a), regions: bottom, page: bottom[0]?.page || a.page, group: a.group || null, points: half };
  const out = [...items];
  out.splice(idx, 1, first, second);
  return out;
}
