import { useState } from 'react';
import { numberToCircled, extractKeywords } from '../lib/korean.js';
import { choiceLabel } from '../lib/parseQuestions.js';
import { parseAnswerText, buildKey } from '../lib/parseAnswers.js';
import { newItem, toItems } from '../lib/editorModel.js';

/**
 * 인식된 문항·정답을 교사가 확인하고 고치는 편집기
 * @param {{items:object[], onChange:(items)=>void, pageCount:number}} props
 */
export default function QuestionEditor({ items, onChange, pageCount }) {
  const [quick, setQuick] = useState('');
  const [quickMsg, setQuickMsg] = useState('');
  const [bulkN, setBulkN] = useState('');

  const update = (idx, patch) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));
  const add = () => {
    const last = items[items.length - 1];
    onChange([...items, newItem((last ? Number(last.no) : 0) + 1, last?.page || 1)]);
  };
  const totalPoints = Math.round(items.reduce((s, it) => s + (Number(it.points) || 0), 0) * 10) / 10;

  function distribute() {
    if (!items.length) return;
    const each = Math.floor((100 / items.length) * 10) / 10;
    const rest = Math.round((100 - each * items.length) * 10) / 10;
    onChange(items.map((it, i) => ({ ...it, points: i === items.length - 1 ? Math.round((each + rest) * 10) / 10 : each })));
  }

  function makeN() {
    const n = Number(bulkN);
    if (!(n > 0 && n <= 100)) return;
    onChange(Array.from({ length: n }, (_, i) => items[i] || newItem(i + 1, 1)));
  }

  // "1.③ 2.④ 3.광합성" 처럼 한 번에 입력한 정답 반영
  function applyQuick() {
    const map = parseAnswerText(quick.split(/\n/));
    if (!map.size) {
      setQuickMsg('번호를 찾지 못했습니다. 예) 1.③ 2.④ 3.광합성');
      return;
    }
    let applied = 0;
    const next = items.map((it) => {
      if (!map.has(Number(it.no))) return it;
      applied++;
      const { question, key } = buildKey(it, map.get(Number(it.no)));
      return { ...it, ...toItems([question], { [question.no]: key })[0], points: it.points, page: it.page, text: it.text };
    });
    onChange(next);
    setQuickMsg(`${applied}개 문항에 정답을 반영했습니다.`);
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <b>{items.length}문항</b> · 총점 <b style={{ color: totalPoints === 100 ? 'var(--ok)' : 'var(--warn)' }}>{totalPoints}점</b>
        </div>
        <div className="row">
          <button type="button" className="btn sm" onClick={distribute}>배점 100점 균등 분배</button>
          <input type="number" min="1" max="100" placeholder="문항 수" value={bulkN} onChange={(e) => setBulkN(e.target.value)} style={{ width: 90, padding: '5px 8px' }} />
          <button type="button" className="btn sm" onClick={makeN}>문항 수로 만들기</button>
        </div>
      </div>

      <details className="card" style={{ padding: 12 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>정답 빠르게 입력하기 (정답 PDF 인식이 잘 안 될 때)</summary>
        <p className="muted small">예) <code>1.③ 2.④ 3.광합성 / 광합성 작용 4.②,④</code> — 줄바꿈이나 띄어쓰기로 구분해도 됩니다.</p>
        <textarea value={quick} onChange={(e) => setQuick(e.target.value)} rows={3} aria-label="정답 빠르게 입력" />
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="btn sm primary" onClick={applyQuick}>반영</button>
          {quickMsg && <span className="small muted">{quickMsg}</span>}
        </div>
      </details>

      {items.map((it, idx) => (
        <QuestionRow key={idx} it={it} pageCount={pageCount} onChange={(p) => update(idx, p)} onRemove={() => remove(idx)} />
      ))}
      <button type="button" className="btn" onClick={add}>+ 문항 추가</button>
    </div>
  );
}

export function QuestionRow({ it, pageCount, onChange, onRemove }) {
  const noAnswer = !it.manual && (
    (it.type === 'mc' && !it.keyChoices?.length) ||
    (it.type === 'short' && !it.answerText?.trim()) ||
    (it.type === 'essay' && !it.model?.trim() && !it.keywordsText?.trim()) ||
    (it.type === 'match' && !Array.from({ length: Number(it.matchCount) || 2 }, (_, i) => it.keyPairs?.[i]).every(Boolean)));

  const toggleKey = (n) => {
    const cur = it.keyChoices || [];
    onChange({ keyChoices: cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort((a, b) => a - b) });
  };

  return (
    <div className={`qedit ${noAnswer ? 'warn' : ''}`} data-testid={`edit-${it.no}`}>
      <div className="top">
        <label>번호<input type="number" value={it.no} onChange={(e) => onChange({ no: e.target.value })} /></label>
        <label>
          유형
          <select value={it.type} onChange={(e) => onChange({ type: e.target.value })} aria-label={`${it.no}번 유형`}>
            <option value="mc">객관식</option>
            <option value="short">단답형</option>
            <option value="essay">서술형</option>
            <option value="match">선 잇기</option>
            <option value="draw">그리기</option>
          </select>
        </label>
        <label>
          {it.type === 'mc' ? '보기 수' : it.type === 'match' ? '잇는 개수' : ' '}
          {it.type === 'mc' ? (
            <input type="number" min="2" max="10" value={it.choiceCount || 5} onChange={(e) => onChange({ choiceCount: Number(e.target.value) })} />
          ) : it.type === 'match' ? (
            <input type="number" min="1" max="10" value={it.matchCount || 2} onChange={(e) => onChange({ matchCount: Number(e.target.value) })} />
          ) : <span />}
        </label>
        <label>배점<input type="number" min="0" step="0.5" value={it.points} onChange={(e) => onChange({ points: e.target.value })} aria-label={`${it.no}번 배점`} /></label>
        <label>쪽<input type="number" min="1" max={pageCount || 99} value={it.page} onChange={(e) => onChange({ page: e.target.value })} /></label>
        <label>
          문제 요약 (학생 화면에 표시)
          <input type="text" value={it.text || ''} onChange={(e) => onChange({ text: e.target.value })} />
        </label>
        <button type="button" className="btn sm danger" onClick={onRemove} title="문항 삭제">삭제</button>
      </div>

      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          className={`btn sm manual-toggle ${it.manual ? 'on' : ''}`}
          onClick={() => onChange({ manual: !it.manual })}
          aria-pressed={!!it.manual}
          style={{ marginBottom: 8 }}
        >
          {it.manual ? '✔ 선생님이 직접 채점 (켜짐)' : '선생님이 직접 채점'}
        </button>
        {it.manual && (
          <div className="small muted" style={{ marginBottom: 8 }}>
            자동 채점하지 않고 학생이 제출하면 모두 검토 요청으로 넘어옵니다. 정답은 비워 둬도 됩니다(적어 두면 검토할 때 참고로 보입니다).
          </div>
        )}
        {it.type === 'draw' && <div className="small muted">학생이 문제 그림 위에 직접 그립니다. 제출하면 선생님 확인으로 넘어옵니다.</div>}
        {(it.type === 'short' || it.type === 'essay') && (
          <label className="small row" style={{ gap: 4, marginBottom: 6 }}>
            <input type="checkbox" checked={!!it.draw} onChange={(e) => onChange({ draw: e.target.checked })} />
            그리기도 함께 하는 문항 (예: 반지름을 그어 보고 길이 쓰기)
          </label>
        )}
        {it.type === 'mc' && (
          <div className="row">
            <span className="small muted">정답</span>
            <div className="keypick">
              {Array.from({ length: Number(it.choiceCount) || 5 }, (_, i) => i + 1).map((n) => (
                <button type="button" key={n} className={it.keyChoices?.includes(n) ? 'on' : ''} onClick={() => toggleKey(n)} aria-label={`${it.no}번 정답 ${n}`}>
                  {choiceLabel(it, n)}
                </button>
              ))}
            </div>
            <label className="small row" style={{ gap: 4 }}>
              <input type="checkbox" checked={!!it.multi || (it.keyChoices || []).length > 1} onChange={(e) => onChange({ multi: e.target.checked })} />
              여러 개 고르는 문제
            </label>
          </div>
        )}
        {it.type === 'match' && (
          <div className="stack">
            {Array.from({ length: Number(it.matchCount) || 2 }, (_, i) => (
              <div key={i} className="row">
                <b>({i + 1})</b> →
                <div className="keypick">
                  {Array.from({ length: Math.max(Number(it.matchCount) || 2, (it.matchLabels || []).length) }, (_, k) => k + 1).map((v) => (
                    <button
                      type="button"
                      key={v}
                      className={it.keyPairs?.[i] === v ? 'on' : ''}
                      onClick={() => {
                        const next = [...(it.keyPairs || [])];
                        next[i] = v;
                        onChange({ keyPairs: next });
                      }}
                    >
                      {it.matchLabels?.[v - 1] || numberToCircled(v)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {it.type === 'short' && (
          <label className="field">
            <span className="small">정답 <span className="muted" style={{ fontWeight: 400 }}>— 여러 답 인정: <code>/</code> 로 구분 · 모두 써야 정답: <code>,</code> 로 구분</span></span>
            <input type="text" value={it.answerText} onChange={(e) => onChange({ answerText: e.target.value })} aria-label={`${it.no}번 정답`} />
          </label>
        )}
        {it.type === 'essay' && (
          <div className="grid2">
            <label className="field">
              <span className="small">모범 답안</span>
              <textarea rows={2} value={it.model} onChange={(e) => onChange({ model: e.target.value })} aria-label={`${it.no}번 모범 답안`} />
              <label className="small row" style={{ gap: 4, fontWeight: 400, marginTop: 4 }}>
                <input type="checkbox" checked={!!it.open} onChange={(e) => onChange({ open: e.target.checked })} />
                예시 답안 (여러 개는 / 로 구분, 예시와 다른 답은 선생님 확인)
              </label>
            </label>
            <label className="field">
              <span className="small">
                핵심어 <span className="muted" style={{ fontWeight: 400 }}>— 쉼표로 구분, 같은 뜻은 <code>|</code> (예: 증발|기화)</span>
              </span>
              <textarea rows={2} value={it.keywordsText} onChange={(e) => onChange({ keywordsText: e.target.value })} aria-label={`${it.no}번 핵심어`} />
              <button type="button" className="btn sm" style={{ marginTop: 4 }} onClick={() => onChange({ keywordsText: extractKeywords(it.model).join(', ') })}>
                모범 답안에서 핵심어 다시 뽑기
              </button>
            </label>
          </div>
        )}
        {noAnswer && <div className="small" style={{ color: 'var(--warn)', marginTop: 6 }}>⚠ 정답이 입력되지 않았습니다.</div>}
      </div>
    </div>
  );
}
