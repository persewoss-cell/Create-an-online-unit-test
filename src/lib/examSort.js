// 내 단원평가 목록 정렬 (엑셀처럼 열 제목의 ▲▼로 오름·내림차순)
//  - 정렬을 고르지 않으면 새로 만든 평가가 위로
//  - 빈 값은 오름·내림 상관없이 맨 아래, 같은 값끼리는 새로 만든 것이 위로

const STATUS_ORDER = { draft: 0, open: 1, closed: 2 };
const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });

/** 정렬할 수 있는 열: key → 값 꺼내기 */
export const SORT_COLUMNS = {
  grade: (e) => Number(e.grade) || null,
  semester: (e) => Number(e.semester) || null,
  subject: (e) => e.subject || null,
  unit: (e) => e.unit || e.title || null, // "2. 원", "10. 비" 처럼 앞 번호를 숫자로 비교 (단원이 없으면 제목)
  title: (e) => e.title || null,
  classes: (e) => (e.classes?.length ? Math.min(...e.classes) : 0), // 반 지정 없음(학년 전체)이 먼저
  status: (e) => STATUS_ORDER[e.status] ?? null,
  count: (e, st) => st?.count ?? null,
  avg: (e, st) => st?.avg ?? null,
  review: (e, st) => st?.review ?? null,
};

const created = (e) => e.createdAt?.seconds ?? Number.MAX_SAFE_INTEGER; // 방금 만들어 시간이 아직 없으면 맨 위

/**
 * @param {object[]} exams
 * @param {Record<string, object>} stats 평가 id → {count, avg, review}
 * @param {{key:string, dir:'asc'|'desc'}|null} sort
 */
export function sortExams(exams, stats = {}, sort = null) {
  const newest = (a, b) => created(b) - created(a);
  const get = sort && SORT_COLUMNS[sort.key];
  if (!get) return [...exams].sort(newest);
  const sign = sort.dir === 'desc' ? -1 : 1;
  return [...exams].sort((a, b) => {
    const va = get(a, stats[a.id]);
    const vb = get(b, stats[b.id]);
    const ea = va == null || va === '';
    const eb = vb == null || vb === '';
    if (ea || eb) return ea && eb ? newest(a, b) : ea ? 1 : -1;
    const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : collator.compare(String(va), String(vb));
    return c ? c * sign : newest(a, b);
  });
}

/** 열 제목을 누를 때: 오름차순 → 내림차순 → 정렬 해제(새로 만든 순) */
export function nextSort(sort, key) {
  if (!sort || sort.key !== key) return { key, dir: 'asc' };
  if (sort.dir === 'asc') return { key, dir: 'desc' };
  return null;
}
