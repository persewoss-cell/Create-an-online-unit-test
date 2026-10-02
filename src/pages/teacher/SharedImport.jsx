import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Loading from '../../components/Loading.jsx';
import { watchSharedExams, importSharedExam } from '../../lib/db.js';
import { teacherLabel } from '../../lib/school.js';

/** 공유 시험지 가져오기: 다른 선생님(모든 학교)이 공유한 시험지를 골라 내 학교·학년·반 평가로 복사 */
export default function SharedImport({ owner, onClose }) {
  const nav = useNavigate();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => watchSharedExams(setList, (e) => setError(e.code === 'permission-denied'
    ? '공유 시험지를 불러오지 못했어요. Firebase 보안 규칙을 새 규칙으로 게시했는지 확인해 주세요.'
    : e.message)), []);

  async function take(e) {
    if (!confirm(`"${e.title}" 시험지를 가져올까요?\n${teacherLabel(owner)} 평가로 복사되고, "개시 전" 상태로 만들어져요.`)) return;
    setBusy(e.id);
    setError('');
    try {
      const id = await importSharedExam(e, owner);
      onClose();
      nav(`/teacher/exam/${id}`);
    } catch (err) {
      setError(`가져오지 못했어요: ${err.message}`);
      setBusy('');
    }
  }

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = (list || [])
    .filter((e) => e.ownerUid !== owner.uid)
    .filter((e) => !words.length || words.every((w) => `${e.title} ${e.subject} ${e.unit} ${e.grade}학년 ${e.sharedBy} ${e.school}`.toLowerCase().includes(w)));

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="shared-title" onClick={onClose}>
      <div className="modal stack shared-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 id="shared-title" style={{ margin: 0 }}>공유 시험지 가져오기</h2>
          <button type="button" className="btn sm" onClick={onClose}>닫기</button>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          다른 선생님들이 공유한 시험지예요. 가져오면 문항·정답·문제지가 그대로 복사되어 <b>{teacherLabel(owner)}</b> 평가가 되고,
          "개시 전" 상태로 만들어져요. (학생 답안은 복사되지 않아요)
        </p>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="찾기: 과목, 단원, 제목, 학년…" aria-label="공유 시험지 찾기" />
        {error && <div className="alert error">{error}</div>}
        {!list && !error && <Loading />}
        {list && !shown.length && <div className="center muted">{q ? '찾는 시험지가 없어요.' : '아직 공유된 시험지가 없어요.'}</div>}
        {shown.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>평가</th><th>과목</th><th>학년</th><th className="c">문항</th><th>공유한 선생님</th><th /></tr>
              </thead>
              <tbody>
                {shown.map((e) => (
                  <tr key={e.id}>
                    <td><b>{e.title}</b><div className="muted small">{e.unit}</div></td>
                    <td>{e.subject}</td>
                    <td className="nowrap">{e.grade}학년 {e.semester}학기</td>
                    <td className="c">{e.questions?.length || 0}</td>
                    <td className="small">{e.sharedBy || e.ownerName}</td>
                    <td className="nowrap">
                      <button className="btn sm primary" disabled={!!busy} onClick={() => take(e)}>
                        {busy === e.id ? '가져오는 중…' : '가져오기'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
