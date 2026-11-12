// 되돌리기·다시 실행 기록 (문항·정답 수정 화면)
//  - 누르기·바꾸기·추가·삭제 같은 조작은 한 번에 한 칸
//  - 글자 입력은 어절(띄어쓰기) 단위로 한 칸: 같은 칸에 이어서 치는 동안은 한 칸으로 묶고, 새 어절을 시작하면 새 칸
//  - 한 번의 조작에서 여러 곳이 함께 바뀌면(같은 tick) 한 칸으로 묶는다

const LIMIT = 300;

const isObj = (v) => v !== null && typeof v === 'object';

/**
 * a → b 에서 바뀐 값이 "글자/숫자 칸 하나"뿐이면 그 위치(경로 문자열)와 앞뒤 값을, 아니면 null.
 * 바뀌지 않은 부분은 같은 객체를 그대로 쓰므로(불변 갱신) 빨리 끝난다.
 */
export function singleTextChange(a, b) {
  const found = [];
  const walk = (x, y, path) => {
    if (x === y || found.length > 1) return;
    if (isObj(x) && isObj(y) && Array.isArray(x) === Array.isArray(y)) {
      if (Array.isArray(x) && x.length !== y.length) {
        found.push(null, null); // 문항·칸 추가/삭제 → 글자 입력 아님
        return;
      }
      const ks = new Set([...Object.keys(x), ...Object.keys(y)]);
      for (const k of ks) walk(x[k], y[k], `${path}/${k}`);
      return;
    }
    const prim = (v) => v === undefined || v === null || typeof v === 'string' || typeof v === 'number';
    if (prim(x) && prim(y) && (typeof x === 'string' || typeof y === 'string' || typeof x === 'number' || typeof y === 'number')) {
      found.push({ path, before: x, after: y });
    } else {
      found.push(null, null);
    }
  };
  walk(a, b, '');
  return found.length === 1 ? found[0] : null;
}

/** 어절 수 (띄어쓰기로 나눈 덩어리 수) */
export function wordCount(v) {
  return (String(v ?? '').match(/\S+/g) || []).length;
}

export function initHistory(present) {
  return { past: [], present, future: [], typing: null, tick: -1 };
}

/**
 * @param state initHistory 결과
 * @param action {type:'set', next | update:(present)=>next, tick} | {type:'undo'} | {type:'redo'} | {type:'reset', present}
 */
export function historyReducer(state, action) {
  switch (action.type) {
    case 'set': {
      const next = action.update ? action.update(state.present) : action.next;
      if (next === state.present) return state;
      // 같은 조작(같은 tick)에서 이어진 변경 → 방금 만든 칸에 합친다
      if (action.tick === state.tick && state.past.length) {
        return { ...state, present: next, typing: null };
      }
      const ch = singleTextChange(state.present, next);
      const dir = ch && (String(ch.after ?? '').length >= String(ch.before ?? '').length ? 'ins' : 'del');
      const t = state.typing;
      // 같은 칸에 같은 방향으로 이어서 치는 중이면 한 칸으로:
      //  쓰기 — 새 어절을 시작하면(어절 수가 늘면) 새 칸 / 지우기 — 어절 하나를 다 지운 뒤 앞 어절로 넘어가면 새 칸
      const sameWord = t && ch && t.path === ch.path && t.dir === dir && state.past.length
        && (dir === 'ins' ? wordCount(ch.after) <= wordCount(ch.before) : wordCount(ch.before) >= t.startWords);
      if (sameWord) {
        return { ...state, present: next, future: [], tick: action.tick };
      }
      return {
        past: [...state.past, state.present].slice(-LIMIT),
        present: next,
        future: [],
        typing: ch ? { path: ch.path, dir, startWords: wordCount(ch.before) } : null,
        tick: action.tick,
      };
    }
    case 'undo': {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1];
      return { past: state.past.slice(0, -1), present: prev, future: [state.present, ...state.future], typing: null, tick: -1 };
    }
    case 'redo': {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return { past: [...state.past, state.present], present: next, future: rest, typing: null, tick: -1 };
    }
    case 'reset':
      return initHistory(action.present);
    default:
      return state;
  }
}

// 한 번의 클릭·입력(한 이벤트) 안에서 일어난 변경을 묶기 위한 번호: 다음 작업으로 넘어가면 1 늘어난다
let tick = 0;
let scheduled = false;
export function currentTick() {
  if (!scheduled) {
    scheduled = true;
    setTimeout(() => {
      tick++;
      scheduled = false;
    }, 0);
  }
  return tick;
}
