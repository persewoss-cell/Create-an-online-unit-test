import { LENIENCY } from '../lib/grading.js';
import { SUBJECTS } from '../lib/subjects.js';

export { SUBJECTS };

export function subjectName(m) {
  return m.subject === '기타' ? (m.subjectCustom || '').trim() || '기타' : m.subject;
}

export function defaultTitle(m) {
  if (!m.subject || !m.grade) return '';
  return `${m.grade}학년 ${m.semester}학기 ${subjectName(m)}${m.unit ? ` ${m.unit}` : ''} 단원평가`;
}

/** lockedGrade: 선생님 방에서는 학년을 그 선생님 학년으로 고정 (평가는 늘 그 반에만 나간다) */
export default function MetaFields({ meta, setMeta, lockedGrade }) {
  const set = (k) => (e) => setMeta({ ...meta, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return (
    <>
      <div className="grid2">
        <label className="field">
          <span>과목 *</span>
          <select value={meta.subject} onChange={set('subject')} aria-label="과목">
            <option value="">선택</option>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {meta.subject === '기타' && (
            <input type="text" value={meta.subjectCustom || ''} onChange={set('subjectCustom')} placeholder="과목 이름" style={{ marginTop: 6 }} aria-label="과목 이름" />
          )}
        </label>
        <label className="field">
          <span>학년 *</span>
          <select value={meta.grade} onChange={set('grade')} aria-label="대상 학년" disabled={!!lockedGrade}>
            <option value="">선택</option>
            {[1, 2, 3, 4, 5, 6].map((g) => <option key={g} value={g}>{g}학년</option>)}
          </select>
        </label>
        <label className="field">
          <span>학기 *</span>
          <select value={meta.semester} onChange={set('semester')} aria-label="학기">
            <option value="1">1학기</option>
            <option value="2">2학기</option>
          </select>
        </label>
        <label className="field">
          <span>단원</span>
          <input type="text" value={meta.unit} onChange={set('unit')} placeholder="예) 2. 생물과 환경" aria-label="단원" />
        </label>
      </div>
      <label className="field">
        <span>평가 제목</span>
        <input type="text" value={meta.title} onChange={set('title')} placeholder={defaultTitle(meta) || '비워 두면 자동으로 만들어집니다'} aria-label="평가 제목" />
      </label>
      <div className="grid2">
        <label className="field">
          <span>서술형·단답형 채점 기준</span>
          <select value={meta.leniency} onChange={set('leniency')} aria-label="채점 기준">
            {Object.entries(LENIENCY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
      </div>
    </>
  );
}
