import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GradedPaper } from './ExamViews.jsx';
import { normalizeSchool } from '../lib/school.js';

const HEADER_MM = 24; // 첫 쪽 위 학생 정보·부모님 확인란 높이

/** 결과지 첫 쪽 위: 학교·학년·반·번·이름, 평가 이름, 부모님 확인란 */
function SheetHeader({ exam, s }) {
  const school = s.school || exam.school || '';
  return (
    <div className="print-head" style={{ height: `${HEADER_MM - 3}mm` }}>
      <div className="print-who">
        <div className="print-exam">{exam.grade}학년 {exam.semester}학기 {exam.subject} {exam.unit || exam.title}</div>
        <div className="print-name">
          {school && <span>{normalizeSchool(school)}</span>}
          <span>{s.grade || exam.grade}학년</span>
          <span>{s.classNo}반</span>
          <span>{s.number}번</span>
          <span>이름: <b>{s.name}</b></span>
        </div>
      </div>
      <div className="print-parent">
        <div className="print-parent-label">부모님 확인</div>
        <div className="print-parent-box" />
      </div>
    </div>
  );
}

/**
 * 채점된 결과지 인쇄: 학생마다 새 쪽에서 시작, 시험지 한 쪽 = A4 한 장
 * 다 그려지면 인쇄 창을 열고, 인쇄 창을 닫으면 onDone
 * @param {{exam, keys, pages:string[], rows:{s,r}[], onDone:()=>void}} props
 */
export default function PrintSheets({ exam, keys, pages, rows, onDone }) {
  const [ready, setReady] = useState(0);
  const root = useRef(null);
  const printed = useRef(false);

  useEffect(() => {
    document.body.classList.add('printing');
    const after = () => onDone();
    window.addEventListener('afterprint', after);
    return () => {
      document.body.classList.remove('printing');
      window.removeEventListener('afterprint', after);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (printed.current || ready < rows.length) return;
    printed.current = true;
    // 문제지 이미지까지 다 읽힌 뒤 인쇄 창 열기
    const imgs = [...(root.current?.querySelectorAll('img') || [])];
    Promise.all(imgs.map((im) => (im.decode ? im.decode().catch(() => {}) : null))).then(() => {
      setTimeout(() => window.print(), 100);
    });
  }, [ready, rows.length]);

  return createPortal(
    <>
      <div className="print-wait no-print" role="status">
        <div className="card stack" style={{ alignItems: 'center' }}>
          <div><span className="spinner" /> 인쇄할 결과지를 만드는 중… ({Math.min(ready, rows.length)}/{rows.length}명)</div>
          <div className="muted small">인쇄 창이 뜨면 프린터를 고르고 인쇄하세요. 용지는 A4, 배율은 “기본값”으로 두세요.</div>
          <button type="button" className="btn sm" onClick={onDone}>닫기</button>
        </div>
      </div>
      <div className="print-root" ref={root}>
        {rows.map(({ s, r }) => (
          <section className="print-student" key={s.id}>
            <GradedPaper
              exam={exam}
              pages={pages}
              keys={keys}
              answers={s.answers}
              result={r}
              hideKeys
              printFit
              headerMm={HEADER_MM}
              header={<SheetHeader exam={exam} s={s} />}
              onReady={() => setReady((n) => n + 1)}
            />
          </section>
        ))}
      </div>
    </>,
    document.body,
  );
}
