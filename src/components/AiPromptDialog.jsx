import { useEffect, useRef, useState } from 'react';
import { buildAnswerPrompt } from '../lib/aiPrompt.js';

/** 정답지를 AI 채팅에 맡길 때 쓰는 명령어(프롬프트) 보기·복사 */
export default function AiPromptDialog({ questions, title, onClose }) {
  const text = buildAnswerPrompt(questions, title);
  const [copied, setCopied] = useState('');
  const area = useRef(null);

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('ok');
    } catch {
      // 클립보드를 못 쓰는 환경: 글을 선택해 두고 Ctrl+C 안내
      area.current?.select();
      setCopied(document.execCommand?.('copy') ? 'ok' : 'manual');
    }
  }

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="ai-title" onClick={onClose}>
      <div className="modal stack ai-modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <h2 id="ai-title" style={{ margin: 0 }}>🤖 AI로 엑셀 양식에 넣을 정답 정리하기</h2>
          <div className="row" style={{ gap: 8, flexWrap: 'nowrap', flexShrink: 0 }}>
            {copied === 'ok' && <span className="save-ok">✓ 복사했어요 (Ctrl+V로 붙여 넣기)</span>}
            {copied === 'manual' && <span className="small" style={{ color: 'var(--warn)' }}>글이 선택되었어요. Ctrl+C 로 복사하세요.</span>}
            <button type="button" className="btn primary" onClick={copy}>📋 명령어 복사</button>
            <button type="button" className="manual-close" onClick={onClose} aria-label="닫기" title="닫기">✕</button>
          </div>
        </div>
        <ol className="ai-steps small">
          <li><b>명령어 복사</b>를 누르세요. 이 평가의 문항 수와 문항별 답 형식이 들어 있어요.</li>
          <li>ChatGPT · Gemini · Claude 같은 <b>AI 채팅</b>에 붙여 넣고, <b>정답지(PDF·사진)</b>를 함께 올리거나 정답을 붙여 넣어 보내세요. 배점이 문제지에 적혀 있으면 <b>문제지도 함께</b> 올리세요.</li>
          <li>AI가 만든 코드 블록을 통째로 복사(코드 블록의 <b>복사</b> 버튼)해서, ①에서 받은 정답 엑셀 양식의 <b>B2 칸</b>(1번 정답 칸)을 누르고 붙여 넣은 뒤 저장하세요. 한 줄이 한 행이 되고, 정답은 <b>B열</b>, 배점은 <b>C열(배점)</b>에 들어가요.</li>
          <li><b>③</b>에 그 엑셀을 올리면 끝! 문항별 미리보기에서 정답이 맞는지 꼭 한 번 확인하세요.</li>
        </ol>
        <div className="small ai-points">
          <b>📌 배점</b> — 정답지에 배점이 적힌 문항만 <code>정답⇥배점</code>으로 적어요. 적혀 있지 않으면 비워 두고, 그러면 100점을 고르게 나눠요.<br />
          <b>📌 부분 점수</b> — 정답지에 부분 점수가 <b>분명히 적힌 문항만</b> 답마다 <code>2 ; 2</code>처럼 나눠 적어요 (AI가 짐작해서 만들지 않게 명령어에 넣었어요). 그 밖의 문항은 모두 맞혀야 점수예요.
        </div>
        <textarea ref={area} className="ai-prompt" readOnly value={text} aria-label="AI 명령어" onFocus={(e) => e.target.select()} />
        <div className="muted small">AI도 틀릴 수 있어요. 특히 기호(①, ㉮)와 단위가 맞는지 확인해 주세요.</div>
      </div>
    </div>
  );
}
