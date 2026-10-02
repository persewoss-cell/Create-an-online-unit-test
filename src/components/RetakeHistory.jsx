import { Regions, regionsOf, stackRatio } from './ExamViews.jsx';
import { DrawLayer } from './Drawing.jsx';
import { answerToText } from '../lib/format.js';

const MARK = { correct: 'O', wrong: 'X', review: '?' };
const roundLabel = (r) => (r === 0 ? '처음 답' : `${r}차 재응시`);

/** 문제 그림 위에 학생이 그린 그림 (그림 답일 때) */
export function DrawnAnswer({ exam, pages, q, strokes }) {
  const { question } = regionsOf(exam, q);
  return (
    <div className="drawn-answer">
      <div style={{ position: 'relative' }}>
        <Regions exam={exam} pages={pages} regions={question} />
        <DrawLayer ratio={stackRatio(exam, question)} strokes={strokes} readOnly />
      </div>
    </div>
  );
}

function badgeOf(rows) {
  const last = rows[rows.length - 1];
  if (last.status === 'review') return ['review', '선생님 확인 중'];
  if (last.status === 'wrong') return ['closed', '아직 못 맞혔어요'];
  return ['open', `${last.round}차 재응시에서 맞혔어요`];
}

/** 오답 재응시한 문제마다: 문제 그림 + 처음 답 · 1차 · 2차 … 답과 채점 결과 (정답은 보여 주지 않음) */
export default function RetakeHistory({ exam, pages, history }) {
  const nos = Object.keys(history).map(Number).sort((a, b) => a - b);
  if (!nos.length) return null;
  return (
    <div className="retake-history stack">
      {nos.map((no) => {
        const q = exam.questions.find((x) => x.no === no);
        if (!q) return null;
        const { passage, question } = regionsOf(exam, q);
        const rows = history[no];
        const [cls, label] = badgeOf(rows);
        const drawn = rows.some((h) => h.answer?.strokes?.length);
        return (
          <div className="card stack" key={no}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>{no}번</h3>
              <span className={`badge ${cls}`}>{label}</span>
            </div>
            {/* 그림 답이면 회차마다 그린 그림을 문제 위에 보여 주므로, 빈 문제 그림은 생략 */}
            {!drawn && (
              <div className="retake-q">
                {passage.length > 0 && <Regions exam={exam} pages={pages} regions={passage} />}
                <Regions exam={exam} pages={pages} regions={question} />
              </div>
            )}
            <table className="data compact-table retake-rows">
              <tbody>
                {rows.map((h) => (
                  <tr key={h.round}>
                    <td className="nowrap">{roundLabel(h.round)}</td>
                    <td className="c" style={{ width: 40 }}>
                      <span className={`mark sm ${h.status}`} title={h.status === 'review' ? '선생님 확인 중' : ''}>{MARK[h.status]}</span>
                    </td>
                    <td>
                      {h.answer?.strokes?.length > 0 && <DrawnAnswer exam={exam} pages={pages} q={q} strokes={h.answer.strokes} />}
                      {answerToText({ ...q, type: q.type === 'draw' ? 'short' : q.type, draw: false }, h.answer?.strokes ? h.answer.text : h.answer)}
                      {h.status === 'review' && <span className="small muted"> (선생님 확인 중)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
