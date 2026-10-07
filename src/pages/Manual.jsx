import { useEffect, useRef, useState } from 'react';

// 사용설명서: 학생 / 교사(관리자 포함). 앱의 실제 버튼 모양·아이콘을 그대로 그려서 설명한다.

/** 앱 버튼 모양 그대로 (설명용, 눌리지 않음) */
function B({ children, kind = '' }) {
  return <span className={`m-btn ${kind}`}>{children}</span>;
}
/** 상태 배지 모양 */
function Badge({ children, kind = 'draft' }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}
/** O/X/? 표시 */
function Mark({ s }) {
  return <span className={`mark sm ${s}`}>{s === 'correct' ? 'O' : s === 'wrong' ? 'X' : '?'}</span>;
}
/** 알림 모양 */
function Toast({ children }) {
  return <span className="m-toast">🔔 {children}</span>;
}

function Section({ id, icon, title, children }) {
  return (
    <section className="card stack m-section" id={id}>
      <h2>{icon} {title}</h2>
      {children}
    </section>
  );
}

function Toc({ items }) {
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <nav className="card m-toc" aria-label="차례">
      <b>차례</b>
      <ul>
        {items.map(([id, label]) => (
          <li key={id}><button type="button" className="link-like m-toc-link" onClick={() => go(id)}>{label}</button></li>
        ))}
      </ul>
    </nav>
  );
}

/** 그리기 도구 표 (학생 설명) */
function DrawTools() {
  const rows = [
    ['✏️', '펜', '손가락이나 펜으로 자유롭게 그려요.'],
    ['📏', '직선', '시작점에서 끝점까지 끌면 곧은 선이 그려져요.'],
    ['⭕', '컴퍼스', '가운데를 누르고 끌면 원이 그려져요.'],
    ['•', '점', '누른 곳에 점을 찍어요.'],
    ['🧽', '지우개', '지우고 싶은 선을 문질러 지워요.'],
    ['📐', '자 / 자 치우기', '노란 자가 나타나요. 노란 자를 끌어서 옮기고, 파란 ↻ 를 끌어서 돌려요. 그리려면 다른 도구를 누르세요.'],
    ['↩', '되돌리기', '방금 그린 것을 하나씩 취소해요.'],
    ['🗑', '모두 지우기', '그 문제에 그린 것을 모두 지워요.'],
  ];
  return (
    <table className="data compact-table m-table">
      <tbody>
        {rows.map(([i, n, d]) => (
          <tr key={n}><td className="c m-ico">{i}</td><td className="nowrap"><b>{n}</b></td><td>{d}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function StudentManual() {
  return (
    <>
      <Toc
        items={[
          ['s-login', '1. 로그인하기'],
          ['s-list', '2. 볼 수 있는 단원평가'],
          ['s-take', '3. 시험 보기'],
          ['s-answer', '4. 문제 유형별로 답하기'],
          ['s-draw', '5. 그리기 도구'],
          ['s-submit', '6. 제출하기'],
          ['s-result', '7. 결과 보기'],
          ['s-retake', '8. 오답 재응시'],
          ['s-faq', '9. 이럴 땐 이렇게'],
        ]}
      />

      <Section id="s-login" icon="✏️" title="1. 로그인하기">
        <ol className="m-steps">
          <li>첫 화면에서 <B>학생 로그인</B> 탭을 눌러요. (처음 열면 학생 로그인이 골라져 있어요.)</li>
          <li><b>학교 이름</b>을 써요. 예) <code>광양중동초등학교</code> — <code>광양중동초</code>처럼 줄여 쓰거나 띄어 써도 같은 학교로 알아들어요.</li>
          <li><b>학년</b>, <b>반</b>, <b>번호</b>는 숫자만 써요. (예: 5 / 2 / 13)</li>
          <li><b>이름</b>은 선생님 명단에 있는 이름과 똑같이 써요.</li>
          <li>
            내 태블릿·컴퓨터라면 <B>☐ 로그인 정보 저장</B>을 체크해 두면 다음에 자동으로 채워져요.
            <span className="muted"> 여러 사람이 같이 쓰는 기기에서는 체크하지 마세요.</span>
          </li>
          <li><B kind="primary">로그인</B>을 눌러요.</li>
        </ol>
        <div className="alert warn small">
          “학생 명단에 없습니다”가 나오면 학교 이름·학년·반·번호·이름을 다시 확인하세요. 그래도 안 되면 선생님께 말씀드려요.
        </div>
      </Section>

      <Section id="s-list" icon="📝" title="2. 볼 수 있는 단원평가">
        <ul className="m-list">
          <li>선생님이 <b>시험 개시</b>를 누른 평가만 보여요. 새 평가가 열리면 새로고침하지 않아도 바로 나타나고 <Toast>새 평가가 열렸어요</Toast> 알림이 떠요.</li>
          <li><B kind="primary">평가 시작</B> — 시험을 시작해요.</li>
          <li><B kind="done">✔ 응시 완료</B> <B kind="ok">평가 결과</B> — 이미 낸 평가예요. <B kind="ok">평가 결과</B>로 언제든 내 결과를 볼 수 있어요.</li>
          <li><b>지난 평가 결과</b> — 선생님이 마감한 평가는 이곳에서 결과만 볼 수 있어요.</li>
          <li>오른쪽 위 <B>나가기</B> — 로그아웃해요.</li>
        </ul>
      </Section>

      <Section id="s-take" icon="🖊️" title="3. 시험 보기">
        <ul className="m-list">
          <li>한 화면에 <b>한 문제씩</b> 나와요. 문제(같은 지문을 쓰는 문제는 지문도 함께)는 왼쪽이나 위에, <b>답 칸</b>은 오른쪽이나 아래에 있어요.</li>
          <li>위쪽에 <b>답한 문항 3/20</b>처럼 몇 문제 풀었는지와 <b>✓ 자동 저장됨</b>이 보여요. 답은 쓰는 즉시 저장돼요.</li>
          <li>
            아래쪽 버튼: <B>← 이전</B> <B>1</B><B>2</B><B>3</B>… <B kind="primary">다음 →</B> <B kind="primary">제출하기</B>
            <br />
            <span className="muted small">번호 버튼을 누르면 그 문제로 바로 가요. 답을 쓴 번호는 색이 칠해지고, 지금 보는 번호는 테두리가 생겨요.</span>
          </li>
          <li>시험 중에 선생님이 문제를 고치면 <Toast>선생님이 3번 문제를 고쳤어요. 다시 확인해 주세요.</Toast> 알림이 떠요. 그 문제를 다시 확인하세요.</li>
          <li>태블릿이 꺼지거나 인터넷이 끊겨도 괜찮아요. 다시 로그인해서 <B kind="primary">평가 시작</B>을 누르면 <b>지난번에 풀던 답</b>을 불러와 이어서 풀 수 있어요.</li>
        </ul>
      </Section>

      <Section id="s-answer" icon="🔢" title="4. 문제 유형별로 답하기">
        <table className="data m-table">
          <thead><tr><th>유형</th><th>답하는 방법</th></tr></thead>
          <tbody>
            <tr>
              <td className="nowrap"><b>객관식</b></td>
              <td>
                알맞은 보기 버튼(<B>①</B> <B>②</B> … 또는 <B>㉮</B>, <B>O</B> <B>X</B>)을 눌러요. 다시 누르면 취소돼요.
                “알맞은 것을 모두 고르세요”가 보이면 여러 개를 고를 수 있어요.
              </td>
            </tr>
            <tr>
              <td className="nowrap"><b>단답형</b></td>
              <td>
                답 칸에 답을 써요. 칸이 여러 개면 <b>순서대로</b> 한 칸에 하나씩 써요.
                <ul className="m-list small">
                  <li>띄어쓰기, ‘입니다/이다’ 같은 끝말은 달라도 괜찮아요.</li>
                  <li><b>수학은 단위를 꼭</b> 써요. 예) 3cm, 5권 — 숫자만 쓰면 틀려요.</li>
                  <li>①, ㉠, ㉮ 같은 동그라미 기호는 키보드로 <code>1</code>, <code>ㄱ</code>, <code>가</code>로 써도 돼요.</li>
                  <li>&lt;, &gt;, = 같은 기호는 태블릿 특수문자(＜ 〈 ‹ 등)로 써도 같은 기호로 채점돼요.</li>
                </ul>
              </td>
            </tr>
            <tr><td className="nowrap"><b>서술형</b></td><td>문장으로 써요. 중요한 낱말(핵심어)이 들어가야 해요.</td></tr>
            <tr><td className="nowrap"><b>선 잇기</b></td><td>왼쪽 (1), (2)… 마다 알맞은 오른쪽 짝 버튼을 하나씩 골라요.</td></tr>
            <tr>
              <td className="nowrap"><b>그리기</b></td>
              <td>
                ✏️ 문제 그림 위에 직접 그려요(아래 그리기 도구 참고). 그림과 답 칸이 같이 있는 문제는 그림을 그렸으면 답 칸을 비워도 제출할 수 있어요.
                그림은 선생님이 직접 확인해요.
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section id="s-draw" icon="📐" title="5. 그리기 도구">
        <p className="muted small" style={{ margin: 0 }}>그리기 문제에서 답 칸 위쪽에 도구 막대가 나와요.</p>
        <DrawTools />
      </Section>

      <Section id="s-submit" icon="📮" title="6. 제출하기">
        <ol className="m-steps">
          <li>마지막 문제까지 풀었으면 <B kind="primary">제출하기</B>를 눌러요.</li>
          <li>안 푼 문제가 있으면 빨간 안내 “아직 답하지 않은 문항이 있어 제출할 수 없어요: 4, 7번”이 뜨고 그 문제로 이동해요.</li>
          <li>“답안을 제출할까요?” 창에서 <B kind="primary">제출</B>을 누르면 끝! <span className="muted">(제출한 뒤에는 답을 고칠 수 없어요. <B>다시 확인하기</B>를 누르면 돌아가요.)</span></li>
        </ol>
      </Section>

      <Section id="s-result" icon="💯" title="7. 결과 보기">
        <ul className="m-list">
          <li>제출하면 바로 <b>점수</b>와 “20문항 중 17문항 정답”이 나와요.</li>
          <li>
            아래 <b>채점된 시험지</b>에 빨간 색연필로 표시돼요: <b style={{ color: 'var(--bad)' }}>○</b> 맞음,{' '}
            <b style={{ color: 'var(--bad)' }}>／</b> 틀림, <span className="m-hl">노란 표시 · 선생님 확인 중</span> = 선생님이 확인하고 있는 답이에요.
          </li>
          <li>틀린 문제의 <b>정답은 보여 주지 않아요.</b> 오답 재응시로 다시 풀어 보세요.</li>
          <li>선생님이 답을 확인하거나 정답을 고치면 점수가 바로 바뀌고 <Toast>선생님이 답을 확인했어요. 점수가 새로 반영되었어요.</Toast> 알림이 떠요.</li>
          <li>위쪽 <B>평가 목록</B>을 누르면 목록으로 돌아가요.</li>
        </ul>
      </Section>

      <Section id="s-retake" icon="🔁" title="8. 오답 재응시">
        <ol className="m-steps">
          <li>선생님이 오답 재응시를 열면 <Toast>선생님이 오답 재응시를 열었어요. 틀린 문제를 다시 풀어 보세요!</Toast> 알림이 떠요.</li>
          <li>결과 화면의 <B kind="primary">오답 재응시 (2문제)</B>를 누르면 <b>틀린 문제만</b> 다시 풀 수 있어요. 푸는 방법은 시험과 같아요.</li>
          <li><B kind="primary">제출하기</B> → <B kind="primary">제출</B>. <b>점수는 처음 제출한 점수 그대로</b>예요.</li>
          <li>또 틀린 문제가 있으면 버튼이 남아 있어서 맞힐 때까지 다시 풀 수 있어요.</li>
          <li>그림처럼 선생님이 확인해야 하는 답은 <B kind="white">선생님 확인 중</B>이 돼요. 선생님이 정답으로 하면 끝, 다시 풀라고 하면 버튼이 다시 생겨요.</li>
          <li>모두 맞히면 <B kind="white">✔ 오답 재응시 완료</B>(흰색, 누를 수 없음)가 돼요.</li>
          <li><B>재응시 결과 보기</B> — 다시 푼 문제마다 문제 그림과 <b>처음 답 · 1차 재응시 · 2차 재응시</b> 답과 <Mark s="correct" /> <Mark s="wrong" /> <Mark s="review" />가 나와요.</li>
        </ol>
      </Section>

      <Section id="s-faq" icon="❓" title="9. 이럴 땐 이렇게">
        <ul className="m-list">
          <li><b>평가가 안 보여요</b> → 선생님이 아직 <b>시험 개시</b>를 안 했거나, 다른 반 평가예요(평가는 담임 선생님이 만든 것만 보여요). 학교·학년·반을 바르게 썼는지도 확인해요.</li>
          <li><b>이미 응시했다고 나와요</b> → 한 번만 낼 수 있어요. 다시 봐야 하면 선생님께 말씀드려요. 선생님이 허락하면 <Toast>선생님이 처음부터 다시 볼 수 있게 했어요.</Toast> 알림과 <B>다시 보기</B>가 떠요.</li>
          <li><b>다른 친구 태블릿으로 바꿨어요</b> → 내 정보로 다시 로그인하면 풀던 답이 이어서 나와요.</li>
          <li><b>뒤로가기</b> → 결과 화면에서 뒤로가기를 누르면 평가 목록으로 가요.</li>
        </ul>
      </Section>
    </>
  );
}

function TeacherManual() {
  return (
    <>
      <Toc
        items={[
          ['t-start', '1. 시작하기 (계정·로그인)'],
          ['t-bar', '2. 화면 위쪽 버튼'],
          ['t-list', '3. 내 단원평가 목록'],
          ['t-roster', '4. 학생 명단 추가·수정'],
          ['t-create', '5. 새 평가 만들기'],
          ['t-key', '6. 정답 넣기 (엑셀)'],
          ['t-edit', '7. 문제지·문항 고치기'],
          ['t-open', '8. 시험 개시·마감'],
          ['t-results', '9. 결과 확인과 채점'],
          ['t-retake', '10. 오답 재응시·전체 재응시'],
          ['t-tabs', '11. 문항 분석·문항 수정·설정'],
          ['t-grading', '12. 자동 채점 기준'],
          ['t-share', '13. 시험지 공유·가져오기·삭제'],
          ['t-alerts', '14. 알림 (화면·바탕화면)'],
          ['t-admin', '15. 관리자'],
          ['t-faq', '16. 이럴 땐 이렇게'],
        ]}
      />

      <Section id="t-start" icon="🧑‍🏫" title="1. 시작하기 (계정·로그인)">
        <ol className="m-steps">
          <li>선생님 계정은 <b>관리자</b>가 만들어 줘요(학교·학년·반). <b>처음 비밀번호는 0000</b>이에요.</li>
          <li>첫 화면에서 <B>교사 로그인</B> 탭 → <b>학교</b>, <b>학년</b>, <b>반</b>, <b>비밀번호</b>를 쓰고 <B kind="primary">로그인</B>.</li>
          <li><B>☐ 로그인 정보 저장</B>을 체크하면 학교·학년·반을 기억하고, 브라우저를 닫아도 로그인이 유지돼요.</li>
          <li>처음 로그인했다면 목록 화면 위쪽 <B>비밀번호 변경</B>으로 비밀번호를 바꿔 주세요(4자 이상).</li>
          <li>이미 로그인된 상태로 첫 화면에 오면 “○○(으)로 로그인되어 있어요”와 <B kind="primary">내 단원평가로</B> <B>로그아웃</B>이 보여요.</li>
        </ol>
      </Section>

      <Section id="t-bar" icon="🧭" title="2. 화면 위쪽 버튼">
        <table className="data m-table">
          <tbody>
            <tr><td className="nowrap"><b>📝 온라인 단원평가</b></td><td>누르면 내 단원평가 목록으로 가요.</td></tr>
            <tr><td className="nowrap"><B>🔕 바탕화면 알림 켜기</B> / <B kind="okline">🔔 알림 켜짐</B></td><td>창을 내려 두어도 학생 제출을 Windows 알림으로 알려 줘요. (14번 참고)</td></tr>
            <tr><td className="nowrap"><B>비밀번호 변경</B></td><td>목록 화면에 있어요. 현재 비밀번호와 새 비밀번호를 넣어요.</td></tr>
            <tr><td className="nowrap"><B>목록</B></td><td>평가 화면·새 평가 만들기·학생 명단에서 목록으로 돌아가요.</td></tr>
            <tr><td className="nowrap"><B>로그아웃</B></td><td>모든 선생님 화면의 맨 오른쪽에 있어요.</td></tr>
          </tbody>
        </table>
      </Section>

      <Section id="t-list" icon="📋" title="3. 내 단원평가 목록">
        <ul className="m-list">
          <li>위쪽 버튼: <B>👥 학생 명단 추가·수정</B> <B kind="primary">+ 새 평가 만들기</B> <B>📥 공유 시험지 가져오기</B></li>
          <li>
            표의 열: <b>학년 · 학기 · 과목 · 단원</b> ·
            <b> 상태</b>(<Badge>개시 전</Badge> <Badge kind="open">응시 중</Badge> <Badge kind="closed">마감</Badge>) ·
            <b> 응시</b>(낸 학생 수) · <b>평균</b> · <b>검토 요청</b>(<Badge kind="review">3건</Badge>을 누르면 검토 화면) · <b>공유</b> · <b>삭제</b>
          </li>
          <li>
            <b>단원</b>(파란 글씨)을 누르면 그 평가 화면으로 들어가요. 단원을 비워 둔 평가는 평가 제목이 보여요.
          </li>
          <li>
            <b>정렬</b>: 처음에는 새로 만든 평가가 맨 위예요. 열 제목 옆 세모를 누를 때마다
            <span className="m-sort"> 회색 <span className="sort-arrow">▲</span> 기본(새로 만든 순)</span> →
            <span className="m-sort"> 파란 <span className="sort-arrow asc">▲</span> 오름차순</span> →
            <span className="m-sort"> 파란 <span className="sort-arrow desc">▲</span> 내림차순(세모가 뒤집힘)</span> →
            다시 회색 기본으로 바뀌어요. 빈 칸은 항상 맨 아래로 가고, 고른 정렬은 이 컴퓨터에 기억돼요.
          </li>
          <li>
            <b>상태 버튼</b>: 목록의 <Badge>개시 전 ↻</Badge>을 누를 때마다 <Badge>개시 전</Badge> → <Badge kind="open">응시 중</Badge> → <Badge kind="closed">마감</Badge> → <Badge>개시 전</Badge> 순서로 바뀌어요.
            평가 화면에 들어가지 않고도 바로 시험을 열고 닫을 수 있어요(마감할 때만 확인 창). 마우스를 올리면 다음 상태를 알려 줘요.
          </li>
          <li>학생이 제출하면 응시 수·평균·검토 요청이 새로고침 없이 바로 바뀌어요.</li>
        </ul>
      </Section>

      <Section id="t-roster" icon="👥" title="4. 학생 명단 추가·수정">
        <p style={{ margin: 0 }}>학생은 <b>명단에 있어야만</b> 로그인할 수 있어요(학교·학년·반·번호·이름이 모두 같아야 함). 시험 전에 꼭 등록해 주세요.</p>
        <ol className="m-steps">
          <li><B>👥 학생 명단 추가·수정</B> → <B>학생 명단 양식 다운로드</B>.</li>
          <li>엑셀에 반·번호·이름(학년)을 채워요. 학년 칸이 없으면 옆의 학년 선택으로 정해요.</li>
          <li>엑셀 파일을 📂 칸에 끌어다 놓거나 눌러서 골라요.</li>
          <li><B kind="primary">명단에 추가 (같은 번호는 덮어쓰기)</B> 또는 <B kind="danger">지금 명단을 지우고 새로 바꾸기</B>.</li>
          <li>한 명씩은 아래 칸에 학년·반·번호·이름을 넣고 <B kind="primary">+ 학생 추가</B>. 표에서 <B>수정</B> <B kind="danger">삭제</B>도 돼요.</li>
        </ol>
      </Section>

      <Section id="t-create" icon="➕" title="5. 새 평가 만들기">
        <ol className="m-steps">
          <li><B kind="primary">+ 새 평가 만들기</B>를 눌러요.</li>
          <li>
            <b>1. 문제지 PDF 올리기</b> — 📂 칸에 문제지 PDF를 끌어다 놓거나 눌러서 골라요.
            올리자마자 분석해서 <span className="m-ok">✔ 4쪽에서 문항 20개를 찾았어요.</span>가 나와요.
            문항을 하나씩 자르고, 지문(“※ 다음 글을 읽고…”)도 찾아요. 한글(HWP) 파일은 한글에서 <b>파일 → PDF로 저장하기</b> 후 올려 주세요.
          </li>
          <li>
            <b>2. 평가 정보</b> — 머리글에서 찾은 값이 자동으로 채워져요. 맞는지 확인하세요.
            <ul className="m-list small">
              <li><b>과목·학기</b>는 꼭 필요해요. 단원은 선택. <b>학년</b>은 선생님 학년으로 정해져 있어요.</li>
              <li><b>평가 제목</b>: 비우면 “5학년 1학기 수학 2. ○○ 단원평가”처럼 자동으로 만들어져요.</li>
              <li><b>같은 학년·학기·과목·단원</b>의 평가가 이미 있으면 경고가 떠요. 같은 단원을 또 볼 때는 단원명 뒤에 <code>추가평가</code>처럼 구분 이름을 붙여요(설정 탭에서 고칠 때도 같아요).</li>
              <li>만든 평가는 <b>선생님 반 학생에게만</b> 나가요. 다른 반은 공유한 시험지를 가져가서 써요.</li>
              <li><b>채점 기준</b>(평가 제목 오른쪽): 서술형·단답형을 엄격 / 보통 / 관대하게</li>
            </ul>
          </li>
          <li><B kind="primary">다음: 문항·정답 확인 →</B> 을 눌러 정답을 넣어요(6번). 이 화면에서 뒤로가기를 누르면 1단계로 돌아가요(올린 PDF는 그대로).</li>
          <li>
            맨 아래 <B kind="primary">저장</B>. 고칠 곳이 있으면 화면 가운데에 <b>⚠️ 저장하지 못했어요</b> 창이 떠요 — “5번: 정답을 입력해 주세요.”를 누르면 그 문항으로 바로 이동해요.
          </li>
          <li>저장하면 <Badge>개시 전</Badge> 상태예요. <b>아직 학생에게 보이지 않아요.</b> (8번 시험 개시)</li>
        </ol>
      </Section>

      <Section id="t-key" icon="📊" title="6. 정답 넣기 (엑셀)">
        <ol className="m-steps">
          <li><b>①</b> <B>정답 엑셀 양식 다운로드 (20문항)</B> — 번호, 정답, 배점 칸이 있는 엑셀이 받아져요. 문항마다 적는 방법 안내도 들어 있어요.</li>
          <li>
            <b>②</b> AI로 엑셀 양식에 넣을 정답 정리 (선택) <B>🤖 AI 명령어 복사하기</B> — 정답 입력이 번거로우면 AI에게 맡겨요. 창에서 <B kind="primary">📋 명령어 복사</B> →
            ChatGPT·Gemini·Claude 같은 AI 채팅에 붙여 넣고 <b>정답지(PDF·사진)</b>를 함께 보내면, 이 사이트 규칙에 맞는 정답을 <b>번호 없이 위아래로</b> 나열해 줘요
            (배점이 적혀 있으면 정답 옆에 배점도). 그대로 복사해 ①에서 받은 엑셀의 <b>B2 칸</b>(1번 정답 칸)에 붙여 넣고 저장해요. (AI도 틀릴 수 있으니 기호·단위는 꼭 확인)
          </li>
          <li><b>③</b> “정답” 칸만 채워서 📂 칸에 올려요. → “20개 문항에 정답을 넣었습니다.”</li>
        </ol>
        <table className="data m-table">
          <thead><tr><th>문항</th><th>정답 칸에 적는 법</th></tr></thead>
          <tbody>
            <tr><td>객관식</td><td><code>4</code> 또는 <code>④</code>, 기호 <code>㉮</code>, 여러 개면 <code>2, 4</code>, O/X 문제는 <code>O</code></td></tr>
            <tr><td>○표 하기</td><td><code>(3)</code></td></tr>
            <tr><td>선 잇기</td><td><code>(1)-① (2)-②</code></td></tr>
            <tr><td>단답형</td><td>답 그대로. 여러 답 인정은 <code>답1 / 답2</code></td></tr>
            <tr><td>답 칸이 여러 개</td><td>쉼표로 <code>3, 6, 9</code> — <b>쉼표 수만큼 답 칸이 자동으로 생겨요.</b> (1,000 같은 천 단위 쉼표는 나누지 않아요)</td></tr>
            <tr><td>서술형</td><td>모범 답안 문장. 예시 답안 여러 개는 <code>(예) … / …</code></td></tr>
            <tr><td>그리기</td><td><code>그리기</code>, 그림 + 답은 <code>그리기 + 3 cm</code> — <b>그리기 문항은 언제나 선생님 채점</b>으로 바뀌어요</td></tr>
            <tr><td>선생님이 직접 채점</td><td><code>검토</code></td></tr>
            <tr><td>한 문제에 답이 여러 부분</td><td>부분마다 <code>;</code> 로 구분, 예) <code>③ ; 3 cm</code>, <code>… 합과 같습니다. ; 20 cm</code> → 서술형 + 단답형 답 칸이 따로 생겨요</td></tr>
          </tbody>
        </table>
        <ul className="m-list">
          <li>배점 칸을 채우면 배점도 들어가요. 일부만 채우면 나머지 점수를 남은 문항에 고르게 나누고, 모두 비우면 그대로(균등 분배) 둬요. <B>배점 100점 균등 분배</B>로 한 번에 나눌 수도 있어요.</li>
          <li>부분 점수: 답지에 부분 점수가 있는 문항만 배점 칸에 답마다 <code>;</code> 로 적어요 — 예) 정답 <code>3 cm, 6 cm</code> → 배점 <code>2 ; 2</code>, 정답 <code>문장 ; 20 cm</code> → 배점 <code>3 ; 2</code>. 선 잇기 짝, 객관식 답 여러 개도 같아요. 숫자 하나만 적으면 모두 맞아야 점수.
            올리면 문항의 <b>세부 수정 → ☑ 부분 점수 주기</b>에 답마다 점수가 들어가고, 거기서 직접 켜고 고칠 수도 있어요.</li>
          <li>문항 카드 오른쪽은 <b>학생 화면 미리보기</b>예요(<span style={{ color: 'var(--ok)' }}>초록색</span>이 정답). 정답이 없으면 <span className="m-warn">⚠ 정답이 없습니다.</span>가 보여요.</li>
        </ul>
      </Section>

      <Section id="t-edit" icon="🛠️" title="7. 문제지·문항 고치기">
        <p style={{ margin: 0 }}><b>문제지(학생에게 보이는 부분) 고치기</b> — 문항 카드 왼쪽 위 버튼으로 해요.</p>
        <ul className="m-list">
          <li>
            <B>🖱 마우스 간편조정</B>(문제 그림 오른쪽 위) — 누르면 문제 그림 위에서 바로 <b>마우스 휠로 확대·축소</b>, <b>손 모양으로 끌어 위아래·좌우로 옮기기</b>가 돼요. 그림 <b>테두리의 파란 손잡이</b>(위·아래·왼쪽·오른쪽·모서리)를 끌면 그쪽만 조절돼요 — 예) 오른쪽 테두리를 왼쪽으로 끌면 그만큼 잘리고 남은 부분이 커지고, 오른쪽으로 끌면 그만큼 더 보여요.
            다 되면 <B kind="primary">저장</B>, 되돌리려면 <B>취소</B>. (캡쳐가 여러 개면 그림마다 따로 조정돼요)
          </li>
          <li>
            <B kind="primary">✂️ 캡쳐 상세 조정</B> — 그 쪽 문제지가 크게 뜨고 <b>파란 네모</b>가 학생에게 보이는 부분이에요.
            네모 안을 끌면 옮겨지고, 모서리·변의 점을 끌면 크기가 바뀌어요. <B>↑</B> <B>↓</B> <B>←</B> <B>→</B> <B>⊕ 크게</B> <B>⊖ 작게</B> 버튼과 키보드 화살표도 돼요.
            오른쪽에 <b>학생에게 보이는 모습</b>이 바로 보이고, <B kind="primary">적용</B>을 눌러야 반영돼요.
          </li>
          <li><B>＋ 캡쳐 추가</B> — 한 문제가 두 곳(다른 단·다른 쪽)에 나뉘어 있으면 하나 더 끌어 그려요. 위에서부터 순서대로 이어 붙여 보여요(순서 <B>▲</B><B>▼</B>). ◀ ▶로 쪽을 바꿀 수 있어요.</li>
          <li><B>⬜ 가리기 추가</B> — 정답 표시, 다른 문제 조각처럼 학생에게 안 보여야 할 부분을 흰 칸으로 덮어요(그 쪽 문제지 전체에 적용).</li>
          <li><b>지문</b> 칸 — 공통 지문 연결을 바꾸거나 <b>＋ 새 지문 만들기</b>. <B>📄 지문 캡쳐 조정</B>으로 지문 부분도 같은 방법으로 고쳐요(그 지문을 쓰는 문항 모두에 적용).</li>
          <li>
            카드 맨 위 막대: <B>▲</B><B>▼</B> 순서 바꾸기 · <B>＋ 아래에 문항 추가</B>(바로 캡쳐 창이 열려요) · <B>⧉ 복제</B> · <B>⇣ 아래 문항과 합치기</B> · <B>✂ 둘로 나누기</B> · <B kind="danger">🗑 삭제</B>.
            문항 번호는 위에서부터 <b>1, 2, 3 …으로 자동으로 다시 매겨지고</b>, 정답·배점은 문항을 따라가요. 맨 아래 <B>＋ 맨 끝에 문항 추가</B>도 있어요.
          </li>
          <li>
            <b>학생 화면 미리보기</b> — 학생이 보는 시험 화면을 그대로 띄워 넘겨 보며 답도 눌러 볼 수 있어요(저장·제출은 안 돼요).
            평가 화면 위 <B>👀 미리보기</B>(응시 마감 오른쪽), 문항 확인 화면의 <B>👀 전체 미리보기</B>(배점 100점 균등 분배 옆, 아래 <B kind="primary">문항·정답 저장</B>·<B kind="primary">저장</B> 왼쪽), 문항 카드 맨 위 막대 오른쪽 끝의 <B>👀 미리보기</B>(그 문항부터).
            오른쪽 맨 위 <B>✕ 미리보기 닫기</B> 또는 Esc로 닫아요. 저장하기 전에도 고친 내용 그대로 보여요.
          </li>
          <li>이미 응시한 학생이 있는 평가는 문항 추가·삭제·순서 바꾸기를 할 수 없어요(학생 답이 문항 번호로 저장되어 있어서). 캡쳐 조정·가리기·정답 수정은 돼요.</li>
        </ul>
        <p style={{ margin: 0 }}>문항 카드의 <B>세부 수정 ▾</B>을 누르면 펼쳐져요(<B>세부 수정 닫기 ▴</B>로 접기).</p>
        <ul className="m-list">
          <li><b>번호 · 유형 · 배점 · 쪽</b> — 유형: 객관식 (고르기) / 단답형 / 서술형 / 선 잇기 / 그리기</li>
          <li><B kind="primary">🔄 답안 유형 다시 인식하기</B> — 누를 때마다 다른 답안 유형 후보로 바꿔 줘요.</li>
          <li>
            <b>객관식 보기 기호</b>: ①②③ · ㉮㉯㉰ · O/X · <b>직접 입력</b>(보기마다 한 칸, 꼭 채우기) / 보기 수 <B>−</B> <B>+</B> / 정답 보기는 <B>정답</B>을 눌러 <B kind="okline">✓ 정답</B>으로 /
            ☐ 학생 화면 버튼에 보기 내용도 표시 / ☐ 여러 개 고르는 문제
          </li>
          <li><b>단답형</b>: 답 칸 수(2 이상이면 칸마다 정답) / 칸별 정답(한 칸에 여러 답은 <code>/</code>) / ☐ 순서가 달라도 정답으로 인정</li>
          <li><b>서술형</b>: 모범 답안, 핵심어(쉼표로 구분, 같은 뜻은 <code>증발|기화</code>)</li>
          <li>☐ <b>그리기도 함께 하는 문항</b> (예: 반지름을 그어 보고 길이 쓰기)</li>
          <li><B>선생님이 직접 채점</B> → <B kind="okline">✔ 선생님이 직접 채점 (켜짐)</B> — 자동 채점 없이 모두 검토 요청으로 와요.</li>
          <li><B>+ 답 유형 추가 (한 문제에 답이 여러 개일 때)</B> — 예) 고르기 + 단답. 모든 부분이 맞아야 정답.</li>
          <li><B kind="danger">삭제</B> — 문항 삭제</li>
        </ul>
      </Section>

      <Section id="t-open" icon="🚦" title="8. 시험 개시·마감">
        <ul className="m-list">
          <li>평가 화면 오른쪽 위: <B kind="ok">시험 개시</B> <B kind="dangerline">응시 마감</B> <B>👀 미리보기</B> <B kind="primary">결과받기(엑셀)</B></li>
          <li><B kind="ok">시험 개시</B>를 누르면 <Badge kind="open">응시 중</Badge> — 학생 목록에 바로 나타나요.</li>
          <li><B kind="dangerline">응시 마감</B>(확인 창) → <Badge kind="closed">마감</Badge> — 학생 목록에서 빠지고, 낸 학생은 결과만 볼 수 있어요. 마감 후 <B kind="ok">시험 다시 개시</B>도 돼요.</li>
          <li>지금 누를 수 없는 버튼은 흐리게 보여요.</li>
        </ul>
      </Section>

      <Section id="t-results" icon="📈" title="9. 결과 확인과 채점">
        <ul className="m-list">
          <li>위쪽 카드: <b>응시</b> 인원, <b>평균</b>(100점), <b>문항</b> 수, <b>검토 요청</b> 수</li>
          <li>
            <b>결과</b> 탭 표: 반·번·이름·점수·오답 재응시·결과지·문항별 <Mark s="correct" /> <Mark s="wrong" /> <Mark s="review" />
            <br />
            <span className="small">O/X/? 를 누르면 판정이 <b>자동 → 정답 → 오답 → 자동</b> 순서로 바뀌어요. 테두리가 있는 표시는 선생님이 직접 판정한 것이에요. 점수는 학생 화면에도 바로 반영돼요.</span>
          </li>
          <li><B>📄 보기</B> — 그 학생의 결과지. <B>채점된 시험지 보기</B> / <B>표로 보기</B>로 바꿔 볼 수 있어요.</li>
          <li>
            <B>🖨 인쇄</B>(학생 한 명) / <B>🖨 전체 결과지 인쇄 (25명)</B>(한꺼번에) — 채점된 시험지를 A4로 인쇄해요. 결과지 창의 <B>🖨 결과지 인쇄</B>도 같아요.
            첫 쪽 위에 <b>학교 · 학년 · 반 · 번 · 이름</b>과 <b>부모님 확인</b>란이 들어가고, 학생마다 새 쪽에서 시작해요.
            틀린 문제의 정답은 학생 화면처럼 적지 않아요. 인쇄 창에서 용지는 A4, 배율은 “기본값”으로 두세요.
          </li>
          <li>
            <b>검토 요청</b> 탭 — 자동으로 판단하기 어려운 답(오타, 일부만 맞음, 그림, 선생님 직접 채점 문항)이 모여요.
            문제 그림(그림 답은 문제 위에 학생 그림), 학생 답, 정답을 보고 <B kind="ok">정답 인정</B> 또는 <B kind="bad">오답 처리</B>.
          </li>
          <li><B kind="primary">결과받기(엑셀)</B> — <b>성적</b>(점수·득점·맞은 개수·등수·제출 시각·문항별 O/X), <b>답안</b>(학생 답 원문), <b>문항분석</b> 시트</li>
        </ul>
      </Section>

      <Section id="t-retake" icon="🔁" title="10. 오답 재응시·전체 재응시">
        <ul className="m-list">
          <li>결과표의 학생 줄 오른쪽: <B kind="primary">오답만 재응시</B> <B kind="danger">전체 재응시</B></li>
          <li>
            <B kind="primary">오답만 재응시</B> — 그 학생이 <b>틀린 문제만</b> 맞힐 때까지 다시 풀게 해요. <b>처음 점수는 바뀌지 않아요.</b>
            다시 누르면 <B>오답 재응시 끄기</B>. 표 위의 <B>전체 학생 오답만 재응시 (5명)</B>로 틀린 문제가 있는 학생 모두에게 한 번에 켤 수 있어요.
          </li>
          <li>“오답 재응시” 칸: <Badge kind="review">남은 1문제 · 2회</Badge> <Badge kind="review">확인 필요 1</Badge> <Badge kind="open">완료 · 3회</Badge></li>
          <li>재응시 답 중 그림처럼 확인이 필요한 답은 <b>검토 요청</b> 탭에 “1차 오답 재응시”로 와요. <B kind="ok">정답 인정</B>하면 완료, <B kind="bad">오답 처리</B>하면 학생이 다시 풀어요.</li>
          <li><B kind="danger">전체 재응시</B> — 응시 기록을 지워 <b>처음부터 다시</b> 보게 해요(확인 창).</li>
          <li>선생님 확인이 필요한 처음 답(?)은 오답 재응시에 넣지 않아요. 마감 후에도 오답 재응시는 할 수 있어요.</li>
        </ul>
      </Section>

      <Section id="t-tabs" icon="🗂️" title="11. 문항 분석·문항 수정·설정">
        <ul className="m-list">
          <li><b>문항 분석</b> — 문항별 유형, 정답, 정답률, 검토 수</li>
          <li>
            <b>문항·정답 수정</b> — 만들 때와 같은 편집 화면이에요(엑셀 다시 올리기도 됨). <B kind="primary">문항·정답 저장</B>.
            저장 버튼 옆에 <B kind="dangerline">⚠️ 고칠 곳 n개 보기</B> 또는 <span className="m-ok">✓ 저장했어요</span>가 보여요.
            <b> 응시 중에 고쳐도</b> 학생 화면에 바로 반영되고 이미 낸 학생도 새 정답으로 다시 채점돼요.
          </li>
          <li><b>설정</b> — 평가 정보(과목, 학기, 단원, 제목, 채점 기준) 바꾸고 <B kind="primary">설정 저장</B> / <b>문제지 이미지 고화질로 바꾸기</b>(같은 PDF 다시 올리기) / <b>평가 삭제</b></li>
          <li>탭을 여러 번 바꿔도 뒤로가기 한 번이면 목록으로 돌아가요.</li>
        </ul>
      </Section>

      <Section id="t-grading" icon="✅" title="12. 자동 채점 기준">
        <ul className="m-list">
          <li>띄어쓰기·문장부호·영어 대소문자·조사/어미(입니다, 이다, 예요…)는 무시해요. ‘많아진다 / 많아져요’처럼 활용형이 달라도 정답.</li>
          <li>여러 정답(<code>/</code>), 쉼표로 적은 필수 요소, 숫자+단위(24개 = 24 개입니다), 분수·소수(3/4 = 0.75 = 4분의 3)를 알아들어요.</li>
          <li><b>수학</b>은 정답에 단위가 있으면 단위를 빠뜨린 답은 틀림이에요(다른 과목은 숫자만 써도 정답).</li>
          <li>①·㉠·㉮·⑴ 같은 기호는 키보드 글자(1, ㄱ, 가, (1))로 써도 정답. &lt; &gt; = ≤ ≥ × 는 비슷한 모양 특수문자도 정답이고, 기호가 다르면(3&lt;5 / 3&gt;5) 틀림.</li>
          <li>오타가 비슷하거나 일부만 맞으면 <Mark s="review" /> <b>검토 요청</b>으로 보내요. 서술형은 핵심어 포함 비율과 모범 답안 유사도로 채점하고, 애매하면 검토 요청.</li>
          <li>채점 기준(엄격/보통/관대)은 설정에서 바꿀 수 있어요.</li>
        </ul>
      </Section>

      <Section id="t-share" icon="🤝" title="13. 시험지 공유·가져오기·삭제">
        <ul className="m-list">
          <li><B>공유</B> — 확인 창 후 <B kind="okline">✓ 공유 중</B>. <b>모든 학교 선생님</b>이 문항·정답·문제지를 보고 가져갈 수 있어요(학생 답안은 공유 안 됨). 다시 누르면 공유를 그만둬요.</li>
          <li>
            <B>📥 공유 시험지 가져오기</B> — 공유된 시험지 목록(찾기 칸으로 과목·단원·학년·학교 검색)에서 <B kind="primary">가져오기</B>.
            문항·정답·문제지가 복사되어 <b>내 학교·학년·반</b> 평가가 되고 <Badge>개시 전</Badge>으로 만들어져요. 가져온 평가는 자유롭게 고쳐도 원본에 영향이 없어요.
          </li>
          <li>목록 열: <b>학년 · 학기 · 과목 · 단원 · 문항 · 공유 정보</b>(예: <code>광양중동초 3-1</code>) · <B kind="primary">가져오기</B>. 열 제목을 누르면 내 단원평가 목록처럼 세모로 정렬돼요(기본은 최근 공유 순).</li>
          <li>내 평가에 <b>같은 학년·학기·과목·단원</b>이 이미 있으면 가져온 평가의 단원명 바로 오른쪽에 <code>(2)</code>, <code>(3)</code>…이 붙어요. 예) <code>2. 원(2)</code></li>
          <li>가져온 평가는 <b>다시 공유할 수 없어요</b>(공유 버튼이 흐림).</li>
          <li><B kind="danger">삭제</B> — 확인 창이 <b>두 번</b> 떠요. 응시 기록도 모두 지워지니 필요하면 먼저 엑셀로 받아 두세요.</li>
        </ul>
      </Section>

      <Section id="t-alerts" icon="🔔" title="14. 알림 (화면·바탕화면)">
        <ul className="m-list">
          <li>선생님 화면 어디에 있든 학생이 제출하거나 오답 재응시 답을 내면 화면 위쪽에 <Toast>2반 3번 홍길동 학생이 제출했어요. 확인할 답 1개</Toast> 알림과 <B>보기</B> 버튼이 떠요.</li>
          <li>
            <B>🔕 바탕화면 알림 켜기</B> → 브라우저가 물으면 <b>허용</b> → <B kind="okline">🔔 알림 켜짐</B>. 인터넷 창을 내리거나 다른 프로그램을 쓰고 있어도
            <b> Windows 알림</b>(화면 오른쪽 아래)으로 알려 줘요. 알림을 누르면 그 평가 화면으로 가요.
          </li>
          <li>사이트 창(탭)을 <b>닫으면</b> 알림이 오지 않아요(최소화는 괜찮아요). Windows ‘방해 금지’가 켜져 있으면 숨겨져요. 컴퓨터마다 한 번씩 켜 주세요.</li>
          <li>알림이 차단됐다면 주소창 왼쪽 <b>자물쇠 아이콘 → 알림 → 허용</b>.</li>
        </ul>
      </Section>

      <Section id="t-admin" icon="🔑" title="15. 관리자">
        <ul className="m-list">
          <li><B>교사 로그인</B> 탭 아래 <b>관리자 로그인 →</b> 에서 관리자 비밀번호로 로그인해요.</li>
          <li><b>선생님 추가</b> — 학교·학년·반(이름 선택) 입력 후 <B kind="primary">+ 선생님 추가</B>. 처음 비밀번호는 <b>0000</b>. 학교·학년·반 하나에 선생님 한 명이에요.</li>
          <li>선생님 표: <B>••••</B>를 누르면 비밀번호 보기 / <B>변경</B>(비밀번호 바꿔 주기) / <B kind="primary">방 들어가기</B> / <B>수정</B> / <B kind="danger">삭제</B></li>
          <li>
            <B kind="primary">방 들어가기</B> — 그 선생님 화면을 그대로 보고 평가·명단·채점을 고칠 수 있어요. 위에 노란 띠 <span className="m-banner">🔑 관리자로 ○○ 선생님 방을 보고 있습니다.</span>
            <B>관리자 화면으로</B>나 뒤로가기로 나와요.
          </li>
          <li><b>예전 평가·명단 옮기기</b> — 학교 구분 전에 관리자 계정으로 만든 평가·명단을 한 선생님 방으로 옮겨요(처음 한 번).</li>
        </ul>
      </Section>

      <Section id="t-faq" icon="❓" title="16. 이럴 땐 이렇게">
        <ul className="m-list">
          <li><b>학생이 로그인을 못 해요</b> → 명단에 그 학생이 있는지, 학교 이름(선생님 계정의 학교)·학년·반·번호·이름이 맞는지 확인하세요.</li>
          <li><b>학생에게 시험이 안 보여요</b> → <B kind="ok">시험 개시</B>를 눌렀는지, 학생이 로그인할 때 학교·학년·반을 바르게 썼는지 확인하세요. 평가는 선생님 반 학생에게만 보여요.</li>
          <li><b>정답을 잘못 넣었어요</b> → 문항·정답 수정 탭에서 고치고 저장하면 이미 낸 학생도 바로 다시 채점돼요.</li>
          <li><b>한 학생만 다시 보게 하고 싶어요</b> → 결과표에서 <B kind="danger">전체 재응시</B>(처음부터) 또는 <B kind="primary">오답만 재응시</B>.</li>
          <li><b>“저장 실패: Missing or insufficient permissions”</b> → 관리자에게 Firebase 보안 규칙이 최신인지 확인해 달라고 하세요.</li>
          <li><b>화면이 예전 모습이에요</b> → <b>Ctrl + F5</b>로 새로고침하세요.</li>
        </ul>
      </Section>
    </>
  );
}

/**
 * 사용설명서 팝업: 지금 화면 위에 뜨고, 오른쪽 위 ✕ (또는 Esc, 바깥 누르기)로 닫는다.
 * 학생용/교사용 탭은 팝업 안에서만 바뀐다 (주소가 바뀌지 않음)
 */
export default function ManualDialog({ initial = 'student', onClose }) {
  const [who, setWho] = useState(initial === 'teacher' ? 'teacher' : 'student');
  const bodyRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // 뒤 화면이 같이 스크롤되지 않게
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0; // 학생/교사를 바꾸면 맨 위부터
  }, [who]);
  return (
    <div className="modal-back manual-back" role="dialog" aria-modal="true" aria-labelledby="manual-title" onClick={onClose}>
      <div className="manual-modal" onClick={(e) => e.stopPropagation()}>
        <div className="manual-head">
          <h1 id="manual-title">📖 사용설명서</h1>
          <div className="login-tabs manual-tabs" role="tablist">
            {[['student', '✏️ 학생용'], ['teacher', '🧑‍🏫 교사용']].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={who === k} className={who === k ? 'active' : ''} onClick={() => setWho(k)}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="manual-close" onClick={onClose} aria-label="설명서 닫기" title="닫기">✕</button>
        </div>
        <div className="manual-body manual" ref={bodyRef}>
          <p className="muted" style={{ marginTop: 0 }}>처음 쓰는 분도 순서대로 따라 하면 돼요. 버튼은 앱에 보이는 모양 그대로 그렸어요.</p>
          {who === 'teacher' ? <TeacherManual /> : <StudentManual />}
          <footer className="maker">만든이: 강형권 선생님</footer>
        </div>
      </div>
    </div>
  );
}
