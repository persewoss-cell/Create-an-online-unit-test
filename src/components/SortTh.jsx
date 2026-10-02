import { nextSort } from '../lib/examSort.js';

/** 정렬할 수 있는 열 제목: 누를 때마다 파란 ▲ 오름차순 → 파란 ▼ 내림차순 → 회색 ▲ 기본 */
export default function SortTh({ k, sort, setSort, children, center, cls = '', baseLabel = '새로 만든 순' }) {
  const on = sort?.key === k ? sort.dir : '';
  return (
    <th className={`${center ? 'c ' : ''}${cls ? `${cls} ` : ''}sortable`} aria-sort={on === 'asc' ? 'ascending' : on === 'desc' ? 'descending' : 'none'}>
      <button type="button" className="sort-btn" onClick={() => setSort(nextSort(sort, k))} title={`누를 때마다 오름차순 → 내림차순 → 기본(${baseLabel})`}>
        {children}
        <span className={`sort-arrow ${on}`} aria-hidden="true">▲</span>
      </button>
    </th>
  );
}

/** 정렬 상태를 이 기기에 기억 */
export function loadSort(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}
export function saveSort(key, s) {
  try {
    localStorage.setItem(key, JSON.stringify(s));
  } catch {
    /* 저장 불가 환경은 무시 */
  }
}
