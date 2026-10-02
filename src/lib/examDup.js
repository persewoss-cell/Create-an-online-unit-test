// 같은 학년·학기·과목·단원의 평가가 이미 있는지 (같은 단원을 또 볼 때는 "추가평가"처럼 이름을 달리해야 한다)

const norm = (v) => String(v ?? '').replace(/\s+/g, '').toLowerCase();

/** 이 평가 정보와 겹치는 평가 (없으면 null). exceptId: 지금 고치는 평가는 빼고 */
export function findSameExam(exams, { grade, semester, subject, unit }, exceptId) {
  return (exams || []).find(
    (e) =>
      e.id !== exceptId &&
      Number(e.grade) === Number(grade) &&
      Number(e.semester) === Number(semester) &&
      norm(e.subject) === norm(subject) &&
      norm(e.unit) === norm(unit),
  ) || null;
}

export function sameExamMessage(e) {
  return `같은 학년·학기·과목·단원의 평가가 이미 있어요.\n(${e.grade}학년 ${e.semester}학기 ${e.subject} ${e.unit || '(단원 없음)'})\n\n같은 단원을 또 보는 경우라면 단원명 뒤에 "추가평가", "2차" 같은 구분 이름을 붙여 주세요.`;
}
