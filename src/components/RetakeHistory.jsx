import { Regions, regionsOf } from './ExamViews.jsx';
import { answerToText } from '../lib/format.js';

const MARK = { correct: 'O', wrong: 'X', review: '?' };
const roundLabel = (r) => (r === 0 ? '처음 답' : `${r}차 재응시`);

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
        const last = rows[rows.length - 1];
        return (
          <div className="card stack" key={no}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>{no}번</h3>
              <span className={`badge ${last.status === 'wrong' ? 'closed' : 'open'}`}>
                {last.status === 'wrong' ? '아직 못 맞혔어요' : `${last.round}차 재응시에서 맞혔어요`}
              </span>
            </div>
            <div className="retake-q">
              {passage.length > 0 && <Regions exam={exam} pages={pages} regions={passage} />}
              <Regions exam={exam} pages={pages} regions={question} />
            </div>
            <table className="data compact-table retake-rows">
              <tbody>
                {rows.map((h) => (
                  <tr key={h.round}>
                    <td className="nowrap">{roundLabel(h.round)}</td>
                    <td className="c" style={{ width: 40 }}><span className={`mark sm ${h.status}`}>{MARK[h.status]}</span></td>
                    <td>{answerToText(q, h.answer) || <span className="muted">(그림)</span>}</td>
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
