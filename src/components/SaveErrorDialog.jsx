/**
 * 저장이 안 될 때 지금 보고 있는 화면 가운데에 이유를 띄운다.
 * "5번: 정답을 입력해 주세요." 처럼 번호가 있는 줄을 누르면 그 문항으로 바로 이동해 표시한다.
 */
export function jumpToQuestion(no) {
  const el = document.querySelector(`[data-testid="preview-${no}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('flash');
  void el.offsetWidth; // 애니메이션 다시 시작
  el.classList.add('flash');
}

export default function SaveErrorDialog({ errors, title = '저장하지 못했어요', onClose }) {
  if (!errors?.length) return null;
  const noOf = (text) => text.match(/^(\d+)번/)?.[1];
  const go = (no) => {
    onClose();
    setTimeout(() => jumpToQuestion(no), 50);
  };
  return (
    <div className="modal-back" role="alertdialog" aria-modal="true" aria-labelledby="save-err-title" onClick={onClose}>
      <div className="modal stack save-errors" onClick={(e) => e.stopPropagation()}>
        <h2 id="save-err-title" style={{ margin: 0 }}>⚠️ {title}</h2>
        <p className="muted small" style={{ margin: 0 }}>아래 내용을 고친 뒤 다시 저장해 주세요. 번호를 누르면 그 문항으로 이동해요.</p>
        <ul className="save-error-list">
          {errors.map((e, i) => {
            const no = noOf(e);
            return (
              <li key={i}>
                {no ? (
                  <button type="button" className="link-like" onClick={() => go(no)}>
                    {e} <span aria-hidden="true">→</span>
                  </button>
                ) : (
                  e
                )}
              </li>
            );
          })}
        </ul>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {noOf(errors.find(noOf) || '') && (
            <button type="button" className="btn" onClick={() => go(noOf(errors.find(noOf)))}>첫 번째 문항으로 가기</button>
          )}
          <button type="button" className="btn primary" onClick={onClose} autoFocus>확인</button>
        </div>
      </div>
    </div>
  );
}

/** 화면 안 오류 목록의 한 줄: "5번: …" 이면 눌러서 그 문항으로 이동 */
export function ErrorLine({ text }) {
  const no = text.match(/^(\d+)번/)?.[1];
  if (!no) return text;
  return (
    <button type="button" className="link-like" onClick={() => jumpToQuestion(no)}>
      {text}
    </button>
  );
}
