// 학생 정보는 탭을 닫으면 사라지도록 sessionStorage에 보관
const KEY = 'student-profile';

export function saveStudent(p) {
  sessionStorage.setItem(KEY, JSON.stringify(p));
}

export function loadStudent() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

export function clearStudent() {
  sessionStorage.removeItem(KEY);
}

// 응시 중 새로고침해도 답이 남도록 임시 저장
export function draftKey(examId, p) {
  return `draft:${examId}:${p.grade}-${p.classNo}-${p.number}`;
}

export function loadDraft(examId, p) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(examId, p)) || '{}');
  } catch {
    return {};
  }
}

export function saveDraft(examId, p, answers) {
  try {
    localStorage.setItem(draftKey(examId, p), JSON.stringify(answers));
  } catch {
    /* 저장 공간이 없으면 무시 */
  }
}

export function clearDraft(examId, p) {
  try {
    localStorage.removeItem(draftKey(examId, p));
  } catch {
    /* 무시 */
  }
}
