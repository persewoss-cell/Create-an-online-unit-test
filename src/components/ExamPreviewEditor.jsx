// 교사용 "문항과 정답 확인": 왼쪽에 잘라낸 문항, 오른쪽에 학생이 보는 답 입력칸 + 정답 표시
import { useState } from 'react';
import { QuestionView, AnswerInput } from './ExamViews.jsx';
import FileDrop from './FileDrop.jsx';
import { QuestionRow } from './QuestionEditor.jsx';
import { fromItems, toItems } from '../lib/editorModel.js';
import { buildKey, hasAnswer } from '../lib/parseAnswers.js';
import { downloadAnswerTemplate, readAnswerSheet, answerHint, parsePoints, withSheetPoints } from '../lib/answerSheet.js';
import { TYPE_LABEL } from '../lib/format.js';
import AiPromptDialog from './AiPromptDialog.jsx';

function keyOf(it) {
  const { keys } = fromItems([it]);
  return keys[Number(it.no)];
}

/**
 * @param {{view:{groups?:object[], pageAspects?:number[]}, pages:string[], items:object[], onChange:(items)=>void, title:string}} props
 */
export default function ExamPreviewEditor({ view, pages, items, onChange, title }) {
  const [open, setOpen] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const update = (idx, patch) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));
  const totalPoints = Math.round(items.reduce((s, it) => s + (Number(it.points) || 0), 0) * 10) / 10;
  const missing = items.filter((it) => !it.manual && !hasAnswer(keyOf(it))).map((it) => it.no);

  function distribute() {
    if (!items.length) return;
    const each = Math.floor((100 / items.length) * 10) / 10;
    const rest = Math.round((100 - each * items.length) * 10) / 10;
    onChange(items.map((it, i) => ({ ...it, points: i === items.length - 1 ? Math.round((each + rest) * 10) / 10 : each })));
  }

  async function uploadSheet(file) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const { answers, points, partPoints } = await readAnswerSheet(await file.arrayBuffer());
      if (!answers.size) throw new Error('엑셀에서 정답을 찾지 못했습니다. 양식의 “번호”, “정답” 칸을 확인해 주세요.');
      let applied = 0;
      const boxChanged = []; // 엑셀 쉼표 수에 맞춰 답 칸 수가 바뀐 문항
      const next = items.map((it) => {
        const no = Number(it.no);
        if (!answers.has(no)) return it;
        applied++;
        const { question, key } = buildKey(it, answers.get(no));
        const fresh = toItems([question], { [question.no]: key })[0];
        const before = it.type === 'short' ? Math.max(1, Number(it.blankCount) || 1) : 0;
        const after = question.type === 'short' ? Math.max(1, Number(question.blankCount) || 1) : 0;
        if (before && after && before !== after) boxChanged.push(`${no}번 ${before}→${after}칸`);
        const pp = partPoints.get(no);
        return { ...fresh, points: points.get(no) ?? it.points, partPoints: pp && pp.length === fresh.parts?.length ? pp : null };
      });
      const unknown = [...answers.keys()].filter((n) => !items.some((it) => Number(it.no) === n));
      onChange(withSheetPoints(next, points));
      setMsg({
        type: unknown.length ? 'warn' : 'success',
        text: `${applied}개 문항에 정답을 넣었습니다.${boxChanged.length ? ` 엑셀 정답에 맞춰 답 칸 수를 바꿨습니다: ${boxChanged.join(', ')}.` : ''}${unknown.length ? ` 문제지에 없는 번호: ${unknown.join(', ')}번` : ''}`,
      });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="card stack" style={{ background: 'var(--primary-weak)', borderColor: '#bfd3fb' }}>
        <h2 style={{ margin: 0 }}>정답 넣기</h2>
        <div className="row" style={{ columnGap: 24 }}>
          <span className="row">
            <span><b>①</b> 양식 받기 →</span>
            <button type="button" className="btn" onClick={() => downloadAnswerTemplate(items, title)}>
              정답 엑셀 양식 다운로드 ({items.length}문항)
            </button>
          </span>
          <span className="row">
            <span><b>②</b> AI로 엑셀 양식에 넣을 정답 정리 (선택) →</span>
            <button type="button" className="btn" onClick={() => setAiOpen(true)} title="정답지를 AI 채팅에 맡겨 엑셀 정답 칸에 붙여 넣을 정답을 위아래로 나열하게 하는 명령어">
              🤖 AI 명령어 복사하기
            </button>
          </span>
        </div>
        <div className="row">
          <span><b>③</b> 번호 옆 “정답” 칸만 채워서 올리기 →</span>
          <div style={{ flex: 1, minWidth: 260 }}>
            <FileDrop compact accept=".xlsx" onFile={uploadSheet} label={busy ? '읽는 중…' : '정답 엑셀'} hint="작성한 정답 엑셀을 끌어다 놓거나 눌러서 고르세요" />
          </div>
        </div>
        <div className="small muted">
          객관식 <code>4</code> 또는 <code>④</code>, 기호 <code>㉮</code>, ○표 <code>(3)</code>, 선 잇기 <code>(1)-① (2)-②</code>, 단답형은 답 그대로
          (답 칸이 여러 개면 쉼표로 <code>3, 6, 9</code> — 쉼표 수만큼 답 칸이 생겨요),
          서술형은 모범 답안(예시 답안은 <code>(예) … / …</code>), 그리기는 <code>그리기</code>(언제나 선생님 채점), 선생님이 직접 채점할 문항은 <code>검토</code>, 한 문항에 답이 여러 종류면 <code>문장 ; 20 cm</code>. 배점 칸을 비우면 100점을 고르게 나누고, 부분 점수는 <code>3 ; 2</code>. 문항 유형·핵심어는 자동으로 정해집니다.
        </div>
        {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}
        {aiOpen && <AiPromptDialog questions={fromItems(items).questions} title={title} onClose={() => setAiOpen(false)} />}
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <b>{items.length}문항</b> · 총점 <b style={{ color: totalPoints === 100 ? 'var(--ok)' : 'var(--warn)' }}>{totalPoints}점</b>
          {missing.length > 0 && <span style={{ color: 'var(--warn)', marginLeft: 10 }}>정답 없음: {missing.join(', ')}번</span>}
        </div>
        <button type="button" className="btn sm" onClick={distribute}>배점 100점 균등 분배</button>
      </div>

      {items.map((it, idx) => {
        const key = keyOf(it);
        const q = fromItems([it]).questions[0];
        return (
          <div key={idx} className={`pcard ${hasAnswer(key) ? '' : 'warn'}`} data-testid={`preview-${it.no}`}>
            <div className="left">
              <QuestionView exam={view} q={q} pages={pages} />
            </div>
            <div className="right">
              <div className="head">
                <span className="qno">{it.no}번</span>
                <span className="badge draft">{TYPE_LABEL[it.type]}</span>
                {it.manual && <span className="badge review">선생님 채점</span>}
                {it.draw && it.type !== 'draw' && <span className="badge draft">+ 그리기</span>}
                <label className="small row" style={{ gap: 4, marginLeft: 'auto' }}>
                  배점
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={it.points}
                    onChange={(e) => update(idx, { points: e.target.value })}
                    style={{ width: 70, padding: '4px 6px' }}
                    aria-label={`${it.no}번 배점`}
                  />
                </label>
                {it.parts?.length > 0 && (
                  <PartPointsInput it={it} onChange={(patch) => update(idx, patch)} />
                )}
              </div>
              <div className="small muted">학생 화면 미리보기 (초록색이 정답)</div>
              <div className="small" style={{ color: 'var(--primary)' }}>답 쓰는 법: {answerHint(fromItems([it]).questions[0])}</div>
              {it.manual && (
                <div className="key-box" style={{ background: 'var(--warn-weak)', color: '#6b4a0f' }}>
                  선생님이 직접 채점하는 문항입니다. 학생 답은 모두 검토 요청으로 넘어옵니다.
                </div>
              )}
              <AnswerInput q={q} value={q.type === 'mc' || q.type === 'match' ? [] : ''} answerKey={it.manual ? null : key} disabled />
              {!hasAnswer(key) && <div className="small" style={{ color: 'var(--warn)' }}>⚠ 정답이 없습니다. 엑셀로 올리거나 세부 수정에서 입력하세요.</div>}
              <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen({ ...open, [idx]: !open[idx] })}>
                {open[idx] ? '세부 수정 닫기 ▴' : '세부 수정 ▾'}
              </button>
              {open[idx] && (
                <QuestionRow it={it} pageCount={pages.length} onChange={(p) => update(idx, p)} onRemove={() => remove(idx)} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 부분 점수 입력: "3 ; 2" (부분 수만큼). 비우면 모두 맞아야 점수 */
function PartPointsInput({ it, onChange }) {
  const cur = (it.partPoints || []).join(' ; ');
  const [text, setText] = useState(cur);
  const [prev, setPrev] = useState(cur);
  if (prev !== cur) {
    setPrev(cur);
    setText(cur);
  }
  const n = it.parts.length;
  function commit(v) {
    setText(v);
    if (!v.trim()) return onChange({ partPoints: null });
    const p = parsePoints(v);
    if (p?.parts?.length === n) onChange({ partPoints: p.parts, points: p.points });
  }
  const bad = text.trim() && parsePoints(text)?.parts?.length !== n;
  return (
    <label className="small row" style={{ gap: 4 }} title={`부분마다 점수를 ; 로 (${n}부분, 예: ${Array.from({ length: n }, () => 2).join(' ; ')}). 비우면 모두 맞아야 점수`}>
      부분 점수
      <input
        value={text}
        onChange={(e) => commit(e.target.value)}
        placeholder={Array.from({ length: n }, () => '-').join(' ; ')}
        style={{ width: 90, padding: '4px 6px', borderColor: bad ? 'var(--warn)' : undefined }}
        aria-label={`${it.no}번 부분 점수`}
      />
    </label>
  );
}
