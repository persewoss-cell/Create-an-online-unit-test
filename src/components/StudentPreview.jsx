import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import TakeExam from '../pages/student/TakeExam.jsx';

/** 선생님용: 학생 시험 화면을 그대로 띄워 보기 (답은 저장·제출되지 않음). startNo 문항부터 */
export default function StudentPreview({ exam, pages, startNo, onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // 뒤 화면이 같이 스크롤되지 않게
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);
  if (!exam?.questions?.length) return null;
  return createPortal(
    <div className="student-preview" role="dialog" aria-modal="true" aria-label="학생 화면 미리보기">
      <TakeExam preview={{ exam, pages: pages || [], startNo, onClose }} />
    </div>,
    document.body,
  );
}
