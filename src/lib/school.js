// 학교·교사 계정 관련 규칙 (화면과 보안 규칙이 같은 값을 쓰도록 한곳에 모음)

/** 처음 여러 선생님용으로 바꾸기 전에 만든 평가·명단이 속한 학교 */
export const LEGACY_SCHOOL = '광양중동초등학교';

/** 관리자가 새 선생님을 만들 때 기본 비밀번호 */
export const DEFAULT_TEACHER_PASSWORD = '0000';

/** 선생님 비밀번호 최소 길이 (0000처럼 숫자 4자리도 쓸 수 있게) */
export const MIN_TEACHER_PASSWORD = 4;

/**
 * 학교 이름을 한 가지 모양으로: 띄어쓰기를 없애고, "○○초"는 "○○초등학교"로.
 * 학생·선생님이 "광양 중동초"처럼 조금 다르게 써도 같은 학교로 찾는다.
 */
export function normalizeSchool(name) {
  let s = String(name ?? '').replace(/\s+/g, '');
  if (/초$/.test(s)) s += '등학교';
  return s;
}

/** 선생님 로그인 찾기표 문서 ID: 학교_학년_반 */
export function teacherLoginId({ school, grade, classNo }) {
  return `${normalizeSchool(school)}_${Number(grade)}_${Number(classNo)}`;
}

/**
 * Firebase 로그인은 비밀번호가 6자 이상이어야 해서, 선생님이 정한 비밀번호(0000 등)를
 * 늘 같은 방식으로 늘려서 쓴다. 선생님은 이 규칙을 알 필요 없다.
 */
export function teacherAuthPassword(password) {
  return `ut-${password}-pw`;
}

/** 학생 번호: 학년-반-번호 */
export function studentIdOf(p) {
  return `${Number(p.grade)}-${Number(p.classNo)}-${Number(p.number)}`;
}

/** 학교까지 붙인 학생 번호 = 학생 명단 문서 ID: 학교이름_학년-반-번호 */
export function gsidOf(p) {
  return `${normalizeSchool(p.school)}_${studentIdOf(p)}`;
}

/** 화면에 보여 줄 선생님 이름표 */
export function teacherLabel(t) {
  if (!t) return '';
  if (!t.school) return t.name || '관리자';
  return `${t.school} ${t.grade}학년 ${t.classNo}반${t.name ? ` ${t.name}` : ''}`;
}

/** 선생님이 만든 평가가 나가는 곳: 그 선생님 학년·반 (학교 없는 관리자 계정이면 null) */
export function classTarget(owner) {
  if (!owner?.grade || !owner?.classNo) return null;
  return { grade: Number(owner.grade), classes: [Number(owner.classNo)] };
}
